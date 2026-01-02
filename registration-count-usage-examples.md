# 活动报名人数功能使用示例

## 1. 在活动卡片中显示报名人数

```vue
<template>
  <EventCard
    :event="event"
    :time-label="formatDateRange(event.start_time, event.end_time)"
    :summary="getEventSummaryText(event.description)"
  >
    <template #meta>
      <span class="meta-item"><MapPin :size="16" /> {{ locationLabel(event.location) }}</span>
      <span class="meta-item"><Users :size="16" /> {{ event.registration_count || 0 }} 人已报名</span>
    </template>
  </EventCard>
</template>

<script setup lang="ts">
import { usePublicEventsWithRegistrationCount } from '@/composables/useEventsWithRegistrationCount'

// 获取带报名人数的活动列表
const eventsQuery = usePublicEventsWithRegistrationCount()
const events = computed(() => eventsQuery.data.value || [])
</script>
```

## 2. 获取单个活动的报名人数

```vue
<template>
  <div class="event-stats">
    <div class="stat-item">
      <UserPlus :size="16" />
      <span>已报名人数</span>
      <strong>{{ registrationCount || 0 }} 人</strong>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEventRegistrationCount } from '@/composables/useEventsWithRegistrationCount'

const props = defineProps<{ eventId: string }>()

// 获取特定活动的报名人数
const countQuery = useEventRegistrationCount(props.eventId)
const registrationCount = computed(() => countQuery.data.value)
</script>
```

## 3. 在管理后台显示报名统计

```vue
<template>
  <div class="admin-dashboard">
    <h2>活动管理</h2>
    
    <div class="events-grid">
      <div v-for="event in myEvents" :key="event.id" class="event-card">
        <h3>{{ event.title }}</h3>
        <div class="event-stats">
          <div class="stat">
            <span class="label">报名人数</span>
            <span class="value">{{ event.registration_count }} 人</span>
          </div>
          <div class="stat">
            <span class="label">状态</span>
            <span class="value">{{ event.status }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMyEventsWithRegistrationCount } from '@/composables/useEventsWithRegistrationCount'
import { useAppStore } from '@/store/appStore'

const store = useAppStore()

// 获取用户创建的活动及报名人数
const myEventsQuery = useMyEventsWithRegistrationCount(store.user?.id || '')
const myEvents = computed(() => myEventsQuery.data.value || [])
</script>
```

## 4. 实时更新报名人数

```vue
<template>
  <div class="registration-section">
    <div class="current-count">
      <UserPlus :size="20" />
      <span>当前已有 {{ registrationCount }} 人报名</span>
    </div>
    
    <button 
      @click="handleRegister" 
      :disabled="isRegistering"
      class="btn btn--primary"
    >
      {{ isRegistering ? '报名中...' : '立即报名' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useEventRegistrationCount } from '@/composables/useEventsWithRegistrationCount'
import { useQueryClient } from '@tanstack/vue-query'
import { queryKeys } from '@/lib/vueQuery'

const props = defineProps<{ eventId: string }>()
const queryClient = useQueryClient()

// 获取报名人数
const countQuery = useEventRegistrationCount(props.eventId)
const registrationCount = computed(() => countQuery.data.value || 0)

const isRegistering = ref(false)

const handleRegister = async () => {
  try {
    isRegistering.value = true
    
    // 执行报名操作
    await submitRegistration(props.eventId)
    
    // 手动刷新报名人数
    await countQuery.refetch()
    
    // 或者清除缓存让其自动重新获取
    queryClient.invalidateQueries({
      queryKey: queryKeys.registrations.count(props.eventId)
    })
    
  } catch (error) {
    console.error('报名失败:', error)
  } finally {
    isRegistering.value = false
  }
}
</script>
```

## 5. 批量操作后更新缓存

```typescript
// 在报名相关的 mutation 中
export function useSubmitRegistration() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (params: { eventId: string; formData: any }) => {
      // 提交报名
      return await submitRegistrationAPI(params)
    },
    onSuccess: (data, variables) => {
      // 清除相关缓存，触发重新获取
      queryClient.invalidateQueries({
        queryKey: queryKeys.registrations.count(variables.eventId)
      })
      
      // 清除活动列表缓存（包含报名人数）
      queryClient.invalidateQueries({
        queryKey: ['events', 'public', 'with-registration-count']
      })
      
      // 显示成功消息
      store.setBanner('info', '报名成功！')
    }
  })
}
```

## 6. 错误处理和加载状态

```vue
<template>
  <div class="registration-count-display">
    <!-- 加载状态 -->
    <div v-if="countQuery.isLoading.value" class="loading">
      <div class="skeleton-text"></div>
    </div>
    
    <!-- 错误状态 -->
    <div v-else-if="countQuery.error.value" class="error">
      <span>加载失败</span>
      <button @click="countQuery.refetch()" class="btn btn--ghost btn--sm">
        重试
      </button>
    </div>
    
    <!-- 正常显示 -->
    <div v-else class="count-display">
      <UserPlus :size="16" />
      <span>{{ registrationCount }} 人已报名</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEventRegistrationCount } from '@/composables/useEventsWithRegistrationCount'

const props = defineProps<{ eventId: string }>()

const countQuery = useEventRegistrationCount(props.eventId)
const registrationCount = computed(() => countQuery.data.value || 0)
</script>
```

## 7. 性能优化：条件查询

```vue
<script setup lang="ts">
import { useEventRegistrationCount } from '@/composables/useEventsWithRegistrationCount'

const props = defineProps<{ 
  eventId: string
  showCount?: boolean 
}>()

// 只在需要显示时才查询报名人数
const countQuery = useEventRegistrationCount(
  computed(() => props.showCount ? props.eventId : '')
)

const registrationCount = computed(() => 
  props.showCount ? (countQuery.data.value || 0) : undefined
)
</script>
```

## 8. 自定义刷新逻辑

```vue
<script setup lang="ts">
import { useEventRegistrationCount } from '@/composables/useEventsWithRegistrationCount'

const props = defineProps<{ eventId: string }>()

const countQuery = useEventRegistrationCount(props.eventId)

// 手动刷新
const refreshCount = async () => {
  try {
    await countQuery.refetch()
    console.log('报名人数已更新')
  } catch (error) {
    console.error('刷新失败:', error)
  }
}

// 定时刷新（可选）
const startAutoRefresh = () => {
  const interval = setInterval(() => {
    if (document.visibilityState === 'visible') {
      refreshCount()
    }
  }, 60000) // 每分钟刷新一次
  
  onUnmounted(() => {
    clearInterval(interval)
  })
}
</script>
```

这些示例展示了如何在不同场景下使用活动报名人数功能，包括基本显示、实时更新、错误处理和性能优化等方面。