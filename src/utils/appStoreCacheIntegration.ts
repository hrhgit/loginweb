/**
 * App Store Cache Integration Example
 * 
 * This file demonstrates how to integrate the CacheManager with existing
 * appStore functions to improve performance and reduce network requests.
 */

import { supabase } from '../lib/supabase'
import { cacheApiResponse, invalidateCache } from './cacheManager'
import { EVENT_SELECT } from '../store/eventSchema'
import type { Event } from '../store/models'

/**
 * Cached version of loadEvents function
 * Uses stale-while-revalidate strategy for optimal user experience
 */
export async function loadEventsCached(isAdmin: boolean, userId?: string) {
  const cacheKey = isAdmin && userId ? `events:admin:${userId}` : 'events:public'
  
  return cacheApiResponse(
    cacheKey,
    async () => {
      let query = supabase.from('events').select(EVENT_SELECT) as any

      if (userId && isAdmin) {
        query = query.or(`status.eq.published,status.eq.ended,created_by.eq.${userId}`)
      } else {
        query = query.in('status', ['published', 'ended'])
      }

      const { data, error } = await query
        .order('start_time', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        throw new Error(error.message)
      }

      return data as Event[]
    },
    'stale-while-revalidate'
  )
}

/**
 * Cached version of fetchEventById function
 * Uses cache-first strategy since individual events change less frequently
 */
export async function fetchEventByIdCached(id: string) {
  const cacheKey = `event:${id}`
  
  try {
    return await cacheApiResponse(
      cacheKey,
      async () => {
        const { data, error } = await (supabase.from('events').select(EVENT_SELECT) as any)
          .eq('id', id)
          .maybeSingle()

        if (error) {
          throw new Error(error.message)
        }
        
        if (!data) {
          throw new Error('活动不存在')
        }

        return data as Event
      },
      'cache-first'
    )
  } catch (error) {
    throw error
  }
}

/**
 * Cached version of loadTeams function
 * Uses stale-while-revalidate for real-time feel with performance benefits
 */
export async function loadTeamsCached(eventId: string) {
  const cacheKey = `teams:${eventId}`
  
  return cacheApiResponse(
    cacheKey,
    async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(error.message)
      }

      return data || []
    },
    'stale-while-revalidate'
  )
}

/**
 * Cached version of loadMyRegistrations function
 * Uses network-first since registration status is critical
 */
export async function loadMyRegistrationsCached(userId: string) {
  const cacheKey = `registrations:${userId}`
  
  return cacheApiResponse(
    cacheKey,
    async () => {
      const { data, error } = await supabase
        .from('registrations')
        .select('id,event_id,status')
        .eq('user_id', userId)
        .limit(500)

      if (error) {
        throw new Error(error.message)
      }

      return data || []
    },
    'network-first'
  )
}

/**
 * Cache invalidation helpers for data consistency
 */
export async function invalidateEventCaches(eventId?: string) {
  if (eventId) {
    // Invalidate specific event and related data
    await Promise.all([
      invalidateCache(`event:${eventId}`),
      invalidateCache(`teams:${eventId}`),
      invalidateCache(`submissions:${eventId}`)
    ])
  } else {
    // Invalidate all event-related caches
    await Promise.all([
      invalidateCache('events:'),
      invalidateCache('event:'),
      invalidateCache('teams:'),
      invalidateCache('submissions:')
    ])
  }
}

export async function invalidateUserCaches(userId: string) {
  await Promise.all([
    invalidateCache(`registrations:${userId}`),
    invalidateCache(`profile:${userId}`),
    invalidateCache(`events:admin:${userId}`)
  ])
}

/**
 * Example of how to integrate caching into existing appStore functions
 * 
 * Replace the original loadEvents function with:
 * 
 * const loadEvents = async () => {
 *   eventsError.value = ''
 *   eventsLoading.value = true
 * 
 *   try {
 *     const data = await loadEventsCached(isAdmin.value, user.value?.id)
 *     events.value = data
 *   } catch (error) {
 *     eventsError.value = error.message
 *     eventErrorHandler.handleError(error, { operation: 'loadEvents' })
 *     events.value = []
 *   }
 * 
 *   eventsLoading.value = false
 *   eventsLoaded.value = true
 *   syncNotifications()
 * }
 * 
 * And add cache invalidation to write operations:
 * 
 * const createEvent = async (eventData) => {
 *   // ... existing create logic
 *   
 *   // After successful creation, invalidate caches
 *   await invalidateEventCaches()
 * }
 */

/**
 * Performance monitoring integration
 * Track cache performance metrics
 */
export function setupCachePerformanceMonitoring() {
  // This would integrate with the existing performanceMonitor
  // to track cache hit rates and performance improvements
  
  setInterval(() => {
    const stats = getCacheStats()
    
    // Log cache performance metrics
    console.log('Cache Performance:', {
      hitRate: stats.hits / (stats.hits + stats.misses) * 100,
      totalEntries: stats.entryCount,
      totalSize: stats.totalSize,
      evictions: stats.evictions
    })
  }, 60000) // Every minute
}

// Import this function to get cache statistics
import { getCacheStats } from './cacheManager'
export { getCacheStats }