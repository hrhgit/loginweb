/**
 * 队伍数据管理 - 使用 Vue Query
 * 提供智能缓存、后台更新、离线支持等功能
 */

import { computed } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useSafeMutation as useMutation, useSafeQuery as useQuery } from './useSafeQuery'
import { supabase } from '../lib/supabase'
import { queryKeys, createOptimizedQuery } from '../lib/vueQuery'
import { useAppStore } from '../store/appStore'
import { teamErrorHandler } from '../store/enhancedErrorHandling'
import type { 
  TeamLobbyTeam, 
  TeamMember, 
  TeamSeeker
} from '../store/models'

// 队伍数据获取函数
// 支持分页：page 从 1 开始，limit 默认为 18
const fetchTeams = async (eventId: string, page = 1, limit = 18): Promise<{ teams: TeamLobbyTeam[], total: number }> => {
  console.log(`[useTeams] fetchTeams called with eventId: ${eventId}, page: ${page}, limit: ${limit}`)
  
  if (!eventId) {
    return { teams: [], total: 0 }
  }

  const from = (page - 1) * limit
  const to = from + limit - 1

  console.log('[useTeams] fetchTeams: Fetching teams page from database...')
  const { data, count, error } = await supabase
    .from('teams')
    .select('*', { count: 'exact' })
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[useTeams] fetchTeams: Database error:', error)
    teamErrorHandler.handleError(error, { operation: 'fetchTeams' })
    throw error
  }

  console.log(`[useTeams] fetchTeams: Fetched ${data?.length || 0} teams, total count: ${count}`)

  // 仅获取当前页队伍的成员数量
  const teamIds = (data || []).map(team => team.id).filter(Boolean)
  // 使用之前优化的批量查询（现在只查当前页的 18 个 ID，非常快）
  const memberCounts = await fetchTeamMemberCounts(teamIds)

  const teams = (data || []).map(team => ({
    id: team.id,
    event_id: team.event_id,
    leader_id: team.leader_id,
    name: team.name || '',
    leader_qq: team.leader_qq || '',
    intro: team.intro || '',
    needs: Array.isArray(team.needs) ? team.needs : [],
    extra: team.extra || '',
    members: Math.max(1, memberCounts[team.id] || 0),
    is_closed: Boolean(team.is_closed),
    created_at: team.created_at,
  }))

  return { teams, total: count || 0 }
}

// 恢复为基于 ID 列表的查询，但增加了分批处理以防万一（虽然分页后 ID 很少，不分批也行，但保留逻辑更稳健）
const fetchTeamMemberCounts = async (teamIds: string[]): Promise<Record<string, number>> => {
  const uniqueIds = [...new Set(teamIds)]
  if (uniqueIds.length === 0) return {}

  const counts: Record<string, number> = {}
  const BATCH_SIZE = 50 

  for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
    const batch = uniqueIds.slice(i, i + BATCH_SIZE)
    
    const { data, error } = await supabase
      .from('team_members')
      .select('team_id')
      .in('team_id', batch)

    if (error) {
      console.warn('[useTeams] Failed to fetch team member counts for batch:', error.message)
      continue
    }

    for (const row of data || []) {
      const teamId = row.team_id
      if (teamId) {
        counts[teamId] = (counts[teamId] || 0) + 1
      }
    }
  }

  return counts
}

const fetchTeamMembers = async (teamId: string): Promise<TeamMember[]> => {
  if (!teamId) return []

  const { data, error } = await supabase
    .from('team_members')
    .select('id,team_id,user_id,joined_at,profiles(id,username,avatar_url,roles)')
    .eq('team_id', teamId)
    .order('joined_at', { ascending: true })

  if (error) {
    teamErrorHandler.handleError(error, { operation: 'fetchTeamMembers' })
    throw error
  }

  return (data || []).map(row => ({
    id: row.id,
    team_id: row.team_id,
    user_id: row.user_id,
    joined_at: row.joined_at,
    profile: row.profiles && !Array.isArray(row.profiles) ? {
      id: (row.profiles as any).id,
      username: (row.profiles as any).username || null,
      avatar_url: (row.profiles as any).avatar_url || null,
      roles: Array.isArray((row.profiles as any).roles) ? (row.profiles as any).roles : null,
    } : null,
  }))
}

const fetchTeamSeekers = async (eventId: string): Promise<TeamSeeker[]> => {
  if (!eventId) return []

  const { data, error } = await supabase
    .from('team_seekers')
    .select('id,event_id,user_id,intro,qq,roles,created_at,updated_at,profiles(id,username,avatar_url,roles)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (error) {
    teamErrorHandler.handleError(error, { operation: 'fetchTeamSeekers' })
    throw error
  }

  return (data || []).map(row => ({
    id: row.id,
    event_id: row.event_id,
    user_id: row.user_id,
    intro: row.intro || '',
    qq: row.qq || '',
    roles: Array.isArray(row.roles) ? row.roles : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    profile: row.profiles && !Array.isArray(row.profiles) ? {
      id: (row.profiles as any).id,
      username: (row.profiles as any).username || null,
      avatar_url: (row.profiles as any).avatar_url || null,
      roles: Array.isArray((row.profiles as any).roles) ? (row.profiles as any).roles : null,
    } : null,
  }))
}

// Vue Query Hooks

/**
 * 获取活动的队伍列表（支持分页）
 */
import { ref, watch } from 'vue'

export function useTeams(eventId: string, initialPage = 1, initialLimit = 18) {
  const page = ref(initialPage)
  const limit = ref(initialLimit)

  const result = useQuery({
    queryKey: computed(() => ['teams', eventId, { page: page.value, limit: limit.value }]),
    queryFn: () => fetchTeams(eventId, page.value, limit.value),
    enabled: computed(() => Boolean(eventId)),
    
    // 缓存策略 - 必须配置
    staleTime: 1000 * 30,              // 30秒后数据过期
    gcTime: 1000 * 60 * 15,            // 15分钟后清理缓存
    
    // 重新获取策略 - 必须配置
    refetchOnMount: true,              // 挂载时自动获取（首次打开界面需要数据）
    refetchOnWindowFocus: false,       // 窗口焦点时不自动重新获取
    refetchOnReconnect: true,          // 网络重连时直接重新获取
    
    // 重试策略 - 必须配置
    retry: (failureCount, error) => {
      const isNetworkError = error?.message?.includes('网络') || 
                            error?.message?.includes('fetch') ||
                            error?.code === 'NETWORK_ERROR'
      return isNetworkError && failureCount < 3
    },
    
    placeholderData: (previousData) => previousData, // 保持上一页数据直到新数据加载完成（平滑过渡）
  })
  
  return {
    ...result,
    page,
    limit,
    // 提取便捷属性
    teams: computed(() => result.data.value?.teams || []),
    total: computed(() => result.data.value?.total || 0),
    totalPages: computed(() => Math.ceil((result.data.value?.total || 0) / limit.value))
  }
}

/**
 * 获取队伍成员列表
 */
export function useTeamMembers(teamId: string) {
  return useQuery({
    queryKey: queryKeys.teams.members(teamId),
    queryFn: () => fetchTeamMembers(teamId),
    enabled: computed(() => Boolean(teamId)),
    
    // 缓存策略 - 必须配置
    staleTime: 1000 * 30,              // 30秒后数据过期
    gcTime: 1000 * 60 * 15,            // 15分钟后清理缓存
    
    // 重新获取策略 - 必须配置
    refetchOnMount: true,              // 挂载时自动获取（首次打开界面需要数据）
    refetchOnWindowFocus: false,       // 窗口焦点时不自动重新获取
    refetchOnReconnect: true,          // 网络重连时直接重新获取
    
    // 重试策略 - 必须配置
    retry: (failureCount, error) => {
      const isNetworkError = error?.message?.includes('网络') || 
                            error?.message?.includes('fetch') ||
                            error?.code === 'NETWORK_ERROR'
      return isNetworkError && failureCount < 3
    },
  })
}

/**
 * 获取求组队列表
 */
export function useTeamSeekers(eventId: string) {
  const queryConfig = createOptimizedQuery(
    queryKeys.teams.seekers(eventId),
    () => fetchTeamSeekers(eventId),
    'standard' // 标准数据类型
  )
  
  return useQuery({
    ...queryConfig,
    enabled: computed(() => Boolean(eventId)),
  })
}

/**
 * 创建队伍
 */
export function useCreateTeam() {
  const queryClient = useQueryClient()
  const store = useAppStore()

  return useMutation({
    mutationFn: async (payload: {
      eventId: string
      teamData: Pick<TeamLobbyTeam, 'name' | 'leader_qq' | 'intro' | 'needs' | 'extra'>
    }) => {
      if (!store.user) throw new Error('请先登录')

      const { data, error } = await supabase
        .from('teams')
        .insert({
          event_id: payload.eventId,
          leader_id: store.user.id,
          name: payload.teamData.name,
          leader_qq: payload.teamData.leader_qq,
          intro: payload.teamData.intro,
          needs: payload.teamData.needs,
          extra: payload.teamData.extra,
        })
        .select('*')
        .single()

      if (error) {
        teamErrorHandler.handleError(error, { operation: 'createTeam' })
        throw error
      }

      return data
    },
    onSuccess: (_, variables) => {
      // 使队伍列表缓存失效，触发重新获取
      queryClient.invalidateQueries({
        queryKey: queryKeys.teams.byEvent(variables.eventId)
      })
      
      store.setBanner('info', '队伍创建成功！')
    },
    onError: (error: any) => {
      store.setBanner('error', error.message || '创建队伍失败')
    },
  })
}

/**
 * 更新队伍信息
 */
export function useUpdateTeam() {
  const queryClient = useQueryClient()
  const store = useAppStore()

  return useMutation({
    mutationFn: async (payload: {
      teamId: string
      eventId: string
      teamData: Pick<TeamLobbyTeam, 'name' | 'leader_qq' | 'intro' | 'needs' | 'extra'>
    }) => {
      if (!store.user) throw new Error('请先登录')

      const { data, error } = await supabase
        .from('teams')
        .update({
          name: payload.teamData.name,
          leader_qq: payload.teamData.leader_qq,
          intro: payload.teamData.intro,
          needs: payload.teamData.needs,
          extra: payload.teamData.extra,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.teamId)
        .select('*')
        .single()

      if (error) {
        teamErrorHandler.handleError(error, { operation: 'updateTeam' })
        throw error
      }

      return data
    },
    onSuccess: (_, variables) => {
      // 更新相关缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.teams.byEvent(variables.eventId)
      })
      
      store.setBanner('info', '队伍信息已更新')
    },
    onError: (error: any) => {
      store.setBanner('error', error.message || '更新队伍失败')
    },
  })
}

/**
 * 删除队伍
 */
export function useDeleteTeam() {
  const queryClient = useQueryClient()
  const store = useAppStore()

  return useMutation({
    mutationFn: async (payload: { teamId: string; eventId: string }) => {
      if (!store.user) throw new Error('请先登录')

      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', payload.teamId)

      if (error) {
        teamErrorHandler.handleError(error, { operation: 'deleteTeam' })
        throw error
      }

      return payload
    },
    onSuccess: (data) => {
      // 使相关缓存失效
      queryClient.invalidateQueries({
        queryKey: queryKeys.teams.byEvent(data.eventId)
      })
      queryClient.removeQueries({
        queryKey: queryKeys.teams.members(data.teamId)
      })
      
      store.setBanner('info', '队伍已删除')
    },
    onError: (error: any) => {
      store.setBanner('error', error.message || '删除队伍失败')
    },
  })
}

/**
 * 申请加入队伍
 */
export function useJoinTeamRequest() {
  const store = useAppStore()

  return useMutation({
    mutationFn: async (payload: { teamId: string; message?: string }) => {
      if (!store.user) throw new Error('请先登录')

      // 检查是否已有申请
      const { data: existing } = await supabase
        .from('team_join_requests')
        .select('id,status')
        .eq('team_id', payload.teamId)
        .eq('user_id', store.user.id)
        .maybeSingle()

      if (existing?.status === 'pending') {
        return existing
      }

      if (existing) {
        // 更新现有申请
        const { data, error } = await supabase
          .from('team_join_requests')
          .update({
            status: 'pending',
            message: payload.message || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select('*')
          .single()

        if (error) throw error
        return data
      } else {
        // 创建新申请
        const { data, error } = await supabase
          .from('team_join_requests')
          .insert({
            team_id: payload.teamId,
            user_id: store.user.id,
            status: 'pending',
            message: payload.message || null,
          })
          .select('*')
          .single()

        if (error) throw error
        return data
      }
    },
    onSuccess: () => {
      store.setBanner('info', '申请已发送')
    },
    onError: (error: any) => {
      teamErrorHandler.handleError(error, { operation: 'joinTeamRequest' })
      store.setBanner('error', error.message || '申请失败')
    },
  })
}

// 便捷的组合函数
export function useTeamData(eventId: string) {
  const teams = useTeams(eventId)
  const seekers = useTeamSeekers(eventId)

  return {
    teams,
    seekers,
    isLoading: computed(() => teams.isLoading.value || seekers.isLoading.value),
    error: computed(() => teams.error.value || seekers.error.value),
    refetch: () => {
      teams.refetch()
      seekers.refetch()
    },
  }
}

/**
 * 保存求组队信息
 */
export function useSaveTeamSeeker() {
  const queryClient = useQueryClient()
  const store = useAppStore()

  return useMutation({
    mutationFn: async (payload: {
      eventId: string
      seekerData: {
        intro: string
        qq: string
        roles: string[]
      }
    }) => {
      if (!store.user) throw new Error('请先登录')

      const { data, error } = await supabase
        .from('team_seekers')
        .upsert({
          event_id: payload.eventId,
          user_id: store.user.id,
          intro: payload.seekerData.intro,
          qq: payload.seekerData.qq,
          roles: payload.seekerData.roles,
        })
        .select('*')
        .single()

      if (error) {
        teamErrorHandler.handleError(error, { operation: 'saveTeamSeeker' })
        throw error
      }

      return data
    },
    onSuccess: (_, variables) => {
      // 使求组队列表缓存失效，触发重新获取
      queryClient.invalidateQueries({
        queryKey: queryKeys.teams.seekers(variables.eventId)
      })
      
      store.setBanner('info', '求组队信息已保存！')
    },
    onError: (error: any) => {
      store.setBanner('error', error.message || '保存失败')
    },
  })
}

/**
 * 删除求组队信息
 */
export function useDeleteTeamSeeker() {
  const queryClient = useQueryClient()
  const store = useAppStore()

  return useMutation({
    mutationFn: async (payload: {
      eventId: string
      seekerId: string
    }) => {
      const { error } = await supabase
        .from('team_seekers')
        .delete()
        .eq('id', payload.seekerId)

      if (error) {
        teamErrorHandler.handleError(error, { operation: 'deleteTeamSeeker' })
        throw error
      }

      return { success: true }
    },
    onSuccess: (_, variables) => {
      // 使求组队列表缓存失效，触发重新获取
      queryClient.invalidateQueries({
        queryKey: queryKeys.teams.seekers(variables.eventId)
      })
      
      store.setBanner('info', '求组队信息已删除')
    },
    onError: (error: any) => {
      store.setBanner('error', error.message || '删除失败')
    },
  })
}

/**
 * 发送队伍邀请
 */
export function useSendTeamInvite() {
  const store = useAppStore()

  return useMutation({
    mutationFn: async (payload: {
      teamId: string
      userId: string
      message?: string
    }) => {
      if (!store.user) throw new Error('请先登录')

      const { data, error } = await supabase
        .from('team_invites')
        .insert({
          team_id: payload.teamId,
          inviter_id: store.user.id,
          invitee_id: payload.userId,
          message: payload.message,
          status: 'pending',
        })
        .select('*')
        .single()

      if (error) {
        teamErrorHandler.handleError(error, { operation: 'sendTeamInvite' })
        throw error
      }

      return data
    },
    onSuccess: () => {
      // 可以选择性地刷新相关数据
      store.setBanner('info', '邀请已发送！')
    },
    onError: (error: any) => {
      store.setBanner('error', error.message || '发送邀请失败')
    },
  })
}
