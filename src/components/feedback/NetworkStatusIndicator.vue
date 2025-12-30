<template>
  <Transition name="network-status" appear>
    <div 
      v-if="shouldShow" 
      :class="statusClasses"
      class="network-status-indicator"
    >
      <div class="network-status-indicator__content">
        <div class="network-status-indicator__icon">
          <component :is="statusIcon" :size="iconSize" />
        </div>
        
        <div class="network-status-indicator__info">
          <div class="network-status-indicator__message">
            {{ statusMessage }}
          </div>
          
          <div v-if="showDetails" class="network-status-indicator__details">
            {{ statusDetails }}
          </div>
        </div>
        
        <div v-if="showActions" class="network-status-indicator__actions">
          <button 
            v-if="canRetry"
            @click="handleRetry"
            class="btn btn--ghost btn--compact"
            :disabled="isRetrying"
          >
            {{ isRetrying ? '重试中...' : '重试' }}
          </button>
          
          <button 
            v-if="canDismiss"
            @click="handleDismiss"
            class="network-status-indicator__dismiss"
            aria-label="关闭"
          >
            <X :size="14" />
          </button>
        </div>
      </div>
      
      <!-- Connection quality bar -->
      <div v-if="showQualityBar && isOnline" class="network-status-indicator__quality-bar">
        <div 
          class="quality-bar__fill" 
          :class="qualityBarClass"
          :style="{ width: `${qualityPercentage}%` }"
        ></div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { 
  Wifi, 
  WifiOff, 
  Signal, 
  SignalLow, 
  SignalMedium, 
  SignalHigh,
  AlertTriangle,
  CheckCircle,
  X,
  RefreshCw
} from 'lucide-vue-next'
import { networkManager } from '../../utils/networkManager'

interface Props {
  // Display options
  position?: 'top' | 'bottom' | 'inline'
  size?: 'small' | 'medium' | 'large'
  
  // Content options
  showDetails?: boolean
  showQualityBar?: boolean
  showActions?: boolean
  
  // Behavior options
  autoHide?: number // Auto hide after milliseconds
  persistent?: boolean // Don't auto-hide
  canDismiss?: boolean
  canRetry?: boolean
  
  // Override visibility
  forceShow?: boolean
  forceHide?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  position: 'top',
  size: 'medium',
  showDetails: false,
  showQualityBar: false,
  showActions: true,
  autoHide: 0,
  persistent: false,
  canDismiss: true,
  canRetry: true,
  forceShow: false,
  forceHide: false
})

const emit = defineEmits<{
  retry: []
  dismiss: []
  statusChange: [status: string]
}>()

// State
const isDismissed = ref(false)
const isRetrying = ref(false)
const autoHideTimer = ref<number | null>(null)

// Network state
const networkState = computed(() => networkManager.networkState)
const connectionQuality = computed(() => networkManager.connectionQuality)
const isOnline = computed(() => networkState.value.isOnline)
const isOffline = computed(() => !networkState.value.isOnline)

// Visibility logic
const shouldShow = computed(() => {
  if (props.forceHide) return false
  if (props.forceShow) return true
  if (isDismissed.value && !props.persistent) return false
  
  // Show when offline or when connection quality is poor
  return isOffline.value || connectionQuality.value === 'slow'
})

// Status information
const statusType = computed(() => {
  if (isOffline.value) return 'offline'
  if (connectionQuality.value === 'slow') return 'slow'
  if (connectionQuality.value === 'fast') return 'online'
  return 'unknown'
})

const statusMessage = computed(() => {
  switch (statusType.value) {
    case 'offline':
      return '网络连接已断开'
    case 'slow':
      return '网络连接较慢'
    case 'online':
      return '网络连接正常'
    default:
      return '检查网络连接中...'
  }
})

const statusDetails = computed(() => {
  if (isOffline.value) {
    return '部分功能可能无法使用，请检查网络设置'
  }
  
  if (connectionQuality.value === 'slow') {
    const effectiveType = networkState.value.effectiveType
    const rtt = networkState.value.rtt
    
    let details = '页面加载可能较慢'
    if (effectiveType && effectiveType !== 'unknown') {
      details += ` (${effectiveType.toUpperCase()})`
    }
    if (rtt > 0) {
      details += ` • 延迟 ${rtt}ms`
    }
    
    return details
  }
  
  return ''
})

const statusIcon = computed(() => {
  if (isOffline.value) return WifiOff
  
  switch (connectionQuality.value) {
    case 'fast': return SignalHigh
    case 'slow': return SignalLow
    default: return Signal
  }
})

const statusClasses = computed(() => [
  'network-status-indicator',
  `network-status-indicator--${statusType.value}`,
  `network-status-indicator--${props.position}`,
  `network-status-indicator--${props.size}`
])

const iconSize = computed(() => {
  switch (props.size) {
    case 'small': return 16
    case 'large': return 24
    default: return 20
  }
})

// Quality bar
const qualityPercentage = computed(() => {
  if (isOffline.value) return 0
  
  const downlink = networkState.value.downlink
  if (downlink <= 0) return 50 // Unknown, show 50%
  
  // Convert downlink to percentage (0-100)
  // Assume 10 Mbps is 100%
  return Math.min(100, (downlink / 10) * 100)
})

const qualityBarClass = computed(() => {
  if (qualityPercentage.value >= 70) return 'quality-bar__fill--good'
  if (qualityPercentage.value >= 30) return 'quality-bar__fill--medium'
  return 'quality-bar__fill--poor'
})

// Event handlers
const handleRetry = async () => {
  isRetrying.value = true
  emit('retry')
  
  // Simulate retry delay
  setTimeout(() => {
    isRetrying.value = false
  }, 2000)
}

const handleDismiss = () => {
  isDismissed.value = true
  clearAutoHideTimer()
  emit('dismiss')
}

const clearAutoHideTimer = () => {
  if (autoHideTimer.value) {
    window.clearTimeout(autoHideTimer.value)
    autoHideTimer.value = null
  }
}

// Auto hide functionality
watch(shouldShow, (show) => {
  if (show && props.autoHide > 0 && !props.persistent) {
    clearAutoHideTimer()
    autoHideTimer.value = window.setTimeout(() => {
      handleDismiss()
    }, props.autoHide)
  } else {
    clearAutoHideTimer()
  }
})

// Reset dismissed state when status changes significantly
watch([isOnline, connectionQuality], () => {
  if (isOnline.value && connectionQuality.value === 'fast') {
    // Connection restored to good state
    isDismissed.value = false
  }
})

// Emit status changes
watch(statusType, (newStatus, oldStatus) => {
  if (newStatus !== oldStatus) {
    emit('statusChange', newStatus)
  }
}, { immediate: true })
</script>

<style scoped>
.network-status-indicator {
  background: var(--surface-strong);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: var(--shadow-sm);
  font-family: 'Work Sans', sans-serif;
  max-width: 400px;
  overflow: hidden;
}

.network-status-indicator__content {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
}

.network-status-indicator__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.network-status-indicator__info {
  flex: 1;
  min-width: 0;
}

.network-status-indicator__message {
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.4;
  color: var(--ink);
}

.network-status-indicator__details {
  font-size: 0.8125rem;
  line-height: 1.4;
  color: var(--muted);
  margin-top: 0.25rem;
}

.network-status-indicator__actions {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  flex-shrink: 0;
}

.network-status-indicator__dismiss {
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
}

.network-status-indicator__dismiss:hover {
  color: var(--ink);
  background: var(--accent-soft);
}

/* Quality bar */
.network-status-indicator__quality-bar {
  height: 3px;
  background: var(--border);
  position: relative;
  overflow: hidden;
}

.quality-bar__fill {
  height: 100%;
  transition: width 0.5s ease;
}

.quality-bar__fill--good {
  background: #22c55e;
}

.quality-bar__fill--medium {
  background: #f59e0b;
}

.quality-bar__fill--poor {
  background: var(--danger);
}

/* Status types */
.network-status-indicator--offline {
  border-color: var(--danger);
}

.network-status-indicator--offline .network-status-indicator__icon {
  color: var(--danger);
}

.network-status-indicator--slow {
  border-color: #f59e0b;
}

.network-status-indicator--slow .network-status-indicator__icon {
  color: #f59e0b;
}

.network-status-indicator--online {
  border-color: #22c55e;
}

.network-status-indicator--online .network-status-indicator__icon {
  color: #22c55e;
}

/* Positions */
.network-status-indicator--top {
  position: fixed;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
}

.network-status-indicator--bottom {
  position: fixed;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
}

.network-status-indicator--inline {
  position: relative;
  width: 100%;
}

/* Sizes */
.network-status-indicator--small .network-status-indicator__content {
  padding: 0.625rem 0.875rem;
  gap: 0.5rem;
}

.network-status-indicator--small .network-status-indicator__message {
  font-size: 0.8125rem;
}

.network-status-indicator--small .network-status-indicator__details {
  font-size: 0.75rem;
}

.network-status-indicator--large .network-status-indicator__content {
  padding: 1rem 1.25rem;
  gap: 1rem;
}

.network-status-indicator--large .network-status-indicator__message {
  font-size: 1rem;
}

.network-status-indicator--large .network-status-indicator__details {
  font-size: 0.875rem;
}

/* Transitions */
.network-status-enter-active,
.network-status-leave-active {
  transition: all 0.3s ease;
}

.network-status-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-100%);
}

.network-status-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-100%);
}

.network-status-indicator--bottom.network-status-enter-from {
  transform: translateX(-50%) translateY(100%);
}

.network-status-indicator--bottom.network-status-leave-to {
  transform: translateX(-50%) translateY(100%);
}

.network-status-indicator--inline.network-status-enter-from,
.network-status-indicator--inline.network-status-leave-to {
  transform: translateY(-20px);
}

/* Responsive design */
@media (max-width: 640px) {
  .network-status-indicator--top,
  .network-status-indicator--bottom {
    left: 0.5rem;
    right: 0.5rem;
    transform: none;
    max-width: none;
  }
  
  .network-status-indicator--top.network-status-enter-from {
    transform: translateY(-100%);
  }
  
  .network-status-indicator--top.network-status-leave-to {
    transform: translateY(-100%);
  }
  
  .network-status-indicator--bottom.network-status-enter-from {
    transform: translateY(100%);
  }
  
  .network-status-indicator--bottom.network-status-leave-to {
    transform: translateY(100%);
  }
  
  .network-status-indicator__content {
    padding: 0.75rem;
  }
  
  .network-status-indicator__actions {
    flex-direction: column;
    gap: 0.25rem;
  }
}
</style>