<template>
  <main class="main">
    <section class="page-head">
      <div>
        <h1>活动数据调试页面</h1>
        <p class="muted">用于诊断活动数据加载问题</p>
      </div>
    </section>

    <section class="debug-panel">
      <div class="debug-actions">
        <button class="btn btn--primary" @click="debugState">检查状态</button>
        <button class="btn btn--ghost" @click="forceReload" :disabled="loading">强制刷新</button>
        <button class="btn btn--ghost" @click="backgroundRefresh" :disabled="loading">后台刷新</button>
        <button class="btn btn--ghost" @click="resetPageState">重置页面状态</button>
        <button class="btn btn--ghost" @click="clearCache">清除缓存</button>
        <button class="btn btn--ghost" @click="ensureLoaded">确保加载</button>
      </div>

      <div class="debug-info">
        <h3>当前状态</h3>
        <pre>{{ JSON.stringify(debugInfo, null, 2) }}</pre>
      </div>

      <div class="debug-events">
        <h3>活动列表 ({{ eventsData.length }})</h3>
        <div v-if="eventsLoading" class="loading-state">
          <p>加载中...</p>
        </div>
        <div v-else-if="eventsError" class="error-state">
          <p class="error">错误: {{ eventsError.message }}</p>
        </div>
        <div v-else-if="eventsData.length === 0" class="empty-state">
          <p>没有活动数据</p>
        </div>
        <div v-else class="events-list">
          <div v-for="event in eventsData" :key="event.id" class="event-item">
            <strong>{{ event.title }}</strong>
            <span class="status">{{ event.status }}</span>
            <span class="created-by">{{ event.created_by }}</span>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAppStore } from '../store/appStore'
import { useEvents } from '../composables/useEvents'
import { useQueryClient } from '@tanstack/vue-query'
import { queryKeys } from '../lib/vueQuery'

const store = useAppStore()
const queryClient = useQueryClient()
const loading = ref(false)
const debugInfo = ref<any>({})

// Use Vue Query composables for events data
const { publicEvents, myEvents, allEvents } = useEvents(store.user?.id || null, store.isAdmin)

// Computed properties for debugging
const eventsData = computed(() => {
  if (store.isAdmin) {
    return allEvents.data.value || []
  }
  return publicEvents.data.value || []
})

const eventsLoading = computed(() => {
  if (store.isAdmin) {
    return allEvents.isLoading.value
  }
  return publicEvents.isLoading.value
})

const eventsError = computed(() => {
  if (store.isAdmin) {
    return allEvents.error.value
  }
  return publicEvents.error.value
})

const debugState = () => {
  debugInfo.value = {
    // User state
    user: store.user,
    isAdmin: store.isAdmin,
    isAuthed: store.isAuthed,
    
    // Events state from Vue Query
    eventsCount: eventsData.value.length,
    eventsLoading: eventsLoading.value,
    eventsError: eventsError.value?.message || null,
    
    // Cache information
    queryCache: queryClient.getQueryCache().getAll().map(query => ({
      queryKey: query.queryKey,
      state: query.state.status,
      dataUpdatedAt: query.state.dataUpdatedAt,
      errorUpdatedAt: query.state.errorUpdatedAt
    })),
    
    // Network state
    networkState: store.networkState,
    isOnline: store.isOnline,
    
    timestamp: new Date().toISOString()
  }
}

const forceReload = async () => {
  loading.value = true
  try {
    // Invalidate and refetch all events queries
    await queryClient.invalidateQueries({
      queryKey: queryKeys.events.all
    })
    
    // Force refetch
    if (store.isAdmin) {
      await allEvents.refetch()
    } else {
      await publicEvents.refetch()
    }
    
    debugState()
  } catch (error) {
    console.error('Force reload failed:', error)
  } finally {
    loading.value = false
  }
}

const clearCache = () => {
  // Clear Vue Query cache
  queryClient.clear()
  
  // Clear any remaining state cache
  if (store.stateCache) {
    store.stateCache.clear()
  }
  
  debugState()
}

const backgroundRefresh = async () => {
  loading.value = true
  try {
    // Trigger background refetch without invalidating cache
    if (store.isAdmin) {
      await allEvents.refetch()
    } else {
      await publicEvents.refetch()
    }
    
    debugState()
  } catch (error) {
    console.error('Background refresh failed:', error)
  } finally {
    loading.value = false
  }
}

const resetPageState = () => {
  // Reset Vue Query cache for events
  queryClient.resetQueries({
    queryKey: queryKeys.events.all
  })
  
  debugState()
}

const ensureLoaded = async () => {
  loading.value = true
  try {
    // Ensure events are loaded using Vue Query
    if (store.isAdmin) {
      if (!allEvents.data.value) {
        await allEvents.refetch()
      }
    } else {
      if (!publicEvents.data.value) {
        await publicEvents.refetch()
      }
    }
    
    debugState()
  } catch (error) {
    console.error('Ensure loaded failed:', error)
  } finally {
    loading.value = false
  }
}

// 初始化时检查状态
debugState()
</script>

<style scoped>
.debug-panel {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.debug-actions {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.debug-info {
  margin-bottom: 2rem;
}

.debug-info pre {
  background: var(--surface);
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 0.875rem;
  border: 1px solid var(--border);
}

.debug-events {
  margin-bottom: 2rem;
}

.events-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.event-item {
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 0.5rem;
  background: var(--surface);
  border-radius: 4px;
  border: 1px solid var(--border);
}

.status {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  background: var(--accent-soft);
  color: var(--accent);
}

.created-by {
  font-size: 0.875rem;
  color: var(--muted);
}

.empty-state {
  padding: 2rem;
  text-align: center;
  background: var(--surface);
  border-radius: 8px;
  border: 1px solid var(--border);
}

.error {
  color: var(--danger);
  font-weight: 500;
}
</style>