<template>
  <div class="performance-dashboard">
    <!-- Dashboard Header -->
    <section class="dashboard-header">
      <div class="header-content">
        <h2 class="dashboard-title">性能监控仪表板</h2>
        <p class="dashboard-subtitle">实时监控系统性能指标和网络状态</p>
      </div>
      <div class="header-actions">
        <button 
          class="btn btn--ghost btn--compact"
          @click="refreshMetrics"
          :disabled="refreshing"
        >
          <RefreshCw v-if="!refreshing" :size="16" />
          <Loader2 v-else :size="16" class="spin" />
          刷新数据
        </button>
        <button 
          class="btn btn--ghost btn--compact"
          @click="toggleAutoRefresh"
          :class="{ 'btn--active': autoRefreshEnabled }"
        >
          <Play v-if="!autoRefreshEnabled" :size="16" />
          <Pause v-else :size="16" />
          {{ autoRefreshEnabled ? '停止' : '开启' }}自动刷新
        </button>
        <button 
          class="btn btn--primary btn--compact"
          @click="exportReport"
          :disabled="exporting"
        >
          <Download v-if="!exporting" :size="16" />
          <Loader2 v-else :size="16" class="spin" />
          导出报告
        </button>
      </div>
    </section>

    <!-- Real-time Status Cards -->
    <section class="status-cards">
      <div class="status-card" :class="{ 'status-card--warning': !networkStatus.isOnline }">
        <div class="status-icon">
          <Wifi v-if="networkStatus.isOnline" :size="24" class="icon--success" />
          <WifiOff v-else :size="24" class="icon--error" />
        </div>
        <div class="status-content">
          <h3>网络状态</h3>
          <p class="status-value">{{ networkStatus.isOnline ? '在线' : '离线' }}</p>
          <p class="status-detail">{{ getConnectionQualityText(networkStatus.connectionQuality) }}</p>
        </div>
      </div>

      <div class="status-card">
        <div class="status-icon">
          <Activity :size="24" class="icon--info" />
        </div>
        <div class="status-content">
          <h3>页面加载时间</h3>
          <p class="status-value">{{ formatTime(currentMetrics.pageLoadTime) }}</p>
          <p class="status-detail" :class="getPerformanceClass(currentMetrics.pageLoadTime, 3000)">
            {{ getPerformanceText(currentMetrics.pageLoadTime, 3000) }}
          </p>
        </div>
      </div>

      <div class="status-card">
        <div class="status-icon">
          <Zap :size="24" class="icon--warning" />
        </div>
        <div class="status-content">
          <h3>API 响应时间</h3>
          <p class="status-value">{{ formatTime(currentMetrics.apiResponseTime) }}</p>
          <p class="status-detail" :class="getPerformanceClass(currentMetrics.apiResponseTime, 2000)">
            {{ getPerformanceText(currentMetrics.apiResponseTime, 2000) }}
          </p>
        </div>
      </div>

      <div class="status-card">
        <div class="status-icon">
          <Database :size="24" class="icon--accent" />
        </div>
        <div class="status-content">
          <h3>缓存命中率</h3>
          <p class="status-value">{{ formatPercentage(currentMetrics.cacheHitRate) }}</p>
          <p class="status-detail" :class="getCacheHitClass(currentMetrics.cacheHitRate)">
            {{ getCacheHitText(currentMetrics.cacheHitRate) }}
          </p>
        </div>
      </div>
    </section>

    <!-- Performance Charts -->
    <section class="charts-section">
      <div class="chart-container">
        <div class="chart-header">
          <h3>性能趋势</h3>
          <div class="chart-controls">
            <select v-model="selectedTimeRange" @change="updateChartData" class="time-range-select">
              <option value="1h">最近 1 小时</option>
              <option value="6h">最近 6 小时</option>
              <option value="24h">最近 24 小时</option>
              <option value="7d">最近 7 天</option>
            </select>
          </div>
        </div>
        <div class="chart-content">
          <div class="performance-chart">
            <canvas ref="performanceChart" width="800" height="300"></canvas>
          </div>
        </div>
      </div>

      <div class="chart-container">
        <div class="chart-header">
          <h3>网络质量分布</h3>
        </div>
        <div class="chart-content">
          <div class="network-quality-chart">
            <canvas ref="networkChart" width="400" height="300"></canvas>
          </div>
        </div>
      </div>
    </section>

    <!-- Performance Alerts -->
    <section v-if="alerts.length > 0" class="alerts-section">
      <div class="alerts-header">
        <h3>性能警告</h3>
        <button 
          class="btn btn--ghost btn--compact"
          @click="clearAlerts"
        >
          <X :size="16" />
          清除所有
        </button>
      </div>
      <div class="alerts-list">
        <div 
          v-for="alert in alerts" 
          :key="alert.id"
          class="alert-item"
          :class="`alert-item--${alert.severity}`"
        >
          <div class="alert-icon">
            <AlertTriangle v-if="alert.severity === 'warning'" :size="20" />
            <AlertCircle v-else-if="alert.severity === 'error'" :size="20" />
            <Info v-else :size="20" />
          </div>
          <div class="alert-content">
            <h4>{{ alert.title }}</h4>
            <p>{{ alert.message }}</p>
            <span class="alert-time">{{ formatAlertTime(alert.timestamp) }}</span>
          </div>
          <button 
            class="alert-dismiss"
            @click="dismissAlert(alert.id)"
          >
            <X :size="16" />
          </button>
        </div>
      </div>
    </section>

    <!-- Optimization Recommendations -->
    <section class="recommendations-section">
      <div class="recommendations-header">
        <h3>优化建议</h3>
        <span class="recommendations-count">{{ recommendations.length }} 条建议</span>
      </div>
      <div class="recommendations-list">
        <div 
          v-for="recommendation in recommendations" 
          :key="recommendation.id"
          class="recommendation-item"
          :class="`recommendation-item--${recommendation.priority}`"
        >
          <div class="recommendation-icon">
            <Lightbulb :size="20" />
          </div>
          <div class="recommendation-content">
            <h4>{{ recommendation.title }}</h4>
            <p>{{ recommendation.description }}</p>
            <div class="recommendation-impact">
              <span class="impact-label">预期改善:</span>
              <span class="impact-value">{{ recommendation.expectedImprovement }}</span>
            </div>
          </div>
          <div class="recommendation-actions">
            <button 
              v-if="recommendation.actionable"
              class="btn btn--primary btn--compact"
              @click="applyRecommendation(recommendation)"
            >
              应用建议
            </button>
            <button 
              class="btn btn--ghost btn--compact"
              @click="dismissRecommendation(recommendation.id)"
            >
              忽略
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Detailed Metrics Table -->
    <section class="metrics-table-section">
      <div class="table-header">
        <h3>详细指标</h3>
        <div class="table-actions">
          <button 
            class="btn btn--ghost btn--compact"
            @click="toggleMetricsView"
          >
            <BarChart3 v-if="metricsViewMode === 'table'" :size="16" />
            <Table v-else :size="16" />
            {{ metricsViewMode === 'table' ? '图表视图' : '表格视图' }}
          </button>
        </div>
      </div>
      
      <div v-if="metricsViewMode === 'table'" class="metrics-table">
        <table class="performance-table">
          <thead>
            <tr>
              <th>指标名称</th>
              <th>当前值</th>
              <th>阈值</th>
              <th>状态</th>
              <th>趋势</th>
              <th>最后更新</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="metric in detailedMetrics" :key="metric.name">
              <td class="metric-name">{{ metric.displayName }}</td>
              <td class="metric-value">{{ formatMetricValue(metric) }}</td>
              <td class="metric-threshold">{{ formatThreshold(metric.threshold) }}</td>
              <td class="metric-status">
                <span class="status-badge" :class="`status-badge--${metric.status}`">
                  {{ getStatusText(metric.status) }}
                </span>
              </td>
              <td class="metric-trend">
                <TrendingUp v-if="metric.trend === 'up'" :size="16" class="trend-up" />
                <TrendingDown v-else-if="metric.trend === 'down'" :size="16" class="trend-down" />
                <Minus v-else :size="16" class="trend-stable" />
              </td>
              <td class="metric-updated">{{ formatTime(metric.lastUpdated) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="metrics-charts">
        <div class="mini-chart" v-for="metric in detailedMetrics" :key="metric.name">
          <h4>{{ metric.displayName }}</h4>
          <canvas :ref="`miniChart_${metric.name}`" width="200" height="100"></canvas>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, nextTick } from 'vue'
import { 
  RefreshCw, 
  Loader2, 
  Download, 
  Play, 
  Pause, 
  Wifi, 
  WifiOff, 
  Activity, 
  Zap, 
  Database,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  Lightbulb,
  BarChart3,
  Table,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-vue-next'
import { useAppStore } from '../../store/appStore'
import { performanceMonitor } from '../../utils/performanceMonitor'
import { networkManager } from '../../utils/networkManager'
import { cacheManager } from '../../utils/cacheManager'

// Types
interface PerformanceAlert {
  id: string
  title: string
  message: string
  severity: 'info' | 'warning' | 'error'
  timestamp: Date
}

interface OptimizationRecommendation {
  id: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
  expectedImprovement: string
  actionable: boolean
}

interface DetailedMetric {
  name: string
  displayName: string
  value: number
  threshold: number
  status: 'good' | 'warning' | 'error'
  trend: 'up' | 'down' | 'stable'
  lastUpdated: Date
  unit: string
}

// Store and reactive state
const store = useAppStore()

const refreshing = ref(false)
const exporting = ref(false)
const autoRefreshEnabled = ref(true)
const selectedTimeRange = ref('1h')
const metricsViewMode = ref<'table' | 'charts'>('table')

// Performance data
const currentMetrics = ref({
  pageLoadTime: 0,
  apiResponseTime: 0,
  cacheHitRate: 0,
  networkLatency: 0
})

const networkStatus = ref({
  isOnline: true,
  connectionQuality: 'fast' as 'fast' | 'slow' | 'offline'
})

const alerts = ref<PerformanceAlert[]>([])
const recommendations = ref<OptimizationRecommendation[]>([])

// Chart references
const performanceChart = ref<HTMLCanvasElement>()
const networkChart = ref<HTMLCanvasElement>()

// Auto-refresh interval
let refreshInterval: number | null = null

// Detailed metrics for table view
const detailedMetrics = ref<DetailedMetric[]>([
  {
    name: 'pageLoadTime',
    displayName: '页面加载时间',
    value: 0,
    threshold: 3000,
    status: 'good',
    trend: 'stable',
    lastUpdated: new Date(),
    unit: 'ms'
  },
  {
    name: 'apiResponseTime',
    displayName: 'API 响应时间',
    value: 0,
    threshold: 2000,
    status: 'good',
    trend: 'stable',
    lastUpdated: new Date(),
    unit: 'ms'
  },
  {
    name: 'cacheHitRate',
    displayName: '缓存命中率',
    value: 0,
    threshold: 80,
    status: 'good',
    trend: 'stable',
    lastUpdated: new Date(),
    unit: '%'
  },
  {
    name: 'memoryUsage',
    displayName: '内存使用量',
    value: 0,
    threshold: 50,
    status: 'good',
    trend: 'stable',
    lastUpdated: new Date(),
    unit: 'MB'
  },
  {
    name: 'networkLatency',
    displayName: '网络延迟',
    value: 0,
    threshold: 100,
    status: 'good',
    trend: 'stable',
    lastUpdated: new Date(),
    unit: 'ms'
  }
])

// Methods
const refreshMetrics = async () => {
  refreshing.value = true
  
  try {
    // Get performance metrics from monitor
    const metrics = performanceMonitor.getMetrics()
    
    // Update current metrics
    currentMetrics.value = {
      pageLoadTime: store.performanceMetrics.pageLoadTime || 0,
      apiResponseTime: store.performanceMetrics.apiResponseTime || 0,
      cacheHitRate: store.performanceMetrics.cacheHitRate || 0,
      networkLatency: store.performanceMetrics.networkLatency || 0
    }
    
    // Update network status
    networkStatus.value = {
      isOnline: store.isOnline,
      connectionQuality: store.connectionQuality
    }
    
    // Update detailed metrics
    updateDetailedMetrics(metrics)
    
    // Check for performance issues and generate alerts
    checkPerformanceThresholds()
    
    // Generate optimization recommendations
    generateRecommendations()
    
    // Update charts
    await nextTick()
    updateCharts()
    
  } catch (error) {
    console.error('Failed to refresh metrics:', error)
    store.setBanner('error', '刷新性能指标失败')
  } finally {
    refreshing.value = false
  }
}

const updateDetailedMetrics = (metrics: any) => {
  const now = new Date()
  
  detailedMetrics.value.forEach(metric => {
    let newValue = 0
    
    switch (metric.name) {
      case 'pageLoadTime':
        newValue = currentMetrics.value.pageLoadTime
        break
      case 'apiResponseTime':
        newValue = currentMetrics.value.apiResponseTime
        break
      case 'cacheHitRate':
        newValue = currentMetrics.value.cacheHitRate
        break
      case 'memoryUsage':
        newValue = metrics.memoryUsage || 0
        break
      case 'networkLatency':
        newValue = currentMetrics.value.networkLatency
        break
    }
    
    // Calculate trend
    const oldValue = metric.value
    metric.trend = newValue > oldValue ? 'up' : newValue < oldValue ? 'down' : 'stable'
    
    // Update value and status
    metric.value = newValue
    metric.lastUpdated = now
    
    // Determine status based on threshold
    if (metric.name === 'cacheHitRate') {
      // For cache hit rate, higher is better
      metric.status = newValue >= metric.threshold ? 'good' : 
                     newValue >= metric.threshold * 0.7 ? 'warning' : 'error'
    } else {
      // For other metrics, lower is better
      metric.status = newValue <= metric.threshold ? 'good' : 
                     newValue <= metric.threshold * 1.5 ? 'warning' : 'error'
    }
  })
}

const checkPerformanceThresholds = () => {
  const now = new Date()
  
  // Check page load time
  if (currentMetrics.value.pageLoadTime > 3000) {
    addAlert({
      id: `pageload_${now.getTime()}`,
      title: '页面加载时间过长',
      message: `当前页面加载时间为 ${formatTime(currentMetrics.value.pageLoadTime)}，超过了 3 秒的建议阈值`,
      severity: 'warning',
      timestamp: now
    })
  }
  
  // Check API response time
  if (currentMetrics.value.apiResponseTime > 2000) {
    addAlert({
      id: `api_${now.getTime()}`,
      title: 'API 响应时间过长',
      message: `当前 API 响应时间为 ${formatTime(currentMetrics.value.apiResponseTime)}，可能影响用户体验`,
      severity: 'warning',
      timestamp: now
    })
  }
  
  // Check cache hit rate
  if (currentMetrics.value.cacheHitRate < 70) {
    addAlert({
      id: `cache_${now.getTime()}`,
      title: '缓存命中率偏低',
      message: `当前缓存命中率为 ${formatPercentage(currentMetrics.value.cacheHitRate)}，建议优化缓存策略`,
      severity: 'info',
      timestamp: now
    })
  }
  
  // Check network status
  if (!networkStatus.value.isOnline) {
    addAlert({
      id: `network_${now.getTime()}`,
      title: '网络连接中断',
      message: '检测到网络连接中断，部分功能可能无法正常使用',
      severity: 'error',
      timestamp: now
    })
  }
}

const generateRecommendations = () => {
  const newRecommendations: OptimizationRecommendation[] = []
  
  // Page load optimization
  if (currentMetrics.value.pageLoadTime > 2000) {
    newRecommendations.push({
      id: 'optimize_loading',
      title: '启用代码分割',
      description: '通过动态导入和路由级代码分割来减少初始包大小，提升页面加载速度',
      priority: 'high',
      expectedImprovement: '减少 30-50% 的初始加载时间',
      actionable: true
    })
  }
  
  // Cache optimization
  if (currentMetrics.value.cacheHitRate < 80) {
    newRecommendations.push({
      id: 'optimize_cache',
      title: '优化缓存策略',
      description: '调整缓存 TTL 设置和缓存键策略，提高缓存命中率',
      priority: 'medium',
      expectedImprovement: '提升 15-25% 的缓存命中率',
      actionable: true
    })
  }
  
  // Network optimization
  if (networkStatus.value.connectionQuality === 'slow') {
    newRecommendations.push({
      id: 'optimize_network',
      title: '启用数据压缩',
      description: '对 API 响应和静态资源启用 gzip 压缩，减少网络传输量',
      priority: 'medium',
      expectedImprovement: '减少 40-60% 的数据传输量',
      actionable: false
    })
  }
  
  // Memory optimization
  const memoryMetric = detailedMetrics.value.find(m => m.name === 'memoryUsage')
  if (memoryMetric && memoryMetric.value > 40) {
    newRecommendations.push({
      id: 'optimize_memory',
      title: '清理内存泄漏',
      description: '检查并清理可能的内存泄漏，优化组件生命周期管理',
      priority: 'high',
      expectedImprovement: '减少 20-30% 的内存使用',
      actionable: true
    })
  }
  
  // Update recommendations (avoid duplicates)
  const existingIds = recommendations.value.map(r => r.id)
  const filteredRecommendations = newRecommendations.filter(r => !existingIds.includes(r.id))
  recommendations.value = [...recommendations.value, ...filteredRecommendations]
}

const addAlert = (alert: PerformanceAlert) => {
  // Avoid duplicate alerts
  const exists = alerts.value.some(a => a.title === alert.title && 
    Date.now() - a.timestamp.getTime() < 60000) // Within 1 minute
  
  if (!exists) {
    alerts.value.unshift(alert)
    
    // Keep only last 10 alerts
    if (alerts.value.length > 10) {
      alerts.value = alerts.value.slice(0, 10)
    }
  }
}

const toggleAutoRefresh = () => {
  autoRefreshEnabled.value = !autoRefreshEnabled.value
  
  if (autoRefreshEnabled.value) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
}

const startAutoRefresh = () => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
  
  refreshInterval = window.setInterval(() => {
    refreshMetrics()
  }, 30000) // Refresh every 30 seconds
}

const stopAutoRefresh = () => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
}

const exportReport = async () => {
  exporting.value = true
  
  try {
    const report = {
      timestamp: new Date().toISOString(),
      metrics: currentMetrics.value,
      networkStatus: networkStatus.value,
      detailedMetrics: detailedMetrics.value,
      alerts: alerts.value,
      recommendations: recommendations.value
    }
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `performance-report-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    
    URL.revokeObjectURL(url)
    
    store.setBanner('info', '性能报告导出成功')
  } catch (error) {
    console.error('Failed to export report:', error)
    store.setBanner('error', '导出报告失败')
  } finally {
    exporting.value = false
  }
}

const clearAlerts = () => {
  alerts.value = []
}

const dismissAlert = (alertId: string) => {
  alerts.value = alerts.value.filter(a => a.id !== alertId)
}

const dismissRecommendation = (recommendationId: string) => {
  recommendations.value = recommendations.value.filter(r => r.id !== recommendationId)
}

const applyRecommendation = (recommendation: OptimizationRecommendation) => {
  // This would implement the actual optimization
  // For now, just show a message
  store.setBanner('info', `正在应用优化建议: ${recommendation.title}`)
  
  // Remove the recommendation after applying
  dismissRecommendation(recommendation.id)
}

const toggleMetricsView = () => {
  metricsViewMode.value = metricsViewMode.value === 'table' ? 'charts' : 'table'
}

const updateChartData = () => {
  // This would update chart data based on selected time range
  updateCharts()
}

const updateCharts = () => {
  // Simple chart implementation using Canvas API
  // In a real implementation, you might use Chart.js or similar
  
  if (performanceChart.value) {
    const ctx = performanceChart.value.getContext('2d')
    if (ctx) {
      // Clear canvas
      ctx.clearRect(0, 0, performanceChart.value.width, performanceChart.value.height)
      
      // Draw simple performance trend chart
      drawPerformanceChart(ctx)
    }
  }
  
  if (networkChart.value) {
    const ctx = networkChart.value.getContext('2d')
    if (ctx) {
      // Clear canvas
      ctx.clearRect(0, 0, networkChart.value.width, networkChart.value.height)
      
      // Draw network quality pie chart
      drawNetworkChart(ctx)
    }
  }
}

const drawPerformanceChart = (ctx: CanvasRenderingContext2D) => {
  const width = ctx.canvas.width
  const height = ctx.canvas.height
  const padding = 40
  
  // Draw axes
  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = 1
  
  // Y-axis
  ctx.beginPath()
  ctx.moveTo(padding, padding)
  ctx.lineTo(padding, height - padding)
  ctx.stroke()
  
  // X-axis
  ctx.beginPath()
  ctx.moveTo(padding, height - padding)
  ctx.lineTo(width - padding, height - padding)
  ctx.stroke()
  
  // Sample data points
  const dataPoints = [
    { x: 0, y: currentMetrics.value.pageLoadTime },
    { x: 1, y: currentMetrics.value.apiResponseTime },
    { x: 2, y: currentMetrics.value.networkLatency }
  ]
  
  // Draw line
  ctx.strokeStyle = '#1f6f6d'
  ctx.lineWidth = 2
  ctx.beginPath()
  
  dataPoints.forEach((point, index) => {
    const x = padding + (point.x / (dataPoints.length - 1)) * (width - 2 * padding)
    const y = height - padding - (point.y / 5000) * (height - 2 * padding)
    
    if (index === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  })
  
  ctx.stroke()
  
  // Draw points
  ctx.fillStyle = '#1f6f6d'
  dataPoints.forEach((point) => {
    const x = padding + (point.x / (dataPoints.length - 1)) * (width - 2 * padding)
    const y = height - padding - (point.y / 5000) * (height - 2 * padding)
    
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, 2 * Math.PI)
    ctx.fill()
  })
}

const drawNetworkChart = (ctx: CanvasRenderingContext2D) => {
  const width = ctx.canvas.width
  const height = ctx.canvas.height
  const centerX = width / 2
  const centerY = height / 2
  const radius = Math.min(width, height) / 3
  
  // Sample network quality data
  const data = [
    { label: '快速', value: 70, color: '#22c55e' },
    { label: '慢速', value: 25, color: '#f59e0b' },
    { label: '离线', value: 5, color: '#ef4444' }
  ]
  
  let currentAngle = 0
  
  data.forEach((segment) => {
    const sliceAngle = (segment.value / 100) * 2 * Math.PI
    
    // Draw slice
    ctx.fillStyle = segment.color
    ctx.beginPath()
    ctx.moveTo(centerX, centerY)
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle)
    ctx.closePath()
    ctx.fill()
    
    // Draw label
    const labelAngle = currentAngle + sliceAngle / 2
    const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7)
    const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7)
    
    ctx.fillStyle = '#ffffff'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`${segment.label} ${segment.value}%`, labelX, labelY)
    
    currentAngle += sliceAngle
  })
}

// Utility functions
const formatTime = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const formatPercentage = (value: number): string => {
  return `${Math.round(value)}%`
}

const formatMetricValue = (metric: DetailedMetric): string => {
  if (metric.unit === '%') {
    return formatPercentage(metric.value)
  } else if (metric.unit === 'ms') {
    return formatTime(metric.value)
  } else {
    return `${Math.round(metric.value)}${metric.unit}`
  }
}

const formatThreshold = (threshold: number): string => {
  return threshold.toString()
}

const formatAlertTime = (timestamp: Date): string => {
  const now = new Date()
  const diff = now.getTime() - timestamp.getTime()
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return timestamp.toLocaleDateString()
}

const getConnectionQualityText = (quality: string): string => {
  switch (quality) {
    case 'fast': return '连接良好'
    case 'slow': return '连接较慢'
    case 'offline': return '连接中断'
    default: return '未知状态'
  }
}

const getPerformanceClass = (value: number, threshold: number): string => {
  if (value <= threshold) return 'status-good'
  if (value <= threshold * 1.5) return 'status-warning'
  return 'status-error'
}

const getPerformanceText = (value: number, threshold: number): string => {
  if (value <= threshold) return '性能良好'
  if (value <= threshold * 1.5) return '性能一般'
  return '需要优化'
}

const getCacheHitClass = (rate: number): string => {
  if (rate >= 80) return 'status-good'
  if (rate >= 60) return 'status-warning'
  return 'status-error'
}

const getCacheHitText = (rate: number): string => {
  if (rate >= 80) return '命中率良好'
  if (rate >= 60) return '命中率一般'
  return '需要优化'
}

const getStatusText = (status: string): string => {
  switch (status) {
    case 'good': return '正常'
    case 'warning': return '警告'
    case 'error': return '异常'
    default: return '未知'
  }
}

// Lifecycle
onMounted(() => {
  refreshMetrics()
  if (autoRefreshEnabled.value) {
    startAutoRefresh()
  }
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped>
.performance-dashboard {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding: 1.5rem;
  background: var(--bg);
  min-height: 100vh;
}

/* Dashboard Header */
.dashboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  flex-wrap: wrap;
}

.header-content {
  flex: 1;
}

.dashboard-title {
  font-family: 'Sora', sans-serif;
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0 0 0.5rem 0;
}

.dashboard-subtitle {
  font-size: 0.875rem;
  color: var(--muted);
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.btn--active {
  background: var(--accent-soft);
  color: var(--accent);
}

/* Status Cards */
.status-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.status-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  transition: all 0.18s ease;
}

.status-card:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow);
}

.status-card--warning {
  border-color: var(--danger);
  background: rgba(182, 45, 28, 0.05);
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--accent-soft);
}

.icon--success { color: #22c55e; }
.icon--error { color: var(--danger); }
.icon--warning { color: #f59e0b; }
.icon--info { color: #3b82f6; }
.icon--accent { color: var(--accent); }

.status-content h3 {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--muted);
  margin: 0 0 0.25rem 0;
}

.status-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0 0 0.25rem 0;
}

.status-detail {
  font-size: 0.75rem;
  margin: 0;
}

.status-good { color: #22c55e; }
.status-warning { color: #f59e0b; }
.status-error { color: var(--danger); }

/* Charts Section */
.charts-section {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1.5rem;
}

.chart-container {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border);
}

.chart-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0;
}

.chart-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.time-range-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink);
  font-size: 0.875rem;
}

.chart-content {
  padding: 1.5rem;
}

.performance-chart,
.network-quality-chart {
  width: 100%;
  height: 300px;
}

/* Alerts Section */
.alerts-section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.alerts-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border);
}

.alerts-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0;
}

.alerts-list {
  display: flex;
  flex-direction: column;
}

.alert-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border);
  transition: background 0.18s ease;
}

.alert-item:hover {
  background: var(--surface-muted);
}

.alert-item:last-child {
  border-bottom: none;
}

.alert-item--warning {
  border-left: 3px solid #f59e0b;
}

.alert-item--error {
  border-left: 3px solid var(--danger);
}

.alert-item--info {
  border-left: 3px solid #3b82f6;
}

.alert-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--surface-muted);
  flex-shrink: 0;
}

.alert-content {
  flex: 1;
}

.alert-content h4 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0 0 0.25rem 0;
}

.alert-content p {
  font-size: 0.8rem;
  color: var(--muted);
  margin: 0 0 0.5rem 0;
  line-height: 1.4;
}

.alert-time {
  font-size: 0.75rem;
  color: var(--muted);
}

.alert-dismiss {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.18s ease;
}

.alert-dismiss:hover {
  background: var(--surface-muted);
  color: var(--ink);
}

/* Recommendations Section */
.recommendations-section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.recommendations-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border);
}

.recommendations-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0;
}

.recommendations-count {
  font-size: 0.875rem;
  color: var(--muted);
  background: var(--surface-muted);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.recommendations-list {
  display: flex;
  flex-direction: column;
}

.recommendation-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border);
  transition: background 0.18s ease;
}

.recommendation-item:hover {
  background: var(--surface-muted);
}

.recommendation-item:last-child {
  border-bottom: none;
}

.recommendation-item--high {
  border-left: 3px solid var(--danger);
}

.recommendation-item--medium {
  border-left: 3px solid #f59e0b;
}

.recommendation-item--low {
  border-left: 3px solid #22c55e;
}

.recommendation-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  flex-shrink: 0;
}

.recommendation-content {
  flex: 1;
}

.recommendation-content h4 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0 0 0.5rem 0;
}

.recommendation-content p {
  font-size: 0.8rem;
  color: var(--muted);
  margin: 0 0 0.75rem 0;
  line-height: 1.4;
}

.recommendation-impact {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.impact-label {
  font-size: 0.75rem;
  color: var(--muted);
}

.impact-value {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--accent);
}

.recommendation-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

/* Metrics Table Section */
.metrics-table-section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border);
}

.table-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0;
}

.table-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.metrics-table {
  overflow-x: auto;
}

.performance-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.performance-table th,
.performance-table td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

.performance-table th {
  background: var(--surface-muted);
  color: var(--muted);
  font-weight: 500;
}

.performance-table tbody tr:hover {
  background: var(--surface-muted);
}

.metric-name {
  font-weight: 500;
  color: var(--ink);
}

.metric-value {
  font-weight: 600;
  color: var(--ink);
}

.metric-threshold {
  color: var(--muted);
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge--good {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.status-badge--warning {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.status-badge--error {
  background: rgba(182, 45, 28, 0.1);
  color: var(--danger);
}

.metric-trend {
  display: flex;
  align-items: center;
  justify-content: center;
}

.trend-up { color: var(--danger); }
.trend-down { color: #22c55e; }
.trend-stable { color: var(--muted); }

.metric-updated {
  color: var(--muted);
  font-size: 0.8rem;
}

/* Mini Charts */
.metrics-charts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  padding: 1.5rem;
}

.mini-chart {
  text-align: center;
}

.mini-chart h4 {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--ink);
  margin: 0 0 1rem 0;
}

/* Animations */
.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Responsive Design */
@media (max-width: 1024px) {
  .charts-section {
    grid-template-columns: 1fr;
  }
  
  .dashboard-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .header-actions {
    justify-content: center;
  }
}

@media (max-width: 768px) {
  .performance-dashboard {
    padding: 1rem;
    gap: 1.5rem;
  }
  
  .status-cards {
    grid-template-columns: 1fr;
  }
  
  .status-card {
    padding: 1rem;
  }
  
  .alert-item,
  .recommendation-item {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
  
  .recommendation-actions {
    justify-content: flex-start;
  }
  
  .metrics-table {
    font-size: 0.8rem;
  }
  
  .performance-table th,
  .performance-table td {
    padding: 0.75rem 0.5rem;
  }
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .status-card,
  .alert-item,
  .recommendation-item,
  .alert-dismiss {
    transition: none;
  }
  
  .spin {
    animation: none;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .status-card,
  .chart-container,
  .alerts-section,
  .recommendations-section,
  .metrics-table-section {
    border-width: 2px;
  }
}
</style>