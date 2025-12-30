/**
 * 即时加载优化工具
 * 通过预加载和状态持久化实现真正的即时显示
 */

import { ref, computed, onMounted } from 'vue'
import { createPersistedRef } from './statePersistence'

export interface InstantLoadingOptions<T> {
  /** 持久化键名 */
  persistKey: string
  /** 缓存过期时间（毫秒） */
  ttl?: number
  /** 数据加载函数 */
  loader: () => Promise<T>
  /** 默认值 */
  defaultValue: T
  /** 是否在后台自动刷新 */
  backgroundRefresh?: boolean
}

/**
 * 创建即时加载的数据状态
 */
export function createInstantLoadingState<T>(options: InstantLoadingOptions<T>) {
  const {
    persistKey,
    ttl = 300000, // 5分钟默认
    loader,
    defaultValue,
    backgroundRefresh = true
  } = options

  // 持久化的数据状态
  const data = createPersistedRef<T>(defaultValue, {
    key: `instant_${persistKey}`,
    ttl
  })

  // 持久化的加载状态
  const isLoaded = createPersistedRef<boolean>(false, {
    key: `instant_${persistKey}_loaded`,
    ttl
  })

  // 当前加载状态（不持久化）
  const isLoading = ref(false)
  const error = ref<string>('')

  // 是否应该显示加载状态
  const shouldShowLoading = computed(() => {
    // 如果有持久化数据，不显示加载状态
    if (isLoaded.value && !isArrayEmpty(data.value)) {
      return false
    }
    
    // 只有在真正加载中且没有数据时才显示
    return isLoading.value
  })

  // 确保数据已加载
  const ensureLoaded = async () => {
    // 如果已有有效的持久化数据，直接返回
    if (isLoaded.value && !isArrayEmpty(data.value)) {
      // 可选：在后台刷新数据
      if (backgroundRefresh) {
        refreshInBackground()
      }
      return
    }

    // 否则显示加载状态并加载数据
    await loadData()
  }

  // 加载数据
  const loadData = async () => {
    isLoading.value = true
    error.value = ''

    try {
      const result = await loader()
      data.value = result
      isLoaded.value = true
    } catch (err: any) {
      error.value = err.message || '加载失败'
      console.error(`Failed to load data for ${persistKey}:`, err)
    } finally {
      isLoading.value = false
    }
  }

  // 后台刷新数据
  const refreshInBackground = async () => {
    try {
      const result = await loader()
      data.value = result
      isLoaded.value = true
    } catch (err) {
      // 后台刷新失败时静默处理
      console.warn(`Background refresh failed for ${persistKey}:`, err)
    }
  }

  // 强制刷新
  const refresh = async () => {
    await loadData()
  }

  // 清除缓存
  const clearCache = () => {
    data.value = defaultValue
    isLoaded.value = false
  }

  return {
    data,
    isLoading,
    isLoaded,
    error,
    shouldShowLoading,
    ensureLoaded,
    refresh,
    clearCache
  }
}

/**
 * 检查数组是否为空（包括空数组）
 */
function isArrayEmpty(value: any): boolean {
  return Array.isArray(value) && value.length === 0
}

/**
 * 页面级即时加载 Hook
 */
export function useInstantPageLoading<T>(options: InstantLoadingOptions<T>) {
  const state = createInstantLoadingState(options)

  // 组件挂载时确保数据已加载
  onMounted(async () => {
    await state.ensureLoaded()
  })

  return state
}

/**
 * 预定义的即时加载配置
 */
export const instantLoadingConfigs = {
  events: {
    persistKey: 'events',
    ttl: 300000, // 5分钟
    backgroundRefresh: true
  },
  
  userProfile: {
    persistKey: 'user_profile',
    ttl: 3600000, // 1小时
    backgroundRefresh: true
  },
  
  teams: {
    persistKey: 'teams',
    ttl: 180000, // 3分钟
    backgroundRefresh: true
  }
}