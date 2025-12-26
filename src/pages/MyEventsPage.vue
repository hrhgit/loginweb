<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useEventsReady } from '../composables/useEventsReady'
import { useAppStore } from '../store/appStore'
import EventCard from '../components/events/EventCard.vue'
import {
  teamSizeLabel,
  formatDateRange,
  locationLabel,
} from '../utils/eventFormat'
import { getEventSummaryText } from '../utils/eventDetails'

const store = useAppStore()
const router = useRouter()
const eventSummary = (description: string | null) => getEventSummaryText(description)

const myEvents = computed(() => store.myEvents)
const canManage = computed(() => store.isAdmin)
const revertBusyId = ref<string | null>(null)

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
  const confirmed = window.confirm('确定要将该活动退回草稿吗？退回后将从公开列表隐藏。')
  if (!confirmed) return
  revertBusyId.value = event.id
  store.clearBanners()
  const { error } = await store.updateEventStatus(event.id, 'draft')
  if (error) {
    store.setBanner('error', error)
  } else {
    store.setBanner('info', '已退回草稿。')
  }
  revertBusyId.value = null
}

useEventsReady(store)
</script>

<template>
  <main class="main">
    <section class="page-head">
      <div>
        <h1>我发起的活动</h1>
        <p class="muted">管理你创建的 Game Jam 活动和草稿。</p>
      </div>
      <div class="page-head__actions">
        <button class="btn btn--ghost" type="button" @click="store.loadEvents" :disabled="store.eventsLoading">
          {{ store.eventsLoading ? '刷新中...' : '刷新' }}
        </button>
        <button v-if="store.isAdmin" class="btn btn--primary" type="button" @click="store.openCreateModal">
          发起活动
        </button>
      </div>
    </section>

    <nav v-if="store.isAdmin" class="page-tabs">
      <RouterLink class="page-tab" to="/events">全部活动</RouterLink>
      <RouterLink class="page-tab" to="/events/mine">我发起的活动</RouterLink>
    </nav>


    <section v-if="store.eventsLoading" class="skeleton-grid" aria-label="loading">
      <div v-for="n in 6" :key="n" class="skeleton-card"></div>
    </section>

    <template v-else>
      <section v-if="!store.isAuthed" class="empty-state">
        <h2>请先登录</h2>
        <p class="muted">登录后才能查看你发起的活动。</p>
        <div class="empty-state__actions">
          <button class="btn btn--primary" type="button" @click="store.openAuth('sign_in')">登录</button>
        </div>
      </section>

      <section v-else-if="!canManage" class="empty-state">
        <h2>暂无权限查看</h2>
        <p class="muted">仅管理员可查看自己发起的活动与草稿。</p>
        <div class="empty-state__actions">
          <RouterLink class="btn btn--ghost" to="/events">返回活动页</RouterLink>
        </div>
      </section>

      <section v-else-if="myEvents.length === 0" class="empty-state">
        <h2>还没有发起过活动</h2>
        <p class="muted">创建一个草稿活动，开始编辑详细页面。</p>
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
            <span class="meta-item">队伍最大人数：{{ teamSizeLabel(event.team_max_size) }}</span>
          </template>
          <template #actions>
            <template v-if="store.isDemoEvent(event)">
              <button class="btn btn--ghost" type="button" disabled>仅展示</button>
            </template>
            <RouterLink v-else-if="event.status === 'draft'" class="btn btn--ghost" :to="`/events/${event.id}/edit`">
              编辑页面
            </RouterLink>
            <template v-else-if="event.status === 'published'">
              <RouterLink class="btn btn--success" :to="`/events/${event.id}/edit`">
                编辑页面
              </RouterLink>
              <button
                class="btn btn--danger"
                type="button"
                :disabled="revertBusyId === event.id"
                @click="handleRevertToDraft(event)"
              >
                {{ revertBusyId === event.id ? '退回中...' : '退回草稿' }}
              </button>
            </template>
          </template>
        </EventCard>
      </section>
    </template>

  </main>
</template>
