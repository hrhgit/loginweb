<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router'
import { RefreshCw, Plus, MapPin, Users, Wifi, WifiOff } from 'lucide-vue-next'
import { useEventsReady } from '../composables/useEventsReady'
import { useAppStore } from '../store/appStore'
import EventCard from '../components/events/EventCard.vue'
import EnhancedVirtualGrid from '../components/EnhancedVirtualGrid.vue'
import NetworkStatusIndicator from '../components/feedback/NetworkStatusIndicator.vue'
import LoadingStateIndicator from '../components/feedback/LoadingStateIndicator.vue'
import { teamSizeLabel, formatDateRange, locationLabel } from '../utils/eventFormat'
import { getEventSummaryText } from '../utils/eventDetails'
import { computed } from 'vue'

const store = useAppStore()
const router = useRouter()
const eventSummary = (description: string | null) => getEventSummaryText(description)

// Network-aware features
const isNetworkAwareLoading = computed(() => 
  store.eventsLoading || store.networkAwareLoading
)

const shouldShowNetworkIndicator = computed(() => 
  !store.isOnline || store.connectionQuality === 'slow'
)

const loadingMessage = computed(() => {
  if (!store.isOnline) return '离线模式 - 显示缓存内容'
  if (store.connectionQuality === 'slow') return '网络较慢，正在加载...'
  return '正在加载活动列表...'
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

// Network-aware refresh function
const handleRefresh = async () => {
  try {
    await store.loadEvents()
  } catch (error) {
    console.error('Failed to refresh events:', error)
  }
}

// Handle network retry
const handleNetworkRetry = () => {
  store.handleConnectivityRestoration()
}

useEventsReady(store)
</script>

<template>
  <main class="main">
    <!-- Network Status Indicator -->
    <NetworkStatusIndicator
      v-if="shouldShowNetworkIndicator"
      position="top"
      :show-details="true"
      :show-actions="true"
      :can-retry="true"
      @retry="handleNetworkRetry"
    />

    <section class="page-head">
      <div>
        <h1>Game Jam 活动</h1>
        <p class="muted">在限定时间内完成可玩的作品，结识跨学科伙伴</p>
      </div>
      <div class="page-head__actions">
        <button 
          class="btn btn--ghost btn--icon-text" 
          type="button" 
          @click="handleRefresh" 
          :disabled="isNetworkAwareLoading"
        >
          <RefreshCw :size="18" :class="{ 'spin': isNetworkAwareLoading }" />
          <span>{{ isNetworkAwareLoading ? '刷新中...' : '刷新' }}</span>
        </button>
        <button v-if="store.isAdmin" class="btn btn--primary btn--icon-text" type="button" @click="store.openCreateModal">
          <Plus :size="18" />
          <span>发起活动</span>
        </button>
      </div>
    </section>

    <nav v-if="store.isAdmin" class="page-tabs">
      <RouterLink class="page-tab" to="/events">全部活动</RouterLink>
      <RouterLink class="page-tab" to="/events/mine">我发起的活动</RouterLink>
    </nav>

    <!-- Enhanced Loading State -->
    <LoadingStateIndicator
      v-if="isNetworkAwareLoading"
      :visible="true"
      :message="loadingMessage"
      variant="card"
      :show-network-quality="true"
      :show-progress="store.networkRetryCount > 0"
      :progress="store.networkRetryCount > 0 ? (store.networkRetryCount / 3) * 100 : undefined"
    />

    <section v-else-if="store.eventsLoading" class="skeleton-grid" aria-label="loading">
      <div v-for="n in 6" :key="n" class="skeleton-card"></div>
    </section>

    <template v-else>
      <section v-if="store.publicEvents.length === 0" class="empty-state">
        <h2>暂时还没有公开活动</h2>
        <p class="muted">活动发布后会出现在这里你可以先准备好活动流程与页面风格</p>
        <div class="empty-state__actions">
          <button v-if="store.isAdmin" class="btn btn--primary btn--icon-text" type="button" @click="store.openCreateModal">
            <Plus :size="18" />
            <span>发布第一个活动</span>
          </button>
          <button v-else-if="!store.isAuthed" class="btn btn--ghost" type="button" @click="store.openAuth('sign_up')">
            注册后报名
          </button>
        </div>
      </section>

      <EnhancedVirtualGrid
        v-else
        :items="store.publicEvents"
        :item-height="280"
        :container-height="600"
        :columns="3"
        :gap="24"
        :loading="isNetworkAwareLoading"
        :enable-metrics="true"
        class="activity-grid"
        aria-label="events"
      >
        <template #default="{ item: event }">
          <EventCard
            :event="event"
            :time-label="formatDateRange(event.start_time, event.end_time)"
            :summary="eventSummary(event.description)"
            @card-dblclick="handleCardDblClick($event, event.id)"
          >
            <template #badges>
              <span v-if="store.myRegistrationByEventId[event.id]" class="pill-badge pill-badge--success">
                已报名
              </span>
              <span v-if="!store.isOnline" class="pill-badge pill-badge--warning">
                离线
              </span>
            </template>
            <template #meta>
              <span class="meta-item"><MapPin :size="16" /> {{ locationLabel(event.location) }}</span>
              <span class="meta-item"><Users :size="16" /> {{ teamSizeLabel(event.team_max_size) }}</span>
            </template>
            <template #actions>
              <template v-if="store.isDemoEvent(event)">
                <button class="btn btn--ghost" type="button" disabled>仅展示</button>
              </template>
              <template v-else-if="event.status === 'draft'">
                <button class="btn btn--ghost" type="button" disabled>草稿中</button>
              </template>
              <RouterLink v-else class="btn btn--primary" :to="`/events/${event.id}`">立即参加</RouterLink>
            </template>
          </EventCard>
        </template>
      </EnhancedVirtualGrid>
    </template>
  </main>
</template>

<style scoped>
.btn--icon-text {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
</style>
