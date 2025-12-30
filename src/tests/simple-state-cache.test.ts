/**
 * 简单状态缓存测试
 * 验证缓存功能的正确性
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { stateCache } from '../utils/simpleStateCache'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  key: vi.fn(),
  length: 0,
  clear: vi.fn()
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

describe('SimpleStateCache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  describe('基础功能', () => {
    it('应该能够设置和获取缓存', () => {
      const testData = { id: '1', name: 'Test Event' }
      
      // 模拟 localStorage 可用
      localStorageMock.setItem.mockImplementation(() => {})
      localStorageMock.getItem.mockReturnValue(JSON.stringify({
        data: testData,
        timestamp: Date.now(),
        ttl: 5 * 60 * 1000 // 5分钟
      }))

      stateCache.set('test', testData, 5)
      const result = stateCache.get('test')

      expect(result).toEqual(testData)
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'app_cache_test',
        expect.stringContaining('"data":{"id":"1","name":"Test Event"}')
      )
    })

    it('应该在数据过期时返回null', () => {
      const testData = { id: '1', name: 'Test Event' }
      
      // 模拟过期的缓存数据
      localStorageMock.getItem.mockReturnValue(JSON.stringify({
        data: testData,
        timestamp: Date.now() - 10 * 60 * 1000, // 10分钟前
        ttl: 5 * 60 * 1000 // 5分钟TTL
      }))

      const result = stateCache.get('test')

      expect(result).toBeNull()
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('app_cache_test')
    })

    it('应该在localStorage不可用时静默失败', () => {
      // 模拟 localStorage 不可用
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('localStorage not available')
      })
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('localStorage not available')
      })

      // 不应该抛出错误
      expect(() => {
        stateCache.set('test', { data: 'test' }, 5)
        stateCache.get('test')
      }).not.toThrow()
    })
  })

  describe('缓存管理', () => {
    it('应该能够移除特定缓存', () => {
      // 模拟 localStorage 可用
      localStorageMock.removeItem.mockImplementation(() => {})
      
      stateCache.remove('test')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('app_cache_test')
    })

    it('应该能够清除所有缓存', () => {
      // 模拟 localStorage 中有多个缓存项
      const mockKeys = ['app_cache_events', 'app_cache_user', 'other_key']
      Object.defineProperty(window, 'localStorage', {
        value: {
          ...localStorageMock,
          length: mockKeys.length,
          key: vi.fn((index) => mockKeys[index] || null),
          removeItem: vi.fn()
        }
      })

      stateCache.clear()

      expect(window.localStorage.removeItem).toHaveBeenCalledWith('app_cache_events')
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('app_cache_user')
      expect(window.localStorage.removeItem).not.toHaveBeenCalledWith('other_key')
    })
  })

  describe('数据类型支持', () => {
    it('应该支持数组类型', () => {
      const testArray = [{ id: '1' }, { id: '2' }]
      
      // 模拟 localStorage 可用且返回正确数据
      localStorageMock.setItem.mockImplementation(() => {})
      localStorageMock.getItem.mockReturnValue(JSON.stringify({
        data: testArray,
        timestamp: Date.now(),
        ttl: 5 * 60 * 1000
      }))

      // 先设置再获取
      stateCache.set('events', testArray, 5)
      const result = stateCache.get('events')

      expect(result).toEqual(testArray)
    })

    it('应该支持对象类型', () => {
      const testObject = { key1: 'value1', key2: { nested: 'value' } }
      
      // 模拟 localStorage 可用且返回正确数据
      localStorageMock.setItem.mockImplementation(() => {})
      localStorageMock.getItem.mockReturnValue(JSON.stringify({
        data: testObject,
        timestamp: Date.now(),
        ttl: 5 * 60 * 1000
      }))

      stateCache.set('config', testObject, 5)
      const result = stateCache.get('config')

      expect(result).toEqual(testObject)
    })

    it('应该支持基础类型', () => {
      // 模拟 localStorage 可用且返回正确数据
      localStorageMock.setItem.mockImplementation(() => {})
      localStorageMock.getItem.mockReturnValue(JSON.stringify({
        data: true,
        timestamp: Date.now(),
        ttl: 5 * 60 * 1000
      }))

      stateCache.set('flag', true, 5)
      const result = stateCache.get('flag')

      expect(result).toBe(true)
    })
  })
})