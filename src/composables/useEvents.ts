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
import { prefetchRelatedData } from '../utils/vueQueryBatchOptimizer'
import type { Event } from '../store/models'

// Event data fetching functions
const fetchPublicEvents = async (): Promise<Event[]> => {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_SELECT)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(50) // 限制返回数量，提高查询速度

  if (error) {
    eventErrorHandler.handleError(error, { operation: 'fetchPublicEvents' })
    throw error
  }

  return (data as unknown as Event[]) || []
}

const fetchMyEvents = async (userId: string): Promise<Event[]> => {
  if (!userId) return []

  const { data, error } = await supabase
    .from('events')
    .select(EVENT_SELECT)
    .eq('created_by', userId)
    .order('created_at', { ascending: false })

  if (error) {
    eventErrorHandler.handleError(error, { operation: 'fetchMyEvents' })
    throw error
  }

  return (data as unknown as Event[]) || []
}

const fetchAllEvents = async (): Promise<Event[]> => {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_SELECT)
    .order('created_at', { ascending: false })

  if (error) {
    eventErrorHandler.handleError(error, { operation: 'fetchAllEvents' })
    throw error
  }

  return (data as unknown as Event[]) || []
}

const fetchEvent = async (eventId: string): Promise<Event | null> => {
  console.log('[useEvents] fetchEvent called with eventId:', eventId)
  
  if (!eventId) {
    console.log('[useEvents] fetchEvent: No eventId provided, returning null')
    return null
  }

  console.log('[useEvents] fetchEvent: Fetching event from database...')
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_SELECT)
    .eq('id', eventId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      console.log('[useEvents] fetchEvent: Event not found')
      return null
    }
    console.error('[useEvents] fetchEvent: Database error:', error)
    eventErrorHandler.handleError(error, { operation: 'fetchEvent' })
    throw error
  }

  console.log('[useEvents] fetchEvent: Event fetched successfully:', !!data)
  return data as unknown as Event | null
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
  })

  // Prefetch related data
  if (result.data.value) {
    prefetchRelatedData(queryKeys.events.public)
  }

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