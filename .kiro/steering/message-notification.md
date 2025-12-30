# Message Notification System Guidelines

## Overview

This document defines the standards and practices for implementing the message notification system in the event management platform. The system provides **client-side user feedback** through banners and toasts without database persistence.

## Notification Architecture

### Core Components

#### 1. Global Banner Component (`src/components/feedback/GlobalBanner.vue`)
- Primary notification display mechanism
- Reactive to store state changes
- Support for multiple notification types (success, error, warning, info, critical)
- Smooth animations and transitions
- Network status integration with retry functionality
- Auto-hide with configurable durations
- Performance optimized with debounced updates

#### 2. Store Integration (`src/store/appStore.ts`)
- `bannerInfo` - Information/success messages
- `bannerError` - Error messages  
- `setBanner(type: 'info' | 'error', text: string)` - Core banner function
- Reactive state management
- No database persistence required
- Network-aware loading states

#### 3. Enhanced Error Handler Integration (`src/store/enhancedErrorHandling.ts`)
- Automatic error-to-banner conversion
- Centralized message formatting
- Network-aware error handling
- Duplicate message suppression
- Context-aware error messages

### Message Types

```typescript
export const MessageType = {
  SUCCESS: 'success',
  INFO: 'info',
  WARNING: 'warning', 
  ERROR: 'error',
  CRITICAL: 'critical'
} as const

export type MessageType = typeof MessageType[keyof typeof MessageType]
```

### Current Implementation Pattern

```typescript
// Store state (appStore.ts)
const bannerInfo = ref('')
const bannerError = ref('')

// Core banner function with auto-hide
const setBanner = (type: 'info' | 'error', text: string) => {
  bannerInfo.value = ''
  bannerError.value = ''
  window.clearTimeout(bannerTimeout)

  if (type === 'info') {
    bannerInfo.value = text
  } else {
    bannerError.value = text
  }

  bannerTimeout = window.setTimeout(() => {
    bannerInfo.value = ''
    bannerError.value = ''
  }, 2000) // 2 seconds then fade via transition
}

// Enhanced error handler initialization
enhancedErrorHandler.setBannerCallback(setBanner)
```

## Implementation Standards

### 1. Current Message Display Patterns

#### Success Messages
```typescript
// Using enhanced error handler (recommended)
handleSuccessWithBanner('活动创建成功！您的活动已保存为草稿', setBanner, { 
  operation: 'createEvent',
  component: 'form' 
})

// Direct banner usage (legacy)
setBanner('info', '活动创建成功！您的活动已保存为草稿')
```

#### Error Messages
```typescript
// Using enhanced error handler (recommended)
try {
  const result = await someOperation()
  handleSuccessWithBanner('操作成功完成！', setBanner, { 
    operation: 'createEvent',
    component: 'form' 
  })
} catch (error) {
  // Error handlers automatically call setBanner
  eventErrorHandler.handleError(error, { 
    operation: 'createEvent',
    additionalData: { eventId }
  })
}

// Direct banner usage (legacy)
setBanner('error', '保存失败，网络连接异常，请检查网络后重试')
```

#### Available Error Handlers
```typescript
// Pre-configured error handlers from enhancedErrorHandling.ts
export const authErrorHandler = createErrorHandler('auth', 'authentication')
export const formErrorHandler = createErrorHandler('form', 'form')
export const apiErrorHandler = createErrorHandler('api', 'network')
export const uploadErrorHandler = createErrorHandler('upload', 'file')
export const teamErrorHandler = createErrorHandler('team', 'team')
export const eventErrorHandler = createErrorHandler('event', 'event')
export const profileErrorHandler = createErrorHandler('profile', 'profile')
```

### 2. Network Status Integration

The GlobalBanner component automatically displays network-related messages with enhanced functionality:

```typescript
// Network status integration (handled automatically by GlobalBanner)
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

// Automatic network messages:
- "网络连接已断开，部分功能可能无法使用" (offline)
- "网络连接较慢，正在重试 (1/3)" (slow connection with retry count)
- Network retry functionality with progress indication
```

### 3. Message Timing and Auto-Hide

```typescript
// Auto-hide durations (implemented in setBanner function)
const setBanner = (type: 'info' | 'error', text: string) => {
  // Clear existing messages
  bannerInfo.value = ''
  bannerError.value = ''
  window.clearTimeout(bannerTimeout)

  // Set new message
  if (type === 'info') {
    bannerInfo.value = text
  } else {
    bannerError.value = text
  }

  // Auto-hide after 2 seconds
  bannerTimeout = window.setTimeout(() => {
    bannerInfo.value = ''
    bannerError.value = ''
  }, 2000)
}

// Message duration mapping in GlobalBanner component:
const getMessageDuration = (messageType: MessageType): number => {
  switch (messageType) {
    case MessageType.ERROR:
    case MessageType.CRITICAL:
    case MessageType.WARNING:
      return 5000 // Error messages show for 5 seconds
    case MessageType.SUCCESS:
    case MessageType.INFO:
    default:
      return 2000 // Success/info messages show for 2 seconds
  }
}
```

### 4. Banner Styling System

The GlobalBanner component uses CSS classes based on message type:

```css
.toast-notification {
  /* Base banner styles */
  position: fixed;
  top: 1rem;
  right: 1rem;
  max-width: 400px;
  z-index: 1000;
}

.toast-notification--success {
  background: var(--accent-soft);
  border-left: 4px solid var(--accent);
  color: var(--accent);
}

.toast-notification--error {
  background: rgba(182, 45, 28, 0.1);
  border-left: 4px solid var(--danger);
  color: var(--danger);
}

.toast-notification--warning {
  background: rgba(224, 122, 95, 0.1);
  border-left: 4px solid var(--accent-2);
  color: var(--accent-2);
}

.toast-notification--info {
  background: var(--surface-muted);
  border-left: 4px solid var(--muted);
  color: var(--ink);
}

.toast-notification--critical {
  background: rgba(182, 45, 28, 0.15);
  border-left: 4px solid var(--danger);
  color: var(--danger);
  font-weight: 600;
}

/* Network-aware styling */
.toast-notification--with-network {
  min-width: 320px;
}

.toast-notification--with-network .toast-notification__content {
  padding: 1rem 1.25rem;
}
```

### 5. Performance Optimizations

The GlobalBanner component includes several performance optimizations:

```typescript
// Debounced message updates to prevent rapid re-renders
const MESSAGE_UPDATE_DEBOUNCE = 50 // 50ms debounce

// Performance optimization: Cache computed values
const messageInfoCache = ref<{
  type: MessageType
  message: string
  visible: boolean
} | null>(null)

// Debounced message display function
const showMessage = () => {
  if (messageUpdateTimer) {
    clearTimeout(messageUpdateTimer)
  }
  
  messageUpdateTimer = window.setTimeout(() => {
    // Update message display
    currentMessage.value = info.message
    currentType.value = info.type
    isVisible.value = true
  }, MESSAGE_UPDATE_DEBOUNCE)
}
```



## Notification Best Practices

### 1. User Experience Guidelines
- **Timing**: Show notifications immediately after user actions
- **Clarity**: Use clear, actionable language in Chinese
- **Hierarchy**: Prioritize critical notifications over informational ones
- **Accessibility**: Support screen readers and keyboard navigation
- **Performance**: Avoid notification spam and rate limiting

### 2. Message Content Standards
```typescript
const notificationMessages = {
  // Success messages - positive and encouraging
  eventCreated: '活动创建成功！您可以继续编辑或立即发布',
  teamJoined: '成功加入团队！欢迎来到 {teamName}',
  submissionSaved: '作品已保存，记得在截止时间前提交哦',
  
  // Error messages - helpful and actionable  
  networkError: '网络连接异常，请检查网络设置后重试',
  permissionDenied: '权限不足，请联系活动管理员',
  validationFailed: '请检查并完善必填信息',
  
  // Warning messages - clear about consequences
  deadlineApproaching: '距离截止时间还有 {timeLeft}，请尽快完成',
  unsavedChanges: '您有未保存的更改，确定要离开吗？',
  
  // Info messages - informative and contextual
  newFeature: '新功能上线：{featureName}，快来体验吧！',
  maintenance: '系统将在 {time} 进行维护，预计持续 {duration}'
}
```

### 3. Animation and Transitions
```css
/* Smooth entrance animations */
.notification-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.notification-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

/* Exit animations */
.notification-leave-active {
  transition: all 0.2s ease-in;
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
```

### 4. Mobile Responsiveness
```css
@media (max-width: 640px) {
  .toast-container {
    right: 12px;
    left: 12px;
    max-width: none;
  }
  
  .global-banner {
    margin: 0 -12px;
    border-radius: 0;
  }
  
  .notification-action {
    width: 100%;
    margin-top: 8px;
  }
}
```

## Integration Patterns

### 1. Store Integration
```typescript
// In appStore.ts - Current implementation
import { 
  enhancedErrorHandler, 
  handleSuccessWithBanner,
  authErrorHandler,
  apiErrorHandler,
  teamErrorHandler,
  eventErrorHandler
} from './enhancedErrorHandling'

// Initialize enhanced error handler with setBanner callback
enhancedErrorHandler.setBannerCallback(setBanner)

// Success feedback pattern
async function createEvent(eventData: EventData) {
  try {
    const result = await supabase.from('events').insert(eventData)
    
    handleSuccessWithBanner('活动创建成功！', setBanner, { 
      operation: 'createEvent',
      component: 'form' 
    })
    
    return result.data
  } catch (error) {
    eventErrorHandler.handleError(error, { 
      operation: 'createEvent',
      additionalData: { eventData }
    })
    throw error
  }
}
```

### 2. Component Usage
```vue
<template>
  <div class="page">
    <GlobalBanner />
    <main>
      <!-- Page content -->
    </main>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '@/store/appStore'

const store = useAppStore()

// Show notification on mount if needed
onMounted(() => {
  if (route.query.success) {
    store.setBanner('info', '操作完成！')
  }
})
</script>
```

### 3. Network-Aware Operations
```typescript
// Network-aware operation handling (from appStore.ts)
const handleNetworkAwareOperation = async <T>(
  operation: () => Promise<T>,
  options: {
    operationName: string
    showLoading?: boolean
    cacheKey?: string
    retryable?: boolean
  }
): Promise<T> => {
  const { operationName, showLoading = true, retryable = true } = options
  
  try {
    if (showLoading) {
      networkAwareLoading.value = true
    }

    // Check offline capabilities
    if (!isOnline.value) {
      const capability = offlineManager.getOfflineCapability()
      if (!capability.canAccessFeatures.includes(operationName)) {
        throw new Error('此功能需要网络连接，请检查网络后重试')
      }
    }

    const result = await operation()
    networkRetryCount.value = 0 // Reset retry count on success
    return result
  } catch (error: any) {
    // Enhanced error handling with network awareness
    if (isNetworkError(error)) {
      if (retryable && networkRetryCount.value < maxNetworkRetries) {
        networkRetryCount.value++
        const delay = Math.min(1000 * Math.pow(2, networkRetryCount.value), 10000)
        await new Promise(resolve => setTimeout(resolve, delay))
        return handleNetworkAwareOperation(operation, options)
      }
    }
    
    networkRetryCount.value = 0
    throw error
  } finally {
    if (showLoading) {
      networkAwareLoading.value = false
    }
  }
}
```

This notification system ensures consistent, accessible, and user-friendly feedback throughout the application while integrating seamlessly with the error logging system.