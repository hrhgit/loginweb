<template>
  <Transition name="error-message" appear>
    <div 
      v-if="isVisible" 
      :class="errorClasses"
      class="enhanced-error-message"
    >
      <div class="enhanced-error-message__content">
        <!-- Error icon and title -->
        <div class="enhanced-error-message__header">
          <div class="enhanced-error-message__icon">
            <component :is="errorIcon" :size="iconSize" />
          </div>
          
          <div class="enhanced-error-message__title">
            <h4 class="error-title">{{ errorTitle }}</h4>
            <p class="error-message">{{ displayMessage }}</p>
          </div>
          
          <button 
            v-if="canDismiss"
            @click="handleDismiss"
            class="enhanced-error-message__close"
            aria-label="关闭错误消息"
          >
            <X :size="16" />
          </button>
        </div>
        
        <!-- Error details (expandable) -->
        <div v-if="hasDetails" class="enhanced-error-message__details">
          <button 
            @click="toggleDetails"
            class="details-toggle"
            :aria-expanded="showDetails"
          >
            <ChevronDown 
              :size="16" 
              :class="{ 'rotated': showDetails }"
              class="details-toggle__icon"
            />
            {{ showDetails ? '隐藏详情' : '查看详情' }}
          </button>
          
          <Transition name="details">
            <div v-if="showDetails" class="error-details">
              <div v-if="errorCode" class="error-code">
                错误代码: {{ errorCode }}
              </div>
              
              <div v-if="technicalDetails" class="technical-details">
                {{ technicalDetails }}
              </div>
              
              <div v-if="suggestions.length > 0" class="error-suggestions">
                <h5 class="suggestions-title">建议解决方案:</h5>
                <ul class="suggestions-list">
                  <li v-for="suggestion in suggestions" :key="suggestion">
                    {{ suggestion }}
                  </li>
                </ul>
              </div>
            </div>
          </Transition>
        </div>
        
        <!-- Network status info -->
        <div v-if="showNetworkInfo && isNetworkError" class="enhanced-error-message__network">
          <div class="network-info">
            <component :is="networkIcon" :size="14" />
            <span class="network-status">{{ networkStatusText }}</span>
          </div>
        </div>
        
        <!-- Action buttons -->
        <div v-if="showActions" class="enhanced-error-message__actions">
          <button 
            v-if="canRetry"
            @click="handleRetry"
            class="btn btn--primary btn--compact"
            :disabled="isRetrying"
          >
            <RefreshCw 
              :size="14" 
              :class="{ 'spinning': isRetrying }"
              class="retry-icon"
            />
            {{ retryButtonText }}
          </button>
          
          <button 
            v-if="canReload"
            @click="handleReload"
            class="btn btn--ghost btn--compact"
          >
            <RotateCcw :size="14" />
            重新加载页面
          </button>
          
          <button 
            v-if="canReport"
            @click="handleReport"
            class="btn btn--ghost btn--compact"
          >
            <Flag :size="14" />
            报告问题
          </button>
        </div>
        
        <!-- Retry countdown -->
        <div v-if="showCountdown && autoRetryCountdown > 0" class="enhanced-error-message__countdown">
          <div class="countdown-text">
            {{ autoRetryCountdown }} 秒后自动重试
          </div>
          <div class="countdown-bar">
            <div 
              class="countdown-bar__fill"
              :style="{ width: `${countdownPercentage}%` }"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { 
  AlertTriangle, 
  AlertCircle, 
  XCircle, 
  Wifi, 
  WifiOff, 
  X, 
  ChevronDown, 
  RefreshCw, 
  RotateCcw, 
  Flag 
} from 'lucide-vue-next'
import { networkManager } from '../../utils/networkManager'

interface Props {
  // Error information
  error?: Error | string | null
  errorCode?: string
  errorType?: 'network' | 'validation' | 'server' | 'client' | 'unknown'
  
  // Display options
  variant?: 'banner' | 'card' | 'inline'
  severity?: 'error' | 'warning' | 'critical'
  
  // Content
  title?: string
  message?: string
  technicalDetails?: string
  suggestions?: string[]
  
  // Behavior
  visible?: boolean
  canDismiss?: boolean
  canRetry?: boolean
  canReload?: boolean
  canReport?: boolean
  
  // Auto retry
  autoRetry?: boolean
  autoRetryDelay?: number // seconds
  maxRetries?: number
  
  // Features
  showNetworkInfo?: boolean
  showActions?: boolean
  showCountdown?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  errorType: 'unknown',
  variant: 'card',
  severity: 'error',
  suggestions: () => [],
  visible: true,
  canDismiss: true,
  canRetry: true,
  canReload: false,
  canReport: false,
  autoRetry: false,
  autoRetryDelay: 5,
  maxRetries: 3,
  showNetworkInfo: true,
  showActions: true,
  showCountdown: true
})

const emit = defineEmits<{
  dismiss: []
  retry: []
  reload: []
  report: [error: Error | string]
}>()

// State
const showDetails = ref(false)
const isRetrying = ref(false)
const retryCount = ref(0)
const autoRetryCountdown = ref(0)
const countdownTimer = ref<number | null>(null)

// Computed properties
const isVisible = computed(() => props.visible && (props.error || props.message))

const errorClasses = computed(() => [
  'enhanced-error-message',
  `enhanced-error-message--${props.variant}`,
  `enhanced-error-message--${props.severity}`
])

const errorTitle = computed(() => {
  if (props.title) return props.title
  
  switch (props.severity) {
    case 'critical': return '严重错误'
    case 'warning': return '警告'
    default: return '操作失败'
  }
})

const displayMessage = computed(() => {
  if (props.message) return props.message
  
  if (typeof props.error === 'string') return props.error
  
  if (props.error instanceof Error) {
    return props.error.message || '发生了未知错误'
  }
  
  return '操作无法完成，请稍后重试'
})

const errorIcon = computed(() => {
  switch (props.severity) {
    case 'critical': return XCircle
    case 'warning': return AlertTriangle
    default: return AlertCircle
  }
})

const iconSize = computed(() => {
  switch (props.variant) {
    case 'banner': return 20
    case 'inline': return 16
    default: return 18
  }
})

const hasDetails = computed(() => {
  return !!(props.errorCode || props.technicalDetails || props.suggestions.length > 0)
})

// Network information
const networkState = computed(() => networkManager.networkState)
const isOnline = computed(() => networkState.value.isOnline)

const isNetworkError = computed(() => {
  return props.errorType === 'network' || 
         !isOnline.value ||
         (props.error instanceof Error && 
          (props.error.message.includes('网络') || 
           props.error.message.includes('连接') ||
           props.error.message.includes('fetch')))
})

const networkIcon = computed(() => isOnline.value ? Wifi : WifiOff)

const networkStatusText = computed(() => {
  if (!isOnline.value) return '网络连接已断开'
  
  const quality = networkManager.connectionQuality
  switch (quality) {
    case 'slow': return '网络连接较慢'
    case 'fast': return '网络连接正常'
    default: return '检查网络连接'
  }
})

// Retry logic
const canActuallyRetry = computed(() => {
  return props.canRetry && retryCount.value < props.maxRetries
})

const retryButtonText = computed(() => {
  if (isRetrying.value) return '重试中...'
  if (retryCount.value > 0) return `重试 (${retryCount.value}/${props.maxRetries})`
  return '重试'
})

// Countdown
const countdownPercentage = computed(() => {
  if (props.autoRetryDelay <= 0) return 0
  return ((props.autoRetryDelay - autoRetryCountdown.value) / props.autoRetryDelay) * 100
})

// Event handlers
const handleDismiss = () => {
  stopCountdown()
  emit('dismiss')
}

const handleRetry = () => {
  if (!canActuallyRetry.value || isRetrying.value) return
  
  isRetrying.value = true
  retryCount.value++
  stopCountdown()
  
  emit('retry')
  
  // Reset retrying state after a delay
  setTimeout(() => {
    isRetrying.value = false
  }, 1000)
}

const handleReload = () => {
  emit('reload')
  window.location.reload()
}

const handleReport = () => {
  emit('report', props.error || props.message || 'Unknown error')
}

const toggleDetails = () => {
  showDetails.value = !showDetails.value
}

// Auto retry countdown
const startCountdown = () => {
  if (!props.autoRetry || !canActuallyRetry.value) return
  
  autoRetryCountdown.value = props.autoRetryDelay
  
  countdownTimer.value = window.setInterval(() => {
    autoRetryCountdown.value--
    
    if (autoRetryCountdown.value <= 0) {
      stopCountdown()
      handleRetry()
    }
  }, 1000)
}

const stopCountdown = () => {
  if (countdownTimer.value) {
    window.clearInterval(countdownTimer.value)
    countdownTimer.value = null
  }
  autoRetryCountdown.value = 0
}

// Lifecycle
onMounted(() => {
  if (props.autoRetry && isVisible.value) {
    startCountdown()
  }
})

onUnmounted(() => {
  stopCountdown()
})

// Watch for visibility changes
watch(isVisible, (visible) => {
  if (visible && props.autoRetry) {
    startCountdown()
  } else {
    stopCountdown()
  }
})

// Reset retry count when error changes
watch(() => props.error, () => {
  retryCount.value = 0
  isRetrying.value = false
  stopCountdown()
  
  if (props.autoRetry && isVisible.value) {
    startCountdown()
  }
})
</script>

<style scoped>
.enhanced-error-message {
  font-family: 'Work Sans', sans-serif;
  border-radius: 8px;
  overflow: hidden;
}

.enhanced-error-message__content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Variants */
.enhanced-error-message--banner {
  background: var(--surface);
  border-left: 4px solid var(--danger);
  padding: 1rem 1.25rem;
}

.enhanced-error-message--card {
  background: var(--surface);
  border: 1px solid var(--danger);
  box-shadow: var(--shadow-sm);
  padding: 1.25rem;
}

.enhanced-error-message--inline {
  background: rgba(239, 68, 68, 0.05);
  border: 1px solid rgba(239, 68, 68, 0.2);
  padding: 0.875rem 1rem;
}

/* Severity colors */
.enhanced-error-message--warning {
  border-color: #f59e0b;
}

.enhanced-error-message--warning.enhanced-error-message--banner {
  border-left-color: #f59e0b;
}

.enhanced-error-message--warning.enhanced-error-message--inline {
  background: rgba(245, 158, 11, 0.05);
  border-color: rgba(245, 158, 11, 0.2);
}

.enhanced-error-message--critical {
  border-color: #dc2626;
  background: rgba(220, 38, 38, 0.05);
}

/* Header */
.enhanced-error-message__header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.enhanced-error-message__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--danger);
  margin-top: 0.125rem;
}

.enhanced-error-message--warning .enhanced-error-message__icon {
  color: #f59e0b;
}

.enhanced-error-message--critical .enhanced-error-message__icon {
  color: #dc2626;
}

.enhanced-error-message__title {
  flex: 1;
  min-width: 0;
}

.error-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0 0 0.25rem 0;
  line-height: 1.4;
}

.error-message {
  font-size: 0.875rem;
  color: var(--ink);
  margin: 0;
  line-height: 1.5;
}

.enhanced-error-message__close {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.enhanced-error-message__close:hover {
  color: var(--ink);
  background: var(--accent-soft);
}

/* Details */
.enhanced-error-message__details {
  border-top: 1px solid var(--border);
  padding-top: 1rem;
}

.details-toggle {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
  transition: color 0.2s ease;
}

.details-toggle:hover {
  color: var(--accent-2);
}

.details-toggle__icon {
  transition: transform 0.2s ease;
}

.details-toggle__icon.rotated {
  transform: rotate(180deg);
}

.error-details {
  margin-top: 0.75rem;
  padding: 0.875rem;
  background: var(--surface-muted);
  border-radius: 6px;
  font-size: 0.8125rem;
  line-height: 1.5;
}

.error-code {
  font-family: 'Courier New', monospace;
  color: var(--muted);
  margin-bottom: 0.5rem;
}

.technical-details {
  color: var(--ink);
  margin-bottom: 0.75rem;
}

.suggestions-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0 0 0.5rem 0;
}

.suggestions-list {
  margin: 0;
  padding-left: 1.25rem;
  color: var(--ink);
}

.suggestions-list li {
  margin-bottom: 0.25rem;
}

/* Network info */
.enhanced-error-message__network {
  padding: 0.75rem;
  background: var(--surface-muted);
  border-radius: 6px;
}

.network-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--muted);
}

/* Actions */
.enhanced-error-message__actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.retry-icon.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Countdown */
.enhanced-error-message__countdown {
  padding: 0.75rem;
  background: var(--surface-muted);
  border-radius: 6px;
}

.countdown-text {
  font-size: 0.8125rem;
  color: var(--muted);
  margin-bottom: 0.5rem;
  text-align: center;
}

.countdown-bar {
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
}

.countdown-bar__fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.1s linear;
}

/* Transitions */
.error-message-enter-active,
.error-message-leave-active {
  transition: all 0.3s ease;
}

.error-message-enter-from,
.error-message-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.details-enter-active,
.details-leave-active {
  transition: all 0.3s ease;
}

.details-enter-from,
.details-leave-to {
  opacity: 0;
  max-height: 0;
  overflow: hidden;
}

.details-enter-to,
.details-leave-from {
  opacity: 1;
  max-height: 300px;
}

/* Responsive design */
@media (max-width: 640px) {
  .enhanced-error-message__actions {
    flex-direction: column;
  }
  
  .enhanced-error-message__actions .btn {
    width: 100%;
    justify-content: center;
  }
  
  .enhanced-error-message--card,
  .enhanced-error-message--banner {
    padding: 1rem;
  }
  
  .enhanced-error-message__header {
    gap: 0.5rem;
  }
}
</style>