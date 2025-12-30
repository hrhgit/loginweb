<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import { useAppStore } from '../../store/appStore'
import { MessageType } from '../../utils/errorHandler'

const store = useAppStore()

// 消息显示状态
const isVisible = ref(false)
const currentMessage = ref('')
const currentType = ref<MessageType>(MessageType.INFO)
const canRetry = ref(false)
const isRetrying = ref(false)
const suggestions = ref<string[]>([])
const onRetryCallback = ref<(() => void) | null>(null)
const showNetworkInfo = ref(false)

// 自动隐藏定时器
let hideTimer: number | undefined

// Performance optimization: Debounce message updates
let messageUpdateTimer: number | undefined
const MESSAGE_UPDATE_DEBOUNCE = 50 // 50ms debounce

// Performance optimization: Cache computed values
const messageInfoCache = ref<{
  type: MessageType
  message: string
  visible: boolean
} | null>(null)

// Network status integration
const networkInfo = computed(() => {
  const state = store.networkState
  const quality = store.connectionQuality
  
  return {
    isOnline: state.isOnline,
    quality,
    effectiveType: state.effectiveType,
    rtt: state.rtt,
    downlink: state.downlink
  }
})

const shouldShowNetworkInfo = computed(() => {
  return !networkInfo.value.isOnline || 
         networkInfo.value.quality === 'slow' ||
         store.networkRetryCount > 0
})

// 计算消息类型和内容 - 性能优化版本
const messageInfo = computed(() => {
  // Network-related messages take priority for critical issues
  if (!networkInfo.value.isOnline) {
    return {
      type: MessageType.ERROR,
      message: '网络连接已断开，部分功能可能无法使用',
      visible: true
    }
  }
  
  if (networkInfo.value.quality === 'slow' && store.networkRetryCount > 0) {
    return {
      type: MessageType.WARNING,
      message: `网络连接较慢，正在重试 (${store.networkRetryCount}/${3})`,
      visible: true
    }
  }
  
  if (store.bannerError) {
    return {
      type: MessageType.ERROR,
      message: store.bannerError,
      visible: true
    }
  } else if (store.bannerInfo) {
    return {
      type: MessageType.INFO,
      message: store.bannerInfo,
      visible: true
    }
  }
  return {
    type: MessageType.INFO,
    message: '',
    visible: false
  }
})

// 获取消息显示时长
const getMessageDuration = (messageType: MessageType): number => {
  switch (messageType) {
    case MessageType.ERROR:
    case MessageType.CRITICAL:
    case MessageType.WARNING:
      return 5000 // 错误、严重错误和警告消息显示5秒
    case MessageType.SUCCESS:
    case MessageType.INFO:
    default:
      return 2000 // 成功和信息消息显示2秒
  }
}

// 获取消息图标
const getMessageIcon = (messageType: MessageType): string => {
  switch (messageType) {
    case MessageType.SUCCESS:
      return '✓'
    case MessageType.ERROR:
      return '✕'
    case MessageType.CRITICAL:
      return '⚠'
    case MessageType.WARNING:
      return '⚠'
    case MessageType.INFO:
    default:
      return 'ℹ'
  }
}

// 获取网络状态图标
const getNetworkIcon = (): string => {
  if (!networkInfo.value.isOnline) return '📶'
  if (networkInfo.value.quality === 'slow') return '📶'
  return '📶'
}

// 获取CSS类名
const bannerClasses = computed(() => {
  const classes = ['toast-notification']
  
  switch (currentType.value) {
    case MessageType.ERROR:
      classes.push('toast-notification--error')
      break
    case MessageType.CRITICAL:
      classes.push('toast-notification--critical')
      break
    case MessageType.WARNING:
      classes.push('toast-notification--warning')
      break
    case MessageType.SUCCESS:
      classes.push('toast-notification--success')
      break
    case MessageType.INFO:
    default:
      classes.push('toast-notification--info')
      break
  }
  
  if (shouldShowNetworkInfo.value) {
    classes.push('toast-notification--with-network')
  }
  
  return classes
})

// 显示消息 - 性能优化版本
const showMessage = () => {
  const info = messageInfo.value
  if (!info.visible) {
    isVisible.value = false
    return
  }
  
  // Performance optimization: Debounce rapid message updates
  if (messageUpdateTimer) {
    clearTimeout(messageUpdateTimer)
  }
  
  messageUpdateTimer = window.setTimeout(() => {
    currentMessage.value = info.message
    currentType.value = info.type
    showNetworkInfo.value = shouldShowNetworkInfo.value
    isVisible.value = true
    
    // 清除之前的定时器
    if (hideTimer) {
      clearTimeout(hideTimer)
    }
    
    // 设置自动隐藏定时器 (网络问题消息显示更长时间)
    const duration = shouldShowNetworkInfo.value ? 
      getMessageDuration(info.type) * 2 : 
      getMessageDuration(info.type)
    hideTimer = window.setTimeout(() => {
      isVisible.value = false
    }, duration)
  }, MESSAGE_UPDATE_DEBOUNCE)
}

// 手动关闭消息
const closeMessage = () => {
  isVisible.value = false
  if (hideTimer) {
    clearTimeout(hideTimer)
  }
}

// 重试操作
const handleRetry = async () => {
  if (onRetryCallback.value && !isRetrying.value) {
    isRetrying.value = true
    try {
      await onRetryCallback.value()
    } catch (error) {
      console.error('Retry failed:', error)
    } finally {
      isRetrying.value = false
    }
  }
  closeMessage()
}

// 网络重试操作
const handleNetworkRetry = async () => {
  if (!isRetrying.value) {
    isRetrying.value = true
    try {
      await store.handleConnectivityRestoration()
    } catch (error) {
      console.error('Network retry failed:', error)
    } finally {
      isRetrying.value = false
    }
  }
}

// 监听store变化
watch(messageInfo, showMessage, { immediate: true })

// 清理定时器 - 性能优化版本
onUnmounted(() => {
  if (hideTimer) {
    clearTimeout(hideTimer)
  }
  if (messageUpdateTimer) {
    clearTimeout(messageUpdateTimer)
  }
})
</script>

<template>
  <Transition name="toast" appear>
    <div 
      v-if="isVisible && currentMessage" 
      :class="bannerClasses"
    >
      <div class="toast-notification__content">
        <div class="toast-notification__header">
          <span class="toast-notification__icon">{{ getMessageIcon(currentType) }}</span>
          <span class="toast-notification__message">{{ currentMessage }}</span>
          <button 
            class="toast-notification__close" 
            @click="closeMessage"
            aria-label="关闭消息"
          >
            ✕
          </button>
        </div>
        
        <!-- 网络状态信息 -->
        <div v-if="showNetworkInfo" class="toast-notification__network">
          <div class="toast-notification__network-info">
            <span class="toast-notification__network-icon">{{ getNetworkIcon() }}</span>
            <span class="toast-notification__network-text">
              <template v-if="!networkInfo.isOnline">
                网络连接已断开
              </template>
              <template v-else-if="networkInfo.quality === 'slow'">
                网络连接较慢 ({{ networkInfo.effectiveType?.toUpperCase() || 'Unknown' }})
                <span v-if="networkInfo.rtt > 0"> • {{ networkInfo.rtt }}ms</span>
              </template>
              <template v-else>
                网络连接正常
              </template>
            </span>
          </div>
          
          <!-- 网络重试按钮 -->
          <button 
            v-if="!networkInfo.isOnline || store.networkRetryCount > 0"
            class="toast-notification__network-retry"
            :disabled="isRetrying"
            @click="handleNetworkRetry"
          >
            {{ isRetrying ? '重试中...' : '重试连接' }}
          </button>
        </div>
        
        <!-- 错误建议 -->
        <div v-if="suggestions.length > 0" class="toast-notification__suggestions">
          <div class="toast-notification__suggestions-title">建议解决方案：</div>
          <ul class="toast-notification__suggestions-list">
            <li v-for="suggestion in suggestions" :key="suggestion">
              {{ suggestion }}
            </li>
          </ul>
        </div>
        
        <!-- 重试按钮 -->
        <div v-if="canRetry" class="toast-notification__actions">
          <button 
            class="toast-notification__retry-btn"
            :class="{ 'toast-notification__retry-btn--loading': isRetrying }"
            :disabled="isRetrying"
            @click="handleRetry"
            :aria-label="isRetrying ? '正在重试...' : '重试操作'"
          >
            <span v-if="!isRetrying">重试</span>
            <span v-else>重试中...</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>


<style scoped>
/* Network information styles */
.toast-notification__network {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.toast-notification__network-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.toast-notification__network-icon {
  font-size: 0.875rem;
  opacity: 0.8;
}

.toast-notification__network-text {
  font-size: 0.8125rem;
  line-height: 1.4;
  opacity: 0.9;
}

.toast-notification__network-retry {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: inherit;
  padding: 0.375rem 0.75rem;
  border-radius: 4px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.toast-notification__network-retry:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.4);
}

.toast-notification__network-retry:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Enhanced styles for network-aware banners */
.toast-notification--with-network {
  min-width: 320px;
}

.toast-notification--with-network .toast-notification__content {
  padding: 1rem 1.25rem;
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .toast-notification__network {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }
  
  .toast-notification__network-retry {
    width: 100%;
    text-align: center;
  }
  
  .toast-notification--with-network {
    min-width: auto;
    max-width: calc(100vw - 2rem);
  }
}
</style>