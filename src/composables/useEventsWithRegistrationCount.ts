import { computed } from 'vue'
import { useSafeQuery as useQuery } from './useSafeQuery'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/vueQuery'
import { eventErrorHandler } from '../store/enhancedErrorHandling'
import type { DisplayEvent } from '../store/models'

// 带报名人数的活动数据类型
export type EventWithRegistrationCount = DisplayEvent & {
  registration_count: number
}

/**
 * 获取所有活动及其报名人数 - 使用数据库函数优化性能
 */
const fetchEventsWithRegistrationCount = async (): Promise<EventWithRegistrationCount[]> => {
  console.log('[useEventsWithRegistrationCount] fetchEventsWithRegistrationCount: Fetching events with counts')

  try {
    // 使用数据库函数批量获取活动和报名人数
    const { data, error } = await supabase
      .rpc('get_events_with_registration_counts')

    if (error) {
      console.error('[useEventsWithRegistrationCount] fetchEventsWithRegistrationCount: Database error', error)
      eventErrorHandler.handleError(error, { 
        operation: 'fetchEventsWithRegistrationCount'
      })
      throw error
    }

    const events = (data || []) as EventWithRegistrationCount[]
    console.log('[useEventsWithRegistrationCount] fetchEventsWithRegistrationCount: Events fetched', { 
      count: events.length
    })

    return events
  } catch (err) {
    console.error('[useEventsWithRegistrationCount] Unexpected error:', err)
    throw err
  }
}

/**
 * 获取公开活动及其报名人数
 */
const fetchPublicEventsWithRegistrationCount = async (): Promise<EventWithRegistrationCount[]> => {
  console.log('[useEventsWithRegistrationCount] fetchPublicEventsWithRegistrationCount: Starting fetch')

  try {
    const allEvents = await fetchEventsWithRegistrationCount()
    
    // 过滤出公开的活动（非草稿状态）
    const publicEvents = allEvents.filter(event => event.status === 'published' || event.status === 'ended')
    
    console.log('[useEventsWithRegistrationCount] fetchPublicEventsWithRegistrationCount: Success', { 
      totalCount: allEvents.length,
      publicCount: publicEvents.length,
      publicEvents: publicEvents.map(e => ({ id: e.id, title: e.title, status: e.status }))
    })

    return publicEvents
  } catch (error) {
    console.error('[useEventsWithRegistrationCount] fetchPublicEventsWithRegistrationCount: Error', error)
    throw error
  }
}

/**
 * 获取用户创建的活动及其报名人数
 */
const fetchMyEventsWithRegistrationCount = async (userId: string): Promise<EventWithRegistrationCount[]> => {
  if (!userId) return []

  console.log('[useEventsWithRegistrationCount] fetchMyEventsWithRegistrationCount: Fetching user events via RPC', { userId })

  try {
    const allEvents = await fetchEventsWithRegistrationCount()
    const result = allEvents
      .filter(event => event.created_by === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    console.log('[useEventsWithRegistrationCount] fetchMyEventsWithRegistrationCount: User events fetched', {
      userId,
      count: result.length
    })

    return result
  } catch (err) {
    console.error('[useEventsWithRegistrationCount] Unexpected error:', err)
    throw err
  }
}

/**
 * 使用所有活动及其报名人数的 Vue Query hook
 */
export function useEventsWithRegistrationCount() {
  return useQuery({
    queryKey: [...queryKeys.events.all, 'with-registration-count'],
    queryFn: fetchEventsWithRegistrationCount,
    
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
 * 使用公开活动及其报名人数的 Vue Query hook
 */
export function usePublicEventsWithRegistrationCount() {
  return useQuery({
    queryKey: [...queryKeys.events.public, 'with-registration-count'],
    queryFn: fetchPublicEventsWithRegistrationCount,
    
    // 缓存策略 - 遵循项目规范
    staleTime: 1000 * 30,              // 30秒后数据过期
    gcTime: 1000 * 60 * 15,            // 15分钟后清理缓存
    
    // 重新获取策略 - 遵循项目规范
    refetchOnMount: false,             // 挂载时不自动重新获取
    refetchOnWindowFocus: false,       // 窗口焦点时不自动重新获取
    refetchOnReconnect: true,          // 网络重连时直接重新获取
    
    // 重试策略 - 遵循项目规范
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
 * 使用用户创建的活动及其报名人数的 Vue Query hook
 */
export function useMyEventsWithRegistrationCount(userId: string) {
  return useQuery({
    queryKey: [...queryKeys.events.my(userId), 'with-registration-count'],
    queryFn: () => fetchMyEventsWithRegistrationCount(userId),
    enabled: computed(() => Boolean(userId)),
    
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
 * 获取单个活动的报名人数
 */
export function useEventRegistrationCount(eventId: string) {
  return useQuery({
    queryKey: queryKeys.registrations.count(eventId),
    queryFn: async () => {
      if (!eventId) return 0

      console.log('[useEventsWithRegistrationCount] useEventRegistrationCount: Fetching count for event', { eventId })

      const { data, error } = await supabase
        .rpc('get_event_registration_count', { event_uuid: eventId })

      if (error) {
        console.error('[useEventsWithRegistrationCount] useEventRegistrationCount: Database error', error)
        eventErrorHandler.handleError(error, { 
          operation: 'useEventRegistrationCount',
          additionalData: { eventId }
        })
        throw error
      }

      const count = data ?? 0
      console.log('[useEventsWithRegistrationCount] useEventRegistrationCount: Count fetched', { eventId, count })

      return count
    },
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
