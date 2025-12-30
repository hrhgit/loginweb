<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Download, FileText, Loader2, CheckCircle, AlertCircle, User } from 'lucide-vue-next'
import { useAppStore } from '../store/appStore'
import { supabase } from '../lib/supabase'
import { getEventDetailsFromDescription } from '../utils/eventDetails'
import EnhancedDataTable from '../components/admin/EnhancedDataTable.vue'
import TableEnhancements from '../components/admin/TableEnhancements.vue'
import { 
  convertToFlattenedRegistrations,
  generateExportFilename,
  type RegistrationData,
  type ExportProgress
} from '../utils/exportUtils'
import { 
  exportRegistrationsToExcel,
  generateExportPreview,
  type ExportPreview
} from '../utils/excelUtils'
import {
  downloadSubmissionsBatch,
  validateFileSelection,
  generateDownloadSummary,
  BATCH_DOWNLOAD_LIMITS,
  paginateFiles,
  SelectionManager,
  estimateDownloadTime,
  type BatchDownloadSummary,
  type PaginationOptions
} from '../utils/downloadUtils'
import { generateFormResponseTable } from '../utils/formResponseParser'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const eventId = computed(() => String(route.params.id ?? ''))
const event = computed(() => store.getEventById(eventId.value))

const loading = ref(false)
const registrations = ref<RegistrationData[]>([])
const submissions = ref<any[]>([])
const processing = ref(false)
const progressPercentage = ref(0)
const statusMessage = ref('')

// Enhanced download state
const downloadProgress = ref<ExportProgress | null>(null)
const downloadSummary = ref<BatchDownloadSummary | null>(null)
const showDownloadSummary = ref(false)

// Registration export preview state
const exportPreview = ref<ExportPreview | null>(null)
const showPreview = ref(false)
const previewLoading = ref(false)

// Pagination and selection management
const currentPage = ref(1)
const pageSize = ref(50) // 50 files per page as per requirements
const selectionManager = new SelectionManager(BATCH_DOWNLOAD_LIMITS.maxSelectionCount)
const selectedSubmissions = ref<string[]>([])

// Batch download control state
const downloadPaused = ref(false)
const canPauseResume = ref(false)
const downloadController = ref<AbortController | null>(null)

// Event questions for form parsing
const eventQuestions = computed(() => {
  if (!event.value?.description) return []
  const details = getEventDetailsFromDescription(event.value.description)
  return details.registrationForm.questions
})

// Form response table data
const formResponseTable = computed(() => {
  if (registrations.value.length === 0) {
    return {
      columns: [],
      rows: [],
      hasFormData: false
    }
  }
  
  return generateFormResponseTable(registrations.value, eventQuestions.value)
})

// Enhanced table columns with sorting
const enhancedTableColumns = computed(() => {
  return formResponseTable.value.columns.map(col => ({
    ...col,
    sortable: true,
    required: col.isStandard ? false : eventQuestions.value.find(q => q.id === col.key)?.required || false
  }))
})

// Table enhancement data
const tableEnhancementData = computed(() => {
  const completedRegistrations = registrations.value.filter(reg => {
    const formQuestionKeys = formResponseTable.value.columns
      .filter(col => !col.isStandard)
      .map(col => col.key)
    return formQuestionKeys.some(key => reg.form_response?.[key])
  }).length

  const averageResponseFields = registrations.value.length > 0
    ? registrations.value.reduce((sum, reg) => {
        return sum + (reg.form_response ? Object.keys(reg.form_response).length : 0)
      }, 0) / registrations.value.length
    : 0

  const registrationTimes = registrations.value.map(reg => reg.created_at)

  return {
    totalRegistrations: registrations.value.length,
    completedRegistrations,
    averageResponseFields,
    registrationTimes
  }
})

// Pagination computed properties
const paginatedSubmissions = computed(() => {
  const paginationOptions: PaginationOptions = {
    page: currentPage.value,
    pageSize: pageSize.value,
    total: submissions.value.length
  }
  
  return paginateFiles(submissions.value, paginationOptions)
})

const totalPages = computed(() => paginatedSubmissions.value.totalPages)
const hasNextPage = computed(() => paginatedSubmissions.value.hasNext)
const hasPreviousPage = computed(() => paginatedSubmissions.value.hasPrevious)

// Selection computed properties
const currentPageSubmissionIds = computed(() => 
  paginatedSubmissions.value.items.map(s => s.id)
)

const isAllCurrentPageSelected = computed(() => {
  const currentPageIds = currentPageSubmissionIds.value
  return currentPageIds.length > 0 && 
         currentPageIds.every(id => selectedSubmissions.value.includes(id))
})

const isCurrentPageIndeterminate = computed(() => {
  const currentPageIds = currentPageSubmissionIds.value
  const selectedOnPage = currentPageIds.filter(id => selectedSubmissions.value.includes(id))
  return selectedOnPage.length > 0 && selectedOnPage.length < currentPageIds.length
})

// Selection validation
const selectionValidation = computed(() => {
  return validateFileSelection(selectedSubmissions.value.length)
})

const canSelectMore = computed(() => {
  return selectedSubmissions.value.length < limits.maxSelectionCount
})

// Download estimation
const estimatedDownloadTime = computed(() => {
  if (selectedSubmissions.value.length === 0) return 0
  return estimateDownloadTime(selectedSubmissions.value.length)
})

const activeTab = ref<'forms' | 'files'>('forms')

const loadData = async () => {
  if (!eventId.value) return
  loading.value = true
  
  try {
    await store.ensureEventsLoaded()
    
    // Check if event exists and user has permission
    const currentEvent = event.value
    
    if (!currentEvent) {
      // Try to fetch the event directly if not found in displayedEvents
      const { data: fetchedEvent, error: fetchError } = await store.fetchEventById(eventId.value)
      
      if (fetchError || !fetchedEvent) {
        console.error('EventAdminPage - Event not found or error:', fetchError)
        store.setBanner('error', `活动不存在或您没有访问权限: ${fetchError || '未知错误'}`)
        router.replace('/events/mine')
        return
      }
      // Check if user is the creator or admin
      if (fetchedEvent.created_by !== store.user?.id && !store.isAdmin) {
        console.error('EventAdminPage - Permission denied for fetched event')
        store.setBanner('error', '您没有管理此活动的权限')
        router.replace('/events/mine')
        return
      }
    } else {
      // Check permissions for existing event
      if (currentEvent.created_by !== store.user?.id && !store.isAdmin) {
        console.error('EventAdminPage - Permission denied for existing event')
        store.setBanner('error', '您没有管理此活动的权限')
        router.replace('/events/mine')
        return
      }
    }
    
    // Load registrations with profile data
    const { data: regData, error: regError } = await supabase
      .from('registrations')
      .select('*, profiles(username, avatar_url)')
      .eq('event_id', eventId.value)
    
    if (regError) throw regError
    
    // Transform to RegistrationData format
    const transformedRegistrations: RegistrationData[] = (regData || []).map(reg => ({
      id: reg.id,
      user_id: reg.user_id,
      event_id: reg.event_id,
      form_response: reg.form_response || {},
      status: reg.status || 'registered',
      created_at: reg.created_at,
      profile: {
        username: reg.profiles?.username || null
      }
    }))
    
    registrations.value = transformedRegistrations
    
    // Generate export preview
    if (transformedRegistrations.length > 0) {
      generateRegistrationPreview()
    }

    // Load submissions with team info
    const { data: subData, error: subError } = await supabase
      .from('submissions')
      .select('*, teams(name)')
      .eq('event_id', eventId.value)
      .eq('link_mode', 'file') // Only interested in file submissions for batch download
      .order('created_at', { ascending: true })
      
    if (subError) throw subError
    submissions.value = subData || []
    
  } catch (err: any) {
    console.error('Error loading admin data:', err)
    store.setBanner('error', '加载管理数据失败: ' + err.message)
  } finally {
    loading.value = false
  }
}

const toggleSelectCurrentPage = () => {
  const currentPageIds = currentPageSubmissionIds.value
  
  if (isAllCurrentPageSelected.value) {
    // Deselect all on current page
    selectedSubmissions.value = selectedSubmissions.value.filter(id => !currentPageIds.includes(id))
    currentPageIds.forEach(id => selectionManager.toggle(id))
  } else {
    // Select all on current page (up to remaining capacity)
    const remainingCapacity = selectionManager.getRemainingCapacity()
    const toSelect = currentPageIds.filter(id => !selectedSubmissions.value.includes(id))
    const canSelect = toSelect.slice(0, remainingCapacity)
    
    selectedSubmissions.value = [...selectedSubmissions.value, ...canSelect]
    canSelect.forEach(id => selectionManager.toggle(id))
  }
}

const toggleSubmissionSelection = (submissionId: string) => {
  const wasSelected = selectionManager.toggle(submissionId)
  
  if (wasSelected) {
    selectedSubmissions.value = [...selectedSubmissions.value, submissionId]
  } else {
    selectedSubmissions.value = selectedSubmissions.value.filter(id => id !== submissionId)
  }
}

// Pagination methods
const goToPage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

const nextPage = () => {
  if (hasNextPage.value) {
    currentPage.value++
  }
}

const previousPage = () => {
  if (hasPreviousPage.value) {
    currentPage.value--
  }
}

const generateRegistrationPreview = () => {
  if (registrations.value.length === 0) {
    exportPreview.value = null
    return
  }
  
  previewLoading.value = true
  
  try {
    // Convert to flattened format for preview
    const flattenedData = convertToFlattenedRegistrations(registrations.value)
    
    // Generate preview with limited sample size
    const preview = generateExportPreview(flattenedData, 5)
    exportPreview.value = preview
  } catch (error) {
    console.error('Failed to generate preview:', error)
    store.setBanner('error', '生成预览失败')
  } finally {
    previewLoading.value = false
  }
}

const downloadForms = () => {
  if (!registrations.value.length) {
    store.setBanner('info', '暂无报名数据')
    return
  }

  try {
    // Convert to flattened format
    const flattenedData = convertToFlattenedRegistrations(registrations.value)
    
    // Generate filename using utility function
    const filename = generateExportFilename(event.value?.title || '活动', 'registration')
    
    // Export using enhanced Excel utility
    exportRegistrationsToExcel(flattenedData, filename, {
      sheetName: '报名数据',
      autoWidth: true
    })
    
    store.setBanner('info', '报名表导出成功')
  } catch (err: any) {
    console.error('Export error:', err)
    store.setBanner('error', '导出失败: ' + err.message)
  }
}

const downloadFiles = async () => {
  // Validate selection
  const validation = selectionValidation.value
  if (!validation.valid) {
    store.setBanner('error', validation.message || '选择验证失败')
    return
  }
  
  // Show warning if needed
  if (validation.warning) {
    store.setBanner('info', validation.warning)
  }

  processing.value = true
  downloadProgress.value = null
  downloadSummary.value = null
  showDownloadSummary.value = false
  downloadPaused.value = false
  canPauseResume.value = true

  // Create abort controller for pause/resume functionality
  downloadController.value = new AbortController()

  try {
    // Get selected submissions
    const selectedSubmissionData = submissions.value.filter(s => 
      selectedSubmissions.value.includes(s.id)
    )
    
    // Progress callback
    const onProgress = (progress: ExportProgress) => {
      downloadProgress.value = progress
      statusMessage.value = progress.currentOperation
      
      // Update legacy progress for UI compatibility
      const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
      progressPercentage.value = percentage
    }
    
    // Execute enhanced batch download
    const summary = await downloadSubmissionsBatch(
      selectedSubmissionData,
      onProgress,
      {
        batchSize: 1, // Sequential downloads
        delayBetweenBatches: 500, // 500ms delay between files
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
    
  } catch (err: any) {
    console.error('Enhanced batch download error:', err)
    store.setBanner('error', '批量下载失败: ' + (err.message || '未知错误'))
  } finally {
    processing.value = false
    statusMessage.value = ''
    canPauseResume.value = false
    downloadController.value = null
  }
}

const pauseDownload = () => {
  if (downloadController.value && !downloadPaused.value) {
    downloadPaused.value = true
    // Note: Actual pause implementation would require more complex state management
    // For now, we'll show the UI state change
    store.setBanner('info', '下载已暂停')
  }
}

const resumeDownload = () => {
  if (downloadPaused.value) {
    downloadPaused.value = false
    // Note: Actual resume implementation would require more complex state management
    store.setBanner('info', '下载已恢复')
  }
}

const cancelDownload = () => {
  if (downloadController.value) {
    downloadController.value.abort()
    downloadPaused.value = false
    processing.value = false
    canPauseResume.value = false
    store.setBanner('info', '下载已取消')
  }
}

onMounted(() => {
  loadData()
})

// Expose constants for template
const { BATCH_DOWNLOAD_LIMITS: limits } = { BATCH_DOWNLOAD_LIMITS }
</script>

<template>
  <main class="admin-page">
    <section class="page-head">
      <div class="head-row">
        <button class="btn btn--ghost btn--icon" @click="router.push('/events/mine')">
          <ArrowLeft :size="20" />
        </button>
        <div class="head-content">
          <h1>活动后台管理</h1>
          <p class="muted">{{ event?.title || '加载中...' }}</p>
        </div>
      </div>
    </section>

    <div class="admin-tabs">
      <button 
        class="tab-btn"
        :class="{ active: activeTab === 'forms' }"
        @click="activeTab = 'forms'"
      >
        <FileText :size="18" />
        报名数据
      </button>
      <button 
        class="tab-btn"
        :class="{ active: activeTab === 'files' }"
        @click="activeTab = 'files'"
      >
        <Download :size="18" />
        作品文件
      </button>
    </div>

    <section v-if="activeTab === 'forms'" class="admin-section">
      <div class="section-header">
        <div class="info-block">
          <h3>报名表导出</h3>
          <p class="muted">共收到 {{ registrations.length }} 份报名</p>
        </div>
        <div class="actions-group">
          <button class="btn btn--primary" @click="downloadForms" :disabled="registrations.length === 0">
            <Download :size="18" />
            导出 Excel
          </button>
        </div>
      </div>
      
      <!-- Export Preview Section -->
      <div v-if="showPreview" class="preview-section card">
        <div class="preview-header">
          <h4>导出预览</h4>
          <p class="muted">预览将要导出的数据结构和内容</p>
        </div>
        
        <div v-if="previewLoading" class="loading-state">
          <Loader2 class="spin" /> 生成预览中...
        </div>
        
        <div v-else-if="exportPreview" class="preview-content">
          <!-- Preview Summary -->
          <div class="preview-summary">
            <div class="summary-stats">
              <div class="stat-item">
                <span class="stat-label">报名记录</span>
                <span class="stat-value">{{ exportPreview.totalRegistrations }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">数据列</span>
                <span class="stat-value">{{ exportPreview.columnCount }}</span>
              </div>
              <div class="stat-item" v-if="exportPreview.hasComplexData">
                <span class="stat-label">复杂数据</span>
                <span class="stat-badge">包含嵌套表单</span>
              </div>
            </div>
          </div>
          
          <!-- Detected Columns -->
          <div class="preview-columns">
            <h5>检测到的数据列</h5>
            <div class="column-list">
              <div 
                v-for="column in exportPreview.detectedColumns.slice(0, 10)" 
                :key="column"
                class="column-tag"
                :class="{ 
                  'column-tag--standard': ['用户ID', '用户名', '报名状态', '报名时间'].includes(column),
                  'column-tag--dynamic': !['用户ID', '用户名', '报名状态', '报名时间'].includes(column)
                }"
              >
                {{ column }}
              </div>
              <div v-if="exportPreview.detectedColumns.length > 10" class="column-more">
                +{{ exportPreview.detectedColumns.length - 10 }} 更多列...
              </div>
            </div>
          </div>
          
          <!-- Sample Data -->
          <div class="preview-sample" v-if="exportPreview.sampleData.length > 0">
            <h5>数据样例（前 {{ exportPreview.sampleData.length }} 条）</h5>
            <div class="sample-table-container">
              <table class="sample-table">
                <thead>
                  <tr>
                    <th v-for="column in exportPreview.detectedColumns.slice(0, 6)" :key="column">
                      {{ column }}
                    </th>
                    <th v-if="exportPreview.detectedColumns.length > 6">...</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, index) in exportPreview.sampleData" :key="index">
                    <td v-for="column in exportPreview.detectedColumns.slice(0, 6)" :key="column">
                      {{ String(row[column] || '').substring(0, 30) }}{{ String(row[column] || '').length > 30 ? '...' : '' }}
                    </td>
                    <td v-if="exportPreview.detectedColumns.length > 6" class="more-columns">...</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      
      <div class="data-preview card">
        <!-- 使用增强组件处理加载和空状态 -->
        <TableEnhancements 
          :loading="loading"
          :is-empty="registrations.length === 0"
          :total-registrations="tableEnhancementData.totalRegistrations"
          :completed-registrations="tableEnhancementData.completedRegistrations"
          :average-response-fields="tableEnhancementData.averageResponseFields"
          :registration-times="tableEnhancementData.registrationTimes"
          @refresh="loadData"
        />
        
        <div v-if="!loading && registrations.length > 0" class="table-content">
          <div v-if="formResponseTable.hasFormData" class="enhanced-table-container">
            <!-- 使用美化的表格组件 -->
            <EnhancedDataTable
              title="报名表单回答汇总"
              :subtitle="`共 ${registrations.length} 份报名，显示前 ${Math.min(registrations.length, 10)} 条记录`"
              :columns="enhancedTableColumns"
              :rows="formResponseTable.rows"
              :display-limit="10"
              :show-stats="false"
            >
              <template #footer-actions>
                <div class="table-footer-actions">
                  <span class="export-hint">完整数据请导出 Excel 查看</span>
                  <button class="btn btn--primary btn--compact" @click="downloadForms">
                    <Download :size="16" />
                    导出 Excel
                  </button>
                </div>
              </template>
            </EnhancedDataTable>
          </div>
          
          <!-- 简化表格（无表单数据时） -->
          <div v-else class="simple-table-container">
            <div class="simple-table-header">
              <h4>报名数据概览</h4>
              <p class="muted">此活动暂未设置报名表单</p>
            </div>
            <div class="simple-table-content">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>用户</th>
                    <th>状态</th>
                    <th>报名时间</th>
                    <th>表单数据</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="reg in registrations.slice(0, 5)" :key="reg.id">
                    <td>
                      <div class="user-cell">
                        <div class="user-avatar-simple">
                          <User :size="14" />
                        </div>
                        {{ reg.profile?.username || '未知用户' }}
                      </div>
                    </td>
                    <td>
                      <span class="status-badge" :class="`status-badge--${reg.status}`">
                        {{ reg.status === 'registered' ? '已报名' : '未报名' }}
                      </span>
                    </td>
                    <td>{{ new Date(reg.created_at).toLocaleDateString() }}</td>
                    <td>
                      <span class="muted">无表单数据</span>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div v-if="registrations.length > 5" class="simple-table-footer">
                <p class="muted">... 仅展示前 5 条，请下载完整表格查看</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section v-else class="admin-section">
      <div class="section-header">
        <div class="info-block">
          <h3>作品文件批量下载</h3>
          <p class="muted">共 {{ submissions.length }} 个文件作品</p>
          <p v-if="selectedSubmissions.length > 0" class="selection-info">
            已选择 {{ selectedSubmissions.length }}/{{ limits.maxSelectionCount }} 个文件
            <span v-if="!selectionValidation.valid" class="error-text">{{ selectionValidation.message }}</span>
            <span v-else-if="selectionValidation.warning" class="warning-text">{{ selectionValidation.warning }}</span>
          </p>
          <p v-if="selectedSubmissions.length > 0 && estimatedDownloadTime > 0" class="time-estimate">
            预计下载时间: {{ Math.ceil(estimatedDownloadTime / 60) }} 分钟
          </p>
        </div>
        <div class="actions-group">
          <button 
            v-if="processing && canPauseResume"
            class="btn btn--ghost"
            @click="downloadPaused ? resumeDownload() : pauseDownload()"
          >
            {{ downloadPaused ? '恢复下载' : '暂停下载' }}
          </button>
          <button 
            v-if="processing && canPauseResume"
            class="btn btn--danger btn--compact"
            @click="cancelDownload"
          >
            取消
          </button>
          <button 
            class="btn btn--primary"
            @click="downloadFiles"
            :disabled="!selectionValidation.valid || processing"
          >
            <Loader2 v-if="processing" class="spin" :size="18" />
            <Download v-else :size="18" />
            {{ processing ? (downloadPaused ? '已暂停' : '处理中...') : `下载选中 (${selectedSubmissions.length})` }}
          </button>
        </div>
      </div>

      <!-- User Guidance for Large Operations -->
      <div v-if="selectedSubmissions.length > limits.warningThreshold" class="guidance-card card">
        <div class="guidance-content">
          <AlertCircle :size="20" class="warning-icon" />
          <div class="guidance-text">
            <h4>大批量下载提醒</h4>
            <p>您选择了 {{ selectedSubmissions.length }} 个文件，这可能需要较长时间完成。建议：</p>
            <ul>
              <li>确保网络连接稳定</li>
              <li>不要关闭浏览器标签页</li>
              <li>可以使用暂停/恢复功能控制下载进度</li>
              <li>如遇问题，可以取消后分批下载</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Enhanced Progress Display -->
      <div v-if="processing && downloadProgress" class="progress-card card">
        <div class="progress-header">
          <h4>批量下载进度</h4>
          <p class="muted">{{ downloadProgress.currentOperation }}</p>
        </div>
        <div class="progress-stats">
          <div class="stat-item">
            <span class="stat-label">进度</span>
            <span class="stat-value">{{ downloadProgress.current }}/{{ downloadProgress.total }}</span>
          </div>
          <div class="stat-item" v-if="downloadProgress.estimatedTimeRemaining">
            <span class="stat-label">预计剩余</span>
            <span class="stat-value">{{ Math.ceil(downloadProgress.estimatedTimeRemaining / 60) }}分钟</span>
          </div>
          <div class="stat-item" v-if="downloadProgress.errors.length > 0">
            <span class="stat-label">错误</span>
            <span class="stat-value error-text">{{ downloadProgress.errors.length }}</span>
          </div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${progressPercentage}%` }"></div>
        </div>
      </div>

      <!-- Download Summary -->
      <div v-if="showDownloadSummary && downloadSummary" class="summary-card card">
        <div class="summary-header">
          <h4>下载完成</h4>
          <button class="btn btn--ghost btn--compact" @click="showDownloadSummary = false">
            关闭
          </button>
        </div>
        <div class="summary-content">
          <div class="summary-stats">
            <div class="stat-item success">
              <CheckCircle :size="20" />
              <span>成功: {{ downloadSummary.successful }}</span>
            </div>
            <div class="stat-item" :class="{ error: downloadSummary.failed > 0 }">
              <AlertCircle :size="20" />
              <span>失败: {{ downloadSummary.failed }}</span>
            </div>
            <div class="stat-item">
              <span>总计: {{ downloadSummary.total }}</span>
            </div>
            <div class="stat-item">
              <span>耗时: {{ Math.ceil(downloadSummary.duration / 60000) }}分钟</span>
            </div>
          </div>
          <div v-if="downloadSummary.errors.length > 0" class="error-details">
            <h5>错误详情</h5>
            <div class="error-list">
              <div v-for="error in downloadSummary.errors.slice(0, 5)" :key="error.timestamp.getTime()" class="error-item">
                {{ error.message }}
              </div>
              <div v-if="downloadSummary.errors.length > 5" class="error-more">
                还有 {{ downloadSummary.errors.length - 5 }} 个错误...
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="file-list card">
        <div v-if="loading" class="loading-state">
          <Loader2 class="spin" /> 加载中...
        </div>
        <div v-else-if="submissions.length === 0" class="empty-state">
          暂无提交的文件作品
        </div>
        <template v-else>
          <!-- Pagination Controls (Top) -->
          <div class="pagination-header">
            <div class="pagination-info">
              <span>第 {{ currentPage }} 页，共 {{ totalPages }} 页</span>
              <span class="muted">（每页 {{ pageSize }} 个文件）</span>
            </div>
            <div class="pagination-controls" v-if="totalPages > 1">
              <button 
                class="btn btn--ghost btn--compact"
                @click="previousPage"
                :disabled="!hasPreviousPage"
              >
                上一页
              </button>
              <div class="page-numbers">
                <button 
                  v-for="page in Math.min(5, totalPages)" 
                  :key="page"
                  class="page-btn"
                  :class="{ active: page === currentPage }"
                  @click="goToPage(page)"
                >
                  {{ page }}
                </button>
                <span v-if="totalPages > 5" class="page-ellipsis">...</span>
                <button 
                  v-if="totalPages > 5 && currentPage < totalPages - 2"
                  class="page-btn"
                  @click="goToPage(totalPages)"
                >
                  {{ totalPages }}
                </button>
              </div>
              <button 
                class="btn btn--ghost btn--compact"
                @click="nextPage"
                :disabled="!hasNextPage"
              >
                下一页
              </button>
            </div>
          </div>

          <!-- Selection Controls -->
          <div class="list-header">
            <div class="selection-controls">
              <label class="checkbox-wrapper">
                <input 
                  type="checkbox" 
                  :checked="isAllCurrentPageSelected"
                  :indeterminate="isCurrentPageIndeterminate"
                  @change="toggleSelectCurrentPage"
                  :disabled="!canSelectMore && !isAllCurrentPageSelected"
                />
                当前页全选
                <span v-if="!canSelectMore && !isAllCurrentPageSelected" class="muted">
                  (已达上限)
                </span>
              </label>
              <button 
                v-if="selectedSubmissions.length > 0"
                class="btn btn--ghost btn--compact"
                @click="selectedSubmissions = []; selectionManager.clear()"
              >
                清空选择
              </button>
            </div>
            <span>作品信息</span>
            <span>大小/格式</span>
          </div>
          
          <div class="list-body">
            <div 
              v-for="(sub, index) in paginatedSubmissions.items" 
              :key="sub.id" 
              class="list-item"
              :class="{ selected: selectedSubmissions.includes(sub.id) }"
            >
              <label class="checkbox-wrapper">
                <input 
                  type="checkbox" 
                  :checked="selectedSubmissions.includes(sub.id)"
                  @change="toggleSubmissionSelection(sub.id)"
                  :disabled="!selectedSubmissions.includes(sub.id) && !canSelectMore"
                />
                <span class="index-badge">
                  #{{ (currentPage - 1) * pageSize + index + 1 }}
                </span>
              </label>
              <div class="item-info">
                <h4>{{ sub.project_name }}</h4>
                <p class="muted">{{ sub.teams?.name || '未知队伍' }}</p>
              </div>
              <div class="item-meta">
                <span class="file-tag">{{ sub.submission_storage_path?.split('.').pop()?.toUpperCase() }}</span>
              </div>
            </div>
          </div>

          <!-- Pagination Controls (Bottom) -->
          <div class="pagination-footer" v-if="totalPages > 1">
            <div class="pagination-summary">
              显示第 {{ (currentPage - 1) * pageSize + 1 }} - {{ Math.min(currentPage * pageSize, submissions.length) }} 项，
              共 {{ submissions.length }} 项
            </div>
            <div class="pagination-controls">
              <button 
                class="btn btn--ghost btn--compact"
                @click="previousPage"
                :disabled="!hasPreviousPage"
              >
                上一页
              </button>
              <span class="page-indicator">{{ currentPage }} / {{ totalPages }}</span>
              <button 
                class="btn btn--ghost btn--compact"
                @click="nextPage"
                :disabled="!hasNextPage"
              >
                下一页
              </button>
            </div>
          </div>
        </template>
      </div>
    </section>
  </main>
</template>

<style scoped>
.admin-page {
  margin: 0;
  padding: 2rem 1rem 6rem;
  color: var(--ink);
}

.page-head {
  margin-bottom: 2rem;
}

.head-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.head-content h1 {
  margin: 0;
  font-size: 1.75rem;
  font-family: 'Sora', sans-serif;
}

.head-content p {
  margin: 0.25rem 0 0;
  font-size: 0.95rem;
}

.admin-tabs {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  border-bottom: 1px solid var(--border);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 1.5rem;
  background: none;
  border: none;
  font-size: 1rem;
  font-weight: 500;
  color: var(--muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab-btn.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.tab-btn:hover:not(.active) {
  color: var(--ink);
}

.admin-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.actions-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.section-header h3 {
  margin: 0;
  font-size: 1.25rem;
}

.section-header p {
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.data-preview {
  padding: 1rem;
}

.table-container {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.data-table th,
.data-table td {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

.data-table th {
  color: var(--muted);
  font-weight: 500;
}

.table-footer {
  text-align: center;
  color: var(--muted);
  font-size: 0.85rem;
  padding: 1rem;
  margin: 0;
}

.loading-state,
.empty-state {
  padding: 3rem;
  text-align: center;
  color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.file-list {
  display: flex;
  flex-direction: column;
}

.list-header {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 1rem;
  padding: 1rem;
  background: var(--surface-muted);
  border-bottom: 1px solid var(--border);
  font-weight: 500;
  color: var(--muted);
  font-size: 0.9rem;
}

.list-body {
  max-height: 600px;
  overflow-y: auto;
}

.list-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid var(--border);
  align-items: center;
  transition: background 0.15s;
}

.list-item:hover {
  background: var(--surface-muted);
}

.list-item.selected {
  background: rgba(31, 111, 109, 0.05);
}

.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
}

.checkbox-wrapper input {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.index-badge {
  font-family: monospace;
  color: var(--muted);
  font-size: 0.9rem;
}

.item-info h4 {
  margin: 0;
  font-size: 1rem;
  color: var(--ink);
}

.item-info p {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
}

.file-tag {
  background: var(--surface-muted);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--muted);
}

.progress-card {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.progress-header h4 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--ink);
}

.progress-header p {
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
}

.progress-stats {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
}

.progress-stats .stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.progress-stats .stat-label {
  font-size: 0.85rem;
  color: var(--muted);
  font-weight: 500;
}

.progress-stats .stat-value {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--accent);
}

.progress-stats .stat-value.error-text {
  color: var(--danger);
}

.progress-bar {
  height: 8px;
  background: var(--surface-muted);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s;
}

/* Selection Info Styles */
.selection-info {
  font-size: 0.85rem;
  margin: 0.25rem 0 0;
}

.error-text {
  color: var(--danger);
  font-weight: 500;
}

.warning-text {
  color: #f59e0b;
  font-weight: 500;
}

/* Summary Card Styles */
.summary-card {
  border-left: 4px solid var(--accent);
}

.summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border);
}

.summary-header h4 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--ink);
}

.summary-content {
  padding: 1.5rem;
}

.summary-stats {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.summary-stats .stat-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--surface-muted);
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
}

.summary-stats .stat-item.success {
  background: rgba(34, 197, 94, 0.1);
  color: rgb(34, 197, 94);
}

.summary-stats .stat-item.error {
  background: rgba(239, 68, 68, 0.1);
  color: rgb(239, 68, 68);
}

.error-details h5 {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  color: var(--ink);
}

.error-list {
  background: var(--surface-muted);
  border-radius: 6px;
  padding: 1rem;
  max-height: 200px;
  overflow-y: auto;
}

.error-item {
  font-size: 0.85rem;
  color: var(--danger);
  margin-bottom: 0.5rem;
  padding-left: 1rem;
  position: relative;
}

.error-item:before {
  content: '•';
  position: absolute;
  left: 0;
  color: var(--danger);
}

.error-more {
  font-size: 0.85rem;
  color: var(--muted);
  font-style: italic;
  margin-top: 0.5rem;
}

/* Preview Section Styles */
.preview-section {
  margin-bottom: 1.5rem;
}

.preview-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border);
}

.preview-header h4 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--ink);
}

.preview-header p {
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
}

.preview-content {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.preview-summary {
  background: var(--surface-muted);
  border-radius: 8px;
  padding: 1rem;
}

.summary-stats {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-label {
  font-size: 0.85rem;
  color: var(--muted);
  font-weight: 500;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--accent);
}

.stat-badge {
  background: var(--accent-soft);
  color: var(--accent);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
}

.preview-columns h5,
.preview-sample h5 {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  color: var(--ink);
}

.column-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.column-tag {
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  border: 1px solid var(--border);
}

.column-tag--standard {
  background: var(--accent-soft);
  color: var(--accent);
  border-color: var(--accent);
}

.column-tag--dynamic {
  background: var(--surface);
  color: var(--muted);
}

.column-more {
  padding: 0.4rem 0.75rem;
  color: var(--muted);
  font-size: 0.85rem;
  font-style: italic;
}

.sample-table-container {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 6px;
}

.sample-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.sample-table th,
.sample-table td {
  padding: 0.6rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--border);
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sample-table th {
  background: var(--surface-muted);
  color: var(--muted);
  font-weight: 600;
  font-size: 0.8rem;
}

.sample-table .more-columns {
  color: var(--muted);
  font-style: italic;
  text-align: center;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
}

.status-badge--registered {
  background: rgba(34, 197, 94, 0.1);
  color: rgb(34, 197, 94);
}

.status-badge--pending,
.status-badge--cancelled {
  background: rgba(251, 191, 36, 0.1);
  color: rgb(251, 191, 36);
}

.form-data-indicator {
  background: var(--accent-soft);
  color: var(--accent);
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

/* Pagination Styles */
.pagination-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface-muted);
}

.pagination-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--ink);
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.page-numbers {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.page-btn {
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  border-radius: 4px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s;
}

.page-btn:hover {
  background: var(--surface-muted);
  color: var(--ink);
}

.page-btn.active {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.page-ellipsis {
  color: var(--muted);
  padding: 0 0.5rem;
}

.pagination-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border);
  background: var(--surface-muted);
  font-size: 0.85rem;
}

.pagination-summary {
  color: var(--muted);
}

.page-indicator {
  color: var(--muted);
  font-size: 0.9rem;
  padding: 0 0.75rem;
}

/* Selection Controls */
.selection-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.time-estimate {
  font-size: 0.85rem;
  color: var(--accent);
  margin: 0.25rem 0 0;
  font-weight: 500;
}

/* Guidance Card */
.guidance-card {
  border-left: 4px solid #f59e0b;
  background: rgba(251, 191, 36, 0.05);
}

.guidance-content {
  display: flex;
  gap: 1rem;
  padding: 1.5rem;
  align-items: flex-start;
}

.warning-icon {
  color: #f59e0b;
  flex-shrink: 0;
  margin-top: 0.25rem;
}

.guidance-text h4 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  color: var(--ink);
}

.guidance-text p {
  margin: 0 0 0.75rem;
  color: var(--muted);
  font-size: 0.9rem;
}

.guidance-text ul {
  margin: 0;
  padding-left: 1.25rem;
  color: var(--muted);
  font-size: 0.85rem;
}

.guidance-text li {
  margin-bottom: 0.25rem;
}

/* Enhanced List Header */
.list-header {
  display: grid;
  grid-template-columns: 2fr 1fr auto;
  gap: 1rem;
  padding: 1rem;
  background: var(--surface-muted);
  border-bottom: 1px solid var(--border);
  font-weight: 500;
  color: var(--muted);
  font-size: 0.9rem;
  align-items: center;
}

/* Responsive Design for Pagination */
@media (max-width: 640px) {
  .pagination-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .pagination-controls {
    justify-content: center;
  }
  
  .page-numbers {
    display: none;
  }
  
  .pagination-footer {
    flex-direction: column;
    gap: 0.75rem;
    text-align: center;
  }
  
  .guidance-content {
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .selection-controls {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
}
</style>

/* Enhanced table styles for action column */
.data-table th:last-child,
.data-table td:last-child {
  width: 120px;
  text-align: center;
}

/* Form Response Table Styles */
.form-response-table {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.table-header {
  padding: 0 0.5rem;
}

.table-header h4 {
  margin: 0 0 0.25rem;
  font-size: 1.1rem;
  color: var(--ink);
}

.table-header p {
  margin: 0;
  font-size: 0.85rem;
}

.responsive-table-container {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}

.response-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  min-width: 800px; /* 确保表格有最小宽度 */
}

.response-table th,
.response-table td {
  padding: 0.75rem 0.5rem;
  text-align: left;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}

.response-table th {
  background: var(--surface-muted);
  font-weight: 600;
  position: sticky;
  top: 0;
  z-index: 1;
}

.column-header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 120px;
}

.column-title {
  font-weight: 600;
  color: var(--ink);
  line-height: 1.3;
}

.column-type {
  font-size: 0.75rem;
  color: var(--muted);
  font-weight: 400;
  background: var(--surface);
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  border: 1px solid var(--border);
  align-self: flex-start;
}

.column--standard {
  background: var(--accent-soft);
}

.column--standard .column-title {
  color: var(--accent);
}

.column--question {
  background: var(--surface-muted);
}

.cell--standard {
  background: rgba(31, 111, 109, 0.02);
  font-weight: 500;
}

.cell--response {
  max-width: 200px;
}

.response-cell {
  display: flex;
  align-items: center;
  min-height: 1.5rem;
}

.response-text {
  color: var(--ink);
  line-height: 1.4;
  word-break: break-word;
  hyphens: auto;
}

.response-empty {
  color: var(--muted);
  font-style: italic;
  font-size: 0.8rem;
}

.simple-table {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Enhanced table container */
.enhanced-table-container {
  padding: 0;
  background: transparent;
}

.table-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Data preview card enhancements */
.data-preview {
  padding: 0;
  overflow: visible;
}

.data-preview.card {
  background: transparent;
  border: none;
  box-shadow: none;
}

/* Simple table styles */
.simple-table-container {
  padding: 1.5rem;
}

.simple-table-header {
  margin-bottom: 1.5rem;
}

.simple-table-header h4 {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
  color: var(--ink);
}

.simple-table-header p {
  margin: 0;
  font-size: 0.9rem;
}

.simple-table-content {
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--surface);
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.user-avatar-simple {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: 50%;
}

.simple-table-footer {
  padding: 1rem;
  text-align: center;
  background: var(--surface-muted);
  border-top: 1px solid var(--border);
}

.simple-table-footer p {
  margin: 0;
  font-size: 0.85rem;
}

/* Table footer actions */
.table-footer-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.export-hint {
  font-size: 0.85rem;
  color: var(--muted);
}

@media (max-width: 640px) {
  /* 响应式表格 */
  .response-table {
    min-width: 600px;
    font-size: 0.8rem;
  }
  
  .response-table th,
  .response-table td {
    padding: 0.5rem 0.25rem;
  }
  
  .column-header {
    min-width: 100px;
  }
  
  .column-title {
    font-size: 0.8rem;
  }
  
  .column-type {
    font-size: 0.7rem;
    padding: 0.1rem 0.3rem;
  }
  
  .cell--response {
    max-width: 150px;
  }
  
  .response-text {
    font-size: 0.8rem;
  }
}