<template>
  <main class="admin-dashboard-page">
    <section class="page-head">
      <div class="head-row">
        <button class="btn btn--ghost btn--icon" @click="router.push('/events/mine')">
          <ArrowLeft :size="20" />
        </button>
        <div class="head-content">
          <h1>系统管理仪表板</h1>
          <p class="muted">监控系统性能、网络状态和用户活动</p>
        </div>
      </div>
    </section>

    <div class="admin-tabs">
      <button 
        class="tab-btn"
        :class="{ active: activeTab === 'performance' }"
        @click="activeTab = 'performance'"
      >
        <Activity :size="18" />
        性能监控
      </button>
      <button 
        class="tab-btn"
        :class="{ active: activeTab === 'network' }"
        @click="activeTab = 'network'"
      >
        <Wifi :size="18" />
        网络状态
      </button>
      <button 
        class="tab-btn"
        :class="{ active: activeTab === 'system' }"
        @click="activeTab = 'system'"
      >
        <Server :size="18" />
        系统信息
      </button>
      <button 
        class="tab-btn"
        :class="{ active: activeTab === 'alerts' }"
        @click="activeTab = 'alerts'"
      >
        <Bell :size="18" />
        警告通知
        <span v-if="totalAlerts > 0" class="alert-badge">{{ totalAlerts }}</span>
      </button>
    </div>

    <!-- Performance Monitoring Tab -->
    <section v-if="activeTab === 'performance'" class="admin-section">
      <PerformanceMonitoringDashboard />
    </section>

    <!-- Network Status Tab -->
    <section v-else-if="activeTab === 'network'" class="admin-section">
      <div class="network-status-panel">
        <div class="panel-header">
          <h3>网络连接状态</h3>
          <div class="status-indicator" :class="networkStatusClass">
            <div class="status-dot"></div>
            <span>{{ networkStatusText }}</span>
          </div>
        </div>

        <div class="network-metrics-grid">
          <div class="metric-card">
            <div class="metric-icon">
              <Zap :size="24" />
            </div>
            <div class="metric-content">
              <h4>连接类型</h4>
              <p class="metric-value">{{ networkInfo.connectionType }}</p>
              <p class="metric-detail">{{ networkInfo.effectiveType }}</p>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon">
              <Clock :size="24" />
            </div>
            <div class="metric-content">
              <h4>网络延迟</h4>
              <p class="metric-value">{{ networkInfo.rtt }}ms</p>
              <p class="metric-detail" :class="getLatencyClass(networkInfo.rtt)">
                {{ getLatencyText(networkInfo.rtt) }}
              </p>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon">
              <Download :size="24" />
            </div>
            <div class="metric-content">
              <h4>下载速度</h4>
              <p class="metric-value">{{ networkInfo.downlink }} Mbps</p>
              <p class="metric-detail" :class="getSpeedClass(networkInfo.downlink)">
                {{ getSpeedText(networkInfo.downlink) }}
              </p>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon">
              <Shield :size="24" />
            </div>
            <div class="metric-content">
              <h4>数据节省</h4>
              <p class="metric-value">{{ networkInfo.saveData ? '开启' : '关闭' }}</p>
              <p class="metric-detail">{{ networkInfo.saveData ? '节省流量模式' : '正常模式' }}</p>
            </div>
          </div>
        </div>

        <div class="network-history">
          <h4>连接历史</h4>
          <div class="history-list">
            <div 
              v-for="event in networkHistory" 
              :key="event.id"
              class="history-item"
              :class="`history-item--${event.type}`"
            >
              <div class="history-icon">
                <Wifi v-if="event.type === 'online'" :size="16" />
                <WifiOff v-else :size="16" />
              </div>
              <div class="history-content">
                <p class="history-message">{{ event.message }}</p>
                <span class="history-time">{{ formatTime(event.timestamp) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- System Information Tab -->
    <section v-else-if="activeTab === 'system'" class="admin-section">
      <div class="system-info-panel">
        <div class="panel-header">
          <h3>系统信息</h3>
          <button 
            class="btn btn--ghost btn--compact"
            @click="refreshSystemInfo"
            :disabled="refreshingSystem"
          >
            <RefreshCw v-if="!refreshingSystem" :size="16" />
            <Loader2 v-else :size="16" class="spin" />
            刷新
          </button>
        </div>

        <div class="system-metrics-grid">
          <div class="system-card">
            <div class="card-header">
              <h4>浏览器信息</h4>
              <Monitor :size="20" />
            </div>
            <div class="card-content">
              <div class="info-row">
                <span class="info-label">用户代理:</span>
                <span class="info-value">{{ systemInfo.userAgent }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">语言:</span>
                <span class="info-value">{{ systemInfo.language }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">时区:</span>
                <span class="info-value">{{ systemInfo.timezone }}</span>
              </div>
            </div>
          </div>

          <div class="system-card">
            <div class="card-header">
              <h4>屏幕信息</h4>
              <Smartphone :size="20" />
            </div>
            <div class="card-content">
              <div class="info-row">
                <span class="info-label">分辨率:</span>
                <span class="info-value">{{ systemInfo.screenResolution }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">可用区域:</span>
                <span class="info-value">{{ systemInfo.availableResolution }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">像素比:</span>
                <span class="info-value">{{ systemInfo.pixelRatio }}</span>
              </div>
            </div>
          </div>

          <div class="system-card">
            <div class="card-header">
              <h4>内存使用</h4>
              <HardDrive :size="20" />
            </div>
            <div class="card-content">
              <div class="info-row">
                <span class="info-label">已使用:</span>
                <span class="info-value">{{ formatBytes(systemInfo.memoryUsage.used) }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">总计:</span>
                <span class="info-value">{{ formatBytes(systemInfo.memoryUsage.total) }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">使用率:</span>
                <span class="info-value" :class="getMemoryUsageClass(systemInfo.memoryUsage.percentage)">
                  {{ systemInfo.memoryUsage.percentage }}%
                </span>
              </div>
            </div>
          </div>

          <div class="system-card">
            <div class="card-header">
              <h4>存储信息</h4>
              <Database :size="20" />
            </div>
            <div class="card-content">
              <div class="info-row">
                <span class="info-label">本地存储:</span>
                <span class="info-value">{{ systemInfo.localStorage ? '支持' : '不支持' }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">会话存储:</span>
                <span class="info-value">{{ systemInfo.sessionStorage ? '支持' : '不支持' }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">IndexedDB:</span>
                <span class="info-value">{{ systemInfo.indexedDB ? '支持' : '不支持' }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="performance-summary">
          <h4>性能摘要</h4>
          <div class="summary-grid">
            <div class="summary-item">
              <span class="summary-label">页面加载时间</span>
              <span class="summary-value">{{ formatTime(performanceSummary.pageLoadTime) }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">DOM 内容加载</span>
              <span class="summary-value">{{ formatTime(performanceSummary.domContentLoaded) }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">首次绘制</span>
              <span class="summary-value">{{ formatTime(performanceSummary.firstPaint) }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">首次内容绘制</span>
              <span class="summary-value">{{ formatTime(performanceSummary.firstContentfulPaint) }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Alerts Tab -->
    <section v-else-if="activeTab === 'alerts'" class="admin-section">
      <div class="alerts-panel">
        <div class="panel-header">
          <h3>系统警告和通知</h3>
          <div class="alert-controls">
            <select v-model="alertFilter" class="alert-filter">
              <option value="all">所有警告</option>
              <option value="error">错误</option>
              <option value="warning">警告</option>
              <option value="info">信息</option>
            </select>
            <button 
              class="btn btn--ghost btn--compact"
              @click="clearAllAlerts"
              :disabled="filteredAlerts.length === 0"
            >
              <Trash2 :size="16" />
              清除所有
            </button>
          </div>
        </div>

        <div v-if="filteredAlerts.length === 0" class="empty-alerts">
          <Bell :size="48" />
          <h4>暂无警告</h4>
          <p>系统运行正常，没有需要关注的警告信息</p>
        </div>

        <div v-else class="alerts-list">
          <div 
            v-for="alert in filteredAlerts" 
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
              <div class="alert-header">
                <h4>{{ alert.title }}</h4>
                <span class="alert-time">{{ formatAlertTime(alert.timestamp) }}</span>
              </div>
              <p class="alert-message">{{ alert.message }}</p>
              <div v-if="alert.actions && alert.actions.length > 0" class="alert-actions">
                <button 
                  v-for="action in alert.actions"
                  :key="action.id"
                  class="btn btn--primary btn--compact"
                  @click="executeAlertAction(alert, action)"
                >
                  {{ action.label }}
                </button>
              </div>
            </div>
            <button 
              class="alert-dismiss"
              @click="dismissAlert(alert.id)"
            >
              <X :size="16" />
            </button>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { 
  ArrowLeft,
  Activity,
  Wifi,
  WifiOff,
  Server,
  Bell,
  Zap,
  Clock,
  Download,
  Shield,
  RefreshCw,
  Loader2,
  Monitor,
  Smartphone,
  HardDrive,
  Database,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  Trash2
} from 'lucide-vue-next'
import { useAppStore } from '../store/appStore'
import PerformanceMonitoringDashboard from '../components/admin/PerformanceMonitoringDashboard.vue'

// Types
interface NetworkEvent {
  id: string
  type: 'online' | 'offline'
  message: string
  timestamp: Date
}

interface SystemInfo {
  userAgent: string
  language: string
  timezone: string
  screenResolution: string
  availableResolution: string
  pixelRatio: number
  memoryUsage: {
    used: number
    total: number
    percentage: number
  }
  localStorage: boolean
  sessionStorage: boolean
  indexedDB: boolean
}

interface PerformanceSummary {
  pageLoadTime: number
  domContentLoaded: number
  firstPaint: number
  firstContentfulPaint: number
}

interface SystemAlert {
  id: string
  title: string
  message: string
  severity: 'info' | 'warning' | 'error'
  timestamp: Date
  actions?: Array<{
    id: string
    label: string
    handler: () => void
  }>
}

// Router and store
const router = useRouter()
const store = useAppStore()

// Reactive state
const activeTab = ref<'performance' | 'network' | 'system' | 'alerts'>('performance')
const refreshingSystem = ref(false)
const alertFilter = ref<'all' | 'error' | 'warning' | 'info'>('all')

// Network state
const networkInfo = ref({
  connectionType: 'unknown',
  effectiveType: 'unknown',
  rtt: 0,
  downlink: 0,
  saveData: false
})

const networkHistory = ref<NetworkEvent[]>([])

// System information
const systemInfo = ref<SystemInfo>({
  userAgent: '',
  language: '',
  timezone: '',
  screenResolution: '',
  availableResolution: '',
  pixelRatio: 1,
  memoryUsage: {
    used: 0,
    total: 0,
    percentage: 0
  },
  localStorage: false,
  sessionStorage: false,
  indexedDB: false
})

const performanceSummary = ref<PerformanceSummary>({
  pageLoadTime: 0,
  domContentLoaded: 0,
  firstPaint: 0,
  firstContentfulPaint: 0
})

// Alerts
const systemAlerts = ref<SystemAlert[]>([])

// Computed properties
const networkStatusClass = computed(() => {
  if (!store.isOnline) return 'status-offline'
  return store.connectionQuality === 'fast' ? 'status-online' : 'status-slow'
})

const networkStatusText = computed(() => {
  if (!store.isOnline) return '离线'
  return store.connectionQuality === 'fast' ? '连接良好' : '连接较慢'
})

const totalAlerts = computed(() => {
  return systemAlerts.value.filter(alert => alert.severity === 'error' || alert.severity === 'warning').length
})

const filteredAlerts = computed(() => {
  if (alertFilter.value === 'all') {
    return systemAlerts.value
  }
  return systemAlerts.value.filter(alert => alert.severity === alertFilter.value)
})

// Methods
const refreshSystemInfo = async () => {
  refreshingSystem.value = true
  
  try {
    // Collect system information
    systemInfo.value = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screenResolution: `${screen.width}x${screen.height}`,
      availableResolution: `${screen.availWidth}x${screen.availHeight}`,
      pixelRatio: window.devicePixelRatio,
      memoryUsage: getMemoryUsage(),
      localStorage: isStorageSupported('localStorage'),
      sessionStorage: isStorageSupported('sessionStorage'),
      indexedDB: 'indexedDB' in window
    }
    
    // Collect performance information
    if (performance && performance.timing) {
      const timing = performance.timing
      performanceSummary.value = {
        pageLoadTime: timing.loadEventEnd - timing.navigationStart,
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        firstPaint: getFirstPaint(),
        firstContentfulPaint: getFirstContentfulPaint()
      }
    }
    
    // Update network information
    updateNetworkInfo()
    
  } catch (error) {
    console.error('Failed to refresh system info:', error)
    addSystemAlert({
      id: `system_error_${Date.now()}`,
      title: '系统信息获取失败',
      message: '无法获取完整的系统信息，部分功能可能受限',
      severity: 'warning',
      timestamp: new Date()
    })
  } finally {
    refreshingSystem.value = false
  }
}

const updateNetworkInfo = () => {
  const connection = (navigator as any).connection || 
                    (navigator as any).mozConnection || 
                    (navigator as any).webkitConnection

  if (connection) {
    networkInfo.value = {
      connectionType: connection.type || 'unknown',
      effectiveType: connection.effectiveType || 'unknown',
      rtt: connection.rtt || 0,
      downlink: connection.downlink || 0,
      saveData: connection.saveData || false
    }
  }
}

const getMemoryUsage = () => {
  if ('memory' in performance) {
    const memory = (performance as any).memory
    const used = memory.usedJSHeapSize || 0
    const total = memory.totalJSHeapSize || 0
    return {
      used,
      total,
      percentage: total > 0 ? Math.round((used / total) * 100) : 0
    }
  }
  return { used: 0, total: 0, percentage: 0 }
}

const isStorageSupported = (type: 'localStorage' | 'sessionStorage'): boolean => {
  try {
    const storage = window[type]
    const test = '__storage_test__'
    storage.setItem(test, test)
    storage.removeItem(test)
    return true
  } catch {
    return false
  }
}

const getFirstPaint = (): number => {
  if (performance && performance.getEntriesByType) {
    const paintEntries = performance.getEntriesByType('paint')
    const firstPaint = paintEntries.find(entry => entry.name === 'first-paint')
    return firstPaint ? firstPaint.startTime : 0
  }
  return 0
}

const getFirstContentfulPaint = (): number => {
  if (performance && performance.getEntriesByType) {
    const paintEntries = performance.getEntriesByType('paint')
    const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint')
    return firstContentfulPaint ? firstContentfulPaint.startTime : 0
  }
  return 0
}

const addNetworkEvent = (type: 'online' | 'offline') => {
  const event: NetworkEvent = {
    id: `network_${Date.now()}`,
    type,
    message: type === 'online' ? '网络连接已恢复' : '网络连接已断开',
    timestamp: new Date()
  }
  
  networkHistory.value.unshift(event)
  
  // Keep only last 20 events
  if (networkHistory.value.length > 20) {
    networkHistory.value = networkHistory.value.slice(0, 20)
  }
  
  // Add system alert for network changes
  if (type === 'offline') {
    addSystemAlert({
      id: `network_offline_${Date.now()}`,
      title: '网络连接中断',
      message: '检测到网络连接中断，部分功能可能无法正常使用',
      severity: 'error',
      timestamp: new Date()
    })
  }
}

const addSystemAlert = (alert: SystemAlert) => {
  systemAlerts.value.unshift(alert)
  
  // Keep only last 50 alerts
  if (systemAlerts.value.length > 50) {
    systemAlerts.value = systemAlerts.value.slice(0, 50)
  }
}

const dismissAlert = (alertId: string) => {
  systemAlerts.value = systemAlerts.value.filter(alert => alert.id !== alertId)
}

const clearAllAlerts = () => {
  systemAlerts.value = []
}

const executeAlertAction = (alert: SystemAlert, action: any) => {
  try {
    action.handler()
    dismissAlert(alert.id)
  } catch (error) {
    console.error('Failed to execute alert action:', error)
    store.setBanner('error', '执行操作失败')
  }
}

// Utility functions
const formatTime = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

const formatAlertTime = (timestamp: Date): string => {
  const now = new Date()
  const diff = now.getTime() - timestamp.getTime()
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return timestamp.toLocaleDateString()
}

const getLatencyClass = (rtt: number): string => {
  if (rtt <= 50) return 'status-good'
  if (rtt <= 150) return 'status-warning'
  return 'status-error'
}

const getLatencyText = (rtt: number): string => {
  if (rtt <= 50) return '延迟很低'
  if (rtt <= 150) return '延迟适中'
  return '延迟较高'
}

const getSpeedClass = (downlink: number): string => {
  if (downlink >= 10) return 'status-good'
  if (downlink >= 1) return 'status-warning'
  return 'status-error'
}

const getSpeedText = (downlink: number): string => {
  if (downlink >= 10) return '速度很快'
  if (downlink >= 1) return '速度适中'
  return '速度较慢'
}

const getMemoryUsageClass = (percentage: number): string => {
  if (percentage <= 70) return 'status-good'
  if (percentage <= 85) return 'status-warning'
  return 'status-error'
}

// Event listeners
let networkStateCleanup: (() => void) | null = null

// Lifecycle
onMounted(() => {
  refreshSystemInfo()
  
  // Listen for network state changes
  const handleOnline = () => addNetworkEvent('online')
  const handleOffline = () => addNetworkEvent('offline')
  
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  
  networkStateCleanup = () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
  
  // Add initial network event
  addNetworkEvent(navigator.onLine ? 'online' : 'offline')
  
  // Add some sample alerts for demonstration
  addSystemAlert({
    id: 'welcome',
    title: '欢迎使用性能监控',
    message: '系统监控已启动，将持续跟踪性能指标和网络状态',
    severity: 'info',
    timestamp: new Date()
  })
})

onUnmounted(() => {
  if (networkStateCleanup) {
    networkStateCleanup()
  }
})
</script>

<style scoped>
.admin-dashboard-page {
  margin: 0;
  padding: 2rem 1rem 6rem;
  color: var(--ink);
  background: var(--bg);
  min-height: 100vh;
}

.page-head {
  margin-bottom: 2rem;
}

.head-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.head-content h1 {
  margin: 0;
  font-size: 1.75rem;
  font-family: 'Sora', sans-serif;
}

.head-content p {
  margin: 0.25rem 0 0;
  font-size: 0.95rem;
}

.admin-tabs {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 1.5rem;
  background: none;
  border: none;
  font-size: 1rem;
  font-weight: 500;
  color: var(--muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
  white-space: nowrap;
  position: relative;
}

.tab-btn.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.tab-btn:hover:not(.active) {
  color: var(--ink);
}

.alert-badge {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: var(--danger);
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.125rem 0.375rem;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

.admin-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Network Status Panel */
.network-status-panel,
.system-info-panel,
.alerts-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border);
}

.panel-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-online .status-dot {
  background: #22c55e;
}

.status-slow .status-dot {
  background: #f59e0b;
}

.status-offline .status-dot {
  background: var(--danger);
}

.network-metrics-grid,
.system-metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  padding: 1.5rem;
}

.metric-card,
.system-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: var(--surface-muted);
  border-radius: 8px;
  transition: all 0.18s ease;
}

.metric-card:hover,
.system-card:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.metric-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent);
  flex-shrink: 0;
}

.metric-content {
  flex: 1;
}

.metric-content h4 {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--muted);
  margin: 0 0 0.25rem 0;
}

.metric-value {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0 0 0.25rem 0;
}

.metric-detail {
  font-size: 0.75rem;
  margin: 0;
}

.status-good { color: #22c55e; }
.status-warning { color: #f59e0b; }
.status-error { color: var(--danger); }

/* Network History */
.network-history {
  padding: 1.5rem;
  border-top: 1px solid var(--border);
}

.network-history h4 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0 0 1rem 0;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 300px;
  overflow-y: auto;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--surface);
  border-radius: 6px;
  border-left: 3px solid transparent;
}

.history-item--online {
  border-left-color: #22c55e;
}

.history-item--offline {
  border-left-color: var(--danger);
}

.history-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--surface-muted);
  flex-shrink: 0;
}

.history-content {
  flex: 1;
}

.history-message {
  font-size: 0.875rem;
  color: var(--ink);
  margin: 0 0 0.25rem 0;
}

.history-time {
  font-size: 0.75rem;
  color: var(--muted);
}

/* System Information */
.system-card {
  flex-direction: column;
  align-items: stretch;
  gap: 1rem;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-header h4 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.info-label {
  font-size: 0.875rem;
  color: var(--muted);
  flex-shrink: 0;
}

.info-value {
  font-size: 0.875rem;
  color: var(--ink);
  font-weight: 500;
  text-align: right;
  word-break: break-all;
}

/* Performance Summary */
.performance-summary {
  padding: 1.5rem;
  border-top: 1px solid var(--border);
}

.performance-summary h4 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0 0 1rem 0;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 1rem;
  background: var(--surface);
  border-radius: 6px;
}

.summary-label {
  font-size: 0.75rem;
  color: var(--muted);
}

.summary-value {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--ink);
}

/* Alerts Panel */
.alert-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.alert-filter {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink);
  font-size: 0.875rem;
}

.empty-alerts {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 4rem 2rem;
  color: var(--muted);
}

.empty-alerts h4 {
  font-size: 1.25rem;
  color: var(--ink);
  margin: 0;
}

.empty-alerts p {
  margin: 0;
  text-align: center;
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

.alert-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.alert-header h4 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0;
}

.alert-time {
  font-size: 0.75rem;
  color: var(--muted);
  flex-shrink: 0;
}

.alert-message {
  font-size: 0.8rem;
  color: var(--muted);
  margin: 0 0 1rem 0;
  line-height: 1.4;
}

.alert-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
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
  flex-shrink: 0;
}

.alert-dismiss:hover {
  background: var(--surface-muted);
  color: var(--ink);
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
  .network-metrics-grid,
  .system-metrics-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }
  
  .summary-grid {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }
}

@media (max-width: 768px) {
  .admin-dashboard-page {
    padding: 1rem;
  }
  
  .panel-header {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
  
  .alert-controls {
    justify-content: space-between;
  }
  
  .network-metrics-grid,
  .system-metrics-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  .metric-card,
  .system-card {
    padding: 1rem;
  }
  
  .alert-item {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
  
  .alert-header {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }
  
  .info-row {
    flex-direction: column;
    align-items: stretch;
    gap: 0.25rem;
  }
  
  .info-value {
    text-align: left;
  }
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .metric-card,
  .system-card,
  .alert-item,
  .alert-dismiss {
    transition: none;
  }
  
  .spin {
    animation: none;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .network-status-panel,
  .system-info-panel,
  .alerts-panel,
  .metric-card,
  .system-card {
    border-width: 2px;
  }
}
</style>