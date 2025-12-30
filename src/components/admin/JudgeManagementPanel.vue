<template>
  <div class="judge-management-panel">
    <div class="panel-header">
      <div class="header-info">
        <h3>评委管理</h3>
        <p class="muted">
          共 {{ judges.length }} 位评委
          <span v-if="loading">，加载中...</span>
        </p>
      </div>
      <div class="header-actions">
        <button 
          class="btn btn--primary"
          @click="$emit('invite-judge')"
          :disabled="loading"
          aria-label="邀请新评委"
        >
          <UserPlus :size="18" aria-hidden="true" />
          邀请评委
        </button>
      </div>
    </div>

    <div class="judge-list card">
      <div v-if="loading" class="loading-state" role="status" aria-live="polite">
        <Loader2 class="spin" aria-hidden="true" /> 加载评委列表...
      </div>
      
      <div v-else-if="error" class="error-state" role="alert">
        <AlertCircle :size="48" aria-hidden="true" />
        <div class="error-content">
          <h4>加载失败</h4>
          <p>{{ error }}</p>
          <div class="error-actions">
            <button 
              class="btn btn--ghost" 
              @click="retryLoad"
              aria-label="重新加载评委列表"
            >
              <RefreshCw :size="16" aria-hidden="true" />
              重试 {{ retryCount > 0 ? `(${retryCount}/${maxRetries})` : '' }}
            </button>
          </div>
        </div>
      </div>
      
      <div v-else-if="judges.length === 0" class="empty-state">
        <Users :size="48" aria-hidden="true" />
        <div class="empty-content">
          <h4>暂无评委</h4>
          <p>还没有邀请任何评委参与此活动</p>
          <button 
            class="btn btn--primary" 
            @click="$emit('invite-judge')"
            aria-label="邀请第一位评委"
          >
            <UserPlus :size="16" aria-hidden="true" />
            邀请第一位评委
          </button>
        </div>
      </div>
      
      <div v-else class="judge-list-content">
        <div class="list-header" role="row">
          <span role="columnheader">评委信息</span>
          <span role="columnheader">邀请时间</span>
          <span role="columnheader">操作</span>
        </div>
        
        <div class="list-body" role="table" aria-label="评委列表">
          <div 
            v-for="judge in judges" 
            :key="judge.id" 
            class="judge-item"
            role="row"
          >
            <div class="judge-info" role="cell">
              <div class="judge-avatar" :aria-label="`${judge.profile.username || '未知用户'}的头像`">
                <img 
                  v-if="judge.profile.avatar_url" 
                  :src="judge.profile.avatar_url" 
                  :alt="`${judge.profile.username || '用户'}头像`"
                />
                <User v-else :size="20" aria-hidden="true" />
              </div>
              <div class="judge-details">
                <h4>{{ judge.profile.username || '未知用户' }}</h4>
              </div>
            </div>
            
            <div class="judge-meta" role="cell">
              <span class="invite-time">
                {{ formatDate(judge.created_at) }}
              </span>
            </div>
            
            <div class="judge-actions" role="cell">
              <button 
                class="btn btn--danger btn--compact"
                @click="handleRemoveJudge(judge)"
                @keydown="handleKeydown($event, judge)"
                :disabled="removingJudgeId === judge.user_id"
                :aria-label="`移除评委 ${judge.profile.username || '未知用户'}`"
              >
                <Trash2 v-if="removingJudgeId !== judge.user_id" :size="16" aria-hidden="true" />
                <Loader2 v-else class="spin" :size="16" aria-hidden="true" />
                移除
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { 
  UserPlus, 
  Users, 
  User, 
  Trash2, 
  Loader2, 
  RefreshCw, 
  AlertCircle 
} from 'lucide-vue-next'
import { useAppStore } from '../../store/appStore'
import type { JudgeWithProfile } from '../../store/models'

interface Props {
  eventId: string
}

interface Emits {
  'invite-judge': []
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const store = useAppStore()

const loading = ref(false)
const error = ref('')
const removingJudgeId = ref<string | null>(null)
const retryCount = ref(0)
const maxRetries = 3

// Get judges from store
const judges = computed(() => {
  return store.judgesByEventId[props.eventId] || []
})

const loadJudges = async (isRetry = false) => {
  if (!props.eventId) return
  
  loading.value = true
  if (!isRetry) {
    error.value = ''
    retryCount.value = 0
  }
  
  try {
    await store.loadEventJudges(props.eventId)
    error.value = ''
    retryCount.value = 0
  } catch (err: any) {
    const errorMessage = err.message || '加载评委列表失败'
    error.value = errorMessage
    
    // Auto-retry for network errors
    if (retryCount.value < maxRetries && (
      errorMessage.includes('网络') || 
      errorMessage.includes('连接') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('fetch')
    )) {
      retryCount.value++
      setTimeout(() => {
        loadJudges(true)
      }, 1000 * retryCount.value) // Exponential backoff
    }
  } finally {
    loading.value = false
  }
}

const retryLoad = () => {
  retryCount.value = 0
  loadJudges(false)
}

const handleRemoveJudge = async (judge: JudgeWithProfile) => {
  if (!confirm(`确定要移除评委 "${judge.profile.username || '未知用户'}" 吗？`)) {
    return
  }
  
  removingJudgeId.value = judge.user_id
  
  try {
    const result = await store.removeJudge(props.eventId, judge.user_id)
    
    if (!result.success) {
      store.setBanner('error', result.error || '移除评委失败')
    } else {
      store.setBanner('info', '评委移除成功')
    }
  } catch (err: any) {
    const errorMessage = err.message || '移除评委时发生错误'
    store.setBanner('error', errorMessage)
    
    // For critical operations like removing judges, don't auto-retry
    // Let user manually retry if needed
  } finally {
    removingJudgeId.value = null
  }
}

// Keyboard navigation support
const handleKeydown = (event: KeyboardEvent, judge: JudgeWithProfile) => {
  // Enter or Space to trigger remove action
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    handleRemoveJudge(judge)
  }
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Watch for eventId changes
watch(() => props.eventId, (newEventId) => {
  if (newEventId) {
    loadJudges()
  }
}, { immediate: true })

onMounted(() => {
  if (props.eventId) {
    loadJudges()
  }
})
</script>

<style scoped>
.judge-management-panel {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.header-info h3 {
  margin: 0;
  font-size: 1.25rem;
  font-family: 'Sora', sans-serif;
  color: var(--ink);
}

.header-info p {
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.loading-state,
.error-state,
.empty-state {
  padding: 3rem;
  text-align: center;
  color: var(--muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.error-content h4,
.empty-content h4 {
  margin: 0;
  font-size: 1.25rem;
  color: var(--ink);
}

.error-content p,
.empty-content p {
  margin: 0.5rem 0 1rem;
  color: var(--muted);
}

.error-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.judge-list-content {
  display: flex;
  flex-direction: column;
}

.list-header {
  display: grid;
  grid-template-columns: 2fr 1fr 120px;
  gap: 1rem;
  padding: 1rem;
  background: var(--surface-muted);
  border-bottom: 1px solid var(--border);
  font-weight: 600;
  color: var(--ink);
  font-size: 0.9rem;
  align-items: center;
}

.list-body {
  max-height: 400px;
  overflow-y: auto;
}

.judge-item {
  display: grid;
  grid-template-columns: 2fr 1fr 120px;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid var(--border);
  align-items: center;
  transition: background 0.15s;
}

.judge-item:hover {
  background: var(--surface-muted);
}

.judge-item:last-child {
  border-bottom: none;
}

.judge-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.judge-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.judge-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.judge-details h4 {
  margin: 0;
  font-size: 1rem;
  color: var(--ink);
  font-weight: 600;
}

.judge-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.invite-time {
  font-size: 0.85rem;
  color: var(--muted);
}

.judge-actions {
  display: flex;
  justify-content: flex-end;
}

/* Responsive design */
@media (max-width: 768px) {
  .panel-header {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }

  .header-actions {
    justify-content: center;
  }

  .list-header,
  .judge-item {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .list-header {
    display: none; /* Hide header on mobile */
  }

  .judge-item {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
    border-radius: 12px;
    margin-bottom: 0.75rem;
  }

  .judge-info {
    align-self: stretch;
  }

  .judge-meta {
    align-items: center;
    text-align: center;
  }

  .judge-actions {
    justify-content: center;
  }

  .judge-actions .btn {
    min-height: 44px; /* Better touch target */
    min-width: 120px;
    padding: 12px 20px;
  }

  /* Larger touch targets for mobile */
  .btn {
    min-height: 44px;
  }

  .btn--compact {
    min-height: 40px;
    padding: 10px 16px;
  }
}

/* Tablet adjustments */
@media (max-width: 1024px) and (min-width: 769px) {
  .list-header,
  .judge-item {
    grid-template-columns: 2fr 1fr 140px;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .judge-item {
    border-width: 2px;
  }
  
  .judge-item:hover {
    border-width: 2px;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .judge-item,
  .btn,
  .spin {
    transition: none;
    animation: none;
  }
}
</style>