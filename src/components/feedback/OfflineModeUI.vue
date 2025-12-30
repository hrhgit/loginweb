<template>
  <Transition name="offline-mode" appear>
    <div 
      v-if="shouldShow" 
      :class="offlineClasses"
      class="offline-mode-ui"
    >
      <div class="offline-mode-ui__content">
        <!-- Header -->
        <div class="offline-mode-ui__header">
          <div class="offline-mode-ui__icon">
            <WifiOff :size="24" />
          </div>
          
          <div class="offline-mode-ui__title">
            <h3 class="offline-title">离线模式</h3>
            <p class="offline-subtitle">{{ offlineMessage }}</p>
          </div>
          
          <button 
            v-if="canDismiss"
            @click="handleDismiss"
            class="offline-mode-ui__close"
            aria-label="关闭离线提示"
          >
            <X :size="16" />
          </button>
        </div>
        
        <!-- Feature availability -->
        <div v-if="showFeatures" class="offline-mode-ui__features">
          <div class="feature-section">
            <h4 class="feature-section__title">
              <CheckCircle :size="16" class="feature-section__icon feature-section__icon--available" />
              可用功能
            </h4>
            <ul class="feature-list">
              <li v-for="feature in availableFeatures" :key="feature.id" class="feature-item">
                <component :is="feature.icon" :size="14" class="feature-item__icon" />
                <span class="feature-item__name">{{ feature.name }}</span>
                <span v-if="feature.description" class="feature-item__desc">{{ feature.description }}</span>
              </li>
            </ul>
          </div>
          
          <div v-if="unavailableFeatures.length > 0" class="feature-section">
            <h4 class="feature-section__title">
              <XCircle :size="16" class="feature-section__icon feature-section__icon--unavailable" />
              暂不可用
            </h4>
            <ul class="feature-list">
              <li v-for="feature in unavailableFeatures" :key="feature.id" class="feature-item feature-item--disabled">
                <component :is="feature.icon" :size="14" class="feature-item__icon" />
                <span class="feature-item__name">{{ feature.name }}</span>
                <span v-if="feature.description" class="feature-item__desc">{{ feature.description }}</span>
              </li>
            </ul>
          </div>
        </div>
        
        <!-- Stored data info -->
        <div v-if="showStoredData && storedDataCount > 0" class="offline-mode-ui__stored-data">
          <div class="stored-data-info">
            <Database :size="16" class="stored-data-icon" />
            <span class="stored-data-text">
              本地已保存 {{ storedDataCount }} 项数据，连接恢复后将自动同步
            </span>
          </div>
        </div>
        
        <!-- Actions -->
        <div v-if="showActions" class="offline-mode-ui__actions">
          <button 
            @click="handleCheckConnection"
            class="btn btn--primary btn--compact"
            :disabled="isCheckingConnection"
          >
            <RefreshCw 
              :size="14" 
              :class="{ 'spinning': isCheckingConnection }"
            />
            {{ isCheckingConnection ? '检查中...' : '检查连接' }}
          </button>
          
          <button 
            v-if="canViewCached"
            @click="handleViewCached"
            class="btn btn--ghost btn--compact"
          >
            <Archive :size="14" />
            查看缓存内容
          </button>
          
          <button 
            v-if="canManageData"
            @click="handleManageData"
            class="btn btn--ghost btn--compact"
          >
            <Settings :size="14" />
            管理离线数据
          </button>
        </div>
        
        <!-- Tips -->
        <div v-if="showTips" class="offline-mode-ui__tips">
          <div class="tips-header">
            <Lightbulb :size="14" />
            <span class="tips-title">离线使用提示</span>
          </div>
          <ul class="tips-list">
            <li>您可以继续浏览已加载的内容</li>
            <li>表单数据会自动保存到本地</li>
            <li>连接恢复后将自动同步未提交的数据</li>
            <li v-if="hasServiceWorker">页面已缓存，可离线访问</li>
          </ul>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { 
  WifiOff, 
  X, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Archive, 
  Settings, 
  Database, 
  Lightbulb,
  Eye,
  Edit3,
  Users,
  Upload,
  Search,
  Send,
  Zap,
  Globe
} from 'lucide-vue-next'
import { useOfflineManager } from '../../utils/offlineManager'

interface FeatureInfo {
  id: string
  name: string
  description?: string
  icon: any
}

interface Props {
  // Display options
  variant?: 'banner' | 'modal' | 'sidebar'
  position?: 'top' | 'bottom' | 'center'
  
  // Content options
  showFeatures?: boolean
  showStoredData?: boolean
  showActions?: boolean
  showTips?: boolean
  
  // Behavior
  persistent?: boolean
  canDismiss?: boolean
  canViewCached?: boolean
  canManageData?: boolean
  
  // Override
  forceShow?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'banner',
  position: 'top',
  showFeatures: true,
  showStoredData: true,
  showActions: true,
  showTips: true,
  persistent: false,
  canDismiss: true,
  canViewCached: true,
  canManageData: true,
  forceShow: false
})

const emit = defineEmits<{
  dismiss: []
  checkConnection: []
  viewCached: []
  manageData: []
}>()

// State
const isDismissed = ref(false)
const isCheckingConnection = ref(false)
const storedDataCount = ref(0)

// Offline manager
const { isOffline, getOfflineCapability, getAllStoredForms } = useOfflineManager()

// Computed properties
const shouldShow = computed(() => {
  if (props.forceShow) return true
  if (!isOffline.value) return false
  if (isDismissed.value && !props.persistent) return false
  return true
})

const offlineClasses = computed(() => [
  'offline-mode-ui',
  `offline-mode-ui--${props.variant}`,
  `offline-mode-ui--${props.position}`
])

const offlineMessage = computed(() => {
  return '您当前处于离线状态，部分功能受限'
})

// Feature definitions
const featureDefinitions: Record<string, FeatureInfo> = {
  'view-cached-events': {
    id: 'view-cached-events',
    name: '查看活动',
    description: '浏览已缓存的活动信息',
    icon: Eye
  },
  'view-cached-profile': {
    id: 'view-cached-profile',
    name: '个人资料',
    description: '查看和编辑个人信息',
    icon: Edit3
  },
  'view-cached-teams': {
    id: 'view-cached-teams',
    name: '队伍信息',
    description: '查看已加载的队伍数据',
    icon: Users
  },
  'edit-profile-offline': {
    id: 'edit-profile-offline',
    name: '离线编辑',
    description: '修改将在连接恢复后同步',
    icon: Edit3
  },
  'create-team-offline': {
    id: 'create-team-offline',
    name: '创建队伍',
    description: '离线创建，稍后同步',
    icon: Users
  },
  'submit-forms': {
    id: 'submit-forms',
    name: '提交表单',
    description: '需要网络连接',
    icon: Send
  },
  'upload-files': {
    id: 'upload-files',
    name: '文件上传',
    description: '需要网络连接',
    icon: Upload
  },
  'real-time-updates': {
    id: 'real-time-updates',
    name: '实时更新',
    description: '需要网络连接',
    icon: Zap
  },
  'search-users': {
    id: 'search-users',
    name: '搜索用户',
    description: '需要网络连接',
    icon: Search
  },
  'send-invitations': {
    id: 'send-invitations',
    name: '发送邀请',
    description: '需要网络连接',
    icon: Send
  }
}

const availableFeatures = computed(() => {
  const capability = getOfflineCapability()
  return capability.canAccessFeatures
    .map(featureId => featureDefinitions[featureId])
    .filter(Boolean)
})

const unavailableFeatures = computed(() => {
  const capability = getOfflineCapability()
  return capability.unavailableFeatures
    .map(featureId => featureDefinitions[featureId])
    .filter(Boolean)
})

// Service Worker detection
const hasServiceWorker = computed(() => {
  return 'serviceWorker' in navigator && navigator.serviceWorker.controller
})

// Event handlers
const handleDismiss = () => {
  isDismissed.value = true
  emit('dismiss')
}

const handleCheckConnection = async () => {
  isCheckingConnection.value = true
  emit('checkConnection')
  
  // Simulate connection check
  setTimeout(() => {
    isCheckingConnection.value = false
  }, 2000)
}

const handleViewCached = () => {
  emit('viewCached')
}

const handleManageData = () => {
  emit('manageData')
}

// Load stored data count
const loadStoredDataCount = async () => {
  try {
    const storedForms = await getAllStoredForms()
    storedDataCount.value = storedForms.length
  } catch (error) {
    console.error('Failed to load stored data count:', error)
    storedDataCount.value = 0
  }
}

// Lifecycle
onMounted(() => {
  if (props.showStoredData) {
    loadStoredDataCount()
  }
})
</script>

<style scoped>
.offline-mode-ui {
  font-family: 'Work Sans', sans-serif;
  background: var(--surface-strong);
  border: 1px solid #f59e0b;
  border-radius: 8px;
  box-shadow: var(--shadow);
  overflow: hidden;
}

.offline-mode-ui__content {
  padding: 1.25rem;
}

/* Variants */
.offline-mode-ui--banner {
  max-width: 600px;
}

.offline-mode-ui--modal {
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
}

.offline-mode-ui--sidebar {
  width: 320px;
  height: 100vh;
  border-radius: 0;
  border-right: 1px solid var(--border);
  border-top: none;
  border-bottom: none;
}

/* Positions */
.offline-mode-ui--top {
  position: fixed;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
}

.offline-mode-ui--bottom {
  position: fixed;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
}

.offline-mode-ui--center {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1000;
}

/* Header */
.offline-mode-ui__header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.offline-mode-ui__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #f59e0b;
  margin-top: 0.125rem;
}

.offline-mode-ui__title {
  flex: 1;
  min-width: 0;
}

.offline-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0 0 0.25rem 0;
  line-height: 1.4;
}

.offline-subtitle {
  font-size: 0.875rem;
  color: var(--muted);
  margin: 0;
  line-height: 1.5;
}

.offline-mode-ui__close {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.offline-mode-ui__close:hover {
  color: var(--ink);
  background: var(--accent-soft);
}

/* Features */
.offline-mode-ui__features {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.feature-section {
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}

.feature-section__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0;
  padding: 0.75rem 1rem;
  background: var(--surface-muted);
  border-bottom: 1px solid var(--border);
}

.feature-section__icon--available {
  color: #22c55e;
}

.feature-section__icon--unavailable {
  color: var(--muted);
}

.feature-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
  transition: background-color 0.2s ease;
}

.feature-item:last-child {
  border-bottom: none;
}

.feature-item:hover:not(.feature-item--disabled) {
  background: var(--surface-muted);
}

.feature-item--disabled {
  opacity: 0.6;
}

.feature-item__icon {
  flex-shrink: 0;
  color: var(--accent);
}

.feature-item--disabled .feature-item__icon {
  color: var(--muted);
}

.feature-item__name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--ink);
}

.feature-item__desc {
  font-size: 0.8125rem;
  color: var(--muted);
  margin-left: auto;
}

/* Stored data */
.offline-mode-ui__stored-data {
  margin-bottom: 1.25rem;
  padding: 0.875rem;
  background: var(--surface-muted);
  border-radius: 6px;
}

.stored-data-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.stored-data-icon {
  color: var(--accent);
  flex-shrink: 0;
}

.stored-data-text {
  font-size: 0.8125rem;
  color: var(--ink);
  line-height: 1.4;
}

/* Actions */
.offline-mode-ui__actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Tips */
.offline-mode-ui__tips {
  padding: 0.875rem;
  background: var(--surface-muted);
  border-radius: 6px;
}

.tips-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.tips-header svg {
  color: #f59e0b;
}

.tips-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ink);
}

.tips-list {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 0.8125rem;
  color: var(--muted);
  line-height: 1.5;
}

.tips-list li {
  position: relative;
  padding-left: 1rem;
  margin-bottom: 0.25rem;
}

.tips-list li::before {
  content: '•';
  position: absolute;
  left: 0;
  color: var(--accent);
}

/* Transitions */
.offline-mode-enter-active,
.offline-mode-leave-active {
  transition: all 0.3s ease;
}

.offline-mode-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-100%);
}

.offline-mode-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-100%);
}

.offline-mode-ui--bottom.offline-mode-enter-from {
  transform: translateX(-50%) translateY(100%);
}

.offline-mode-ui--bottom.offline-mode-leave-to {
  transform: translateX(-50%) translateY(100%);
}

.offline-mode-ui--center.offline-mode-enter-from,
.offline-mode-ui--center.offline-mode-leave-to {
  transform: translate(-50%, -50%) scale(0.9);
}

/* Responsive design */
@media (max-width: 640px) {
  .offline-mode-ui--top,
  .offline-mode-ui--bottom,
  .offline-mode-ui--center {
    left: 0.5rem;
    right: 0.5rem;
    transform: none;
    max-width: none;
  }
  
  .offline-mode-ui--top.offline-mode-enter-from {
    transform: translateY(-100%);
  }
  
  .offline-mode-ui--top.offline-mode-leave-to {
    transform: translateY(-100%);
  }
  
  .offline-mode-ui--bottom.offline-mode-enter-from {
    transform: translateY(100%);
  }
  
  .offline-mode-ui--bottom.offline-mode-leave-to {
    transform: translateY(100%);
  }
  
  .offline-mode-ui--center.offline-mode-enter-from,
  .offline-mode-ui--center.offline-mode-leave-to {
    transform: scale(0.9);
  }
  
  .offline-mode-ui__content {
    padding: 1rem;
  }
  
  .offline-mode-ui__actions {
    flex-direction: column;
  }
  
  .offline-mode-ui__actions .btn {
    width: 100%;
    justify-content: center;
  }
  
  .offline-mode-ui--sidebar {
    width: 100%;
    height: 100vh;
    left: 0;
    right: 0;
    top: 0;
    border-radius: 0;
    border: none;
  }
}
</style>