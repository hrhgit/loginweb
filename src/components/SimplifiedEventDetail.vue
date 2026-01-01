<template>
  <div class="simplified-event-detail">
    <div class="simplified-event-detail__header">
      <div class="simplified-event-detail__icon">
        <AlertTriangle :size="48" />
      </div>
      <h1 class="simplified-event-detail__title">活动详情暂时无法加载</h1>
      <p class="simplified-event-detail__message">
        页面模块加载遇到问题，我们为您提供了简化版本的活动信息
      </p>
    </div>

    <div class="simplified-event-detail__content">
      <!-- 基本活动信息 -->
      <div v-if="eventData" class="simplified-card">
        <h2>{{ eventData.title || '活动标题' }}</h2>
        <div class="simplified-meta">
          <div class="simplified-meta__item">
            <Clock :size="16" />
            <span>{{ formatTimeRange(eventData.start_time, eventData.end_time) }}</span>
          </div>
          <div class="simplified-meta__item">
            <MapPin :size="16" />
            <span>{{ eventData.location || '地点待定' }}</span>
          </div>
          <div class="simplified-meta__item">
            <Users :size="16" />
            <span>最大队伍人数：{{ eventData.team_max_size || '不限' }}</span>
          </div>
        </div>
        <p class="simplified-description">
          {{ eventData.description || '活动描述暂时无法显示' }}
        </p>
      </div>

      <!-- 离线缓存信息 -->
      <div v-if="cachedData" class="simplified-card">
        <h3>缓存信息</h3>
        <p class="muted">显示的是本地缓存的活动信息，可能不是最新版本</p>
        <div class="simplified-cache-info">
          <span class="cache-timestamp">
            缓存时间：{{ formatCacheTime(cachedData.timestamp) }}
          </span>
        </div>
      </div>

      <!-- 功能状态 -->
      <div class="simplified-card">
        <h3>可用功能</h3>
        <div class="simplified-features">
          <div class="feature-item" :class="{ 'feature-item--disabled': !isOnline }">
            <Wifi :size="16" />
            <span>网络连接</span>
            <span class="feature-status">{{ isOnline ? '正常' : '离线' }}</span>
          </div>
          <div class="feature-item" :class="{ 'feature-item--disabled': !canViewCachedContent }">
            <Database :size="16" />
            <span>缓存内容</span>
            <span class="feature-status">{{ canViewCachedContent ? '可用' : '不可用' }}</span>
          </div>
          <div class="feature-item" :class="{ 'feature-item--disabled': !canSubmitForms }">
            <Send :size="16" />
            <span>表单提交</span>
            <span class="feature-status">{{ canSubmitForms ? '可用' : '需要网络' }}</span>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="simplified-actions">
        <button 
          class="btn btn--primary btn--lg"
          @click="retryLoading"
          :disabled="retryLoading"
        >
          <RefreshCw :size="18" :class="{ 'animate-spin': isRetrying }" />
          {{ isRetrying ? '重新加载中...' : '重新加载页面' }}
        </button>
        
        <button 
          class="btn btn--ghost btn--lg"
          @click="goToEventsList"
        >
          <ArrowLeft :size="18" />
          返回活动列表
        </button>

        <button 
          v-if="isOnline && eventData"
          class="btn btn--ghost btn--lg"
          @click="openBasicRegistration"
          :disabled="!canRegister"
        >
          <UserPlus :size="18" />
          {{ canRegister ? '基础报名' : '无法报名' }}
        </button>
      </div>

      <!-- 错误信息 -->
      <div v-if="errorInfo" class="simplified-card simplified-card--error">
        <h3>错误详情</h3>
        <p class="error-message">{{ errorInfo.message }}</p>
        <details class="error-details">
          <summary>技术详情</summary>
          <pre>{{ errorInfo.details }}</pre>
        </details>
      </div>

      <!-- 帮助信息 -->
      <div class="simplified-card simplified-card--help">
        <h3>需要帮助？</h3>
        <ul class="help-list">
          <li>检查网络连接是否正常</li>
          <li>尝试刷新页面或清除浏览器缓存</li>
          <li>如果问题持续存在，请联系技术支持</li>
          <li v-if="!isOnline">当前处于离线状态，部分功能不可用</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { 
  AlertTriangle, 
  Clock, 
  MapPin, 
  Users, 
  Wifi, 
  Database, 
  Send, 
  RefreshCw, 
  ArrowLeft, 
  UserPlus 
} from 'lucide-vue-next'
import { useOfflineManager } from '../utils/offlineManager'
import { useAppStore } from '../store/appStore'
import { formatTimeRange } from '../utils/eventFormat'

// Props
interface Props {
  eventId?: string
  errorInfo?: {
    message: string
    details: string
    type: 'MIME_ERROR' | 'NETWORK_ERROR' | 'TIMEOUT_ERROR'
  }
}

const props = withDefaults(defineProps<Props>(), {
  eventId: '',
  errorInfo: undefined
})

// Composables
const router = useRouter()
const route = useRoute()
const store = useAppStore()
const { isOnline, isOffline, getOfflineCapability, isPageAvailableOffline } = useOfflineManager()

// Reactive state
const isRetrying = ref(false)
const eventData = ref<any>(null)
const cachedData = ref<any>(null)

// Computed properties
const canViewCachedContent = computed(() => {
  const capability = getOfflineCapability()
  return capability.canViewCachedPages
})

const canSubmitForms = computed(() => {
  const capability = getOfflineCapability()
  return capability.canSubmitForms
})

const canRegister = computed(() => {
  return isOnline.value && eventData.value && eventData.value.status === 'published'
})

// Methods
const retryLoading = async () => {
  isRetrying.value = true
  
  try {
    // 等待一小段时间显示加载状态
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 尝试重新加载完整页面
    window.location.reload()
  } catch (error) {
    console.error('Retry failed:', error)
    store.setBanner('error', '重新加载失败，请检查网络连接')
  } finally {
    isRetrying.value = false
  }
}

const goToEventsList = () => {
  router.push('/events')
}

const openBasicRegistration = () => {
  if (!canRegister.value) return
  
  // 简化的报名流程
  const confirmed = window.confirm('确定要报名参加这个活动吗？')
  if (confirmed) {
    store.setBanner('info', '报名功能需要完整页面加载，请稍后重试')
  }
}

const formatCacheTime = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN')
}

const loadCachedEventData = async () => {
  if (!props.eventId) return
  
  try {
    // 尝试从本地存储获取缓存的活动数据
    const cached = localStorage.getItem(`event_${props.eventId}`)
    if (cached) {
      const parsedCache = JSON.parse(cached)
      eventData.value = parsedCache.data
      cachedData.value = {
        timestamp: parsedCache.timestamp || Date.now()
      }
    }
  } catch (error) {
    console.error('Failed to load cached event data:', error)
  }
}

const loadBasicEventInfo = async () => {
  // 如果有eventId，尝试获取基本信息
  const currentEventId = props.eventId || route.params.id as string
  
  if (currentEventId && isOnline.value) {
    try {
      // 尝试直接从store获取事件信息
      const storeEvent = store.events.find(e => e.id === currentEventId)
      if (storeEvent) {
        eventData.value = storeEvent
      }
    } catch (error) {
      console.error('Failed to load basic event info:', error)
    }
  }
}

// Lifecycle
onMounted(async () => {
  await loadCachedEventData()
  await loadBasicEventInfo()
})
</script>

<style scoped>
.simplified-event-detail {
  min-height: 100vh;
  padding: 2rem 1rem;
  background: var(--bg);
}

.simplified-event-detail__header {
  text-align: center;
  margin-bottom: 2rem;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.simplified-event-detail__icon {
  color: var(--accent-2);
  margin-bottom: 1rem;
}

.simplified-event-detail__title {
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
  color: var(--ink);
  margin-bottom: 0.5rem;
}

.simplified-event-detail__message {
  font-size: var(--text-base);
  color: var(--muted);
  line-height: var(--leading-relaxed);
}

.simplified-event-detail__content {
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.simplified-card {
  background: var(--surface);
  border-radius: var(--card-radius);
  padding: var(--card-padding);
  box-shadow: var(--card-shadow);
}

.simplified-card--error {
  border-left: 4px solid var(--danger);
  background: rgba(182, 45, 28, 0.05);
}

.simplified-card--help {
  border-left: 4px solid var(--accent);
  background: var(--accent-soft);
}

.simplified-card h2 {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--ink);
  margin-bottom: 1rem;
}

.simplified-card h3 {
  font-size: var(--text-lg);
  font-weight: var(--font-medium);
  color: var(--ink);
  margin-bottom: 0.75rem;
}

.simplified-meta {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.simplified-meta__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: var(--text-sm);
  color: var(--muted);
}

.simplified-description {
  color: var(--ink);
  line-height: var(--leading-relaxed);
}

.simplified-cache-info {
  padding: 0.75rem;
  background: var(--surface-muted);
  border-radius: var(--radius-md);
  margin-top: 0.5rem;
}

.cache-timestamp {
  font-size: var(--text-sm);
  color: var(--muted);
}

.simplified-features {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--surface-muted);
  border-radius: var(--radius-md);
  transition: var(--transition-colors);
}

.feature-item--disabled {
  opacity: 0.6;
  background: var(--surface-muted);
}

.feature-status {
  margin-left: auto;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

.simplified-actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}

.error-message {
  color: var(--danger);
  font-weight: var(--font-medium);
  margin-bottom: 0.5rem;
}

.error-details {
  margin-top: 0.75rem;
}

.error-details summary {
  cursor: pointer;
  font-weight: var(--font-medium);
  color: var(--muted);
}

.error-details pre {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: var(--surface-muted);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--muted);
  overflow-x: auto;
}

.help-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.help-list li {
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border);
  color: var(--ink);
}

.help-list li:last-child {
  border-bottom: none;
}

.help-list li::before {
  content: '•';
  color: var(--accent);
  margin-right: 0.5rem;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Responsive design */
@media (min-width: 640px) {
  .simplified-actions {
    flex-direction: row;
    justify-content: center;
  }
  
  .simplified-meta {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 1rem;
  }
  
  .simplified-features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }
}
</style>