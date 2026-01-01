/**
 * Vue Query Cache Optimizer
 * 
 * 专门用于优化Vue Query缓存，降低内存使用
 */

import { QueryClient } from '@tanstack/vue-query'
import { vueQueryMemoryManager } from './vueQueryMemoryManager'

export class VueQueryCacheOptimizer {
  private queryClient: QueryClient | null = null
  private optimizationInterval: number | null = null

  initialize(queryClient: QueryClient): void {
    this.queryClient = queryClient
    this.startOptimization()
  }

  /**
   * 开始自动优化
   */
  startOptimization(): void {
    if (this.optimizationInterval) return

    // 每2分钟执行一次优化
    this.optimizationInterval = window.setInterval(() => {
      this.performOptimization()
    }, 1000 * 60 * 2)

    console.log('🚀 Vue Query cache optimizer started')
  }

  /**
   * 停止自动优化
   */
  stopOptimization(): void {
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval)
      this.optimizationInterval = null
    }
  }

  /**
   * 执行缓存优化
   */
  performOptimization(): void {
    if (!this.queryClient) return

    const stats = vueQueryMemoryManager.getMemoryStats()
    
    // 如果内存使用超过25MB或缓存条目超过40个，执行优化
    if (stats.memoryUsage > 25 || stats.cacheEntries > 40) {
      console.log(`🔧 Performing cache optimization - Memory: ${stats.memoryUsage.toFixed(2)}MB, Entries: ${stats.cacheEntries}`)
      
      // 1. 清理过期的事件数据（超过5分钟）
      this.cleanupEventQueries(5)
      
      // 2. 清理过期的队伍数据（超过8分钟）
      this.cleanupTeamQueries(8)
      
      // 3. 清理过期的作品数据（超过10分钟）
      this.cleanupSubmissionQueries(10)
      
      // 4. 清理用户数据（保留最近的）
      this.cleanupUserQueries(15)
      
      // 5. 如果还是太多，执行更激进的清理
      const newStats = vueQueryMemoryManager.getMemoryStats()
      if (newStats.cacheEntries > 30) {
        this.aggressiveCleanup()
      }
    }
  }

  /**
   * 清理事件查询缓存
   */
  private cleanupEventQueries(maxAgeMinutes: number): void {
    if (!this.queryClient) return

    const cache = this.queryClient.getQueryCache()
    const queries = cache.getAll()
    const maxAge = maxAgeMinutes * 60 * 1000
    const now = Date.now()
    let removed = 0

    queries.forEach(query => {
      const isEventQuery = query.queryKey.some(key => 
        String(key).startsWith('events') || String(key).includes('event')
      )
      
      if (isEventQuery && (now - query.state.dataUpdatedAt) > maxAge) {
        cache.remove(query)
        removed++
      }
    })

    if (removed > 0) {
      console.log(`🗑️ Cleaned up ${removed} event queries`)
    }
  }

  /**
   * 清理队伍查询缓存
   */
  private cleanupTeamQueries(maxAgeMinutes: number): void {
    if (!this.queryClient) return

    const cache = this.queryClient.getQueryCache()
    const queries = cache.getAll()
    const maxAge = maxAgeMinutes * 60 * 1000
    const now = Date.now()
    let removed = 0

    queries.forEach(query => {
      const isTeamQuery = query.queryKey.some(key => 
        String(key).startsWith('teams') || String(key).includes('team')
      )
      
      if (isTeamQuery && (now - query.state.dataUpdatedAt) > maxAge) {
        cache.remove(query)
        removed++
      }
    })

    if (removed > 0) {
      console.log(`🗑️ Cleaned up ${removed} team queries`)
    }
  }

  /**
   * 清理作品查询缓存
   */
  private cleanupSubmissionQueries(maxAgeMinutes: number): void {
    if (!this.queryClient) return

    const cache = this.queryClient.getQueryCache()
    const queries = cache.getAll()
    const maxAge = maxAgeMinutes * 60 * 1000
    const now = Date.now()
    let removed = 0

    queries.forEach(query => {
      const isSubmissionQuery = query.queryKey.some(key => 
        String(key).startsWith('submissions') || String(key).includes('submission')
      )
      
      if (isSubmissionQuery && (now - query.state.dataUpdatedAt) > maxAge) {
        cache.remove(query)
        removed++
      }
    })

    if (removed > 0) {
      console.log(`🗑️ Cleaned up ${removed} submission queries`)
    }
  }

  /**
   * 清理用户查询缓存
   */
  private cleanupUserQueries(maxAgeMinutes: number): void {
    if (!this.queryClient) return

    const cache = this.queryClient.getQueryCache()
    const queries = cache.getAll()
    const maxAge = maxAgeMinutes * 60 * 1000
    const now = Date.now()
    let removed = 0

    queries.forEach(query => {
      const isUserQuery = query.queryKey.some(key => 
        String(key).startsWith('user') || String(key).includes('profile') || String(key).includes('contacts')
      )
      
      if (isUserQuery && (now - query.state.dataUpdatedAt) > maxAge) {
        cache.remove(query)
        removed++
      }
    })

    if (removed > 0) {
      console.log(`🗑️ Cleaned up ${removed} user queries`)
    }
  }

  /**
   * 激进清理 - 只保留最近使用的查询
   */
  private aggressiveCleanup(): void {
    if (!this.queryClient) return

    const cache = this.queryClient.getQueryCache()
    const queries = cache.getAll()
    const now = Date.now()

    // 按最后更新时间排序，保留最近的20个查询
    const sortedQueries = queries
      .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)
    
    const toRemove = sortedQueries.slice(20) // 移除除了最近20个之外的所有查询
    
    toRemove.forEach(query => {
      cache.remove(query)
    })

    if (toRemove.length > 0) {
      console.log(`🚨 Aggressive cleanup: removed ${toRemove.length} queries, kept 20 most recent`)
    }
  }

  /**
   * 手动触发优化
   */
  optimize(): void {
    this.performOptimization()
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    totalQueries: number
    eventQueries: number
    teamQueries: number
    submissionQueries: number
    userQueries: number
    otherQueries: number
  } {
    if (!this.queryClient) {
      return {
        totalQueries: 0,
        eventQueries: 0,
        teamQueries: 0,
        submissionQueries: 0,
        userQueries: 0,
        otherQueries: 0
      }
    }

    const cache = this.queryClient.getQueryCache()
    const queries = cache.getAll()

    let eventQueries = 0
    let teamQueries = 0
    let submissionQueries = 0
    let userQueries = 0
    let otherQueries = 0

    queries.forEach(query => {
      const keyStr = query.queryKey.join('-')
      if (keyStr.includes('event')) {
        eventQueries++
      } else if (keyStr.includes('team')) {
        teamQueries++
      } else if (keyStr.includes('submission')) {
        submissionQueries++
      } else if (keyStr.includes('user') || keyStr.includes('profile') || keyStr.includes('contact')) {
        userQueries++
      } else {
        otherQueries++
      }
    })

    return {
      totalQueries: queries.length,
      eventQueries,
      teamQueries,
      submissionQueries,
      userQueries,
      otherQueries
    }
  }
}

// 导出单例实例
export const vueQueryCacheOptimizer = new VueQueryCacheOptimizer()