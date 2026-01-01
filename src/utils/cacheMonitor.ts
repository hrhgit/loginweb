/**
 * 缓存监控工具
 * 用于在开发环境中监控Vue Query缓存使用情况
 */

export function startCacheMonitoring() {
  if (!import.meta.env.DEV) return

  // 等待Vue Query初始化
  setTimeout(() => {
    const debug = (window as any).__VUE_QUERY_DEBUG__
    if (!debug) {
      console.warn('Vue Query debug tools not available')
      return
    }

    console.log('🔍 Starting cache monitoring...')
    
    // 初始状态
    const initialStats = debug.getCacheStats()
    console.log('📊 Initial cache state:', {
      totalQueries: initialStats.totalQueries,
      eventQueries: initialStats.eventQueries,
      teamQueries: initialStats.teamQueries,
      submissionQueries: initialStats.submissionQueries,
      userQueries: initialStats.userQueries,
      otherQueries: initialStats.otherQueries
    })

    // 禁用定期内存监控警告
    // setInterval(() => {
    //   const stats = debug.getMemoryStats()
    //   const cacheStats = debug.getCacheStats()
    //   
    //   console.log('📊 Cache monitoring report:', {
    //     memory: `${stats.memoryUsage.toFixed(2)}MB`,
    //     entries: stats.cacheEntries,
    //     breakdown: {
    //       events: cacheStats.eventQueries,
    //       teams: cacheStats.teamQueries,
    //       submissions: cacheStats.submissionQueries,
    //       users: cacheStats.userQueries,
    //       others: cacheStats.otherQueries
    //     }
    //   })

    //   // 如果内存使用过高，发出警告
    //   if (stats.memoryUsage > 35) {
    //     console.warn('⚠️ High memory usage detected:', `${stats.memoryUsage.toFixed(2)}MB`)
    //     console.log('🔧 Running cache optimization...')
    //     debug.optimizeCache()
    //   }
    // }, 60000) // 每分钟检查一次

  }, 2000) // 等待2秒让Vue Query初始化
}

// 手动触发缓存分析
export function analyzeCacheUsage() {
  const debug = (window as any).__VUE_QUERY_DEBUG__
  if (!debug) {
    console.warn('Vue Query debug tools not available')
    return
  }

  const cacheStats = debug.getCacheStats()
  
  console.group('🔍 Cache Usage Analysis')
  console.log('Total Cache Entries:', cacheStats.totalQueries)
  console.log('Cache Breakdown:', {
    events: cacheStats.eventQueries,
    teams: cacheStats.teamQueries,
    submissions: cacheStats.submissionQueries,
    users: cacheStats.userQueries,
    others: cacheStats.otherQueries
  })
  console.groupEnd()

  return {
    cacheStats
  }
}

// 导出到全局以便在控制台使用
if (import.meta.env.DEV) {
  (window as any).analyzeCacheUsage = analyzeCacheUsage
}