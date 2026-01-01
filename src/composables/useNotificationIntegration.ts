/**
 * 通知系统集成 - 连接 Vue Query 和 Store
 * 提供向后兼容的通知管理
 */

import { onMounted, onUnmounted } from 'vue'
import { useAppStore } from '../store/appStore'
import { 
  useNotificationData,
  useAddNotification,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useClearReadNotifications,
  useClearAllNotifications
} from './useNotifications'

/**
 * 集成 Vue Query 通知系统与现有 Store
 * 这个组合函数确保新的 Vue Query 系统与现有的 store 方法兼容
 */
export function useNotificationIntegration(userId: string) {
  const store = useAppStore()
  
  // Vue Query hooks
  const notificationData = useNotificationData(userId)
  const addNotification = useAddNotification()
  const markAsRead = useMarkNotificationRead()
  const markAllAsRead = useMarkAllNotificationsRead()
  const clearRead = useClearReadNotifications()
  const clearAll = useClearAllNotifications()

  // 在组件挂载时设置 Vue Query mutations 到 store
  onMounted(() => {
    store.setVueQueryNotificationMutations({
      addNotification,
      markAsRead,
      markAllAsRead,
      clearRead,
      clearAll,
    })
  })

  // 清理
  onUnmounted(() => {
    store.setVueQueryNotificationMutations({})
  })

  return {
    // Vue Query 数据和方法
    notifications: notificationData.notifications,
    unreadCount: notificationData.unreadCount,
    hasUnread: notificationData.hasUnread,
    isLoading: notificationData.isLoading,
    error: notificationData.error,
    refetch: notificationData.refetch,
    
    // 操作方法（与 store 方法兼容）
    markNotificationRead: (id: string) => {
      markAsRead.mutate({ userId, notificationId: id })
    },
    markAllNotificationsRead: () => {
      markAllAsRead.mutate({ userId })
    },
    deleteReadNotifications: () => {
      clearRead.mutate({ userId })
    },
    clearAllNotifications: () => {
      clearAll.mutate({ userId })
    },
    
    // 添加通知（用于系统内部）
    addNotification: addNotification.mutate,
    
    // 状态
    isMarkingRead: markAsRead.isPending,
    isMarkingAllRead: markAllAsRead.isPending,
    isClearingRead: clearRead.isPending,
    isClearingAll: clearAll.isPending,
  }
}

/**
 * 简化的通知集成 Hook
 * 自动使用当前用户ID
 */
export function useCurrentUserNotifications() {
  const store = useAppStore()
  
  if (!store.user) {
    throw new Error('useCurrentUserNotifications requires authenticated user')
  }
  
  return useNotificationIntegration(store.user.id)
}