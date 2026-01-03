/**
 * 评委数据管理 - 使用 Vue Query
 * 提供智能缓存、后台更新、离线支持等功能
 */

import { computed, type Ref, unref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useSafeMutation as useMutation, useSafeQuery as useQuery } from './useSafeQuery'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/vueQuery'
import { useAppStore } from '../store/appStore'
import { apiErrorHandler } from '../store/enhancedErrorHandling'
import type { 
  JudgeWithProfile, 
  JudgePermission,
  UserSearchResult,
  InviteJudgeParams,
  RemoveJudgeParams
} from '../store/models'

// 评委数据获取函数
const fetchJudgePermissions = async (eventId: string, userId: string): Promise<JudgePermission> => {
  if (!eventId || !userId) {
    return {
      isJudge: false,
      isEventAdmin: false,
      canAccessJudgeWorkspace: false,
      canManageJudges: false,
    }
  }

  try {
    // 检查用户是否是活动创建者
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('created_by')
      .eq('id', eventId)
      .single()

    if (eventError) {
      console.warn('Failed to check event admin status:', eventError.message)
    }

    const isEventAdmin = eventData?.created_by === userId

    // 检查用户是否是评委
    const { data: judgeRecord, error: judgeError } = await supabase
      .from('event_judges')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle()

    if (judgeError) {
      console.warn('Failed to check judge permission:', judgeError.message)
      return {
        isJudge: false,
        isEventAdmin,
        canAccessJudgeWorkspace: isEventAdmin,
        canManageJudges: isEventAdmin,
      }
    }

    const isJudge = Boolean(judgeRecord)
    
    return {
      isJudge,
      isEventAdmin,
      canAccessJudgeWorkspace: isEventAdmin || isJudge,
      canManageJudges: isEventAdmin,
    }
  } catch (error: any) {
    console.error('Error checking judge permission:', error)
    return {
      isJudge: false,
      isEventAdmin: false,
      canAccessJudgeWorkspace: false,
      canManageJudges: false,
    }
  }
}

const fetchEventJudges = async (eventId: string): Promise<JudgeWithProfile[]> => {
  if (!eventId) return []

  const { data, error } = await supabase
    .from('event_judges')
    .select(`
      id,
      event_id,
      user_id,
      created_at,
      updated_at,
      profiles(
        id,
        username,
        avatar_url,
        roles
      )
    `)
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })

  if (error) {
    apiErrorHandler.handleError(error, { operation: 'fetchEventJudges' })
    throw error
  }

  // 转换数据格式
  return (data || []).map((row: any) => ({
    id: row.id,
    event_id: row.event_id,
    user_id: row.user_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    profile: row.profiles ? {
      id: row.profiles.id,
      username: row.profiles.username || null,
      avatar_url: row.profiles.avatar_url || null,
      roles: Array.isArray(row.profiles.roles) ? row.profiles.roles : null,
    } : {
      id: row.user_id,
      username: null,
      avatar_url: null,
      roles: null,
    }
  }))
}

const searchUsersForJudge = async (query: string, eventId: string, limit = 20): Promise<UserSearchResult[]> => {
  if (!query.trim() || !eventId) return []

  try {
    // 搜索用户
    const { data: users, error: searchError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, roles')
      .ilike('username', `%${query.trim()}%`)
      .limit(limit)

    if (searchError) {
      apiErrorHandler.handleError(searchError, { operation: 'searchUsersForJudge' })
      throw searchError
    }

    if (!users || users.length === 0) return []

    // 获取已经是评委的用户ID列表
    const userIds = users.map(user => user.id)
    const { data: existingJudges, error: judgeError } = await supabase
      .from('event_judges')
      .select('user_id')
      .eq('event_id', eventId)
      .in('user_id', userIds)

    if (judgeError) {
      console.warn('Failed to check existing judges:', judgeError.message)
    }

    const existingJudgeIds = new Set((existingJudges || []).map(j => j.user_id))

    return users.map(user => ({
      id: user.id,
      username: user.username || '',
      avatar_url: user.avatar_url || null,
      roles: Array.isArray(user.roles) ? user.roles : null,
      isAlreadyJudge: existingJudgeIds.has(user.id),
    }))
  } catch (error: any) {
    console.error('Error searching users for judge:', error)
    throw error
  }
}

// Vue Query Hooks

/**
 * 获取用户在特定活动的评委权限
 */
export function useJudgePermissions(eventId: string, userId: string) {
  return useQuery({
    queryKey: queryKeys.judges.permissions(eventId, userId),
    queryFn: () => fetchJudgePermissions(eventId, userId),
    enabled: computed(() => Boolean(eventId && userId)),
    staleTime: 1000 * 60 * 2, // 2分钟内数据保持新鲜
    gcTime: 1000 * 60 * 15, // 15分钟后从内存中清除
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: (failureCount, error: any) => {
      const isNetworkError = error?.message?.includes('网络') || 
                            error?.message?.includes('fetch') ||
                            error?.message?.includes('timeout') ||
                            error?.message?.includes('??') ||
                            error?.code === 'NETWORK_ERROR'
      return isNetworkError && failureCount < 3
    },
  })
}

/**
 * 获取活动的评委列表
 */
export function useEventJudges(eventId: string) {
  return useQuery({
    queryKey: queryKeys.judges.byEvent(eventId),
    queryFn: () => fetchEventJudges(eventId),
    enabled: computed(() => Boolean(eventId)),
    staleTime: 1000 * 30, // 30秒后数据过期，触发后台更新
    gcTime: 1000 * 60 * 15, // 15分钟后从内存中清除
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: (failureCount, error: any) => {
      const isNetworkError = error?.message?.includes('网络') || 
                            error?.message?.includes('fetch') ||
                            error?.message?.includes('timeout') ||
                            error?.message?.includes('??') ||
                            error?.code === 'NETWORK_ERROR'
      return isNetworkError && failureCount < 3
    },
  })
}

/**
 * 搜索用户以添加为评委
 */
export function useSearchUsersForJudge(query: Ref<string> | string, eventId: string) {
  const queryValue = computed(() => {
    const q = unref(query)
    return typeof q === 'string' ? q : ''
  })
  
  return useQuery({
    queryKey: computed(() => ['judges', 'search', eventId, queryValue.value]),
    queryFn: () => searchUsersForJudge(queryValue.value, eventId),
    enabled: computed(() => Boolean(queryValue.value.trim() && eventId)),
    staleTime: 1000 * 60, // 1分钟内搜索结果保持新鲜
    gcTime: 1000 * 60 * 5, // 5分钟后清除搜索结果
  })
}

/**
 * 添加评委
 */
export function useAddJudge() {
  const queryClient = useQueryClient()
  const store = useAppStore()

  return useMutation({
    mutationFn: async (payload: InviteJudgeParams) => {
      if (!store.user) throw new Error('请先登录')

      // 检查权限
      const permission = await fetchJudgePermissions(payload.eventId, store.user.id)
      if (!permission.canManageJudges) {
        throw new Error('您没有权限邀请评委')
      }

      // 检查用户是否已经是评委
      const { data: existingJudge } = await supabase
        .from('event_judges')
        .select('id')
        .eq('event_id', payload.eventId)
        .eq('user_id', payload.userId)
        .maybeSingle()

      if (existingJudge) {
        throw new Error('该用户已经是评委')
      }

      // 添加评委记录
      const { data, error } = await supabase
        .from('event_judges')
        .insert({
          event_id: payload.eventId,
          user_id: payload.userId,
        })
        .select('*')
        .single()

      if (error) {
        apiErrorHandler.handleError(error, { operation: 'addJudge' })
        throw error
      }

      return data
    },
    onSuccess: (_, variables) => {
      // 使相关缓存失效
      queryClient.invalidateQueries({
        queryKey: queryKeys.judges.byEvent(variables.eventId)
      })
      
      // 清除被添加用户的权限缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.judges.permissions(variables.eventId, variables.userId)
      })
      
      store.setBanner('info', '评委添加成功！')
    },
    onError: (error: any) => {
      store.setBanner('error', error.message || '添加评委失败')
    },
  })
}

/**
 * 移除评委
 */
export function useRemoveJudge() {
  const queryClient = useQueryClient()
  const store = useAppStore()

  return useMutation({
    mutationFn: async (payload: RemoveJudgeParams) => {
      if (!store.user) throw new Error('请先登录')

      // 检查权限
      const permission = await fetchJudgePermissions(payload.eventId, store.user.id)
      if (!permission.canManageJudges) {
        throw new Error('您没有权限移除评委')
      }

      // 移除评委记录
      const { error } = await supabase
        .from('event_judges')
        .delete()
        .eq('event_id', payload.eventId)
        .eq('user_id', payload.userId)

      if (error) {
        apiErrorHandler.handleError(error, { operation: 'removeJudge' })
        throw error
      }

      return payload
    },
    onSuccess: (data) => {
      // 使相关缓存失效
      queryClient.invalidateQueries({
        queryKey: queryKeys.judges.byEvent(data.eventId)
      })
      
      // 清除被移除用户的权限缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.judges.permissions(data.eventId, data.userId)
      })
      
      store.setBanner('info', '评委已移除')
    },
    onError: (error: any) => {
      store.setBanner('error', error.message || '移除评委失败')
    },
  })
}

// 便捷的组合函数
export function useJudgeData(eventId: string, userId?: string) {
  const judges = useEventJudges(eventId)
  const permissions = userId ? useJudgePermissions(eventId, userId) : null

  return {
    judges,
    permissions,
    isLoading: computed(() => 
      judges.isLoading.value || (permissions?.isLoading.value ?? false)
    ),
    error: computed(() => 
      judges.error.value || permissions?.error.value || null
    ),
    refetch: () => {
      judges.refetch()
      permissions?.refetch()
    },
  }
}
