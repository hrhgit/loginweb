<!--
  作品展示组件 - 使用 Vue Query 版本
  展示如何使用 Vue Query 进行作品数据管理
-->
<template>
  <div class="submissions-container">
    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>正在加载作品数据...</p>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="error-state">
      <p class="error-message">{{ error.message }}</p>
      <button @click="refetch" class="btn btn--primary">重试</button>
    </div>

    <!-- 数据展示 -->
    <div v-else class="submissions-content">
      <!-- 作品统计 -->
      <div class="submissions-stats">
        <div class="stat-item">
          <span class="stat-label">作品总数</span>
          <span class="stat-value">{{ submissions?.length || 0 }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">参与队伍</span>
          <span class="stat-value">{{ uniqueTeamsCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">缓存状态</span>
          <span class="stat-value" :class="{ 'fresh': isFresh, 'stale': !isFresh }">
            {{ isFresh ? '新鲜' : '过期' }}
          </span>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="submissions-actions">
        <button 
          @click="refetch" 
          class="btn btn--ghost"
          :disabled="isFetching"
        >
          {{ isFetching ? '刷新中...' : '刷新数据' }}
        </button>
        
        <div class="view-controls">
          <button 
            @click="viewMode = 'grid'"
            class="btn btn--ghost btn--compact"
            :class="{ 'active': viewMode === 'grid' }"
          >
            网格视图
          </button>
          <button 
            @click="viewMode = 'list'"
            class="btn btn--ghost btn--compact"
            :class="{ 'active': viewMode === 'list' }"
          >
            列表视图
          </button>
        </div>
      </div>

      <!-- 筛选器 -->
      <div class="submissions-filters">
        <div class="filter-group">
          <label class="filter-label">按队伍筛选：</label>
          <select v-model="selectedTeam" class="filter-select">
            <option value="">全部队伍</option>
            <option 
              v-for="team in uniqueTeams" 
              :key="team.id"
              :value="team.id"
            >
              {{ team.name }}
            </option>
          </select>
        </div>
        
        <div class="filter-group">
          <label class="filter-label">按类型筛选：</label>
          <select v-model="selectedType" class="filter-select">
            <option value="">全部类型</option>
            <option value="link">链接提交</option>
            <option value="file">文件提交</option>
          </select>
        </div>
      </div>

      <!-- 作品列表 -->
      <div v-if="!filteredSubmissions.length" class="empty-state">
        <p>暂无作品提交</p>
      </div>
      
      <div v-else class="submissions-list" :class="`view-${viewMode}`">
        <div 
          v-for="submission in filteredSubmissions" 
          :key="submission.id"
          class="submission-card"
        >
          <!-- 作品封面 -->
          <div class="submission-cover">
            <img 
              v-if="submission.cover_path" 
              :src="submission.cover_path" 
              :alt="submission.project_name"
              class="cover-image"
            />
            <div v-else class="cover-placeholder">
              <FileText :size="32" />
            </div>
            
            <!-- 类型标识 -->
            <div class="submission-type">
              <span class="type-badge" :class="`type-${submission.link_mode}`">
                {{ submission.link_mode === 'link' ? '链接' : '文件' }}
              </span>
            </div>
          </div>

          <!-- 作品信息 -->
          <div class="submission-info">
            <div class="submission-header">
              <h3 class="submission-title">{{ submission.project_name }}</h3>
              <div class="submission-meta">
                <span v-if="submission.team" class="team-name">
                  {{ submission.team.name }}
                </span>
                <time class="submission-date">
                  {{ formatDate(submission.created_at) }}
                </time>
              </div>
            </div>

            <p v-if="submission.intro" class="submission-intro">
              {{ submission.intro }}
            </p>

            <!-- 视频链接 -->
            <div v-if="submission.video_link" class="submission-video">
              <a 
                :href="submission.video_link" 
                target="_blank" 
                rel="noopener noreferrer"
                class="video-link"
              >
                <Eye :size="16" />
                观看演示视频
              </a>
            </div>

            <!-- 操作按钮 -->
            <div class="submission-actions">
              <button 
                v-if="submission.submission_url"
                @click="openSubmission(submission)"
                class="btn btn--primary btn--compact"
              >
                <Eye :size="14" />
                查看作品
              </button>
              
              <button 
                v-if="canEditSubmission(submission)"
                @click="editSubmission(submission)"
                class="btn btn--ghost btn--compact"
              >
                <Edit :size="14" />
                编辑
              </button>
              
              <button 
                v-if="canDeleteSubmission(submission)"
                @click="deleteSubmission(submission)"
                class="btn btn--danger btn--compact"
                :disabled="deleteSubmissionMutation.isPending.value"
              >
                <Trash2 :size="14" />
                {{ deleteSubmissionMutation.isPending.value ? '删除中...' : '删除' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 分页（如果需要） -->
      <div v-if="filteredSubmissions.length > pageSize" class="pagination">
        <button 
          @click="currentPage--"
          :disabled="currentPage <= 1"
          class="btn btn--ghost btn--compact"
        >
          上一页
        </button>
        
        <span class="page-info">
          第 {{ currentPage }} 页，共 {{ totalPages }} 页
        </span>
        
        <button 
          @click="currentPage++"
          :disabled="currentPage >= totalPages"
          class="btn btn--ghost btn--compact"
        >
          下一页
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { FileText, Eye, Edit, Trash2 } from 'lucide-vue-next'
import { useSubmissionData, useDeleteSubmission } from '../../composables/useSubmissions'
import { useAppStore } from '../../store/appStore'
import type { SubmissionWithTeam } from '../../store/models'

const props = defineProps<{
  eventId: string
}>()

const store = useAppStore()

// 使用 Vue Query hooks
const { submissions, isLoading, error, refetch } = useSubmissionData(props.eventId)
const deleteSubmissionMutation = useDeleteSubmission()

// 组件状态
const viewMode = ref<'grid' | 'list'>('grid')
const selectedTeam = ref('')
const selectedType = ref('')
const currentPage = ref(1)
const pageSize = 12

// 计算属性
const isFresh = computed(() => {
  return submissions.value?.isFresh ?? false
})

const isFetching = computed(() => {
  return submissions.value?.isFetching ?? false
})

const uniqueTeams = computed(() => {
  const teams = new Map()
  submissions.value?.data?.forEach(submission => {
    if (submission.team) {
      teams.set(submission.team.id, submission.team)
    }
  })
  return Array.from(teams.values())
})

const uniqueTeamsCount = computed(() => {
  return uniqueTeams.value.length
})

const filteredSubmissions = computed(() => {
  let result = submissions.value?.data || []
  
  // 按队伍筛选
  if (selectedTeam.value) {
    result = result.filter(s => s.team?.id === selectedTeam.value)
  }
  
  // 按类型筛选
  if (selectedType.value) {
    result = result.filter(s => s.link_mode === selectedType.value)
  }
  
  // 分页
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  
  return result.slice(start, end)
})

const totalPages = computed(() => {
  const total = submissions.value?.data?.length || 0
  return Math.ceil(total / pageSize)
})

// 辅助函数
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const canEditSubmission = (submission: SubmissionWithTeam) => {
  return store.user?.id === submission.submitted_by || store.isAdmin
}

const canDeleteSubmission = (submission: SubmissionWithTeam) => {
  return store.user?.id === submission.submitted_by || store.isAdmin
}

// 事件处理
const openSubmission = (submission: SubmissionWithTeam) => {
  if (submission.submission_url) {
    window.open(submission.submission_url, '_blank', 'noopener,noreferrer')
  }
}

const editSubmission = (submission: SubmissionWithTeam) => {
  // 实现编辑作品逻辑
  console.log('编辑作品:', submission)
}

const deleteSubmission = async (submission: SubmissionWithTeam) => {
  if (!confirm('确定要删除这个作品吗？此操作不可撤销。')) {
    return
  }

  try {
    await deleteSubmissionMutation.mutateAsync({
      submissionId: submission.id,
      eventId: submission.event_id,
      teamId: submission.team_id,
    })
  } catch (error) {
    // 错误已在 mutation 中处理
  }
}
</script>

<style scoped>
.submissions-container {
  padding: 1rem;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  gap: 1rem;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border);
  border-top: 3px solid var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-state {
  text-align: center;
  padding: 2rem;
}

.error-message {
  color: var(--danger);
  margin-bottom: 1rem;
}

.submissions-stats {
  display: flex;
  gap: 2rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--surface);
  border-radius: var(--radius-lg);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.stat-label {
  font-size: var(--text-sm);
  color: var(--muted);
}

.stat-value {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
}

.stat-value.fresh {
  color: var(--accent);
}

.stat-value.stale {
  color: var(--accent-2);
}

.submissions-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.view-controls {
  display: flex;
  gap: 0.5rem;
}

.view-controls .btn.active {
  background: var(--accent);
  color: white;
}

.submissions-filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--surface);
  border-radius: var(--radius-lg);
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-label {
  font-size: var(--text-sm);
  color: var(--muted);
  white-space: nowrap;
}

.filter-select {
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-strong);
  font-size: var(--text-sm);
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--muted);
}

.submissions-list.view-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.submissions-list.view-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.submission-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--border);
  transition: var(--transition-all);
}

.submission-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.view-list .submission-card {
  display: flex;
  flex-direction: row;
}

.submission-cover {
  position: relative;
  aspect-ratio: 16/9;
  background: var(--surface-muted);
  display: flex;
  align-items: center;
  justify-content: center;
}

.view-list .submission-cover {
  width: 200px;
  flex-shrink: 0;
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  color: var(--muted);
}

.submission-type {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
}

.type-badge {
  font-size: var(--text-xs);
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  font-weight: var(--font-medium);
}

.type-badge.type-link {
  background: var(--accent-soft);
  color: var(--accent);
}

.type-badge.type-file {
  background: rgba(224, 122, 95, 0.1);
  color: var(--accent-2);
}

.submission-info {
  padding: 1.5rem;
  flex: 1;
}

.submission-header {
  margin-bottom: 1rem;
}

.submission-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  margin: 0 0 0.5rem 0;
}

.submission-meta {
  display: flex;
  gap: 1rem;
  font-size: var(--text-sm);
  color: var(--muted);
}

.team-name {
  font-weight: var(--font-medium);
}

.submission-intro {
  color: var(--muted);
  line-height: var(--leading-relaxed);
  margin-bottom: 1rem;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.submission-video {
  margin-bottom: 1rem;
}

.video-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--accent);
  text-decoration: none;
  font-size: var(--text-sm);
  transition: var(--transition-colors);
}

.video-link:hover {
  color: var(--accent-2);
}

.submission-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 2rem;
  padding: 1rem;
}

.page-info {
  font-size: var(--text-sm);
  color: var(--muted);
}

@media (max-width: 640px) {
  .submissions-stats {
    flex-direction: column;
    gap: 1rem;
  }
  
  .submissions-actions {
    flex-direction: column;
    align-items: stretch;
  }
  
  .submissions-filters {
    flex-direction: column;
    gap: 1rem;
  }
  
  .submissions-list.view-grid {
    grid-template-columns: 1fr;
  }
  
  .view-list .submission-card {
    flex-direction: column;
  }
  
  .view-list .submission-cover {
    width: 100%;
  }
}
</style>