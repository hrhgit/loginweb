/**
 * 增强的降级策略系统
 * 
 * 提供模块加载失败时的多层降级策略，包括离线缓存检测和使用机制
 */

import { offlineManager, type OfflineCapability } from './offlineManager'
import { gracefulDegradationSystem } from './gracefulDegradation'
import type { LoadError } from './moduleLoader'

// ============================================================================
// 类型定义
// ============================================================================

export interface FallbackContext {
  route: string
  component: string
  eventId?: string
  userId?: string
  error: LoadError
  networkState: {
    isOnline: boolean
    quality: string
  }
}

export interface FallbackResult {
  component: any
  type: 'full' | 'simplified' | 'cached' | 'minimal'
  source: 'network' | 'cache' | 'inline'
  capabilities: string[]
  limitations: string[]
}

export interface FallbackStrategy {
  canFallback(error: LoadError): boolean
  getFallbackComponent(context?: FallbackContext): Promise<FallbackResult>
  checkOfflineCapabilities(): Promise<OfflineCapability>
  getCachedComponent(componentPath: string): Promise<any | null>
}

// ============================================================================
// 增强的降级策略处理器
// ============================================================================

export class EnhancedFallbackStrategy implements FallbackStrategy {
  private offlineCapability: OfflineCapability | null = null

  /**
   * 判断是否可以使用降级策略
   */
  canFallback(error: LoadError): boolean {
    // 支持所有类型的加载错误
    return error.type === 'MIME_ERROR' || 
           error.type === 'NETWORK_ERROR' ||
           error.type === 'TIMEOUT_ERROR'
  }

  /**
   * 获取降级组件（增强版本）
   */
  async getFallbackComponent(context?: FallbackContext): Promise<FallbackResult> {
    // 更新离线能力状态
    this.offlineCapability = await this.checkOfflineCapabilities()
    
    // 根据错误类型和网络状态选择最佳降级策略
    const strategy = this.selectFallbackStrategy(context)
    
    switch (strategy) {
      case 'cached_component':
        return await this.tryLoadCachedComponent(context)
      
      case 'simplified_component':
        return await this.loadSimplifiedComponent(context)
      
      case 'offline_component':
        return await this.loadOfflineComponent(context)
      
      case 'minimal_inline':
      default:
        return await this.loadMinimalInlineComponent(context)
    }
  }

  /**
   * 检查离线能力
   */
  async checkOfflineCapabilities(): Promise<OfflineCapability> {
    return offlineManager.getOfflineCapability()
  }

  /**
   * 获取缓存的组件
   */
  async getCachedComponent(componentPath: string): Promise<any | null> {
    try {
      // Check if we're in a browser environment with cache API
      if (typeof caches === 'undefined') {
        // In Node.js test environment, return null (no cache available)
        return null
      }
      
      // 检查页面是否在离线缓存中可用
      const isAvailable = await offlineManager.isPageAvailableOffline(componentPath)
      
      if (isAvailable) {
        // 尝试从缓存加载
        const cache = await caches.open('dynamic-v1')
        const response = await cache.match(componentPath)
        
        if (response) {
          const text = await response.text()
          // 这里需要解析组件代码，实际实现中可能需要更复杂的逻辑
          return { cached: true, content: text }
        }
      }
    } catch (error) {
      console.error('Failed to get cached component:', error)
    }
    
    return null
  }

  /**
   * 选择降级策略
   */
  private selectFallbackStrategy(context?: FallbackContext): string {
    if (!context) return 'minimal_inline'
    
    const { error, networkState } = context
    const capability = this.offlineCapability
    
    // 完全离线状态 - 优先处理
    if (!networkState.isOnline) {
      if (capability?.canViewCachedPages) {
        return 'cached_component'
      } else {
        return 'offline_component'
      }
    }
    
    // 网络错误且有离线能力
    if (error.type === 'NETWORK_ERROR' && capability?.canViewCachedPages) {
      return 'cached_component'
    }
    
    // MIME错误或网络质量差
    if (error.type === 'MIME_ERROR' || networkState.quality === 'low') {
      return 'simplified_component'
    }
    
    // 默认最小化组件
    return 'minimal_inline'
  }

  /**
   * 尝试加载缓存的组件
   */
  private async tryLoadCachedComponent(context?: FallbackContext): Promise<FallbackResult> {
    try {
      // 尝试从缓存获取完整组件
      const cachedComponent = await this.getCachedComponent(context?.route || '')
      
      if (cachedComponent) {
        return {
          component: cachedComponent,
          type: 'cached',
          source: 'cache',
          capabilities: ['view_cached_content', 'basic_navigation'],
          limitations: ['no_real_time_updates', 'no_form_submission']
        }
      }
    } catch (error) {
      console.error('Failed to load cached component:', error)
    }
    
    // 缓存加载失败，降级到简化组件
    return await this.loadSimplifiedComponent(context)
  }

  /**
   * 加载简化组件
   */
  private async loadSimplifiedComponent(context?: FallbackContext): Promise<FallbackResult> {
    try {
      // 动态导入简化的事件详情组件
      const { default: SimplifiedEventDetail } = await import('../components/SimplifiedEventDetail.vue')
      
      return {
        component: SimplifiedEventDetail,
        type: 'simplified',
        source: 'network',
        capabilities: [
          'view_basic_info',
          'retry_loading',
          'navigation',
          'offline_detection'
        ],
        limitations: [
          'limited_functionality',
          'no_advanced_features'
        ]
      }
    } catch (error) {
      console.error('Failed to load SimplifiedEventDetail:', error)
      // 简化组件加载失败，使用离线组件
      return await this.loadOfflineComponent(context)
    }
  }

  /**
   * 加载离线组件
   */
  private async loadOfflineComponent(context?: FallbackContext): Promise<FallbackResult> {
    // 创建专门的离线状态组件
    const offlineComponent = {
      template: `
        <div class="offline-fallback">
          <div class="offline-fallback__header">
            <div class="offline-fallback__icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
            </div>
            <h1>离线模式</h1>
            <p>您当前处于离线状态，显示的是缓存内容</p>
          </div>
          
          <div class="offline-fallback__content">
            <div class="offline-card">
              <h3>可用功能</h3>
              <ul class="feature-list">
                <li v-for="feature in availableFeatures" :key="feature">{{ feature }}</li>
              </ul>
            </div>
            
            <div class="offline-card">
              <h3>受限功能</h3>
              <ul class="limitation-list">
                <li v-for="limitation in limitations" :key="limitation">{{ limitation }}</li>
              </ul>
            </div>
            
            <div class="offline-actions">
              <button class="btn btn--primary" @click="checkConnection">检查网络连接</button>
              <button class="btn btn--ghost" @click="goHome">返回首页</button>
            </div>
          </div>
        </div>
      `,
      data() {
        return {
          availableFeatures: [
            '查看缓存的活动信息',
            '浏览本地保存的内容',
            '基本页面导航'
          ],
          limitations: [
            '无法提交表单',
            '无法获取最新数据',
            '无法进行实时交互'
          ]
        }
      },
      methods: {
        checkConnection() {
          if (navigator.onLine) {
            window.location.reload()
          } else {
            alert('仍处于离线状态，请检查网络连接')
          }
        },
        goHome() {
          window.location.href = '/events'
        }
      }
    }

    return {
      component: offlineComponent,
      type: 'simplified',
      source: 'inline',
      capabilities: ['offline_mode', 'cached_content'],
      limitations: ['no_network_features', 'read_only']
    }
  }

  /**
   * 加载最小化内联组件
   */
  private async loadMinimalInlineComponent(context?: FallbackContext): Promise<FallbackResult> {
    const errorType = context?.error.type || 'UNKNOWN'
    const errorMessage = this.getErrorMessage(errorType)
    
    const minimalComponent = {
      template: `
        <div class="minimal-fallback">
          <div class="minimal-fallback__content">
            <div class="error-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h2>{{ errorTitle }}</h2>
            <p>{{ errorMessage }}</p>
            <div class="minimal-actions">
              <button class="btn btn--primary" @click="retry">重新加载</button>
              <button class="btn btn--ghost" @click="goHome">返回首页</button>
            </div>
          </div>
        </div>
      `,
      data() {
        return {
          errorTitle: this.getErrorTitle(errorType),
          errorMessage: errorMessage
        }
      },
      methods: {
        retry() {
          window.location.reload()
        },
        goHome() {
          window.location.href = '/events'
        },
        getErrorTitle(type: string) {
          switch (type) {
            case 'MIME_ERROR':
              return '页面配置错误'
            case 'NETWORK_ERROR':
              return '网络连接问题'
            case 'TIMEOUT_ERROR':
              return '加载超时'
            default:
              return '页面加载失败'
          }
        }
      },
      style: `
        .minimal-fallback {
          min-height: 60vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          text-align: center;
        }
        .minimal-fallback__content {
          max-width: 400px;
        }
        .error-icon {
          color: #e07a5f;
          margin-bottom: 1rem;
        }
        .minimal-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
          margin-top: 2rem;
        }
      `
    }

    return {
      component: minimalComponent,
      type: 'minimal',
      source: 'inline',
      capabilities: ['basic_error_display', 'retry_action'],
      limitations: ['no_data_display', 'minimal_functionality']
    }
  }

  /**
   * 获取错误消息
   */
  private getErrorMessage(errorType: string): string {
    switch (errorType) {
      case 'MIME_ERROR':
        return '页面文件类型配置有误，可能是服务器配置问题。请尝试刷新页面或联系技术支持。'
      case 'NETWORK_ERROR':
        return '网络连接不稳定或服务器暂时不可用。请检查网络连接后重试。'
      case 'TIMEOUT_ERROR':
        return '页面加载时间过长，可能是网络较慢。请稍后重试或检查网络连接。'
      default:
        return '页面加载遇到未知问题。请尝试刷新页面或返回首页。'
    }
  }
}

// ============================================================================
// 离线缓存检测和使用机制
// ============================================================================

export class OfflineCacheManager {
  private cacheVersion = 'v1'
  private cacheName = `event-platform-${this.cacheVersion}`

  /**
   * 检测组件是否有离线缓存
   */
  async hasOfflineCache(componentPath: string): Promise<boolean> {
    try {
      const cache = await caches.open(this.cacheName)
      const response = await cache.match(componentPath)
      return !!response
    } catch (error) {
      console.error('Failed to check offline cache:', error)
      return false
    }
  }

  /**
   * 获取离线缓存的组件
   */
  async getOfflineCachedComponent(componentPath: string): Promise<string | null> {
    try {
      const cache = await caches.open(this.cacheName)
      const response = await cache.match(componentPath)
      
      if (response) {
        return await response.text()
      }
    } catch (error) {
      console.error('Failed to get offline cached component:', error)
    }
    
    return null
  }

  /**
   * 缓存组件到离线存储
   */
  async cacheComponent(componentPath: string, content: string): Promise<void> {
    try {
      const cache = await caches.open(this.cacheName)
      const response = new Response(content, {
        headers: {
          'Content-Type': 'application/javascript',
          'Cache-Control': 'max-age=86400' // 24小时
        }
      })
      
      await cache.put(componentPath, response)
      console.log(`Component cached: ${componentPath}`)
    } catch (error) {
      console.error('Failed to cache component:', error)
    }
  }

  /**
   * 清理过期的缓存
   */
  async cleanupExpiredCache(): Promise<void> {
    try {
      // Check if caches API is available
      if (typeof caches === 'undefined') {
        console.log('Cache API not available, skipping cleanup')
        return
      }
      
      const cacheNames = await caches.keys()
      const oldCaches = cacheNames.filter(name => 
        typeof name === 'string' && 
        name.startsWith('event-platform-') && 
        name !== this.cacheName
      )
      
      await Promise.all(
        oldCaches.map(cacheName => caches.delete(cacheName))
      )
      
      console.log(`Cleaned up ${oldCaches.length} old caches`)
    } catch (error) {
      console.error('Failed to cleanup expired cache:', error)
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats(): Promise<{
    totalCaches: number
    currentCacheSize: number
    cachedComponents: string[]
  }> {
    try {
      const cacheNames = await caches.keys()
      const cache = await caches.open(this.cacheName)
      const cachedRequests = await cache.keys()
      
      return {
        totalCaches: cacheNames.length,
        currentCacheSize: cachedRequests.length,
        cachedComponents: cachedRequests.map(req => req.url)
      }
    } catch (error) {
      console.error('Failed to get cache stats:', error)
      return {
        totalCaches: 0,
        currentCacheSize: 0,
        cachedComponents: []
      }
    }
  }
}

// ============================================================================
// 导出实例和工厂函数
// ============================================================================

export const enhancedFallbackStrategy = new EnhancedFallbackStrategy()
export const offlineCacheManager = new OfflineCacheManager()

/**
 * 创建带有上下文的降级策略
 */
export function createFallbackContext(
  route: string,
  component: string,
  error: LoadError,
  options?: {
    eventId?: string
    userId?: string
  }
): FallbackContext {
  const networkState = gracefulDegradationSystem.getSystemStatus().networkState
  
  return {
    route,
    component,
    error,
    networkState: {
      isOnline: networkState.isOnline,
      quality: networkState.effectiveType || 'unknown'
    },
    ...options
  }
}

/**
 * 便捷的降级组件获取函数
 */
export async function getFallbackComponent(
  error: LoadError,
  context?: Partial<FallbackContext>
): Promise<FallbackResult> {
  const fullContext = context ? {
    route: context.route || window.location.pathname,
    component: context.component || 'unknown',
    error,
    networkState: context.networkState || {
      isOnline: navigator.onLine,
      quality: 'unknown'
    },
    ...context
  } : undefined

  return await enhancedFallbackStrategy.getFallbackComponent(fullContext)
}