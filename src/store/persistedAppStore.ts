/**
 * 持久化应用状态示例
 * 展示如何使用状态持久化实现真正的即时加载
 */

import { computed } from 'vue'
import { createPersistedRef } from '../utils/statePersistence'
import type { Event, User } from './models'

// 使用持久化状态替代普通 ref
const events = createPersistedRef<Event[]>([], {
  key: 'app_events',
  ttl: 300000 // 5分钟缓存
})

const eventsLoaded = createPersistedRef<boolean>(false, {
  key: 'app_events_loaded',
  ttl: 300000
})

const user = createPersistedRef<User | null>(null, {
  key: 'app_user',
  ttl: 3600000 // 1小时缓存
})

// 计算属性保持不变
const publicEvents = computed(() => 
  events.value.filter(event => event.status === 'published' || event.status === 'ended')
)

const isAuthed = computed(() => Boolean(user.value))

// 优化的加载函数
const ensureEventsLoaded = async () => {
  // 如果已有持久化数据且未过期，直接返回
  if (eventsLoaded.value && events.value.length > 0) {
    return
  }
  
  // 否则正常加载
  await loadEvents()
}

const loadEvents = async () => {
  // 正常的加载逻辑...
  // 数据加载完成后，状态会自动持久化
}

export {
  events,
  eventsLoaded,
  user,
  publicEvents,
  isAuthed,
  ensureEventsLoaded,
  loadEvents
}