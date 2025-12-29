<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Download, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-vue-next'
import { useAppStore } from '../store/appStore'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const eventId = computed(() => String(route.params.id ?? ''))
const event = computed(() => store.getEventById(eventId.value))

const loading = ref(false)
const registrations = ref<any[]>([])
const submissions = ref<any[]>([])
const selectedSubmissions = ref<string[]>([])
const processing = ref(false)
const progress = ref(0)
const statusMessage = ref('')

const isAllSelected = computed(() => {
  return submissions.value.length > 0 && selectedSubmissions.value.length === submissions.value.length
})

const isIndeterminate = computed(() => {
  return selectedSubmissions.value.length > 0 && selectedSubmissions.value.length < submissions.value.length
})

const activeTab = ref<'forms' | 'files'>('forms')

const loadData = async () => {
  if (!eventId.value) return
  loading.value = true
  
  try {
    await store.ensureEventsLoaded()
    
    // Check permissions
    if (!event.value) {
      router.replace('/events/mine')
      return
    }
    
    // Load registrations
    const { data: regData, error: regError } = await supabase
      .from('registrations')
      .select('*, profiles(username, avatar_url), user_contacts(phone, qq)')
      .eq('event_id', eventId.value)
    
    if (regError) throw regError
    registrations.value = regData || []

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

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedSubmissions.value = []
  } else {
    selectedSubmissions.value = submissions.value.map(s => s.id)
  }
}

const downloadForms = () => {
  if (!registrations.value.length) {
    store.setBanner('info', '暂无报名数据')
    return
  }

  try {
    const data = registrations.value.map(reg => {
      const formResponse = reg.form_response || {}
      // Flatten the data structure
      return {
        用户ID: reg.user_id,
        用户名: reg.profiles?.username || '未知',
        电话: reg.user_contacts?.phone || '',
        QQ: reg.user_contacts?.qq || '',
        报名状态: reg.status,
        报名时间: new Date(reg.created_at).toLocaleString(),
        ...formResponse // Spread dynamic form answers
      }
    })

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "报名表")
    const filename = `${event.value?.title || '活动'}_报名表_${new Date().toISOString().split('T')[0]}.xlsx`
    XLSX.writeFile(wb, filename)
    
    store.setBanner('info', '报名表导出成功')
  } catch (err: any) {
    console.error(err)
    store.setBanner('error', '导出失败: ' + err.message)
  }
}

const downloadFiles = async () => {
  if (!selectedSubmissions.value.length) {
    store.setBanner('info', '请先选择要下载的作品')
    return
  }

  processing.value = true
  progress.value = 0
  statusMessage.value = '准备下载...'

  try {
    const zip = new JSZip()
    const folder = zip.folder("submissions")
    
    const targets = submissions.value.filter(s => selectedSubmissions.value.includes(s.id))
    let completed = 0
    const total = targets.length

    for (let i = 0; i < total; i++) {
      const sub = targets[i]
      const teamName = sub.teams?.name || '未知队伍'
      const projectName = sub.project_name || '未命名作品'
      const originalPath = sub.submission_storage_path
      
      if (!originalPath) continue

      // Format: Index-TeamName-ProjectName.ext
      const ext = originalPath.split('.').pop() || 'zip'
      // Sanitize filename to avoid issues
      const safeTeamName = teamName.replace(/[\\/:*?"<>|]/g, '_')
      const safeProjectName = projectName.replace(/[\\/:*?"<>|]/g, '_')
      const filename = `${String(i + 1).padStart(3, '0')}-${safeTeamName}-${safeProjectName}.${ext}`

      statusMessage.value = `正在下载: ${filename} (${i + 1}/${total})`

      try {
        const { data, error } = await supabase.storage
          .from('submission-files')
          .download(originalPath)

        if (error) throw error
        
        if (data) {
          folder?.file(filename, data)
        }
      } catch (err) {
        console.error(`Failed to download ${filename}`, err)
        // Add error log to zip? Or just skip
        folder?.file(`${filename}_error.txt`, `Download failed: ${err}`)
      }

      completed++
      progress.value = Math.round((completed / total) * 100)
    }

    statusMessage.value = '正在打包...'
    const content = await zip.generateAsync({ type: "blob" })
    const zipName = `${event.value?.title || '活动'}_作品批量下载_${new Date().toISOString().split('T')[0]}.zip`
    saveAs(content, zipName)
    
    store.setBanner('info', '批量下载完成')
  } catch (err: any) {
    console.error(err)
    store.setBanner('error', '批量下载失败: ' + err.message)
  } finally {
    processing.value = false
    statusMessage.value = ''
  }
}

onMounted(() => {
  loadData()
})
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
        <button class="btn btn--primary" @click="downloadForms" :disabled="registrations.length === 0">
          <Download :size="18" />
          导出 Excel
        </button>
      </div>
      
      <div class="data-preview card">
        <div v-if="loading" class="loading-state">
          <Loader2 class="spin" /> 加载中...
        </div>
        <div v-else-if="registrations.length === 0" class="empty-state">
          暂无报名数据
        </div>
        <div v-else class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>用户</th>
                <th>状态</th>
                <th>报名时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="reg in registrations.slice(0, 5)" :key="reg.id">
                <td>{{ reg.profiles?.username || '未知用户' }}</td>
                <td>{{ reg.status }}</td>
                <td>{{ new Date(reg.created_at).toLocaleDateString() }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="registrations.length > 5" class="table-footer">
            ... 仅展示前 5 条，请下载完整表格查看
          </p>
        </div>
      </div>
    </section>

    <section v-else class="admin-section">
      <div class="section-header">
        <div class="info-block">
          <h3>作品文件批量下载</h3>
          <p class="muted">共 {{ submissions.length }} 个文件作品</p>
        </div>
        <div class="actions-group">
          <button 
            class="btn btn--primary"
            @click="downloadFiles"
            :disabled="selectedSubmissions.length === 0 || processing"
          >
            <Loader2 v-if="processing" class="spin" :size="18" />
            <Download v-else :size="18" />
            {{ processing ? '处理中...' : `下载选中 (${selectedSubmissions.length})` }}
          </button>
        </div>
      </div>

      <div v-if="processing" class="progress-card card">
        <p>{{ statusMessage }}</p>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
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
          <div class="list-header">
            <label class="checkbox-wrapper">
              <input 
                type="checkbox" 
                :checked="isAllSelected"
                :indeterminate="isIndeterminate"
                @change="toggleSelectAll"
              />
              全选
            </label>
            <span>作品信息</span>
            <span>大小/格式</span>
          </div>
          <div class="list-body">
            <div 
              v-for="(sub, index) in submissions" 
              :key="sub.id" 
              class="list-item"
              :class="{ selected: selectedSubmissions.includes(sub.id) }"
            >
              <label class="checkbox-wrapper">
                <input 
                  type="checkbox" 
                  v-model="selectedSubmissions"
                  :value="sub.id"
                />
                <span class="index-badge">#{{ index + 1 }}</span>
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
        </template>
      </div>
    </section>
  </main>
</template>

<style scoped>
.admin-page {
  max-width: 1000px;
  margin: 0 auto;
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
</style>