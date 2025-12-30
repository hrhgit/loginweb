/**
 * 错误消息反馈系统增强 - Store集成模块
 * 
 * 提供与现有appStore.ts集成的增强错误处理功能
 */

import { errorHandler } from '../utils/errorHandler'
import type { ErrorContext, ErrorResponse } from '../utils/errorHandler'

// 扩展现有的setBanner功能
export interface EnhancedBannerOptions {
  context?: ErrorContext
  canRetry?: boolean
  onRetry?: () => void
  suggestions?: string[]
  duration?: number
}

/**
 * 增强的错误处理类，集成到现有store系统
 */
export class EnhancedErrorHandler {
  private bannerCallback: ((type: 'info' | 'error', text: string) => void) | null = null
  private lastErrorTime: Map<string, number> = new Map()
  private readonly DUPLICATE_THRESHOLD = 5000 // 5秒内的重复消息将被合并

  /**
   * 设置setBanner回调函数
   */
  setBannerCallback(callback: (type: 'info' | 'error', text: string) => void) {
    this.bannerCallback = callback
  }

  /**
   * 处理错误并显示用户友好的消息
   */
  handleError(error: any, context?: ErrorContext, options?: EnhancedBannerOptions): ErrorResponse {
    // 使用核心错误处理API
    const errorResponse = errorHandler.handleError(error, context)
    
    // 检查重复消息合并
    if (this.isDuplicateMessage(errorResponse, context)) {
      console.log('Duplicate error message suppressed:', errorResponse.id)
      return errorResponse
    }

    // 显示用户友好的消息
    this.showUserMessage(errorResponse, options)

    return errorResponse
  }

  /**
   * 处理成功消息
   */
  handleSuccess(message: string, context?: ErrorContext): void {
    const contextualMessage = this.contextualizeSuccessMessage(message, context)
    
    if (this.bannerCallback) {
      this.bannerCallback('info', contextualMessage)
    }
  }

  /**
   * 处理信息消息
   */
  handleInfo(message: string, context?: ErrorContext): void {
    const contextualMessage = this.contextualizeInfoMessage(message, context)
    
    if (this.bannerCallback) {
      this.bannerCallback('info', contextualMessage)
    }
  }

  /**
   * 创建带上下文的错误处理函数
   */
  createContextualHandler(defaultContext: Partial<ErrorContext>) {
    return (error: any, additionalContext?: Partial<ErrorContext>, options?: EnhancedBannerOptions) => {
      const mergedContext: ErrorContext = {
        operation: defaultContext.operation || 'unknown',
        component: defaultContext.component || 'unknown',
        ...additionalContext
      }
      
      return this.handleError(error, mergedContext, options)
    }
  }

  /**
   * 为特定操作创建错误处理器
   */
  createOperationHandler(operation: string, component: string) {
    return {
      handleError: (error: any, additionalContext?: Partial<ErrorContext>, options?: EnhancedBannerOptions) => {
        const context: ErrorContext = {
          operation,
          component,
          ...additionalContext
        }
        return this.handleError(error, context, options)
      },
      
      handleSuccess: (message: string, additionalContext?: Partial<ErrorContext>) => {
        const context: ErrorContext = {
          operation,
          component,
          ...additionalContext
        }
        this.handleSuccess(message, context)
      },
      
      handleInfo: (message: string, additionalContext?: Partial<ErrorContext>) => {
        const context: ErrorContext = {
          operation,
          component,
          ...additionalContext
        }
        this.handleInfo(message, context)
      }
    }
  }

  private isDuplicateMessage(errorResponse: ErrorResponse, context?: ErrorContext): boolean {
    const now = Date.now()
    const messageKey = this.generateMessageKey(errorResponse, context)
    
    const lastTime = this.lastErrorTime.get(messageKey)
    if (lastTime && (now - lastTime) < this.DUPLICATE_THRESHOLD) {
      return true
    }

    this.lastErrorTime.set(messageKey, now)
    
    // 清理过期的消息记录
    for (const [key, time] of this.lastErrorTime.entries()) {
      if (now - time > this.DUPLICATE_THRESHOLD) {
        this.lastErrorTime.delete(key)
      }
    }

    return false
  }

  private generateMessageKey(errorResponse: ErrorResponse, context?: ErrorContext): string {
    const operation = context?.operation || 'unknown'
    const component = context?.component || 'unknown'
    const batchIndex = context?.additionalData?.batchIndex
    
    // 如果是批量操作，包含批次索引以避免重复抑制
    if (batchIndex !== undefined) {
      return `${errorResponse.type}-${operation}-${component}-${batchIndex}`
    }
    
    return `${errorResponse.type}-${operation}-${component}`
  }

  private showUserMessage(errorResponse: ErrorResponse, options?: EnhancedBannerOptions): void {
    if (!this.bannerCallback) {
      console.warn('setBannerCallback not set, cannot display user message')
      return
    }

    // 根据错误严重程度选择消息类型
    const messageType = this.mapSeverityToBannerType(errorResponse.severity)
    
    // 构建完整的用户消息
    let userMessage = errorResponse.message
    
    // 如果有建议，添加到消息中（可选）
    if (options?.suggestions && options.suggestions.length > 0) {
      // 这里可以选择是否在banner中显示建议，或者通过其他UI组件显示
      // 为了保持banner简洁，我们暂时不在这里添加建议
    }

    this.bannerCallback(messageType, userMessage)
  }

  private mapSeverityToBannerType(severity: string): 'info' | 'error' {
    switch (severity) {
      case 'fatal':
      case 'warning':
        return 'error'
      case 'info':
      case 'success':
        return 'info'
      default:
        return 'error'
    }
  }

  private contextualizeSuccessMessage(message: string, context?: ErrorContext): string {
    if (!context) return message

    // 根据操作类型调整成功消息
    const operationMessages: Record<string, string> = {
      'auth': '登录成功',
      'login': '登录成功',
      'save': '保存成功',
      'form': '保存成功',
      'upload': '上传成功',
      'delete': '删除成功',
      'create': '创建成功',
      'update': '更新成功'
    }

    const operationMessage = operationMessages[context.operation]
    if (operationMessage) {
      return operationMessage
    }

    return message
  }

  private contextualizeInfoMessage(message: string, context?: ErrorContext): string {
    if (!context) return message

    // 根据组件类型调整信息消息
    if (context.component === 'auth' && message.includes('请先登录')) {
      return '请先登录后继续操作'
    }

    if (context.component === 'form' && message.includes('请填写')) {
      return '请完善表单信息'
    }

    return message
  }
}

// 创建单例实例
export const enhancedErrorHandler = new EnhancedErrorHandler()

// 便捷的工厂函数
export function createErrorHandler(operation: string, component: string) {
  return enhancedErrorHandler.createOperationHandler(operation, component)
}

// 常用的错误处理器
export const authErrorHandler = createErrorHandler('auth', 'authentication')
export const formErrorHandler = createErrorHandler('form', 'form')
export const apiErrorHandler = createErrorHandler('api', 'network')
export const uploadErrorHandler = createErrorHandler('upload', 'file')
export const teamErrorHandler = createErrorHandler('team', 'team')
export const eventErrorHandler = createErrorHandler('event', 'event')
export const profileErrorHandler = createErrorHandler('profile', 'profile')

/**
 * 用于替换现有setBanner调用的便捷函数
 */
export function handleErrorWithBanner(
  error: any, 
  setBanner: (type: 'info' | 'error', text: string) => void,
  context?: ErrorContext,
  options?: EnhancedBannerOptions
): ErrorResponse {
  // 设置setBanner回调
  enhancedErrorHandler.setBannerCallback(setBanner)
  
  // 处理错误
  return enhancedErrorHandler.handleError(error, context, options)
}

/**
 * 用于替换现有成功消息的便捷函数
 */
export function handleSuccessWithBanner(
  message: string,
  setBanner: (type: 'info' | 'error', text: string) => void,
  context?: ErrorContext
): void {
  // 设置setBanner回调
  enhancedErrorHandler.setBannerCallback(setBanner)
  
  // 处理成功消息
  enhancedErrorHandler.handleSuccess(message, context)
}