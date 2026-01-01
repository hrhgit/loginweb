<!--
  Vue Query 演示页面
  展示如何使用 Vue Query 进行数据管理
-->
<template>
  <div class="demo-page">
    <div class="demo-header">
      <h1>Vue Query 数据管理演示</h1>
      <p class="demo-description">
        这个页面展示了如何使用 Vue Query 来管理队伍和作品数据，
        提供智能缓存、后台更新、离线支持等功能。
      </p>
    </div>

    <!-- 活动选择器 -->
    <div class="event-selector">
      <label class="field__label">选择活动：</label>
      <select v-model="selectedEventId" class="field__input">
        <option value="">请选择活动</option>
        <option 
          v-for="event in store.publicEvents" 
          :key="event.id"
          :value="event.id"
        >
          {{ event.title }}
        </option>
      </select>
    </div>

    <!-- Vue Query 状态监控 -->
    <div class="query-monitor">
      <h2>Vue Query 状态监控</h2>
      <div class="monitor-grid">
        <div class="monitor-card">
          <h3>查询缓存状态</h3>
          <div class="cache-stats">
            <div class="stat-row">
              <span>活跃查询数：</span>
              <span class="stat-value">{{ queryCache.getAll().length }}</span>
            </div>
            <div class="stat-row">
              <span>缓存大小：</span>
              <span class="stat-value">{{ formatCacheSize() }}</span>
            </div>
          </div>
        </div>

        <div class="monitor-card">
          <h3>网络状态</h3>
          <div class="network-status">
            <div class="status-indicator" :class="{ online: isOnline, offline: !isOnline }">
              {{ isOnline ? '在线' : '离线' }}
            </div>
            <p class="status-description">
              {{ isOnline ? 'Vue Query 将自动同步数据' : 'Vue Query 使用缓存数据' }}
            </p>
          </div>
        </div>

        <div class="monitor-card">
          <h3>缓存操作</h3>
          <div class="cache-actions">
            <button @click="invalidateAllQueries" class="btn btn--ghost btn--compact">
              清除所有缓存
            </button>
            <button @click="refetchAllQueries" class="btn btn--ghost btn--compact">
              重新获取所有数据
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 队伍数据展示 -->
    <div v-if="selectedEventId" class="data-section">
      <h2>队伍数据管理</h2>
      <TeamsWithVueQuery :event-id="selectedEventId" />
    </div>

    <!-- 作品数据展示 -->
    <div v-if="selectedEventId" class="data-section">
      <h2>作品数据管理</h2>
      <SubmissionsWithVueQuery :event-id="selectedEventId" />
    </div>

    <!-- Vue Query 特性说明 -->
    <div class="features-section">
      <h2>Vue Query 主要特性</h2>
      <div class="features-grid">
        <div class="feature-card">
          <h3>🚀 智能缓存</h3>
          <p>自动缓存查询结果，减少不必要的网络请求，提升用户体验。</p>
          <ul>
            <li>内存缓存 + localStorage 持久化</li>
            <li>可配置的 TTL（生存时间）</li>
            <li>LRU 淘汰策略</li>
          </ul>
        </div>

        <div class="feature-card">
          <h3>🔄 后台更新</h3>
          <p>在后台自动更新过期数据，用户无感知地获取最新内容。</p>
          <ul>
            <li>Stale-while-revalidate 策略</li>
            <li>窗口焦点时自动刷新</li>
            <li>网络重连时自动同步</li>
          </ul>
        </div>

        <div class="feature-card">
          <h3>📱 离线支持</h3>
          <p>网络断开时使用缓存数据，网络恢复时自动同步。</p>
          <ul>
            <li>离线时显示缓存数据</li>
            <li>网络恢复自动重试</li>
            <li>智能错误重试机制</li>
          </ul>
        </div>

        <div class="feature-card">
          <h3>⚡ 性能优化</h3>
          <p>多种优化策略确保应用性能和用户体验。</p>
          <ul>
            <li>请求去重和合并</li>
            <li>并行查询优化</li>
            <li>内存使用监控</li>
          </ul>
        </div>

        <div class="feature-card">
          <h3>🎯 状态管理</h3>
          <p>统一的加载、错误、成功状态管理，简化组件逻辑。</p>
          <ul>
            <li>isLoading, error, data 状态</li>
            <li>isFetching, isStale 细粒度状态</li>
            <li>乐观更新支持</li>
          </ul>
        </div>

        <div class="feature-card">
          <h3>🔧 开发体验</h3>
          <p>优秀的开发者工具和调试支持。</p>
          <ul>
            <li>查询键管理</li>
            <li>缓存失效策略</li>
            <li>TypeScript 完整支持</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- 使用对比 -->
    <div class="comparison-section">
      <h2>使用对比</h2>
      <div class="comparison-grid">
        <div class="comparison-card">
          <h3>传统方式</h3>
          <pre><code>// 传统的数据获取方式
const teams = ref([])
const loading = ref(false)
const error = ref('')

const loadTeams = async () => {
  loading.value = true
  try {
    const { data } = await supabase
      .from('teams')
      .select('*')
    teams.value = data
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

// 需要手动管理缓存、重试、状态等</code></pre>
        </div>

        <div class="comparison-card">
          <h3>Vue Query 方式</h3>
          <pre><code>// 使用 Vue Query
const { 
  data: teams, 
  isLoading, 
  error, 
  refetch 
} = useTeams(eventId)

// 自动处理：
// ✅ 缓存管理
// ✅ 后台更新  
// ✅ 错误重试
// ✅ 加载状态
// ✅ 离线支持</code></pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useAppStore } from '../store/appStore'
import TeamsWithVueQuery from '../components/teams/TeamsWithVueQuery.vue'
import SubmissionsWithVueQuery from '../components/submissions/SubmissionsWithVueQuery.vue'

const store = useAppStore()
const queryClient = useQueryClient()

// 组件状态
const selectedEventId = ref('')

// 计算属性
const isOnline = computed(() => store.isOnline)

// 查询缓存引用
const queryCache = queryClient.getQueryCache()

// 方法
const formatCacheSize = () => {
  const queries = queryCache.getAll()
  const totalSize = queries.reduce((size, query) => {
    const data = query.state.data
    if (data) {
      try {
        return size + JSON.stringify(data).length
      } catch {
        return size
      }
    }
    return size
  }, 0)
  
  if (totalSize < 1024) return `${totalSize} B`
  if (totalSize < 1024 * 1024) return `${(totalSize / 1024).toFixed(1)} KB`
  return `${(totalSize / (1024 * 1024)).toFixed(1)} MB`
}

const invalidateAllQueries = () => {
  queryClient.invalidateQueries()
  store.setBanner('info', '所有缓存已清除')
}

const refetchAllQueries = () => {
  queryClient.refetchQueries()
  store.setBanner('info', '正在重新获取所有数据')
}

// 生命周期
onMounted(async () => {
  // Events are now loaded via Vue Query composables
  // No need to manually load events
  
  // 如果有活动，默认选择第一个
  if (store.publicEvents.length > 0) {
    selectedEventId.value = store.publicEvents[0].id
  }
})
</script>

<style scoped>
.demo-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.demo-header {
  text-align: center;
  margin-bottom: 3rem;
}

.demo-header h1 {
  font-size: var(--text-4xl);
  font-weight: var(--font-bold);
  margin-bottom: 1rem;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.demo-description {
  font-size: var(--text-lg);
  color: var(--muted);
  max-width: 600px;
  margin: 0 auto;
  line-height: var(--leading-relaxed);
}

.event-selector {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: var(--surface);
  border-radius: var(--radius-lg);
}

.query-monitor {
  margin-bottom: 3rem;
}

.query-monitor h2 {
  margin-bottom: 1.5rem;
}

.monitor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.monitor-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  border: 1px solid var(--border);
}

.monitor-card h3 {
  margin-bottom: 1rem;
  font-size: var(--text-lg);
}

.cache-stats {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-value {
  font-weight: var(--font-semibold);
  color: var(--accent);
}

.network-status {
  text-align: center;
}

.status-indicator {
  display: inline-block;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-full);
  font-weight: var(--font-semibold);
  margin-bottom: 0.5rem;
}

.status-indicator.online {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.status-indicator.offline {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.status-description {
  font-size: var(--text-sm);
  color: var(--muted);
  margin: 0;
}

.cache-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.data-section {
  margin-bottom: 3rem;
}

.data-section h2 {
  margin-bottom: 1.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--border);
}

.features-section {
  margin-bottom: 3rem;
}

.features-section h2 {
  text-align: center;
  margin-bottom: 2rem;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.feature-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  border: 1px solid var(--border);
  transition: var(--transition-all);
}

.feature-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.feature-card h3 {
  margin-bottom: 1rem;
  font-size: var(--text-lg);
}

.feature-card p {
  color: var(--muted);
  margin-bottom: 1rem;
  line-height: var(--leading-relaxed);
}

.feature-card ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.feature-card li {
  padding: 0.25rem 0;
  font-size: var(--text-sm);
  color: var(--muted);
}

.feature-card li::before {
  content: '✓';
  color: var(--accent);
  font-weight: var(--font-bold);
  margin-right: 0.5rem;
}

.comparison-section h2 {
  text-align: center;
  margin-bottom: 2rem;
}

.comparison-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 2rem;
}

.comparison-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  border: 1px solid var(--border);
}

.comparison-card h3 {
  margin-bottom: 1rem;
  text-align: center;
}

.comparison-card pre {
  background: var(--surface-muted);
  border-radius: var(--radius-md);
  padding: 1rem;
  overflow-x: auto;
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
}

.comparison-card code {
  color: var(--ink);
}

@media (max-width: 768px) {
  .demo-page {
    padding: 1rem;
  }
  
  .monitor-grid,
  .features-grid {
    grid-template-columns: 1fr;
  }
  
  .comparison-grid {
    grid-template-columns: 1fr;
  }
  
  .comparison-card pre {
    font-size: var(--text-xs);
  }
}
</style>