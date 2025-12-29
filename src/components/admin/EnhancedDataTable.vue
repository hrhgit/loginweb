<template>
  <div class="enhanced-data-table">
    <!-- 表格头部信息 -->
    <div class="table-header">
      <div class="header-info">
        <h4 class="table-title">{{ title }}</h4>
        <p class="table-subtitle">{{ subtitle }}</p>
      </div>
      <div class="header-actions">
        <slot name="actions"></slot>
      </div>
    </div>

    <!-- 表格统计信息 -->
    <div v-if="showStats" class="table-stats">
      <div class="stat-card">
        <div class="stat-icon">
          <Users :size="20" />
        </div>
        <div class="stat-content">
          <span class="stat-number">{{ totalRows }}</span>
          <span class="stat-label">总记录</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">
          <FileText :size="20" />
        </div>
        <div class="stat-content">
          <span class="stat-number">{{ formColumns.length }}</span>
          <span class="stat-label">表单字段</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">
          <CheckCircle :size="20" />
        </div>
        <div class="stat-content">
          <span class="stat-number">{{ completedResponses }}</span>
          <span class="stat-label">完整回答</span>
        </div>
      </div>
    </div>

    <!-- 表格容器 -->
    <div class="table-wrapper">
      <div class="table-scroll-container">
        <table class="enhanced-table">
          <thead class="table-head">
            <tr>
              <th 
                v-for="column in columns" 
                :key="column.key"
                :class="[
                  'table-header-cell',
                  { 
                    'header--standard': column.isStandard,
                    'header--form': !column.isStandard,
                    'header--sortable': column.sortable
                  }
                ]"
                @click="column.sortable && handleSort(column.key)"
              >
                <div class="header-content">
                  <div class="header-main">
                    <span class="header-title">{{ column.title }}</span>
                    <span v-if="!column.isStandard" class="column-type-badge">{{ getQuestionTypeLabel(column.type) }}</span>
                    <span v-if="!column.isStandard && column.required" class="required-indicator">必填</span>
                    <ChevronUp 
                      v-if="column.sortable && sortBy === column.key && sortOrder === 'asc'"
                      :size="14" 
                      class="sort-icon"
                    />
                    <ChevronDown 
                      v-if="column.sortable && sortBy === column.key && sortOrder === 'desc'"
                      :size="14" 
                      class="sort-icon"
                    />
                    <ChevronsUpDown 
                      v-if="column.sortable && sortBy !== column.key"
                      :size="14" 
                      class="sort-icon sort-icon--inactive"
                    />
                  </div>
                </div>
              </th>
            </tr>
          </thead>
          <tbody class="table-body">
            <tr 
              v-for="(row, index) in sortedRows" 
              :key="row.userId"
              :class="[
                'table-row',
                { 'row--even': index % 2 === 0, 'row--odd': index % 2 === 1 }
              ]"
            >
              <td 
                v-for="column in columns" 
                :key="column.key"
                :class="[
                  'table-cell',
                  { 
                    'cell--standard': column.isStandard,
                    'cell--form': !column.isStandard
                  }
                ]"
              >
                <div class="cell-content">
                  <!-- 标准列内容 -->
                  <template v-if="column.isStandard">
                    <div v-if="column.key === 'username'" class="user-info">
                      <span class="user-name">{{ row.username }}</span>
                    </div>
                    <div v-else-if="column.key === 'status'" class="status-container">
                      <span 
                        class="status-badge" 
                        :class="`status-badge--${row.status === '已报名' ? 'success' : 'pending'}`"
                      >
                        <div class="status-dot"></div>
                        {{ row.status }}
                      </span>
                    </div>
                    <div v-else-if="column.key === 'createdAt'" class="date-info">
                      <Calendar :size="14" />
                      <span>{{ row.createdAt }}</span>
                    </div>
                    <span v-else>{{ row[column.key as keyof typeof row] }}</span>
                  </template>
                  
                  <!-- 表单回答内容 -->
                  <template v-else>
                    <div class="response-content">
                      <div v-if="row.responses[column.key]" class="response-value">
                        <div class="response-text">{{ row.responses[column.key] }}</div>
                      </div>
                      <div v-else class="response-empty">
                        <Minus :size="14" />
                        <span>未填写</span>
                      </div>
                    </div>
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 表格底部信息 -->
    <div class="table-footer">
      <div class="footer-info">
        <span class="record-count">
          显示 {{ Math.min(rows.length, displayLimit) }} / {{ totalRows }} 条记录
        </span>
      </div>
      <div class="footer-actions">
        <slot name="footer-actions"></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { 
  Users, 
  FileText, 
  CheckCircle, 
  ChevronUp, 
  ChevronDown, 
  ChevronsUpDown,
  User,
  Calendar,
  Minus
} from 'lucide-vue-next'
import { getQuestionTypeLabel } from '../../utils/formResponseParser'

interface TableColumn {
  key: string
  title: string
  type: string
  isStandard: boolean
  sortable?: boolean
  required?: boolean
}

interface TableRow {
  userId: string
  username: string
  status: string
  createdAt: string
  responses: Record<string, string>
}

interface Props {
  title: string
  subtitle?: string
  columns: TableColumn[]
  rows: TableRow[]
  displayLimit?: number
  showStats?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  subtitle: '',
  displayLimit: 10,
  showStats: true
})

// 排序状态
const sortBy = ref<string>('')
const sortOrder = ref<'asc' | 'desc'>('asc')

// 计算属性
const totalRows = computed(() => props.rows.length)

const formColumns = computed(() => 
  props.columns.filter(col => !col.isStandard)
)

const completedResponses = computed(() => {
  return props.rows.filter(row => {
    const formQuestionKeys = formColumns.value.map(col => col.key)
    return formQuestionKeys.some(key => row.responses[key])
  }).length
})

const sortedRows = computed(() => {
  let sorted = [...props.rows]
  
  if (sortBy.value) {
    sorted.sort((a, b) => {
      let aValue: any
      let bValue: any
      
      if (props.columns.find(col => col.key === sortBy.value)?.isStandard) {
        aValue = a[sortBy.value as keyof typeof a]
        bValue = b[sortBy.value as keyof typeof b]
      } else {
        aValue = a.responses[sortBy.value] || ''
        bValue = b.responses[sortBy.value] || ''
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder.value === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }
      
      return sortOrder.value === 'asc' ? aValue - bValue : bValue - aValue
    })
  }
  
  return sorted.slice(0, props.displayLimit)
})

// 方法
const handleSort = (columnKey: string) => {
  if (sortBy.value === columnKey) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = columnKey
    sortOrder.value = 'asc'
  }
}
</script>

<style scoped>
.enhanced-data-table {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  background: var(--surface);
  border-radius: 12px;
  border: 1px solid var(--border);
  overflow: hidden;
}

/* 表格头部 */
.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  background: linear-gradient(135deg, var(--surface) 0%, var(--surface-muted) 100%);
  border-bottom: 1px solid var(--border);
}

.table-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--ink);
  font-family: 'Sora', sans-serif;
}

.table-subtitle {
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
  color: var(--muted);
}

/* 统计卡片 */
.table-stats {
  display: flex;
  gap: 1rem;
  padding: 0 1.5rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--surface-muted);
  border-radius: 8px;
  border: 1px solid var(--border);
  flex: 1;
  transition: all 0.18s ease;
}

.stat-card:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: 8px;
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-number {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--ink);
  font-family: 'Sora', sans-serif;
}

.stat-label {
  font-size: 0.85rem;
  color: var(--muted);
  font-weight: 500;
}

/* 表格容器 */
.table-wrapper {
  margin: 0 1.5rem;
}

.table-scroll-container {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
}

.enhanced-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 1rem;
  min-width: 800px;
}

/* 表头样式 */
.table-head {
  background: linear-gradient(135deg, var(--surface-muted) 0%, var(--surface) 100%);
}

.table-header-cell {
  padding: 1rem 0.75rem;
  text-align: left;
  border-bottom: 2px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.header--standard {
  background: linear-gradient(135deg, var(--accent-soft) 0%, rgba(31, 111, 109, 0.05) 100%);
}

.header--form {
  background: var(--surface-muted);
}

.header--sortable {
  cursor: pointer;
  transition: background 0.18s ease;
}

.header--sortable:hover {
  background: var(--surface);
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 120px;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.header-title {
  font-weight: 600;
  color: var(--ink);
  line-height: 1.3;
  font-size: 0.95rem;
}

.sort-icon {
  color: var(--accent);
  transition: all 0.18s ease;
  margin-left: auto;
}

.sort-icon--inactive {
  color: var(--muted);
  opacity: 0.5;
}

.column-type-badge {
  font-size: 0.7rem;
  color: var(--muted);
  background: var(--surface);
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  border: 1px solid var(--border);
  font-weight: 500;
  white-space: nowrap;
}

.required-indicator {
  font-size: 0.65rem;
  color: var(--danger);
  background: rgba(182, 45, 28, 0.1);
  padding: 0.1rem 0.3rem;
  border-radius: 2px;
  font-weight: 600;
  white-space: nowrap;
}

/* 表格行样式 */
.table-row {
  transition: all 0.18s ease;
}

.table-row:hover {
  background: var(--surface-muted);
}

.row--even {
  background: rgba(255, 255, 255, 0.3);
}

.table-cell {
  padding: 1rem 0.75rem;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}

.cell--standard {
  background: rgba(31, 111, 109, 0.02);
}

.cell-content {
  display: flex;
  align-items: center;
  min-height: 1.5rem;
  justify-content: flex-start;
}

/* 用户信息样式 */
.user-info {
  display: flex;
  align-items: center;
}

.user-name {
  font-weight: 500;
  color: var(--ink);
}

/* 状态样式 */
.status-container {
  display: flex;
  align-items: center;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  border: 1px solid;
}

.status-badge--success {
  background: rgba(34, 197, 94, 0.1);
  color: rgb(34, 197, 94);
  border-color: rgba(34, 197, 94, 0.3);
}

.status-badge--pending {
  background: rgba(251, 191, 36, 0.1);
  color: rgb(251, 191, 36);
  border-color: rgba(251, 191, 36, 0.3);
}

.status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

/* 日期信息样式 */
.date-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--muted);
}

/* 回答内容样式 */
.response-content {
  width: 100%;
  max-width: 250px;
}

.response-value {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.response-text {
  color: var(--ink);
  line-height: 1.4;
  word-break: break-word;
}

.response-empty {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--muted);
  font-style: italic;
  font-size: 0.85rem;
}

/* 表格底部 */
.table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  background: var(--surface-muted);
  border-top: 1px solid var(--border);
}

.record-count {
  font-size: 0.85rem;
  color: var(--muted);
  font-weight: 500;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .table-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .table-stats {
    flex-direction: column;
  }
  
  .enhanced-table {
    min-width: 600px;
    font-size: 0.8rem;
  }
  
  .table-header-cell,
  .table-cell {
    padding: 0.75rem 0.5rem;
  }
  
  .header-content {
    min-width: 100px;
  }
  
  .response-content {
    max-width: 150px;
  }
  
  .table-footer {
    flex-direction: column;
    gap: 0.75rem;
    text-align: center;
  }
}
</style>