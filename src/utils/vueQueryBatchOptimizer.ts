/**
 * Vue Query Batch Optimizer
 * 
 * Optimizes query batching for related data to improve performance
 * and reduce network requests
 */

import { QueryClient } from '@tanstack/vue-query'
import { queryKeys } from '../lib/vueQuery'

export interface BatchConfig {
  // Maximum time to wait for batching (ms)
  batchWindow: number
  // Maximum number of queries to batch together
  maxBatchSize: number
  // Patterns for queries that should be batched together
  batchPatterns: BatchPattern[]
}

export interface BatchPattern {
  name: string
  keyPattern: string[]
  priority: number
  maxWaitTime: number
}

class VueQueryBatchOptimizer {
  private queryClient: QueryClient | null = null
  private pendingBatches = new Map<string, {
    queries: Array<{ queryKey: readonly unknown[], queryFn: () => Promise<any> }>
    timer: number
    priority: number
  }>()

  private config: BatchConfig = {
    batchWindow: 50, // 50ms batching window
    maxBatchSize: 10,
    batchPatterns: [
      {
        name: 'event-related',
        keyPattern: ['events', 'teams', 'submissions'],
        priority: 1,
        maxWaitTime: 100,
      },
      {
        name: 'user-related',
        keyPattern: ['user', 'notifications'],
        priority: 2,
        maxWaitTime: 200,
      },
      {
        name: 'judge-related',
        keyPattern: ['judges'],
        priority: 3,
        maxWaitTime: 300,
      },
    ],
  }

  /**
   * Initialize batch optimizer
   */
  initialize(queryClient: QueryClient, config?: Partial<BatchConfig>): void {
    this.queryClient = queryClient
    
    if (config) {
      this.config = { ...this.config, ...config }
    }

    this.setupQueryInterception()
    console.log('⚡ Vue Query batch optimizer initialized')
  }

  /**
   * Create optimized queries for related data
   */
  createBatchedQueries(eventId: string) {
    if (!this.queryClient) return {}

    // Pre-configure related queries that are commonly used together
    const eventDetailQueries = {
      event: {
        queryKey: queryKeys.events.detail(eventId),
        staleTime: 1000 * 60 * 5, // 5 minutes for event details
      },
      teams: {
        queryKey: queryKeys.teams.byEvent(eventId),
        staleTime: 1000 * 30, // 30 seconds for teams
      },
      submissions: {
        queryKey: queryKeys.submissions.byEvent(eventId),
        staleTime: 1000 * 30, // 30 seconds for submissions
      },
      seekers: {
        queryKey: queryKeys.teams.seekers(eventId),
        staleTime: 1000 * 30, // 30 seconds for seekers
      },
    }

    return eventDetailQueries
  }

  /**
   * Optimize queries for user dashboard
   */
  createUserDashboardQueries(userId: string) {
    return {
      profile: {
        queryKey: queryKeys.user.profile(userId),
        staleTime: 1000 * 60 * 10, // 10 minutes for profile
      },
      myEvents: {
        queryKey: queryKeys.events.my(userId),
        staleTime: 1000 * 60 * 2, // 2 minutes for user events
      },
      notifications: {
        queryKey: queryKeys.notifications.byUser(userId),
        staleTime: 1000 * 10, // 10 seconds for notifications
      },
      memberships: {
        queryKey: queryKeys.teams.myMemberships(userId),
        staleTime: 1000 * 60, // 1 minute for memberships
      },
    }
  }

  /**
   * Prefetch related data based on current query
   */
  prefetchRelatedData(currentQueryKey: readonly unknown[]): void {
    if (!this.queryClient) return

    const keyString = currentQueryKey.join('-')

    // Event detail page - prefetch related data
    if (keyString.includes('events-detail')) {
      const eventId = this.extractEventId(currentQueryKey)
      if (eventId) {
        this.prefetchEventRelatedData(eventId)
      }
    }

    // Team page - prefetch submissions
    if (keyString.includes('teams-event')) {
      const eventId = this.extractEventId(currentQueryKey)
      if (eventId) {
        this.queryClient.prefetchQuery({
          queryKey: queryKeys.submissions.byEvent(eventId),
          staleTime: 1000 * 30,
        })
      }
    }

    // User profile - prefetch related user data
    if (keyString.includes('user-profile')) {
      const userId = this.extractUserId(currentQueryKey)
      if (userId) {
        this.prefetchUserRelatedData(userId)
      }
    }
  }

  /**
   * Optimize query execution order based on priority
   */
  optimizeQueryOrder(queries: Array<{ queryKey: readonly unknown[], priority?: number }>) {
    return queries.sort((a, b) => {
      const priorityA = a.priority ?? this.getQueryPriority(a.queryKey)
      const priorityB = b.priority ?? this.getQueryPriority(b.queryKey)
      return priorityA - priorityB // Lower number = higher priority
    })
  }

  /**
   * Get performance metrics for batching
   */
  getBatchingMetrics(): {
    activeBatches: number
    totalBatchedQueries: number
    averageBatchSize: number
    batchEfficiency: number
  } {
    const activeBatches = this.pendingBatches.size
    let totalQueries = 0
    let totalBatches = 0

    this.pendingBatches.forEach(batch => {
      totalQueries += batch.queries.length
      totalBatches++
    })

    return {
      activeBatches,
      totalBatchedQueries: totalQueries,
      averageBatchSize: totalBatches > 0 ? totalQueries / totalBatches : 0,
      batchEfficiency: totalQueries > 0 ? (totalQueries - totalBatches) / totalQueries : 0,
    }
  }

  /**
   * Private: Set up query interception for batching
   */
  private setupQueryInterception(): void {
    if (!this.queryClient) return

    // Override the default query behavior to enable batching
    const originalFetchQuery = this.queryClient.fetchQuery.bind(this.queryClient)
    
    this.queryClient.fetchQuery = async (options: any) => {
      // Check if this query should be batched
      const batchKey = this.getBatchKey(options.queryKey)
      
      if (batchKey && this.shouldBatch(options.queryKey)) {
        return this.addToBatch(batchKey, options)
      }
      
      // Execute immediately if not batchable
      return originalFetchQuery(options)
    }
  }

  /**
   * Private: Prefetch event-related data
   */
  private prefetchEventRelatedData(eventId: string): void {
    if (!this.queryClient) return

    const relatedQueries = [
      { queryKey: queryKeys.teams.byEvent(eventId), staleTime: 1000 * 30 },
      { queryKey: queryKeys.submissions.byEvent(eventId), staleTime: 1000 * 30 },
      { queryKey: queryKeys.teams.seekers(eventId), staleTime: 1000 * 30 },
    ]

    relatedQueries.forEach(query => {
      this.queryClient!.prefetchQuery({
        queryKey: query.queryKey,
        queryFn: async () => {
          // Placeholder query function - actual implementation would fetch data
          return []
        },
        staleTime: query.staleTime,
      })
    })
  }

  /**
   * Private: Prefetch user-related data
   */
  private prefetchUserRelatedData(userId: string): void {
    if (!this.queryClient) return

    const relatedQueries = [
      { queryKey: queryKeys.user.contacts(userId), staleTime: 1000 * 60 * 5 },
      { queryKey: queryKeys.notifications.byUser(userId), staleTime: 1000 * 10 },
      { queryKey: queryKeys.teams.myMemberships(userId), staleTime: 1000 * 60 },
    ]

    relatedQueries.forEach(query => {
      this.queryClient!.prefetchQuery({
        queryKey: query.queryKey,
        queryFn: async () => {
          // Placeholder query function - actual implementation would fetch data
          return []
        },
        staleTime: query.staleTime,
      })
    })
  }

  /**
   * Private: Get batch key for query
   */
  private getBatchKey(queryKey: readonly unknown[]): string | null {
    const keyString = queryKey.join('-')
    
    for (const pattern of this.config.batchPatterns) {
      if (pattern.keyPattern.some(p => keyString.includes(p))) {
        return pattern.name
      }
    }
    
    return null
  }

  /**
   * Private: Check if query should be batched
   */
  private shouldBatch(queryKey: readonly unknown[]): boolean {
    const keyString = queryKey.join('-')
    
    // Don't batch real-time queries
    if (keyString.includes('notifications')) return false
    
    // Don't batch large data queries
    if (keyString.includes('submissions') && keyString.includes('all')) return false
    
    return true
  }

  /**
   * Private: Add query to batch
   */
  private async addToBatch(batchKey: string, options: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const batch = this.pendingBatches.get(batchKey) || {
        queries: [],
        timer: 0,
        priority: this.getBatchPriority(batchKey),
      }

      batch.queries.push({
        queryKey: options.queryKey,
        queryFn: options.queryFn,
        resolve,
        reject,
      } as any)

      // Clear existing timer
      if (batch.timer) {
        clearTimeout(batch.timer)
      }

      // Set new timer
      const pattern = this.config.batchPatterns.find(p => p.name === batchKey)
      const waitTime = pattern?.maxWaitTime || this.config.batchWindow

      batch.timer = window.setTimeout(() => {
        this.executeBatch(batchKey)
      }, waitTime)

      this.pendingBatches.set(batchKey, batch)

      // Execute immediately if batch is full
      if (batch.queries.length >= this.config.maxBatchSize) {
        clearTimeout(batch.timer)
        this.executeBatch(batchKey)
      }
    })
  }

  /**
   * Private: Execute batched queries
   */
  private async executeBatch(batchKey: string): Promise<void> {
    const batch = this.pendingBatches.get(batchKey)
    if (!batch || !this.queryClient) return

    this.pendingBatches.delete(batchKey)

    // Execute all queries in the batch
    const promises = batch.queries.map(async (query: any) => {
      try {
        const result = await this.queryClient!.fetchQuery({
          queryKey: query.queryKey,
          queryFn: query.queryFn,
        })
        query.resolve(result)
      } catch (error) {
        query.reject(error)
      }
    })

    await Promise.allSettled(promises)
    
    if (import.meta.env.DEV) {
      console.log(`⚡ Executed batch ${batchKey} with ${batch.queries.length} queries`)
    }
  }

  /**
   * Private: Get query priority
   */
  private getQueryPriority(queryKey: readonly unknown[]): number {
    const keyString = queryKey.join('-')
    
    // High priority (1-3)
    if (keyString.includes('events-detail')) return 1
    if (keyString.includes('user-profile')) return 2
    if (keyString.includes('notifications')) return 3
    
    // Medium priority (4-6)
    if (keyString.includes('teams')) return 4
    if (keyString.includes('submissions')) return 5
    if (keyString.includes('events')) return 6
    
    // Low priority (7+)
    return 7
  }

  /**
   * Private: Get batch priority
   */
  private getBatchPriority(batchKey: string): number {
    const pattern = this.config.batchPatterns.find(p => p.name === batchKey)
    return pattern?.priority || 999
  }

  /**
   * Private: Extract event ID from query key
   */
  private extractEventId(queryKey: readonly unknown[]): string | null {
    const eventIndex = queryKey.findIndex(key => key === 'event')
    return eventIndex >= 0 && eventIndex < queryKey.length - 1 
      ? String(queryKey[eventIndex + 1]) 
      : null
  }

  /**
   * Private: Extract user ID from query key
   */
  private extractUserId(queryKey: readonly unknown[]): string | null {
    const userIndex = queryKey.findIndex(key => key === 'user' || key === 'profile')
    return userIndex >= 0 && userIndex < queryKey.length - 1 
      ? String(queryKey[userIndex + 1]) 
      : null
  }
}

// Export singleton instance
export const vueQueryBatchOptimizer = new VueQueryBatchOptimizer()

// Utility functions
export function createEventPageQueries(eventId: string) {
  return vueQueryBatchOptimizer.createBatchedQueries(eventId)
}

export function createUserDashboardQueries(userId: string) {
  return vueQueryBatchOptimizer.createUserDashboardQueries(userId)
}

export function prefetchRelatedData(queryKey: readonly unknown[]) {
  vueQueryBatchOptimizer.prefetchRelatedData(queryKey)
}