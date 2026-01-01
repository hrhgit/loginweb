/**
 * Vue Query 配置
 * 为队伍和作品数据提供智能缓存和状态管理
 * 集成性能监控和内存管理
 */

import { VueQueryPlugin, type VueQueryPluginOptions, QueryClient } from '@tanstack/vue-query'
import type { App } from 'vue'
import { vueQueryPerformanceMonitor, measureQueryPerformance } from '../utils/vueQueryPerformanceMonitor'

// 创建 QueryClient 实例
let queryClient: QueryClient | null = null

// 创建 QueryClient 实例
const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      // 缓存时间：数据在内存中保持的时间 (优化配置)
      gcTime: 1000 * 60 * 10, // 10分钟（减少缓存时间）
      // 数据新鲜度：多久后数据被认为是过期的 (优化配置)
      staleTime: 1000 * 20, // 20秒（减少到20秒以降低缓存压力）
      // 重试配置
      retry: (failureCount, error: any) => {
        // 网络错误重试3次，其他错误不重试
        const isNetworkError = error?.message?.includes('网络') || 
                              error?.message?.includes('fetch') ||
                              error?.code === 'NETWORK_ERROR'
        return isNetworkError && failureCount < 3
      },
      // 重试延迟（指数退避，最大10秒）
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      // 优化的重新获取策略
      refetchOnWindowFocus: false, // 禁用窗口焦点重新获取以减少不必要的请求
      refetchOnReconnect: true,    // 网络重连时重新获取数据
      refetchOnMount: false,       // 挂载时不自动重新获取（除非缓存不存在）
      // 网络模式优化
      networkMode: 'online',
    },
    mutations: {
      // 变更重试配置
      retry: (failureCount, error: any) => {
        const isNetworkError = error?.message?.includes('网络') || 
                              error?.message?.includes('fetch') ||
                              error?.code === 'NETWORK_ERROR'
        return isNetworkError && failureCount < 2 // 变更操作最多重试1次
      },
      retryDelay: 1000,
      networkMode: 'online',
    },
  },
})

// Vue Query 配置选项
export const vueQueryOptions: VueQueryPluginOptions = {
  queryClient: queryClientInstance,
}

// 安装 Vue Query 插件并初始化性能监控
export async function setupVueQuery(app: App) {
  // 使用预创建的 QueryClient 实例
  queryClient = queryClientInstance
  
  // 初始化性能监控
  vueQueryPerformanceMonitor.initialize(queryClient)
  
  // 初始化内存管理
  const { vueQueryMemoryManager } = await import('../utils/vueQueryMemoryManager')
  vueQueryMemoryManager.initialize(queryClient, {
    maxCacheEntries: 50,      // 减少最大缓存条目
    maxMemoryUsage: 30,       // 降低内存使用阈值到30MB
    cleanupInterval: 1000 * 60 * 2, // 2分钟清理间隔（更频繁）
    maxCacheAge: 1000 * 60 * 10,    // 10分钟最大缓存年龄（更短）
  })
  
  // 初始化查询批处理优化
  const { vueQueryBatchOptimizer } = await import('../utils/vueQueryBatchOptimizer')
  vueQueryBatchOptimizer.initialize(queryClient, {
    batchWindow: 30,          // 30ms批处理窗口
    maxBatchSize: 8,          // 最大批处理大小
  })
  
  // 初始化缓存优化器
  const { vueQueryCacheOptimizer } = await import('../utils/vueQueryCacheOptimizer')
  vueQueryCacheOptimizer.initialize(queryClient)
  
  // 安装插件
  app.use(VueQueryPlugin, vueQueryOptions)
  
  // 开发环境下启用详细日志和监控
  if (import.meta.env.DEV) {
    console.log('🚀 Vue Query initialized with performance monitoring, memory management, and batch optimization')
    
    // 禁用定期性能报告和内存监控警告
    // setInterval(() => {
    //   const report = vueQueryPerformanceMonitor.getPerformanceReport()
    //   if (report.includes('⚠️')) {
    //     console.warn(report)
    //   }
    //   
    //   // 输出内存统计
    //   const memoryStats = vueQueryMemoryManager.getMemoryStats()
    //   if (memoryStats.cacheEntries > 40) { // 降低阈值
    //     console.log(`📊 Cache entries: ${memoryStats.cacheEntries}, Memory: ${memoryStats.memoryUsage.toFixed(2)}MB`)
    //   }
    //   
    //   // 输出批处理统计
    //   const batchStats = vueQueryBatchOptimizer.getBatchingMetrics()
    //   if (batchStats.totalBatchedQueries > 0) {
    //     console.log(`⚡ Batching efficiency: ${(batchStats.batchEfficiency * 100).toFixed(1)}%`)
    //   }
    // }, 60000) // 每60秒检查一次（降低频率）
    
    // 暴露调试工具到全局
    ;(window as any).__VUE_QUERY_DEBUG__ = {
      performanceMonitor: vueQueryPerformanceMonitor,
      memoryManager: vueQueryMemoryManager,
      batchOptimizer: vueQueryBatchOptimizer,
      cacheOptimizer: vueQueryCacheOptimizer,
      queryClient,
      // 便捷方法
      getCacheStats: () => vueQueryCacheOptimizer.getCacheStats(),
      getMemoryStats: () => vueQueryMemoryManager.getMemoryStats(),
      optimizeCache: () => vueQueryCacheOptimizer.optimize(),
      clearCache: () => queryClient.clear(),
    }
  }
}

// 获取 QueryClient 实例
export function getQueryClient(): QueryClient {
  if (!queryClient) {
    throw new Error('QueryClient not initialized. Call setupVueQuery first.')
  }
  return queryClient
}

// 性能优化的查询包装器
export function createOptimizedQuery<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  dataType: 'realTime' | 'standard' | 'static' = 'standard'
) {
  const config = vueQueryPerformanceMonitor.getCacheConfig(`${dataType}Data` as any)
  
  // 创建包装的查询函数，添加日志
  const wrappedQueryFn = async () => {
    const keyString = queryKey.join('-')
    console.log(`[createOptimizedQuery] Executing query: ${keyString}`)
    
    try {
      const result = await measureQueryPerformance(keyString, queryFn)
      console.log(`[createOptimizedQuery] Query success: ${keyString}`)
      return result
    } catch (error) {
      console.error(`[createOptimizedQuery] Query error: ${keyString}`, error)
      throw error
    }
  }
  
  return {
    queryKey,
    queryFn: wrappedQueryFn,
    ...config,
    retry: (failureCount: number, error: any) => {
      const isNetworkError = error?.message?.includes('网络') || 
                            error?.message?.includes('fetch') ||
                            error?.code === 'NETWORK_ERROR'
      return isNetworkError && failureCount < 3
    },
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 10000),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    networkMode: 'online' as const,
  }
}

// 查询键工厂 - 统一管理查询键，避免重复和冲突
export const queryKeys = {
  // 队伍相关
  teams: {
    all: ['teams'] as const,
    byEvent: (eventId: string) => ['teams', 'event', eventId] as const,
    members: (teamId: string) => ['teams', 'members', teamId] as const,
    requests: (teamId: string) => ['teams', 'requests', teamId] as const,
    seekers: (eventId: string) => ['teams', 'seekers', eventId] as const,
    myMemberships: (userId: string) => ['teams', 'memberships', userId] as const,
    myRequests: (userId: string) => ['teams', 'my-requests', userId] as const,
    myInvites: (userId: string) => ['teams', 'my-invites', userId] as const,
  },
  
  // 作品相关
  submissions: {
    all: ['submissions'] as const,
    byEvent: (eventId: string) => ['submissions', 'event', eventId] as const,
    byTeam: (teamId: string) => ['submissions', 'team', teamId] as const,
  },
  
  // 活动相关
  events: {
    all: ['events'] as const,
    public: ['events', 'public'] as const,
    my: (userId: string) => ['events', 'my', userId] as const,
    detail: (eventId: string) => ['events', 'detail', eventId] as const,
  },
  
  // 用户相关
  user: {
    all: ['user'] as const,
    profile: (userId: string) => ['user', 'profile', userId] as const,
    contacts: (userId: string) => ['user', 'contacts', userId] as const,
    registrations: (userId: string) => ['user', 'registrations', userId] as const,
  },
  
  // 报名相关
  registrations: {
    all: ['registrations'] as const,
    form: (eventId: string, userId: string) => ['registrations', 'form', eventId, userId] as const,
    count: (eventId: string) => ['registrations', 'count', eventId] as const,
    byEvent: (eventId: string) => ['registrations', 'event', eventId] as const,
  },
  
  // 评委相关
  judges: {
    all: ['judges'] as const,
    byEvent: (eventId: string) => ['judges', 'event', eventId] as const,
    permissions: (eventId: string, userId: string) => ['judges', 'permissions', eventId, userId] as const,
  },
  
  // 通知相关
  notifications: {
    all: ['notifications'] as const,
    byUser: (userId: string) => ['notifications', 'user', userId] as const,
  },
} as const

// 查询键类型
export type QueryKeys = typeof queryKeys