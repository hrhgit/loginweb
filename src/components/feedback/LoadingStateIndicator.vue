<template>
  <div 
    v-if="isVisible" 
    :class="loadingClasses"
    class="loading-state-indicator"
  >
    <div class="loading-state-indicator__content">
      <!-- Loading spinner -->
      <div v-if="showSpinner" class="loading-state-indicator__spinner">
        <div class="spinner" :class="spinnerSizeClass"></div>
      </div>
      
      <!-- Loading icon -->
      <div v-if="showIcon && !showSpinner" class="loading-state-indicator__icon">
        <component :is="iconComponent" :size="iconSize" />
      </div>
      
      <!-- Loading message -->
      <div v-if="message" class="loading-state-indicator__message">
        {{ message }}
      </div>
      
      <!-- Progress bar -->
      <div v-if="showProgress && progress !== undefined" class="loading-state-indicator__progress">
        <div class="progress-bar">
          <div 
            class="progress-bar__fill" 
            :style="{ width: `${Math.min(100, Math.max(0, progress))}%` }"
          ></div>
        </div>
        <div class="progress-text">{{ Math.round(progress) }}%</div>
      </div>
      
      <!-- Network quality indicator -->
      <div v-if="showNetworkQuality" class="loading-state-indicator__network">
        <component :is="networkIcon" :size="14" />
        <span class="network-quality-text">{{ networkQualityText }}</span>
      </div>
      
      <!-- Action buttons -->
      <div v-if="showActions" class="loading-state-indicator__actions">
        <button 
          v-if="canCancel"
          @click="handleCancel"
          class="btn btn--ghost btn--compact"
          :disabled="isProcessing"
        >
          取消
        </button>
        <button 
          v-if="canRetry"
          @click="handleRetry"
          class="btn btn--primary btn--compact"
          :disabled="isProcessing"
        >
          {{ isProcessing ? '重试中...' : '重试' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { 
  Loader2, 
  Wifi, 
  WifiOff, 
  Signal, 
  SignalLow, 
  SignalMedium, 
  SignalHigh,
  AlertCircle,
  CheckCircle,
  Info,
  Clock
} from 'lucide-vue-next'
import { networkManager } from '../../utils/networkManager'

interface Props {
  // Visibility and state
  visible?: boolean
  state?: 'loading' | 'success' | 'error' | 'warning' | 'info'
  
  // Content
  message?: string
  progress?: number
  
  // Appearance
  size?: 'small' | 'medium' | 'large'
  variant?: 'inline' | 'overlay' | 'card'
  
  // Features
  showSpinner?: boolean
  showIcon?: boolean
  showProgress?: boolean
  showNetworkQuality?: boolean
  showActions?: boolean
  
  // Actions
  canCancel?: boolean
  canRetry?: boolean
  isProcessing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: true,
  state: 'loading',
  size: 'medium',
  variant: 'inline',
  showSpinner: true,
  showIcon: false,
  showProgress: false,
  showNetworkQuality: false,
  showActions: false,
  canCancel: false,
  canRetry: false,
  isProcessing: false
})

const emit = defineEmits<{
  cancel: []
  retry: []
}>()

// Computed properties
const isVisible = computed(() => props.visible)

const loadingClasses = computed(() => [
  'loading-state-indicator',
  `loading-state-indicator--${props.state}`,
  `loading-state-indicator--${props.size}`,
  `loading-state-indicator--${props.variant}`
])

const spinnerSizeClass = computed(() => {
  switch (props.size) {
    case 'small': return 'spinner--small'
    case 'large': return 'spinner--large'
    default: return 'spinner--medium'
  }
})

const iconSize = computed(() => {
  switch (props.size) {
    case 'small': return 16
    case 'large': return 24
    default: return 20
  }
})

const iconComponent = computed(() => {
  switch (props.state) {
    case 'success': return CheckCircle
    case 'error': return AlertCircle
    case 'warning': return AlertCircle
    case 'info': return Info
    case 'loading': return Clock
    default: return Loader2
  }
})

// Network quality indicators
const networkState = computed(() => networkManager.networkState)
const connectionQuality = computed(() => networkManager.connectionQuality)

const networkIcon = computed(() => {
  if (!networkState.value.isOnline) return WifiOff
  
  switch (connectionQuality.value) {
    case 'fast': return SignalHigh
    case 'slow': return SignalLow
    default: return Signal
  }
})

const networkQualityText = computed(() => {
  if (!networkState.value.isOnline) return '离线'
  
  switch (connectionQuality.value) {
    case 'fast': return '网络良好'
    case 'slow': return '网络较慢'
    default: return '网络连接'
  }
})

// Event handlers
const handleCancel = () => {
  emit('cancel')
}

const handleRetry = () => {
  emit('retry')
}
</script>

<style scoped>
.loading-state-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Work Sans', sans-serif;
}

.loading-state-indicator__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
}

/* Variants */
.loading-state-indicator--inline {
  padding: 1rem;
}

.loading-state-indicator--overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 1000;
}

.loading-state-indicator--overlay .loading-state-indicator__content {
  background: var(--surface-strong);
  padding: 2rem;
  border-radius: 12px;
  box-shadow: var(--shadow);
  max-width: 400px;
  margin: 0 1rem;
}

.loading-state-indicator--card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1.5rem;
}

/* States */
.loading-state-indicator--loading {
  color: var(--accent);
}

.loading-state-indicator--success {
  color: #22c55e;
}

.loading-state-indicator--error {
  color: var(--danger);
}

.loading-state-indicator--warning {
  color: #f59e0b;
}

.loading-state-indicator--info {
  color: var(--muted);
}

/* Sizes */
.loading-state-indicator--small .loading-state-indicator__content {
  gap: 0.5rem;
}

.loading-state-indicator--small .loading-state-indicator__message {
  font-size: 0.875rem;
}

.loading-state-indicator--large .loading-state-indicator__content {
  gap: 1rem;
}

.loading-state-indicator--large .loading-state-indicator__message {
  font-size: 1.125rem;
  font-weight: 500;
}

/* Spinner */
.loading-state-indicator__spinner {
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner {
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.spinner--small {
  width: 16px;
  height: 16px;
}

.spinner--medium {
  width: 20px;
  height: 20px;
}

.spinner--large {
  width: 24px;
  height: 24px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Icon */
.loading-state-indicator__icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Message */
.loading-state-indicator__message {
  font-size: 1rem;
  line-height: 1.5;
  color: var(--ink);
}

/* Progress */
.loading-state-indicator__progress {
  width: 100%;
  max-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar__fill {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.875rem;
  color: var(--muted);
  text-align: center;
}

/* Network quality */
.loading-state-indicator__network {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--muted);
}

.network-quality-text {
  font-size: 0.8125rem;
}

/* Actions */
.loading-state-indicator__actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

/* Responsive design */
@media (max-width: 640px) {
  .loading-state-indicator--overlay .loading-state-indicator__content {
    padding: 1.5rem;
    margin: 0 0.5rem;
  }
  
  .loading-state-indicator__actions {
    flex-direction: column;
    width: 100%;
  }
  
  .loading-state-indicator__actions .btn {
    width: 100%;
  }
}
</style>