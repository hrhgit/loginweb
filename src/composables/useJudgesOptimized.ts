import { computed } from 'vue'
import { useSafeQuery as useQuery } from './useSafeQuery'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/vueQuery'
import { eventErrorHandler } from '../store/enhancedErrorHandling'

// 评委信息类型定义
export interface JudgeSimple {
  judge_id: string
  judge_username: string
  judge_avatar_url: string | null
  judge_roles: string[]
  invited_at: string
}

export interface JudgeWithStats extends JudgeSimple {
  updated_at: string
  total_submissions: number
  scored_submissions: number
  avg_score: number
}

/**
 * 快速获取活动评委列表（简单版本）
 * 使用专门的数据库函数，性能最优
 */
const fetchEventJudgesSimple = async (eventId: string): Promise<JudgeSimple[]> => {
  if (!eventId) return []

  console.log('[useJudgesOptimized] fetchEventJudgesSimple: Fetching judges for event', eventId)

  try {
    const { data, error } = await supabase
      .rpc('get_event_judges_simple', { event_uuid: eventId })

    if (error) {
      console.error('[useJudgesOptimized] fetchEventJudgesSimple: Database error', error)
      eventErrorHandler.handleError(error, { 
        operation: 'fetchEventJudgesSimple',
        additionalData: { eventId }
      })
      throw error
    }

    const judges = (data || []) as JudgeSimple[]
    console.log('[useJudgesOptimized] fetchEventJudgesSimple: Judges fetched', { 
      eventId,
      count: judges.length
    })

    return judges
  } catch (err) {
    console.error('[useJudgesOptimized] Unexpected error:', err)
    throw err
  }
}

/**
 * 获取活动评委列表及统计信息（完整版本）
 * 包含评分统计等详细信息
 */
const fetchEventJudgesWithStats = async (eventId: string): Promise<JudgeWithStats[]> => {
  if (!eventId) return []

  console.log('[useJudgesOptimized] fetchEventJudgesWithStats: Fetching judges with stats for event', eventId)

  try {
    const { data, error } = await supabase
      .rpc('get_event_judges_with_stats', { event_uuid: eventId })

    if (error) {
      console.error('[useJudgesOptimized] fetchEventJudgesWithStats: Database error', error)
      eventErrorHandler.handleError(error, { 
        operation: 'fetchEventJudgesWithStats',
        additionalData: { eventId }
      })
      throw error
    }

    const judges = (data || []) as JudgeWithStats[]
    console.log('[useJudgesOptimized] fetchEventJudgesWithStats: Judges with stats fetched', { 
      eventId,
      count: judges.length
    })

    return judges
  } catch (err) {
    console.error('[useJudgesOptimized] Unexpected error:', err)
    throw err
  }
}

/**
 * 检查用户是否为活动评委
 */
const checkIsEventJudge = async (eventId: string, userId?: string): Promise<boolean> => {
  if (!eventId) return false

  console.log('[useJudgesOptimized] checkIsEventJudge: Checking judge status', { eventId, userId })

  try {
    const { data, error } = await supabase
      .rpc('is_event_judge', { 
        event_uuid: eventId,
        ...(userId && { user_uuid: userId })
      })

    if (error) {
      console.error('[useJudgesOptimized] checkIsEventJudge: Database error', error)
      eventErrorHandler.handleError(error, { 
        operation: 'checkIsEventJudge',
        additionalData: { eventId, userId }
      })
      throw error
    }

    const isJudge = Boolean(data)
    console.log('[useJudgesOptimized] checkIsEventJudge: Judge status checked', { 
      eventId, 
      userId, 
      isJudge 
    })

    return isJudge
  } catch (err) {
    console.error('[useJudgesOptimized] Unexpected error:', err)
    throw err
  }
}

/**
 * 使用简单评委列表的 Vue Query hook
 * 适用于大多数场景，性能最优
 */
export function useEventJudgesSimple(eventId: string) {
  return useQuery({
    queryKey: [...queryKeys.judges.byEvent(eventId), 'simple'],
    queryFn: () => fetchEventJudgesSimple(eventId),
    enabled: computed(() => Boolean(eventId)),
    
    // 缓存策略 - 遵循项目规范
    staleTime: 1000 * 30,              // 30秒后数据过期
    gcTime: 1000 * 60 * 15,            // 15分钟后清理缓存
    
    // 重新获取策略
    refetchOnMount: false,             // 挂载时不自动重新获取
    refetchOnWindowFocus: false,       // 窗口焦点时不自动重新获取
    refetchOnReconnect: true,          // 网络重连时直接重新获取
    
    // 重试策略
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
 * 使用带统计信息的评委列表的 Vue Query hook
 * 适用于需要详细统计信息的场景
 */
export function useEventJudgesWithStats(eventId: string) {
  return useQuery({
    queryKey: [...queryKeys.judges.byEvent(eventId), 'with-stats'],
    queryFn: () => fetchEventJudgesWithStats(eventId),
    enabled: computed(() => Boolean(eventId)),
    
    // 缓存策略
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 15,
    
    // 重新获取策略
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    
    // 重试策略
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
 * 检查用户是否为活动评委的 Vue Query hook
 */
export function useIsEventJudge(eventId: string, userId?: string) {
  return useQuery({
    queryKey: [...queryKeys.judges.byEvent(eventId), 'is-judge', userId || 'current'],
    queryFn: () => checkIsEventJudge(eventId, userId),
    enabled: computed(() => Boolean(eventId)),
    
    // 缓存策略 - 权限信息可以缓存更久
    staleTime: 1000 * 60 * 5,          // 5分钟后数据过期
    gcTime: 1000 * 60 * 30,            // 30分钟后清理缓存
    
    // 重新获取策略
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    
    // 重试策略
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
 * 组合 hook：同时获取评委列表和当前用户的评委状态
 */
export function useEventJudgeData(eventId: string, userId?: string) {
  const judges = useEventJudgesSimple(eventId)
  const isJudge = useIsEventJudge(eventId, userId)
  
  return {
    judges,
    isJudge,
    // 便捷的计算属性
    judgeList: computed(() => judges.data.value || []),
    isCurrentUserJudge: computed(() => isJudge.data.value || false),
    judgeCount: computed(() => judges.data.value?.length || 0),
    // 加载状态
    isLoading: computed(() => judges.isLoading.value || isJudge.isLoading.value),
    // 错误状态
    error: computed(() => judges.error.value || isJudge.error.value),
  }
}
