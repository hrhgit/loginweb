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
        <h3>活动列表 ({{ store.events.length }})</h3>
        <div v-if="store.events.length === 0" class="empty-state">
          <p>没有活动数据</p>
          <p v-if="store.eventsError" class="error">错误: {{ store.eventsError }}</p>
        </div>
        <div v-else class="events-list">
          <div v-for="event in store.events" :key="event.id" class="event-item">
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
import { ref } from 'vue'
import { useAppStore } from '../store/appStore'

const store = useAppStore()
const loading = ref(false)
const debugInfo = ref<any>({})

const debugState = () => {
  debugInfo.value = store.debugEventsState()
}

const forceReload = async () => {
  loading.value = true
  try {
    await store.forceReloadEvents()
    debugState()
  } catch (error) {
    console.error('Force reload failed:', error)
  } finally {
    loading.value = false
  }
}

const clearCache = () => {
  // 清除状态缓存
  if (store.stateCache) {
    store.stateCache.clear()
  }
  // 重置状态
  store.eventsLoaded = false
  store.eventsError = ''
  debugState()
}

const backgroundRefresh = async () => {
  loading.value = true
  try {
    await store.refreshEventsInBackground()
    debugState()
  } catch (error) {
    console.error('Background refresh failed:', error)
  } finally {
    loading.value = false
  }
}

const resetPageState = () => {
  store.resetPageLoadState()
  debugState()
}

const ensureLoaded = async () => {
  loading.value = true
  try {
    await store.ensureEventsLoaded()
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