# 通知系统 Vue Query 迁移

## 概述

通知系统已成功迁移到 Vue Query，提供智能缓存、后台更新和一致的状态管理。新系统与现有的 store 方法完全兼容，确保平滑过渡。

## 核心文件

- `src/composables/useNotifications.ts` - Vue Query 通知管理组合函数
- `src/composables/useNotificationIntegration.ts` - Store 集成层
- `src/composables/useNotifications.test.ts` - 单元测试

## 使用方法

### 1. 基础用法

```typescript
import { useNotifications } from '@/composables/useNotifications'

export default {
  setup() {
    const userId = 'user-123'
    const notifications = useNotifications(userId)
    
    return {
      notifications: notifications.data,
      isLoading: notifications.isLoading,
      error: notifications.error,
    }
  }
}
```

### 2. 完整功能集成

```typescript
import { useNotificationData } from '@/composables/useNotifications'

export default {
  setup() {
    const userId = 'user-123'
    const {
      notifications,
      unreadCount,
      hasUnread,
      isLoading,
      markAsRead,
      markAllAsRead,
      clearRead,
    } = useNotificationData(userId)
    
    const handleMarkAsRead = (notificationId: string) => {
      markAsRead.mutate({ userId, notificationId })
    }
    
    return {
      notifications,
      unreadCount,
      hasUnread,
      isLoading,
      handleMarkAsRead,
    }
  }
}
```

### 3. Store 兼容集成

```typescript
import { useNotificationIntegration } from '@/composables/useNotificationIntegration'

export default {
  setup() {
    const store = useAppStore()
    
    // 自动集成 Vue Query 与 Store
    const {
      notifications,
      unreadCount,
      markNotificationRead,
      markAllNotificationsRead,
      deleteReadNotifications,
    } = useNotificationIntegration(store.user?.id || '')
    
    return {
      notifications,
      unreadCount,
      markNotificationRead,
      markAllNotificationsRead,
      deleteReadNotifications,
    }
  }
}
```

## 缓存配置

通知系统使用以下缓存策略：

```typescript
{
  staleTime: 1000 * 10,        // 10秒后数据过期（实时性要求高）
  gcTime: 1000 * 60 * 15,      // 15分钟后从内存中清除
  refetchOnMount: false,       // 挂载时不自动重新获取
  refetchOnWindowFocus: false, // 窗口焦点时不自动重新获取
  refetchOnReconnect: true,    // 网络重连时直接重新获取
}
```

## API 参考

### useNotifications(userId: string)

获取用户通知列表的基础 hook。

**参数：**
- `userId: string` - 用户ID

**返回：**
- `data: NotificationItem[]` - 通知列表
- `isLoading: boolean` - 加载状态
- `error: Error | null` - 错误信息
- `refetch: () => void` - 手动刷新

### useNotificationData(userId: string)

完整的通知数据管理 hook，包含所有操作方法。

**返回：**
- `notifications` - 通知查询对象
- `unreadCount` - 未读通知数量
- `hasUnread` - 是否有未读通知
- `markAsRead` - 标记为已读的 mutation
- `markAllAsRead` - 标记所有为已读的 mutation
- `clearRead` - 清除已读通知的 mutation
- `clearAll` - 清除所有通知的 mutation

### 通知创建辅助函数

```typescript
// 创建通用通知
createNotification(id, title, body, options?)

// 创建评委邀请通知
createJudgeInvitedNotification(eventId, eventTitle, userId)

// 创建评委移除通知
createJudgeRemovedNotification(eventId, eventTitle, userId)
```

## 数据类型

```typescript
type NotificationItem = {
  id: string
  title: string
  body: string
  created_at: string
  read: boolean
  link?: string
}
```

## 存储机制

通知数据存储在 localStorage 中，键格式为 `notifications:${userId}`。这确保：

1. **用户隔离** - 每个用户的通知独立存储
2. **持久化** - 通知在页面刷新后保持
3. **性能** - 本地存储避免不必要的网络请求
4. **限制** - 最多存储 200 条通知

## 向