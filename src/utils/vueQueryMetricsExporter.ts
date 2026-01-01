/**
 * Vue Query Metrics Exporter
 * 
 * Exports performance metrics for external monitoring and analysis
 */

import { vueQueryPerformanceMonitor } from './vueQueryPerformanceMonitor'
import { vueQueryMemoryManager } from './vueQueryMemoryManager'
import { vueQueryBatchOptimizer } from './vueQueryBatchOptimizer'

export interface ExportedMetrics {
  timestamp: number
  performance: {
    cacheSize: number
    totalQueries: number
    activeQueries: number
    staleQueries: number
    memoryUsage: number
    cacheHitRate: number
    averageQueryTime: number
    gcCollections: number
  }
  memory: {
    cacheEntries: number
    memoryUsage: number
    oldestEntry: number
    newestEntry: number
  }
  batching: {
    activeBatches: number
    totalBatchedQueries: number
    averageBatchSize: number
    batchEfficiency: number
  }
  thresholds: {
    cacheSize: { value: number; threshold: number; status: 'ok' | 'warning' | 'critical' }
    memoryUsage: { value: number; threshold: number; status: 'ok' | 'warning' | 'critical' }
    cacheHitRate: { value: number; threshold: number; status: 'ok' | 'warning' | 'critical' }
    queryTime: { value: number; threshold: number; status: 'ok' | 'warning' | 'critical' }
  }
}

class VueQueryMetricsExporter {
  private exportHistory: ExportedMetrics[] = []
  private readonly maxHistorySize = 100

  /**
   * Export current metrics
   */
  exportMetrics(): ExportedMetrics {
    const performanceMetrics = vueQueryPerformanceMonitor.getMetrics()
    const memoryStats = vueQueryMemoryManager.getMemoryStats()
    const batchMetrics = vueQueryBatchOptimizer.getBatchingMetrics()

    const metrics: ExportedMetrics = {
      timestamp: Date.now(),
      performance: performanceMetrics,
      memory: memoryStats,
      batching: batchMetrics,
      thresholds: {
        cacheSize: {
          value: performanceMetrics.cacheSize,
          threshold: 80,
          status: this.getThresholdStatus(performanceMetrics.cacheSize, 80, 'greater'),
        },
        memoryUsage: {
          value: performanceMetrics.memoryUsage,
          threshold: 40,
          status: this.getThresholdStatus(performanceMetrics.memoryUsage, 40, 'greater'),
        },
        cacheHitRate: {
          value: performanceMetrics.cacheHitRate,
          threshold: 80,
          status: this.getThresholdStatus(performanceMetrics.cacheHitRate, 80, 'less'),
        },
        queryTime: {
          value: performanceMetrics.averageQueryTime,
          threshold: 2000,
          status: this.getThresholdStatus(performanceMetrics.averageQueryTime, 2000, 'greater'),
        },
      },
    }

    // Add to history
    this.exportHistory.push(metrics)
    if (this.exportHistory.length > this.maxHistorySize) {
      this.exportHistory = this.exportHistory.slice(-this.maxHistorySize)
    }

    return metrics
  }

  /**
   * Export metrics as JSON string
   */
  exportAsJSON(): string {
    return JSON.stringify(this.exportMetrics(), null, 2)
  }

  /**
   * Export metrics as CSV string
   */
  exportAsCSV(): string {
    const metrics = this.exportMetrics()
    const headers = [
      'timestamp',
      'cacheSize',
      'totalQueries',
      'activeQueries',
      'staleQueries',
      'memoryUsage',
      'cacheHitRate',
      'averageQueryTime',
      'gcCollections',
      'activeBatches',
      'batchEfficiency',
    ]

    const values = [
      metrics.timestamp,
      metrics.performance.cacheSize,
      metrics.performance.totalQueries,
      metrics.performance.activeQueries,
      metrics.performance.staleQueries,
      metrics.performance.memoryUsage.toFixed(2),
      metrics.performance.cacheHitRate.toFixed(2),
      metrics.performance.averageQueryTime.toFixed(0),
      metrics.performance.gcCollections,
      metrics.batching.activeBatches,
      (metrics.batching.batchEfficiency * 100).toFixed(2),
    ]

    return `${headers.join(',')}\n${values.join(',')}`
  }

  /**
   * Get metrics history
   */
  getHistory(): ExportedMetrics[] {
    return [...this.exportHistory]
  }

  /**
   * Get performance trends over time
   */
  getTrends(): {
    cacheSize: { trend: 'up' | 'down' | 'stable'; change: number }
    memoryUsage: { trend: 'up' | 'down' | 'stable'; change: number }
    cacheHitRate: { trend: 'up' | 'down' | 'stable'; change: number }
    queryTime: { trend: 'up' | 'down' | 'stable'; change: number }
  } {
    if (this.exportHistory.length < 2) {
      return {
        cacheSize: { trend: 'stable', change: 0 },
        memoryUsage: { trend: 'stable', change: 0 },
        cacheHitRate: { trend: 'stable', change: 0 },
        queryTime: { trend: 'stable', change: 0 },
      }
    }

    const recent = this.exportHistory.slice(-10) // Last 10 measurements
    const first = recent[0]
    const last = recent[recent.length - 1]

    return {
      cacheSize: this.calculateTrend(first.performance.cacheSize, last.performance.cacheSize),
      memoryUsage: this.calculateTrend(first.performance.memoryUsage, last.performance.memoryUsage),
      cacheHitRate: this.calculateTrend(first.performance.cacheHitRate, last.performance.cacheHitRate),
      queryTime: this.calculateTrend(first.performance.averageQueryTime, last.performance.averageQueryTime),
    }
  }

  /**
   * Generate performance summary report
   */
  generateSummaryReport(): string {
    const metrics = this.exportMetrics()
    const trends = this.getTrends()

    const report = [
      '=== Vue Query Performance Summary ===',
      `Generated: ${new Date(metrics.timestamp).toLocaleString()}`,
      '',
      '📊 Current Metrics:',
      `  Cache Size: ${metrics.performance.cacheSize} entries (${metrics.thresholds.cacheSize.status})`,
      `  Memory Usage: ${metrics.performance.memoryUsage.toFixed(2)}MB (${metrics.thresholds.memoryUsage.status})`,
      `  Cache Hit Rate: ${metrics.performance.cacheHitRate.toFixed(1)}% (${metrics.thresholds.cacheHitRate.status})`,
      `  Average Query Time: ${metrics.performance.averageQueryTime.toFixed(0)}ms (${metrics.thresholds.queryTime.status})`,
      `  Active Queries: ${metrics.performance.activeQueries}`,
      `  Stale Queries: ${metrics.performance.staleQueries}`,
      `  GC Collections: ${metrics.performance.gcCollections}`,
      '',
      '📈 Trends:',
      `  Cache Size: ${trends.cacheSize.trend} (${trends.cacheSize.change > 0 ? '+' : ''}${trends.cacheSize.change.toFixed(1)})`,
      `  Memory Usage: ${trends.memoryUsage.trend} (${trends.memoryUsage.change > 0 ? '+' : ''}${trends.memoryUsage.change.toFixed(2)}MB)`,
      `  Cache Hit Rate: ${trends.cacheHitRate.trend} (${trends.cacheHitRate.change > 0 ? '+' : ''}${trends.cacheHitRate.change.toFixed(1)}%)`,
      `  Query Time: ${trends.queryTime.trend} (${trends.queryTime.change > 0 ? '+' : ''}${trends.queryTime.change.toFixed(0)}ms)`,
      '',
      '⚡ Batch Optimization:',
      `  Active Batches: ${metrics.batching.activeBatches}`,
      `  Batch Efficiency: ${(metrics.batching.batchEfficiency * 100).toFixed(1)}%`,
      `  Average Batch Size: ${metrics.batching.averageBatchSize.toFixed(1)}`,
      '',
      '🎯 Recommendations:',
      ...this.generateRecommendations(metrics),
    ]

    return report.join('\n')
  }

  /**
   * Clear metrics history
   */
  clearHistory(): void {
    this.exportHistory = []
  }

  /**
   * Private: Get threshold status
   */
  private getThresholdStatus(
    value: number,
    threshold: number,
    comparison: 'greater' | 'less'
  ): 'ok' | 'warning' | 'critical' {
    const isOverThreshold = comparison === 'greater' ? value > threshold : value < threshold
    
    if (!isOverThreshold) return 'ok'
    
    const ratio = comparison === 'greater' ? value / threshold : threshold / value
    if (ratio > 1.5) return 'critical'
    if (ratio > 1.2) return 'warning'
    return 'ok'
  }

  /**
   * Private: Calculate trend
   */
  private calculateTrend(
    oldValue: number,
    newValue: number
  ): { trend: 'up' | 'down' | 'stable'; change: number } {
    const change = newValue - oldValue
    const percentChange = oldValue > 0 ? (change / oldValue) * 100 : 0

    if (Math.abs(percentChange) < 5) {
      return { trend: 'stable', change }
    }

    return {
      trend: change > 0 ? 'up' : 'down',
      change,
    }
  }

  /**
   * Private: Generate recommendations
   */
  private generateRecommendations(metrics: ExportedMetrics): string[] {
    const recommendations: string[] = []

    if (metrics.thresholds.cacheSize.status !== 'ok') {
      recommendations.push('• Consider reducing cache size or increasing cleanup frequency')
    }

    if (metrics.thresholds.memoryUsage.status !== 'ok') {
      recommendations.push('• High memory usage detected - consider garbage collection')
    }

    if (metrics.thresholds.cacheHitRate.status !== 'ok' && metrics.performance.totalQueries > 10) {
      recommendations.push('• Low cache hit rate - consider adjusting stale times')
    }

    if (metrics.thresholds.queryTime.status !== 'ok') {
      recommendations.push('• Slow queries detected - consider optimizing query functions')
    }

    if (metrics.batching.batchEfficiency < 0.3 && metrics.batching.totalBatchedQueries > 0) {
      recommendations.push('• Low batch efficiency - consider adjusting batch configuration')
    }

    if (recommendations.length === 0) {
      recommendations.push('• All metrics are within acceptable ranges')
    }

    return recommendations
  }
}

// Export singleton instance
export const vueQueryMetricsExporter = new VueQueryMetricsExporter()

// Utility functions
export function exportCurrentMetrics(): ExportedMetrics {
  return vueQueryMetricsExporter.exportMetrics()
}

export function downloadMetricsAsJSON(): void {
  const data = vueQueryMetricsExporter.exportAsJSON()
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `vue-query-metrics-${Date.now()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function downloadMetricsAsCSV(): void {
  const data = vueQueryMetricsExporter.exportAsCSV()
  const blob = new Blob([data], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `vue-query-metrics-${Date.now()}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function logPerformanceSummary(): void {
  console.log(vueQueryMetricsExporter.generateSummaryReport())
}