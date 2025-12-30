<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { X } from 'lucide-vue-next'
import { useAppStore } from '../store/appStore'
import { getRoleTagClass, sortRoleLabels } from '../utils/roleTags'
import { 
  handleErrorWithBanner, 
  handleSuccessWithBanner,
  teamErrorHandler 
} from '../store/enhancedErrorHandling'

const store = useAppStore()
const route = useRoute()
const router = useRouter()

const eventId = computed(() => String(route.params.id ?? ''))
const teamId = computed(() => String(route.params.teamId ?? ''))

const event = ref(store.getEventById(eventId.value))
const loading = ref(false)
const error = ref('')

const team = computed(() => {
  return store.getTeamsForEvent(eventId.value).find((item) => item.id === teamId.value) ?? null
})
const isClosed = computed(() => Boolean(team.value?.is_closed))
const isLeader = computed(() => {
  if (!store.user || !team.value) return false
  return team.value.leader_id === store.user.id
})
const myInvite = computed(() => store.getMyTeamInvite(teamId.value))
const hasPendingInvite = computed(() => myInvite.value?.status === 'pending')
const pendingRequests = computed(() => store.getTeamJoinRequests(teamId.value))
const requestBusyId = ref<string | null>(null)
const requestError = ref('')
const memberActionBusyId = ref<string | null>(null)
const memberActionError = ref('')
const isRegistered = computed(() => Boolean(store.myRegistrationByEventId[eventId.value]))
const joinModalOpen = ref(false)
const joinMessage = ref('')
const joinError = ref('')
const joinSubmitBusy = ref(false)
const joinLabel = computed(() => {
  if (!store.user) return '登录后申请'
  if (!isRegistered.value) return '请先报名'
  if (store.isTeamMember(teamId.value)) return '已在队伍'
  if (isClosed.value) return '组队已完成'
  if (hasPendingInvite.value) return '同意加入'
  const status = store.getTeamRequestStatus(teamId.value)
  if (status === 'pending') return '已申请'
  if (status === 'approved') return '已加入'
  if (status === 'rejected' || status === 'cancelled') return '重新申请'
  return '申请加入'
})
const joinDisabled = computed(() => {
  if (store.isTeamMember(teamId.value)) return true
  if (store.user && !isRegistered.value) return true
  if (isClosed.value) return true
  if (hasPendingInvite.value) return joinSubmitBusy.value
  const status = store.getTeamRequestStatus(teamId.value)
  return status === 'pending' || status === 'approved'
})

const parseNeeds = (value: string[] | string) => {
  if (Array.isArray(value)) {
    return sortRoleLabels(value.map((item) => item.trim()).filter(Boolean))
  }
  return sortRoleLabels(
    value
      .split(/[,，、\n]/)
      .map((item) => item.trim())
      .filter(Boolean),
  )
}

const ROLE_MAP: Record<string, string> = {
  planner: '策划',
  programmer: '程序',
  artist: '美术',
  audio: '音乐音效',
}

const members = computed(() => {
  const list = store.getTeamMembers(teamId.value)
  if (!list.length) return []
  return list.map((member) => {
    let name = member.profile?.username
    if (!name && member.user_id === store.user?.id) {
      name = store.user?.user_metadata?.full_name || null
    }
    if (!name) {
      name = `队员${member.user_id.slice(0, 4)}`
    }
    const avatar = member.profile?.avatar_url || ''
    const roles = sortRoleLabels(member.profile?.roles ?? []).map((role) => ROLE_MAP[role] || role)
    return {
      id: member.user_id,
      name,
      avatar,
      roles,
    }
  })
})

const handleLeaveTeam = async () => {
  if (!teamId.value) return
  if (!store.user) {
    store.openAuth('sign_in')
    store.authInfo = '请先登录后操作'
    return
  }
  if (isLeader.value) {
    handleSuccessWithBanner('队长无法退出队伍，请先转移队长或删除队伍', store.setBanner, { 
      operation: 'leaveTeam',
      component: 'team' 
    })
    return
  }
  const confirmed = window.confirm('确定要退出队伍吗？退出后需重新申请加入')
  if (!confirmed) return
  memberActionBusyId.value = store.user.id
  memberActionError.value = ''
  const { error: removeError } = await store.removeTeamMember(teamId.value, store.user.id)
  if (removeError) {
    memberActionError.value = removeError
    handleErrorWithBanner(new Error(removeError), store.setBanner, { 
      operation: 'leaveTeam',
      component: 'team' 
    })
    memberActionBusyId.value = null
    return
  }
  await store.loadTeamMembers(teamId.value)
  await store.loadTeams(eventId.value)
  handleSuccessWithBanner('已退出队伍', store.setBanner, { 
    operation: 'leaveTeam',
    component: 'team' 
  })
  memberActionBusyId.value = null
}

const handleKickMember = async (memberId: string, name?: string) => {
  if (!teamId.value) return
  if (!store.user) {
    store.openAuth('sign_in')
    store.authInfo = '请先登录后操作'
    return
  }
  if (!isLeader.value) return
  if (memberId === store.user.id) return
  const confirmed = window.confirm(`确定要移出${name ?? '该成员'}吗？`)
  if (!confirmed) return
  memberActionBusyId.value = memberId
  memberActionError.value = ''
  const { error: removeError } = await store.removeTeamMember(teamId.value, memberId)
  if (removeError) {
    memberActionError.value = removeError
    handleErrorWithBanner(new Error(removeError), store.setBanner, { 
      operation: 'kickMember',
      component: 'team' 
    })
    memberActionBusyId.value = null
    return
  }
  await store.loadTeamMembers(teamId.value)
  await store.loadTeams(eventId.value)
  handleSuccessWithBanner('已移出队员', store.setBanner, { 
    operation: 'kickMember',
    component: 'team' 
  })
  memberActionBusyId.value = null
}

const handleJoinTeam = async () => {
  if (!store.user) {
    store.openAuth('sign_in')
    store.authInfo = '请先登录后申请加入'
    return
  }
  if (!isRegistered.value) {
    handleSuccessWithBanner('请先报名该活动后再申请加入队伍', store.setBanner, { 
      operation: 'joinTeam',
      component: 'team' 
    })
    return
  }
  if (hasPendingInvite.value && myInvite.value) {
    joinSubmitBusy.value = true
    const { error: acceptError } = await store.acceptTeamInvite(myInvite.value.id, teamId.value)
    if (acceptError) {
      handleErrorWithBanner(new Error(acceptError), store.setBanner, { 
        operation: 'acceptTeamInvite',
        component: 'team' 
      })
      joinSubmitBusy.value = false
      return
    }
    await store.loadTeamMembers(teamId.value)
    await store.loadTeams(eventId.value)
    handleSuccessWithBanner('已加入队伍', store.setBanner, { 
      operation: 'acceptTeamInvite',
      component: 'team' 
    })
    joinSubmitBusy.value = false
    return
  }
  joinMessage.value = ''
  joinError.value = ''
  joinModalOpen.value = true
}

const closeJoinModal = () => {
  if (joinSubmitBusy.value) return
  joinModalOpen.value = false
  joinMessage.value = ''
  joinError.value = ''
}

const submitJoinRequest = async () => {
  if (!teamId.value) return
  joinSubmitBusy.value = true
  joinError.value = ''
  const message = joinMessage.value.trim()
  const { error: requestError } = await store.requestJoinTeam(
    teamId.value,
    message ? message : undefined,
  )
  if (requestError) {
    joinError.value = requestError
    joinSubmitBusy.value = false
    return
  }
  handleSuccessWithBanner('已提交入队申请', store.setBanner, { 
    operation: 'joinTeam',
    component: 'team' 
  })
  joinModalOpen.value = false
  joinMessage.value = ''
  joinSubmitBusy.value = false
}

const handleEditTeam = async () => {
  if (!teamId.value) return
  await router.push(`/events/${eventId.value}/team/${teamId.value}/edit`)
}

const handleDeleteTeam = async () => {
  if (!team.value) return
  const confirmed = window.confirm('确定要删除该队伍吗？删除后将从组队大厅移除')
  if (!confirmed) return
  
  const { error: deleteError } = await store.deleteTeam(eventId.value, team.value.id)
  if (deleteError) {
    // 检查是否是因为已提交作品而无法删除
    if (deleteError.includes('submissions_team_id_fkey') || deleteError.includes('foreign key constraint')) {
      handleErrorWithBanner(new Error('该队伍已提交作品，请先删除作品后再删除队伍'), store.setBanner, { 
        operation: 'deleteTeam',
        component: 'team' 
      })
    } else {
      handleErrorWithBanner(new Error(deleteError), store.setBanner, { 
        operation: 'deleteTeam',
        component: 'team' 
      })
    }
    return
  }
  handleSuccessWithBanner('队伍已删除', store.setBanner, { 
    operation: 'deleteTeam',
    component: 'team' 
  })
  await router.push(`/events/${eventId.value}/team`)
}

const handleRequest = async (requestId: string, status: 'approved' | 'rejected') => {
  if (!teamId.value) return
  requestBusyId.value = requestId
  requestError.value = ''
  const { error: updateError } = await store.updateTeamJoinRequestStatus(requestId, status)
  if (updateError) {
    requestError.value = updateError
    requestBusyId.value = null
    return
  }
  await store.loadTeamJoinRequests(teamId.value)
  await store.loadTeamMembers(teamId.value)
  await store.loadTeams(eventId.value)
  handleSuccessWithBanner(status === 'approved' ? '已批准入队申请' : '已拒绝入队申请', store.setBanner, { 
    operation: 'handleTeamRequest',
    component: 'team' 
  })
  requestBusyId.value = null
}

const closeTeamBusy = ref(false)
const closeTeamError = ref('')
const handleCloseTeam = async () => {
  if (!team.value) return
  closeTeamBusy.value = true
  closeTeamError.value = ''
  const { error } = await store.closeTeam(team.value.id)
  if (error) {
    closeTeamError.value = error
    handleErrorWithBanner(new Error(error), store.setBanner, { 
      operation: 'closeTeam',
      component: 'team' 
    })
    closeTeamBusy.value = false
    return
  }
  await store.loadTeams(eventId.value)
  handleSuccessWithBanner('队伍已标记为组队完成', store.setBanner, { 
    operation: 'closeTeam',
    component: 'team' 
  })
  closeTeamBusy.value = false
}

const reopenTeamBusy = ref(false)
const handleReopenTeam = async () => {
  if (!team.value) return
  reopenTeamBusy.value = true
  closeTeamError.value = ''
  const { error } = await store.reopenTeam(team.value.id)
  if (error) {
    closeTeamError.value = error
    handleErrorWithBanner(new Error(error), store.setBanner, { 
      operation: 'reopenTeam',
      component: 'team' 
    })
    reopenTeamBusy.value = false
    return
  }
  await store.loadTeams(eventId.value)
  handleSuccessWithBanner('队伍已重新开放组队', store.setBanner, { 
    operation: 'reopenTeam',
    component: 'team' 
  })
  reopenTeamBusy.value = false
}

const loadEvent = async () => {
  if (!eventId.value) return
  loading.value = true
  error.value = ''

  await store.ensureEventsLoaded()
  const cached = store.getEventById(eventId.value)
  if (cached) {
    event.value = cached
  } else {
    const { data, error: fetchError } = await store.fetchEventById(eventId.value)
    if (fetchError) {
      error.value = fetchError
      loading.value = false
      return
    }
    event.value = data
  }

  await store.loadTeams(eventId.value)
  await store.loadTeamMembers(teamId.value)
  if (isLeader.value) {
    await store.loadTeamJoinRequests(teamId.value)
  }
  if (store.user) {
    await store.loadMyTeamInvite(teamId.value)
  }
  if (!team.value) {
    error.value = '未找到该队伍'
  }
  loading.value = false
}

onMounted(async () => {
  await store.refreshUser()
  await store.loadMyProfile()
  await store.ensureRegistrationsLoaded()
  await loadEvent()
})

watch(isLeader, async (value) => {
  if (!value) return
  if (!teamId.value) return
  await store.loadTeamJoinRequests(teamId.value)
})

watch(
  () => teamId.value,
  async (next) => {
    if (!next) return
    if (store.user) {
      await store.loadMyTeamInvite(next)
    }
  },
)

watch(
  () => store.user?.id,
  async () => {
    if (!teamId.value || !store.user) return
    await store.loadMyTeamInvite(teamId.value)
  },
)
</script>

<template>
  <main class="main">
    <section class="page-head">
      <div>
        <h1>队伍详情</h1>
        <p class="muted">查看队伍介绍与成员信息</p>
      </div>
      <div class="page-head__actions">
        <button
          v-if="team && !isLeader"
          class="btn btn--primary"
          type="button"
          :disabled="joinDisabled"
          @click="handleJoinTeam"
        >
          {{ joinLabel }}
        </button>
        <span v-else-if="isClosed && !isLeader" class="pill-badge pill-badge--ended">组队已完成</span>
        <button v-if="isLeader" class="btn btn--ghost" type="button" @click="handleEditTeam">
          编辑队伍
        </button>
        <button
          v-if="isLeader && !isClosed"
          class="btn btn--primary"
          type="button"
          :disabled="closeTeamBusy"
          @click="handleCloseTeam"
        >
          {{ closeTeamBusy ? '标记中...' : '组队完成' }}
        </button>
        <button
          v-if="isLeader && isClosed"
          class="btn btn--ghost"
          type="button"
          :disabled="reopenTeamBusy"
          @click="handleReopenTeam"
        >
          {{ reopenTeamBusy ? '开放中...' : '继续组队' }}
        </button>
        <button v-if="isLeader" class="btn btn--danger" type="button" @click="handleDeleteTeam">
          删除队伍
        </button>
        <RouterLink class="btn btn--ghost" :to="`/events/${eventId}/team`">返回组队大厅</RouterLink>
      </div>
      <p v-if="closeTeamError" class="alert error">{{ closeTeamError }}</p>
    </section>

    <section v-if="loading" class="detail-loading">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </section>

    <section v-else-if="error" class="empty-state">
      <h2>无法查看队伍</h2>
      <p class="muted">{{ error }}</p>
      <RouterLink class="btn btn--ghost" :to="`/events/${eventId}/team`">返回</RouterLink>
    </section>

        <section v-else-if="team" class="team-detail">

          <div class="team-detail__head">

            <div>

              <h2>{{ team.name }}</h2>

              <p v-if="team.leader_qq" class="muted team-detail__qq">队长QQ：{{ team.leader_qq }}</p>

            </div>

            <div class="team-detail__meta">

              <span class="pill-badge pill-badge--published">{{ team.members }} 人</span>

            </div>

          </div>

    

          <div class="team-detail__content">

            <article class="detail-card">

              <!-- Middle: Intro & Needs -->

              <div class="detail-group">

                <h4>队伍介绍</h4>

                <p class="muted">{{ team.intro || '暂无队伍介绍' }}</p>

                <div class="detail-tags" style="margin-top: 12px;">

                  <span v-for="tag in parseNeeds(team.needs)" :key="tag" :class="['meta-item', getRoleTagClass(tag)]">{{

                    tag

                  }}</span>

                  <span v-if="!team.needs || parseNeeds(team.needs).length === 0" class="muted small-note">暂无需求</span>

                </div>

              </div>

    

              <!-- Bottom: Extra -->

              <div class="detail-group divider-top">

                <h4>补充说明</h4>

                <p class="muted">{{ team.extra || '暂无补充说明' }}</p>

              </div>

            </article>

          </div>

    

            
            <section class="team-members">
        <header class="team-members__head">
          <h3>队伍成员</h3>
          <span class="muted">显示头像、用户名与职能</span>
        </header>
        <div v-if="members.length" class="team-member-grid">
          <article v-for="member in members" :key="member.id" class="team-member-card">
            <div class="team-member-avatar">
              <img v-if="member.avatar" :src="member.avatar" :alt="member.name" />
              <span v-else>{{ member.name.slice(0, 1) }}</span>
            </div>
            <div class="team-member-meta">
              <h4>{{ member.name }}</h4>
              <div class="team-member-roles">
                <span
                  v-for="role in member.roles"
                  :key="role"
                  :class="['pill-badge', 'pill-badge--draft', getRoleTagClass(role)]"
                >
                  {{ role }}
                </span>
                <span v-if="member.roles.length === 0" class="pill-badge pill-badge--draft">待完善</span>
              </div>
            </div>
            <div
              v-if="
                (isLeader && member.id !== store.user?.id) ||
                (!isLeader && member.id === store.user?.id)
              "
              class="team-member-actions"
            >
              <button
                v-if="isLeader && member.id !== store.user?.id"
                class="btn btn--danger"
                type="button"
                :disabled="memberActionBusyId === member.id"
                @click="handleKickMember(member.id, member.name)"
              >
                移出
              </button>
              <button
                v-else
                class="btn btn--danger"
                type="button"
                :disabled="memberActionBusyId === store.user?.id"
                @click="handleLeaveTeam"
              >
                退出队伍
              </button>
            </div>
          </article>
        </div>
        <p v-else class="muted">暂未找到队伍成员</p>
        <p v-if="memberActionError" class="alert error">{{ memberActionError }}</p>
      </section>

      <section v-if="isLeader" class="team-requests">
        <header class="team-requests__head">
          <h3>待处理申请</h3>
          <span class="muted">队长可以在这里批准或拒绝入队申请</span>
        </header>
        <p v-if="pendingRequests.length === 0" class="muted">暂无待处理申请</p>
        <div v-else class="team-requests__list">
          <article v-for="request in pendingRequests" :key="request.id" class="team-request-row">
            <div class="team-request-meta">
              <div class="team-request-avatar">
                <img
                  v-if="request.profile?.avatar_url"
                  :src="request.profile.avatar_url"
                  :alt="request.profile?.username || '申请人'"
                />
                <span v-else>{{ (request.profile?.username || '新').slice(0, 1) }}</span>
              </div>
              <div class="team-request-info">
                <div class="team-request-header">
                  <h4>{{ request.profile?.username || '新成员' }}</h4>
                  <div class="team-member-roles" v-if="request.profile?.roles?.length">
                    <span
                      v-for="role in request.profile.roles"
                      :key="role"
                      :class="['pill-badge', 'pill-badge--draft', getRoleTagClass(ROLE_MAP[role] || role)]"
                    >
                      {{ ROLE_MAP[role] || role }}
                    </span>
                  </div>
                </div>
                <p v-if="request.message" class="muted small-note">留言：{{ request.message }}</p>
              </div>
            </div>
            <div class="team-request-actions">
              <button
                class="btn btn--primary"
                type="button"
                :disabled="requestBusyId === request.id"
                @click="handleRequest(request.id, 'approved')"
              >
                批准
              </button>
              <button
                class="btn btn--danger"
                type="button"
                :disabled="requestBusyId === request.id"
                @click="handleRequest(request.id, 'rejected')"
              >
                拒绝
              </button>
            </div>
          </article>
        </div>
        <p v-if="requestError" class="alert error">{{ requestError }}</p>
      </section>
    </section>
  </main>

  <teleport to="body">
    <div v-if="joinModalOpen" class="modal-backdrop">
      <div class="modal-shell">
        <div class="modal">
        <header class="modal__header">
          <h2>申请加入队伍</h2>
        </header>

        <form class="form" @submit.prevent="submitJoinRequest">
          <div class="form-question">
            <div class="form-question__title">
              <span>留言（可选）</span>
            </div>
            <div class="form-question__field">
              <textarea v-model="joinMessage" rows="4" placeholder="简单介绍一下你的能力或想法"></textarea>
            </div>
          </div>

          <p v-if="joinError" class="alert error">{{ joinError }}</p>

          <div class="modal__actions">
            <button class="btn btn--ghost" type="button" :disabled="joinSubmitBusy" @click="closeJoinModal">
              取消
            </button>
            <button class="btn btn--primary" type="submit" :disabled="joinSubmitBusy">
              {{ joinSubmitBusy ? '提交中...' : '提交申请' }}
            </button>
          </div>
        </form>
        </div>
        <button class="icon-btn modal-close" type="button" @click="closeJoinModal" aria-label="close">
          <X :size="20" />
        </button>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.team-detail__content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.detail-group {
  display: grid;
  gap: 8px;
}

.divider-top {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px dashed var(--border);
}

.team-detail__section h4 {
  margin: 0 0 12px 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--ink);
}

.team-member-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-top: 16px;
}

@media (max-width: 640px) {
  .team-member-grid {
    grid-template-columns: 1fr;
  }
}

.team-member-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: white;
  border: 1px solid var(--border);
  border-radius: 12px;
}

.team-request-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
