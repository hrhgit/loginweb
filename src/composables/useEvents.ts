/**
 * Events Data Management - Using Vue Query
 * Provides intelligent caching, background updates, and offline support for events
 */

import { computed } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { supabase } from '../lib/supabase'
import { queryKeys, createOptimizedQuery } from '../lib/vueQuery'
import { useAppStore } from '../store/appStore'
import { eventErrorHandler, handleSuccessWithBanner } from '../store/enhancedErrorHandling'
import { EVENT_SELECT } from '../store/eventSchema'
import type { Event } from '../store/models'

// Event data fetching functions
const fetchPublicEvents = async (): Promise<Event[]> => {
  try {
    const { data, error } = await supabase
      .from('events')
      .select(EVENT_SELECT)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(50) // 限制返回数量，提高查询速度

    if (error) {
      console.warn('Failed to fetch events from Supabase:', error)
      // 如果 Supabase 连接失败，返回演示数据
      const { demoEvents } = await import('../store/demoEvents')
      return demoEvents.filter(event => event.status === 'published') as Event[]
    }

    return (data as unknown as Event[]) || []
  } catch (error) {
    console.warn('Supabase connection failed, using demo data:', error)
    // 连接失败时使用演示数据
    const { demoEvents } = await import('../store/demoEvents')
    return demoEvents.filter(event => event.status === 'published') as Event[]
  }
}

const fetchMyEvents = async (userId: string): Promise<Event[]> => {
  if (!userId) return []

  try {
    const { data, error } = await supabase
      .from('events')
      .select(EVENT_SELECT)
      .eq('created_by', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('Failed to fetch my events from Supabase:', error)
      // 如果 Supabase 连接失败，返回空数组（我的活动需要用户登录）
      return []
    }

    return (data as unknown as Event[]) || []
  } catch (error) {
    console.warn('Supabase connection failed for my events:', error)
    return []
  }
}

const fetchAllEvents = async (): Promise<Event[]> => {
  try {
    const { data, error } = await supabase
      .from('events')
      .select(EVENT_SELECT)
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('Failed to fetch all events from Supabase:', error)
      // 如果 Supabase 连接失败，返回演示数据
      const { demoEvents } = await import('../store/demoEvents')
      return demoEvents as Event[]
    }

    return (data as unknown as Event[]) || []
  } catch (error) {
    console.warn('Supabase connection failed for all events:', error)
    // 连接失败时使用演示数据
    const { demoEvents } = await import('../store/demoEvents')
    return demoEvents as Event[]
  }
}

const fetchEvent = async (eventId: string): Promise<Event | null> => {
  console.log('[useEvents] fetchEvent called with eventId:', eventId)
  
  if (!eventId) {
    console.log('[useEvents] fetchEvent: No eventId provided, returning null')
    return null
  }

  console.log('[useEvents] fetchEvent: Fetching event from database...')
  
  try {
    const { data, error } = await supabase
      .from('events')
      .select(EVENT_SELECT)
      .eq('id', eventId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('[useEvents] fetchEvent: Event not found, checking demo data')
        // 检查演示数据中是否有这个事件
        const { demoEvents } = await import('../store/demoEvents')
        const demoEvent = demoEvents.find(event => event.id === eventId)
        return demoEvent as Event || null
      }
      console.error('[useEvents] fetchEvent: Database error:', error)
      // 尝试从演示数据中查找
      const { demoEvents } = await import('../store/demoEvents')
      const demoEvent = demoEvents.find(event => event.id === eventId)
      return demoEvent as Event || null
    }

    console.log('[useEvents] fetchEvent: Event fetched successfully:', !!data)
    return data as unknown as Event | null
  } catch (error) {
    console.warn('Supabase connection failed for single event, checking demo data:', error)
    // 连接失败时检查演示数据
    const { demoEvents } = await import('../store/demoEvents')
    const demoEvent = demoEvents.find(event => event.id === eventId)
    return demoEvent as Event || null
  }
}

// Vue Query Hooks

/**
 * Get public events
 */
export function usePublicEvents() {
  const queryConfig = createOptimizedQuery(
    queryKeys.events.public,
    fetchPublicEvents,
    'static' // 使用static类型，缓存时间更长
  )

  const result = useQuery({
    ...queryConfig,
    // 公开活动变化不频繁，可以使用更长的缓存时间
    staleTime: 1000 * 60 * 2, // 2分钟
    gcTime: 1000 * 60 * 30,   // 30分钟
    // 确保首次加载时能正确获取数据
    refetchOnMount: 'always', // 总是在挂载时获取数据
    enabled: true, // 始终启用查询
  })

  return result
}

/**
 * Get user's created events
 */
export function useMyEvents(userId: string | null) {
  const queryConfig = createOptimizedQuery(
    queryKeys.events.my(userId || ''),
    () => fetchMyEvents(userId || ''),
    'standard'
  )

  return useQuery({
    ...queryConfig,
    enabled: computed(() => Boolean(userId)),
  })
}

/**
 * Get all events (admin only)
 */
export function useAllEvents() {
  const queryConfig = createOptimizedQuery(
    queryKeys.events.all,
    fetchAllEvents,
    'standard'
  )

  return useQuery(queryConfig)
}

/**
 * Get single event by ID
 */
export function useEvent(eventId: string) {
  const queryConfig = createOptimizedQuery(
    queryKeys.events.detail(eventId),
    () => fetchEvent(eventId),
    'standard'
  )

  return useQuery({
    ...queryConfig,
    enabled: computed(() => Boolean(eventId)),
  })
}

/**
 * Create new event
 */
export function useCreateEvent() {
  const queryClient = useQueryClient()
  const store = useAppStore()

  return useMutation({
    mutationFn: async (eventData: Partial<Event>) => {
      if (!store.user) throw new Error('请先登录')

      const { data, error } = await supabase
        .from('events')
        .insert({
          ...eventData,
          created_by: store.user.id,
        })
        .select(EVENT_SELECT)
        .single()

      if (error) {
        eventErrorHandler.handleError(error, { operation: 'createEvent' })
        throw error
      }

      return data
    },
    onSuccess: () => {
      // Invalidate related caches
      queryClient.invalidateQueries({
        queryKey: queryKeys.events.all
      })
      if (store.user) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.events.my(store.user.id)
        })
      }
      
      handleSuccessWithBanner('活动创建成功！', store.setBanner, { 
        operation: 'createEvent',
        component: 'form' 
      })
    },
    onError: (error: any) => {
      eventErrorHandler.handleError(error, { operation: 'createEvent' })
    },
  })
}

/**
 * Update event
 */
export function useUpdateEvent() {
  const queryClient = useQueryClient()
  const store = useAppStore()

  return useMutation({
    mutationFn: async (payload: {
      eventId: string
      updates: Partial<Event>
    }) => {
      if (!store.user) throw new Error('请先登录')

      const { data, error } = await supabase
        .from('events')
        .update(payload.updates)
        .eq('id', payload.eventId)
        .select(EVENT_SELECT)
        .single()

      if (error) {
        eventErrorHandler.handleError(error, { operation: 'updateEvent' })
        throw error
      }

      return data
    },
    onSuccess: (_, variables) => {
      // Invalidate related caches
      queryClient.invalidateQueries({
        queryKey: queryKeys.events.all
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.events.public
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.events.detail(variables.eventId)
      })
      if (store.user) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.events.my(store.user.id)
        })
      }
      
      handleSuccessWithBanner('活动信息已更新', store.setBanner, { 
        operation: 'updateEvent',
        component: 'form' 
      })
    },
    onError: (error: any) => {
      eventErrorHandler.handleError(error, { operation: 'updateEvent' })
    },
  })
}

/**
 * Delete event
 */
export function useDeleteEvent() {
  const queryClient = useQueryClient()
  const store = useAppStore()

  return useMutation({
    mutationFn: async (eventId: string) => {
      if (!store.user) throw new Error('请先登录')

      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId)

      if (error) {
        eventErrorHandler.handleError(error, { operation: 'deleteEvent' })
        throw error
      }

      return eventId
    },
    onSuccess: () => {
      // Invalidate related caches
      queryClient.invalidateQueries({
        queryKey: queryKeys.events.all
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.events.public
      })
      if (store.user) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.events.my(store.user.id)
        })
      }
      
      handleSuccessWithBanner('活动已删除', store.setBanner, { 
        operation: 'deleteEvent',
        component: 'form' 
      })
    },
    onError: (error: any) => {
      eventErrorHandler.handleError(error, { operation: 'deleteEvent' })
    },
  })
}

/**
 * Convenience hook for events data
 */
export function useEvents(userId: string | null, isAdmin: boolean = false) {
  const publicEvents = usePublicEvents()
  const myEvents = useMyEvents(userId)
  const allEvents = isAdmin ? useAllEvents() : { 
    data: computed(() => [] as Event[]), 
    isLoading: computed(() => false), 
    error: computed(() => null),
    refetch: () => Promise.resolve()
  }

  return {
    publicEvents,
    myEvents,
    allEvents,
    isLoading: computed(() => 
      publicEvents.isLoading.value || 
      myEvents.isLoading.value || 
      allEvents.isLoading.value
    ),
    error: computed(() => 
      publicEvents.error.value || 
      myEvents.error.value || 
      allEvents.error.value
    ),
    refetch: () => {
      publicEvents.refetch()
      myEvents.refetch()
      if (isAdmin && allEvents.refetch) {
        allEvents.refetch()
      }
    },
  }
}

/**
 * Enhanced event hook with fallback to cached events
 */
export function useEventWithFallback(eventId: string) {
  const store = useAppStore()
  const event = useEvent(eventId)
  
  // Also check if event exists in the all events cache
  const allEvents = useEvents(store.user?.id || null, store.isAdmin)
  
  const cachedEvent = computed(() => {
    if (event.data.value) {
      return event.data.value
    }
    
    // Fallback to cached events list
    const events = allEvents.publicEvents.data.value || []
    return Array.isArray(events) ? events.find((e: Event) => e.id === eventId) || null : null
  })

  return {
    ...event,
    data: cachedEvent,
  }
}