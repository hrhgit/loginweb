/**
 * 加载状态优化工具
 * 用于防止页面加载时的闪烁问题
 */

import { computed, ref, type Ref } from 'vue'

export interface LoadingStateOptions {
  /** 是否正在加载 */
  isLoading: Ref<boolean>
  /** 数据是否已加载完成 */
  isDataLoaded: Ref<boolean>
  /** 当前数据数量 */
  dataCount: Ref<number>
  /** 是否正在初始化 */
  isInitializing?: Ref<boolean>
}

/**
 * 创建优化的加载状态计算属性
 * 防止在有数据时显示加载状态造成闪烁
 */
export function createOptimizedLoadingState(options: LoadingStateOptions) {
  const { isLoading, isDataLoaded, dataCount, isInitializing } = options

  return computed(() => {
    // 如果已经有数据，即使在加载中也不显示加载状态（避免闪烁）
    if (dataCount.value > 0) return false
    
    // 如果数据已加载完成且没有数据，不显示加载状态（显示空状态）
    if (isDataLoaded.value && dataCount.value === 0) return false
    
    // 只有在真正加载中且没有数据时才显示加载状态
    return isLoading.value || (isInitializing?.value ?? false)
  })
}

/**
 * 创建优化的刷新状态管理
 */
export function createRefreshState() {
  const isRefreshing = ref(false)
  
  const handleRefresh = async (refreshFn: () => Promise<void>) => {
    try {
      isRefreshing.value = true
      await refreshFn()
    } catch (error) {
      console.error('Refresh failed:', error)
      throw error
    } finally {
      isRefreshing.value = false
    }
  }
  
  return {
    isRefreshing,
    handleRefresh
  }
}