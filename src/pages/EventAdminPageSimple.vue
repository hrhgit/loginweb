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
      
      <div class="data-preview card">
        <div v-if="loading" class="loading-state">
          <Loader2 class="spin" /> 加载中...
        </div>
        <div v-else-if="registrations.length === 0" class="empty-state">
          <FileText :size="48" />
          <div class="empty-content">
            <h3>暂无报名数据</h3>
            <p>还没有用户报名参加此活动</p>
            <button class="btn btn--ghost" @click="loadData">
              <Download :size="16" />
              刷新数据
            </button>
          </div>
        </div>
        <div v-else class="table-content">
          <div v-if="formResponseTable.hasFormData" class="enhanced-table-container">
            <!-- 使用美化的表格组件 -->
            <EnhancedDataTable
              title="报名表单回答汇总"
              :subtitle="`共 ${registrations.length} 份报名，显示前 ${Math.min(registrations.length, 10)} 条记录`"
              :columns="enhancedTableColumns"
              :rows="formResponseTable.rows"
              :display-limit="10"
              :show-stats="false"
            />
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
          <h3>作品文件</h3>
          <p class="muted">
            共 {{ submissions.length }} 个文件作品
            <span v-if="totalPages > 1">，第 {{ currentPage }} / {{ totalPages }} 页</span>
          </p>
        </div>
        <div class="actions-group" v-if="submissions.length > 0">
          <button 
            class="btn btn--primary" 
            @click="downloadSelectedFiles"
            :disabled="selectedSubmissions.size === 0"
          >
            <Download :size="18" />
            批量下载 ({{ selectedSubmissions.size }})
          </button>
        </div>
      </div>
      
      <div class="file-list card">
        <div v-if="loading" class="loading-state">
          <Loader2 class="spin" /> 加载中...
        </div>
        <div v-else-if="submissions.length === 0" class="empty-state">
          <FileText :size="48" />
          <div class="empty-content">
            <h3>暂无提交的文件作品</h3>
            <p>还没有队伍提交作品文件</p>
          </div>
        </div>
        <div v-else class="enhanced-file-list">
          <div class="list-header">
            <div class="header-checkbox">
              <input 
                type="checkbox" 
                :checked="isAllCurrentPageSelected"
                :indeterminate="isSomeCurrentPageSelected && !isAllCurrentPageSelected"
                @change="toggleSelectAllCurrentPage"
                class="checkbox"
              />
            </div>
            <div class="sortable-header" @click="handleSort('project_name')">
              <span>作品</span>
              <div class="sort-icons">
                <ChevronUp 
                  v-if="sortBy === 'project_name' && sortOrder === 'asc'"
                  :size="14" 
                  class="sort-icon"
                />
                <ChevronDown 
                  v-if="sortBy === 'project_name' && sortOrder === 'desc'"
                  :size="14" 
                  class="sort-icon"
                />
                <ChevronsUpDown 
                  v-if="sortBy !== 'project_name'"
                  :size="14" 
                  class="sort-icon sort-icon--inactive"
                />
              </div>
            </div>
            <div class="sortable-header" @click="handleSort('team_name')">
              <span>队伍</span>
              <div class="sort-icons">
                <ChevronUp 
                  v-if="sortBy === 'team_name' && sortOrder === 'asc'"
                  :size="14" 
                  class="sort-icon"
                />
                <ChevronDown 
                  v-if="sortBy === 'team_name' && sortOrder === 'desc'"
                  :size="14" 
                  class="sort-icon"
                />
                <ChevronsUpDown 
                  v-if="sortBy !== 'team_name'"
                  :size="14" 
                  class="sort-icon sort-icon--inactive"
                />
              </div>
            </div>
            <div class="sortable-header" @click="handleSort('link_mode')">
              <span>提交方式</span>
              <div class="sort-icons">
                <ChevronUp 
                  v-if="sortBy === 'link_mode' && sortOrder === 'asc'"
                  :size="14" 
                  class="sort-icon"
                />
                <ChevronDown 
                  v-if="sortBy === 'link_mode' && sortOrder === 'desc'"
                  :size="14" 
                  class="sort-icon"
                />
                <ChevronsUpDown 
                  v-if="sortBy !== 'link_mode'"
                  :size="14" 
                  class="sort-icon sort-icon--inactive"
                />
              </div>
            </div>
            <div class="sortable-header" @click="handleSort('created_at')">
              <span>提交时间</span>
              <div class="sort-icons">
                <ChevronUp 
                  v-if="sortBy === 'created_at' && sortOrder === 'asc'"
                  :size="14" 
                  class="sort-icon"
                />
                <ChevronDown 
                  v-if="sortBy === 'created_at' && sortOrder === 'desc'"
                  :size="14" 
                  class="sort-icon"
                />
                <ChevronsUpDown 
                  v-if="sortBy !== 'created_at'"
                  :size="14" 
                  class="sort-icon sort-icon--inactive"
                />
              </div>
            </div>
            <span>操作</span>
          </div>
          <div class="list-body">
            <div 
              v-for="sub in paginatedSubmissions" 
              :key="sub.id" 
              class="list-item"
              :class="{ 'item--selected': selectedSubmissions.has(sub.id) }"
            >
              <div class="item-checkbox">
                <input 
                  type="checkbox" 
                  :checked="selectedSubmissions.has(sub.id)"
                  @change="toggleSubmissionSelection(sub.id)"
                  class="checkbox"
                />
              </div>
              <div class="item-info">
                <h4>{{ sub.project_name }}</h4>
              </div>
              <div class="item-team">
                <span>{{ sub.teams?.name || '未知队伍' }}</span>
              </div>
              <div class="item-submission-type">
                <span class="submission-type-badge" :class="`submission-type--${sub.link_mode}`">
                  {{ sub.link_mode === 'file' ? '文件' : '链接' }}
                </span>
              </div>
              <div class="item-meta">
                <span>{{ new Date(sub.created_at).toLocaleDateString() }}</span>
              </div>
              <div class="item-actions">
                <!-- 文件类型显示下载按钮 -->
                <button 
                  v-if="sub.link_mode === 'file'"
                  class="btn btn--ghost btn--compact"
                  @click="downloadSingleFile(sub)"
                >
                  <Download :size="16" />
                  下载
                </button>
                <!-- 链接类型显示访问链接按钮 -->
                <a 
                  v-else
                  :href="sub.submission_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn btn--ghost btn--compact"
                >
                  <ExternalLink :size="16" />
                  访问链接
                </a>
              </div>
            </div>
          </div>
          
          <!-- 分页控件 -->
          <div v-if="totalPages > 1" class="pagination-controls">
            <button 
              class="btn btn--ghost btn--compact"
              @click="currentPage = Math.max(1, currentPage - 1)"
              :disabled="currentPage === 1"
            >
              上一页
            </button>
            <span class="page-info">
              第 {{ currentPage }} / {{ totalPages }} 页
            </span>
            <button 
              class="btn btn--ghost btn--compact"
              @click="currentPage = Math.min(totalPages, currentPage + 1)"
              :disabled="currentPage === totalPages"
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Download, FileText, Loader2, User, ExternalLink, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-vue-next'
import { useAppStore } from '../store/appStore'
import { supabase } from '../lib/supabase'
import { getEventDetailsFromDescription } from '../utils/eventDetails'
import EnhancedDataTable from '../components/admin/EnhancedDataTable.vue'
import { 
  convertToFlattenedRegistrations,
  generateExportFilename,
  type RegistrationData
} from '../utils/exportUtils'
import { 
  exportRegistrationsToExcel
} from '../utils/excelUtils'
import { generateFormResponseTable } from '../utils/formResponseParser'
import * as XLSX from 'xlsx'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const eventId = computed(() => String(route.params.id ?? ''))
const event = computed(() => store.getEventById(eventId.value))

const loading = ref(false)
const registrations = ref<RegistrationData[]>([])
const submissions = ref<any[]>([])
const selectedSubmissions = ref<Set<string>>(new Set())
const currentPage = ref(1)
const itemsPerPage = 50

// 排序状态 - 为作品文件表格添加
const sortBy = ref<string>('')
const sortOrder = ref<'asc' | 'desc'>('asc')

const activeTab = ref<'forms' | 'files'>('forms')

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

// Pagination for submissions with sorting
const sortedSubmissions = computed(() => {
  let sorted = [...submissions.value]
  
  if (sortBy.value) {
    sorted.sort((a, b) => {
      let aValue: any
      let bValue: any
      
      switch (sortBy.value) {
        case 'project_name':
          aValue = a.project_name || ''
          bValue = b.project_name || ''
          break
        case 'team_name':
          aValue = a.teams?.name || ''
          bValue = b.teams?.name || ''
          break
        case 'link_mode':
          aValue = a.link_mode || ''
          bValue = b.link_mode || ''
          break
        case 'created_at':
          aValue = new Date(a.created_at)
          bValue = new Date(b.created_at)
          break
        default:
          return 0
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder.value === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }
      
      if (aValue instanceof Date && bValue instanceof Date) {
        return sortOrder.value === 'asc' 
          ? aValue.getTime() - bValue.getTime()
          : bValue.getTime() - aValue.getTime()
      }
      
      return sortOrder.value === 'asc' ? aValue - bValue : bValue - aValue
    })
  }
  
  return sorted
})

const totalPages = computed(() => Math.ceil(sortedSubmissions.value.length / itemsPerPage))

const paginatedSubmissions = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return sortedSubmissions.value.slice(start, end)
})

const isAllCurrentPageSelected = computed(() => {
  if (paginatedSubmissions.value.length === 0) return false
  return paginatedSubmissions.value.every(sub => selectedSubmissions.value.has(sub.id))
})

const isSomeCurrentPageSelected = computed(() => {
  return paginatedSubmissions.value.some(sub => selectedSubmissions.value.has(sub.id))
})

const loadData = async () => {
  if (!eventId.value) return
  loading.value = true
  
  try {
    await store.ensureEventsLoaded()
    
    // Check if event exists and user has permission
    const currentEvent = event.value
    
    if (!currentEvent) {
      const { data: fetchedEvent, error: fetchError } = await store.fetchEventById(eventId.value)
      
      if (fetchError || !fetchedEvent) {
        store.setBanner('error', `活动不存在或您没有访问权限: ${fetchError || '未知错误'}`)
        router.replace('/events/mine')
        return
      }
      
      if (fetchedEvent.created_by !== store.user?.id && !store.isAdmin) {
        store.setBanner('error', '您没有管理此活动的权限')
        router.replace('/events/mine')
        return
      }
    } else {
      if (currentEvent.created_by !== store.user?.id && !store.isAdmin) {
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

    // Load submissions with team info
    const { data: subData, error: subError } = await supabase
      .from('submissions')
      .select('*, teams(name)')
      .eq('event_id', eventId.value)
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

const downloadForms = () => {
  if (!registrations.value.length) {
    store.setBanner('info', '暂无报名数据')
    return
  }

  try {
    // 使用我们的表单解析逻辑生成数据
    const tableData = formResponseTable.value
    
    if (!tableData.hasFormData) {
      // 如果没有表单数据，使用简单的导出
      const flattenedData = convertToFlattenedRegistrations(registrations.value)
      const filename = generateExportFilename(event.value?.title || '活动', 'registration')
      exportRegistrationsToExcel(flattenedData, filename, {
        sheetName: '报名数据',
        autoWidth: true
      })
    } else {
      // 使用解析后的表单数据
      const excelData = tableData.rows.map(row => {
        const excelRow: Record<string, any> = {}
        
        tableData.columns.forEach(column => {
          if (column.isStandard) {
            // 标准列
            excelRow[column.title] = row[column.key as keyof typeof row]
          } else {
            // 表单回答列 - 使用解析后的显示值
            excelRow[column.title] = row.responses[column.key] || '未填写'
          }
        })
        
        return excelRow
      })
      
      const filename = generateExportFilename(event.value?.title || '活动', 'registration')
      
      // 创建工作簿
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.json_to_sheet(excelData)
      
      // 自动调整列宽
      const columnWidths = tableData.columns.map(column => {
        let maxWidth = column.title.length
        excelData.forEach(row => {
          const cellValue = String(row[column.title] || '')
          maxWidth = Math.max(maxWidth, cellValue.length)
        })
        return { width: Math.min(Math.max(maxWidth + 2, 10), 50) }
      })
      worksheet['!cols'] = columnWidths
      
      XLSX.utils.book_append_sheet(workbook, worksheet, '报名数据')
      XLSX.writeFile(workbook, filename)
    }
    
    store.setBanner('info', '报名表导出成功')
  } catch (err: any) {
    console.error('Export error:', err)
    store.setBanner('error', '导出失败: ' + err.message)
  }
}

// 文件下载相关方法
const toggleSubmissionSelection = (submissionId: string) => {
  if (selectedSubmissions.value.has(submissionId)) {
    selectedSubmissions.value.delete(submissionId)
  } else {
    selectedSubmissions.value.add(submissionId)
  }
}

const toggleSelectAllCurrentPage = () => {
  if (isAllCurrentPageSelected.value) {
    // 取消选择当前页面的所有项目
    paginatedSubmissions.value.forEach(sub => {
      selectedSubmissions.value.delete(sub.id)
    })
  } else {
    // 选择当前页面的所有项目
    paginatedSubmissions.value.forEach(sub => {
      selectedSubmissions.value.add(sub.id)
    })
  }
}

const downloadSingleFile = async (submission: any) => {
  try {
    if (!submission.submission_storage_path) {
      store.setBanner('error', '该作品没有文件')
      return
    }

    // 从存储路径中提取文件扩展名
    const pathParts = submission.submission_storage_path.split('.')
    const fileExtension = pathParts.length > 1 ? '.' + pathParts[pathParts.length - 1] : ''

    // 生成自定义文件名（包含扩展名）
    const submissionNumber = submissions.value.findIndex(s => s.id === submission.id) + 1
    const customFilename = `${String(submissionNumber).padStart(3, '0')}-${sanitizeFilename(submission.teams?.name || 'unknown')}-${sanitizeFilename(submission.project_name)}${fileExtension}`
    
    // 使用 Supabase 生成带自定义文件名的签名URL
    const { data, error } = await supabase.storage
      .from('submission-files')
      .createSignedUrl(submission.submission_storage_path, 3600, {
        download: customFilename
      })

    if (error) {
      throw error
    }

    if (!data?.signedUrl) {
      throw new Error('未能获取有效的下载链接')
    }

    // 触发浏览器下载
    const link = document.createElement('a')
    link.href = data.signedUrl
    link.download = customFilename
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    store.setBanner('info', '开始下载文件')
  } catch (err: any) {
    console.error('Download error:', err)
    store.setBanner('error', '下载失败: ' + err.message)
  }
}

const downloadSelectedFiles = async () => {
  if (selectedSubmissions.value.size === 0) {
    store.setBanner('info', '请先选择要下载的文件')
    return
  }

  try {
    const selectedSubs = submissions.value.filter(sub => selectedSubmissions.value.has(sub.id))
    const fileSubs = selectedSubs.filter(sub => sub.link_mode === 'file' && sub.submission_storage_path)
    
    if (fileSubs.length === 0) {
      store.setBanner('info', '所选项目中没有文件类型的提交')
      return
    }
    
    if (fileSubs.length < selectedSubs.length) {
      store.setBanner('info', `共选择了 ${selectedSubs.length} 个项目，其中 ${fileSubs.length} 个为文件类型，将下载文件类型的提交`)
    }
    
    store.setBanner('info', `开始批量下载 ${fileSubs.length} 个文件...`)
    
    for (let i = 0; i < fileSubs.length; i++) {
      const submission = fileSubs[i]
      await downloadSingleFile(submission)
      // 添加延迟避免浏览器阻止多个下载
      if (i < fileSubs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    store.setBanner('info', `批量下载完成，共处理 ${fileSubs.length} 个文件`)
  } catch (err: any) {
    console.error('Batch download error:', err)
    store.setBanner('error', '批量下载失败: ' + err.message)
  }
}

// 文件名清理函数
const sanitizeFilename = (name: string): string => {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim()
}

// 排序处理函数
const handleSort = (columnKey: string) => {
  if (sortBy.value === columnKey) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = columnKey
    sortOrder.value = 'asc'
  }
}

onMounted(() => {
  loadData()
})
</script>

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

.loading-state,
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

.empty-content h3 {
  margin: 0;
  font-size: 1.25rem;
  color: var(--ink);
}

.empty-content p {
  margin: 0.5rem 0 1rem;
  color: var(--muted);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
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
  background: var(--surface-muted);
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

/* Enhanced file list */
.enhanced-file-list {
  display: flex;
  flex-direction: column;
}

.list-header {
  display: grid;
  grid-template-columns: 40px 2fr 1fr 100px 1fr 120px;
  gap: 1rem;
  padding: 1rem;
  background: var(--surface-muted);
  border-bottom: 1px solid var(--border);
  font-weight: 600;
  color: var(--ink);
  font-size: 0.9rem;
  align-items: center;
}

.sortable-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: color 0.18s ease;
  user-select: none;
}

.sortable-header:hover {
  color: var(--accent);
}

.sort-icons {
  display: flex;
  align-items: center;
  margin-left: 0.5rem;
}

.sort-icon {
  color: var(--accent);
  transition: all 0.18s ease;
}

.sort-icon--inactive {
  color: var(--muted);
  opacity: 0.5;
}

.header-checkbox {
  display: flex;
  justify-content: center;
}

.list-body {
  max-height: 600px;
  overflow-y: auto;
}

.list-item {
  display: grid;
  grid-template-columns: 40px 2fr 1fr 100px 1fr 120px;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid var(--border);
  align-items: center;
  transition: all 0.15s;
}

.list-item:hover {
  background: var(--surface-muted);
}

.item--selected {
  background: var(--accent-soft);
}

.item-checkbox {
  display: flex;
  justify-content: center;
}

.checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--accent);
  cursor: pointer;
}

.enhanced-file-list .item-info h4 {
  margin: 0;
  font-size: 1rem;
  color: var(--muted);
  line-height: 1.3;
  font-weight: 600 !important;
}

.item-info p {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: var(--muted);
  line-height: 1.3;
}

.item-team {
  color: var(--ink);
  font-weight: 500;
}

.item-meta {
  color: var(--muted);
  font-size: 0.85rem;
}

.item-actions {
  display: flex;
  justify-content: flex-start;
}

.item-submission-type {
  display: flex;
  align-items: center;
}

.submission-type-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  text-align: center;
}

.submission-type--file {
  background: rgba(34, 197, 94, 0.1);
  color: rgb(34, 197, 94);
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.submission-type--link {
  background: rgba(59, 130, 246, 0.1);
  color: rgb(59, 130, 246);
  border: 1px solid rgba(59, 130, 246, 0.3);
}

/* Simple file list (fallback) */
.simple-file-list {
  display: flex;
  flex-direction: column;
}

.simple-file-list .list-header {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 1rem;
  padding: 1rem;
  background: var(--surface-muted);
  border-bottom: 1px solid var(--border);
  font-weight: 500;
  color: var(--muted);
  font-size: 0.9rem;
}

.simple-file-list .list-body {
  max-height: 600px;
  overflow-y: auto;
}

.simple-file-list .list-item {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid var(--border);
  align-items: center;
  transition: background 0.15s;
}

.simple-file-list .list-item:hover {
  background: var(--surface-muted);
}

/* 分页控件 */
.pagination-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--surface-muted);
  border-top: 1px solid var(--border);
}

.page-info {
  font-size: 0.9rem;
  color: var(--muted);
  font-weight: 500;
}
</style>