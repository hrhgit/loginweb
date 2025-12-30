/**
 * 简单状态缓存 - 最小改动方案
 * 在现有代码基础上添加轻量级状态缓存
 */

interface CachedState<T> {
  data: T
  timestamp: number
  ttl: number
}

class SimpleStateCache {
  private prefix = 'app_cache_'

  /**
   * 检查 localStorage 是否可用
   */
  private isAvailable(): boolean {
    try {
      localStorage.setItem('test', 'test')
      localStorage.removeItem('test')
      return true
    } catch {
      return false
    }
  }

  /**
   * 保存状态到缓存
   */
  set<T>(key: string, data: T, ttlMinutes: number = 5): void {
    if (!this.isAvailable()) return // 静默失败，不影响功能
    
    try {
      const cached: CachedState<T> = {
        data,
        timestamp: Date.now(),
        ttl: ttlMinutes * 60 * 1000
      }
      localStorage.setItem(this.prefix + key, JSON.stringify(cached))
    } catch (error) {
      console.warn('Failed to cache state:', error)
    }
  }

  /**
   * 从缓存获取状态
   */
  get<T>(key: string): T | null {
    if (!this.isAvailable()) return null
    
    try {
      const stored = localStorage.getItem(this.prefix + key)
      if (!stored) return null

      const cached: CachedState<T> = JSON.parse(stored)
      
      // 检查是否过期
      if (Date.now() - cached.timestamp > cached.ttl) {
        this.remove(key)
        return null
      }

      return cached.data
    } catch (error) {
      console.warn('Failed to get cached state:', error)
      return null
    }
  }

  /**
   * 移除缓存
   */
  remove(key: string): void {
    if (!this.isAvailable()) return
    
    try {
      localStorage.removeItem(this.prefix + key)
    } catch (error) {
      console.warn('Failed to remove cached state:', error)
    }
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    if (!this.isAvailable()) return
    
    try {
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key)
        }
      })
    } catch (error) {
      console.warn('Failed to clear cache:', error)
    }
  }
}

export const stateCache = new SimpleStateCache()