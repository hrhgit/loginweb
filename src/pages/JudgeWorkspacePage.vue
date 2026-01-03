<template>
  <main class="judge-workspace-page">
    <section v-if="loading" class="loading-state">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </section>

    <section v-else-if="error" class="error-state">
      <h2>加载失败</h2>
      <p class="muted">{{ error }}</p>
      <RouterLink class="btn btn--ghost" :to="`/events/${eventId}`">返回活动详情</RouterLink>
    </section>

    <section v-else-if="!canAccess" class="permission-denied">
      <h2>权限不足</h2>
      <p class="muted">您没有权限访问此页面</p>
      <RouterLink class="btn btn--ghost" :to="`/events/${eventId}`">返回活动详情</RouterLink>
    </section>

    <section v-else-if="event">
      <!-- 返回按钮 -->
      <div class="workspace-header">
        <RouterLink :to="`/events/${eventId}`" class="btn btn--ghost btn--icon-text">
          <ArrowLeft :size="18" />
          <span>返回活动</span>
        </RouterLink>
      </div>

      <!-- 评委工作台组件 -->
      <JudgeWorkspace :event-id="eventId" />
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import { useAppStore } from '../store/appStore'
import { useEvent } from '../composables/useEvents'
import { useJudgePermissions } from '../composables/useJudges'
import JudgeWorkspace from '../components/admin/JudgeWorkspace.vue'

const store = useAppStore()
const route = useRoute()
const router = useRouter()

const eventId = computed(() => String(route.params.eventId ?? ''))

// Vue Query hooks
const eventQuery = useEvent(eventId.value)
const judgePermissionsQuery = useJudgePermissions(eventId.value, store.user?.id || '')

// Computed properties
const event = computed(() => eventQuery.data.value)
const loading = computed(() => eventQuery.isLoading.value && !event.value)
const error = computed(() => eventQuery.error.value?.message || '')
const judgePermission = computed(() => judgePermissionsQuery.data.value)
const permissionLoading = computed(() => judgePermissionsQuery.isLoading.value)
const canAccess = computed(() => judgePermission.value?.canAccessJudgeWorkspace ?? false)

onMounted(async () => {
  // Ensure user is loaded first
  await store.refreshUser()
  
  // Vue Query will automatically handle event and permission loading
  // If user doesn't have access, redirect after a short delay
  setTimeout(() => {
    if (!canAccess.value && !permissionLoading.value && judgePermission.value) {
      router.push(`/events/${eventId.value}`)
    }
  }, 2000)
})
</script>

<style scoped>
.judge-workspace-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--bg);
}

.workspace-header {
  padding: 1rem 2rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.loading-state,
.error-state,
.permission-denied {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 4rem 2rem;
  min-height: 60vh;
}

.loading-state h2,
.error-state h2,
.permission-denied h2 {
  font-family: 'Sora', sans-serif;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0;
}

.loading-state p,
.error-state p,
.permission-denied p {
  color: var(--muted);
  margin: 0;
  font-size: 0.875rem;
}

.skeleton-card {
  width: 100%;
  height: 200px;
  background: linear-gradient(90deg, var(--surface) 25%, var(--surface-muted) 50%, var(--surface) 75%);
  background-size: 200% 100%;
  animation: shimmer 2s infinite;
  border-radius: 12px;
  margin: 1rem 0;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .workspace-header {
    padding: 1rem;
  }

  .loading-state,
  .error-state,
  .permission-denied {
    padding: 2rem 1rem;
  }
}
</style>
