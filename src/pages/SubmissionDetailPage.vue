<template>
  <main class="showcase-page">
    <!-- Loading State -->
    <div v-if="loading" class="state-display" role="status" aria-live="polite">
      <Loader2 class="spin" :size="32" aria-hidden="true" />
      <p class="state-text">加载作品详情中...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="state-display" role="alert" aria-live="assertive">
      <AlertCircle :size="48" class="state-icon error-icon" aria-hidden="true" />
      <h2 class="state-title">加载失败</h2>
      <p class="state-message">{{ error }}</p>
      
      <div class="state-actions">
        <button 
          v-if="!error.includes('权限') && !error.includes('不存在')"
          class="btn btn--primary" 
          @click="loadSubmissionData"
        >
          重试
        </button>
        <button class="btn btn--ghost" @click="handleBack">
          返回
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <template v-else-if="submission">
      <!-- Navigation Bar -->
      <nav class="showcase-nav">
        <button 
          class="btn btn--ghost btn--icon-text" 
          @click="handleBack"
          aria-label="返回作品列表"
        >
          <ArrowLeft :size="18" />
          <span>返回列表</span>
        </button>
        
        <div class="breadcrumb">
          <span class="breadcrumb-item">{{ eventTitle }}</span>
          <ChevronRight :size="14" class="breadcrumb-separator" />
          <span class="breadcrumb-item active">{{ submission.project_name }}</span>
        </div>
      </nav>

      <div class="showcase-container single-column" id="main-content">
        <!-- 1. Title and Completion Time -->
        <header class="project-header">
          <h1 class="project-title">{{ submission.project_name }}</h1>
          <div class="project-meta">
            <div class="meta-item time">
              <Clock :size="16" />
              <span class="meta-value" :title="formatSubmissionTime">{{ formatSubmissionTime.split(' ')[0] }}</span>
            </div>
          </div>
        </header>

        <!-- 2. Cover Image -->
        <div class="showcase-cover">
          <div v-if="coverUrl" class="cover-image-wrapper">
            <img 
              v-show="!imageError"
              :src="coverUrl" 
              :alt="`${submission.project_name}封面`"
              class="cover-image"
              @load="handleImageLoad"
              @error="handleImageError"
            />
            
            <div v-if="imageLoading && !imageError" class="media-overlay">
              <Loader2 class="spin" :size="24" />
            </div>
            
            <div v-if="imageError" class="media-overlay error-overlay">
              <AlertCircle :size="24" />
              <p>无法加载封面</p>
              <button v-if="imageRetryCount < maxRetries" class="btn btn--tiny" @click="retryImageLoad">重试</button>
            </div>
          </div>
          
          <div v-else class="cover-placeholder">
            <FileText :size="48" />
            <p>暂无封面</p>
          </div>
        </div>

        <!-- 3. Video Link (if available) -->
        <div v-if="sanitizedVideoLink" class="project-video-link">
          <a 
            :href="sanitizedVideoLink" 
            target="_blank" 
            rel="noopener noreferrer"
            class="btn btn--secondary btn--block"
          >
            <Video :size="18" />
            观看演示视频
          </a>
        </div>

        <!-- 4. Introduction/Description -->
        <div class="project-description">
          <p>{{ submission.intro }}</p>
        </div>

        <!-- 5. Download/Action Section -->
        <div class="actions-card">
          <!-- Link Mode -->
          <template v-if="submission.link_mode === 'link'">
            <div v-if="sanitizedSubmissionUrl" class="action-content">
              <a 
                :href="sanitizedSubmissionUrl" 
                target="_blank" 
                rel="noopener noreferrer" 
                class="btn btn--primary btn--large btn--block"
              >
                <LinkIcon :size="20" />
                访问作品链接
              </a>
              
              <!-- Password Display -->
              <div v-if="submission.submission_password" class="password-box">
                <span class="password-label">访问密码:</span>
                <code class="password-code">{{ passwordVisible ? submission.submission_password : '••••••••' }}</code>
                <div class="password-actions">
                  <button class="btn-icon" @click="togglePasswordVisibility" :title="passwordVisible ? '隐藏' : '显示'">
                    <component :is="passwordVisible ? EyeOff : Eye" :size="14" />
                  </button>
                  <button class="btn-icon" @click="copyPassword" title="复制密码">
                    <component :is="passwordCopied ? Check : Copy" :size="14" />
                  </button>
                </div>
              </div>
            </div>
            <div v-else class="action-error">
              <AlertCircle :size="16" /> 链接无效或已被屏蔽
            </div>
          </template>

          <!-- File Mode -->
          <template v-else>
            <div v-if="hasValidSubmissionContent" class="action-content">
              <button 
                v-if="!downloadLoading"
                class="btn btn--primary btn--large btn--block"
                @click="handleSecureDownload"
              >
                <Download :size="20" />
                下载作品文件
                <span v-if="submission.submission_storage_path" class="file-ext">
                  {{ getFileExtension(submission.submission_storage_path) }}
                </span>
              </button>
              
              <!-- Download Progress -->
              <div v-else class="download-status">
                <div class="progress-bar">
                  <div class="progress-fill" :style="{ width: `${downloadProgress}%` }"></div>
                </div>
                <div class="progress-info">
                  <span>{{ downloadProgress }}%</span>
                  <button class="btn-text" @click="cancelDownload">取消</button>
                </div>
                <p v-if="downloadSpeed" class="progress-detail">{{ downloadSpeed }} - 剩余 {{ downloadETA }}</p>
              </div>

              <p v-if="downloadError" class="error-text">{{ downloadError }}</p>
            </div>
            <div v-else class="action-error">
              <AlertCircle :size="16" /> 文件无效或丢失
            </div>
          </template>
        </div>

        <!-- 6. Team Card -->
        <div class="team-card-section">
          <div class="team-card">
            <div class="team-card__header">
              <h3 class="team-card__title team">{{ teamName }}</h3>
              <div class="team-card__members">
                <Users :size="16" />
                <span>{{ teamMemberCount }} 人</span>
              </div>
            </div>
            <p class="team-card__intro">{{ teamIntro }}</p>
          </div>
        </div>

      </div>
    </template>

    <!-- Not Found State -->
    <div v-else class="state-display">
      <FileX :size="48" class="state-icon" />
      <h2 class="state-title">作品不存在</h2>
      <button class="btn btn--primary" @click="handleBack">返回列表</button>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { 
  ArrowLeft, 
  ChevronRight, 
  Loader2, 
  AlertCircle, 
  FileText, 
  FileX,
  Link as LinkIcon, 
  Upload, 
  Download,
  Eye,
  EyeOff,
  Copy,
  Check,
  Users,
  Clock,
  Video
} from 'lucide-vue-next'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/appStore'
import type { SubmissionWithTeam } from '../store/models'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

// Route parameters
const eventId = computed(() => String(route.params.eventId ?? ''))
const submissionId = computed(() => String(route.params.submissionId ?? ''))

// Reactive state
const loading = ref(true)
const error = ref('')
const submission = ref<SubmissionWithTeam | null>(null)

// Enhanced image loading state
const imageLoading = ref(false)
const imageError = ref(false)
const imageRetryCount = ref(0)
const maxRetries = 3
const loadTimeout = ref<number | null>(null)

// Password visibility and copy state
const passwordVisible = ref(false)
const passwordCopied = ref(false)

// Download state with progress tracking
const downloadLoading = ref(false)
const downloadProgress = ref(0)
const downloadSpeed = ref('')
const downloadETA = ref('')
const downloadError = ref('')
const downloadAbortController = ref<AbortController | null>(null)

// Enhanced computed properties
const eventTitle = computed(() => {
  const event = store.displayedEvents.find(e => e.id === eventId.value)
  return event?.title?.trim() || '活动详情'
})

// Team Data Computation
const teamDetails = computed(() => {
  if (!submission.value || !submission.value.team_id) return null
  const teams = store.getTeamsForEvent(eventId.value)
  return teams.find(t => t.id === submission.value?.team_id) || null
})

const teamName = computed(() => {
  return teamDetails.value?.name || submission.value?.team?.name?.trim() || '未知队伍'
})

const teamIntro = computed(() => {
  return teamDetails.value?.intro || '暂无队伍简介'
})

const teamMemberCount = computed(() => {
  return teamDetails.value?.members || 1
})

const coverUrl = computed(() => {
  if (!submission.value?.cover_path?.trim()) return null
  const coverPath = submission.value.cover_path.trim()
  
  if (coverPath.startsWith('http')) {
    imageLoading.value = false
    return coverPath
  }
  
  if (coverPath.includes('/')) {
    const { data } = supabase.storage.from('public-assets').getPublicUrl(coverPath)
    return data?.publicUrl
  }
  return null
})

const formatSubmissionTime = computed(() => {
  if (!submission.value?.created_at) return '未知时间'
  try {
    return new Date(submission.value.created_at).toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return '时间格式错误'
  }
})

const hasValidSubmissionContent = computed(() => {
  if (!submission.value) return false
  if (submission.value.link_mode === 'link') {
    return Boolean(submission.value.submission_url?.trim())
  } else {
    return Boolean(submission.value.submission_url?.trim() || submission.value.submission_storage_path?.trim())
  }
})

const sanitizedVideoLink = computed(() => {
  if (!submission.value?.video_link?.trim()) return null
  try {
    const url = new URL(submission.value.video_link.trim())
    return url.href
  } catch {
    return null
  }
})

const sanitizedSubmissionUrl = computed(() => {
  if (!submission.value) return null
  
  if (submission.value.link_mode === 'link') {
    const url = submission.value.submission_url?.trim()
    if (!url) return null
    try {
      const parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol)) return null
      return url
    } catch {
      return null
    }
  }
  
  if (submission.value.link_mode === 'file') {
    if (submission.value.submission_storage_path?.trim()) {
      return generateSecureFileUrl(submission.value.submission_storage_path.trim())
    }
    const url = submission.value.submission_url?.trim()
    if (url && url.includes('supabase')) return url
  }
  return null
})

const generateSecureFileUrl = (storagePath: string): string | null => {
  try {
    const { data } = supabase.storage.from('submission-files').getPublicUrl(storagePath)
    return data?.publicUrl || null
  } catch {
    return null
  }
}

const getFileExtension = (path: string) => {
  if (!path) return ''
  const ext = path.split('.').pop()
  return ext ? `.${ext.toUpperCase()}` : ''
}

// Data loading
const loadSubmissionData = async () => {
  loading.value = true
  error.value = ''

  try {
    // Load submissions and teams in parallel for better performance
    await Promise.all([
      store.loadSubmissions(eventId.value),
      store.loadTeams(eventId.value)
    ])
    
    const submissions = store.getSubmissionsForEvent(eventId.value)
    const found = submissions.find(s => s.id === submissionId.value)
    
    if (!found) {
      error.value = '未找到该作品'
      return
    }

    submission.value = found
  } catch (err: any) {
    console.error(err)
    error.value = err.message || '加载失败'
  } finally {
    loading.value = false
  }
}

const handleBack = () => {
  router.push(`/events/${eventId.value}/showcase`)
}

// Image handling
const handleImageLoad = () => {
  imageLoading.value = false
  imageError.value = false
  clearLoadTimeout()
}

const handleImageError = () => {
  imageLoading.value = false
  imageError.value = true
  clearLoadTimeout()
  if (imageRetryCount.value < maxRetries) {
    setTimeout(retryImageLoad, 2000)
  }
}

const retryImageLoad = () => {
  if (imageRetryCount.value >= maxRetries) return
  imageRetryCount.value++
  imageLoading.value = true
  imageError.value = false
  
  const img = document.querySelector('.cover-image') as HTMLImageElement
  if (img && coverUrl.value) {
    img.src = `${coverUrl.value}?t=${Date.now()}`
  }
}

const clearLoadTimeout = () => {
  if (loadTimeout.value) {
    clearTimeout(loadTimeout.value)
    loadTimeout.value = null
  }
}

watch(coverUrl, (newUrl) => {
  if (newUrl) {
    imageLoading.value = true
    imageError.value = false
    imageRetryCount.value = 0
    loadTimeout.value = window.setTimeout(() => {
      if (imageLoading.value) handleImageError()
    }, 10000)
  }
}, { immediate: true })

// Password interaction
const togglePasswordVisibility = () => {
  passwordVisible.value = !passwordVisible.value
}

const copyPassword = async () => {
  if (!submission.value?.submission_password) return
  try {
    await navigator.clipboard.writeText(submission.value.submission_password)
    passwordCopied.value = true
    setTimeout(() => passwordCopied.value = false, 2000)
  } catch {
    // Fallback if needed
  }
}

// Download logic
const handleSecureDownload = async () => {
  if (!sanitizedSubmissionUrl.value || downloadLoading.value) return
  
  downloadLoading.value = true
  downloadProgress.value = 0
  downloadError.value = ''
  downloadAbortController.value = new AbortController()
  
  try {
    const filename = submission.value?.submission_storage_path?.split('/').pop() || 'download'
    await downloadFileWithProgress(sanitizedSubmissionUrl.value, filename)
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      downloadError.value = '下载失败'
    }
  } finally {
    downloadLoading.value = false
    downloadAbortController.value = null
  }
}

const cancelDownload = () => {
  downloadAbortController.value?.abort()
}

const downloadFileWithProgress = async (url: string, filename: string) => {
  const startTime = Date.now()
  const response = await fetch(url, { signal: downloadAbortController.value?.signal })
  
  if (!response.ok) throw new Error('Network error')
  
  const reader = response.body?.getReader()
  const totalSize = Number(response.headers.get('content-length')) || 0
  
  if (!reader) throw new Error('Readable stream not supported')
  
  const chunks: Uint8Array[] = []
  let received = 0
  
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    
    chunks.push(value)
    received += value.length
    
    if (totalSize) {
      downloadProgress.value = Math.round((received / totalSize) * 100)
      const elapsed = (Date.now() - startTime) / 1000
      const speed = received / elapsed
      downloadSpeed.value = speed > 1024 * 1024 
        ? `${(speed / 1024 / 1024).toFixed(1)} MB/s` 
        : `${(speed / 1024).toFixed(1)} KB/s`
    }
  }
  
  const blob = new Blob(chunks)
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

onMounted(async () => {
  try {
    await store.ensureEventsLoaded()
    await loadSubmissionData()
  } catch {
    error.value = '初始化失败'
    loading.value = false
  }
})

onUnmounted(() => {
  clearLoadTimeout()
  cancelDownload()
})
</script>

<style scoped>
.showcase-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem 1.5rem 6rem;
  color: var(--ink);
}

/* Nav */
.showcase-nav {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  margin-bottom: 2.5rem;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1rem;
  color: var(--muted);
}

.breadcrumb-separator {
  opacity: 0.5;
}

.breadcrumb-item.active {
  color: var(--ink);
  font-weight: 500;
}

/* Container */
.showcase-container {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

/* Project Header */
.project-header {
  border-bottom: 1px solid var(--border);
  padding-bottom: 2rem;
}

.project-title {
  font-family: 'Sora', sans-serif;
  font-size: 3rem;
  line-height: 1.1;
  margin: 0 0 0.75rem 0;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.project-meta {
  display: flex;
  gap: 2rem;
  color: var(--muted);
  font-size: 1.1rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* Media/Cover */
.showcase-cover {
  border-radius: 24px;
  overflow: hidden;
  background: var(--surface-muted);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-md);
  aspect-ratio: 16/9;
  position: relative;
  width: 100%;
}

.cover-image-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.media-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.8);
  gap: 0.5rem;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  gap: 0.5rem;
}

/* Project Video Link */
.project-video-link {
  width: 100%;
}

/* Description */
.project-description {
  font-size: 1.2rem;
  line-height: 1.8;
  color: var(--ink);
  white-space: pre-wrap;
  max-width: 900px;
}

/* Actions Card */
.actions-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  box-shadow: var(--shadow-sm);
  max-width: 600px;
}

.btn--block {
  width: 100%;
  justify-content: center;
}

.btn--large {
  padding: 1rem 2rem;
  font-size: 1.2rem;
}

/* Team Card */
.team-card-section {
  margin-top: 2rem;
}

.team-card {
  background: var(--surface-muted);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 2rem;
  max-width: 600px;
}

.team-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.team-card__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--ink);
  margin: 0;
}

.team-card__members {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--accent);
  font-size: 1rem;
  font-weight: 600;
}

.team-card__intro {
  color: var(--muted);
  font-size: 1.1rem;
  line-height: 1.6;
  margin: 0;
}

/* Password Box */
.password-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--surface-muted);
  padding: 0.75rem 1rem;
  border-radius: 8px;
  margin-top: 0.75rem;
  border: 1px dashed var(--border);
}

.password-label {
  font-size: 0.85rem;
  color: var(--muted);
  font-weight: 500;
}

.password-code {
  font-family: monospace;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--ink);
  letter-spacing: 1px;
}

.password-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: var(--muted);
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: var(--surface);
  color: var(--accent);
}

/* Download Progress */
.download-status {
  margin-top: 1rem;
  background: var(--surface-muted);
  padding: 1rem;
  border-radius: 8px;
}

.progress-bar {
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.3s ease;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  font-weight: 500;
}

.progress-detail {
  font-size: 0.8rem;
  color: var(--muted);
  margin-top: 0.25rem;
  text-align: right;
}

.btn-text {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-text:hover {
  text-decoration: underline;
  color: var(--danger);
}

.file-ext {
  opacity: 0.7;
  font-size: 0.8em;
  margin-left: 0.25rem;
}

/* States */
.state-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 1rem;
  color: var(--muted);
}

.state-title {
  font-size: 1.5rem;
  color: var(--ink);
  margin: 0;
}

.state-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>