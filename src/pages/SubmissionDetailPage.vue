<template>
  <main class="showcase-page">
    <!-- 只有在真正需要加载且没有数据时才显示加载状态 -->
    <div v-if="loading && !submission" class="state-display" role="status" aria-live="polite">
      <Loader2 class="spin" :size="32" aria-hidden="true" />
      <p class="state-text">加载作品详情中...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error && !submission" class="state-display" role="alert" aria-live="assertive">
      <AlertCircle :size="48" class="state-icon error-icon" aria-hidden="true" />
      <h2 class="state-title">加载失败</h2>
      <p class="state-message">{{ error }}</p>
      
      <div class="state-actions">
        <button 
          v-if="!error.includes('权限') && !error.includes('不存在')"
          class="btn btn--primary" 
          @click="() => refetchSubmissions()"
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
          :aria-label="backButtonText"
        >
          <ArrowLeft :size="18" />
          <span>{{ backButtonText }}</span>
        </button>
        
        <div class="breadcrumb">
          <span class="breadcrumb-item">{{ eventTitle }}</span>
          <ChevronRight :size="14" class="breadcrumb-separator" />
          <span class="breadcrumb-item">{{ breadcrumbText }}</span>
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
            class="btn btn--secondary btn--block action-secondary"
          >
            <Video :size="18" />
            观看演示视频
          </a>
        </div>

        <!-- 4. Introduction/Description -->
        <div class="project-description-section">
          <h2 class="section-title">作品简介</h2>
          <div class="project-description">
            <p>{{ submission.intro }}</p>
          </div>
        </div>

        <!-- 5. Download/Action Section -->
        <div class="project-actions-section">
          <h2 class="section-title">作品下载</h2>
          <div class="actions-card">
            <!-- Link Mode -->
            <template v-if="submission.link_mode === 'link'">
              <div v-if="sanitizedSubmissionUrl" class="action-content">
                <a 
                  :href="sanitizedSubmissionUrl" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  class="btn btn--primary btn--large btn--block action-main"
                >
                  <LinkIcon :size="20" />
                  访问作品链接
                </a>
                
                <!-- Password Display -->
                <div v-if="submission.submission_password" class="password-box">
                  <span class="password-label">密码:</span>
                  <code class="password-code">{{ submission.submission_password }}</code>
                  <div class="password-actions">
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
                  v-if="submission.submission_storage_path"
                  class="btn btn--primary btn--large btn--block action-main"
                  @click="handleCustomDownload"
                >
                  <Download :size="20" />
                  下载作品文件
                  <span v-if="submission.submission_storage_path" class="file-ext">
                    {{ getFileExtension(submission.submission_storage_path) }}
                  </span>
                </button>
                
                <!-- 如果没有存储路径，显示错误信息 -->
                <div v-else class="action-error">
                  <AlertCircle :size="16" /> 
                  文件路径无效
                </div>
              </div>
              <div v-else class="action-error">
                <AlertCircle :size="16" /> 文件无效或丢失
              </div>
            </template>
          </div>
        </div>

        <!-- 6. Team Card -->
        <div class="team-card-section">
          <h2 class="section-title">制作团队</h2>
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
  Download,
  Copy,
  Check,
  Users,
  Clock,
  Video
} from 'lucide-vue-next'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/appStore'
import { truncateTeamIntro } from '../utils/textUtils'
import { generateCoverUrl } from '../utils/imageUrlGenerator'

import { useSubmissionData } from '../composables/useSubmissions'
import { useTeamData } from '../composables/useTeams'
import { useEvent } from '../composables/useEvents'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

// Route parameters
const eventId = computed(() => String(route.params.eventId ?? ''))
const submissionId = computed(() => String(route.params.submissionId ?? ''))

const { submissions, isLoading: submissionsLoading, error: submissionsError, refetch: refetchSubmissions } = useSubmissionData(eventId.value)
const { teams } = useTeamData(eventId.value)
const { data: event } = useEvent(eventId.value)

// Computed submission from Vue Query data
const submission = computed(() => {
  const submissionsList = submissions.submissions.value || []
  return submissionsList.find(s => s.id === submissionId.value) || null
})

// Loading and error states from Vue Query
const loading = computed(() => submissionsLoading.value && !submission.value)
const error = computed(() => {
  if (submissionsError.value) {
    return submissionsError.value.message || '加载失败'
  }
  if (!submissionsLoading.value && !submission.value) {
    return '未找到该作品'
  }
  return ''
})

// Enhanced image loading state
const imageLoading = ref(false)
const imageError = ref(false)
const imageRetryCount = ref(0)
const maxRetries = 3
const loadTimeout = ref<number | null>(null)

// Password copy state
const passwordCopied = ref(false)

// Enhanced computed properties
const eventTitle = computed(() => {
  return event.value?.title?.trim() || '活动详情'
})

// 根据来源决定返回按钮的文本和面包屑
const backButtonText = computed(() => {
  const from = route.query.from as string
  return from === 'judge-workspace' ? '返回评委工作台' : '返回列表'
})

const breadcrumbText = computed(() => {
  const from = route.query.from as string
  return from === 'judge-workspace' ? '评委工作台' : '作品展示'
})

// Team Data Computation
const teamDetails = computed(() => {
  if (!submission.value || !submission.value.team_id) return null
  const teamsData = teams.teams.value || []
  return teamsData.find(t => t.id === submission.value?.team_id) || null
})

const teamName = computed(() => {
  return teamDetails.value?.name || submission.value?.team?.name?.trim() || '未知队伍'
})

const teamIntro = computed(() => {
  return truncateTeamIntro(teamDetails.value?.intro) || '暂无队伍简介'
})

const teamMemberCount = computed(() => {
  return teamDetails.value?.members || 1
})

const coverUrl = computed(() => {
  if (!submission.value?.cover_path?.trim()) return null
  return generateCoverUrl(submission.value.cover_path.trim())
})

const formatSubmissionTime = computed(() => {
  if (!submission.value?.created_at) return '未知时间'
  try {
    const date = new Date(submission.value.created_at)
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return '错误'
    }
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return '错误'
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
    // 优先使用数据库中存储的完整URL
    const storedUrl = submission.value.submission_url?.trim()
    if (storedUrl && storedUrl.includes('supabase.co/storage')) {
      return storedUrl
    }
    
    // 使用存储路径生成普通的文件URL
    if (submission.value.submission_storage_path?.trim()) {
      const storagePath = submission.value.submission_storage_path.trim()
      
      const fileUrl = generateDownloadUrl(storagePath)
      
      if (fileUrl) {
        return fileUrl
      }
    }
  }
  
  return null
})

// 生成自定义下载文件名：队伍名-作品名.扩展名
const generateCustomFileName = (): string => {
  if (!submission.value) return 'download.zip'
  
  const projectName = submission.value.project_name || '作品'
  const teamName = teamDetails.value?.name || submission.value.team?.name || '未知队伍'
  
  // 获取原文件扩展名
  let extension = '.zip'
  if (submission.value.submission_storage_path) {
    const pathParts = submission.value.submission_storage_path.split('/')
    const fileName = pathParts[pathParts.length - 1]
    const lastDot = fileName.lastIndexOf('.')
    if (lastDot > 0) {
      extension = fileName.substring(lastDot)
    }
  }
  
  // 清理文件名中的特殊字符
  const cleanTeamName = teamName.replace(/[\/\\:*?"<>|]/g, '-')
  const cleanProjectName = projectName.replace(/[\/\\:*?"<>|]/g, '-')
  
  const customFileName = `${cleanTeamName}-${cleanProjectName}${extension}`
  
  return customFileName
}

// 使用 Supabase 的 createSignedUrl 生成带自定义文件名的下载链接
const generateSignedDownloadUrl = async (storagePath: string, customFileName: string): Promise<string | null> => {
  try {
    // 创建带自定义文件名的签名URL (有效期60秒)
    const { data, error } = await supabase.storage
      .from('submission-files')
      .createSignedUrl(storagePath, 60, {
        download: customFileName  // 👈 关键：指定下载时的中文文件名
      })
    
    if (error) {
      console.error('创建签名URL失败:', error)
      return null
    }
    
    if (data?.signedUrl) {
      return data.signedUrl
    }
    
    return null
  } catch (error) {
    console.error('生成签名下载URL失败:', error)
    return null
  }
}

const generateDownloadUrl = (storagePath: string): string | null => {
  try {
    // 检查路径是否已经是完整URL
    if (storagePath.startsWith('http')) {
      return storagePath
    }
    
    // 生成公共URL
    const { data } = supabase.storage.from('submission-files').getPublicUrl(storagePath)
    
    if (data?.publicUrl) {
      return data.publicUrl
    }
    
    return null
  } catch (error) {
    console.error('生成文件URL失败:', error)
    return null
  }
}

const getFileExtension = (path: string) => {
  if (!path) return ''
  const ext = path.split('.').pop()
  return ext ? `.${ext.toUpperCase()}` : ''
}

const handleBack = () => {
  // 检查来源参数，决定返回到哪里
  const from = route.query.from as string
  
  if (from === 'judge-workspace') {
    // 从评委工作台来的，返回评委工作台
    router.push({
      name: 'judge-workspace',
      params: {
        eventId: eventId.value
      }
    })
  } else {
    // 默认返回作品展示页面
    router.push(`/events/${eventId.value}/showcase`)
  }
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

// 处理自定义文件名下载
const handleCustomDownload = async () => {
  if (!submission.value?.submission_storage_path) {
    store.setBanner('error', '文件路径无效')
    return
  }
  
  const customFileName = generateCustomFileName()
  
  try {
    // 生成带自定义文件名的签名下载URL
    const signedUrl = await generateSignedDownloadUrl(
      submission.value.submission_storage_path, 
      customFileName
    )
    
    if (signedUrl) {
      // 创建临时链接并触发下载
      const link = document.createElement('a')
      link.href = signedUrl
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      store.setBanner('info', '文件下载已开始')
    } else {
      store.setBanner('error', '生成下载链接失败')
    }
  } catch (error) {
    store.setBanner('error', '文件下载失败，请重试')
  }
}

onMounted(() => {
  // Vue Query composables handle data loading automatically
  // No manual initialization needed
})

onUnmounted(() => {
  clearLoadTimeout()
})
</script>

<style scoped>
.showcase-page {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 2rem clamp(16px, 3vw, 40px) 6rem;
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

.section-title {
  font-family: 'Sora', sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--ink);
  margin: 0 0 1.25rem 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.section-title::before {
  content: '';
  display: block;
  width: 4px;
  height: 1.25rem;
  background: var(--accent);
  border-radius: 2px;
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
  aspect-ratio: 16 / 9;
  height: 67vh;
  min-height: 400px;
  max-height: 800px;
  position: relative;
  width: 100%;
  max-width: calc(67vh * 16 / 9);
  margin: 0 auto;
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

/* Responsive Design for Cover */
@media (max-width: 980px) {
  .showcase-cover {
    height: 60vh;
    min-height: 300px;
    max-height: 600px;
    max-width: calc(60vh * 16 / 9);
  }
}

@media (max-width: 640px) {
  .showcase-cover {
    height: 50vh;
    min-height: 250px;
    max-height: 400px;
    max-width: calc(50vh * 16 / 9);
    border-radius: 16px;
  }
}

@media (max-height: 600px) {
  .showcase-cover {
    height: 80vh;
    min-height: 200px;
    max-width: calc(80vh * 16 / 9);
  }
}

/* 当屏幕宽度不足以容纳按高度计算的16:9宽度时，以宽度为准 */
@media (max-width: calc(67vh * 16 / 9)) {
  .showcase-cover {
    width: 90vw;
    max-width: 90vw;
    height: calc(90vw * 9 / 16);
    min-height: auto;
  }
}

@media (max-width: 980px) and (max-width: calc(60vh * 16 / 9)) {
  .showcase-cover {
    width: 90vw;
    max-width: 90vw;
    height: calc(90vw * 9 / 16);
    min-height: auto;
  }
}

@media (max-width: 640px) and (max-width: calc(50vh * 16 / 9)) {
  .showcase-cover {
    width: 90vw;
    max-width: 90vw;
    height: calc(90vw * 9 / 16);
    min-height: auto;
    border-radius: 16px;
  }
}
</style>
