<template>
  <div class="my-teams-content">
    <!-- Loading State with Skeleton -->
    <div v-if="loading" class="loading-state">
      <div class="loading-skeleton">
        <div class="skeleton-header">
          <div class="skeleton-line skeleton-title"></div>
        </div>
        <div class="skeleton-cards">
          <div v-for="i in 3" :key="i" class="skeleton-card">
            <div class="skeleton-line skeleton-card-title"></div>
            <div class="skeleton-line skeleton-card-meta"></div>
            <div class="skeleton-actions">
              <div class="skeleton-button"></div>
              <div class="skeleton-button"></div>
            </div>
          </div>
        </div>
      </div>
      <p class="loading-text">正在加载队伍信息...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="loadError" class="error-state">
      <div class="error-content">
        <p class="error-message">{{ getErrorMessage(loadError) }}</p>
        <div class="error-actions">
          <button
            v-if="canRetry && !isPermissionError(loadError)"
            class="btn btn--primary"
            type="button"
            @click="retryLoad"
          >
            重试 ({{ 3 - retryCount }}/3)
          </button>
          <button
            v-if="isPermissionError(loadError)"
            class="btn btn--primary"
            type="button"
            @click="store.openAuthModal('sign_in')"
          >
            重新登录
          </button>
          <p v-if="retryCount >= 3" class="retry-limit-message">
            已达到最大重试次数，请稍后再试或联系管理员
          </p>
        </div>
      </div>
    </div>

    <!-- Not Logged In State -->
    <div v-else-if="!store.user" class="team-empty">
      <p>请先登录查看我的队伍</p>
    </div>

    <!-- Demo Event State -->
    <div v-else-if="isDemo" class="team-empty">
      <p>展示活动暂不支持队伍管理功能</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="!hasAnyTeamData" class="empty-state">
      <div class="empty-content">
        <div class="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <h3 class="empty-title">暂无队伍信息</h3>
        <p class="empty-description">
          您还没有参与任何队伍，也没有待处理的申请或邀请
        </p>
        <div class="empty-actions">
          <button 
            class="btn btn--primary"
            type="button"
            @click="$emit('switchTab', 'teams')"
          >
            查找队伍
          </button>
          <button 
            class="btn btn--ghost"
            type="button"
            @click="$emit('switchTab', 'seekers')"
          >
            发布求组队
          </button>
        </div>
      </div>
    </div>

    <!-- Teams Content -->
    <div v-else class="my-teams-sections">
      <!-- My Teams Section -->
      <section v-if="myTeams.length > 0" class="my-teams-section">
        <h3 class="section-title">我的队伍</h3>
        <div class="team-grid">
          <article
            v-for="team in myTeams"
            :key="team.teamId"
            class="team-card my-team-card"
            @dblclick="navigateToTeamDetail(team.teamId)"
          >
            <div class="team-card__head">
              <div class="team-card__title-group">
                <RouterLink class="team-card__title" :to="`/events/${eventId}/team/${team.teamId}`">
                  {{ team.teamName }}
                </RouterLink>
                <div class="team-card__meta">
                  <span class="role-badge" :class="getRoleClass(team.role)">
                    {{ getRoleLabel(team.role) }}
                  </span>
                  <span class="pill-badge pill-badge--published">{{ team.memberCount }} 人</span>
                </div>
              </div>
            </div>

            <div class="team-card__actions">
              <RouterLink 
                class="btn btn--ghost" 
                :to="`/events/${eventId}/team/${team.teamId}`"
              >
                查看详情
              </RouterLink>
            </div>
          </article>
        </div>
      </section>

      <!-- My Requests Section -->
      <section v-if="myRequests.length > 0" class="my-teams-section">
        <h3 class="section-title">我的申请</h3>
        <div class="request-list">
          <article
            v-for="request in myRequests"
            :key="request.id"
            class="request-card"
          >
            <div class="request-card__head">
              <div class="request-card__info">
                <RouterLink class="request-card__title" :to="`/events/${eventId}/team/${request.teamId}`">
                  {{ request.teamName }}
                </RouterLink>
                <span class="request-status" :class="getStatusClass(request.status)">
                  {{ getStatusLabel(request.status) }}
                </span>
              </div>
              <div class="request-card__actions">
                <button
                  v-if="request.status === 'pending'"
                  class="btn btn--ghost btn--small"
                  type="button"
                  :disabled="cancelRequestBusy === request.id"
                  @click="handleCancelRequest(request)"
                >
                  {{ cancelRequestBusy === request.id ? '取消中...' : '取消申请' }}
                </button>
              </div>
            </div>
            <p v-if="request.message" class="request-card__message">
              {{ request.message }}
            </p>
          </article>
        </div>
      </section>

      <!-- My Invites Section -->
      <section v-if="myInvites.length > 0" class="my-teams-section">
        <h3 class="section-title">队伍邀请</h3>
        <div class="invite-list">
          <article
            v-for="invite in myInvites"
            :key="invite.id"
            class="invite-card"
          >
            <div class="invite-card__head">
              <div class="invite-card__info">
                <RouterLink class="invite-card__title" :to="`/events/${eventId}/team/${invite.teamId}`">
                  {{ invite.teamName }}
                </RouterLink>
                <p v-if="invite.invitedByName" class="invite-card__from">
                  来自：{{ invite.invitedByName }}
                </p>
              </div>
              <div class="invite-card__actions">
                <button
                  v-if="invite.status === 'pending'"
                  class="btn btn--primary btn--small"
                  type="button"
                  :disabled="acceptInviteBusy === invite.id"
                  @click="handleAcceptInvite(invite)"
                >
                  {{ acceptInviteBusy === invite.id ? '接受中...' : '接受邀请' }}
                </button>
                <button
                  v-if="invite.status === 'pending'"
                  class="btn btn--ghost btn--small"
                  type="button"
                  :disabled="rejectInviteBusy === invite.id"
                  @click="handleRejectInvite(invite)"
                >
                  {{ rejectInviteBusy === invite.id ? '拒绝中...' : '拒绝' }}
                </button>
              </div>
            </div>
            <p v-if="invite.message" class="invite-card__message">
              {{ invite.message }}
            </p>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAppStore } from '../store/appStore'
import type { MyTeamEntry, MyTeamRequest, MyTeamInvite } from '../store/models'

interface Props {
  eventId: string
  isDemo: boolean
}

interface Emits {
  (e: 'switchTab', tab: 'teams' | 'seekers'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const store = useAppStore()
const router = useRouter()

// Loading state
const loading = ref(false)
const loadError = ref<string | null>(null)
const retryCount = ref(0)

// Busy states for actions
const cancelRequestBusy = ref<string | null>(null)
const acceptInviteBusy = ref<string | null>(null)
const rejectInviteBusy = ref<string | null>(null)

// Computed data
const myTeams = computed(() => store.getMyTeamsForEvent(props.eventId))
const myRequests = computed(() => store.getMyTeamRequestsForEvent(props.eventId))
const myInvites = computed(() => store.getMyTeamInvitesForEvent(props.eventId))

const hasAnyTeamData = computed(() => 
  myTeams.value.length > 0 || myRequests.value.length > 0 || myInvites.value.length > 0
)

// Error handling helpers
const canRetry = computed(() => loadError.value !== null && !loading.value && retryCount.value < 3)

const getErrorMessage = (error: string) => {
  if (error.includes('permission') || error.includes('unauthorized')) {
    return '权限不足，请重新登录'
  }
  if (error.includes('network') || error.includes('fetch')) {
    return '网络连接失败，请检查网络设置'
  }
  if (error.includes('timeout') || error.includes('超时')) {
    return '请求超时，加载失败，请刷新页面'
  }
  return '加载失败，请稍后重试'
}

const isPermissionError = (error: string) => {
  return error.includes('permission') || error.includes('unauthorized')
}

// Data loading function
const loadTeamData = async () => {
  if (props.isDemo || !store.user || !props.eventId) {
    loading.value = false
    loadError.value = null
    return
  }

  loading.value = true
  loadError.value = null

  try {
    const results = await Promise.all([
      store.loadMyTeamsForEvent(props.eventId),
      store.loadMyTeamRequestsForEvent(props.eventId),
      store.loadMyTeamInvitesForEvent(props.eventId),
    ])

    const firstError = results.find((result) => result?.error)
    if (firstError?.error) {
      loadError.value = firstError.error
    } else {
      retryCount.value = 0
    }
  } catch (error) {
    loadError.value = (error as Error).message
    console.error('Failed to load team data:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadTeamData()
})

watch(
  () => [props.eventId, props.isDemo, store.user?.id],
  () => {
    void loadTeamData()
  },
)

const retryLoad = async () => {
  if (!canRetry.value) return
  
  retryCount.value++
  await loadTeamData()
}

// Role display helpers
const getRoleLabel = (role: 'leader' | 'member') => {
  return role === 'leader' ? '队长' : '队员'
}

const getRoleClass = (role: 'leader' | 'member') => {
  return role === 'leader' ? 'role-leader' : 'role-member'
}

// Status display helpers
const getStatusLabel = (status: string) => {
  switch (status) {
    case 'pending': return '待处理'
    case 'approved': return '已通过'
    case 'rejected': return '已拒绝'
    default: return status
  }
}

const getStatusClass = (status: string) => {
  switch (status) {
    case 'pending': return 'status-pending'
    case 'approved': return 'status-approved'
    case 'rejected': return 'status-rejected'
    default: return ''
  }
}

// Action handlers
const navigateToTeamDetail = (teamId: string) => {
  router.push(`/events/${props.eventId}/team/${teamId}`)
}

const handleCancelRequest = async (request: MyTeamRequest) => {
  if (!store.user) return
  
  const confirmed = window.confirm('确定要取消这个申请吗？')
  if (!confirmed) return

  cancelRequestBusy.value = request.id
  
  try {
    const { error } = await store.cancelTeamJoinRequest(request.id)
    if (error) {
      store.setBanner('error', error)
    } else {
      store.setBanner('info', '申请已取消')
    }
  } finally {
    cancelRequestBusy.value = null
  }
}

const handleAcceptInvite = async (invite: MyTeamInvite) => {
  if (!store.user) return

  acceptInviteBusy.value = invite.id
  
  try {
    const { error } = await store.acceptTeamInvite(invite.id, invite.teamId)
    if (error) {
      store.setBanner('error', error)
    } else {
      store.setBanner('info', `已加入队伍：${invite.teamName}`)
    }
  } finally {
    acceptInviteBusy.value = null
  }
}

const handleRejectInvite = async (invite: MyTeamInvite) => {
  if (!store.user) return

  const confirmed = window.confirm('确定要拒绝这个邀请吗？')
  if (!confirmed) return

  rejectInviteBusy.value = invite.id
  
  try {
    const { error } = await store.rejectTeamInvite(invite.id, invite.teamId)
    if (error) {
      store.setBanner('error', error)
    } else {
      store.setBanner('info', '已拒绝邀请')
    }
  } finally {
    rejectInviteBusy.value = null
  }
}
</script>

<style scoped>
.my-teams-content {
  min-height: 200px;
}

/* Loading State Styles */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 16px;
  gap: 24px;
}

.loading-skeleton {
  width: 100%;
  max-width: 600px;
}

.skeleton-header {
  margin-bottom: 24px;
}

.skeleton-line {
  background: linear-gradient(90deg, var(--surface-muted) 25%, var(--surface) 50%, var(--surface-muted) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

.skeleton-title {
  height: 24px;
  width: 200px;
}

.skeleton-cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.skeleton-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-card-title {
  height: 20px;
  width: 60%;
}

.skeleton-card-meta {
  height: 16px;
  width: 40%;
}

.skeleton-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.skeleton-button {
  height: 32px;
  width: 80px;
  background: linear-gradient(90deg, var(--surface-muted) 25%, var(--surface) 50%, var(--surface-muted) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 6px;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.loading-text {
  color: var(--muted);
  font-size: 0.9rem;
  margin: 0;
}

/* Error State Styles */
.error-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  padding: 32px 16px;
}

.error-content {
  text-align: center;
  max-width: 400px;
}

.error-message {
  color: var(--danger);
  font-size: 1rem;
  margin: 0 0 24px 0;
  font-weight: 500;
}

.error-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.retry-limit-message {
  color: var(--muted);
  font-size: 0.85rem;
  margin: 0;
  text-align: center;
}

/* Empty State Styles */
.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
  padding: 32px 16px;
}

.empty-content {
  text-align: center;
  max-width: 400px;
}

.empty-icon {
  color: var(--muted);
  margin-bottom: 16px;
  display: flex;
  justify-content: center;
}

.empty-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0 0 8px 0;
}

.empty-description {
  color: var(--muted);
  font-size: 0.9rem;
  margin: 0 0 24px 0;
  line-height: 1.5;
}

.empty-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.my-teams-sections {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.my-teams-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.my-team-card {
  border-left: 3px solid var(--accent);
}

.team-card__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.role-badge {
  font-size: 0.75rem;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 12px;
  text-transform: uppercase;
}

.role-leader {
  background-color: var(--accent-soft);
  color: var(--accent);
}

.role-member {
  background-color: rgba(79, 91, 88, 0.1);
  color: var(--muted);
}

.request-list,
.invite-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.request-card,
.invite-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
}

.request-card__head,
.invite-card__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.request-card__info,
.invite-card__info {
  flex: 1;
}

.request-card__title,
.invite-card__title {
  font-weight: 600;
  color: var(--ink);
  text-decoration: none;
  display: block;
  margin-bottom: 4px;
}

.request-card__title:hover,
.invite-card__title:hover {
  color: var(--accent);
}

.request-status {
  font-size: 0.85rem;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 8px;
}

.status-pending {
  background-color: rgba(224, 122, 95, 0.1);
  color: var(--accent-2);
}

.status-approved {
  background-color: rgba(31, 111, 109, 0.1);
  color: var(--accent);
}

.status-rejected {
  background-color: rgba(182, 45, 28, 0.1);
  color: var(--danger);
}

.invite-card__from {
  font-size: 0.85rem;
  color: var(--muted);
  margin: 0;
}

.request-card__actions,
.invite-card__actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.request-card__message,
.invite-card__message {
  margin-top: 12px;
  margin-bottom: 0;
  font-size: 0.9rem;
  color: var(--muted);
  font-style: italic;
}

.btn--small {
  padding: 6px 12px;
  font-size: 0.85rem;
}

@media (max-width: 640px) {
  .request-card__head,
  .invite-card__head {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .request-card__actions,
  .invite-card__actions {
    justify-content: flex-end;
  }

  .loading-state,
  .error-state,
  .empty-state {
    padding: 24px 12px;
  }

  .skeleton-cards {
    gap: 12px;
  }

  .skeleton-card {
    padding: 12px;
  }

  .empty-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .empty-actions .btn {
    width: 100%;
  }
}
</style>
