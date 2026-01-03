/**
 * Vue Query 配置
 * 为队伍和作品数据提供智能缓存和状态管理
 */

import { VueQueryPlugin, type VueQueryPluginOptions, QueryClient } from '@tanstack/vue-query'
import type { App } from 'vue'

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
                              error?.message?.includes('timeout') ||
                              error?.message?.includes('超时') ||
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
                              error?.message?.includes('timeout') ||
                              error?.message?.includes('超时') ||
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

// 安装 Vue Query 插件
export async function setupVueQuery(app: App) {
  // 使用预创建的 QueryClient 实例
  queryClient = queryClientInstance
  
  // 安装插件
  app.use(VueQueryPlugin, vueQueryOptions)
  
  // 开发环境下启用详细日志
  if (import.meta.env.DEV) {
    console.log('🚀 Vue Query initialized')
    
    // 暴露调试工具到全局
    ;(window as any).__VUE_QUERY_DEBUG__ = {
      queryClient,
      // 便捷方法
      getCacheStats: () => {
        if (!queryClient) return { totalQueries: 0 }
        const cache = queryClient.getQueryCache()
        return {
          totalQueries: cache.getAll().length
        }
      },
      clearCache: () => queryClient?.clear(),
    }
  }
  
  // 延迟初始化缓存优化器，避免阻塞应用启动
  setTimeout(async () => {
    try {
      const { vueQueryCacheOptimizer } = await import('../utils/vueQueryCacheOptimizer')
      if (queryClient) {
        vueQueryCacheOptimizer.initialize(queryClient)
      }
      
      if (import.meta.env.DEV) {
        console.log('🚀 Cache optimizer initialized')
        ;(window as any).__VUE_QUERY_DEBUG__.cacheOptimizer = vueQueryCacheOptimizer
        ;(window as any).__VUE_QUERY_DEBUG__.getCacheStats = () => vueQueryCacheOptimizer.getCacheStats()
        ;(window as any).__VUE_QUERY_DEBUG__.optimizeCache = () => vueQueryCacheOptimizer.optimize()
      }
    } catch (error) {
      console.warn('Failed to initialize cache optimizer:', error)
    }
  }, 2000) // 2秒后初始化
}

// 获取 QueryClient 实例
export function getQueryClient(): QueryClient {
  if (!queryClient) {
    throw new Error('QueryClient not initialized. Call setupVueQuery first.')
  }
  return queryClient
}

// 优化的查询包装器
export function createOptimizedQuery<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  dataType: 'realTime' | 'standard' | 'static' = 'standard'
) {
  // 根据数据类型设置缓存配置
  const getCacheConfig = (type: string) => {
    switch (type) {
      case 'realTimeData':
        return {
          staleTime: 1000 * 10,     // 10秒
          gcTime: 1000 * 60 * 5,    // 5分钟
        }
      case 'staticData':
        return {
          staleTime: 1000 * 60 * 30, // 30分钟
          gcTime: 1000 * 60 * 60,    // 1小时
        }
      default: // standardData
        return {
          staleTime: 1000 * 30,      // 30秒
          gcTime: 1000 * 60 * 15,    // 15分钟
        }
    }
  }
  
  const config = getCacheConfig(`${dataType}Data`)
  
  // 创建包装的查询函数，添加日志
  const wrappedQueryFn = async () => {
    const keyString = queryKey.join('-')
    console.log(`[createOptimizedQuery] Executing query: ${keyString}`)
    
    try {
      const result = await queryFn()
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
                            error?.message?.includes('timeout') ||
                            error?.message?.includes('??') ||
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
    list: (eventId: string, params: { page: number, limit: number }) => ['teams', 'event', eventId, 'list', params] as const,
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
    list: (eventId: string, params: { page: number, limit: number }) => ['submissions', 'event', eventId, 'list', params] as const,
    byTeam: (teamId: string) => ['submissions', 'team', teamId] as const,
    byUser: (eventId: string, userId: string) => ['submissions', 'user', userId, 'event', eventId] as const,
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
