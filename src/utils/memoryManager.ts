/**
 * 内存管理工具
 * 
 * 提供内存泄漏检测和预防功能，包括网络相关的内存管理
 */

export interface MemoryStats {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

export interface NetworkMemoryStats {
  activeListeners: number
  queuedRequests: number
  cacheEntries: number
  cacheSize: number
  failedRequests: number
}

export interface LeakDetectionConfig {
  checkInterval: number // 检查间隔 (ms)
  memoryThreshold: number // 内存阈值 (MB)
  growthThreshold: number // 增长阈值 (MB/min)
  maxRetainedObjects: number // 最大保留对象数
  networkCleanupThreshold: number // 网络清理阈值 (MB)
  cacheCleanupThreshold: number // 缓存清理阈值 (MB)
}

export interface NetworkCleanupCallbacks {
  clearRequestQueue?: () => void
  clearFailedRequests?: () => void
  removeNetworkListeners?: () => void
  clearCache?: () => void
  getCacheStats?: () => { totalSize: number; entryCount: number }
  getNetworkStats?: () => NetworkMemoryStats
}

export class MemoryManager {
  private config: LeakDetectionConfig
  private checkTimer?: number
  private memoryHistory: number[] = []
  private readonly MAX_HISTORY_SIZE = 10
  
  // 弱引用集合用于跟踪对象
  private trackedObjects = new Set<WeakRef<any>>()
  private objectCounts = new Map<string, number>()
  
  // 网络相关清理回调
  private networkCleanupCallbacks: NetworkCleanupCallbacks = {}
  
  // 组件清理回调注册表
  private componentCleanupCallbacks = new Map<string, () => void>()
  
  // 网络操作跟踪
  private networkOperations = new Map<string, { startTime: number; type: string }>()

  constructor(config?: Partial<LeakDetectionConfig>) {
    this.config = {
      checkInterval: 30000, // 30 seconds
      memoryThreshold: 100, // 100MB
      growthThreshold: 10, // 10MB/min
      maxRetainedObjects: 1000,
      networkCleanupThreshold: 50, // 50MB
      cacheCleanupThreshold: 20, // 20MB
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
      this.performNetworkCleanup()
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
   * 注册网络清理回调
   */
  registerNetworkCleanup(callbacks: NetworkCleanupCallbacks): void {
    this.networkCleanupCallbacks = { ...this.networkCleanupCallbacks, ...callbacks }
  }

  /**
   * 注册组件清理回调
   */
  registerComponentCleanup(componentId: string, cleanup: () => void): () => void {
    this.componentCleanupCallbacks.set(componentId, cleanup)
    
    // 返回取消注册函数
    return () => {
      this.componentCleanupCallbacks.delete(componentId)
    }
  }

  /**
   * 跟踪网络操作
   */
  trackNetworkOperation(operationId: string, type: string): void {
    this.networkOperations.set(operationId, {
      startTime: Date.now(),
      type
    })
  }

  /**
   * 完成网络操作跟踪
   */
  completeNetworkOperation(operationId: string): void {
    const operation = this.networkOperations.get(operationId)
    if (operation) {
      const duration = Date.now() - operation.startTime
      
      // 检测长时间运行的操作
      if (duration > 30000) { // 30 seconds
        console.warn(`Long-running network operation detected: ${operation.type} (${duration}ms)`)
      }
      
      this.networkOperations.delete(operationId)
    }
  }

  /**
   * 执行网络相关清理
   */
  performNetworkCleanup(): void {
    const stats = this.getMemoryStats()
    if (!stats) return

    const usedMB = stats.usedJSHeapSize / (1024 * 1024)
    
    // 如果内存使用超过网络清理阈值，执行网络清理
    if (usedMB > this.config.networkCleanupThreshold) {
      console.log('Performing network cleanup due to memory pressure')
      
      // 清理请求队列
      if (this.networkCleanupCallbacks.clearRequestQueue) {
        this.networkCleanupCallbacks.clearRequestQueue()
      }
      
      // 清理失败的请求
      if (this.networkCleanupCallbacks.clearFailedRequests) {
        this.networkCleanupCallbacks.clearFailedRequests()
      }
      
      // 清理长时间运行的网络操作
      this.cleanupStaleNetworkOperations()
    }
    
    // 如果内存使用超过缓存清理阈值，执行缓存清理
    if (usedMB > this.config.cacheCleanupThreshold) {
      this.performCacheCleanup()
    }
  }

  /**
   * 执行缓存清理
   */
  performCacheCleanup(): void {
    if (this.networkCleanupCallbacks.getCacheStats && this.networkCleanupCallbacks.clearCache) {
      const cacheStats = this.networkCleanupCallbacks.getCacheStats()
      const cacheSizeMB = cacheStats.totalSize / (1024 * 1024)
      
      if (cacheSizeMB > 10) { // 如果缓存超过10MB
        console.log(`Clearing cache due to size: ${cacheSizeMB.toFixed(2)}MB`)
        this.networkCleanupCallbacks.clearCache()
      }
    }
  }

  /**
   * 清理过期的网络操作
   */
  cleanupStaleNetworkOperations(): void {
    const now = Date.now()
    const staleOperations: string[] = []
    
    for (const [operationId, operation] of this.networkOperations.entries()) {
      // 清理超过5分钟的操作
      if (now - operation.startTime > 300000) {
        staleOperations.push(operationId)
      }
    }
    
    staleOperations.forEach(operationId => {
      console.warn(`Cleaning up stale network operation: ${operationId}`)
      this.networkOperations.delete(operationId)
    })
  }

  /**
   * 清理所有组件监听器
   */
  cleanupAllComponents(): void {
    console.log(`Cleaning up ${this.componentCleanupCallbacks.size} component listeners`)
    
    for (const [componentId, cleanup] of this.componentCleanupCallbacks.entries()) {
      try {
        cleanup()
      } catch (error) {
        console.error(`Error cleaning up component ${componentId}:`, error)
      }
    }
    
    this.componentCleanupCallbacks.clear()
  }

  /**
   * 获取网络内存统计
   */
  getNetworkMemoryStats(): NetworkMemoryStats {
    const defaultStats: NetworkMemoryStats = {
      activeListeners: this.componentCleanupCallbacks.size,
      queuedRequests: 0,
      cacheEntries: 0,
      cacheSize: 0,
      failedRequests: 0
    }

    if (this.networkCleanupCallbacks.getNetworkStats) {
      return {
        ...defaultStats,
        ...this.networkCleanupCallbacks.getNetworkStats()
      }
    }

    return defaultStats
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
    
    // 执行网络清理
    this.performNetworkCleanup()
    
    // 清理过期的网络操作
    this.cleanupStaleNetworkOperations()
    
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
    const networkStats = this.getNetworkMemoryStats()

    const report = [
      '=== 内存使用报告 ===',
      `已使用内存: ${usedMB.toFixed(2)} MB`,
      `总分配内存: ${totalMB.toFixed(2)} MB`,
      `内存限制: ${limitMB.toFixed(2)} MB`,
      `内存使用率: ${((usedMB / limitMB) * 100).toFixed(1)}%`,
      `内存增长率: ${growth.toFixed(2)} MB/min`,
      '',
      '网络内存统计:',
      `- 活跃监听器: ${networkStats.activeListeners}`,
      `- 队列中请求: ${networkStats.queuedRequests}`,
      `- 缓存条目: ${networkStats.cacheEntries}`,
      `- 缓存大小: ${(networkStats.cacheSize / (1024 * 1024)).toFixed(2)} MB`,
      `- 失败请求: ${networkStats.failedRequests}`,
      `- 活跃网络操作: ${this.networkOperations.size}`,
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
    const networkStats = this.getNetworkMemoryStats()

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

    // 检查网络相关的内存泄漏
    if (networkStats.activeListeners > 50) {
      issues.push(`活跃监听器过多: ${networkStats.activeListeners}`)
    }

    if (networkStats.queuedRequests > 100) {
      issues.push(`队列中请求过多: ${networkStats.queuedRequests}`)
    }

    if (networkStats.cacheSize > 50 * 1024 * 1024) { // 50MB
      issues.push(`缓存大小过大: ${(networkStats.cacheSize / (1024 * 1024)).toFixed(2)} MB`)
    }

    if (this.networkOperations.size > 20) {
      issues.push(`活跃网络操作过多: ${this.networkOperations.size}`)
    }

    // 检查长时间运行的网络操作
    const now = Date.now()
    let longRunningOps = 0
    for (const operation of this.networkOperations.values()) {
      if (now - operation.startTime > 60000) { // 1 minute
        longRunningOps++
      }
    }

    if (longRunningOps > 0) {
      issues.push(`长时间运行的网络操作: ${longRunningOps}`)
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

export function registerNetworkCleanup(callbacks: NetworkCleanupCallbacks): void {
  memoryManager.registerNetworkCleanup(callbacks)
}

export function registerComponentCleanup(componentId: string, cleanup: () => void): () => void {
  return memoryManager.registerComponentCleanup(componentId, cleanup)
}

export function trackNetworkOperation(operationId: string, type: string): void {
  memoryManager.trackNetworkOperation(operationId, type)
}

export function completeNetworkOperation(operationId: string): void {
  memoryManager.completeNetworkOperation(operationId)
}

export function performNetworkCleanup(): void {
  memoryManager.performNetworkCleanup()
}

export function cleanupAllComponents(): void {
  memoryManager.cleanupAllComponents()
}

export function getNetworkMemoryStats(): NetworkMemoryStats {
  return memoryManager.getNetworkMemoryStats()
}