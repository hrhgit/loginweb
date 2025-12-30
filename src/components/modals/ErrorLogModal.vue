<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-shell">
      <div class="modal error-log-modal">
        <header class="modal__header">
          <h2>错误日志</h2>
        </header>

        <div v-if="loading" class="loading-state">
          <p>加载错误日志中...</p>
        </div>

        <div v-else-if="errorRecords.length === 0" class="empty-state">
          <h3>暂无错误记录</h3>
          <p class="muted">系统会自动记录遇到的错误，方便问题反馈</p>
        </div>

        <div v-else class="error-log-content">
          <!-- 操作按钮 -->
          <div class="error-log-actions">
            <button 
              class="btn btn--ghost" 
              @click="copyErrorReport"
              :disabled="copying"
            >
              <Copy :size="16" />
              {{ copying ? '复制中...' : '复制错误报告' }}
            </button>
            <button 
              class="btn btn--danger" 
              @click="clearErrorLog"
              :disabled="clearing"
            >
              <Trash2 :size="16" />
              {{ clearing ? '清除中...' : '清除所有记录' }}
            </button>
          </div>

          <!-- 存储信息 -->
          <div class="storage-info">
            <div class="storage-stats">
              <span class="stat-item">
                <span class="stat-label">记录数量:</span>
                <span class="stat-value">{{ storageInfo.recordCount }}</span>
              </span>
              <span class="stat-item">
                <span class="stat-label">存储使用:</span>
                <span class="stat-value">{{ formatBytes(storageInfo.used) }} / {{ formatBytes(storageInfo.limit) }}</span>
              </span>
            </div>
          </div>

          <!-- 错误记录列表 -->
          <div class="error-records">
            <article 
              v-for="record in errorRecords" 
              :key="record.id || `record-${Math.random()}`"
              class="error-record"
              :class="`error-record--${record.type || 'unknown'}`"
            >
              <div class="error-record__header">
                <div class="error-type-badge" :class="`error-type--${record.type || 'unknown'}`">
                  {{ getErrorTypeLabel(record.type || 'unknown') }}
                </div>
                <time class="error-time">{{ formatDateTime(record.timestamp) }}</time>
              </div>
              
              <div class="error-message">{{ record.message || '未知错误' }}</div>
              
              <div class="error-context" v-if="record.context">
                <span class="context-item">
                  <span class="context-label">操作:</span>
                  <span class="context-value">{{ record.context.operation || '未知' }}</span>
                </span>
                <span class="context-item">
                  <span class="context-label">组件:</span>
                  <span class="context-value">{{ record.context.component || '未知' }}</span>
                </span>
                <span v-if="record.retryCount && record.retryCount > 0" class="context-item">
                  <span class="context-label">重试次数:</span>
                  <span class="context-value">{{ record.retryCount }}</span>
                </span>
              </div>

              <!-- 展开详细信息 -->
              <button 
                v-if="record.id"
                class="error-details-toggle"
                @click="toggleDetails(record.id)"
                :class="{ expanded: expandedRecords.has(record.id) }"
              >
                <ChevronDown :size="16" />
                {{ expandedRecords.has(record.id) ? '收起详情' : '查看详情' }}
              </button>

              <div v-if="record.id && expandedRecords.has(record.id)" class="error-details">
                <div class="detail-section">
                  <h4>技术信息</h4>
                  <pre class="error-raw">{{ JSON.stringify(record.originalError || {}, null, 2) }}</pre>
                </div>
                <div class="detail-section">
                  <h4>环境信息</h4>
                  <div class="env-info">
                    <div class="env-item">
                      <span class="env-label">浏览器:</span>
                      <span class="env-value">{{ record.userAgent || '未知' }}</span>
                    </div>
                    <div class="env-item">
                      <span class="env-label">错误ID:</span>
                      <span class="env-value">{{ record.id || '未知' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>

      <footer class="modal-footer">
        <p class="muted text-sm">
          错误日志仅保存在本地，不会自动上传。复制错误报告可以帮助技术支持快速定位问题。
        </p>
      </footer>
      </div>
      <button class="icon-btn modal-close" type="button" @click="$emit('close')" aria-label="close">
        <X :size="20" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { X, Copy, Trash2, ChevronDown } from 'lucide-vue-next'
import { errorLogManager } from '../../utils/errorLogManager'
import type { ErrorRecord } from '../../utils/errorHandler'
import { ErrorType } from '../../utils/errorHandler'

defineEmits<{
  close: []
}>()

const loading = ref(true)
const copying = ref(false)
const clearing = ref(false)
const errorRecords = ref<ErrorRecord[]>([])
const expandedRecords = ref(new Set<string>())

const storageInfo = computed(() => errorLogManager.getStorageInfo())

const getErrorTypeLabel = (type: ErrorType | string): string => {
  const labels: Record<string, string> = {
    [ErrorType.NETWORK]: '网络错误',
    [ErrorType.PERMISSION]: '权限错误',
    [ErrorType.VALIDATION]: '验证错误',
    [ErrorType.TIMEOUT]: '超时错误',
    [ErrorType.SERVER]: '服务器错误',
    [ErrorType.CLIENT]: '客户端错误',
    [ErrorType.UNKNOWN]: '未知错误'
  }
  return labels[type] || '其他错误'
}

const formatDateTime = (timestamp: Date | string): string => {
  try {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
    if (isNaN(date.getTime())) {
      return '无效时间'
    }
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date)
  } catch (error) {
    console.error('格式化时间失败:', error)
    return '时间格式错误'
  }
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const toggleDetails = (recordId: string) => {
  if (!recordId) return
  
  if (expandedRecords.value.has(recordId)) {
    expandedRecords.value.delete(recordId)
  } else {
    expandedRecords.value.add(recordId)
  }
}

const copyErrorReport = async () => {
  copying.value = true
  try {
    const success = await errorLogManager.copyToClipboard()
    if (success) {
      // 这里可以显示成功提示，但为了简化，我们只在控制台记录
      console.log('错误报告已复制到剪贴板')
    } else {
      console.warn('复制失败，请手动选择文本')
    }
  } catch (error) {
    console.error('复制错误报告失败:', error)
  } finally {
    copying.value = false
  }
}

const clearErrorLog = async () => {
  if (!confirm('确定要清除所有错误记录吗？此操作不可撤销。')) {
    return
  }
  
  clearing.value = true
  try {
    errorLogManager.clearRecords()
    errorRecords.value = []
    expandedRecords.value.clear()
  } catch (error) {
    console.error('清除错误日志失败:', error)
  } finally {
    clearing.value = false
  }
}

const loadErrorRecords = async () => {
  loading.value = true
  try {
    // 先清空现有记录
    errorRecords.value = []
    
    // 获取错误记录，添加更多的错误处理
    let records = []
    try {
      records = errorLogManager.getRecords(50) || []
    } catch (error) {
      console.warn('获取错误记录失败:', error)
      records = []
    }
    
    // 过滤和验证记录，确保每个记录都有必要的属性
    errorRecords.value = records
      .filter(record => {
        // 基本验证
        if (!record || typeof record !== 'object') return false
        if (!record.message || !record.type) return false
        return true
      })
      .map((record, index) => {
        // 确保所有必要的属性都存在
        return {
          id: record.id || `error_${Date.now()}_${index}`,
          timestamp: record.timestamp ? new Date(record.timestamp) : new Date(),
          type: record.type || 'unknown',
          severity: record.severity || 'warning',
          message: record.message || '未知错误',
          originalError: record.originalError || {},
          context: {
            operation: record.context?.operation || '未知',
            component: record.context?.component || '未知',
            ...record.context
          },
          retryCount: record.retryCount || 0,
          userAgent: record.userAgent || navigator.userAgent
        }
      })
      
    console.log('成功加载错误记录:', errorRecords.value.length)
  } catch (error) {
    console.error('加载错误记录失败:', error)
    errorRecords.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  console.log('ErrorLogModal 组件已挂载')
  try {
    loadErrorRecords()
  } catch (error) {
    console.error('ErrorLogModal 初始化失败:', error)
    loading.value = false
  }
})
</script>

<style scoped>
.error-log-modal {
  width: min(800px, 90vw);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--muted);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
}

.empty-state h3 {
  margin: 0 0 8px;
  color: var(--ink);
}

.error-log-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}

.error-log-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.storage-info {
  padding: 12px 16px;
  background: var(--surface-muted);
  border-radius: 8px;
  border: 1px solid var(--border);
}

.storage-stats {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  gap: 8px;
  font-size: 0.9rem;
}

.stat-label {
  color: var(--muted);
}

.stat-value {
  font-weight: 600;
  color: var(--ink);
}

.error-records {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 4px;
  max-height: 400px;
}

.error-record {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  background: white;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.error-record--network {
  border-left: 4px solid #3b82f6;
}

.error-record--permission {
  border-left: 4px solid #ef4444;
}

.error-record--validation {
  border-left: 4px solid #f59e0b;
}

.error-record--timeout {
  border-left: 4px solid #8b5cf6;
}

.error-record--server {
  border-left: 4px solid #dc2626;
}

.error-record--client {
  border-left: 4px solid #ec4899;
}

.error-record--unknown {
  border-left: 4px solid #6b7280;
}

.error-record__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.error-type-badge {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.error-type--network {
  background: #dbeafe;
  color: #1d4ed8;
}

.error-type--permission {
  background: #fee2e2;
  color: #dc2626;
}

.error-type--validation {
  background: #fef3c7;
  color: #d97706;
}

.error-type--timeout {
  background: #ede9fe;
  color: #7c3aed;
}

.error-type--server {
  background: #fecaca;
  color: #b91c1c;
}

.error-type--client {
  background: #fce7f3;
  color: #be185d;
}

.error-type--unknown {
  background: #f3f4f6;
  color: #4b5563;
}

.error-time {
  font-size: 0.8rem;
  color: var(--muted);
}

.error-message {
  font-weight: 500;
  color: var(--ink);
  line-height: 1.4;
}

.error-context {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 0.85rem;
}

.context-item {
  display: flex;
  gap: 4px;
}

.context-label {
  color: var(--muted);
}

.context-value {
  font-weight: 500;
  color: var(--ink);
}

.error-details-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 6px;
  font-size: 0.85rem;
  color: var(--muted);
  cursor: pointer;
  transition: all 0.2s ease;
  align-self: flex-start;
}

.error-details-toggle:hover {
  background: var(--surface-strong);
  color: var(--ink);
}

.error-details-toggle.expanded svg {
  transform: rotate(180deg);
}

.error-details {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: var(--surface-muted);
  border-radius: 8px;
  border: 1px solid var(--border);
}

.detail-section h4 {
  margin: 0 0 8px;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ink);
}

.error-raw {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 12px;
  font-size: 0.8rem;
  line-height: 1.4;
  overflow-x: auto;
  max-height: 200px;
  overflow-y: auto;
}

.env-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.env-item {
  display: flex;
  gap: 8px;
  font-size: 0.85rem;
}

.env-label {
  color: var(--muted);
  min-width: 60px;
}

.env-value {
  font-weight: 500;
  color: var(--ink);
  word-break: break-all;
}

.modal-footer {
  border-top: 1px solid var(--border);
  padding: 16px 24px;
  background: var(--surface-muted);
}

.modal-footer p {
  margin: 0;
  text-align: center;
}
</style>