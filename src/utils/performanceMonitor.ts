/**
 * 模块加载性能监控系统
 * 实时监控和分析模块加载性能
 */

export interface PerformanceMetrics {
  moduleLoads: number
  averageLoadTime: number
  successRate: number
  errorRate: number
  slowLoadCount: number
  cacheHitRate: number
  networkRequests: number
  retryCount: number
  fallbackUsage: number
  timestamp: Date
}

export interface ModuleLoadMetric {
  path: string
  loadTime: number
  success: boolean
  cached: boolean
  retryCount: number
  errorType?: string
  timestamp: Date
  userAgent: string
  networkCondition?: string
}

export interface NetworkMetrics {
  requestUrl: string
  method: string
  responseTime: number
  statusCode: number
  success: boolean
  retryCount: number
  timestamp?: Date
}

export interface PerformanceAlert {
  type: 'slow_load' | 'high_error_rate' | 'network_issue' | 'cache_miss'
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  metrics: any
  timestamp: Date
  resolved: boolean
}

class PerformanceMonitor {
  private metrics: ModuleLoadMetric[] = []
  private networkMetrics: NetworkMetrics[] = []
  private alerts: PerformanceAlert[] = []
  private readonly maxMetricsHistory = 1000
  private readonly alertThresholds = {
    slowLoadTime: 2000, // 2 seconds
    highErrorRate: 0.1, // 10%
    lowCacheHitRate: 0.5, // 50%
    maxRetryRate: 0.2 // 20%
  }

  /**
   * 记录模块加载指标
   */
  recordModuleLoad(metric: Omit<ModuleLoadMetric, 'timestamp' | 'userAgent'>): void {
    const fullMetric: ModuleLoadMetric = {
      ...metric,
      timestamp: new Date(),
      userAgent: this.getUserAgent()
    }

    this.metrics.push(fullMetric)
    this.trimMetricsHistory()
    this.checkForAlerts(fullMetric)
    this.logPerformanceMetric(fullMetric)
  }

  /**
   * 记录网络请求指标
   */
  recordNetworkRequest(metric: Omit<NetworkMetrics, 'timestamp'>): void {
    const fullMetric: NetworkMetrics = {
      ...metric,
      timestamp: new Date()
    }

    this.networkMetrics.push(fullMetric)
    this.trimNetworkHistory()
    this.checkNetworkAlerts(fullMetric)
  }

  /**
   * 获取当前性能指标
   */
  getCurrentMetrics(): PerformanceMetrics {
    const recentMetrics = this.getRecentMetrics(5 * 60 * 1000) // Last 5 minutes
    const recentNetworkMetrics = this.getRecentNetworkMetrics(5 * 60 * 1000)

    if (recentMetrics.length === 0) {
      return this.getEmptyMetrics()
    }

    const successfulLoads = recentMetrics.filter(m => m.success)
    const cachedLoads = recentMetrics.filter(m => m.cached)
    const slowLoads = recentMetrics.filter(m => m.loadTime > this.alertThresholds.slowLoadTime)
    const totalRetries = recentMetrics.reduce((sum, m) => sum + m.retryCount, 0)
    const fallbackUsage = recentMetrics.filter(m => m.errorType === 'fallback').length

    const averageLoadTime = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.loadTime, 0) / recentMetrics.length
      : 0

    return {
      moduleLoads: recentMetrics.length,
      averageLoadTime: Math.round(averageLoadTime),
      successRate: recentMetrics.length > 0 ? successfulLoads.length / recentMetrics.length : 0,
      errorRate: recentMetrics.length > 0 ? (recentMetrics.length - successfulLoads.length) / recentMetrics.length : 0,
      slowLoadCount: slowLoads.length,
      cacheHitRate: recentMetrics.length > 0 ? cachedLoads.length / recentMetrics.length : 0,
      networkRequests: recentNetworkMetrics.length,
      retryCount: totalRetries,
      fallbackUsage,
      timestamp: new Date()
    }
  }

  /**
   * 获取性能报告
   */
  generatePerformanceReport(): {
    summary: PerformanceMetrics
    topSlowModules: Array<{ path: string; avgLoadTime: number; loadCount: number }>
    errorAnalysis: Array<{ errorType: string; count: number; percentage: number }>
    recommendations: string[]
    alerts: PerformanceAlert[]
  } {
    const summary = this.getCurrentMetrics()
    const allMetrics = this.metrics

    // 分析最慢的模块
    const moduleStats = new Map<string, { totalTime: number; count: number; errors: number }>()
    
    allMetrics.forEach(metric => {
      const stats = moduleStats.get(metric.path) || { totalTime: 0, count: 0, errors: 0 }
      stats.totalTime += metric.loadTime
      stats.count += 1
      if (!metric.success) stats.errors += 1
      moduleStats.set(metric.path, stats)
    })

    const topSlowModules = Array.from(moduleStats.entries())
      .map(([path, stats]) => ({
        path,
        avgLoadTime: Math.round(stats.totalTime / stats.count),
        loadCount: stats.count,
        errorRate: stats.errors / stats.count
      }))
      .sort((a, b) => b.avgLoadTime - a.avgLoadTime)
      .slice(0, 10)

    // 错误分析
    const errorTypes = new Map<string, number>()
    const failedMetrics = allMetrics.filter(m => !m.success)
    
    failedMetrics.forEach(metric => {
      const errorType = metric.errorType || 'unknown'
      errorTypes.set(errorType, (errorTypes.get(errorType) || 0) + 1)
    })

    const errorAnalysis = Array.from(errorTypes.entries())
      .map(([errorType, count]) => ({
        errorType,
        count,
        percentage: Math.round((count / failedMetrics.length) * 100)
      }))
      .sort((a, b) => b.count - a.count)

    // 生成建议
    const recommendations = this.generateRecommendations(summary, topSlowModules, errorAnalysis)

    return {
      summary,
      topSlowModules,
      errorAnalysis,
      recommendations,
      alerts: this.getActiveAlerts()
    }
  }

  /**
   * 获取实时性能指标
   */
  getRealTimeMetrics(): {
    moduleLoads: number
    avgTime: string
    successRate: string
    alerts: number
  } {
    const metrics = this.getCurrentMetrics()
    
    return {
      moduleLoads: metrics.moduleLoads,
      avgTime: `${metrics.averageLoadTime}ms`,
      successRate: `${(metrics.successRate * 100).toFixed(1)}%`,
      alerts: this.getActiveAlerts().length
    }
  }

  /**
   * 清除历史数据
   */
  clearHistory(): void {
    this.metrics.length = 0
    this.networkMetrics.length = 0
    this.alerts.length = 0
  }

  /**
   * 获取活跃的警报
   */
  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(alert => !alert.resolved)
  }

  /**
   * 解决警报
   */
  resolveAlert(alertIndex: number): void {
    if (alertIndex >= 0 && alertIndex < this.alerts.length) {
      this.alerts[alertIndex].resolved = true
    }
  }

  private getRecentMetrics(timeWindow: number): ModuleLoadMetric[] {
    const cutoff = new Date(Date.now() - timeWindow)
    return this.metrics.filter(m => m.timestamp >= cutoff)
  }

  private getRecentNetworkMetrics(timeWindow: number): NetworkMetrics[] {
    const cutoff = new Date(Date.now() - timeWindow)
    return this.networkMetrics.filter(m => m.timestamp && m.timestamp >= cutoff)
  }

  private getEmptyMetrics(): PerformanceMetrics {
    return {
      moduleLoads: 0,
      averageLoadTime: 0,
      successRate: 0,
      errorRate: 0,
      slowLoadCount: 0,
      cacheHitRate: 0,
      networkRequests: 0,
      retryCount: 0,
      fallbackUsage: 0,
      timestamp: new Date()
    }
  }

  private trimMetricsHistory(): void {
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics.splice(0, this.metrics.length - this.maxMetricsHistory)
    }
  }

  private trimNetworkHistory(): void {
    if (this.networkMetrics.length > this.maxMetricsHistory) {
      this.networkMetrics.splice(0, this.networkMetrics.length - this.maxMetricsHistory)
    }
  }

  private checkForAlerts(metric: ModuleLoadMetric): void {
    // 检查慢加载
    if (metric.loadTime > this.alertThresholds.slowLoadTime) {
      this.createAlert('slow_load', `模块加载缓慢: ${metric.path} (${metric.loadTime}ms)`, 'medium', {
        path: metric.path,
        loadTime: metric.loadTime,
        threshold: this.alertThresholds.slowLoadTime
      })
    }

    // 检查错误率
    const recentMetrics = this.getRecentMetrics(60000) // Last minute
    const errorRate = recentMetrics.filter(m => !m.success).length / recentMetrics.length
    
    if (recentMetrics.length >= 5 && errorRate > this.alertThresholds.highErrorRate) {
      this.createAlert('high_error_rate', `模块加载错误率过高: ${(errorRate * 100).toFixed(1)}%`, 'high', {
        errorRate,
        threshold: this.alertThresholds.highErrorRate,
        recentFailures: recentMetrics.filter(m => !m.success).length
      })
    }

    // 检查缓存命中率
    const cacheHitRate = recentMetrics.filter(m => m.cached).length / recentMetrics.length
    if (recentMetrics.length >= 10 && cacheHitRate < this.alertThresholds.lowCacheHitRate) {
      this.createAlert('cache_miss', `缓存命中率过低: ${(cacheHitRate * 100).toFixed(1)}%`, 'medium', {
        cacheHitRate,
        threshold: this.alertThresholds.lowCacheHitRate
      })
    }
  }

  private checkNetworkAlerts(metric: NetworkMetrics): void {
    if (!metric.success) {
      console.warn(`⚠️ 性能警报: 网络请求失败: ${metric.method} ${metric.requestUrl} (${metric.statusCode})`)
    }

    if (metric.responseTime > 5000) { // 5 seconds
      this.createAlert('network_issue', `网络请求响应缓慢: ${metric.requestUrl} (${metric.responseTime}ms)`, 'medium', {
        url: metric.requestUrl,
        responseTime: metric.responseTime
      })
    }
  }

  private createAlert(type: PerformanceAlert['type'], message: string, severity: PerformanceAlert['severity'], metrics: any): void {
    // 避免重复警报
    const existingAlert = this.alerts.find(alert => 
      !alert.resolved && 
      alert.type === type && 
      alert.message === message
    )

    if (!existingAlert) {
      this.alerts.push({
        type,
        message,
        severity,
        metrics,
        timestamp: new Date(),
        resolved: false
      })

      // 限制警报数量
      if (this.alerts.length > 100) {
        this.alerts.splice(0, this.alerts.length - 100)
      }
    }
  }

  private generateRecommendations(
    summary: PerformanceMetrics,
    slowModules: Array<{ path: string; avgLoadTime: number }>,
    errorAnalysis: Array<{ errorType: string; count: number }>
  ): string[] {
    const recommendations: string[] = []

    if (summary.averageLoadTime > 1000) {
      recommendations.push('考虑实施代码分割和懒加载以减少初始加载时间')
    }

    if (summary.cacheHitRate < 0.7) {
      recommendations.push('优化缓存策略以提高缓存命中率')
    }

    if (summary.errorRate > 0.05) {
      recommendations.push('检查并修复导致模块加载失败的问题')
    }

    if (slowModules.length > 0 && slowModules[0].avgLoadTime > 2000) {
      recommendations.push(`优化慢加载模块: ${slowModules[0].path}`)
    }

    if (summary.retryCount > summary.moduleLoads * 0.1) {
      recommendations.push('检查网络连接问题，重试次数过多')
    }

    if (errorAnalysis.length > 0 && errorAnalysis[0].count > 5) {
      recommendations.push(`重点解决 ${errorAnalysis[0].errorType} 类型的错误`)
    }

    return recommendations
  }

  private logPerformanceMetric(metric: ModuleLoadMetric): void {
    if (metric.success) {
      console.log(`📊 模块加载: ${metric.path} - ${metric.loadTime}ms`)
    } else {
      console.warn(`⚠️ 性能警报: 模块加载失败: ${metric.path}`)
    }
  }

  private getUserAgent(): string {
    if (typeof navigator !== 'undefined') {
      return navigator.userAgent
    }
    return 'Node.js'
  }
}

// 单例实例
export const performanceMonitor = new PerformanceMonitor()

// 全局性能监控接口
declare global {
  interface Window {
    __PERFORMANCE_MONITOR__: PerformanceMonitor
  }
}

// 在浏览器环境中暴露监控器
if (typeof window !== 'undefined') {
  window.__PERFORMANCE_MONITOR__ = performanceMonitor
}