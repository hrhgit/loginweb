/**
 * 作品数据管理 - 使用 Vue Query
 * 提供智能缓存、后台更新、离线支持等功能
 */

import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useSafeMutation as useMutation, useSafeQuery as useQuery } from './useSafeQuery'
import { supabase } from '../lib/supabase'
import { queryKeys, createOptimizedQuery } from '../lib/vueQuery'
import { useAppStore } from '../store/appStore'
import { apiErrorHandler } from '../store/enhancedErrorHandling'
import type { SubmissionWithTeam } from '../store/models'

type TeamRef = { id?: string; name?: string } | null | undefined

const normalizeTeamRef = (value: unknown): TeamRef => {
  if (Array.isArray(value)) return (value[0] as TeamRef) ?? null
  if (value && typeof value === 'object') return value as TeamRef
  return null
}

const mapSubmissionRow = (item: any): SubmissionWithTeam => {
  const teamRef = normalizeTeamRef(item.teams)
  const team = teamRef?.id ? { id: teamRef.id, name: teamRef.name || '' } : null

  return {
    id: item.id,
    event_id: item.event_id,
    team_id: item.team_id,
    submitted_by: item.submitted_by,
    project_name: item.project_name,
    intro: item.intro,
    cover_path: item.cover_path,
    video_link: item.video_link,
    link_mode: item.link_mode as 'link' | 'file',
    submission_url: item.submission_url,
    submission_storage_path: item.submission_storage_path,
    submission_password: item.submission_password,
    created_at: item.created_at,
    updated_at: item.updated_at,
    team
  }
}

// 作品数据获取函数
// 支持分页
const fetchSubmissions = async (eventId: string, page = 1, limit = 18): Promise<{ submissions: SubmissionWithTeam[], total: number }> => {
  if (!eventId) return { submissions: [], total: 0 }

  const from = (page - 1) * limit
  const to = from + limit - 1

  const { data, count, error } = await supabase
    .from('submissions')
    .select(`
      id,
      event_id,
      team_id,
      submitted_by,
      project_name,
      intro,
      cover_path,
      video_link,
      link_mode,
      submission_url,
      submission_storage_path,
      submission_password,
      created_at,
      updated_at,
      teams(
        id,
        name
      )
    `, { count: 'exact' })
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    apiErrorHandler.handleError(error, { operation: 'fetchSubmissions' })
    throw error
  }

  const submissions = (data || []).map(mapSubmissionRow)

  return { submissions, total: count || 0 }
}

const fetchSubmissionsByTeam = async (teamId: string): Promise<SubmissionWithTeam[]> => {
  if (!teamId) return []

  const { data, error } = await supabase
    .from('submissions')
    .select(`
      id,
      event_id,
      team_id,
      submitted_by,
      project_name,
      intro,
      cover_path,
      video_link,
      link_mode,
      submission_url,
      submission_storage_path,
      submission_password,
      created_at,
      updated_at,
      teams(
        id,
        name
      )
    `)
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })

  if (error) {
    apiErrorHandler.handleError(error, { operation: 'fetchSubmissionsByTeam' })
    throw error
  }

  return (data || []).map(mapSubmissionRow)
}

const fetchMyTeamIdsForEvent = async (eventId: string, userId: string): Promise<string[]> => {
  if (!eventId || !userId) return []

  const [
    { data: leaderTeams, error: leaderError },
    { data: memberTeams, error: memberError },
  ] = await Promise.all([
    supabase
      .from('teams')
      .select('id')
      .eq('event_id', eventId)
      .eq('leader_id', userId),
    supabase
      .from('team_members')
      .select('team_id, teams!inner(event_id)')
      .eq('user_id', userId)
      .eq('teams.event_id', eventId),
  ])

  if (leaderError) {
    apiErrorHandler.handleError(leaderError, { operation: 'fetchMyTeamIdsForEvent.leader' })
    throw leaderError
  }
  if (memberError) {
    apiErrorHandler.handleError(memberError, { operation: 'fetchMyTeamIdsForEvent.member' })
    throw memberError
  }

  const teamIds = new Set<string>()
  for (const row of leaderTeams ?? []) {
    if ((row as { id?: string }).id) teamIds.add((row as { id: string }).id)
  }
  for (const row of memberTeams ?? []) {
    if ((row as { team_id?: string }).team_id) teamIds.add((row as { team_id: string }).team_id)
  }

  return Array.from(teamIds)
}

const fetchMySubmissions = async (eventId: string, userId: string): Promise<SubmissionWithTeam[]> => {
  if (!eventId || !userId) return []

  const teamIds = await fetchMyTeamIdsForEvent(eventId, userId)
  if (teamIds.length === 0) return []

  const { data, error } = await supabase
    .from('submissions')
    .select(`
      id,
      event_id,
      team_id,
      submitted_by,
      project_name,
      intro,
      cover_path,
      video_link,
      link_mode,
      submission_url,
      submission_storage_path,
      submission_password,
      created_at,
      updated_at,
      teams(
        id,
        name
      )
    `)
    .eq('event_id', eventId)
    .in('team_id', teamIds)
    .order('created_at', { ascending: false })

  if (error) {
    apiErrorHandler.handleError(error, { operation: 'fetchMySubmissions' })
    throw error
  }

  return (data || []).map(mapSubmissionRow)
}

// Vue Query Hooks

/**
 * 获取活动的作品列表（支持分页）
 */

export function useSubmissions(eventId: string, initialPage = 1, initialLimit = 18) {
  const page = ref(initialPage)
  const limit = ref(initialLimit)

  const result = useQuery({
    queryKey: computed(() => queryKeys.submissions.list(eventId, { page: page.value, limit: limit.value })),
    queryFn: () => fetchSubmissions(eventId, page.value, limit.value),
    staleTime: 30 * 1000,
    gcTime: 1000 * 60 * 15,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: (failureCount, error) => {
      const isNetworkError = error?.message?.includes('网络') || 
                            error?.message?.includes('fetch') ||
                            error?.code === 'NETWORK_ERROR'
      return isNetworkError && failureCount < 3
    },
    enabled: computed(() => Boolean(eventId)),
    placeholderData: (previousData) => previousData, // 保持旧数据平滑过渡
  })
  
  return {
    ...result,
    page,
    limit,
    submissions: computed(() => result.data.value?.submissions || []),
    total: computed(() => result.data.value?.total || 0),
    totalPages: computed(() => Math.ceil((result.data.value?.total || 0) / limit.value))
  }
}

/**
 * 获取用户在活动中的作品列表
 */
export function useMySubmissions(eventId: MaybeRefOrGetter<string>, userId: MaybeRefOrGetter<string>) {
  const resolvedEventId = computed(() => toValue(eventId))
  const resolvedUserId = computed(() => toValue(userId))

  return useQuery({
    queryKey: computed(() => queryKeys.submissions.byUser(resolvedEventId.value, resolvedUserId.value)),
    queryFn: () => fetchMySubmissions(resolvedEventId.value, resolvedUserId.value),
    enabled: computed(() => Boolean(resolvedEventId.value && resolvedUserId.value)),
    staleTime: 30 * 1000,
  })
}

/**
 * 获取队伍的作品列表
 */
export function useSubmissionsByTeam(teamId: string) {
  const queryConfig = createOptimizedQuery(
    queryKeys.submissions.byTeam(teamId),
    () => fetchSubmissionsByTeam(teamId),
    'standard' // 标准数据类型
  )
  
  return useQuery({
    ...queryConfig,
    enabled: computed(() => Boolean(teamId)),
  })
}

/**
 * 创建作品提交
 */
export function useCreateSubmission() {
  const queryClient = useQueryClient()
  const store = useAppStore()

  return useMutation({
    mutationFn: async (payload: {
      eventId: string
      teamId: string
      submissionData: {
        project_name: string
        intro: string
        cover_path?: string
        video_link?: string
        link_mode: 'link' | 'file'
        submission_url?: string
        submission_storage_path?: string
        submission_password?: string
      }
    }) => {
      if (!store.user) throw new Error('请先登录')

      const { data, error } = await supabase
        .from('submissions')
        .insert({
          event_id: payload.eventId,
          team_id: payload.teamId,
          submitted_by: store.user.id,
          ...payload.submissionData,
        })
        .select('*')
        .single()

      if (error) {
        apiErrorHandler.handleError(error, { operation: 'createSubmission' })
        throw error
      }

      return data
    },
    onSuccess: (_, variables) => {
      // 使相关缓存失效，触发重新获取
      queryClient.invalidateQueries({
        queryKey: queryKeys.submissions.byEvent(variables.eventId)
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.submissions.byTeam(variables.teamId)
      })
      if (store.user?.id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.submissions.byUser(variables.eventId, store.user.id)
        })
      }
      
      store.setBanner('info', '作品提交成功！')
    },
    onError: (error: any) => {
      store.setBanner('error', error.message || '作品提交失败')
    },
  })
}

/**
 * 更新作品信息
 */
export function useUpdateSubmission() {
  const queryClient = useQueryClient()
  const store = useAppStore()

  return useMutation({
    mutationFn: async (payload: {
      submissionId: string
      eventId: string
      teamId: string
      submissionData: {
        project_name?: string
        intro?: string
        cover_path?: string
        video_link?: string
        link_mode?: 'link' | 'file'
        submission_url?: string
        submission_storage_path?: string
        submission_password?: string
      }
    }) => {
      if (!store.user) throw new Error('请先登录')

      const { data, error } = await supabase
        .from('submissions')
        .update({
          ...payload.submissionData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.submissionId)
        .select('*')
        .single()

      if (error) {
        apiErrorHandler.handleError(error, { operation: 'updateSubmission' })
        throw error
      }

      return data
    },
    onSuccess: (_, variables) => {
      // 更新相关缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.submissions.byEvent(variables.eventId)
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.submissions.byTeam(variables.teamId)
      })
      if (store.user?.id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.submissions.byUser(variables.eventId, store.user.id)
        })
      }
      
      store.setBanner('info', '作品信息已更新')
    },
    onError: (error: any) => {
      store.setBanner('error', error.message || '更新作品失败')
    },
  })
}

/**
 * 删除作品
 */
export function useDeleteSubmission() {
  const queryClient = useQueryClient()
  const store = useAppStore()

  return useMutation({
    mutationFn: async (payload: {
      submissionId: string
      eventId: string
      teamId: string
    }) => {
      if (!store.user) throw new Error('请先登录')

      const { error } = await supabase
        .from('submissions')
        .delete()
        .eq('id', payload.submissionId)

      if (error) {
        apiErrorHandler.handleError(error, { operation: 'deleteSubmission' })
        throw error
      }

      return payload
    },
    onSuccess: (data) => {
      // 使相关缓存失效
      queryClient.invalidateQueries({
        queryKey: queryKeys.submissions.byEvent(data.eventId)
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.submissions.byTeam(data.teamId)
      })
      if (store.user?.id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.submissions.byUser(data.eventId, store.user.id)
        })
      }
      
      store.setBanner('info', '作品已删除')
    },
    onError: (error: any) => {
      store.setBanner('error', error.message || '删除作品失败')
    },
  })
}

// 便捷的组合函数
export function useSubmissionData(eventId: string, initialPage = 1, initialLimit = 18) {
  const submissions = useSubmissions(eventId, initialPage, initialLimit)

  return {
    submissions,
    isLoading: submissions.isLoading,
    error: submissions.error,
    refetch: submissions.refetch,
    // 分页相关
    page: submissions.page,
    limit: submissions.limit,
    total: submissions.total,
    totalPages: submissions.totalPages,
    // 按队伍分组的作品
    submissionsByTeam: computed(() => {
      const data = submissions.submissions.value || []
      const grouped: Record<string, SubmissionWithTeam[]> = {}
      
      data.forEach(submission => {
        if (submission.team_id) {
          if (!grouped[submission.team_id]) {
            grouped[submission.team_id] = []
          }
          grouped[submission.team_id].push(submission)
        }
      })
      
      return grouped
    }),
  }
}
