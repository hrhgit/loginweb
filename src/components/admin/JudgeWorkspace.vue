<template>
  <div class="judge-workspace">
    <!-- 工作台头部 -->
    <section class="workspace-header">
      <div class="header-content">
        <h2 class="workspace-title">评委工作台</h2>
        <p class="workspace-subtitle">{{ event?.title }}</p>
      </div>
      <div class="header-actions">
        <button 
          v-if="displayedSubmissions.length > 0"
          class="btn btn--primary"
          :disabled="selectedSubmissions.length === 0 || downloadProcessing"
          @click="downloadSelectedSubmissions"
        >
          <Download v-if="!downloadProcessing" :size="18" />
          <Loader2 v-else :size="18" class="spinner" />
          {{ downloadProcessing ? '下载中...' : `批量下载 (${selectedSubmissions.length})` }}
        </button>
      </div>
    </section>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <Loader2 class="spinner" :size="32" />
      <p>加载作品中...</p>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="error-state">
      <AlertCircle :size="32" />
      <p>{{ error }}</p>
      <button class="btn btn--primary" @click="loadSubmissions">重试</button>
    </div>

    <!-- 空状态 -->
    <div v-else-if="displayedSubmissions.length === 0" class="empty-state">
      <FileText :size="48" />
      <h3>暂无作品</h3>
      <p>该活动还没有提交的作品</p>
    </div>

    <!-- 作品列表 -->
    <div v-else class="submissions-container">
      <!-- 工具栏 -->
      <div class="toolbar">
        <div class="toolbar-left">
          <label class="checkbox-label">
            <input 
              type="checkbox"
              :checked="isAllSelected"
              :indeterminate="isIndeterminate"
              @change="toggleSelectAll"
            />
            <span>全选 ({{ selectedSubmissions.length }}/{{ displayedSubmissions.length }})</span>
          </label>
        </div>
        <div class="toolbar-right">
          <span class="selection-info">
            已选择 {{ selectedSubmissions.length }} 个作品
          </span>
        </div>
      </div>

      <!-- 作品网格 -->
      <div class="submissions-grid">
        <div 
          v-for="submission in displayedSubmissions"
          :key="submission.id"
          class="submission-item"
        >
          <label class="submission-checkbox">
            <input 
              type="checkbox"
              :checked="selectedSubmissions.includes(submission.id)"
              @change="toggleSubmissionSelection(submission.id)"
            />
          </label>
          <SubmissionCard 
            :submission="submission"
            @click="handleSubmissionClick(submission)"
            @double-click="handleSubmissionDoubleClick(submission)"
            @title-click="handleSubmissionTitleClick(submission)"
          />
        </div>
      </div>

      <!-- 下载进度 -->
      <div v-if="downloadProcessing && downloadProgress" class="download-progress">
        <div class="progress-header">
          <h4>下载进度</h4>
          <button 
            class="btn btn--ghost btn--icon"
            @click="cancelDownload"
            title="取消下载"
          >
            <X :size="18" />
          </button>
        </div>
        <div class="progress-bar">
          <div 
            class="progress-fill"
            :style="{ width: `${downloadProgressPercentage}%` }"
          ></div>
        </div>
        <p class="progress-text">
          {{ downloadProgress.currentOperation }}
        </p>
        <div v-if="downloadProgress.errors.length > 0" class="progress-errors">
          <p class="error-title">错误信息:</p>
          <ul>
            <li v-for="(error, index) in downloadProgress.errors" :key="index">
              {{ error }}
            </li>
          </ul>
        </div>
      </div>

      <!-- 下载完成摘要 -->
      <div v-if="downloadSummary && showDownloadSummary" class="download-summary">
        <div class="summary-header">
          <CheckCircle v-if="downloadSummary.failed === 0" :size="24" class="success-icon" />
          <AlertCircle v-else :size="24" class="warning-icon" />
          <h4>下载完成</h4>
        </div>
        <div class="summary-content">
          <p>成功: {{ downloadSummary.successful }} / {{ downloadSummary.total }}</p>
          <p v-if="downloadSummary.failed > 0" class="error-text">
            失败: {{ downloadSummary.failed }}
          </p>
          <p class="duration-text">
            耗时: {{ formatDuration(downloadSummary.duration) }}
          </p>
        </div>
        <button 
          class="btn btn--ghost"
          @click="showDownloadSummary = false"
        >
          关闭
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Download, Loader2, AlertCircle, FileText, CheckCircle, X } from 'lucide-vue-next'
import { useAppStore } from '../../store/appStore'
import { useEvent } from '../../composables/useEvents'
import { useSubmissionData } from '../../composables/useSubmissions'
import SubmissionCard from '../showcase/SubmissionCard.vue'
import { 
  downloadSubmissionsBatch,
  validateFileSelection,
  generateDownloadSummary,
  type BatchDownloadSummary
} from '../../utils/downloadUtils'
import type { ExportProgress } from '../../utils/exportUtils'
import type { SubmissionWithTeam } from '../../store/models'

interface Props {
  eventId: string
}

const props = defineProps<Props>()

const store = useAppStore()

// Vue Query hooks
const eventQuery = useEvent(props.eventId)
const submissionsQuery = useSubmissionData(props.eventId)

// State
const downloadProcessing = ref(false)
const downloadProgress = ref<ExportProgress | null>(null)
const downloadSummary = ref<BatchDownloadSummary | null>(null)
const showDownloadSummary = ref(false)
const selectedSubmissions = ref<string[]>([])

// Computed properties
const event = computed(() => eventQuery.data.value)
const displayedSubmissions = computed(() => submissionsQuery.submissions.data.value || [])
const loading = computed(() => submissionsQuery.submissions.isLoading.value)
const error = computed(() => submissionsQuery.submissions.error.value?.message || '')

const isAllSelected = computed(() => {
  return displayedSubmissions.value.length > 0 && 
         displayedSubmissions.value.every(s => selectedSubmissions.value.includes(s.id))
})

const isIndeterminate = computed(() => {
  const selected = selectedSubmissions.value.length
  return selected > 0 && selected < displayedSubmissions.value.length
})

const downloadProgressPercentage = computed(() => {
  if (!downloadProgress.value || downloadProgress.value.total === 0) return 0
  return Math.round((downloadProgress.value.current / downloadProgress.value.total) * 100)
})

// Methods
const loadSubmissions = async () => {
  if (!props.eventId) return
  
  try {
    await submissionsQuery.submissions.refetch()
  } catch (err: any) {
    store.setBanner('error', err.message || '加载作品失败')
  }
}

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedSubmissions.value = []
  } else {
    selectedSubmissions.value = displayedSubmissions.value.map(s => s.id)
  }
}

const toggleSubmissionSelection = (submissionId: string) => {
  if (selectedSubmissions.value.includes(submissionId)) {
    selectedSubmissions.value = selectedSubmissions.value.filter(id => id !== submissionId)
  } else {
    selectedSubmissions.value = [...selectedSubmissions.value, submissionId]
  }
}

const handleSubmissionClick = (submission: SubmissionWithTeam) => {
  // Reserved for future functionality
}

const handleSubmissionDoubleClick = (submission: SubmissionWithTeam) => {
  // Navigate to submission detail view on double-click
  // This would be implemented when submission detail view is available
}

const handleSubmissionTitleClick = (submission: SubmissionWithTeam) => {
  // Navigate to submission detail view on title click
  // This would be implemented when submission detail view is available
}

const downloadSelectedSubmissions = async () => {
  // Validate selection
  const validation = validateFileSelection(selectedSubmissions.value.length)
  if (!validation.valid) {
    store.setBanner('error', validation.message || '选择验证失败')
    return
  }

  if (validation.warning) {
    store.setBanner('info', validation.warning)
  }

  downloadProcessing.value = true
  downloadProgress.value = null
  downloadSummary.value = null
  showDownloadSummary.value = false

  try {
    // Get selected submissions
    const selectedSubmissionData = displayedSubmissions.value.filter(s =>
      selectedSubmissions.value.includes(s.id)
    )

    // Progress callback
    const onProgress = (progress: ExportProgress) => {
      downloadProgress.value = progress
    }

    // Execute batch download
    const summary = await downloadSubmissionsBatch(
      selectedSubmissionData,
      onProgress,
      {
        batchSize: 1,
        delayBetweenBatches: 500,
        maxRetries: 3,
        retryDelay: 1000
      }
    )

    // Store summary for display
    downloadSummary.value = summary
    showDownloadSummary.value = true

    // Show appropriate banner
    if (summary.failed === 0) {
      store.setBanner('info', generateDownloadSummary(summary))
    } else {
      store.setBanner('error', generateDownloadSummary(summary))
    }

    // Clear selection after successful download
    if (summary.failed === 0) {
      selectedSubmissions.value = []
    }
  } catch (err: any) {
    console.error('Batch download error:', err)
    store.setBanner('error', '批量下载失败: ' + (err.message || '未知错误'))
  } finally {
    downloadProcessing.value = false
  }
}

const cancelDownload = () => {
  downloadProcessing.value = false
  downloadProgress.value = null
  store.setBanner('info', '下载已取消')
}

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  
  if (minutes > 0) {
    return `${minutes}分${seconds % 60}秒`
  }
  return `${seconds}秒`
}

// Lifecycle
onMounted(() => {
  // Vue Query will automatically load data when component mounts
  // No need to manually call loadSubmissions
})
</script>

<style scoped>
.judge-workspace {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding: 2rem;
  background: var(--bg);
  min-height: 100vh;
}

/* 工作台头部 */
.workspace-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
}

.header-content {
  flex: 1;
}

.workspace-title {
  font-family: 'Sora', sans-serif;
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0 0 0.5rem 0;
}

.workspace-subtitle {
  font-size: 0.875rem;
  color: var(--muted);
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 1rem;
}

/* 加载状态 */
.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 4rem 2rem;
  background: var(--surface);
  border-radius: 16px;
  border: 1px solid var(--border);
  min-height: 300px;
}

.loading-state p,
.error-state p,
.empty-state p {
  color: var(--muted);
  margin: 0;
  font-size: 0.875rem;
}

.empty-state h3 {
  font-family: 'Sora', sans-serif;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0;
}

.spinner {
  animation: spin 1s linear infinite;
  color: var(--accent);
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 作品容器 */
.submissions-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* 工具栏 */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background: var(--surface);
  border-radius: 12px;
  border: 1px solid var(--border);
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--ink);
  user-select: none;
}

.checkbox-label input[type="checkbox"] {
  cursor: pointer;
  width: 18px;
  height: 18px;
  accent-color: var(--accent);
}

.selection-info {
  font-size: 0.875rem;
  color: var(--muted);
}

/* 作品网格 */
.submissions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.submission-item {
  position: relative;
}

.submission-checkbox {
  position: absolute;
  top: 1rem;
  left: 1rem;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--surface-strong);
  border: 2px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.submission-checkbox input[type="checkbox"] {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  width: 100%;
  height: 100%;
}

.submission-checkbox input[type="checkbox"]:checked + .submission-checkbox,
.submission-checkbox:has(input[type="checkbox"]:checked) {
  background: var(--accent);
  border-color: var(--accent);
}

.submission-checkbox::after {
  content: '✓';
  color: white;
  font-weight: bold;
  font-size: 0.875rem;
  opacity: 0;
  transition: opacity 0.18s ease;
}

.submission-checkbox input[type="checkbox"]:checked ~ .submission-checkbox::after,
.submission-checkbox:has(input[type="checkbox"]:checked)::after {
  opacity: 1;
}

/* 下载进度 */
.download-progress {
  padding: 1.5rem;
  background: var(--surface);
  border-radius: 12px;
  border: 1px solid var(--border);
}

.progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.progress-header h4 {
  font-family: 'Sora', sans-serif;
  font-size: 1rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: var(--surface-muted);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.875rem;
  color: var(--muted);
  margin: 0 0 1rem 0;
}

.progress-errors {
  margin-top: 1rem;
  padding: 1rem;
  background: rgba(182, 45, 28, 0.1);
  border-radius: 8px;
  border-left: 3px solid var(--danger);
}

.error-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--danger);
  margin: 0 0 0.5rem 0;
}

.progress-errors ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.progress-errors li {
  font-size: 0.75rem;
  color: var(--danger);
  margin: 0.25rem 0;
}

/* 下载完成摘要 */
.download-summary {
  padding: 1.5rem;
  background: var(--surface);
  border-radius: 12px;
  border: 1px solid var(--border);
}

.summary-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.summary-header h4 {
  font-family: 'Sora', sans-serif;
  font-size: 1rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0;
}

.success-icon {
  color: #22c55e;
}

.warning-icon {
  color: var(--danger);
}

.summary-content {
  margin-bottom: 1rem;
}

.summary-content p {
  font-size: 0.875rem;
  color: var(--muted);
  margin: 0.5rem 0;
}

.error-text {
  color: var(--danger);
}

.duration-text {
  font-weight: 500;
  color: var(--ink);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .judge-workspace {
    padding: 1rem;
    gap: 1.5rem;
  }

  .workspace-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions .btn {
    width: 100%;
  }

  .submissions-grid {
    grid-template-columns: 1fr;
  }

  .toolbar {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .toolbar-left,
  .toolbar-right {
    width: 100%;
  }
}

/* 无障碍支持 */
@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }

  .progress-fill,
  .submission-checkbox,
  .submission-checkbox::after {
    transition: none;
  }
}
</style>
