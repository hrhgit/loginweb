/**
 * 内存管理工具
 * 
 * 提供内存泄漏检测和预防功能
 */

export interface MemoryStats {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

export interface LeakDetectionConfig {
  checkInterval: number // 检查间隔 (ms)
  memoryThreshold: number // 内存阈值 (MB)
  growthThreshold: number // 增长阈值 (MB/min)
  maxRetainedObjects: number // 最大保留对象数
}

export class MemoryManager {
  private config: LeakDetectionConfig
  private checkTimer?: number
  private memoryHistory: number[] = []
  private readonly MAX_HISTORY_SIZE = 10
  
  // 弱引用集合用于跟踪对象
  private trackedObjects = new Set<WeakRef<any>>()
  private objectCounts = new Map<string, number>()

  constructor(config?: Partial<LeakDetectionConfig>) {
    this.config = {
      checkInterval: 30000, // 30 seconds
      memoryThreshold: 100, // 100MB
      growthThreshold: 10, // 10MB/min
      maxRetainedObjects: 1000,
      ...config
    }
  }

  /**
   * 开始内存监控
   */
  startMonitoring(): void {
    if (this.checkTimer) return

    this.checkTimer = window.setInterval(() => {
      this.checkMemoryUsage()
      this.cleanupWeakRefs()
    }, this.config.checkInterval)

    console.log('Memory monitoring started')
  }

  /**
   * 停止内存监控
   */
  stopMonitoring(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = undefined
    }
    console.log('Memory monitoring stopped')
  }

  /**
   * 获取当前内存统计
   */
  getMemoryStats(): MemoryStats | null {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit
      }
    }
    return null
  }

  /**
   * 跟踪对象以检测内存泄漏
   */
  trackObject(obj: any, type: string): void {
    if (this.trackedObjects.size >= this.config.maxRetainedObjects) {
      // 清理一些旧的弱引用
      this.cleanupWeakRefs()
    }

    const weakRef = new WeakRef(obj)
    this.trackedObjects.add(weakRef)

    // 更新对象计数
    const count = this.objectCounts.get(type) || 0
    this.objectCounts.set(type, count + 1)
  }

  /**
   * 强制垃圾回收（如果可用）
   */
  forceGarbageCollection(): void {
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc()
      console.log('Forced garbage collection')
    } else {
      console.warn('Garbage collection not available')
    }
  }

  /**
   * 清理缓存和临时数据
   */
  cleanup(): void {
    // 清理弱引用
    this.cleanupWeakRefs()
    
    // 清理内存历史
    if (this.memoryHistory.length > this.MAX_HISTORY_SIZE) {
      this.memoryHistory = this.memoryHistory.slice(-this.MAX_HISTORY_SIZE)
    }
    
    console.log('Memory cleanup completed')
  }

  /**
   * 获取内存使用报告
   */
  getMemoryReport(): string {
    const stats = this.getMemoryStats()
    if (!stats) {
      return '内存统计不可用'
    }

    const usedMB = stats.usedJSHeapSize / (1024 * 1024)
    const totalMB = stats.totalJSHeapSize / (1024 * 1024)
    const limitMB = stats.jsHeapSizeLimit / (1024 * 1024)

    const growth = this.calculateMemoryGrowth()
    const objectSummary = this.getObjectCountSummary()

    const report = [
      '=== 内存使用报告 ===',
      `已使用内存: ${usedMB.toFixed(2)} MB`,
      `总分配内存: ${totalMB.toFixed(2)} MB`,
      `内存限制: ${limitMB.toFixed(2)} MB`,
      `内存使用率: ${((usedMB / limitMB) * 100).toFixed(1)}%`,
      `内存增长率: ${growth.toFixed(2)} MB/min`,
      '',
      '跟踪对象统计:',
      ...objectSummary.map(item => `- ${item.type}: ${item.count} 个对象`),
      '',
      this.detectMemoryLeaks()
    ]

    return report.join('\n')
  }

  /**
   * 检测潜在的内存泄漏
   */
  detectMemoryLeaks(): string {
    const stats = this.getMemoryStats()
    if (!stats) return '无法检测内存泄漏'

    const usedMB = stats.usedJSHeapSize / (1024 * 1024)
    const growth = this.calculateMemoryGrowth()

    const issues: string[] = []

    if (usedMB > this.config.memoryThreshold) {
      issues.push(`内存使用量过高: ${usedMB.toFixed(2)} MB`)
    }

    if (growth > this.config.growthThreshold) {
      issues.push(`内存增长过快: ${growth.toFixed(2)} MB/min`)
    }

    // 检查对象计数异常
    for (const [type, count] of this.objectCounts.entries()) {
      if (count > 100) { // 阈值可配置
        issues.push(`${type} 对象数量异常: ${count}`)
      }
    }

    return issues.length > 0 
      ? `检测到潜在内存泄漏:\n${issues.map(issue => `- ${issue}`).join('\n')}`
      : '未检测到内存泄漏'
  }

  // 私有方法

  private checkMemoryUsage(): void {
    const stats = this.getMemoryStats()
    if (!stats) return

    const usedMB = stats.usedJSHeapSize / (1024 * 1024)
    this.memoryHistory.push(usedMB)

    // 保持历史记录大小
    if (this.memoryHistory.length > this.MAX_HISTORY_SIZE) {
      this.memoryHistory.shift()
    }

    // 检查是否需要警告
    if (usedMB > this.config.memoryThreshold) {
      console.warn(`内存使用量过高: ${usedMB.toFixed(2)} MB`)
    }

    const growth = this.calculateMemoryGrowth()
    if (growth > this.config.growthThreshold) {
      console.warn(`内存增长过快: ${growth.toFixed(2)} MB/min`)
      this.cleanup()
    }
  }

  private calculateMemoryGrowth(): number {
    if (this.memoryHistory.length < 2) return 0

    const recent = this.memoryHistory[this.memoryHistory.length - 1]
    const older = this.memoryHistory[0]
    const timeDiff = (this.memoryHistory.length - 1) * (this.config.checkInterval / 1000 / 60) // minutes

    return timeDiff > 0 ? (recent - older) / timeDiff : 0
  }

  private cleanupWeakRefs(): void {
    const toRemove: WeakRef<any>[] = []
    
    for (const weakRef of this.trackedObjects) {
      if (weakRef.deref() === undefined) {
        toRemove.push(weakRef)
      }
    }

    for (const ref of toRemove) {
      this.trackedObjects.delete(ref)
    }

    if (toRemove.length > 0) {
      console.log(`Cleaned up ${toRemove.length} garbage collected objects`)
    }
  }

  private getObjectCountSummary(): Array<{ type: string; count: number }> {
    return Array.from(this.objectCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10) // Top 10
  }
}

// 创建单例实例
export const memoryManager = new MemoryManager()

// 便捷函数
export function startMemoryMonitoring(): void {
  memoryManager.startMonitoring()
}

export function stopMemoryMonitoring(): void {
  memoryManager.stopMonitoring()
}

export function trackObject(obj: any, type: string): void {
  memoryManager.trackObject(obj, type)
}

export function getMemoryReport(): string {
  return memoryManager.getMemoryReport()
}