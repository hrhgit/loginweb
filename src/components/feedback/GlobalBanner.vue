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

// 计算消息类型和内容 - 性能优化版本
const messageInfo = computed(() => {
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
    isVisible.value = true
    
    // 清除之前的定时器
    if (hideTimer) {
      clearTimeout(hideTimer)
    }
    
    // 设置自动隐藏定时器
    const duration = getMessageDuration(info.type)
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

