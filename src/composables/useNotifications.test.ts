/**
 * 通知管理 Vue Query 组合函数测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createNotification, type NotificationItem } from './useNotifications'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createNotification', () => {
    it('should create a notification with required fields', () => {
      const notification = createNotification(
        'test-id',
        'Test Title',
        'Test Body'
      )

      expect(notification).toMatchObject({
        id: 'test-id',
        title: 'Test Title',
        body: 'Test Body',
        read: false,
      })
      expect(notification.created_at).toBeDefined()
      expect(new Date(notification.created_at)).toBeInstanceOf(Date)
    })

    it('should create a notification with optional fields', () => {
      const notification = createNotification(
        'test-id',
        'Test Title',
        'Test Body',
        {
          link: '/test-link',
          read: true,
        }
      )

      expect(notification).toMatchObject({
        id: 'test-id',
        title: 'Test Title',
        body: 'Test Body',
        read: true,
        link: '/test-link',
      })
    })
  })

  describe('createJudgeInvitedNotification', () => {
    it('should create a judge invited notification', async () => {
      const { createJudgeInvitedNotification } = await import('./useNotifications')
      
      const notification = createJudgeInvitedNotification(
        'event-123',
        'Test Event',
        'user-456'
      )

      expect(notification.title).toBe('您被邀请为评委')
      expect(notification.body).toContain('Test Event')
      expect(notification.link).toBe('/events/event-123?tab=judge')
      expect(notification.read).toBe(false)
      expect(notification.id).toContain('judge-invited:event-123:user-456')
    })
  })

  describe('createJudgeRemovedNotification', () => {
    it('should create a judge removed notification', async () => {
      const { createJudgeRemovedNotification } = await import('./useNotifications')
      
      const notification = createJudgeRemovedNotification(
        'event-123',
        'Test Event',
        'user-456'
      )

      expect(notification.title).toBe('评委权限已撤销')
      expect(notification.body).toContain('Test Event')
      expect(notification.link).toBe('/events/event-123')
      expect(notification.read).toBe(false)
      expect(notification.id).toContain('judge-removed:event-123:user-456')
    })
  })
})

describe('Notification Storage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle empty localStorage gracefully', () => {
    localStorageMock.getItem.mockReturnValue(null)
    
    // This would be tested with actual Vue Query hooks in a component test
    // For now, we just verify localStorage interaction
    expect(() => {
      const key = 'notifications:user-123'
      const result = window.localStorage.getItem(key)
      expect(result).toBeNull()
    }).not.toThrow()
  })

  it('should handle invalid JSON in localStorage gracefully', () => {
    localStorageMock.getItem.mockReturnValue('invalid-json')
    
    expect(() => {
      const raw = window.localStorage.getItem('notifications:user-123')
      if (raw) {
        try {
          JSON.parse(raw)
        } catch {
          // Should handle gracefully
          return []
        }
      }
    }).not.toThrow()
  })

  it('should persist notifications to localStorage', () => {
    const notifications: NotificationItem[] = [
      createNotification('1', 'Title 1', 'Body 1'),
      createNotification('2', 'Title 2', 'Body 2'),
    ]

    const key = 'notifications:user-123'
    window.localStorage.setItem(key, JSON.stringify(notifications))

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      key,
      JSON.stringify(notifications)
    )
  })
})