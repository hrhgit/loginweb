/**
 * Vue Query Performance Monitor
 * 
 * Provides memory management and performance optimization for Vue Query caching
 * Implements garbage collection configuration, cache size monitoring, and performance metrics
 */

import { QueryClient } from '@tanstack/vue-query'
import { ref, computed } from 'vue'

export interface VueQueryMetrics {
  cacheSize: number
  totalQueries: number
  activeQueries: number
  staleQueries: number
  memoryUsage: number
  cacheHitRate: number
  averageQueryTime: number
  gcCollections: number
}

export interface CacheConfiguration {
  // Different garbage collection times for different data types
  realTimeData: {
    staleTime: number
    gcTime: number
  }
  standardData: {
    staleTime: number
    gcTime: number
  }
  staticData: {
    staleTime: number
    gcTime: number
  }
}

export interface PerformanceThresholds {
  maxCacheSize: number
  maxMemoryUsage: number
  minCacheHitRate: number
  maxQueryTime: number
}

class VueQueryPerformanceMonitor {
  private queryClient: QueryClient | null = null
  private metrics = ref<VueQueryMetrics>({
    cacheSize: 0,
    totalQueries: 0,
    activeQueries: 0,
    staleQueries: 0,
    memoryUsage: 0,
    cacheHitRate: 0,
    averageQueryTime: 0,
    gcCollections: 0
  })

  private cacheStats = { hits: 0, misses: 0 }
  private queryTimes: number[] = []
  private gcCollectionCount = 0
  private monitoringInterval: number | null = null
  private isMonitoring = false

  // Cache configuration for different data types
  public readonly cacheConfig: CacheConfiguration = {
    // Real-time data (frequently changing) - notifications, live updates
    realTimeData: {
      staleTime: 1000 * 10,     // 10 seconds
      gcTime: 1000 * 60 * 5,    // 5 minutes
    },
    
    // Standard data (moderately changing) - events, teams, submissions
    standardData: {
      staleTime: 1000 * 30,     // 30 seconds
      gcTime: 1000 * 60 * 15,   // 15 minutes
    },
    
    // Static data (rarely changing) - user profiles, settings
    staticData: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30,   // 30 minutes
    },
  }

  private readonly thresholds: PerformanceThresholds = {
    maxCacheSize: 100,        // Maximum number of cache entries
    maxMemoryUsage: 50,       // Maximum memory usage in MB
    minCacheHitRate: 80,      // Minimum cache hit rate percentage
    maxQueryTime: 3000,       // Maximum query time in ms (调整到3秒)
  }

  /**
   * Initialize the performance monitor with a QueryClient
   */
  initialize(queryClient: QueryClient): void {
    this.queryClient = queryClient
    
    // Set up cache event listeners for performance tracking
    this.setupCacheEventListeners()
    
    // Start monitoring in development mode
    if (import.meta.env.DEV) {
      this.startMonitoring()
    }
  }

  /**
   * Get cache configuration for specific data type
   */
  getCacheConfig(dataType: keyof CacheConfiguration) {
    return this.cacheConfig[dataType]
  }

  /**
   * Start performance monitoring (development mode only)
   */
  startMonitoring(): void {
    if (this.isMonitoring || !import.meta.env.DEV) return

    this.isMonitoring = true
    // 禁用定期性能监控和警告
    // this.monitoringInterval = window.setInterval(() => {
    //   this.updateMetrics()
    //   this.checkPerformanceThresholds()
    // }, 5000) // Update every 5 seconds

    console.log('🚀 Vue Query Performance Monitor started (alerts disabled)')
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
    this.isMonitoring = false
  }

  /**
   * Record cache hit for performance metrics
   */
  recordCacheHit(): void {
    this.cacheStats.hits++
  }

  /**
   * Record cache miss for performance metrics
   */
  recordCacheMiss(): void {
    this.cacheStats.misses++
  }

  /**
   * Record query execution time
   */
  recordQueryTime(duration: number): void {
    this.queryTimes.push(duration)
    
    // Keep only last 100 query times to prevent memory bloat
    if (this.queryTimes.length > 100) {
      this.queryTimes = this.queryTimes.slice(-100)
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): VueQueryMetrics {
    return this.metrics.value
  }

  /**
   * Get reactive metrics for Vue components
   */
  get reactiveMetrics() {
    return computed(() => this.metrics.value)
  }

  /**
   * Force garbage collection for specific query patterns
   */
  forceGarbageCollection(queryKeyPattern?: string[]): void {
    if (!this.queryClient) return

    const cache = this.queryClient.getQueryCache()
    const queries = cache.getAll()

    let removedCount = 0
    queries.forEach(query => {
      const shouldRemove = queryKeyPattern 
        ? queryKeyPattern.some(pattern => 
            query.queryKey.some(key => String(key).includes(pattern))
          )
        : query.state.dataUpdatedAt < Date.now() - (1000 * 60 * 30) // 30 minutes old

      if (shouldRemove) {
        cache.remove(query)
        removedCount++
      }
    })

    this.gcCollectionCount++
    console.log(`🗑️ Garbage collected ${removedCount} cache entries`)
  }

  /**
   * Optimize query batching for related data
   */
  optimizeQueryBatching(): void {
    if (!this.queryClient) return

    // Configure query batching for better performance
    this.queryClient.setDefaultOptions({
      queries: {
        // Enable query batching
        networkMode: 'online',
        // Optimize retry behavior
        retry: (failureCount, error: any) => {
          const isNetworkError = error?.message?.includes('网络') || 
                                error?.message?.includes('fetch') ||
                                error?.code === 'NETWORK_ERROR'
          return isNetworkError && failureCount < 3
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      }
    })
  }

  /**
   * Get performance report for debugging
   */
  getPerformanceReport(): string {
    const metrics = this.getMetrics()
    const warnings: string[] = []

    // Check thresholds and add warnings
    if (metrics.cacheSize > this.thresholds.maxCacheSize) {
      warnings.push(`⚠️ Cache size (${metrics.cacheSize}) exceeds threshold (${this.thresholds.maxCacheSize})`)
    }
    if (metrics.memoryUsage > this.thresholds.maxMemoryUsage) {
      warnings.push(`⚠️ Memory usage (${metrics.memoryUsage.toFixed(2)}MB) exceeds threshold (${this.thresholds.maxMemoryUsage}MB)`)
    }
    if (metrics.cacheHitRate < this.thresholds.minCacheHitRate) {
      warnings.push(`⚠️ Cache hit rate (${metrics.cacheHitRate.toFixed(1)}%) below threshold (${this.thresholds.minCacheHitRate}%)`)
    }
    if (metrics.averageQueryTime > this.thresholds.maxQueryTime) {
      warnings.push(`⚠️ Average query time (${metrics.averageQueryTime.toFixed(0)}ms) exceeds threshold (${this.thresholds.maxQueryTime}ms)`)
    }

    return [
      '=== Vue Query Performance Report ===',
      `Cache Size: ${metrics.cacheSize} entries`,
      `Total Queries: ${metrics.totalQueries}`,
      `Active Queries: ${metrics.activeQueries}`,
      `Stale Queries: ${metrics.staleQueries}`,
      `Memory Usage: ${metrics.memoryUsage.toFixed(2)}MB`,
      `Cache Hit Rate: ${metrics.cacheHitRate.toFixed(1)}%`,
      `Average Query Time: ${metrics.averageQueryTime.toFixed(0)}ms`,
      `GC Collections: ${metrics.gcCollections}`,
      '',
      warnings.length > 0 ? warnings.join('\n') : '✅ All metrics within thresholds',
    ].join('\n')
  }

  /**
   * Clear all performance data
   */
  reset(): void {
    this.cacheStats = { hits: 0, misses: 0 }
    this.queryTimes = []
    this.gcCollectionCount = 0
    this.updateMetrics()
  }

  /**
   * Private: Set up cache event listeners
   */
  private setupCacheEventListeners(): void {
    if (!this.queryClient) return

    const cache = this.queryClient.getQueryCache()
    
    // Listen for cache events
    cache.subscribe((event) => {
      switch (event.type) {
        case 'added':
          this.recordCacheMiss()
          break
        case 'updated':
          if (event.query.state.data !== undefined) {
            this.recordCacheHit()
          }
          break
      }
    })
  }

  /**
   * Private: Update performance metrics
   */
  private updateMetrics(): void {
    if (!this.queryClient) return

    const cache = this.queryClient.getQueryCache()
    const queries = cache.getAll()

    // Update cache metrics
    this.metrics.value.cacheSize = queries.length
    this.metrics.value.totalQueries = queries.length
    this.metrics.value.activeQueries = queries.filter(q => q.state.fetchStatus === 'fetching').length
    this.metrics.value.staleQueries = queries.filter(q => q.isStale()).length
    this.metrics.value.gcCollections = this.gcCollectionCount

    // Update memory usage
    if ('memory' in performance) {
      const memInfo = (performance as any).memory
      if (memInfo?.usedJSHeapSize) {
        this.metrics.value.memoryUsage = memInfo.usedJSHeapSize / (1024 * 1024)
      }
    }

    // Update cache hit rate
    const total = this.cacheStats.hits + this.cacheStats.misses
    if (total > 0) {
      this.metrics.value.cacheHitRate = (this.cacheStats.hits / total) * 100
    }

    // Update average query time
    if (this.queryTimes.length > 0) {
      const sum = this.queryTimes.reduce((acc, time) => acc + time, 0)
      this.metrics.value.averageQueryTime = sum / this.queryTimes.length
    }
  }

  /**
   * Private: Check performance thresholds and log warnings
   */
  private checkPerformanceThresholds(): void {
    // 禁用性能阈值检查和警告
    // const metrics = this.getMetrics()

    // if (metrics.cacheSize > this.thresholds.maxCacheSize) {
    //   console.warn(`🚨 Vue Query cache size (${metrics.cacheSize}) exceeds threshold. Consider garbage collection.`)
    //   this.forceGarbageCollection()
    // }

    // if (metrics.memoryUsage > this.thresholds.maxMemoryUsage) {
    //   console.warn(`🚨 Memory usage (${metrics.memoryUsage.toFixed(2)}MB) is high. Consider optimizing cache configuration.`)
    // }

    // if (metrics.cacheHitRate < this.thresholds.minCacheHitRate && this.cacheStats.hits + this.cacheStats.misses > 10) {
    //   console.warn(`🚨 Cache hit rate (${metrics.cacheHitRate.toFixed(1)}%) is low. Consider adjusting stale times.`)
    // }
  }
}

// Export singleton instance
export const vueQueryPerformanceMonitor = new VueQueryPerformanceMonitor()

// Utility functions for measuring query performance
export function measureQueryPerformance<T>(
  queryKey: string,
  queryFn: () => Promise<T>
): Promise<T> {
  console.log('[measureQueryPerformance] Starting query:', queryKey)
  const startTime = performance.now()
  
  // 直接执行查询函数，不做额外包装
  const promise = queryFn()
  
  // 确保返回的是一个有效的Promise
  if (!promise || typeof promise.then !== 'function') {
    console.error('[measureQueryPerformance] queryFn did not return a Promise for:', queryKey)
    return Promise.reject(new Error(`Query function for ${queryKey} did not return a Promise`))
  }
  
  return promise.then(
    (result) => {
      const duration = performance.now() - startTime
      console.log(`[measureQueryPerformance] Query completed: ${queryKey} in ${duration.toFixed(0)}ms`)
      vueQueryPerformanceMonitor.recordQueryTime(duration)
      return result
    },
    (error) => {
      const duration = performance.now() - startTime
      console.error(`[measureQueryPerformance] Query failed: ${queryKey} in ${duration.toFixed(0)}ms`, error)
      vueQueryPerformanceMonitor.recordQueryTime(duration)
      throw error
    }
  )
}

// Cache configuration helpers
export const getCacheConfigForDataType = (dataType: 'realTime' | 'standard' | 'static') => {
  return vueQueryPerformanceMonitor.getCacheConfig(`${dataType}Data` as keyof CacheConfiguration)
}

// Development-only cache monitoring
export function logCacheStatus(): void {
  if (import.meta.env.DEV) {
    console.log(vueQueryPerformanceMonitor.getPerformanceReport())
  }
}