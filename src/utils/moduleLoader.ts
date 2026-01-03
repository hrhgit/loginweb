/**
 * 增强的模块加载器 - 处理动态模块加载失败问题
 * 
 * 提供MIME类型错误检测、网络错误重试机制和优雅降级策略
 */

import { errorHandler, ErrorType, type ErrorContext } from './errorHandler'
import { enhancedFallbackStrategy, createFallbackContext, type FallbackResult } from './fallbackStrategy'

// ============================================================================
// 类型定义
// ============================================================================

export interface LoadError {
  type: 'MIME_ERROR' | 'NETWORK_ERROR' | 'TIMEOUT_ERROR'
  originalError: Error
  path: string
  retryCount: number
}

export interface ModuleLoadState {
  path: string
  status: 'loading' | 'loaded' | 'error' | 'retrying'
  error?: LoadError
  retryCount: number
  lastAttempt: Date
}

export interface LoadingContext {
  route: string
  component: string
  chunks: string[]
  dependencies: string[]
}

export interface LoadErrorRecord {
  id: string
  timestamp: Date
  userAgent: string
  url: string
  expectedMimeType: string
  actualMimeType: string
  responseStatus: number
  retryAttempts: number
  resolved: boolean
}

export interface ModuleLoader {
  loadModule(path: string): Promise<any>
  retryLoad(path: string, maxRetries: number): Promise<any>
  handleLoadError(error: Error, path: string): void
}

export interface FallbackStrategy {
  canFallback(error: LoadError): boolean
  getFallbackComponent(): Promise<any>
}

// ============================================================================
// MIME类型错误处理器
// ============================================================================

export class MimeTypeErrorHandler {
  /**
   * 检测MIME类型错误
   */
  detectMimeError(response: Response): boolean {
    const contentType = response.headers.get('content-type')
    const url = response.url || ''
    
    // Only detect MIME errors for JavaScript files (ending with .js)
    return contentType?.includes('text/html') && 
           url.endsWith('.js')
  }

  /**
   * 检测错误是否为MIME类型错误
   */
  isMimeError(error: Error): boolean {
    const message = error.message || ''
    return message.includes('Expected a JavaScript') ||
           message.includes('MIME type') ||
           message.includes('text/html') ||
           message.includes('module script')
  }

  /**
   * 处理MIME类型错误
   */
  async handleMimeError(error: Error, path: string): Promise<void> {
    // 记录错误详情
    const errorRecord: LoadErrorRecord = {
      id: `mime-error-${Date.now()}`,
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      url: path,
      expectedMimeType: 'application/javascript',
      actualMimeType: 'text/html',
      responseStatus: 200, // 通常返回200但内容错误
      retryAttempts: 0,
      resolved: false
    }

    // 使用现有的错误处理系统记录
    errorHandler.handleError(error, {
      operation: 'loadModule',
      component: 'moduleLoader',
      additionalData: { path, errorRecord }
    })

    console.error('MIME type error detected:', {
      path,
      error: error.message,
      record: errorRecord
    })
  }
}

// ============================================================================
// 网络错误重试处理器
// ============================================================================

export class NetworkRetryHandler {
  private maxRetries = 3
  private retryDelay = 1000

  /**
   * 检测是否为网络错误
   */
  isNetworkError(error: Error): boolean {
    const message = error.message || ''
    return message.includes('fetch') ||
           message.includes('network') ||
           message.includes('Failed to load') ||
           message.includes('NetworkError') ||
           error.name === 'NetworkError' ||
           error.name === 'TypeError' && message.includes('fetch')
  }

  /**
   * 带重试的加载函数
   */
  async retryLoad(loadFn: () => Promise<any>, path: string): Promise<any> {
    let lastError: Error
    
    for (let i = 0; i < this.maxRetries; i++) {
      try {
        return await loadFn()
      } catch (error) {
        lastError = error as Error
        
        // 记录重试尝试
        errorHandler.handleError(error, {
          operation: 'retryLoad',
          component: 'networkRetryHandler',
          additionalData: { 
            path, 
            attempt: i + 1, 
            maxRetries: this.maxRetries 
          }
        })

        if (i < this.maxRetries - 1) {
          // 指数退避延迟
          const delay = this.retryDelay * Math.pow(2, i)
          await this.delay(delay)
        }
      }
    }
    
    throw new RetryExhaustedError(lastError!, this.maxRetries)
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// ============================================================================
// 优雅降级处理器
// ============================================================================

export class ModuleFallbackHandler implements FallbackStrategy {
  /**
   * 判断是否可以使用降级策略
   */
  canFallback(error: LoadError): boolean {
    return error.type === 'MIME_ERROR' || 
           error.type === 'NETWORK_ERROR'
  }

  /**
   * 获取降级组件
   */
  async getFallbackComponent(): Promise<any> {
    try {
      // 尝试加载简化的事件详情组件
      const { default: SimplifiedEventDetail } = await import('../components/SimplifiedEventDetail.vue')
      return SimplifiedEventDetail
    } catch (error) {
      // 如果连简化组件都无法加载，返回最基本的内联组件
      console.error('Failed to load SimplifiedEventDetail, using inline fallback:', error)
      return {
        template: `
          <div class="module-load-error">
            <div class="module-load-error__content">
              <h3>页面暂时无法加载</h3>
              <p>模块加载遇到问题，请尝试以下操作：</p>
              <div class="module-load-error__actions">
                <button class="btn btn--primary" @click="retry">重新加载</button>
                <button class="btn btn--ghost" @click="goHome">返回首页</button>
              </div>
            </div>
          </div>
        `,
        methods: {
          retry() {
            window.location.reload()
          },
          goHome() {
            window.location.href = '/events'
          }
        },
        style: `
          .module-load-error {
            min-height: 50vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
          }
          .module-load-error__content {
            text-align: center;
            max-width: 400px;
          }
          .module-load-error__actions {
            display: flex;
            gap: 1rem;
            justify-content: center;
            margin-top: 1.5rem;
          }
        `
      }
    }
  }
}

// ============================================================================
// 自定义错误类
// ============================================================================

export class RetryExhaustedError extends Error {
  constructor(
    public originalError: Error,
    public maxRetries: number
  ) {
    super(`重试次数已达上限 (${maxRetries}): ${originalError.message}`)
    this.name = 'RetryExhaustedError'
  }
}

export class ModuleLoadError extends Error {
  constructor(
    public path: string,
    public loadError: LoadError
  ) {
    super(`模块加载失败: ${path} - ${loadError.originalError.message}`)
    this.name = 'ModuleLoadError'
  }
}

// ============================================================================
// 增强的模块加载器主类
// ============================================================================

export class EnhancedModuleLoader implements ModuleLoader {
  private mimeHandler = new MimeTypeErrorHandler()
  private retryHandler = new NetworkRetryHandler()
  private fallbackHandler = enhancedFallbackStrategy
  private loadStates = new Map<string, ModuleLoadState>()

  /**
   * 加载模块的主要方法
   */
  async loadModule(path: string): Promise<any> {
    const loadState: ModuleLoadState = {
      path,
      status: 'loading',
      retryCount: 0,
      lastAttempt: new Date()
    }

    this.loadStates.set(path, loadState)

    try {
      // 尝试加载模块
      const module = await this.attemptLoad(path)
      
      // 加载成功
      loadState.status = 'loaded'
      this.loadStates.set(path, loadState)
      
      return module
    } catch (error) {
      const loadError = this.createLoadError(error as Error, path, 0)
      loadState.error = loadError
      loadState.status = 'error'
      this.loadStates.set(path, loadState)

      // 处理加载错误
      await this.handleLoadError(error as Error, path)
      
      throw new ModuleLoadError(path, loadError)
    }
  }

  /**
   * 带重试的模块加载
   */
  async retryLoad(path: string, maxRetries: number = 3): Promise<any> {
    const loadState = this.loadStates.get(path) || {
      path,
      status: 'retrying',
      retryCount: 0,
      lastAttempt: new Date()
    }

    loadState.status = 'retrying'
    this.loadStates.set(path, loadState)

    try {
      const module = await this.retryHandler.retryLoad(
        () => this.attemptLoad(path),
        path
      )

      // 重试成功
      loadState.status = 'loaded'
      loadState.retryCount = 0
      this.loadStates.set(path, loadState)

      return module
    } catch (error) {
      const loadError = this.createLoadError(error as Error, path, maxRetries)
      loadState.error = loadError
      loadState.status = 'error'
      loadState.retryCount = maxRetries
      this.loadStates.set(path, loadState)

      // 尝试降级策略
      if (this.fallbackHandler.canFallback(loadError)) {
        console.warn(`使用降级策略加载模块: ${path}`)
        
        // 创建降级上下文
        const fallbackContext = createFallbackContext(
          path,
          'module',
          loadError,
          { eventId: this.extractEventId(path) }
        )
        
        const fallbackResult = await this.fallbackHandler.getFallbackComponent(fallbackContext)
        
        // 记录降级策略使用情况
        errorHandler.handleError(error as Error, {
          operation: 'fallback_strategy_used',
          component: 'moduleLoader',
          additionalData: { 
            path, 
            fallbackType: fallbackResult.type,
            fallbackSource: fallbackResult.source,
            capabilities: fallbackResult.capabilities,
            limitations: fallbackResult.limitations
          }
        })
        
        return fallbackResult.component
      }

      throw new ModuleLoadError(path, loadError)
    }
  }

  /**
   * 处理加载错误
   */
  async handleLoadError(error: Error, path: string): Promise<void> {
    // 检测MIME类型错误
    if (this.mimeHandler.isMimeError(error)) {
      await this.mimeHandler.handleMimeError(error, path)
      return
    }

    // 检测网络错误
    if (this.retryHandler.isNetworkError(error)) {
      errorHandler.handleError(error, {
        operation: 'loadModule',
        component: 'moduleLoader',
        additionalData: { path, errorType: 'network' }
      })
      return
    }

    // 其他错误
    errorHandler.handleError(error, {
      operation: 'loadModule',
      component: 'moduleLoader',
      additionalData: { path, errorType: 'unknown' }
    })
  }

  /**
   * 获取模块加载状态
   */
  getLoadState(path: string): ModuleLoadState | undefined {
    return this.loadStates.get(path)
  }

  /**
   * 清除加载状态
   */
  clearLoadState(path: string): void {
    this.loadStates.delete(path)
  }

  /**
   * 获取所有加载状态
   */
  getAllLoadStates(): Map<string, ModuleLoadState> {
    return new Map(this.loadStates)
  }

  /**
   * 尝试加载模块
   */
  private async attemptLoad(path: string): Promise<any> {
    try {
      // 使用动态导入加载模块
      const module = await import(/* @vite-ignore */ path)
      return module
    } catch (error) {
      // 增强错误信息
      const enhancedError = new Error(
        `Failed to load module "${path}": ${(error as Error).message}`
      )
      enhancedError.stack = (error as Error).stack
      throw enhancedError
    }
  }

  /**
   * 从路径中提取事件ID
   */
  private extractEventId(path: string): string | undefined {
    // 尝试从路径中提取事件ID
    const eventIdMatch = path.match(/\/events\/([^\/]+)/)
    return eventIdMatch ? eventIdMatch[1] : undefined
  }

  /**
   * 创建加载错误对象
   */
  private createLoadError(error: Error, path: string, retryCount: number): LoadError {
    let errorType: LoadError['type'] = 'NETWORK_ERROR'

    if (this.mimeHandler.isMimeError(error)) {
      errorType = 'MIME_ERROR'
    } else if (error.message.includes('timeout') || error.message.includes('超时')) {
      errorType = 'TIMEOUT_ERROR'
    }

    return {
      type: errorType,
      originalError: error,
      path,
      retryCount
    }
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const moduleLoader = new EnhancedModuleLoader()
export const mimeTypeErrorHandler = new MimeTypeErrorHandler()
export const networkRetryHandler = new NetworkRetryHandler()

// 导出增强的降级策略
export { enhancedFallbackStrategy as moduleFallbackHandler } from './fallbackStrategy'
