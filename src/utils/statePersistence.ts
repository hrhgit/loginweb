/**
 * 状态持久化工具
 * 将 Vue 响应式状态持久化到 localStorage，实现真正的即时加载
 */

import { ref, watch, type Ref } from 'vue'

interface PersistenceOptions {
  key: string
  ttl?: number // 过期时间（毫秒）
  serialize?: (value: any) => string
  deserialize?: (value: string) => any
}

interface PersistedData<T> {
  data: T
  timestamp: number
  ttl: number
}

/**
 * 创建持久化的响应式状态
 */
export function createPersistedRef<T>(
  defaultValue: T,
  options: PersistenceOptions
): Ref<T> {
  const {
    key,
    ttl = 3600000, // 1小时默认
    serialize = JSON.stringify,
    deserialize = JSON.parse
  } = options

  // 尝试从 localStorage 恢复数据
  const restored = restoreFromStorage<T>(key, deserialize)
  const initialValue = restored !== null ? restored : defaultValue

  // 创建响应式引用
  const state = ref<T>(initialValue) as Ref<T>

  // 监听状态变化，自动持久化
  watch(
    state,
    (newValue) => {
      persistToStorage(key, newValue, ttl, serialize)
    },
    { deep: true }
  )

  return state
}

/**
 * 从 localStorage 恢复数据
 */
function restoreFromStorage<T>(
  key: string,
  deserialize: (value: string) => any
): T | null {
  try {
    const stored = localStorage.getItem(key)
    if (!stored) return null

    const parsed: PersistedData<T> = deserialize(stored)
    
    // 检查是否过期
    if (Date.now() - parsed.timestamp > parsed.ttl) {
      localStorage.removeItem(key)
      return null
    }

    return parsed.data
  } catch (error) {
    console.warn(`Failed to restore state for key "${key}":`, error)
    return null
  }
}

/**
 * 持久化数据到 localStorage
 */
function persistToStorage<T>(
  key: string,
  data: T,
  ttl: number,
  serialize: (value: any) => string
): void {
  try {
    const persistedData: PersistedData<T> = {
      data,
      timestamp: Date.now(),
      ttl
    }

    localStorage.setItem(key, serialize(persistedData))
  } catch (error) {
    console.warn(`Failed to persist state for key "${key}":`, error)
  }
}

/**
 * 清除持久化数据
 */
export function clearPersistedState(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch (error) {
    console.warn(`Failed to clear persisted state for key "${key}":`, error)
  }
}

/**
 * 批量清除持久化数据
 */
export function clearPersistedStatePattern(pattern: string): void {
  try {
    const regex = new RegExp(pattern)
    const keysToRemove: string[] = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && regex.test(key)) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key))
  } catch (error) {
    console.warn(`Failed to clear persisted state pattern "${pattern}":`, error)
  }
}