/**
 * 错误报告和分析系统
 * 
 * 提供生产环境错误追踪、分析和报告功能
 */

import { ref, computed, type Ref } from 'vue'
import { errorHandler, type ErrorContext, type ErrorRecord, TIMEOUT_REFRESH_MESSAGE } from './errorHandler'
import { deploymentVerifier, type ErrorReport } from './deploymentVerifier'
import { performanceMonitor } from './performanceMonitor'
import { fetchWithTimeout } from './requestTimeout'

// ============================================================================
// 类型定义
// ============================================================================

export interface ErrorAnalysis {
  errorId: string
  frequency: number
  firstOccurrence: Date
  lastOccurrence: Date
  affectedUsers: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: string
  pattern: string
  resolution?: string
  status: 'open' | 'investigating' | 'resolved' | 'ignored'
}

export interface ErrorTrend {
  period: string
  errorCount: number
  uniqueErrors: number
  affectedUsers: number
  topErrors: Array<{
    pattern: string
    count: number
    percentage: number
  }>
}

export interface ErrorReportConfig {
  enableAutoReporting: boolean
  enableUserFeedback: boolean
  enableStackTraceCapture: boolean
  enableScreenshotCapture: boolean
  enableUserSessionRecording: boolean
  reportingEndpoint?: string
  maxReportsPerSession: number
  reportingThrottle: number
}

export interface UserFeedback {
  errorId: string
  userId?: string
  feedback: string
  rating: number
  timestamp: Date
  userAgent: string
  url: string
}

export interface ErrorContext extends ErrorContext {
  userId?: string
  sessionId: string
  userAgent: string
  url: string
  timestamp: Date
  stackTrace?: string
  screenshot?: string
  userActions?: UserAction[]
}

export interface UserAction {
  type: 'click' | 'navigation' | 'input' | 'scroll' | 'error'
  target: string
  timestamp: Date
  details?: any
}

export interface ErrorSummary {
  totalErrors: number
  uniqueErrors: number
  criticalErrors: number
  resolvedErrors: number
  errorRate: number
  topErrorCategories: Array<{
    category: string
    count: number
    percentage: number
  }>
  trends: ErrorTrend[]
}

// ============================================================================
// 错误报告器
// ============================================================================

export class ErrorReporter {
  private config: ErrorReportConfig
  private errorAnalyses: Map<string, ErrorAnalysis> = new Map()
  private userFeedbacks: UserFeedback[] = []
  private userActions: UserAction[] = []
  private sessionId: string
  private reportCount = 0
  private lastReportTime = 0

  constructor(config?: Partial<ErrorReportConfig>) {
    this.config = {
      enableAutoReporting: true,
      enableUserFeedback: true,
      enableStackTraceCapture: true,
      enableScreenshotCapture: false, // 默认关闭截图功能
      enableUserSessionRecording: true,
      maxReportsPerSession: 50,
      reportingThrottle: 1000, // 1秒
      ...config
    }

    this.sessionId = this.generateSessionId()
    this.initializeErrorTracking()
    this.initializeUserActionTracking()
  }

  /**
   * 初始化错误追踪
   */
  private initializeErrorTracking(): void {
    // 监听全局错误
    window.addEventListener('error', (event) => {
      this.handleGlobalError({
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      })
    })

    // 监听未处理的Promise拒绝
    window.addEventListener('unhandledrejection', (event) => {
      this.handleGlobalError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        error: event.reason
      })
    })

    // 监听Vue错误（如果在Vue环境中）
    if (typeof window !== 'undefined' && (window as any).Vue) {
      (window as any).Vue.config.errorHandler = (err: Error, vm: any, info: string) => {
        this.handleVueError(err, vm, info)
      }
    }
  }

  /**
   * 初始化用户行为追踪
   */
  private initializeUserActionTracking(): void {
    if (!this.config.enableUserSessionRecording) return

    // 追踪点击事件
    document.addEventListener('click', (event) => {
      this.recordUserAction({
        type: 'click',
        target: this.getElementSelector(event.target as Element),
        timestamp: new Date(),
        details: {
          x: event.clientX,
          y: event.clientY,
          button: event.button
        }
      })
    })

    // 追踪导航事件
    window.addEventListener('popstate', () => {
      this.recordUserAction({
        type: 'navigation',
        target: window.location.pathname,
        timestamp: new Date(),
        details: {
          url: window.location.href,
          referrer: document.referrer
        }
      })
    })

    // 追踪输入事件（去敏感化）
    document.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement
      if (target && target.type !== 'password') {
        this.recordUserAction({
          type: 'input',
          target: this.getElementSelector(target),
          timestamp: new Date(),
          details: {
            inputType: target.type,
            valueLength: target.value.length
          }
        })
      }
    })
  }

  /**
   * 处理全局错误
   */
  private handleGlobalError(errorInfo: {
    message: string
    filename?: string
    lineno?: number
    colno?: number
    error?: Error
  }): void {
    if (!this.shouldReport()) return

    const errorContext: ErrorContext = {
      operation: 'global_error',
      component: 'window',
      userId: this.getCurrentUserId(),
      sessionId: this.sessionId,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date(),
      stackTrace: errorInfo.error?.stack,
      userActions: this.getRecentUserActions(),
      additionalData: {
        filename: errorInfo.filename,
        lineno: errorInfo.lineno,
        colno: errorInfo.colno
      }
    }

    this.reportError(errorInfo.error || new Error(errorInfo.message), errorContext)
  }

  /**
   * 处理Vue错误
   */
  private handleVueError(err: Error, vm: any, info: string): void {
    if (!this.shouldReport()) return

    const errorContext: ErrorContext = {
      operation: 'vue_error',
      component: vm?.$options?.name || 'unknown',
      userId: this.getCurrentUserId(),
      sessionId: this.sessionId,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date(),
      stackTrace: err.stack,
      userActions: this.getRecentUserActions(),
      additionalData: {
        vueInfo: info,
        componentData: vm?.$data
      }
    }

    this.reportError(err, errorContext)
  }

  /**
   * 报告错误
   */
  reportError(error: Error, context: ErrorContext): void {
    try {
      // 生成错误模式
      const pattern = this.generateErrorPattern(error, context)
      
      // 分析错误
      const analysis = this.analyzeError(error, context, pattern)
      
      // 记录到本地分析
      this.errorAnalyses.set(analysis.errorId, analysis)
      
      // 记录到部署验证器
      deploymentVerifier.recordErrorReport({
        type: this.categorizeError(error, context),
        severity: this.determineSeverity(error, context),
        message: error.message,
        context: {
          ...context,
          pattern,
          analysis: analysis.errorId
        }
      })

      // 记录到错误处理器
      errorHandler.handleError(error, context)

      // 如果启用自动报告，发送到远程端点
      if (this.config.enableAutoReporting && this.config.reportingEndpoint) {
        this.sendToRemoteEndpoint(analysis, error, context)
      }

      this.reportCount++
      this.lastReportTime = Date.now()

      console.error('🚨 错误已报告:', {
        errorId: analysis.errorId,
        pattern,
        severity: analysis.severity
      })
    } catch (reportingError) {
      console.error('错误报告系统失败:', reportingError)
    }
  }

  /**
   * 生成错误模式
   */
  private generateErrorPattern(error: Error, context: ErrorContext): string {
    const errorType = error.constructor.name
    const operation = context.operation
    const component = context.component
    
    // 标准化错误消息（移除动态部分）
    let message = error.message
      .replace(/\d+/g, 'N')  // 替换数字
      .replace(/[a-f0-9-]{36}/g, 'UUID')  // 替换UUID
      .replace(/https?:\/\/[^\s]+/g, 'URL')  // 替换URL
      .replace(/\b\w+@\w+\.\w+/g, 'EMAIL')  // 替换邮箱
    
    return `${errorType}:${operation}:${component}:${message}`
  }

  /**
   * 分析错误
   */
  private analyzeError(error: Error, context: ErrorContext, pattern: string): ErrorAnalysis {
    const existingAnalysis = this.errorAnalyses.get(pattern)
    const now = new Date()
    
    if (existingAnalysis) {
      // 更新现有分析
      existingAnalysis.frequency++
      existingAnalysis.lastOccurrence = now
      existingAnalysis.affectedUsers = this.countAffectedUsers(pattern)
      
      return existingAnalysis
    } else {
      // 创建新分析
      return {
        errorId: this.generateErrorId(pattern),
        frequency: 1,
        firstOccurrence: now,
        lastOccurrence: now,
        affectedUsers: 1,
        severity: this.determineSeverity(error, context),
        category: this.categorizeError(error, context),
        pattern,
        status: 'open'
      }
    }
  }

  /**
   * 确定错误严重程度
   */
  private determineSeverity(error: Error, context: ErrorContext): 'low' | 'medium' | 'high' | 'critical' {
    // 关键操作的错误
    if (context.operation.includes('auth') || context.operation.includes('payment')) {
      return 'critical'
    }
    
    // 模块加载失败
    if (error.message.includes('Failed to load module') || error.message.includes('MIME type')) {
      return 'high'
    }
    
    // 网络错误
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return 'medium'
    }
    
    // 验证错误
    if (error.message.includes('validation') || error.message.includes('required')) {
      return 'low'
    }
    
    // 默认为中等严重程度
    return 'medium'
  }

  /**
   * 分类错误
   */
  private categorizeError(error: Error, context: ErrorContext): string {
    if (context.operation.includes('module') || error.message.includes('module')) {
      return 'module_load'
    }
    
    if (context.operation.includes('route') || context.operation.includes('navigation')) {
      return 'route_error'
    }
    
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return 'network_error'
    }
    
    if (error.name === 'TypeError' || error.name === 'ReferenceError') {
      return 'javascript_error'
    }
    
    return 'unknown_error'
  }

  /**
   * 记录用户行为
   */
  private recordUserAction(action: UserAction): void {
    this.userActions.unshift(action)
    
    // 保持最近100个行为
    if (this.userActions.length > 100) {
      this.userActions = this.userActions.slice(0, 100)
    }
  }

  /**
   * 获取最近的用户行为
   */
  private getRecentUserActions(count: number = 10): UserAction[] {
    return this.userActions.slice(0, count)
  }

  /**
   * 获取元素选择器
   */
  private getElementSelector(element: Element): string {
    if (!element) return 'unknown'
    
    if (element.id) {
      return `#${element.id}`
    }
    
    if (element.className) {
      return `.${element.className.split(' ')[0]}`
    }
    
    return element.tagName.toLowerCase()
  }

  /**
   * 判断是否应该报告
   */
  private shouldReport(): boolean {
    const now = Date.now()
    
    // 检查报告频率限制
    if (now - this.lastReportTime < this.config.reportingThrottle) {
      return false
    }
    
    // 检查会话报告数量限制
    if (this.reportCount >= this.config.maxReportsPerSession) {
      return false
    }
    
    return this.config.enableAutoReporting
  }

  /**
   * 发送到远程端点
   */
  private async sendToRemoteEndpoint(analysis: ErrorAnalysis, error: Error, context: ErrorContext): Promise<void> {
    if (!this.config.reportingEndpoint) return

    try {
      const payload = {
        errorId: analysis.errorId,
        pattern: analysis.pattern,
        severity: analysis.severity,
        category: analysis.category,
        frequency: analysis.frequency,
        error: {
          name: error.name,
          message: error.message,
          stack: this.config.enableStackTraceCapture ? error.stack : undefined
        },
        context: {
          ...context,
          userActions: this.config.enableUserSessionRecording ? context.userActions : undefined
        },
        environment: {
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString(),
          sessionId: this.sessionId
        }
      }

      await fetchWithTimeout(this.config.reportingEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        timeoutMessage: TIMEOUT_REFRESH_MESSAGE
      })
    } catch (reportingError) {
      console.error('远程错误报告失败:', reportingError)
    }
  }

  /**
   * 添加用户反馈
   */
  addUserFeedback(errorId: string, feedback: string, rating: number): void {
    if (!this.config.enableUserFeedback) return

    const userFeedback: UserFeedback = {
      errorId,
      userId: this.getCurrentUserId(),
      feedback,
      rating,
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      url: window.location.href
    }

    this.userFeedbacks.unshift(userFeedback)
    
    // 保持最近100条反馈
    if (this.userFeedbacks.length > 100) {
      this.userFeedbacks = this.userFeedbacks.slice(0, 100)
    }

    console.log('📝 用户反馈已记录:', { errorId, rating })
  }

  /**
   * 生成错误摘要
   */
  generateErrorSummary(periodHours: number = 24): ErrorSummary {
    const now = new Date()
    const start = new Date(now.getTime() - periodHours * 60 * 60 * 1000)
    
    const recentAnalyses = Array.from(this.errorAnalyses.values()).filter(
      analysis => analysis.lastOccurrence >= start
    )

    const totalErrors = recentAnalyses.reduce((sum, analysis) => sum + analysis.frequency, 0)
    const uniqueErrors = recentAnalyses.length
    const criticalErrors = recentAnalyses.filter(a => a.severity === 'critical').length
    const resolvedErrors = recentAnalyses.filter(a => a.status === 'resolved').length

    // 计算错误率（基于性能监控数据）
    const performanceReport = performanceMonitor.generateReport(periodHours)
    const totalOperations = performanceReport.summary.totalModuleLoads + 
                           performanceReport.summary.totalNetworkRequests
    const errorRate = totalOperations > 0 ? totalErrors / totalOperations : 0

    // 按类别分组
    const categoryCount = new Map<string, number>()
    recentAnalyses.forEach(analysis => {
      const count = categoryCount.get(analysis.category) || 0
      categoryCount.set(analysis.category, count + analysis.frequency)
    })

    const topErrorCategories = Array.from(categoryCount.entries())
      .map(([category, count]) => ({
        category,
        count,
        percentage: totalErrors > 0 ? count / totalErrors : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return {
      totalErrors,
      uniqueErrors,
      criticalErrors,
      resolvedErrors,
      errorRate,
      topErrorCategories,
      trends: [] // 可以根据需要实现趋势分析
    }
  }

  /**
   * 获取错误分析列表
   */
  getErrorAnalyses(): ErrorAnalysis[] {
    return Array.from(this.errorAnalyses.values())
      .sort((a, b) => b.frequency - a.frequency)
  }

  /**
   * 更新错误状态
   */
  updateErrorStatus(errorId: string, status: ErrorAnalysis['status'], resolution?: string): void {
    const analysis = Array.from(this.errorAnalyses.values()).find(a => a.errorId === errorId)
    if (analysis) {
      analysis.status = status
      if (resolution) {
        analysis.resolution = resolution
      }
    }
  }

  /**
   * 获取用户反馈
   */
  getUserFeedbacks(): UserFeedback[] {
    return [...this.userFeedbacks]
  }

  /**
   * 清除错误数据
   */
  clearErrorData(): void {
    this.errorAnalyses.clear()
    this.userFeedbacks = []
    this.userActions = []
    this.reportCount = 0
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 生成错误ID
   */
  private generateErrorId(pattern: string): string {
    const hash = this.simpleHash(pattern)
    return `error_${hash}_${Date.now()}`
  }

  /**
   * 简单哈希函数
   */
  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * 获取当前用户ID
   */
  private getCurrentUserId(): string | undefined {
    // 这里可以集成实际的用户认证系统
    return undefined
  }

  /**
   * 统计受影响的用户数
   */
  private countAffectedUsers(pattern: string): number {
    // 简化实现，实际应该基于用户ID统计
    return 1
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const errorReporter = new ErrorReporter()

// 便捷函数
export function reportError(error: Error, context?: Partial<ErrorContext>): void {
  const fullContext: ErrorContext = {
    operation: 'manual_report',
    component: 'unknown',
    sessionId: errorReporter['sessionId'],
    userAgent: navigator.userAgent,
    url: window.location.href,
    timestamp: new Date(),
    userActions: errorReporter['getRecentUserActions'](),
    ...context
  }
  
  errorReporter.reportError(error, fullContext)
}

export function addUserFeedback(errorId: string, feedback: string, rating: number): void {
  errorReporter.addUserFeedback(errorId, feedback, rating)
}

export function generateErrorSummary(periodHours?: number): ErrorSummary {
  return errorReporter.generateErrorSummary(periodHours)
}

export function getErrorAnalyses(): ErrorAnalysis[] {
  return errorReporter.getErrorAnalyses()
}
