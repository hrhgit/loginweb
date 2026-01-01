<template>
  <button
    :class="[
      'btn btn--ghost btn--icon',
      { 'btn--loading': isRefreshing }
    ]"
    :disabled="isRefreshing"
    @click="handleRefresh"
    :title="title"
  >
    <RefreshCw 
      :size="16" 
      :class="{ 'animate-spin': isRefreshing }"
    />
    <span v-if="showLabel" class="ml-2">{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import { useAuthRefresh } from '../../composables/useAuthRefresh'
import { useAppStore } from '../../store/appStore'

interface Props {
  /** 刷新类型 */
  type?: 'all' | 'event'
  /** 活动ID（当type为'event'时需要） */
  eventId?: string
  /** 是否显示文字标签 */
  showLabel?: boolean
  /** 自定义标签文字 */
  customLabel?: string
  /** 自定义提示文字 */
  customTitle?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'all',
  showLabel: false,
  customLabel: '',
  customTitle: ''
})

const store = useAppStore()
const { refreshContentAfterLogin, refreshEventContent, forceRefreshAll } = useAuthRefresh()

const isRefreshing = ref(false)

const label = computed(() => {
  if (props.customLabel) return props.customLabel
  
  switch (props.type) {
    case 'event':
      return '刷新活动'
    case 'all':
    default:
      return '刷新内容'
  }
})

const title = computed(() => {
  if (props.customTitle) return props.customTitle
  
  switch (props.type) {
    case 'event':
      return '刷新当前活动的最新数据'
    case 'all':
    default:
      return '刷新所有内容，获取最新数据'
  }
})

const handleRefresh = async () => {
  if (isRefreshing.value) return
  
  isRefreshing.value = true
  
  try {
    switch (props.type) {
      case 'event':
        if (props.eventId) {
          await refreshEventContent(props.eventId)
        } else {
          console.warn('RefreshButton: eventId is required when type is "event"')
          store.setBanner('error', '刷新失败：缺少活动ID')
        }
        break
        
      case 'all':
      default:
        if (store.user) {
          await refreshContentAfterLogin()
        } else {
          await forceRefreshAll()
        }
        break
    }
  } catch (error) {
    console.error('RefreshButton: Refresh failed:', error)
    store.setBanner('error', '刷新失败，请稍后重试')
  } finally {
    isRefreshing.value = false
  }
}
</script>

<style scoped>
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.btn--loading {
  opacity: 0.7;
  cursor: not-allowed;
}

.ml-2 {
  margin-left: 0.5rem;
}
</style>
</template>