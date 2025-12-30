/**
 * 性能监控工具 (简化版)
 * 
 * 仅在需要时按需收集数据，不进行持续监控
 */

export interface PerformanceMetrics {
  errorHandlingTime: number
  messageDisplayTime: number
  storageOperationTime: number
  memoryUsage: number
  cacheHitRate: number
}

export interface PerformanceThresholds {
  maxErrorHandlingTime: number
  maxMessageDisplayTime: number
  maxStorageOperationTime: number
  maxMemoryUsage: number
  minCacheHitRate: number
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
    maxErrorHandlingTime: 50,
    maxMessageDisplayTime: 100,
    maxStorageOperationTime: 200,
    maxMemoryUsage: 50,
    minCacheHitRate: 80
  }

  private measurements: Map<string, number> = new Map()
  private cacheStats = { hits: 0, misses: 0 }

  // 空操作 - 保持 API 兼容但不执行任何操作
  startMeasurement(_operation: string): void {
    // No-op for performance
  }

  endMeasurement(_operation: string): number {
    return 0
  }

  recordCacheHit(): void {
    this.cacheStats.hits++
  }

  recordCacheMiss(): void {
    this.cacheStats.misses++
  }

  // 仅在仪表板页面调用时才收集数据
  getMetrics(): PerformanceMetrics {
    // 按需更新内存使用量
    if ('memory' in performance) {
      const memInfo = (performance as any).memory
      if (memInfo?.usedJSHeapSize) {
        this.metrics.memoryUsage = memInfo.usedJSHeapSize / (1024 * 1024)
      }
    }
    
    // 更新缓存命中率
    const total = this.cacheStats.hits + this.cacheStats.misses
    if (total > 0) {
      this.metrics.cacheHitRate = (this.cacheStats.hits / total) * 100
    }
    
    return { ...this.metrics }
  }

  getPerformanceReport(): string {
    const metrics = this.getMetrics()
    return [
      '=== 性能报告 ===',
      `内存使用量: ${metrics.memoryUsage.toFixed(2)}MB`,
      `缓存命中率: ${metrics.cacheHitRate.toFixed(1)}%`
    ].join('\n')
  }

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

  setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds }
  }
}

export const performanceMonitor = new PerformanceMonitor()

// 简化的便捷函数 - 直接执行，不进行测量
export function measurePerformance<T>(_operation: string, fn: () => T): T {
  return fn()
}

export async function measureAsyncPerformance<T>(_operation: string, fn: () => Promise<T>): Promise<T> {
  return fn()
}