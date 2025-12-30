/**
 * appStore.ts 最小改动演示
 * 展示如何用最少的代码实现状态缓存
 */

// 1. 只需要添加这一行导入
import { stateCache } from '../utils/simpleStateCache'

// 2. 修改初始化（从原来的空值改为从缓存恢复）
// 原来：
// const events = ref<Event[]>([])
// const eventsLoaded = ref(false)

// 改为：
const events = ref<Event[]>(stateCache.get('events') || [])
const eventsLoaded = ref(stateCache.get('eventsLoaded') || false)

// 3. 在 loadEvents 函数中添加缓存（只需要添加2行）
const loadEvents = async () => {
  return handleNetworkAwareOperation(async () => {
    eventsError.value = ''
    eventsLoading.value = true

    // ... 现有的查询逻辑保持不变 ...

    if (error) {
      eventsError.value = error.message
      eventErrorHandler.handleError(error, { operation: 'loadEvents' })
      events.value = []
    } else {
      events.value = data as Event[]
      
      // 新增：只需要这2行
      stateCache.set('events', events.value, 5) // 缓存5分钟
      stateCache.set('eventsLoaded', true, 5)
    }

    eventsLoading.value = false
    eventsLoaded.value = true
    syncNotifications()
    
    return events.value
  }, {
    operationName: 'loadEvents',
    cacheKey: user.value ? `events_${user.value.id}_${isAdmin.value}` : 'events_public',
    retryable: true
  })
}

// 4. 修改 ensureEventsLoaded（只需要添加1行）
const ensureEventsLoaded = async () => {
  // 新增：这1行检查缓存
  if (eventsLoaded.value && events.value.length > 0) return
  
  // 原有逻辑保持不变
  if (eventsLoaded.value || eventsLoading.value) return
  await loadEvents()
}

// 5. 可选：在登出时清理缓存（1行）
const logout = async () => {
  // ... 现有登出逻辑 ...
  stateCache.clear() // 新增：清理缓存
}

/**
 * 总改动统计：
 * - 新增导入：1行
 * - 修改初始化：2行
 * - 添加缓存保存：2行  
 * - 添加缓存检查：1行
 * - 添加缓存清理：1行（可选）
 * 
 * 总计：约7行代码
 * 
 * 效果：
 * - 用户再次访问时立即显示上次的数据
 * - 在后台静默更新最新数据
 * - 完全不影响现有功能
 */