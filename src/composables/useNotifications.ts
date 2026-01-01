/**
 * 通知数据管理 - 使用 Vue Query
 * 提供智能缓存、后台更新、离线支持等功能
 */

import { computed } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { queryKeys } from '../lib/vueQuery'
import { useAppStore } from '../store/appStore'

// 通知数据类型
export type NotificationItem = {
  id: string
  title: string
  body: string
  created_at: string
  read: boolean
  link?: string
}

// 通知数据获取函数
const fetchNotifications = async (userId: string): Promise<NotificationItem[]> => {
  if (!userId) return []

  // 从 localStorage 获取通知数据（当前的存储模式）
  const storageKey = `notifications:${userId}`
  const raw = window.localStorage.getItem(storageKey)
  
  if (!raw) return []
  
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// 持久化通知数据到 localStorage
const persistNotifications = (userId: string, notifications: NotificationItem[]): void => {
  if (!userId) return
  
  const storageKey = `notifications:${userId}`
  window.localStorage.setItem(storageKey, JSON.stringify(notifications))
}

// Vue Query Hooks

/**
 * 获取用户通知列表
 */
export function useNotifications(userId: string) {
  return useQuery({
    queryKey: queryKeys.notifications.byUser(userId),
    queryFn: () => fetchNotifications(userId),
    enabled: computed(() => Boolean(userId)),
    staleTime: 1000 * 10, // 10秒后数据过期，触发后台更新（通知需要实时性）
    gcTime: 1000 * 60 * 15, // 15分钟后从内存中清除
    refetchOnMount: false, // 挂载时不自动重新获取（除非缓存不存在）
    refetchOnWindowFocus: false, // 窗口焦点时不自动重新获取（除非缓存不存在）
    refetchOnReconnect: true, // 网络重连时直接重新获取
    retry: (failureCount, error: any) => {
      // 本地存储操作通常不需要重试，但保持一致性
      const isNetworkError = error?.message?.includes('网络') || 
                            error?.message?.includes('fetch') ||
                            error?.code === 'NETWORK_ERROR'
      return isNetworkError && failureCount < 3
    },
  })
}

/**
 * 添加新通知
 */
export function useAddNotification() {
  const queryClient = useQueryClient()
  const store = useAppStore()

  return useMutation({
    mutationFn: async (payload: {
      userId: string
      notification: NotificationItem
    }) => {
      const { userId, notification } = payload
      
      // 获取当前通知列表
      const currentNotifications = await fetchNotifications(userId)
      
      // 检查是否已存在相同ID的通知
      if (currentNotifications.some(item => item.id === notification.id)) {
        return false // 通知已存在，不重复添加
      }
      
      // 添加新通知到列表开头，限制最多200条
      const updatedNotifications = [notification, ...currentNotifications].slice(0, 200)
      
      // 持久化到 localStorage
      persistNotifications(userId, updatedNotifications)
      
      return true
    },
    onSuccess: (wasAdded, variables) => {
      if (wasAdded) {
        // 使通知缓存失效，触发重新获取
        queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.byUser(variables.userId)
        })
      }
    },
    onError: (error: any) => {
      console.error('Failed to add notification:', error)
      store.setBanner('error', '添加通知失败')
    },
  })
}

/**
 * 标记通知为已读
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  const store = useAppStore()

  return useMutation({
    mutationFn: async (payload: {
      userId: string
      notificationId: string
    }) => {
      const { userId, notificationId } = payload
      
      // 获取当前通知列表
      const currentNotifications = await fetchNotifications(userId)
      
      // 更新指定通知的已读状态
      const updatedNotifications = currentNotifications.map(item => 
        item.id === notificationId ? { ...item, read: true } : item
      )
      
      // 持久化到 localStorage
      persistNotifications(userId, updatedNotifications)
      
      return updatedNotifications
    },
    onSuccess: (updatedNotifications, variables) => {
      // 直接更新缓存数据，避免重新获取
      queryClient.setQueryData(
        queryKeys.notifications.byUser(variables.userId),
        updatedNotifications
      )
    },
    onError: (error: any) => {
      console.error('Failed to mark notification as read:', error)
      store.setBanner('error', '标记通知失败')
    },
  })
}

/**
 * 标记所有通知为已读
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  const store = useAppStore()

  return useMutation({
    mutationFn: async (payload: { userId: string }) => {
      const { userId } = payload
      
      // 获取当前通知列表
      const currentNotifications = await fetchNotifications(userId)
      
      // 标记所有通知为已读
      const updatedNotifications = currentNotifications.map(item => ({ ...item, read: true }))
      
      // 持久化到 localStorage
      persistNotifications(userId, updatedNotifications)
      
      return updatedNotifications
    },
    onSuccess: (updatedNotifications, variables) => {
      // 直接更新缓存数据
      queryClient.setQueryData(
        queryKeys.notifications.byUser(variables.userId),
        updatedNotifications
      )
      
      store.setBanner('info', '所有通知已标记为已读')
    },
    onError: (error: any) => {
      console.error('Failed to mark all notifications as read:', error)
      store.setBanner('error', '标记通知失败')
    },
  })
}

/**
 * 清除已读通知
 */
export function useClearReadNotifications() {
  const queryClient = useQueryClient()
  const store = useAppStore()

  return useMutation({
    mutationFn: async (payload: { userId: string }) => {
      const { userId } = payload
      
      // 获取当前通知列表
      const currentNotifications = await fetchNotifications(userId)
      
      // 过滤掉已读通知
      const unreadNotifications = currentNotifications.filter(item => !item.read)
      
      // 如果没有变化，直接返回
      if (unreadNotifications.length === currentNotifications.length) {
        return currentNotifications
      }
      
      // 持久化到 localStorage
      persistNotifications(userId, unreadNotifications)
      
      return unreadNotifications
    },
    onSuccess: (updatedNotifications, variables) => {
      // 直接更新缓存数据
      queryClient.setQueryData(
        queryKeys.notifications.byUser(variables.userId),
        updatedNotifications
      )
      
      store.setBanner('info', '已读通知已清除')
    },
    onError: (error: any) => {
      console.error('Failed to clear read notifications:', error)
      store.setBanner('error', '清除通知失败')
    },
  })
}

/**
 * 清除所有通知
 */
export function useClearAllNotifications() {
  const queryClient = useQueryClient()
  const store = useAppStore()

  return useMutation({
    mutationFn: async (payload: { userId: string }) => {
      const { userId } = payload
      
      // 清空通知列表
      const emptyNotifications: NotificationItem[] = []
      
      // 持久化到 localStorage
      persistNotifications(userId, emptyNotifications)
      
      return emptyNotifications
    },
    onSuccess: (updatedNotifications, variables) => {
      // 直接更新缓存数据
      queryClient.setQueryData(
        queryKeys.notifications.byUser(variables.userId),
        updatedNotifications
      )
      
      store.setBanner('info', '所有通知已清除')
    },
    onError: (error: any) => {
      console.error('Failed to clear all notifications:', error)
      store.setBanner('error', '清除通知失败')
    },
  })
}

// 便捷的组合函数
export function useNotificationData(userId: string) {
  const notifications = useNotifications(userId)
  const markAsRead = useMarkNotificationRead()
  const markAllAsRead = useMarkAllNotificationsRead()
  const clearRead = useClearReadNotifications()
  const clearAll = useClearAllNotifications()

  return {
    notifications,
    markAsRead,
    markAllAsRead,
    clearRead,
    clearAll,
    // 计算属性
    unreadCount: computed(() => {
      const data = notifications.data.value || []
      return data.filter(item => !item.read).length
    }),
    hasUnread: computed(() => {
      const data = notifications.data.value || []
      return data.some(item => !item.read)
    }),
    isLoading: notifications.isLoading,
    error: notifications.error,
    refetch: notifications.refetch,
  }
}

// 创建通知的辅助函数
export function createNotification(
  id: string,
  title: string,
  body: string,
  options?: {
    link?: string
    read?: boolean
  }
): NotificationItem {
  return {
    id,
    title,
    body,
    created_at: new Date().toISOString(),
    read: options?.read || false,
    link: options?.link,
  }
}

// 创建评委相关通知的辅助函数
export function createJudgeInvitedNotification(
  eventId: string,
  eventTitle: string,
  userId: string
): NotificationItem {
  return createNotification(
    `judge-invited:${eventId}:${userId}:${Date.now()}`,
    '您被邀请为评委',
    `您已被邀请为活动"${eventTitle}"的评委，现在可以访问评委工作台查看作品。`,
    {
      link: `/events/${eventId}?tab=judge`
    }
  )
}

export function createJudgeRemovedNotification(
  eventId: string,
  eventTitle: string,
  userId: string
): NotificationItem {
  return createNotification(
    `judge-removed:${eventId}:${userId}:${Date.now()}`,
    '评委权限已撤销',
    `您在活动"${eventTitle}"的评委权限已被撤销。`,
    {
      link: `/events/${eventId}`
    }
  )
}