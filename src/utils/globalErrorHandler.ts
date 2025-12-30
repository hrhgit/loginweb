/**
 * 全局错误处理器
 * 
 * 自动捕获浏览器中未处理的错误和Promise拒绝，并记录到错误日志系统
 */

import { errorLogManager, createErrorRecord } from './errorLogManager'
import { ErrorType, MessageSeverity } from './errorHandler'

/**
 * 设置全局错误处理
 */
export function setupGlobalErrorHandling(): void {
  // 捕获JavaScript运行时错误
  window.addEventListener('error', (event) => {
    const error = event.error || new Error(event.message)
    
    const errorRecord = createErrorRecord(
      error,
      {
        operation: 'global_error',
        component: 'window',
        additionalData: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          source: event.source?.toString(),
          stack: error.stack
        }
      },
      ErrorType.CLIENT,
      MessageSeverity.ERROR
    )
    
    errorLogManager.addRecord(errorRecord)
    
    console.error('Global error caught:', error)
  })

  // 捕获未处理的Promise拒绝
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error 
      ? event.reason 
      : new Error(String(event.reason))
    
    const errorRecord = createErrorRecord(
      error,
      {
        operation: 'unhandled_promise_rejection',
        component: 'promise',
        additionalData: {
          reason: event.reason,
          promise: event.promise?.toString(),
          stack: error.stack
        }
      },
      ErrorType.CLIENT,
      MessageSeverity.ERROR
    )
    
    errorLogManager.addRecord(errorRecord)
    
    console.error('Unhandled promise rejection caught:', event.reason)
    
    // 阻止默认的控制台错误输出（可选）
    // event.preventDefault()
  })

  // 捕获资源加载错误（图片、脚本等）
  window.addEventListener('error', (event) => {
    // 只处理资源加载错误，不是JavaScript错误
    if (event.target && event.target !== window) {
      const target = event.target as HTMLElement
      const errorRecord = createErrorRecord(
        new Error(`Resource failed to load: ${target.tagName}`),
        {
          operation: 'resource_load_error',
          component: 'resource',
          additionalData: {
            tagName: target.tagName,
            src: (target as any).src || (target as any).href,
            outerHTML: target.outerHTML
          }
        },
        ErrorType.NETWORK,
        MessageSeverity.WARNING
      )
      
      errorLogManager.addRecord(errorRecord)
      
      console.warn('Resource load error caught:', target)
    }
  }, true) // 使用捕获阶段
}

/**
 * 手动记录错误（供其他模块使用）
 */
export function logGlobalError(
  error: Error | string,
  context: {
    operation: string
    component: string
    additionalData?: any
  },
  type: ErrorType = ErrorType.CLIENT,
  severity: MessageSeverity = MessageSeverity.ERROR
): void {
  const errorRecord = createErrorRecord(
    error,
    context,
    type,
    severity
  )
  
  errorLogManager.addRecord(errorRecord)
}

/**
 * 网络错误专用记录函数
 */
export function logNetworkError(
  error: Error | string,
  url: string,
  method: string = 'GET',
  status?: number
): void {
  logGlobalError(
    error,
    {
      operation: 'network_request',
      component: 'fetch',
      additionalData: {
        url,
        method,
        status,
        timestamp: new Date().toISOString()
      }
    },
    ErrorType.NETWORK,
    MessageSeverity.ERROR
  )
}

/**
 * 数据库错误专用记录函数
 */
export function logDatabaseError(
  error: Error | string,
  operation: string,
  table?: string,
  query?: any
): void {
  logGlobalError(
    error,
    {
      operation: `database_${operation}`,
      component: 'supabase',
      additionalData: {
        table,
        query: typeof query === 'object' ? JSON.stringify(query) : query,
        timestamp: new Date().toISOString()
      }
    },
    ErrorType.SERVER,
    MessageSeverity.ERROR
  )
}