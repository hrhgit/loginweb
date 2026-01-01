/**
 * 作品数据管理 - 使用 Vue Query
 * 提供智能缓存、后台更新、离线支持等功能
 */

import { computed } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { supabase } from '../lib/supabase'
import { queryKeys, createOptimizedQuery } from '../lib/vueQuery'
import { useAppStore } from '../store/appStore'
import { apiErrorHandler } from '../store/enhancedErrorHandling'
import { prefetchRelatedData } from '../utils/vueQueryBatchOptimizer'
import type { SubmissionWithTeam } from '../store/models'

// 作品数据获取函数
const fetchSubmissions = async (eventId: string): Promise<SubmissionWithTeam[]> => {
  if (!eventId) return []

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
    .order('created_at', { ascending: false })

  if (error) {
    apiErrorHandler.handleError(error, { operation: 'fetchSubmissions' })
    throw error
  }

  // 转换数据格式
  return (data || []).map(item => {
    // 处理队伍数据 - Supabase 的关联可能返回对象或数组
    let teamData = null
    if (item.teams) {
      if (Array.isArray(item.teams) && item.teams.length > 0) {
        teamData = { id: item.teams[0].id, name: item.teams[0].name }
      } else if (typeof item.teams === 'object' && !Array.isArray(item.teams) && 'id' in item.teams) {
        teamData = { id: (item.teams as any).id, name: (item.teams as any).name }
      }
    }
    
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
      team: teamData
    }
  })
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

  return (data || []).map(item => ({
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
    team: item.teams ? {
      id: (item.teams as any).id,
      name: (item.teams as any).name
    } : null
  }))
}

// Vue Query Hooks

/**
 * 获取活动的作品列表
 */
export function useSubmissions(eventId: string) {
  const queryConfig = createOptimizedQuery(
    queryKeys.submissions.byEvent(eventId),
    () => fetchSubmissions(eventId),
    'standard' // 标准数据类型：30秒过期，15分钟垃圾回收
  )
  
  const result = useQuery({
    ...queryConfig,
    enabled: computed(() => Boolean(eventId)),
  })
  
  // 预取相关数据以提高性能
  if (result.data.value && eventId) {
    prefetchRelatedData(queryKeys.submissions.byEvent(eventId))
  }
  
  return result
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
      
      store.setBanner('info', '作品已删除')
    },
    onError: (error: any) => {
      store.setBanner('error', error.message || '删除作品失败')
    },
  })
}

// 便捷的组合函数
export function useSubmissionData(eventId: string) {
  const submissions = useSubmissions(eventId)

  return {
    submissions,
    isLoading: submissions.isLoading,
    error: submissions.error,
    refetch: submissions.refetch,
    // 按队伍分组的作品
    submissionsByTeam: computed(() => {
      const data = submissions.data.value || []
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