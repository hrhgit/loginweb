/**
 * 模块加载工具函数 - 为动态导入提供错误处理包装
 */

import { defineAsyncComponent, type AsyncComponentLoader, type Component } from 'vue'
import ModuleLoadErrorWrapper from '../components/feedback/ModuleLoadErrorWrapper.vue'
import ModuleLoadErrorPage from '../components/feedback/ModuleLoadErrorPage.vue'
import { moduleLoader, type LoadError } from './moduleLoader'
import { errorHandler } from './errorHandler'

// ============================================================================
// 类型定义
// ============================================================================

export interface ModuleLoadOptions {
  // Loading configuration
  timeout?: number
  maxRetries?: number
  retryDelay?: number
  
  // UI configuration
  showErrorDetails?: boolean
  showLoadingIndicator?: boolean
  
  // Error handling
  onError?: (error: Error | LoadError) => void
  onRetry?: (attempt: number) => void
  onTimeout?: () => void
  
  // Fallback configuration
  fallbackComponent?: Component
  enableFallback?: boolean
}

export interface EnhancedAsyncComponentOptions extends ModuleLoadOptions {
  // Vue async component options
  loadingComponent?: Component
  errorComponent?: Component
  delay?: number
  suspensible?: boolean
}

// ============================================================================
// 增强的动态导入包装器
// ============================================================================

/**
 * 包装动态导入，添加错误处理和重试机制
 */
export function wrapDynamicImport<T = any>(
  importFn: () => Promise<T>,
  modulePath?: string,
  options: ModuleLoadOptions = {}
): () => Promise<T> {
  return async (): Promise<T> => {
    const {
      timeout = 30000,
      maxRetries = 3,
      retryDelay = 1000,
      onError,
      onRetry,
      onTimeout
    } = options

    let retryCount = 0
    let lastError: Error

    const attemptLoad = async (): Promise<T> => {
      try {
        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            const timeoutError = new Error(`Module loading timeout after ${timeout}ms: ${modulePath}`)
            reject(timeoutError)
          }, timeout)
        })

        // Race between import and timeout
        const result = await Promise.race([
          importFn(),
          timeoutPromise
        ])

        return result
      } catch (error) {
        const loadError = error as Error
        
        // Handle timeout specifically
        if (loadError.message.includes('timeout')) {
          onTimeout?.()
        }

        // Log error
        errorHandler.handleError(loadError, {
          operation: 'dynamicImport',
          component: 'moduleLoadingUtils',
          additionalData: {
            modulePath,
            retryCount,
            maxRetries
          }
        })

        throw loadError
      }
    }

    // Retry loop
    while (retryCount <= maxRetries) {
      try {
        return await attemptLoad()
      } catch (error) {
        lastError = error as Error
        retryCount++

        // If we've exceeded max retries, throw the error
        if (retryCount > maxRetries) {
          onError?.(lastError)
          throw lastError
        }

        // Call retry callback
        onRetry?.(retryCount)

        // Wait before retrying
        if (retryDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, retryDelay))
        }
      }
    }

    // This should never be reached, but TypeScript requires it
    throw lastError!
  }
}

/**
 * 创建带错误处理的异步组件
 */
export function createEnhancedAsyncComponent(
  loader: AsyncComponentLoader,
  modulePath?: string,
  options: EnhancedAsyncComponentOptions = {}
): Component {
  const {
    timeout = 30000,
    maxRetries = 3,
    retryDelay = 1000,
    showErrorDetails = true,
    loadingComponent,
    errorComponent,
    delay = 200,
    suspensible = false,
    onError,
    onRetry,
    onTimeout
  } = options

  // Wrap the loader with error handling
  const enhancedLoader = wrapDynamicImport(loader, modulePath, {
    timeout,
    maxRetries,
    retryDelay,
    showErrorDetails,
    onError,
    onRetry,
    onTimeout
  })

  return defineAsyncComponent({
    loader: enhancedLoader,
    loadingComponent: loadingComponent,
    errorComponent: errorComponent || ModuleLoadErrorPage,
    delay,
    timeout,
    suspensible,
    onError: (error, retry, fail, attempts) => {
      console.error(`Async component load failed (attempt ${attempts}):`, error)
      
      // Call custom error handler
      onError?.(error)
      
      // Retry if within limits
      if (attempts <= maxRetries) {
        onRetry?.(attempts)
        setTimeout(retry, retryDelay)
      } else {
        fail()
      }
    }
  })
}

/**
 * 创建模块加载错误页面组件
 */
export function createModuleErrorComponent(
  error: Error | LoadError,
  modulePath?: string,
  options: ModuleLoadOptions = {}
): Component {
  return {
    name: 'ModuleLoadError',
    render() {
      return h(ModuleLoadErrorPage, {
        error,
        modulePath,
        errorType: getErrorType(error),
        maxRetries: options.maxRetries || 3,
        showDetails: options.showErrorDetails !== false,
        showNetworkStatus: true,
        showTimeout: error.message?.includes('timeout') || false,
        onRetry: async () => {
          // Attempt to reload the current route
          const router = this.$router
          if (router) {
            await router.replace(router.currentRoute.value.fullPath)
          } else {
            window.location.reload()
          }
        },
        onRefresh: () => {
          window.location.reload()
        },
        onGoHome: () => {
          const router = this.$router
          if (router) {
            router.push('/events')
          } else {
            window.location.href = '/events'
          }
        }
      })
    }
  }
}

/**
 * 为路由创建带错误处理的组件加载器
 */
export function createRouteComponentLoader(
  importFn: () => Promise<any>,
  routePath: string,
  options: ModuleLoadOptions = {}
): () => Promise<Component> {
  return wrapDynamicImport(async () => {
    try {
      const module = await importFn()
      return module.default || module
    } catch (error) {
      console.error(`Failed to load route component for ${routePath}:`, error)
      
      // Return error component instead of throwing
      return createModuleErrorComponent(
        error as Error,
        routePath,
        options
      )
    }
  }, routePath, options)
}

/**
 * 批量包装路由组件
 */
export function wrapRouteComponents(
  routes: Record<string, () => Promise<any>>,
  options: ModuleLoadOptions = {}
): Record<string, () => Promise<Component>> {
  const wrappedRoutes: Record<string, () => Promise<Component>> = {}

  for (const [routeName, importFn] of Object.entries(routes)) {
    wrappedRoutes[routeName] = createRouteComponentLoader(
      importFn,
      routeName,
      options
    )
  }

  return wrappedRoutes
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 从错误对象中确定错误类型
 */
function getErrorType(error: Error | LoadError): 'MIME_ERROR' | 'NETWORK_ERROR' | 'TIMEOUT_ERROR' | 'UNKNOWN' {
  if ('type' in error) {
    return error.type
  }

  const message = error.message || ''
  
  if (message.includes('MIME') || message.includes('text/html') || message.includes('Expected a JavaScript')) {
    return 'MIME_ERROR'
  }
  
  if (message.includes('fetch') || message.includes('network') || message.includes('NetworkError')) {
    return 'NETWORK_ERROR'
  }
  
  if (message.includes('timeout')) {
    return 'TIMEOUT_ERROR'
  }
  
  return 'UNKNOWN'
}

/**
 * 检查是否为模块加载错误
 */
export function isModuleLoadError(error: any): error is LoadError {
  return error && typeof error === 'object' && 'type' in error && 'originalError' in error
}

/**
 * 创建模块加载错误
 */
export function createModuleLoadError(
  originalError: Error,
  path: string,
  retryCount: number = 0
): LoadError {
  return {
    type: getErrorType(originalError),
    originalError,
    path,
    retryCount
  }
}

/**
 * 格式化模块加载错误消息
 */
export function formatModuleLoadError(error: Error | LoadError): string {
  if (isModuleLoadError(error)) {
    switch (error.type) {
      case 'MIME_ERROR':
        return `模块加载失败：服务器返回了错误的文件类型 (${error.path})`
      case 'NETWORK_ERROR':
        return `模块加载失败：网络连接错误 (${error.path})`
      case 'TIMEOUT_ERROR':
        return `模块加载失败：加载超时 (${error.path})`
      default:
        return `模块加载失败：未知错误 (${error.path})`
    }
  }

  return error.message || '模块加载失败：未知错误'
}

// ============================================================================
// Vue 3 Composition API 集成
// ============================================================================

import { ref, computed, type Ref } from 'vue'
import { h } from 'vue'

/**
 * 用于组件中处理模块加载的组合函数
 */
export function useModuleLoader(options: ModuleLoadOptions = {}) {
  const isLoading = ref(false)
  const error = ref<Error | LoadError | null>(null)
  const retryCount = ref(0)

  const hasError = computed(() => error.value !== null)
  const canRetry = computed(() => retryCount.value < (options.maxRetries || 3))

  const loadModule = async (importFn: () => Promise<any>, modulePath?: string) => {
    isLoading.value = true
    error.value = null

    try {
      const wrappedLoader = wrapDynamicImport(importFn, modulePath, {
        ...options,
        onError: (err) => {
          error.value = err
          options.onError?.(err)
        },
        onRetry: (attempt) => {
          retryCount.value = attempt
          options.onRetry?.(attempt)
        }
      })

      const result = await wrappedLoader()
      retryCount.value = 0
      return result
    } catch (err) {
      error.value = err as Error
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const retry = async (importFn: () => Promise<any>, modulePath?: string) => {
    if (!canRetry.value) {
      throw new Error('已达到最大重试次数')
    }

    return loadModule(importFn, modulePath)
  }

  const reset = () => {
    isLoading.value = false
    error.value = null
    retryCount.value = 0
  }

  return {
    isLoading: isLoading as Ref<boolean>,
    error: error as Ref<Error | LoadError | null>,
    retryCount: retryCount as Ref<number>,
    hasError,
    canRetry,
    loadModule,
    retry,
    reset
  }
}