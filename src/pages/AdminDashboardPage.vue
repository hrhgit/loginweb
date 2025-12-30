<template>
  <main class="admin-dashboard-page">
    <section class="page-head">
      <div class="head-row">
        <div class="head-content">
          <h1>系统信息</h1>
          <p class="muted">查看基本系统状态</p>
        </div>
      </div>
    </section>

    <div class="info-grid">
      <!-- 网络状态 -->
      <div class="info-card">
        <div class="card-header">
          <h3>网络状态</h3>
          <Wifi v-if="store.isOnline" :size="24" class="icon--success" />
          <WifiOff v-else :size="24" class="icon--error" />
        </div>
        <div class="card-content">
          <p class="status-value">{{ store.isOnline ? '在线' : '离线' }}</p>
          <p class="status-detail">{{ connectionQualityText }}</p>
        </div>
      </div>

      <!-- 浏览器信息 -->
      <div class="info-card">
        <div class="card-header">
          <h3>浏览器</h3>
          <Monitor :size="24" />
        </div>
        <div class="card-content">
          <p class="info-row"><span>语言:</span> {{ browserInfo.language }}</p>
          <p class="info-row"><span>时区:</span> {{ browserInfo.timezone }}</p>
        </div>
      </div>

      <!-- 屏幕信息 -->
      <div class="info-card">
        <div class="card-header">
          <h3>屏幕</h3>
          <Smartphone :size="24" />
        </div>
        <div class="card-content">
          <p class="info-row"><span>分辨率:</span> {{ browserInfo.screenWidth }}x{{ browserInfo.screenHeight }}</p>
          <p class="info-row"><span>像素比:</span> {{ browserInfo.devicePixelRatio }}</p>
        </div>
      </div>

      <!-- 存储支持 -->
      <div class="info-card">
        <div class="card-header">
          <h3>存储</h3>
          <Database :size="24" />
        </div>
        <div class="card-content">
          <p class="info-row"><span>LocalStorage:</span> {{ browserInfo.storageSupport.local ? '✓' : '✗' }}</p>
          <p class="info-row"><span>IndexedDB:</span> {{ browserInfo.storageSupport.indexedDB ? '✓' : '✗' }}</p>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { Wifi, WifiOff, Monitor, Smartphone, Database } from 'lucide-vue-next'
import { useAppStore } from '../store/appStore'

const store = useAppStore()

// 使用 ref 来存储浏览器信息，避免 SSR 问题
const browserInfo = ref({
  language: '',
  timezone: '',
  screenWidth: 0,
  screenHeight: 0,
  devicePixelRatio: 1,
  storageSupport: {
    local: false,
    indexedDB: false
  }
})

const connectionQualityText = computed(() => {
  if (!store.isOnline) return '连接中断'
  return store.connectionQuality === 'fast' ? '连接良好' : '连接较慢'
})

onMounted(() => {
  // 在客户端挂载后获取浏览器信息
  browserInfo.value = {
    language: navigator.language || '未知',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '未知',
    screenWidth: screen.width || 0,
    screenHeight: screen.height || 0,
    devicePixelRatio: window.devicePixelRatio || 1,
    storageSupport: {
      local: (() => {
        try {
          localStorage.setItem('__test__', '1')
          localStorage.removeItem('__test__')
          return true
        } catch { return false }
      })(),
      indexedDB: 'indexedDB' in window
    }
  }
})
</script>

<style scoped>
.admin-dashboard-page {
  padding: 2rem 1rem 4rem;
  max-width: 1200px;
  margin: 0 auto;
}

.page-head {
  margin-bottom: 3rem;
}

.head-row {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.head-content h1 {
  margin: 0;
  font-size: 2rem;
  font-family: 'Sora', sans-serif;
}

.head-content p {
  margin: 0.5rem 0 0;
  font-size: 1rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2rem;
}

.info-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 2rem;
  min-height: 140px;
}

.card-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.5rem;
  color: var(--muted);
}

.card-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  flex: 1;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.status-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0;
}

.status-detail {
  font-size: 0.9rem;
  color: var(--muted);
  margin: 0;
}

.info-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.95rem;
  margin: 0;
  padding: 0.25rem 0;
}

.info-row span:first-child {
  color: var(--muted);
  font-weight: 500;
}

.info-row span:last-child {
  font-weight: 600;
  color: var(--ink);
}

.icon--success { color: #22c55e; }
.icon--error { color: var(--danger); }

@media (max-width: 1024px) {
  .info-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
  }
  
  .info-card {
    padding: 1.5rem;
  }
}

@media (max-width: 640px) {
  .admin-dashboard-page {
    padding: 1.5rem 1rem 3rem;
  }
  
  .info-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  .info-card {
    padding: 1.25rem;
  }
  
  .head-content h1 {
    font-size: 1.75rem;
  }
}
</style>