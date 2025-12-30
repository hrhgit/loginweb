/**
 * 性能监控工具
 * 
 * 提供错误处理系统的性能监控和优化功能
 */

export interface PerformanceMetrics {
  errorHandlingTime: number
  messageDisplayTime: number
  storageOperationTime: number
  memoryUsage: number
  cacheHitRate: number
}

export interface PerformanceThresholds {
  maxErrorHandlingTime: number // 最大错误处理时间 (ms)
  maxMessageDisplayTime: number // 最大消息显示时间 (ms)
  maxStorageOperationTime: number // 最大存储操作时间 (ms)
  maxMemoryUsage: number // 最大内存使用量 (MB)
  minCacheHitRate: number // 最小缓存命中率 (%)
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    errorHandlingTime: 0,
    messageDisplayTime: 0,
    storageOperationTime: 0,
    memoryUsage: 0,
    cacheHitRate: 0
  }

  private thresholds: PerformanceThresholds = {
    maxErrorHandlingTime: 50, // 50ms
    maxMessageDisplayTime: 100, // 100ms
    maxStorageOperationTime: 200, // 200ms
    maxMemoryUsage: 50, // 50MB
    minCacheHitRate: 80 // 80%
  }

  private measurements: Map<string, number> = new Map()
  private cacheStats = { hits: 0, misses: 0 }

  /**
   * 开始性能测量
   */
  startMeasurement(operation: string): void {
    this.measurements.set(operation, performance.now())
  }

  /**
   * 结束性能测量并记录结果
   */
  endMeasurement(operation: string): number {
    const startTime = this.measurements.get(operation)
    if (!startTime) {
      console.warn(`No start time found for operation: ${operation}`)
      return 0
    }

    const duration = performance.now() - startTime
    this.measurements.delete(operation)

    // 更新相应的指标
    switch (operation) {
      case 'errorHandling':
        this.metrics.errorHandlingTime = duration
        break
      case 'messageDisplay':
        this.metrics.messageDisplayTime = duration
        break
      case 'storageOperation':
        this.metrics.storageOperationTime = duration
        break
    }

    // 检查是否超过阈值
    this.checkThresholds(operation, duration)

    return duration
  }

  /**
   * 记录缓存命中
   */
  recordCacheHit(): void {
    this.cacheStats.hits++
    this.updateCacheHitRate()
  }

  /**
   * 记录缓存未命中
   */
  recordCacheMiss(): void {
    this.cacheStats.misses++
    this.updateCacheHitRate()
  }

  /**
   * 更新内存使用量
   */
  updateMemoryUsage(): void {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory
      if (memInfo && memInfo.usedJSHeapSize) {
        this.metrics.memoryUsage = memInfo.usedJSHeapSize / (1024 * 1024) // Convert to MB
      }
    }
  }

  /**
   * 获取当前性能指标
   */
  getMetrics(): PerformanceMetrics {
    this.updateMemoryUsage()
    return { ...this.metrics }
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): string {
    const metrics = this.getMetrics()
    const issues: string[] = []

    if (metrics.errorHandlingTime > this.thresholds.maxErrorHandlingTime) {
      issues.push(`错误处理时间过长: ${metrics.errorHandlingTime.toFixed(2)}ms`)
    }

    if (metrics.messageDisplayTime > this.thresholds.maxMessageDisplayTime) {
      issues.push(`消息显示时间过长: ${metrics.messageDisplayTime.toFixed(2)}ms`)
    }

    if (metrics.storageOperationTime > this.thresholds.maxStorageOperationTime) {
      issues.push(`存储操作时间过长: ${metrics.storageOperationTime.toFixed(2)}ms`)
    }

    if (metrics.memoryUsage > this.thresholds.maxMemoryUsage) {
      issues.push(`内存使用量过高: ${metrics.memoryUsage.toFixed(2)}MB`)
    }

    if (metrics.cacheHitRate < this.thresholds.minCacheHitRate) {
      issues.push(`缓存命中率过低: ${metrics.cacheHitRate.toFixed(1)}%`)
    }

    const report = [
      '=== 错误处理系统性能报告 ===',
      `错误处理时间: ${metrics.errorHandlingTime.toFixed(2)}ms`,
      `消息显示时间: ${metrics.messageDisplayTime.toFixed(2)}ms`,
      `存储操作时间: ${metrics.storageOperationTime.toFixed(2)}ms`,
      `内存使用量: ${metrics.memoryUsage.toFixed(2)}MB`,
      `缓存命中率: ${metrics.cacheHitRate.toFixed(1)}%`,
      '',
      issues.length > 0 ? '性能问题:' : '性能正常',
      ...issues.map(issue => `- ${issue}`)
    ]

    return report.join('\n')
  }

  /**
   * 重置统计数据
   */
  reset(): void {
    this.metrics = {
      errorHandlingTime: 0,
      messageDisplayTime: 0,
      storageOperationTime: 0,
      memoryUsage: 0,
      cacheHitRate: 0
    }
    this.cacheStats = { hits: 0, misses: 0 }
    this.measurements.clear()
  }

  /**
   * 设置性能阈值
   */
  setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds }
  }

  // 私有方法

  private updateCacheHitRate(): void {
    const total = this.cacheStats.hits + this.cacheStats.misses
    if (total > 0) {
      this.metrics.cacheHitRate = (this.cacheStats.hits / total) * 100
    }
  }

  private checkThresholds(operation: string, duration: number): void {
    let threshold: number
    let metricName: string

    switch (operation) {
      case 'errorHandling':
        threshold = this.thresholds.maxErrorHandlingTime
        metricName = '错误处理'
        break
      case 'messageDisplay':
        threshold = this.thresholds.maxMessageDisplayTime
        metricName = '消息显示'
        break
      case 'storageOperation':
        threshold = this.thresholds.maxStorageOperationTime
        metricName = '存储操作'
        break
      default:
        return
    }

    if (duration > threshold) {
      console.warn(`性能警告: ${metricName}时间 ${duration.toFixed(2)}ms 超过阈值 ${threshold}ms`)
    }
  }
}

// 创建单例实例
export const performanceMonitor = new PerformanceMonitor()

// 便捷函数
export function measurePerformance<T>(
  operation: string,
  fn: () => T
): T {
  performanceMonitor.startMeasurement(operation)
  try {
    const result = fn()
    return result
  } finally {
    performanceMonitor.endMeasurement(operation)
  }
}

export async function measureAsyncPerformance<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  performanceMonitor.startMeasurement(operation)
  try {
    const result = await fn()
    return result
  } finally {
    performanceMonitor.endMeasurement(operation)
  }
}