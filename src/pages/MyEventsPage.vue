<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useMyEventsWithRegistrationCount } from '../composables/useEventsWithRegistrationCount'
import { Settings, Edit, Undo2, UserPlus, Plus } from 'lucide-vue-next'
import { useAppStore } from '../store/appStore'
import { supabase } from '../lib/supabase'
import EventCard from '../components/events/EventCard.vue'
import UserSearchModal from '../components/modals/UserSearchModal.vue'
import {
  teamSizeLabel,
  formatDateRange,
  locationLabel,
} from '../utils/eventFormat'
import { getEventSummaryText } from '../utils/eventDetails'

const store = useAppStore()
const router = useRouter()
const eventSummary = (description: string | null) => getEventSummaryText(description)

// Use Vue Query for user's events data with registration counts
const myEventsQuery = useMyEventsWithRegistrationCount(store.user?.id || '')
const myEvents = computed(() => myEventsQuery.data.value || [])
const canManage = computed(() => store.isAdmin)
const revertBusyId = ref<string | null>(null)

// Judge invitation modal state
const inviteJudgeModalOpen = ref(false)
const selectedEventId = ref<string | null>(null)

// 添加初始化状态跟踪
const isInitializing = ref(true)

// 防止闪烁的加载状态管理
const shouldShowLoading = computed(() => {
  // 如果已经有数据，即使在加载中也不显示加载状态（避免闪烁）
  if (myEvents.value.length > 0) return false
  
  // 如果数据已加载完成且没有数据，不显示加载状态（显示空状态）
  if (!myEventsQuery.isLoading.value && myEvents.value.length === 0) return false
  
  // 只有在真正加载中且没有数据时才显示加载状态
  return myEventsQuery.isLoading.value || isInitializing.value
})

onMounted(async () => {
  // 确保 store 已经初始化
  await store.init()
  
  isInitializing.value = false
})

// 暂时移除动态报名人数查询，避免 Vue Query 警告
// 在我的活动页面，管理员可以点击进入后台管理查看详细的报名信息

// 监听用户状态变化，如果用户登录状态发生变化也更新初始化状态
watch(() => store.user, (newUser, oldUser) => {
  console.log('👤 [MyEventsPage] User changed:', {
    from: oldUser?.id || 'No user',
    to: newUser?.id || 'No user'
  })
  
  if (isInitializing.value) {
    isInitializing.value = false
  }
  
  // 用户状态变化后检查查询状态
  setTimeout(() => {
    logQueryStatus()
  }, 100)
}, { immediate: true })

// 监听查询数据变化
watch(() => myEvents.value, (events) => {
  if (events.length > 0) {
    console.log(`📊 [MyEventsPage] Loaded ${events.length} events`)
  }
})

// 监听查询错误
watch(() => myEventsQuery.error.value, (error) => {
  if (error) {
    console.error('❌ [MyEventsPage] Query error:', error)
  }
})

const shouldIgnoreCardNav = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null
  if (!target) return false
  return Boolean(target.closest('a,button,input,textarea,select,label'))
}

const handleCardDblClick = (event: MouseEvent, eventId: string) => {
  if (shouldIgnoreCardNav(event)) return
  void router.push(`/events/${eventId}`)
}

const handleRevertToDraft = async (event: { id: string; status: string | null }) => {
  if (event.status !== 'published') return
  const confirmed = window.confirm('确定要将该活动退回草稿吗？退回后将从公开列表隐藏')
  if (!confirmed) return
  revertBusyId.value = event.id
  store.clearBanners()
  const { error } = await store.updateEventStatus(event.id, 'draft')
  if (error) {
    store.setBanner('error', error)
  } else {
    store.setBanner('info', '已退回草稿')
  }
  revertBusyId.value = null
}

const handleInviteJudge = (eventId: string) => {
  selectedEventId.value = eventId
  inviteJudgeModalOpen.value = true
}

const handleJudgeInvited = (_userId: string) => {
  // The modal will handle the success message and close itself
  // We could refresh judge data here if needed
}

const handleCloseInviteModal = () => {
  inviteJudgeModalOpen.value = false
  selectedEventId.value = null
}

const handleAdminClick = (event: any) => {
  console.log('🔗 [MyEventsPage] Navigating to admin with event data:', event.id)
  // 通过路由状态传递活动数据，避免重新查询
  router.push({
    path: `/events/${event.id}/admin`,
    state: { event }
  })
}

const handleEditClick = (event: any) => {
  console.log('✏️ [MyEventsPage] Navigating to edit with event data:', event.id)
  // 通过路由状态传递活动数据，避免重新查询
  router.push({
    path: `/events/${event.id}/edit`,
    state: { event }
  })
}
</script>

<template>
  <main class="main">
    <section class="page-head">
      <div>
        <h1>我发起的活动</h1>
        <p class="muted">管理你创建的 Game Jam 活动和草稿</p>
      </div>
      <div class="page-head__actions">
        <button class="btn btn--ghost" type="button" @click="myEventsQuery.refetch()" :disabled="myEventsQuery.isLoading.value">
          {{ myEventsQuery.isLoading.value ? '刷新中...' : '刷新' }}
        </button>
        <button v-if="store.isAdmin" class="btn btn--primary btn--icon-text" type="button" @click="store.openCreateModal">
          <Plus :size="16" />
          发起活动
        </button>
      </div>
    </section>

    <nav v-if="store.isAdmin" class="page-tabs">
      <RouterLink class="page-tab" to="/events">全部活动</RouterLink>
      <RouterLink class="page-tab" to="/events/mine">我发起的活动</RouterLink>
    </nav>


    <section v-if="shouldShowLoading" class="skeleton-grid" aria-label="loading">
      <div v-for="n in 6" :key="n" class="skeleton-card"></div>
    </section>

    <template v-else>
      <section v-if="!store.isAuthed" class="empty-state">
        <h2>请先登录</h2>
        <p class="muted">登录后才能查看你发起的活动</p>
        <div class="empty-state__actions">
          <button class="btn btn--primary" type="button" @click="store.openAuth('sign_in')">登录</button>
        </div>
      </section>

      <section v-else-if="!canManage" class="empty-state">
        <h2>暂无权限查看</h2>
        <p class="muted">仅管理员可查看自己发起的活动与草稿</p>
        <div class="empty-state__actions">
          <RouterLink class="btn btn--ghost" to="/events">返回活动页</RouterLink>
        </div>
      </section>

      <section v-else-if="myEvents.length === 0" class="empty-state">
        <h2>还没有发起过活动</h2>
        <p class="muted">创建一个草稿活动，开始编辑详细页面</p>
        <div class="empty-state__actions">
          <button class="btn btn--primary" type="button" @click="store.openCreateModal">发起活动</button>
        </div>
      </section>

      <section v-else class="activity-grid" aria-label="events">
        <EventCard
          v-for="event in myEvents"
          :key="event.id"
          :event="event"
          :time-label="formatDateRange(event.start_time, event.end_time)"
          :summary="eventSummary(event.description)"
          @card-dblclick="handleCardDblClick($event, event.id)"
        >
          <template #badges>
            <span v-if="store.myRegistrationByEventId[event.id]" class="pill-badge pill-badge--success">
              已报名
            </span>
          </template>
          <template #meta>
            <span class="meta-item">地点：{{ locationLabel(event.location) }}</span>
            <span class="meta-item">已报名：{{ event.registration_count || 0 }} 人</span>
          </template>
          <template #actions>
            <template v-if="store.isDemoEvent(event)">
              <button class="btn btn--ghost" type="button" disabled>仅展示</button>
            </template>
            <button v-else-if="event.status === 'draft'" class="btn btn--ghost btn--icon-text" @click="handleEditClick(event)">
              <Edit :size="16" />
              编辑页面
            </button>
            <template v-else-if="event.status === 'published'">
              <button
                class="btn btn--ghost btn--icon-text"
                type="button"
                @click="handleInviteJudge(event.id)"
              >
                <UserPlus :size="16" />
                邀请评委
              </button>
              <button
                class="btn btn--ghost btn--icon-text"
                type="button"
                @click="handleAdminClick(event)"
              >
                <Settings :size="16" />
                后台管理
              </button>
              <button class="btn btn--success btn--icon-text" @click="handleEditClick(event)">
                <Edit :size="16" />
                编辑页面
              </button>
              <button
                class="btn btn--danger btn--icon-text"
                type="button"
                :disabled="revertBusyId === event.id"
                @click="handleRevertToDraft(event)"
              >
                <Undo2 :size="16" />
                {{ revertBusyId === event.id ? '退回中...' : '退回草稿' }}
              </button>
            </template>
          </template>
        </EventCard>
      </section>
    </template>

    <!-- Judge Invitation Modal -->
    <UserSearchModal
      :event-id="selectedEventId || ''"
      :is-open="inviteJudgeModalOpen && !!selectedEventId"
      @close="handleCloseInviteModal"
      @judge-invited="handleJudgeInvited"
    />

  </main>
</template>
