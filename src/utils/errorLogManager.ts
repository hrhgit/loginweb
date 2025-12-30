/**
 * 错误日志管理系统
 * 
 * 提供错误记录的本地存储、管理和问题反馈功能
 */

import type { ErrorRecord, ErrorContext } from './errorHandler'
import { ErrorType, MessageSeverity } from './errorHandler'

export interface FeedbackReport {
  summary: string
  errors: ErrorRecord[]
  environment: EnvironmentInfo
  timestamp: Date
}

export interface EnvironmentInfo {
  userAgent: string
  url: string
  timestamp: string
  userId?: string
  sessionId: string
}

export interface ErrorLogConfig {
  maxRecords: number
  maxStorageSize: number // in bytes
  sensitiveFields: string[]
  autoCleanupInterval: number // in milliseconds
}

/**
 * 错误日志管理器
 */
export class ErrorLogManager {
  private readonly STORAGE_KEY = 'error_log_records'
  private readonly SESSION_KEY = 'error_log_session'
  private config: ErrorLogConfig
  private sessionId: string
  private cleanupTimer?: number
  
  // Performance optimization: In-memory cache
  private recordsCache: ErrorRecord[] | null = null
  private cacheTimestamp: number = 0
  private readonly CACHE_TTL = 30000 // 30 seconds cache TTL
  
  // Performance optimization: Batch operations
  private pendingWrites: ErrorRecord[] = []
  private writeTimer?: number
  private readonly BATCH_WRITE_DELAY = 1000 // 1 second batch delay

  constructor(config?: Partial<ErrorLogConfig>) {
    this.config = {
      maxRecords: 50,
      maxStorageSize: 1024 * 1024, // 1MB
      sensitiveFields: ['password', 'token', 'key', 'secret', 'auth', 'credential'],
      autoCleanupInterval: 60 * 60 * 1000, // 1 hour
      ...config
    }

    this.sessionId = this.getOrCreateSessionId()
    this.startAutoCleanup()
  }

  /**
   * 添加错误记录 - 性能优化版本
   */
  addRecord(error: ErrorRecord): void {
    try {
      // 过滤敏感信息
      const sanitizedRecord = this.sanitizeRecord(error)
      
      // Performance optimization: Add to batch instead of immediate write
      this.pendingWrites.push(sanitizedRecord)
      
      // Update cache if it exists
      if (this.recordsCache) {
        this.recordsCache = [sanitizedRecord, ...this.recordsCache]
        this.recordsCache = this.applyStorageLimits(this.recordsCache)
      }
      
      // Schedule batch write
      this.scheduleBatchWrite()
    } catch (error) {
      console.warn('Failed to add error record:', error)
    }
  }

  /**
   * 添加错误记录并立即写入 - 用于测试
   */
  addRecordSync(error: ErrorRecord): void {
    this.addRecord(error)
    this.flushPendingWrites()
  }

  /**
   * 获取错误记录 - 性能优化版本
   */
  getRecords(limit?: number): ErrorRecord[] {
    try {
      // Check cache first
      const now = Date.now()
      if (this.recordsCache && (now - this.cacheTimestamp) < this.CACHE_TTL) {
        const records = limit ? this.recordsCache.slice(0, limit) : this.recordsCache
        return records
      }
      
      // Load from storage
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) {
        this.recordsCache = []
        this.cacheTimestamp = now
        return []
      }

      const records = JSON.parse(stored) as ErrorRecord[]
      
      // 验证记录格式并恢复Date对象
      const validRecords = records
        .filter(this.isValidRecord)
        .map(record => ({
          ...record,
          timestamp: new Date(record.timestamp) // 恢复Date对象
        }))
      
      // Update cache
      this.recordsCache = validRecords
      this.cacheTimestamp = now
      
      // 应用限制
      return limit ? validRecords.slice(0, limit) : validRecords
    } catch (error) {
      console.warn('Failed to get error records:', error)
      return []
    }
  }

  /**
   * 清除所有错误记录 - 性能优化版本
   */
  clearRecords(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY)
      // Clear cache
      this.recordsCache = []
      this.cacheTimestamp = Date.now()
      // Clear pending writes
      this.pendingWrites = []
      if (this.writeTimer) {
        clearTimeout(this.writeTimer)
        this.writeTimer = undefined
      }
    } catch (error) {
      console.warn('Failed to clear error records:', error)
    }
  }

  /**
   * 生成问题反馈报告
   */
  generateFeedbackReport(): FeedbackReport {
    const records = this.getRecords()
    const environment = this.getEnvironmentInfo()
    
    // 生成摘要
    const summary = this.generateSummary(records)
    
    return {
      summary,
      errors: records,
      environment,
      timestamp: new Date()
    }
  }

  /**
   * 复制错误信息到剪贴板
   */
  async copyToClipboard(): Promise<boolean> {
    try {
      const report = this.generateFeedbackReport()
      const text = this.formatReportForClipboard(report)
      
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
        return true
      } else {
        // 降级处理：使用传统方法
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        
        const result = document.execCommand('copy')
        document.body.removeChild(textArea)
        return result
      }
    } catch (error) {
      console.warn('Failed to copy to clipboard:', error)
      return false
    }
  }

  /**
   * 获取存储使用情况
   */
  getStorageInfo(): { used: number; limit: number; recordCount: number } {
    const records = this.getRecords()
    const stored = localStorage.getItem(this.STORAGE_KEY) || ''
    
    return {
      used: new Blob([stored]).size,
      limit: this.config.maxStorageSize,
      recordCount: records.length
    }
  }

  /**
   * 手动清理过期记录
   */
  cleanup(): void {
    const records = this.getRecords()
    const limitedRecords = this.applyStorageLimits(records)
    
    if (limitedRecords.length < records.length) {
      this.saveRecords(limitedRecords)
    }
  }

  /**
   * 销毁管理器 - 性能优化版本
   */
  dispose(): void {
    // Flush any pending writes before disposing
    this.flushPendingWrites()
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }
    
    if (this.writeTimer) {
      clearTimeout(this.writeTimer)
      this.writeTimer = undefined
    }
    
    // Clear cache
    this.recordsCache = null
  }

  // 私有方法

  private scheduleBatchWrite(): void {
    if (this.writeTimer) return // Already scheduled
    
    this.writeTimer = window.setTimeout(() => {
      this.flushPendingWrites()
    }, this.BATCH_WRITE_DELAY)
  }

  private flushPendingWrites(): void {
    if (this.pendingWrites.length === 0) return
    
    try {
      // Get existing records
      const existingRecords = this.getRecordsFromStorage()
      
      // Merge with pending writes
      const allRecords = [...this.pendingWrites, ...existingRecords]
      
      // Apply storage limits
      const limitedRecords = this.applyStorageLimits(allRecords)
      
      // Save to storage
      this.saveRecords(limitedRecords)
      
      // Update cache
      this.recordsCache = limitedRecords
      this.cacheTimestamp = Date.now()
      
      // Clear pending writes
      this.pendingWrites = []
    } catch (error) {
      console.warn('Failed to flush pending writes:', error)
    } finally {
      if (this.writeTimer) {
        clearTimeout(this.writeTimer)
        this.writeTimer = undefined
      }
    }
  }

  private getRecordsFromStorage(): ErrorRecord[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) return []

      const records = JSON.parse(stored) as ErrorRecord[]
      return records
        .filter(this.isValidRecord)
        .map(record => ({
          ...record,
          timestamp: new Date(record.timestamp)
        }))
    } catch (error) {
      console.warn('Failed to get records from storage:', error)
      return []
    }
  }

  private getOrCreateSessionId(): string {
    try {
      let sessionId = sessionStorage.getItem(this.SESSION_KEY)
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        sessionStorage.setItem(this.SESSION_KEY, sessionId)
      }
      return sessionId
    } catch {
      return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  }

  private sanitizeRecord(record: ErrorRecord): ErrorRecord {
    const sanitized = { ...record }
    
    // 过滤敏感信息
    if (sanitized.originalError) {
      sanitized.originalError = this.sanitizeObject(sanitized.originalError)
    }
    
    if (sanitized.context?.additionalData) {
      sanitized.context.additionalData = this.sanitizeObject(sanitized.context.additionalData)
    }
    
    // 确保时间戳是Date对象 - 但在存储时会被序列化为字符串
    if (typeof sanitized.timestamp === 'string') {
      sanitized.timestamp = new Date(sanitized.timestamp)
    }
    
    return sanitized
  }

  private sanitizeObject(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj
    
    const sanitized: any = Array.isArray(obj) ? [] : {}
    
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase()
      
      // 检查是否是敏感字段
      const isSensitive = this.config.sensitiveFields.some(field => 
        lowerKey.includes(field.toLowerCase())
      )
      
      if (isSensitive) {
        sanitized[key] = '[FILTERED]'
      } else if (value && typeof value === 'object') {
        sanitized[key] = this.sanitizeObject(value)
      } else {
        sanitized[key] = value
      }
    }
    
    return sanitized
  }

  private isValidRecord(record: any): record is ErrorRecord {
    return (
      record &&
      typeof record === 'object' &&
      typeof record.id === 'string' &&
      record.id.length > 0 &&
      record.timestamp &&
      typeof record.type === 'string' &&
      record.type.length > 0 &&
      typeof record.message === 'string' &&
      record.context &&
      typeof record.context === 'object' &&
      typeof record.context.operation === 'string' &&
      typeof record.context.component === 'string'
    )
  }

  private applyStorageLimits(records: ErrorRecord[]): ErrorRecord[] {
    // 按记录数量限制
    let limitedRecords = records.slice(0, this.config.maxRecords)
    
    // 按存储大小限制
    while (limitedRecords.length > 0) {
      const serialized = JSON.stringify(limitedRecords)
      const size = new Blob([serialized]).size
      
      if (size <= this.config.maxStorageSize) {
        break
      }
      
      // 移除最旧的记录
      limitedRecords = limitedRecords.slice(0, -1)
    }
    
    return limitedRecords
  }

  private saveRecords(records: ErrorRecord[]): void {
    try {
      const serialized = JSON.stringify(records)
      localStorage.setItem(this.STORAGE_KEY, serialized)
    } catch (error) {
      console.warn('Failed to save error records:', error)
      
      // 如果存储失败，尝试清理一些记录后重试
      if (records.length > 10) {
        const reducedRecords = records.slice(0, Math.floor(records.length / 2))
        try {
          const serialized = JSON.stringify(reducedRecords)
          localStorage.setItem(this.STORAGE_KEY, serialized)
        } catch {
          // 如果还是失败，清空存储
          this.clearRecords()
        }
      }
    }
  }

  private getEnvironmentInfo(): EnvironmentInfo {
    return {
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId
    }
  }

  private generateSummary(records: ErrorRecord[]): string {
    if (records.length === 0) {
      return '暂无错误记录'
    }
    
    const errorTypes = new Map<ErrorType, number>()
    const recentErrors = records.slice(0, 5)
    
    // 统计错误类型
    for (const record of records) {
      const count = errorTypes.get(record.type) || 0
      errorTypes.set(record.type, count + 1)
    }
    
    const typesSummary = Array.from(errorTypes.entries())
      .map(([type, count]) => `${this.getErrorTypeLabel(type)}: ${count}`)
      .join(', ')
    
    const recentErrorsList = recentErrors
      .map(record => `- ${record.message}`)
      .join('\n')
    
    return `错误统计: ${typesSummary}\n\n最近错误:\n${recentErrorsList}`
  }

  private getErrorTypeLabel(type: ErrorType): string {
    const labels: Record<ErrorType, string> = {
      [ErrorType.NETWORK]: '网络错误',
      [ErrorType.PERMISSION]: '权限错误',
      [ErrorType.VALIDATION]: '验证错误',
      [ErrorType.TIMEOUT]: '超时错误',
      [ErrorType.SERVER]: '服务器错误',
      [ErrorType.CLIENT]: '客户端错误',
      [ErrorType.UNKNOWN]: '未知错误'
    }
    return labels[type] || '其他错误'
  }

  private formatReportForClipboard(report: FeedbackReport): string {
    const lines = [
      '=== 错误反馈报告 ===',
      '',
      `生成时间: ${report.timestamp.toLocaleString()}`,
      `会话ID: ${report.environment.sessionId}`,
      `页面地址: ${report.environment.url}`,
      `浏览器: ${report.environment.userAgent}`,
      '',
      '=== 错误摘要 ===',
      report.summary,
      '',
      '=== 详细错误记录 ===',
      ''
    ]
    
    for (const [index, error] of report.errors.entries()) {
      lines.push(`${index + 1}. [${this.getErrorTypeLabel(error.type)}] ${error.message}`)
      lines.push(`   时间: ${new Date(error.timestamp).toLocaleString()}`)
      lines.push(`   错误ID: ${error.id}`)
      lines.push(`   组件: ${error.context.component}`)
      lines.push(`   操作: ${error.context.operation}`)
      lines.push(`   严重程度: ${error.severity}`)
      if (error.retryCount > 0) {
        lines.push(`   重试次数: ${error.retryCount}`)
      }
      
      // 添加技术详情
      if (error.originalError) {
        lines.push(`   技术信息:`)
        try {
          const errorDetails = JSON.stringify(error.originalError, null, 2)
          // 将每行缩进
          const indentedDetails = errorDetails.split('\n').map(line => `     ${line}`).join('\n')
          lines.push(indentedDetails)
        } catch {
          lines.push(`     ${String(error.originalError)}`)
        }
      }
      
      // 添加上下文详情
      if (error.context.additionalData) {
        lines.push(`   上下文数据:`)
        try {
          const contextDetails = JSON.stringify(error.context.additionalData, null, 2)
          const indentedContext = contextDetails.split('\n').map(line => `     ${line}`).join('\n')
          lines.push(indentedContext)
        } catch {
          lines.push(`     ${String(error.context.additionalData)}`)
        }
      }
      
      lines.push('')
    }
    
    return lines.join('\n')
  }

  private startAutoCleanup(): void {
    if (this.config.autoCleanupInterval > 0) {
      this.cleanupTimer = window.setInterval(() => {
        this.cleanup()
      }, this.config.autoCleanupInterval)
    }
  }
}

// 创建单例实例
export const errorLogManager = new ErrorLogManager()

// 便捷函数
export function createErrorRecord(
  error: any,
  context: ErrorContext,
  type: ErrorType,
  severity: MessageSeverity
): ErrorRecord {
  return {
    id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    type,
    severity,
    message: typeof error === 'string' ? error : error?.message || '未知错误',
    originalError: error,
    context,
    retryCount: 0,
    userAgent: navigator.userAgent
  }
}