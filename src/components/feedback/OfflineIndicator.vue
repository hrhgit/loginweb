<template>
  <Transition name="offline-indicator">
    <div 
      v-if="showIndicator" 
      :class="indicatorClasses"
      class="offline-indicator"
    >
      <div class="offline-indicator__content">
        <div class="offline-indicator__icon">
          <component :is="iconComponent" :size="16" />
        </div>
        <span class="offline-indicator__message">{{ message }}</span>
        <button 
          v-if="showDismiss"
          @click="dismiss"
          class="offline-indicator__dismiss"
          aria-label="Dismiss"
        >
          <X :size="14" />
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { WifiOff, Wifi, AlertTriangle, Info, CheckCircle, XCircle, X } from 'lucide-vue-next'
import { useOfflineManager } from '../../utils/offlineManager'

interface Props {
  context?: 'general' | 'form' | 'page' | 'feature'
  showWhenOnline?: boolean
  dismissible?: boolean
  autoHide?: number // Auto hide after milliseconds
}

const props = withDefaults(defineProps<Props>(), {
  context: 'general',
  showWhenOnline: false,
  dismissible: false,
  autoHide: 0
})

const { isOffline, isOnline, getOfflineIndicator } = useOfflineManager()

const isDismissed = ref(false)
const autoHideTimer = ref<number | null>(null)

// Get the appropriate indicator based on context and state
const indicator = computed(() => {
  if (isDismissed.value) {
    return { isVisible: false, message: '', type: 'info' as const }
  }
  
  if (isOffline.value) {
    return getOfflineIndicator(props.context)
  }
  
  if (props.showWhenOnline && isOnline.value) {
    return {
      isVisible: true,
      message: 'You are back online!',
      type: 'success' as const
    }
  }
  
  return { isVisible: false, message: '', type: 'info' as const }
})

const showIndicator = computed(() => indicator.value.isVisible)
const message = computed(() => indicator.value.message)
const type = computed(() => indicator.value.type)
const showDismiss = computed(() => props.dismissible && showIndicator.value)

const indicatorClasses = computed(() => [
  'offline-indicator',
  `offline-indicator--${type.value}`,
  {
    'offline-indicator--dismissible': props.dismissible
  }
])

const iconComponent = computed(() => {
  if (isOffline.value) {
    return WifiOff
  }
  
  switch (type.value) {
    case 'warning':
      return AlertTriangle
    case 'error':
      return XCircle
    case 'success':
      return CheckCircle
    case 'info':
    default:
      return isOnline.value ? Wifi : Info
  }
})

const dismiss = () => {
  isDismissed.value = true
  clearAutoHideTimer()
}

const clearAutoHideTimer = () => {
  if (autoHideTimer.value) {
    window.clearTimeout(autoHideTimer.value)
    autoHideTimer.value = null
  }
}

// Auto hide functionality
watch(showIndicator, (show) => {
  if (show && props.autoHide > 0) {
    clearAutoHideTimer()
    autoHideTimer.value = window.setTimeout(() => {
      dismiss()
    }, props.autoHide)
  } else {
    clearAutoHideTimer()
  }
})

// Reset dismissed state when going offline/online
watch([isOffline, isOnline], () => {
  isDismissed.value = false
})
</script>

<style scoped>
.offline-indicator {
  position: fixed;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  max-width: 90vw;
  width: auto;
  min-width: 300px;
}

.offline-indicator__content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(8px);
  font-size: 0.875rem;
  font-weight: 500;
}

.offline-indicator--info .offline-indicator__content {
  background: rgba(59, 130, 246, 0.9);
  color: white;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.offline-indicator--warning .offline-indicator__content {
  background: rgba(245, 158, 11, 0.9);
  color: white;
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.offline-indicator--error .offline-indicator__content {
  background: rgba(239, 68, 68, 0.9);
  color: white;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.offline-indicator--success .offline-indicator__content {
  background: rgba(34, 197, 94, 0.9);
  color: white;
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.offline-indicator__icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.offline-indicator__message {
  flex: 1;
  line-height: 1.4;
}

.offline-indicator__dismiss {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.8;
  transition: opacity 0.2s ease;
  flex-shrink: 0;
}

.offline-indicator__dismiss:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
}

/* Transitions */
.offline-indicator-enter-active,
.offline-indicator-leave-active {
  transition: all 0.3s ease;
}

.offline-indicator-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-100%);
}

.offline-indicator-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-100%);
}

/* Responsive design */
@media (max-width: 640px) {
  .offline-indicator {
    top: 0.5rem;
    left: 0.5rem;
    right: 0.5rem;
    transform: none;
    max-width: none;
    min-width: auto;
  }
  
  .offline-indicator__content {
    padding: 0.625rem 0.875rem;
    font-size: 0.8125rem;
  }
}
</style>