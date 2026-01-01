/**
 * 增强的路由系统 - 集成模块加载错误处理
 */

import { type Router, type RouteRecordRaw } from 'vue-router'
import { wrapDynamicImport, createRouteComponentLoader, type ModuleLoadOptions } from './moduleLoadingUtils'
import { moduleLoader } from './moduleLoader'
import { errorHandler } from './errorHandler'

// ============================================================================
// 类型定义
// ============================================================================

export interface EnhancedRouteConfig extends Omit<RouteRecordRaw, 'component'> {
  component?: () => Promise<any>
  moduleLoadOptions?: ModuleLoadOptions
}

export interface RouterEnhancementOptions {
  // Global module loading options
  defaultModuleLoadOptions?: ModuleLoadOptions
  
  // Error handling
  enableGlobalErrorHandling?: boolean
  onModuleLoadError?: (error: Error, route: string) => void
  
  // Performance monitoring
  enablePerformanceMonitoring?: boolean
  onPerformanceMetric?: (metric: PerformanceMetric) => void
}

export interface PerformanceMetric {
  route: string
  loadTime: number
  retryCount: number
  success: boolean
  errorType?: string
}

// ============================================================================
// 路由增强器
// ============================================================================

export class RouterEnhancer {
  private router: Router
  private options: RouterEnhancementOptions
  private performanceMetrics: Map<string, PerformanceMetric> = new Map()

  constructor(router: Router, options: RouterEnhancementOptions = {}) {
    this.router = router
    this.options = {
      enableGlobalErrorHandling: true,
      enablePerformanceMonitoring: true,
      defaultModuleLoadOptions: {
        timeout: 30000,
        maxRetries: 3,
        retryDelay: 1000,
        showErrorDetails: true
      },
      ...options
    }

    this.setupGlobalErrorHandling()
    this.setupPerformanceMonitoring()
  }

  /**
   * 增强路由配置，添加模块加载错误处理
   */
  enhanceRoutes(routes: EnhancedRouteConfig[]): RouteRecordRaw[] {
    return routes.map(route => this.enhanceRoute(route))
  }

  /**
   * 增强单个路由
   */
  enhanceRoute(route: EnhancedRouteConfig): RouteRecordRaw {
    const enhancedRoute: RouteRecordRaw = {
      ...route,
      component: route.component ? this.enhanceComponent(route.component, route.path || '', route.moduleLoadOptions) : undefined
    }

    // Recursively enhance child routes
    if (route.children) {
      enhancedRoute.children = route.children.map(child => 
        this.enhanceRoute(child as EnhancedRouteConfig)
      )
    }

    return enhancedRoute
  }

  /**
   * 增强组件加载器
   */
  private enhanceComponent(
    componentLoader: () => Promise<any>,
    routePath: string,
    routeOptions?: ModuleLoadOptions
  ) {
    const options = {
      ...this.options.defaultModuleLoadOptions,
      ...routeOptions
    }

    return createRouteComponentLoader(
      componentLoader,
      routePath,
      {
        ...options,
        onError: (error) => {
          this.handleModuleLoadError(error, routePath)
          options.onError?.(error)
        },
        onRetry: (attempt) => {
          this.recordPerformanceMetric(routePath, 0, attempt, false)
          options.onRetry?.(attempt)
        }
      }
    )
  }

  /**
   * 设置全局错误处理
   */
  private setupGlobalErrorHandling() {
    if (!this.options.enableGlobalErrorHandling) {
      return
    }

    // Handle router errors
    this.router.onError((error) => {
      console.error('Router error:', error)
      
      errorHandler.handleError(error, {
        operation: 'routeNavigation',
        component: 'enhancedRouter',
        additionalData: {
          currentRoute: this.router.currentRoute.value.fullPath
        }
      })
    })

    // Handle navigation failures
    this.router.afterEach((to, from, failure) => {
      if (failure) {
        console.error('Navigation failure:', failure)
        
        errorHandler.handleError(new Error(`Navigation failed: ${failure.type}`), {
          operation: 'routeNavigation',
          component: 'enhancedRouter',
          additionalData: {
            to: to.fullPath,
            from: from.fullPath,
            failure: failure.type
          }
        })
      }
    })
  }

  /**
   * 设置性能监控
   */
  private setupPerformanceMonitoring() {
    if (!this.options.enablePerformanceMonitoring) {
      return
    }

    this.router.beforeEach((to, from, next) => {
      // Record navigation start time
      const startTime = performance.now()
      to.meta = to.meta || {}
      to.meta.navigationStartTime = startTime
      next()
    })

    this.router.afterEach((to, from) => {
      // Calculate navigation time
      const startTime = to.meta?.navigationStartTime as number
      if (startTime) {
        const loadTime = performance.now() - startTime
        this.recordPerformanceMetric(to.path, loadTime, 0, true)
      }
    })
  }

  /**
   * 处理模块加载错误
   */
  private handleModuleLoadError(error: Error, routePath: string) {
    console.error(`Module load error for route ${routePath}:`, error)

    // Record performance metric
    this.recordPerformanceMetric(routePath, 0, 0, false, this.getErrorType(error))

    // Call custom error handler
    this.options.onModuleLoadError?.(error, routePath)

    // Log to error handler
    errorHandler.handleError(error, {
      operation: 'loadRouteComponent',
      component: 'enhancedRouter',
      additionalData: {
        routePath,
        userAgent: navigator.userAgent
      }
    })
  }

  /**
   * 记录性能指标
   */
  private recordPerformanceMetric(
    route: string,
    loadTime: number,
    retryCount: number,
    success: boolean,
    errorType?: string
  ) {
    const metric: PerformanceMetric = {
      route,
      loadTime,
      retryCount,
      success,
      errorType
    }

    this.performanceMetrics.set(`${route}-${Date.now()}`, metric)

    // Call custom performance handler
    this.options.onPerformanceMetric?.(metric)

    // Log performance data
    if (success) {
      console.log(`Route loaded successfully: ${route} (${loadTime.toFixed(2)}ms)`)
    } else {
      console.warn(`Route load failed: ${route} (retries: ${retryCount}, error: ${errorType})`)
    }
  }

  /**
   * 获取错误类型
   */
  private getErrorType(error: Error): string {
    const message = error.message || ''
    
    if (message.includes('MIME') || message.includes('text/html')) {
      return 'MIME_ERROR'
    }
    if (message.includes('fetch') || message.includes('network')) {
      return 'NETWORK_ERROR'
    }
    if (message.includes('timeout')) {
      return 'TIMEOUT_ERROR'
    }
    
    return 'UNKNOWN'
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(): PerformanceMetric[] {
    return Array.from(this.performanceMetrics.values())
  }

  /**
   * 清除性能指标
   */
  clearPerformanceMetrics() {
    this.performanceMetrics.clear()
  }

  /**
   * 获取路由加载统计
   */
  getRouteLoadStats(): Record<string, { success: number; failed: number; avgLoadTime: number }> {
    const stats: Record<string, { success: number; failed: number; totalLoadTime: number; avgLoadTime: number }> = {}

    for (const metric of this.performanceMetrics.values()) {
      if (!stats[metric.route]) {
        stats[metric.route] = { success: 0, failed: 0, totalLoadTime: 0, avgLoadTime: 0 }
      }

      if (metric.success) {
        stats[metric.route].success++
        stats[metric.route].totalLoadTime += metric.loadTime
      } else {
        stats[metric.route].failed++
      }
    }

    // Calculate averages
    for (const route in stats) {
      const stat = stats[route]
      stat.avgLoadTime = stat.success > 0 ? stat.totalLoadTime / stat.success : 0
      delete (stat as any).totalLoadTime
    }

    return stats
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建增强的路由器
 */
export function createEnhancedRouter(
  router: Router,
  routes: EnhancedRouteConfig[],
  options: RouterEnhancementOptions = {}
): RouterEnhancer {
  const enhancer = new RouterEnhancer(router, options)
  
  // Add enhanced routes to router
  const enhancedRoutes = enhancer.enhanceRoutes(routes)
  enhancedRoutes.forEach(route => {
    router.addRoute(route)
  })

  return enhancer
}

/**
 * 包装现有路由以添加错误处理
 */
export function wrapExistingRoutes(
  router: Router,
  options: RouterEnhancementOptions = {}
): RouterEnhancer {
  return new RouterEnhancer(router, options)
}

/**
 * 为特定路由创建错误处理包装器
 */
export function createErrorHandledRoute(
  path: string,
  componentLoader: () => Promise<any>,
  routeOptions: Partial<RouteRecordRaw> = {},
  moduleLoadOptions: ModuleLoadOptions = {}
): RouteRecordRaw {
  return {
    path,
    ...routeOptions,
    component: createRouteComponentLoader(componentLoader, path, moduleLoadOptions)
  }
}

/**
 * 批量创建错误处理路由
 */
export function createErrorHandledRoutes(
  routeConfigs: Array<{
    path: string
    componentLoader: () => Promise<any>
    routeOptions?: Partial<RouteRecordRaw>
    moduleLoadOptions?: ModuleLoadOptions
  }>
): RouteRecordRaw[] {
  return routeConfigs.map(config =>
    createErrorHandledRoute(
      config.path,
      config.componentLoader,
      config.routeOptions,
      config.moduleLoadOptions
    )
  )
}

// ============================================================================
// 导出默认实例
// ============================================================================

let globalEnhancer: RouterEnhancer | null = null

/**
 * 获取全局路由增强器实例
 */
export function getGlobalRouterEnhancer(): RouterEnhancer | null {
  return globalEnhancer
}

/**
 * 设置全局路由增强器实例
 */
export function setGlobalRouterEnhancer(enhancer: RouterEnhancer): void {
  globalEnhancer = enhancer
}