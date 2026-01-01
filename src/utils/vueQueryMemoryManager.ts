/**
 * Vue Query Memory Manager
 * 
 * Handles automatic garbage collection and memory optimization for Vue Query cache
 */

import { QueryClient } from '@tanstack/vue-query'
import { vueQueryPerformanceMonitor } from './vueQueryPerformanceMonitor'

export interface MemoryManagementConfig {
  // Maximum cache entries before triggering cleanup
  maxCacheEntries: number
  // Maximum memory usage in MB before triggering cleanup
  maxMemoryUsage: number
  // Interval for automatic cleanup (in milliseconds)
  cleanupInterval: number
  // Age threshold for automatic cleanup (in milliseconds)
  maxCacheAge: number
}

class VueQueryMemoryManager {
  private queryClient: QueryClient | null = null
  private cleanupInterval: number | null = null
  private config: MemoryManagementConfig = {
    maxCacheEntries: 100,
    maxMemoryUsage: 50, // MB
    cleanupInterval: 1000 * 60 * 5, // 5 minutes
    maxCacheAge: 1000 * 60 * 30, // 30 minutes
  }

  /**
   * Initialize memory manager with QueryClient
   */
  initialize(queryClient: QueryClient, config?: Partial<MemoryManagementConfig>): void {
    this.queryClient = queryClient
    
    if (config) {
      this.config = { ...this.config, ...config }
    }

    // Start automatic cleanup in production
    if (!import.meta.env.DEV) {
      this.startAutomaticCleanup()
    }

    // Set up memory pressure listeners
    this.setupMemoryPressureHandling()
  }

  /**
   * Start automatic cleanup process
   */
  startAutomaticCleanup(): void {
    if (this.cleanupInterval) return

    this.cleanupInterval = window.setInterval(() => {
      this.performAutomaticCleanup()
    }, this.config.cleanupInterval)

    console.log('🧹 Vue Query automatic cleanup started')
  }

  /**
   * Stop automatic cleanup process
   */
  stopAutomaticCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  /**
   * Perform manual cleanup
   */
  performCleanup(options?: {
    maxAge?: number
    maxEntries?: number
    queryKeyPatterns?: string[]
  }): number {
    if (!this.queryClient) return 0

    const cache = this.queryClient.getQueryCache()
    const queries = cache.getAll()
    const now = Date.now()
    
    let removedCount = 0
    const maxAge = options?.maxAge ?? this.config.maxCacheAge
    const maxEntries = options?.maxEntries ?? this.config.maxCacheEntries
    const patterns = options?.queryKeyPatterns

    // Remove old queries
    queries.forEach(query => {
      const age = now - query.state.dataUpdatedAt
      const shouldRemoveByAge = age > maxAge
      const shouldRemoveByPattern = patterns?.some(pattern =>
        query.queryKey.some(key => String(key).includes(pattern))
      )

      if (shouldRemoveByAge || shouldRemoveByPattern) {
        cache.remove(query)
        removedCount++
      }
    })

    // If still too many entries, remove oldest ones
    if (queries.length - removedCount > maxEntries) {
      const remainingQueries = cache.getAll()
        .sort((a, b) => a.state.dataUpdatedAt - b.state.dataUpdatedAt)
      
      const toRemove = remainingQueries.slice(0, remainingQueries.length - maxEntries)
      toRemove.forEach(query => {
        cache.remove(query)
        removedCount++
      })
    }

    if (removedCount > 0) {
      console.log(`🗑️ Cleaned up ${removedCount} cache entries`)
    }

    return removedCount
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): {
    cacheEntries: number
    memoryUsage: number
    oldestEntry: number
    newestEntry: number
  } {
    if (!this.queryClient) {
      return { cacheEntries: 0, memoryUsage: 0, oldestEntry: 0, newestEntry: 0 }
    }

    const cache = this.queryClient.getQueryCache()
    const queries = cache.getAll()
    const now = Date.now()

    let memoryUsage = 0
    if ('memory' in performance) {
      const memInfo = (performance as any).memory
      if (memInfo?.usedJSHeapSize) {
        memoryUsage = memInfo.usedJSHeapSize / (1024 * 1024)
      }
    }

    const timestamps = queries
      .map(q => q.state.dataUpdatedAt)
      .filter(t => t > 0)

    return {
      cacheEntries: queries.length,
      memoryUsage,
      oldestEntry: timestamps.length > 0 ? now - Math.min(...timestamps) : 0,
      newestEntry: timestamps.length > 0 ? now - Math.max(...timestamps) : 0,
    }
  }

  /**
   * Optimize cache for specific data patterns
   */
  optimizeForDataPattern(pattern: {
    queryKeyPrefix: string
    maxEntries: number
    maxAge: number
  }): void {
    if (!this.queryClient) return

    const cache = this.queryClient.getQueryCache()
    const queries = cache.getAll()
      .filter(query => 
        query.queryKey.some(key => String(key).startsWith(pattern.queryKeyPrefix))
      )

    const now = Date.now()
    let removedCount = 0

    // Remove entries that exceed limits for this pattern
    queries
      .sort((a, b) => a.state.dataUpdatedAt - b.state.dataUpdatedAt)
      .forEach((query, index) => {
        const age = now - query.state.dataUpdatedAt
        const shouldRemove = age > pattern.maxAge || index >= pattern.maxEntries

        if (shouldRemove) {
          cache.remove(query)
          removedCount++
        }
      })

    if (removedCount > 0) {
      console.log(`🎯 Optimized ${pattern.queryKeyPrefix} pattern: removed ${removedCount} entries`)
    }
  }

  /**
   * Configure memory management settings
   */
  configure(config: Partial<MemoryManagementConfig>): void {
    this.config = { ...this.config, ...config }
    
    // Restart cleanup with new config
    if (this.cleanupInterval) {
      this.stopAutomaticCleanup()
      this.startAutomaticCleanup()
    }
  }

  /**
   * Private: Perform automatic cleanup based on thresholds
   */
  private performAutomaticCleanup(): void {
    const stats = this.getMemoryStats()

    let shouldCleanup = false
    const reasons: string[] = []

    // Check cache size threshold
    if (stats.cacheEntries > this.config.maxCacheEntries) {
      shouldCleanup = true
      reasons.push(`cache entries (${stats.cacheEntries} > ${this.config.maxCacheEntries})`)
    }

    // Check memory usage threshold
    if (stats.memoryUsage > this.config.maxMemoryUsage) {
      shouldCleanup = true
      reasons.push(`memory usage (${stats.memoryUsage.toFixed(2)}MB > ${this.config.maxMemoryUsage}MB)`)
    }

    // Check oldest entry age
    if (stats.oldestEntry > this.config.maxCacheAge) {
      shouldCleanup = true
      reasons.push(`cache age (${Math.round(stats.oldestEntry / 1000 / 60)}min > ${Math.round(this.config.maxCacheAge / 1000 / 60)}min)`)
    }

    if (shouldCleanup) {
      console.log(`🧹 Automatic cleanup triggered: ${reasons.join(', ')}`)
      const removed = this.performCleanup()
      
      // Update performance monitor
      vueQueryPerformanceMonitor.recordCacheMiss() // Record cleanup as cache miss for metrics
      
      if (removed > 0) {
        console.log(`🗑️ Cleaned up ${removed} cache entries`)
      }
    }
  }

  /**
   * Private: Set up memory pressure handling
   */
  private setupMemoryPressureHandling(): void {
    // Listen for memory pressure events (if supported)
    if ('memory' in performance && 'addEventListener' in window) {
      // Modern browsers may support memory pressure events
      try {
        (window as any).addEventListener('memorypressure', () => {
          console.warn('🚨 Memory pressure detected, performing emergency cleanup')
          this.performCleanup({
            maxAge: this.config.maxCacheAge / 2, // More aggressive cleanup
            maxEntries: Math.floor(this.config.maxCacheEntries / 2),
          })
        })
      } catch (e) {
        // Memory pressure events not supported
      }
    }

    // Fallback: Monitor memory usage manually
    if (import.meta.env.DEV) {
      setInterval(() => {
        const stats = this.getMemoryStats()
        if (stats.memoryUsage > this.config.maxMemoryUsage * 1.5) {
          console.warn(`🚨 High memory usage detected: ${stats.memoryUsage.toFixed(2)}MB`)
        }
      }, 10000) // Check every 10 seconds in development
    }
  }
}

// Export singleton instance
export const vueQueryMemoryManager = new VueQueryMemoryManager()

// Utility functions
export function cleanupOldQueries(maxAgeMinutes: number = 30): number {
  return vueQueryMemoryManager.performCleanup({
    maxAge: maxAgeMinutes * 60 * 1000,
  })
}

export function optimizeEventQueries(): void {
  vueQueryMemoryManager.optimizeForDataPattern({
    queryKeyPrefix: 'events',
    maxEntries: 20,
    maxAge: 1000 * 60 * 10, // 10 minutes
  })
}

export function optimizeTeamQueries(): void {
  vueQueryMemoryManager.optimizeForDataPattern({
    queryKeyPrefix: 'teams',
    maxEntries: 30,
    maxAge: 1000 * 60 * 15, // 15 minutes
  })
}

export function optimizeSubmissionQueries(): void {
  vueQueryMemoryManager.optimizeForDataPattern({
    queryKeyPrefix: 'submissions',
    maxEntries: 50,
    maxAge: 1000 * 60 * 20, // 20 minutes
  })
}