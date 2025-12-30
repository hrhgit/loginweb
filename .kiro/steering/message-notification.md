# Message Notification System Guidelines

## Overview

This document defines the standards and practices for implementing the message notification system in the event management platform. The system provides user feedback through banners, toasts, modals, and real-time notifications.

## Notification Architecture

### Core Components

#### 1. Notification Store (`src/store/notificationStore.ts`)
- Centralized notification state management
- Message queuing and display logic
- Auto-dismiss timers and user interactions
- Notification history and persistence

#### 2. Global Banner Component (`src/components/feedback/GlobalBanner.vue`)
- Primary notification display mechanism
- Support for multiple notification types
- Smooth animations and transitions
- Accessibility compliance

#### 3. Toast System (`src/components/feedback/ToastContainer.vue`)
- Non-blocking notification overlay
- Stack management for multiple toasts
- Position and timing configuration
- Mobile-responsive design

#### 4. Real-time Notifications (`src/composables/useRealTimeNotifications.ts`)
- Supabase real-time subscription integration
- Event-based notification triggers
- Background notification handling
- Browser notification API integration

### Notification Types

```typescript
enum NotificationType {
  SUCCESS = 'success',
  ERROR = 'error', 
  WARNING = 'warning',
  INFO = 'info',
  LOADING = 'loading'
}

enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

enum NotificationChannel {
  BANNER = 'banner',
  TOAST = 'toast',
  MODAL = 'modal',
  BROWSER = 'browser',
  EMAIL = 'email'
}
```

### Notification Data Structure

```typescript
interface Notification {
  id: string
  type: NotificationType
  priority: NotificationPriority
  channel: NotificationChannel[]
  title?: string
  message: string
  description?: string
  actionText?: string
  actionCallback?: () => void
  dismissible: boolean
  autoHide: boolean
  duration: number
  timestamp: string
  userId?: string
  eventId?: string
  teamId?: string
  read: boolean
  persistent: boolean
}
```

## Implementation Standards

### 1. Notification Display Patterns

#### Success Messages
```typescript
// Event creation success
showNotification({
  type: NotificationType.SUCCESS,
  channel: [NotificationChannel.BANNER],
  message: '活动创建成功！',
  description: '您的活动已保存为草稿，可以继续编辑或发布',
  actionText: '查看活动',
  actionCallback: () => router.push(`/events/${eventId}`),
  duration: 5000
})
```

#### Error Handling Integration
```typescript
// Database error with retry option
showNotification({
  type: NotificationType.ERROR,
  channel: [NotificationChannel.BANNER, NotificationChannel.TOAST],
  priority: NotificationPriority.HIGH,
  message: '保存失败',
  description: '网络连接异常，请检查网络后重试',
  actionText: '重试',
  actionCallback: () => retryOperation(),
  dismissible: true,
  autoHide: false
})
```

#### Loading States
```typescript
// Long-running operation feedback
const loadingId = showNotification({
  type: NotificationType.LOADING,
  channel: [NotificationChannel.BANNER],
  message: '正在上传文件...',
  dismissible: false,
  autoHide: false,
  persistent: true
})

// Update on completion
updateNotification(loadingId, {
  type: NotificationType.SUCCESS,
  message: '文件上传完成',
  autoHide: true,
  duration: 3000
})
```

### 2. Real-time Notification Triggers

#### Event-based Notifications
```typescript
// Team invitation received
const teamInviteNotification = {
  type: NotificationType.INFO,
  channel: [NotificationChannel.TOAST, NotificationChannel.BROWSER],
  priority: NotificationPriority.HIGH,
  title: '团队邀请',
  message: `${inviterName} 邀请您加入团队 "${teamName}"`,
  actionText: '查看邀请',
  actionCallback: () => router.push('/teams/invitations'),
  duration: 10000
}
```

#### System Notifications
```typescript
// Event deadline reminder
const deadlineReminder = {
  type: NotificationType.WARNING,
  channel: [NotificationChannel.BANNER, NotificationChannel.EMAIL],
  priority: NotificationPriority.URGENT,
  title: '截止日期提醒',
  message: '活动提交截止时间还有 2 小时',
  description: '请尽快完成并提交您的作品',
  actionText: '立即提交',
  actionCallback: () => router.push('/submissions'),
  persistent: true
}
```

### 3. Notification Styling System

#### Banner Variants
```css
.global-banner {
  /* Base banner styles */
}

.global-banner--success {
  background: var(--accent-soft);
  border-left: 4px solid var(--accent);
  color: var(--accent);
}

.global-banner--error {
  background: rgba(182, 45, 28, 0.1);
  border-left: 4px solid var(--danger);
  color: var(--danger);
}

.global-banner--warning {
  background: rgba(224, 122, 95, 0.1);
  border-left: 4px solid var(--accent-2);
  color: var(--accent-2);
}

.global-banner--info {
  background: var(--surface-muted);
  border-left: 4px solid var(--muted);
  color: var(--ink);
}
```

#### Toast Positioning
```css
.toast-container {
  position: fixed;
  top: 80px;
  right: 20px;
  z-index: 1000;
  max-width: 400px;
}

.toast-item {
  margin-bottom: 12px;
  transform: translateX(100%);
  animation: slideIn 0.3s ease forwards;
}

@keyframes slideIn {
  to { transform: translateX(0); }
}
```

### 4. Database Schema

#### Notifications Table
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  type TEXT NOT NULL,
  priority TEXT NOT NULL,
  channel TEXT[] NOT NULL,
  title TEXT,
  message TEXT NOT NULL,
  description TEXT,
  action_text TEXT,
  action_url TEXT,
  user_id UUID REFERENCES auth.users(id),
  event_id UUID REFERENCES events(id),
  team_id UUID REFERENCES teams(id),
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  dismissed BOOLEAN DEFAULT FALSE,
  dismissed_at TIMESTAMPTZ,
  persistent BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ
);
```

#### Notification Preferences
```sql
CREATE TABLE notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  email_notifications BOOLEAN DEFAULT TRUE,
  browser_notifications BOOLEAN DEFAULT TRUE,
  team_invitations BOOLEAN DEFAULT TRUE,
  event_updates BOOLEAN DEFAULT TRUE,
  deadline_reminders BOOLEAN DEFAULT TRUE,
  system_announcements BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
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
// In appStore.ts
import { useNotificationStore } from './notificationStore'

const notificationStore = useNotificationStore()

// Success feedback pattern
async function createEvent(eventData: EventData) {
  try {
    const result = await supabase.from('events').insert(eventData)
    
    notificationStore.show({
      type: NotificationType.SUCCESS,
      message: '活动创建成功！',
      actionText: '查看活动',
      actionCallback: () => router.push(`/events/${result.data.id}`)
    })
    
    return result.data
  } catch (error) {
    notificationStore.show({
      type: NotificationType.ERROR,
      message: '创建活动失败，请稍后重试'
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
    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
import { useNotificationStore } from '@/store/notificationStore'

const notifications = useNotificationStore()

// Show notification on mount if needed
onMounted(() => {
  if (route.query.success) {
    notifications.show({
      type: NotificationType.SUCCESS,
      message: '操作完成！'
    })
  }
})
</script>
```

### 3. Real-time Integration
```typescript
// Real-time notification listener
const setupRealTimeNotifications = () => {
  supabase
    .channel('notifications')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${user.value?.id}`
    }, (payload) => {
      const notification = payload.new as Notification
      
      // Show browser notification if permitted
      if (notification.channel.includes(NotificationChannel.BROWSER)) {
        showBrowserNotification(notification)
      }
      
      // Add to notification store
      notificationStore.addRealTimeNotification(notification)
    })
    .subscribe()
}
```

This notification system ensures consistent, accessible, and user-friendly feedback throughout the application while integrating seamlessly with the error logging system.