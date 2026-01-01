/**
 * 错误消息反馈系统增强 - 核心错误处理基础设施
 * 
 * 提供统一的错误处理API、错误分类器、消息本地化器和重试机制
 */

// ============================================================================
// 类型定义
// ============================================================================

export const ErrorType = {
  NETWORK: 'network',
  PERMISSION: 'permission', 
  VALIDATION: 'validation',
  TIMEOUT: 'timeout',
  SERVER: 'server',
  CLIENT: 'client',
  UNKNOWN: 'unknown'
} as const

export type ErrorType = typeof ErrorType[keyof typeof ErrorType]

export const MessageSeverity = {
  FATAL: 'fatal',
  WARNING: 'warning', 
  INFO: 'info',
  SUCCESS: 'success'
} as const

export type MessageSeverity = typeof MessageSeverity[keyof typeof MessageSeverity]

export const MessageType = {
  SUCCESS: 'success',
  INFO: 'info',
  WARNING: 'warning', 
  ERROR: 'error',
  CRITICAL: 'critical'
} as const

export type MessageType = typeof MessageType[keyof typeof MessageType]

export interface ErrorContext {
  operation: string
  component: string
  userId?: string
  additionalData?: Record<string, any>
}

export interface ErrorResponse {
  id: string
  type: ErrorType
  message: string
  canRetry: boolean
  severity: MessageSeverity
  suggestions?: string[]
}

export interface ErrorClassification {
  type: ErrorType
  category: MessageSeverity
  isRetryable: boolean
  severity: MessageSeverity
  originalError: any
}

export interface LocalizedMessage {
  title: string
  message: string
  suggestions: string[]
  actionText?: string
}

export interface RetryOptions {
  maxAttempts: number
  baseDelay: number
  backoffMultiplier: number
  timeout: number
}

export interface RetryableOperation {
  execute(): Promise<any>
  retry(): Promise<any>
  canRetry(): boolean
  getAttemptCount(): number
}

export interface BannerMessage {
  id: string
  type: MessageType
  title?: string
  message: string
  duration?: number
  canRetry?: boolean
  onRetry?: () => void
  suggestions?: string[]
  icon?: string
}

export interface MessageOptions {
  duration?: number
  canRetry?: boolean
  onRetry?: () => void
  suggestions?: string[]
}

export interface ErrorRecord {
  id: string
  timestamp: Date
  type: ErrorType
  severity: MessageSeverity
  message: string
  originalError: any
  context: ErrorContext
  retryCount: number
  userAgent: string
}

export interface MessageConfig {
  type: MessageType
  duration: number
  showIcon: boolean
  allowDismiss: boolean
  showRetry: boolean
  maxRetries: number
}

// ============================================================================
// 错误分类器
// ============================================================================

export class ErrorClassifier {
  /**
   * 分类错误并确定处理策略
   */
  classifyError(error: any): ErrorClassification {
    if (!error) {
      return {
        type: ErrorType.UNKNOWN,
        category: MessageSeverity.WARNING,
        isRetryable: false,
        severity: MessageSeverity.WARNING,
        originalError: error
      }
    }

    // 超时错误 - 需要在网络错误之前检查
    if (this.isTimeoutError(error)) {
      return {
        type: ErrorType.TIMEOUT,
        category: MessageSeverity.WARNING,
        isRetryable: true,
        severity: MessageSeverity.WARNING,
        originalError: error
      }
    }

    // 网络错误
    if (this.isNetworkError(error)) {
      return {
        type: ErrorType.NETWORK,
        category: MessageSeverity.WARNING,
        isRetryable: true,
        severity: MessageSeverity.WARNING,
        originalError: error
      }
    }

    // 权限错误
    if (this.isPermissionError(error)) {
      return {
        type: ErrorType.PERMISSION,
        category: MessageSeverity.FATAL,
        isRetryable: false,
        severity: MessageSeverity.FATAL,
        originalError: error
      }
    }

    // 验证错误
    if (this.isValidationError(error)) {
      return {
        type: ErrorType.VALIDATION,
        category: MessageSeverity.WARNING,
        isRetryable: false,
        severity: MessageSeverity.WARNING,
        originalError: error
      }
    }

    // 服务器错误
    if (this.isServerError(error)) {
      return {
        type: ErrorType.SERVER,
        category: MessageSeverity.FATAL,
        isRetryable: true,
        severity: MessageSeverity.FATAL,
        originalError: error
      }
    }

    // 客户端错误
    if (this.isClientError(error)) {
      return {
        type: ErrorType.CLIENT,
        category: MessageSeverity.FATAL,
        isRetryable: false,
        severity: MessageSeverity.FATAL,
        originalError: error
      }
    }

    // 默认为未知错误
    return {
      type: ErrorType.UNKNOWN,
      category: MessageSeverity.WARNING,
      isRetryable: false,
      severity: MessageSeverity.WARNING,
      originalError: error
    }
  }

  /**
   * 判断错误是否可重试
   */
  isRetryable(error: any): boolean {
    const classification = this.classifyError(error)
    return classification.isRetryable
  }

  /**
   * 获取错误严重程度
   */
  getSeverity(error: any): MessageSeverity {
    const classification = this.classifyError(error)
    return classification.severity
  }

  private safeGetMessage(error: any): string {
    if (!error) return ''
    
    // 如果有 message 属性，使用它
    if (typeof error.message === 'string') {
      return error.message
    }
    
    // 如果是字符串，直接返回
    if (typeof error === 'string') {
      return error
    }
    
    // 如果有 toString 方法，使用它
    if (error && typeof error.toString === 'function') {
      try {
        return error.toString()
      } catch {
        return ''
      }
    }
    
    // 最后尝试 JSON.stringify
    try {
      return JSON.stringify(error)
    } catch {
      return ''
    }
  }

  private isNetworkError(error: any): boolean {
    if (!error) return false
    const message = this.safeGetMessage(error)
    return message.includes('网络') || 
           message.includes('连接') || 
           message.includes('fetch') ||
           message.includes('NetworkError') ||
           error.code === 'NETWORK_ERROR' ||
           error.code === 'CONNECTION_FAILED' ||
           message.includes('Failed to fetch') ||
           message.includes('Connection') ||
           message.includes('DNS') ||
           message.includes('internet')
  }

  private isPermissionError(error: any): boolean {
    if (!error) return false
    const message = this.safeGetMessage(error)
    return message.includes('permission') || 
           message.includes('权限') || 
           message.includes('Permission denied') ||
           message.includes('Access denied') ||
           message.includes('Insufficient privileges') ||
           message.includes('Authentication failed') ||
           message.includes('认证失败') ||
           message.includes('登录失败') ||
           message.includes('Invalid credentials') ||
           message.includes('Session expired') ||
           message.includes('Account locked') ||
           error.code === '42501' ||
           error.code === 'PERMISSION_DENIED' ||
           error.code === 'AUTH_ERROR' ||
           error.code === 'SESSION_EXPIRED' ||
           error.code === 'ACCOUNT_LOCKED' ||
           error.code === '401' ||
           error.code === '403' ||
           error.status === 401 ||
           error.status === 403 ||
           message.includes('unauthorized') ||
           message.includes('forbidden') ||
           message.includes('Forbidden') ||
           message.includes('Unauthorized') ||
           message.includes('access denied') ||
           message.includes('insufficient privileges') ||
           message.includes('authentication')
  }

  private isValidationError(error: any): boolean {
    if (!error) return false
    const message = this.safeGetMessage(error)
    return message.includes('validation') ||
           message.includes('验证') ||
           message.includes('invalid') ||
           message.includes('required') ||
           message.includes('格式') ||
           message.includes('字段') ||
           message.includes('must be') ||
           message.includes('at least') ||
           message.includes('characters') ||
           message.includes('format') ||
           message.includes('email') ||
           message.includes('password') ||
           message.includes('phone') ||
           message.includes('用户名') ||
           message.includes('邮箱') ||
           message.includes('密码') ||
           message.includes('手机') ||
           message.includes('输入') ||
           message.includes('表单') ||
           message.includes('必填') ||
           message.includes('年龄') ||
           message.includes('日期') ||
           message.includes('数字') ||
           message.includes('必须') ||
           error.code === 'VALIDATION_ERROR'
  }

  private isTimeoutError(error: any): boolean {
    if (!error) return false
    const message = this.safeGetMessage(error)
    return message.includes('timeout') ||
           message.includes('超时') ||
           message.includes('Network timeout') ||
           message.includes('Request timeout') ||
           error.code === 'TIMEOUT' ||
           error.code === 'REQUEST_TIMEOUT' ||
           message.includes('timed out')
  }

  private isServerError(error: any): boolean {
    if (!error) return false
    const message = this.safeGetMessage(error)
    return message.includes('server') ||
           message.includes('服务器') ||
           message.includes('Internal Server Error') ||
           message.includes('Service Unavailable') ||
           message.includes('Bad Gateway') ||
           message.includes('Gateway Timeout') ||
           message.includes('Insufficient storage') ||
           message.includes('storage') ||
           error.code === '500' ||
           error.code === '502' ||
           error.code === '503' ||
           error.code === '504' ||
           error.code === '507' ||
           error.status === 500 ||
           error.status === 502 ||
           error.status === 503 ||
           error.status === 504 ||
           error.status === 507 ||
           message.includes('internal server error') ||
           message.includes('service unavailable') ||
           message.includes('database') ||
           message.includes('数据库')
  }

  private isClientError(error: any): boolean {
    if (!error) return false
    const message = this.safeGetMessage(error)
    return message.includes('client') ||
           message.includes('客户端') ||
           message.includes('ReferenceError') ||
           message.includes('TypeError') ||
           message.includes('SyntaxError')
  }
}

// ============================================================================
// 消息本地化器
// ============================================================================

export class MessageLocalizer {
  private errorMessages: Record<ErrorType, string> = {
    [ErrorType.NETWORK]: '网络连接失败，请检查网络后重试',
    [ErrorType.PERMISSION]: '权限不足，请联系管理员',
    [ErrorType.VALIDATION]: '输入信息有误，请检查后重试',
    [ErrorType.TIMEOUT]: '操作超时，请稍后重试',
    [ErrorType.SERVER]: '服务器暂时不可用，请稍后重试',
    [ErrorType.CLIENT]: '页面出现错误，请刷新页面后重试',
    [ErrorType.UNKNOWN]: '操作失败，请稍后重试'
  }

  private errorSuggestions: Record<ErrorType, string[]> = {
    [ErrorType.NETWORK]: [
      '检查网络连接是否正常',
      '尝试刷新页面',
      '稍后再试'
    ],
    [ErrorType.PERMISSION]: [
      '联系管理员获取权限',
      '确认账户状态是否正常',
      '重新登录后再试'
    ],
    [ErrorType.VALIDATION]: [
      '检查必填字段是否完整',
      '确认输入格式是否正确',
      '查看具体错误提示'
    ],
    [ErrorType.TIMEOUT]: [
      '检查网络连接速度',
      '稍后重试',
      '联系技术支持'
    ],
    [ErrorType.SERVER]: [
      '稍后重试',
      '联系技术支持',
      '查看系统状态页面'
    ],
    [ErrorType.CLIENT]: [
      '刷新页面',
      '清除浏览器缓存',
      '尝试使用其他浏览器'
    ],
    [ErrorType.UNKNOWN]: [
      '刷新页面后重试',
      '联系技术支持',
      '提供详细错误信息'
    ]
  }

  /**
   * 本地化错误消息
   */
  localize(error: any, context?: ErrorContext): LocalizedMessage {
    const classifier = new ErrorClassifier()
    const classification = classifier.classifyError(error)
    
    let message = this.errorMessages[classification.type]
    let suggestions = [...this.errorSuggestions[classification.type]]

    // 根据上下文调整消息
    if (context) {
      message = this.contextualizeMessage(message, context, classification.type)
      suggestions = this.contextualizeSuggestions(suggestions, context)
    }

    // 处理特定错误消息
    const specificMessage = this.getSpecificMessage(error, classification.type)
    if (specificMessage) {
      message = specificMessage
    }

    return {
      title: this.getErrorTitle(classification.type),
      message,
      suggestions,
      actionText: classification.isRetryable ? '重试' : undefined
    }
  }

  /**
   * 获取错误建议
   */
  getErrorSuggestions(errorType: ErrorType): string[] {
    return [...this.errorSuggestions[errorType]]
  }

  private safeGetMessage(error: any): string {
    if (!error) return ''
    
    // 如果有 message 属性，使用它
    if (typeof error.message === 'string') {
      return error.message
    }
    
    // 如果是字符串，直接返回
    if (typeof error === 'string') {
      return error
    }
    
    // 如果有 toString 方法，使用它
    if (error && typeof error.toString === 'function') {
      try {
        return error.toString()
      } catch {
        return ''
      }
    }
    
    // 最后尝试 JSON.stringify
    try {
      return JSON.stringify(error)
    } catch {
      return ''
    }
  }

  private getErrorTitle(errorType: ErrorType): string {
    const titles: Record<ErrorType, string> = {
      [ErrorType.NETWORK]: '网络错误',
      [ErrorType.PERMISSION]: '权限错误',
      [ErrorType.VALIDATION]: '输入错误',
      [ErrorType.TIMEOUT]: '超时错误',
      [ErrorType.SERVER]: '服务器错误',
      [ErrorType.CLIENT]: '客户端错误',
      [ErrorType.UNKNOWN]: '未知错误'
    }
    return titles[errorType]
  }

  private contextualizeMessage(message: string, context: ErrorContext, errorType: ErrorType): string {
    // 根据操作类型调整消息
    if (context.operation) {
      const operationMessages: Record<string, Partial<Record<ErrorType, string>>> = {
        'login': {
          [ErrorType.NETWORK]: '登录时网络连接失败，请检查网络后重试',
          [ErrorType.PERMISSION]: '登录失败，请检查用户名和密码',
          [ErrorType.VALIDATION]: '请输入正确的用户名和密码格式'
        },
        'upload': {
          [ErrorType.NETWORK]: '文件上传失败，请检查网络连接',
          [ErrorType.VALIDATION]: '文件格式不支持或文件过大',
          [ErrorType.TIMEOUT]: '文件上传超时，请检查文件大小和网络速度'
        },
        'save': {
          [ErrorType.NETWORK]: '保存失败，请检查网络连接后重试',
          [ErrorType.VALIDATION]: '保存失败，请检查输入信息是否完整'
        }
      }

      const operationMessage = operationMessages[context.operation]?.[errorType]
      if (operationMessage) {
        return operationMessage
      }
    }

    return message
  }

  private contextualizeSuggestions(suggestions: string[], context: ErrorContext): string[] {
    // 根据组件类型添加特定建议
    if (context.component) {
      const componentSuggestions: Record<string, string[]> = {
        'form': ['检查表单填写是否完整', '确认必填字段已填写'],
        'upload': ['检查文件格式和大小', '尝试压缩文件后上传'],
        'auth': ['确认账户信息正确', '尝试重置密码']
      }

      const additionalSuggestions = componentSuggestions[context.component]
      if (additionalSuggestions && Array.isArray(additionalSuggestions)) {
        return [...additionalSuggestions, ...suggestions]
      }
    }

    return suggestions
  }

  private getSpecificMessage(error: any, errorType: ErrorType): string | null {
    if (!error) return null

    const message = this.safeGetMessage(error)

    // 处理认证相关的特定错误
    if (errorType === ErrorType.PERMISSION) {
      // 对于权限错误，始终使用标准化消息，除非有特定的更详细的消息
      if (error.code === '401' && message.includes('Invalid credentials')) {
        return '登录失败，请检查用户名和密码'
      }
      if (error.code === 'SESSION_EXPIRED' || message.includes('Session expired')) {
        return '会话已过期，请重新登录'
      }
      if (error.code === 'ACCOUNT_LOCKED' || message.includes('Account locked')) {
        return '账户已被锁定，请联系管理员'
      }
      // 对于其他权限错误，返回null让系统使用标准化消息
      return null
    }

    // 处理特定的错误消息
    if (message.includes('duplicate') || message.includes('重复') || error.code === '23505') {
      return '该数据已存在，请检查后重试'
    }

    if (message.includes('not found') || message.includes('不存在') || error.code === '23503') {
      return '请求的资源不存在'
    }

    if (message.includes('rate limit') || message.includes('频率限制')) {
      return '操作过于频繁，请稍后再试'
    }

    if (message.includes('invalid input syntax for type uuid') || message.includes('UUID格式')) {
      return 'ID格式错误，请刷新页面后重试'
    }

    // 对于网络、权限和验证错误，不使用原始消息，而是使用标准化消息
    if (errorType === ErrorType.NETWORK || errorType === ErrorType.VALIDATION) {
      return null // 让调用者使用标准化消息
    }

    // 如果原始消息是用户友好的中文消息，直接使用（但不包括网络、权限和验证错误）
    if (message.length < 100 && !message.includes('Error:') && !message.includes('Exception') && /[\u4e00-\u9fa5]/.test(message)) {
      return message
    }

    return null
  }
}

// ============================================================================
// 重试机制
// ============================================================================

export class RetryMechanism {
  /**
   * 创建可重试操作
   */
  createRetryableOperation(operation: () => Promise<any>, options?: RetryOptions): RetryableOperation {
    const defaultOptions: RetryOptions = {
      maxAttempts: 3,
      baseDelay: 1000,
      backoffMultiplier: 2,
      timeout: 30000
    }

    const finalOptions = { ...defaultOptions, ...options }
    let attemptCount = 0

    return {
      async execute(): Promise<any> {
        attemptCount = 0
        return this.retry()
      },

      async retry(): Promise<any> {
        if (attemptCount >= finalOptions.maxAttempts) {
          throw new Error(`重试次数已达上限 (${finalOptions.maxAttempts})`)
        }

        attemptCount++

        try {
          return await Promise.race([
            operation(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('操作超时')), finalOptions.timeout)
            )
          ])
        } catch (error) {
          if (attemptCount >= finalOptions.maxAttempts) {
            throw error
          }

          // 计算退避延迟
          const delay = finalOptions.baseDelay * Math.pow(finalOptions.backoffMultiplier, attemptCount - 1)
          await new Promise(resolve => setTimeout(resolve, delay))

          return this.retry()
        }
      },

      canRetry(): boolean {
        return attemptCount < finalOptions.maxAttempts
      },

      getAttemptCount(): number {
        return attemptCount
      }
    }
  }

  /**
   * 执行带重试的操作
   */
  async executeWithRetry(operation: () => Promise<any>, options?: RetryOptions): Promise<any> {
    const retryableOp = this.createRetryableOperation(operation, options)
    return retryableOp.execute()
  }
}

// ============================================================================
// 错误处理API
// ============================================================================

export class ErrorHandlerAPI {
  private classifier = new ErrorClassifier()
  private localizer = new MessageLocalizer()
  private messageHistory: Map<string, number> = new Map()
  private readonly DUPLICATE_THRESHOLD = 5000 // 5秒内的重复消息将被合并
  
  // Performance optimization: Cache for error classifications
  private classificationCache = new Map<string, ErrorClassification>()
  private readonly CLASSIFICATION_CACHE_SIZE = 100
  
  // Performance optimization: Throttle error logging
  private logThrottle = new Map<string, number>()
  private readonly LOG_THROTTLE_INTERVAL = 1000 // 1秒内相同错误只记录一次
  private throttlingEnabled = true // Allow disabling throttling for tests
  private duplicateSuppressionEnabled = true // Allow disabling duplicate suppression for tests

  // Simple in-memory error log for testing
  private inMemoryErrorLog: ErrorRecord[] = []

  /**
   * 主要错误处理方法 - 性能优化版本
   */
  handleError(error: any, context?: ErrorContext): ErrorResponse {
    try {
      // Performance optimization: Use cached classification if available
      const errorKey = this.generateErrorKey(error, context)
      let cachedClassification = this.classificationCache.get(errorKey)
      let classification: ErrorClassification
      
      if (!cachedClassification) {
        classification = this.classifier.classifyError(error)
        
        // Cache only the classification metadata, not the originalError reference
        const classificationToCache = {
          type: classification.type,
          category: classification.category,
          isRetryable: classification.isRetryable,
          severity: classification.severity,
          originalError: null // Don't cache the original error reference
        }
        
        // Cache the classification with LRU eviction
        if (this.classificationCache.size >= this.CLASSIFICATION_CACHE_SIZE) {
          const firstKey = this.classificationCache.keys().next().value
          if (firstKey) {
            this.classificationCache.delete(firstKey)
          }
        }
        this.classificationCache.set(errorKey, classificationToCache)
      } else {
        // Create a fresh classification with the current error object
        classification = {
          type: cachedClassification.type,
          category: cachedClassification.category,
          isRetryable: cachedClassification.isRetryable,
          severity: cachedClassification.severity,
          originalError: error // Use the current error, not the cached one
        }
      }
      
      const localizedMessage = this.localizer.localize(error, context)
      
      const errorId = this.generateErrorId(error, context)
      
      // 检查重复消息
      if (this.duplicateSuppressionEnabled && this.isDuplicateMessage(errorId)) {
        console.log('Duplicate error message suppressed:', errorId)
      }

      // Performance optimization: Throttled error logging
      this.logErrorThrottled(error, context, classification, errorKey)

      // 创建并保存错误记录到日志管理器
      const errorRecord = this.createErrorRecord(error, context, classification, errorId)
      this.saveErrorRecord(errorRecord)

      return {
        id: errorId,
        type: classification.type,
        message: localizedMessage.message,
        canRetry: classification.isRetryable,
        severity: classification.severity,
        suggestions: localizedMessage.suggestions
      }
    } catch (handlingError) {
      // 错误处理过程中出现错误的兜底处理
      console.error('Error in error handler:', handlingError)
      return {
        id: 'error-handler-failure',
        type: ErrorType.UNKNOWN,
        message: '系统错误，请稍后重试',
        canRetry: true,
        severity: MessageSeverity.FATAL,
        suggestions: ['刷新页面', '联系技术支持']
      }
    }
  }

  /**
   * 显示消息方法
   */
  showMessage(type: MessageType, message: string, options?: MessageOptions): void {
    // 这个方法将在后续任务中与UI组件集成
    console.log(`[${type.toUpperCase()}] ${message}`, options)
  }

  /**
   * 启用重试功能
   */
  enableRetry(operation: () => Promise<any>, options?: RetryOptions): void {
    // 这个方法将在后续任务中实现重试UI集成
    console.log('Retry enabled for operation', { operation: operation.name, options })
  }

  /**
   * 获取错误日志
   */
  getErrorLog(): ErrorRecord[] {
    // Return memory log
    return [...this.inMemoryErrorLog]
  }

  /**
   * 清除错误日志
   */
  clearErrorLog(): void {
    this.inMemoryErrorLog = []
    console.log('Error log cleared')
  }

  /**
   * 禁用/启用错误日志节流 (主要用于测试)
   */
  setThrottlingEnabled(enabled: boolean): void {
    this.throttlingEnabled = enabled
  }

  /**
   * 禁用/启用重复消息抑制 (主要用于测试)
   */
  setDuplicateSuppressionEnabled(enabled: boolean): void {
    this.duplicateSuppressionEnabled = enabled
  }

  private generateErrorKey(error: any, context?: ErrorContext): string {
    // Generate a key for caching error classifications
    const errorType = typeof error === 'string' ? error : error?.constructor?.name || 'Unknown'
    const message = this.safeGetMessage(error).substring(0, 50) // First 50 chars for key
    const operation = context?.operation || 'unknown'
    return `${errorType}-${message}-${operation}`
  }

  private logErrorThrottled(error: any, context?: ErrorContext, classification?: ErrorClassification, errorKey?: string): void {
    // Skip throttling if disabled (for tests)
    if (!this.throttlingEnabled) {
      this.logError(error, context, classification)
      return
    }
    
    const now = Date.now()
    const key = errorKey || this.generateErrorKey(error, context)
    
    const lastLogTime = this.logThrottle.get(key)
    if (lastLogTime && (now - lastLogTime) < this.LOG_THROTTLE_INTERVAL) {
      return // Skip logging if within throttle interval
    }
    
    this.logThrottle.set(key, now)
    
    // Clean up old throttle entries
    for (const [throttleKey, time] of this.logThrottle.entries()) {
      if (now - time > this.LOG_THROTTLE_INTERVAL * 10) { // Keep for 10x interval
        this.logThrottle.delete(throttleKey)
      }
    }
    
    this.logError(error, context, classification)
  }

  private safeGetMessage(error: any): string {
    if (!error) return ''
    
    // 如果有 message 属性，使用它
    if (typeof error.message === 'string') {
      return error.message
    }
    
    // 如果是字符串，直接返回
    if (typeof error === 'string') {
      return error
    }
    
    // 如果有 toString 方法，使用它
    if (error && typeof error.toString === 'function') {
      try {
        return error.toString()
      } catch {
        return ''
      }
    }
    
    // 最后尝试 JSON.stringify
    try {
      return JSON.stringify(error)
    } catch {
      return ''
    }
  }

  private generateErrorId(error: any, context?: ErrorContext): string {
    const timestamp = Date.now()
    const errorType = this.classifier.classifyError(error).type
    const operation = this.sanitizeIdComponent(context?.operation || 'unknown')
    const component = this.sanitizeIdComponent(context?.component || 'unknown')
    
    return `${errorType}-${operation}-${component}-${timestamp}`
  }

  private sanitizeIdComponent(input: string): string {
    // 清理输入，只保留字母、数字、下划线和连字符
    const sanitized = input.trim().replace(/[^a-zA-Z0-9_-]/g, '_')
    // 确保不为空，如果为空则使用默认值
    return sanitized || 'unknown'
  }

  private isDuplicateMessage(errorId: string): boolean {
    const now = Date.now()
    const messageKey = errorId.split('-').slice(0, 3).join('-') // 去掉时间戳部分
    
    const lastTime = this.messageHistory.get(messageKey)
    if (lastTime && (now - lastTime) < this.DUPLICATE_THRESHOLD) {
      return true
    }

    this.messageHistory.set(messageKey, now)
    
    // 清理过期的消息记录
    for (const [key, time] of this.messageHistory.entries()) {
      if (now - time > this.DUPLICATE_THRESHOLD) {
        this.messageHistory.delete(key)
      }
    }

    return false
  }

  private createErrorRecord(
    error: any, 
    context?: ErrorContext, 
    classification?: ErrorClassification,
    errorId?: string
  ): ErrorRecord {
    const finalContext: ErrorContext = context || {
      operation: 'unknown',
      component: 'unknown'
    }

    return {
      id: errorId || this.generateErrorId(error, context),
      timestamp: new Date(),
      type: classification?.type || ErrorType.UNKNOWN,
      severity: classification?.severity || MessageSeverity.WARNING,
      message: typeof error === 'string' ? error : error?.message || '未知错误',
      originalError: error,
      context: finalContext,
      retryCount: 0,
      userAgent: navigator.userAgent
    }
  }

  private saveErrorRecord(errorRecord: ErrorRecord): void {
    // Save to in-memory log
    this.inMemoryErrorLog.unshift(errorRecord)
    // Keep log size limited
    if (this.inMemoryErrorLog.length > 50) {
      this.inMemoryErrorLog = this.inMemoryErrorLog.slice(0, 50)
    }
  }

  private logError(error: any, context?: ErrorContext, classification?: ErrorClassification): void {
    const logData = {
      error: error,
      context: context,
      classification: classification,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    }

    console.error('Error handled by ErrorHandlerAPI:', logData)
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const errorHandler = new ErrorHandlerAPI()
export const errorClassifier = new ErrorClassifier()
export const messageLocalizer = new MessageLocalizer()
export const retryMechanism = new RetryMechanism()