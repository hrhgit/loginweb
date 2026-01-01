<template>
  <div class="module-load-error-page">
    <div class="module-load-error-page__container">
      <!-- Error Icon and Title -->
      <div class="module-load-error-page__header">
        <div class="module-load-error-page__icon">
          <AlertCircle :size="48" />
        </div>
        <h1 class="module-load-error-page__title">页面加载失败</h1>
        <p class="module-load-error-page__subtitle">
          {{ errorMessage }}
        </p>
      </div>

      <!-- Error Details (Collapsible) -->
      <div v-if="showDetails" class="module-load-error-page__details">
        <button 
          class="module-load-error-page__details-toggle"
          @click="toggleDetails"
          :aria-expanded="detailsExpanded"
        >
          <ChevronDown 
            :size="16" 
            :class="{ 'rotated': detailsExpanded }"
          />
          错误详情
        </button>
        
        <div v-if="detailsExpanded" class="module-load-error-page__details-content">
          <div class="error-detail-item">
            <strong>错误类型:</strong> {{ errorType }}
          </div>
          <div class="error-detail-item">
            <strong>模块路径:</strong> {{ modulePath }}
          </div>
          <div class="error-detail-item">
            <strong>时间:</strong> {{ formatTime(errorTime) }}
          </div>
          <div v-if="retryCount > 0" class="error-detail-item">
            <strong>重试次数:</strong> {{ retryCount }}
          </div>
          <div v-if="originalError" class="error-detail-item">
            <strong>原始错误:</strong> 
            <code class="error-code">{{ originalError }}</code>
          </div>
        </div>
      </div>

      <!-- Loading State Indicator -->
      <LoadingStateIndicator
        v-if="isRetrying || isRefreshing"
        :visible="true"
        :state="isRetrying ? 'loading' : 'info'"
        :message="loadingMessage"
        :show-spinner="true"
        :show-network-quality="true"
        variant="card"
        size="medium"
      />

      <!-- Action Buttons -->
      <div class="module-load-error-page__actions">
        <button 
          class="btn btn--primary"
          @click="handleRetry"
          :disabled="isRetrying || hasExceededMaxRetries"
        >
          <RotateCcw :size="16" />
          {{ retryButtonText }}
        </button>
        
        <button 
          class="btn btn--ghost"
          @click="handleRefresh"
          :disabled="isRefreshing"
        >
          <RefreshCw :size="16" />
          刷新页面
        </button>
        
        <button 
          class="btn btn--flat"
          @click="handleGoHome"
        >
          <Home :size="16" />
          返回首页
        </button>
      </div>

      <!-- Suggestions -->
      <div v-if="suggestions.length > 0" class="module-load-error-page__suggestions">
        <h3 class="suggestions-title">建议解决方案</h3>
        <ul class="suggestions-list">
          <li v-for="suggestion in suggestions" :key="suggestion" class="suggestion-item">
            <CheckCircle :size="16" />
            {{ suggestion }}
          </li>
        </ul>
      </div>

      <!-- Network Status -->
      <div v-if="showNetworkStatus" class="module-load-error-page__network">
        <div class="network-status">
          <component :is="networkIcon" :size="16" />
          <span class="network-text">{{ networkStatusText }}</span>
        </div>
      </div>

      <!-- Timeout Indicator -->
      <div v-if="showTimeout" class="module-load-error-page__timeout">
        <Clock :size="16" />
        <span>{{ timeoutMessage }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { 
  AlertCircle, 
  ChevronDown, 
  RotateCcw, 
  RefreshCw, 
  Home, 
  CheckCircle,
  Clock,
  Wifi,
  WifiOff,
  Signal
} from 'lucide-vue-next'
import LoadingStateIndicator from './LoadingStateIndicator.vue'
import { useAppStore } from '../../store/appStore'
import { moduleLoader, type LoadError } from '../../utils/moduleLoader'
import { errorHandler } from '../../utils/errorHandler'

interface Props {
  // Error information
  error?: Error | LoadError
  modulePath?: string
  errorType?: 'MIME_ERROR' | 'NETWORK_ERROR' | 'TIMEOUT_ERROR' | 'UNKNOWN'
  
  // Retry configuration
  maxRetries?: number
  retryDelay?: number
  
  // UI configuration
  showDetails?: boolean
  showNetworkStatus?: boolean
  showTimeout?: boolean
  
  // Callbacks
  onRetry?: () => Promise<void>
  onRefresh?: () => void
  onGoHome?: () => void
}

const props = withDefaults(defineProps<Props>(), {
  maxRetries: 3,
  retryDelay: 1000,
  showDetails: true,
  showNetworkStatus: true,
  showTimeout: false
})

const emit = defineEmits<{
  retry: []
  refresh: []
  goHome: []
}>()

const router = useRouter()
const store = useAppStore()

// Component state
const isRetrying = ref(false)
const isRefreshing = ref(false)
const retryCount = ref(0)
const detailsExpanded = ref(false)
const errorTime = ref(new Date())
const timeoutTimer = ref<number>()

// Computed properties
const errorMessage = computed(() => {
  if (props.error && 'message' in props.error) {
    return props.error.message
  }
  
  switch (props.errorType) {
    case 'MIME_ERROR':
      return '页面资源加载失败，服务器返回了错误的文件类型'
    case 'NETWORK_ERROR':
      return '网络连接失败，请检查网络连接后重试'
    case 'TIMEOUT_ERROR':
      return '页面加载超时，请检查网络连接'
    default:
      return '页面加载时发生未知错误'
  }
})

const originalError = computed(() => {
  if (props.error && 'originalError' in props.error) {
    return props.error.originalError?.message || ''
  }
  return props.error?.message || ''
})

const hasExceededMaxRetries = computed(() => {
  return retryCount.value >= props.maxRetries
})

const retryButtonText = computed(() => {
  if (isRetrying.value) {
    return '重试中...'
  }
  if (hasExceededMaxRetries.value) {
    return `已达重试上限 (${props.maxRetries})`
  }
  if (retryCount.value > 0) {
    return `重试 (${retryCount.value}/${props.maxRetries})`
  }
  return '重试'
})

const loadingMessage = computed(() => {
  if (isRetrying.value) {
    return `正在重试加载页面... (${retryCount.value}/${props.maxRetries})`
  }
  if (isRefreshing.value) {
    return '正在刷新页面...'
  }
  return '加载中...'
})

const suggestions = computed(() => {
  const baseSuggestions = []
  
  switch (props.errorType) {
    case 'MIME_ERROR':
      baseSuggestions.push(
        '刷新页面重新加载',
        '清除浏览器缓存后重试',
        '检查网络连接是否稳定'
      )
      break
    case 'NETWORK_ERROR':
      baseSuggestions.push(
        '检查网络连接',
        '尝试切换网络环境',
        '稍后再试'
      )
      break
    case 'TIMEOUT_ERROR':
      baseSuggestions.push(
        '检查网络速度',
        '关闭其他占用网络的应用',
        '稍后重试'
      )
      break
    default:
      baseSuggestions.push(
        '刷新页面',
        '检查网络连接',
        '联系技术支持'
      )
  }
  
  return baseSuggestions
})

// Network status
const networkState = computed(() => store.networkState)
const connectionQuality = computed(() => store.connectionQuality)

const networkIcon = computed(() => {
  if (!networkState.value.isOnline) return WifiOff
  return connectionQuality.value === 'slow' ? Signal : Wifi
})

const networkStatusText = computed(() => {
  if (!networkState.value.isOnline) {
    return '网络连接已断开'
  }
  if (connectionQuality.value === 'slow') {
    return '网络连接较慢'
  }
  return '网络连接正常'
})

const timeoutMessage = computed(() => {
  const elapsed = Math.floor((Date.now() - errorTime.value.getTime()) / 1000)
  return `页面加载已超时 ${elapsed} 秒`
})

// Methods
const toggleDetails = () => {
  detailsExpanded.value = !detailsExpanded.value
}

const handleRetry = async () => {
  if (isRetrying.value || hasExceededMaxRetries.value) {
    return
  }

  isRetrying.value = true
  retryCount.value++

  try {
    // Call custom retry handler if provided
    if (props.onRetry) {
      await props.onRetry()
    } else {
      // Default retry behavior - reload the current route
      await router.replace(router.currentRoute.value.fullPath)
    }
    
    emit('retry')
  } catch (error) {
    // Handle retry failure
    errorHandler.handleError(error, {
      operation: 'retryModuleLoad',
      component: 'moduleLoadErrorPage',
      additionalData: { 
        modulePath: props.modulePath,
        retryCount: retryCount.value 
      }
    })
  } finally {
    isRetrying.value = false
  }
}

const handleRefresh = () => {
  if (isRefreshing.value) {
    return
  }

  isRefreshing.value = true
  
  if (props.onRefresh) {
    props.onRefresh()
  } else {
    // Default refresh behavior
    window.location.reload()
  }
  
  emit('refresh')
}

const handleGoHome = () => {
  if (props.onGoHome) {
    props.onGoHome()
  } else {
    // Default go home behavior
    router.push('/events')
  }
  
  emit('goHome')
}

const formatTime = (date: Date): string => {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// Lifecycle
onMounted(() => {
  // Log the error occurrence
  errorHandler.handleError(props.error || new Error('Module load error'), {
    operation: 'displayModuleLoadError',
    component: 'moduleLoadErrorPage',
    additionalData: {
      modulePath: props.modulePath,
      errorType: props.errorType
    }
  })

  // Start timeout timer if enabled
  if (props.showTimeout) {
    timeoutTimer.value = window.setInterval(() => {
      // Force reactivity update for timeout message
      errorTime.value = errorTime.value
    }, 1000)
  }
})

onUnmounted(() => {
  if (timeoutTimer.value) {
    clearInterval(timeoutTimer.value)
  }
})
</script>

<style scoped>
.module-load-error-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  background: var(--bg);
  font-family: 'Work Sans', sans-serif;
}

.module-load-error-page__container {
  max-width: 600px;
  width: 100%;
  background: var(--surface);
  border-radius: var(--radius-xl);
  padding: 3rem 2rem;
  box-shadow: var(--shadow-lg);
  text-align: center;
}

/* Header */
.module-load-error-page__header {
  margin-bottom: 2rem;
}

.module-load-error-page__icon {
  color: var(--danger);
  margin-bottom: 1rem;
  display: flex;
  justify-content: center;
}

.module-load-error-page__title {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--ink);
  margin: 0 0 0.75rem 0;
  font-family: 'Sora', sans-serif;
}

.module-load-error-page__subtitle {
  font-size: var(--text-base);
  color: var(--muted);
  line-height: var(--leading-relaxed);
  margin: 0;
}

/* Error Details */
.module-load-error-page__details {
  margin-bottom: 2rem;
  text-align: left;
}

.module-load-error-page__details-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  color: var(--accent);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  padding: 0.5rem 0;
  transition: var(--transition-colors);
  width: 100%;
  justify-content: center;
}

.module-load-error-page__details-toggle:hover {
  color: var(--accent-2);
}

.module-load-error-page__details-toggle svg {
  transition: transform 0.2s ease;
}

.module-load-error-page__details-toggle svg.rotated {
  transform: rotate(180deg);
}

.module-load-error-page__details-content {
  background: var(--surface-muted);
  border-radius: var(--radius-md);
  padding: 1rem;
  margin-top: 0.75rem;
  font-size: var(--text-sm);
}

.error-detail-item {
  margin-bottom: 0.5rem;
  line-height: var(--leading-relaxed);
}

.error-detail-item:last-child {
  margin-bottom: 0;
}

.error-detail-item strong {
  color: var(--ink);
  font-weight: var(--font-medium);
}

.error-code {
  background: rgba(0, 0, 0, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875em;
  color: var(--danger);
  word-break: break-all;
  display: block;
  margin-top: 0.25rem;
}

/* Actions */
.module-load-error-page__actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 2rem;
}

.module-load-error-page__actions .btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.875rem 1.5rem;
  font-weight: var(--font-medium);
}

/* Suggestions */
.module-load-error-page__suggestions {
  margin-bottom: 2rem;
  text-align: left;
}

.suggestions-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--ink);
  margin: 0 0 1rem 0;
  text-align: center;
}

.suggestions-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.suggestion-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.5rem 0;
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
  color: var(--muted);
}

.suggestion-item svg {
  color: var(--accent);
  flex-shrink: 0;
  margin-top: 0.125rem;
}

/* Network Status */
.module-load-error-page__network {
  margin-bottom: 1rem;
}

.network-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: var(--text-sm);
  color: var(--muted);
  padding: 0.75rem;
  background: var(--surface-muted);
  border-radius: var(--radius-md);
}

.network-text {
  font-weight: var(--font-medium);
}

/* Timeout */
.module-load-error-page__timeout {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: var(--text-sm);
  color: var(--muted);
  padding: 0.75rem;
  background: rgba(224, 122, 95, 0.1);
  border-radius: var(--radius-md);
  border-left: 4px solid var(--accent-2);
}

/* Responsive Design */
@media (min-width: 640px) {
  .module-load-error-page__actions {
    flex-direction: row;
    justify-content: center;
  }
  
  .module-load-error-page__actions .btn {
    width: auto;
    min-width: 140px;
  }
}

@media (max-width: 480px) {
  .module-load-error-page__container {
    padding: 2rem 1.5rem;
  }
  
  .module-load-error-page__title {
    font-size: var(--text-xl);
  }
}

/* Loading state integration */
.module-load-error-page__container :deep(.loading-state-indicator--card) {
  margin-bottom: 1.5rem;
  background: var(--surface-muted);
}
</style>