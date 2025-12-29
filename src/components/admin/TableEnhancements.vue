<template>
  <div class="table-enhancements">
    <!-- 加载骨架屏 -->
    <div v-if="loading" class="skeleton-table">
      <div class="skeleton-header">
        <div class="skeleton-title"></div>
        <div class="skeleton-subtitle"></div>
      </div>
      <div class="skeleton-stats">
        <div v-for="i in 3" :key="i" class="skeleton-stat"></div>
      </div>
      <div class="skeleton-table-content">
        <div class="skeleton-table-header">
          <div v-for="i in 5" :key="i" class="skeleton-th"></div>
        </div>
        <div v-for="i in 5" :key="i" class="skeleton-row">
          <div v-for="j in 5" :key="j" class="skeleton-td"></div>
        </div>
      </div>
    </div>

    <!-- 空状态插画 -->
    <div v-else-if="isEmpty" class="empty-state-enhanced">
      <div class="empty-illustration">
        <div class="empty-icon">
          <FileText :size="48" />
        </div>
        <div class="empty-circles">
          <div class="circle circle-1"></div>
          <div class="circle circle-2"></div>
          <div class="circle circle-3"></div>
        </div>
      </div>
      <div class="empty-content">
        <h3>暂无报名数据</h3>
        <p>还没有用户报名参加此活动，数据将在有用户报名后显示。</p>
        <button class="btn btn--ghost" @click="$emit('refresh')">
          <RotateCcw :size="16" />
          刷新数据
        </button>
      </div>
    </div>

    <!-- 数据洞察卡片 -->
    <div v-else class="data-insights">
      <div class="insight-card">
        <div class="insight-header">
          <TrendingUp :size="20" />
          <span>数据洞察</span>
        </div>
        <div class="insight-content">
          <div class="insight-item">
            <span class="insight-label">报名完成率</span>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: `${completionRate}%` }"></div>
            </div>
            <span class="insight-value">{{ completionRate }}%</span>
          </div>
          <div class="insight-item">
            <span class="insight-label">平均回答字段</span>
            <span class="insight-value">{{ averageFields }} 个</span>
          </div>
          <div class="insight-item">
            <span class="insight-label">最活跃时段</span>
            <span class="insight-value">{{ peakHour }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FileText, RotateCcw, TrendingUp } from 'lucide-vue-next'

interface Props {
  loading?: boolean
  isEmpty?: boolean
  totalRegistrations?: number
  completedRegistrations?: number
  averageResponseFields?: number
  registrationTimes?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  isEmpty: false,
  totalRegistrations: 0,
  completedRegistrations: 0,
  averageResponseFields: 0,
  registrationTimes: () => []
})

defineEmits<{
  refresh: []
}>()

const completionRate = computed(() => {
  if (props.totalRegistrations === 0) return 0
  return Math.round((props.completedRegistrations / props.totalRegistrations) * 100)
})

const averageFields = computed(() => {
  return Math.round(props.averageResponseFields * 10) / 10
})

const peakHour = computed(() => {
  if (props.registrationTimes.length === 0) return '暂无数据'
  
  // 简单的时段分析
  const hours = props.registrationTimes.map(time => new Date(time).getHours())
  const hourCounts = hours.reduce((acc, hour) => {
    acc[hour] = (acc[hour] || 0) + 1
    return acc
  }, {} as Record<number, number>)
  
  const peakHourNum = Object.entries(hourCounts)
    .sort(([,a], [,b]) => b - a)[0]?.[0]
  
  if (!peakHourNum) return '暂无数据'
  
  const hour = parseInt(peakHourNum)
  if (hour >= 6 && hour < 12) return '上午'
  if (hour >= 12 && hour < 18) return '下午'
  if (hour >= 18 && hour < 22) return '晚上'
  return '深夜'
})
</script>

<style scoped>
.table-enhancements {
  width: 100%;
}

/* 骨架屏样式 */
.skeleton-table {
  padding: 1.5rem;
  background: var(--surface);
  border-radius: 12px;
  border: 1px solid var(--border);
}

.skeleton-header {
  margin-bottom: 1.5rem;
}

.skeleton-title {
  width: 200px;
  height: 24px;
  background: linear-gradient(90deg, var(--surface-muted) 25%, var(--surface) 50%, var(--surface-muted) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.skeleton-subtitle {
  width: 300px;
  height: 16px;
  background: linear-gradient(90deg, var(--surface-muted) 25%, var(--surface) 50%, var(--surface-muted) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

.skeleton-stats {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.skeleton-stat {
  flex: 1;
  height: 80px;
  background: linear-gradient(90deg, var(--surface-muted) 25%, var(--surface) 50%, var(--surface-muted) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 8px;
}

.skeleton-table-content {
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.skeleton-table-header {
  display: flex;
  background: var(--surface-muted);
  padding: 1rem;
  gap: 1rem;
}

.skeleton-th {
  flex: 1;
  height: 20px;
  background: linear-gradient(90deg, var(--surface) 25%, var(--surface-muted) 50%, var(--surface) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

.skeleton-row {
  display: flex;
  padding: 1rem;
  gap: 1rem;
  border-bottom: 1px solid var(--border);
}

.skeleton-td {
  flex: 1;
  height: 16px;
  background: linear-gradient(90deg, var(--surface-muted) 25%, var(--surface) 50%, var(--surface-muted) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

/* 空状态样式 */
.empty-state-enhanced {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
  background: var(--surface);
  border-radius: 12px;
  border: 1px solid var(--border);
}

.empty-illustration {
  position: relative;
  margin-bottom: 2rem;
}

.empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: 50%;
  position: relative;
  z-index: 2;
}

.empty-circles {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.circle {
  position: absolute;
  border: 2px solid var(--accent-soft);
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.circle-1 {
  width: 100px;
  height: 100px;
  top: -50px;
  left: -50px;
  animation-delay: 0s;
}

.circle-2 {
  width: 120px;
  height: 120px;
  top: -60px;
  left: -60px;
  animation-delay: 0.5s;
}

.circle-3 {
  width: 140px;
  height: 140px;
  top: -70px;
  left: -70px;
  animation-delay: 1s;
}

@keyframes pulse {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.3;
    transform: scale(1.1);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.empty-content h3 {
  margin: 0 0 0.5rem;
  font-size: 1.25rem;
  color: var(--ink);
  font-family: 'Sora', sans-serif;
}

.empty-content p {
  margin: 0 0 1.5rem;
  color: var(--muted);
  max-width: 400px;
}

/* 数据洞察样式 */
.data-insights {
  margin-bottom: 1.5rem;
}

.insight-card {
  background: linear-gradient(135deg, var(--accent-soft) 0%, rgba(31, 111, 109, 0.05) 100%);
  border: 1px solid rgba(31, 111, 109, 0.2);
  border-radius: 12px;
  padding: 1.5rem;
  transition: all 0.18s ease;
}

.insight-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.insight-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  color: var(--accent);
  font-weight: 600;
}

.insight-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.insight-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.insight-label {
  font-size: 0.85rem;
  color: var(--muted);
  font-weight: 500;
}

.insight-value {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--ink);
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: var(--surface-muted);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent) 0%, var(--accent-2) 100%);
  border-radius: 3px;
  transition: width 0.8s ease;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .skeleton-stats {
    flex-direction: column;
  }
  
  .skeleton-table-header,
  .skeleton-row {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .empty-state-enhanced {
    padding: 3rem 1rem;
  }
  
  .insight-content {
    grid-template-columns: 1fr;
  }
}
</style>