<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { Camera, User, Shield, Calendar, PlusCircle, Bell, Trash2, Users } from 'lucide-vue-next'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/appStore'
import AvatarCropperModal from '../components/modals/AvatarCropperModal.vue'
import EventCard from '../components/events/EventCard.vue'
import { formatDateRange, formatDateTime, locationLabel, teamSizeLabel } from '../utils/eventFormat'
import { getEventSummaryText } from '../utils/eventDetails'
import { getRoleTagKey, sortRoleLabels } from '../utils/roleTags'

const store = useAppStore()
const router = useRouter()

type ProfileTab = 'profile' | 'security' | 'notifications' | 'teams' | 'joined' | 'created'
const props = defineProps<{ tab: ProfileTab }>()

const showAvatarCropper = ref(false)
const isEditing = ref(false)

const activeTab = computed(() => props.tab)
const saveBusy = ref(false)
const saveError = ref('')
const profileErrors = ref<Record<string, string>>({})
const passwordErrors = ref<Record<string, string>>({})

const tabRoutes: Record<ProfileTab, string> = {
  profile: '/me/profile',
  security: '/me/security',
  notifications: '/me/notifications',
  teams: '/me/teams',
  joined: '/me/joined',
  created: '/me/created',
}

const goTab = async (tab: ProfileTab) => {
  if (tab === props.tab) return
  if (tab === 'created') {
    await store.refreshUser()
    if (!store.isAdmin) {
      store.setBanner('error', '只有管理员可以查看我发起的活动')
      return
    }
  }
  await router.push(tabRoutes[tab])
}

const cancelEdit = () => {
  isEditing.value = false
  syncProfileForm()
  profileErrors.value = {}
  saveError.value = ''
  // Reset optimistic avatar when canceling edit
  optimisticAvatarUrl.value = ''
  // Reset store's optimistic avatar too
  if (store.profile?.avatar_url) {
    store.setOptimisticAvatar(store.profile.avatar_url)
  }
}

const handleAvatarSave = (data: { dataUrl: string; uploadedUrl?: string; uploadedPath?: string }) => {
  // 立即更新乐观UI
  optimisticAvatarUrl.value = data.dataUrl
  // 如果预上传成功，使用上传后的URL，否则使用dataUrl
  avatarUrl.value = data.uploadedUrl || data.dataUrl
  // 存储上传路径，用于后续数据库更新
  if (data.uploadedPath) {
    // 可以存储路径信息，但这里我们主要使用URL
  }
  // 更新store中的头像用于导航栏显示
  store.setOptimisticAvatar(data.dataUrl)
}

const passwordBusy = ref(false)
const passwordError = ref('')
const passwordInfo = ref('')

const username = ref('')
const avatarUrl = ref('')
const optimisticAvatarUrl = ref('')
const phone = ref('')
const qq = ref('')
const roles = ref<string[]>([])

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

const roleOptions = [
  { id: 'planner', label: '策划' },
  { id: 'programmer', label: '程序' },
  { id: 'artist', label: '美术' },
  { id: 'audio', label: '音乐音效' },
]
const roleLabelById = (id: string) => roleOptions.find((r) => r.id === id)?.label ?? id
const sortedRoleBadges = computed(() =>
  sortRoleLabels(roles.value.map(roleLabelById)).map((label) => ({
    label,
    key: getRoleTagKey(label) || label,
  })),
)

const isAuthed = computed(() => store.isAuthed)
const avatarPreview = computed(() => optimisticAvatarUrl.value.trim() || avatarUrl.value.trim())

const joinedEvents = computed(() => {
  return store.displayedEvents.filter(event => store.myRegistrationByEventId[event.id])
})

const createdEvents = computed(() => {
  return store.myEvents
})

const notifications = computed(() => store.notifications)
const unreadNotifications = computed(() => store.unreadNotifications)
const readNotificationsCount = computed(() => notifications.value.filter((item) => item.read).length)

type MyTeamEntry = {
  teamId: string
  eventId: string | null
  teamName: string
  role: 'leader' | 'member'
  memberCount: number
}

type MyTeamRequestEntry = {
  id: string
  teamId: string
  eventId: string | null
  teamName: string
  status: string
  message: string | null
  createdAt: string
  updatedAt: string | null
}

type MyTeamInviteEntry = {
  id: string
  teamId: string
  eventId: string | null
  teamName: string
  invitedById: string | null
  invitedByName: string | null
  status: string
  message: string | null
  createdAt: string
  updatedAt: string | null
}

const myTeams = ref<MyTeamEntry[]>([])
const myTeamRequests = ref<MyTeamRequestEntry[]>([])
const myTeamInvites = ref<MyTeamInviteEntry[]>([])
const teamsLoading = ref(false)
const teamsLoaded = ref(false)
const teamsError = ref('')
const cancelRequestBusyId = ref<string | null>(null)
const acceptInviteBusyId = ref<string | null>(null)

const teamNotificationCount = computed(() => store.pendingRequestsCount + store.pendingInvitesCount)

const getEventTitle = (eventId: string | null) => {
  if (!eventId) return '未知活动'
  return store.getEventById(eventId)?.title ?? '未知活动'
}

const getTeamLink = (eventId: string | null, teamId: string) => {
  if (!eventId) return ''
  return `/events/${eventId}/team/${teamId}`
}

const requestStatusLabel = (status: string) => {
  switch (status) {
    case 'pending':
      return '待处理'
    case 'approved':
      return '已通过'
    case 'rejected':
      return '已拒绝'
    default:
      return '未知状态'
  }
}

const requestStatusClass = (status: string) => {
  switch (status) {
    case 'approved':
      return 'pill-badge--success'
    case 'rejected':
      return 'pill-badge--ended'
    case 'pending':
      return 'pill-badge--draft'
    default:
      return ''
  }
}

const handleCancelRequest = async (request: MyTeamRequestEntry) => {
  if (request.status !== 'pending' || cancelRequestBusyId.value) return
  teamsError.value = ''
  cancelRequestBusyId.value = request.id
  const { error } = await store.cancelTeamJoinRequest(request.id)
  if (error) {
    teamsError.value = error
  } else {
    myTeamRequests.value = myTeamRequests.value.filter((item) => item.id !== request.id)
    void store.loadMyPendingTeamActions()
  }
  cancelRequestBusyId.value = null
}

const handleAcceptInvite = async (invite: MyTeamInviteEntry) => {
  if (invite.status !== 'pending' || acceptInviteBusyId.value) return
  teamsError.value = ''
  acceptInviteBusyId.value = invite.id
  const { error } = await store.acceptTeamInvite(invite.id, invite.teamId)
  if (error) {
    teamsError.value = error
  } else {
    myTeamInvites.value = myTeamInvites.value.filter((item) => item.id !== invite.id)
    teamsLoaded.value = false
    void store.loadMyPendingTeamActions()
    await loadMyTeamsOverview()
  }
  acceptInviteBusyId.value = null
}

const loadMyTeamsOverview = async () => {
  if (!store.user || teamsLoading.value || teamsLoaded.value) return
  teamsLoading.value = true
  teamsError.value = ''
  try {
    const userId = store.user.id
    const [
      { data: leaderTeams, error: leaderError },
      { data: memberTeams, error: memberError },
      { data: requests, error: requestError },
      { data: invites, error: inviteError },
    ] = await Promise.all([
      supabase
        .from('teams')
        .select('id,event_id,leader_id,name,created_at')
        .eq('leader_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('team_members')
        .select('team_id,joined_at,teams(id,event_id,leader_id,name)')
        .eq('user_id', userId)
        .order('joined_at', { ascending: false }),
      supabase
        .from('team_join_requests')
        .select('id,team_id,status,message,created_at,updated_at,teams(event_id,name)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('team_invites')
        .select('id,team_id,status,message,created_at,updated_at,invited_by,teams(event_id,name)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    ])

    if (leaderError) throw leaderError
    if (memberError) throw memberError
    if (requestError) throw requestError
    if (inviteError) {
      if ((inviteError as { code?: string }).code === '42P01') {
        console.warn('team_invites not available', inviteError.message)
      } else {
        throw inviteError
      }
    }

    const leaderList = (leaderTeams ?? []).map((row) => ({
      teamId: row.id as string,
      eventId: (row.event_id as string) ?? null,
      teamName: (row.name as string) ?? '未命名队伍',
      role: 'leader' as const,
    }))

    const leaderIds = new Set(leaderList.map((team) => team.teamId))

    const memberList = (memberTeams ?? [])
      .map((row) => {
        const team = (row as { teams?: { id?: string; event_id?: string | null; name?: string | null } | null }).teams
        if (!team?.id || leaderIds.has(team.id)) return null
        return {
          teamId: team.id,
          eventId: team.event_id ?? null,
          teamName: team.name ?? '未命名队伍',
          role: 'member' as const,
        }
      })
      .filter((item): item is Omit<MyTeamEntry, 'memberCount'> => Boolean(item))

    const teamIds = [...leaderList, ...memberList].map((team) => team.teamId)
    let memberCounts: Record<string, number> = {}
    if (teamIds.length > 0) {
      const { data: members, error: membersError } = await supabase
        .from('team_members')
        .select('team_id')
        .in('team_id', teamIds)
      if (membersError) throw membersError
      memberCounts = (members ?? []).reduce<Record<string, number>>((acc, row) => {
        const teamId = (row as { team_id?: string }).team_id
        if (teamId) acc[teamId] = (acc[teamId] ?? 0) + 1
        return acc
      }, {})
    }

    const attachMemberCount = (team: Omit<MyTeamEntry, 'memberCount'>): MyTeamEntry => ({
      ...team,
      memberCount: Math.max(1, memberCounts[team.teamId] ?? 0),
    })

    myTeams.value = [...leaderList, ...memberList].map(attachMemberCount)

    myTeamRequests.value = (requests ?? [])
      .map((row) => {
        const record = row as {
          id: string
          team_id: string
          status: string
          message?: string | null
          created_at: string
          updated_at?: string | null
          teams?: { event_id?: string | null; name?: string | null } | null
        }
        return {
          id: record.id,
          teamId: record.team_id,
          eventId: record.teams?.event_id ?? null,
          teamName: record.teams?.name ?? '未命名队伍',
          status: record.status ?? 'pending',
          message: record.message ?? null,
          createdAt: record.created_at,
          updatedAt: record.updated_at ?? null,
        }
      })
      .filter((item) => item.status === 'pending')

    const inviterIds = new Set<string>()
    for (const row of invites ?? []) {
      const invitedBy = (row as { invited_by?: string | null }).invited_by
      if (invitedBy) inviterIds.add(invitedBy)
    }
    const inviterMap: Record<string, string> = {}
    if (inviterIds.size > 0) {
      const { data: inviterProfiles, error: inviterError } = await supabase
        .from('profiles')
        .select('id,username')
        .in('id', Array.from(inviterIds))
      if (inviterError) throw inviterError
      for (const profile of inviterProfiles ?? []) {
        const id = (profile as { id?: string }).id
        const name = (profile as { username?: string | null }).username
        if (id && name) inviterMap[id] = name
      }
    }

    myTeamInvites.value = (invites ?? [])
      .map((row) => {
        const record = row as {
          id: string
          team_id: string
          status: string
          message?: string | null
          invited_by?: string | null
          created_at: string
          updated_at?: string | null
          teams?: { event_id?: string | null; name?: string | null } | null
        }
        return {
          id: record.id,
          teamId: record.team_id,
          eventId: record.teams?.event_id ?? null,
          teamName: record.teams?.name ?? '未命名队伍',
          invitedById: record.invited_by ?? null,
          invitedByName: record.invited_by ? inviterMap[record.invited_by] ?? null : null,
          status: record.status ?? 'pending',
          message: record.message ?? null,
          createdAt: record.created_at,
          updatedAt: record.updated_at ?? null,
        }
      })
      .filter((item) => item.status === 'pending')

    const eventIds = new Set<string>()
    for (const team of myTeams.value) {
      if (team.eventId) eventIds.add(team.eventId)
    }
    for (const request of myTeamRequests.value) {
      if (request.eventId) eventIds.add(request.eventId)
    }
    for (const invite of myTeamInvites.value) {
      if (invite.eventId) eventIds.add(invite.eventId)
    }
    await Promise.all(Array.from(eventIds).map((id) => store.fetchEventById(id)))
    teamsLoaded.value = true
  } catch (error) {
    const message = error instanceof Error ? error.message : '队伍信息加载失败'
    teamsError.value = message
  } finally {
    teamsLoading.value = false
  }
}

const eventSummary = (description: string | null) => getEventSummaryText(description)

const shouldIgnoreCardNav = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null
  if (!target) return false
  return Boolean(target.closest('a,button,input,textarea,select,label'))
}

const handleCardDblClick = (event: MouseEvent, eventId: string) => {
  if (shouldIgnoreCardNav(event)) return
  void router.push(`/events/${eventId}`)
}

const syncProfileForm = () => {
  const profile = store.profile
  const contacts = store.contacts
  username.value = profile?.username ?? ''
  avatarUrl.value = profile?.avatar_url ?? ''
  optimisticAvatarUrl.value = '' // Reset optimistic avatar when syncing from store
  roles.value = Array.isArray(profile?.roles) ? [...(profile?.roles ?? [])] : []
  phone.value = contacts?.phone ?? ''
  qq.value = contacts?.qq ?? ''
}


const validateProfile = () => {
  const nextErrors: Record<string, string> = {}
  const name = username.value.trim()
  if (!name) {
    nextErrors.username = '用户名必填'
  } else if (name.length < 2 || name.length > 20) {
    nextErrors.username = '用户名长度需在 2-20 个字符之间'
  }

  const digitsPattern = /^[0-9]*$/
  if (phone.value && !digitsPattern.test(phone.value)) {
    nextErrors.phone = '电话仅允许数字'
  }
  if (qq.value && !digitsPattern.test(qq.value)) {
    nextErrors.qq = 'QQ 仅允许数字'
  }

  profileErrors.value = nextErrors
  return Object.keys(nextErrors).length === 0
}

const filterDigits = (event: Event) => {
  const target = event.target as HTMLInputElement
  const next = target.value.replace(/\D/g, '')
  if (target.value !== next) {
    target.value = next
  }
  return next
}

const toggleRole = (roleId: string) => {
  if (roles.value.includes(roleId)) {
    roles.value = roles.value.filter((item) => item !== roleId)
  } else {
    roles.value = [...roles.value, roleId]
  }
}

const handleSaveProfile = async () => {
  if (!validateProfile()) return
  saveBusy.value = true
  saveError.value = ''
  const profilePayload = {
    username: username.value.trim(),
    avatar_url: avatarUrl.value.trim() || null,
    roles: roles.value,
  }
  const contactsPayload = {
    phone: phone.value.trim() || null,
    qq: qq.value.trim() || null,
  }

  const { error: profileError } = await store.updateMyProfile(profilePayload)
  if (profileError) {
    saveError.value = profileError
    // Reset optimistic avatar on error
    optimisticAvatarUrl.value = ''
    // Reset store's optimistic avatar too
    if (store.profile?.avatar_url) {
      store.setOptimisticAvatar(store.profile.avatar_url)
    }
    saveBusy.value = false
    return
  }

  const { error: contactsError } = await store.upsertMyContacts(contactsPayload)
  if (contactsError) {
    saveError.value = contactsError
    saveBusy.value = false
    return
  }

  store.setBanner('info', '个人资料已保存')
  saveBusy.value = false
  isEditing.value = false
  // Clear optimistic avatar since the real one is now loaded
  optimisticAvatarUrl.value = ''
}

const resetPasswordState = () => {
  passwordError.value = ''
  passwordInfo.value = ''
  passwordErrors.value = {}
}

const validatePassword = () => {
  const nextErrors: Record<string, string> = {}
  if (!currentPassword.value) nextErrors.currentPassword = '请输入当前密码'
  if (!newPassword.value) nextErrors.newPassword = '请输入新密码'
  if (!confirmPassword.value) nextErrors.confirmPassword = '请确认新密码'
  if (newPassword.value && newPassword.value.length < 6) {
    nextErrors.newPassword = '新密码至少 6 位'
  }
  if (newPassword.value && confirmPassword.value && newPassword.value !== confirmPassword.value) {
    nextErrors.confirmPassword = '两次输入的新密码不一致'
  }
  passwordErrors.value = nextErrors
  return Object.keys(nextErrors).length === 0
}

const handleUpdatePassword = async () => {
  if (!store.user?.email) {
    passwordError.value = '当前账号缺少邮箱信息'
    return
  }
  resetPasswordState()
  if (!validatePassword()) return
  passwordBusy.value = true
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: store.user.email,
    password: currentPassword.value,
  })
  if (signInError) {
    passwordBusy.value = false
    passwordErrors.value = {
      ...passwordErrors.value,
      currentPassword: '密码错误',
    }
    return
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword.value })
  if (updateError) {
    passwordError.value = updateError.message
  } else {
    passwordInfo.value = '密码已更新'
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    await store.refreshUser()
  }
  passwordBusy.value = false
}

// Handle notification clicks with special handling for judge notifications
const handleNotificationClick = async (notification: any) => {
  // Check if this is a judge notification
  if (notification.id.startsWith('judge-invited:') || notification.id.startsWith('judge-removed:')) {
    // Extract event ID from notification ID
    const parts = notification.id.split(':')
    if (parts.length >= 2) {
      const eventId = parts[1]
      const redirectPath = await store.handleJudgeNotificationClick(notification.id, eventId)
      await router.push(redirectPath)
      return
    }
  }
  
  // For regular notifications, use the standard link
  store.markNotificationRead(notification.id)
  if (notification.link) {
    await router.push(notification.link)
  }
}

onMounted(async () => {
  await store.refreshUser()
  await store.loadMyProfile()
  await store.loadMyContacts()
  await store.ensureEventsLoaded()
  await store.ensureRegistrationsLoaded()
  void loadMyTeamsOverview()
  syncProfileForm()
})

watch(
  () => store.profile,
  () => {
    syncProfileForm()
  },
)

watch(
  () => store.contacts,
  () => {
    syncProfileForm()
  },
)

watch(
  () => props.tab,
  async (tab) => {
    if (tab !== 'created') return
    await store.refreshUser()
    if (!store.isAdmin) {
      await router.replace('/me/profile')
    }
  },
  { immediate: true },
)

watch(
  () => props.tab,
  (tab) => {
    if (tab !== 'teams') return
    void loadMyTeamsOverview()
  },
  { immediate: true },
)

watch(
  () => store.user?.id,
  () => {
    teamsLoaded.value = false
    if (props.tab === 'teams') {
      void loadMyTeamsOverview()
    }
  },
)
</script>

<template>
  <main class="main profile-page">
    <section class="page-head">
      <div>
        <h1>个人中心</h1>
        <p class="muted">管理你的资料、账号以及参与的活动</p>
      </div>
    </section>

    <section v-if="!isAuthed" class="empty-state">
      <h2>请先登录</h2>
      <p class="muted">登录后才能查看和编辑个人资料</p>
      <div class="empty-state__actions">
        <button class="btn btn--primary" type="button" @click="store.openAuth('sign_in')">登录</button>
      </div>
    </section>

    <div v-else class="profile-layout">
      <!-- Sidebar -->
      <aside class="profile-sidebar">
        <nav class="sidebar-nav">
          <button 
            class="sidebar-tab" 
            :class="{ active: activeTab === 'profile' }" 
            @click="goTab('profile')"
          >
            <User :size="18" />
            <span>个人资料</span>
            <span v-if="store.isProfileIncomplete" class="tab-dot"></span>
          </button>
          <button 
            class="sidebar-tab" 
            :class="{ active: activeTab === 'security' }" 
            @click="goTab('security')"
          >
            <Shield :size="18" />
            <span>账号安全</span>
          </button>
          <button 
            class="sidebar-tab" 
            :class="{ active: activeTab === 'notifications' }" 
            @click="goTab('notifications')"
          >
            <Bell :size="18" />
            <span>消息通知</span>
            <span v-if="unreadNotifications > 0" class="tab-dot"></span>
          </button>
          <div class="sidebar-divider"></div>
          <button 
            class="sidebar-tab" 
            :class="{ active: activeTab === 'joined' }" 
            @click="goTab('joined')"
          >
            <Calendar :size="18" />
            <span>我参加的活动</span>
          </button>
          <button 
            class="sidebar-tab" 
            :class="{ active: activeTab === 'teams' }" 
            @click="goTab('teams')"
          >
            <Users :size="18" />
            <span>我的队伍</span>
            <span v-if="teamNotificationCount > 0" class="tab-dot"></span>
          </button>
          <button 
            v-if="store.isAdmin"
            class="sidebar-tab" 
            :class="{ active: activeTab === 'created' }" 
            @click="goTab('created')"
          >
            <PlusCircle :size="18" />
            <span>我发起的活动</span>
          </button>
        </nav>
      </aside>

      <!-- Content Area -->
      <div class="profile-content">
        <!-- Profile Tab -->
        <div v-if="activeTab === 'profile'" class="profile-panel">
          <div v-if="!isEditing" class="profile-view">
            <div class="profile-header">
              <div class="profile-avatar-display">
                <img v-if="avatarPreview" :src="avatarPreview" alt="avatar" />
                <div v-else class="avatar-placeholder">无头像</div>
              </div>
              <div class="profile-info">
                <h2 class="profile-name">{{ username || '未设置昵称' }}</h2>
                <div class="profile-roles" v-if="sortedRoleBadges.length">
                  <span
                    v-for="badge in sortedRoleBadges"
                    :key="badge.key"
                    :class="['role-badge', `role-tag--${badge.key}`]"
                  >
                    {{ badge.label }}
                  </span>
                </div>
                <p v-else class="muted text-sm">暂未选择职能</p>
              </div>
            </div>

            <div class="profile-details">
              <div class="detail-item">
                <span class="detail-label">
                  电话
                  <span v-if="!phone" class="dot-notify"></span>
                </span>
                <span class="detail-value">{{ phone || '-' }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">
                  QQ
                  <span v-if="!qq" class="dot-notify"></span>
                </span>
                <span class="detail-value">{{ qq || '-' }}</span>
              </div>
            </div>

            <div class="profile-actions">
              <button class="btn btn--primary" type="button" @click="isEditing = true">修改资料</button>
            </div>
          </div>

          <!-- Edit Mode -->
          <form v-else class="form" @submit.prevent="handleSaveProfile">
            <h3 class="panel-title">编辑资料</h3>
            <p v-if="store.profileError" class="alert error">{{ store.profileError }}</p>
            <p v-if="store.contactsError" class="alert error">{{ store.contactsError }}</p>
            
            <div class="profile-avatar">
              <div class="avatar-preview-wrapper">
                <button class="avatar-preview-btn" type="button" @click="showAvatarCropper = true">
                  <div class="avatar-preview">
                    <img v-if="avatarPreview" :src="avatarPreview" alt="avatar" />
                    <div v-else class="avatar-placeholder">暂无头像</div>
                  </div>
                  <div class="avatar-edit-trigger">
                    <Camera :size="20" />
                    <span>更换</span>
                  </div>
                </button>
              </div>
              <div class="avatar-actions">
                <p class="muted">点击左侧头像区域进行图片上传与裁剪</p>
              </div>
            </div>

            <Teleport to="body">
              <AvatarCropperModal
                v-if="showAvatarCropper"
                :initial-image="avatarPreview"
                @close="showAvatarCropper = false"
                @save="handleAvatarSave"
              />
            </Teleport>

            <label class="field" :class="{ 'field--error': profileErrors.username }">
              <span>用户名</span>
              <input v-model="username" type="text" placeholder="请输入用户名" />
              <p v-if="profileErrors.username" class="help-text error-text">{{ profileErrors.username }}</p>
            </label>

            <label class="field" :class="{ 'field--error': profileErrors.phone }">
              <span>
                电话
                <span v-if="!phone" class="dot-notify"></span>
              </span>
              <input
                v-model="phone"
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                placeholder="仅允许数字"
                @input="phone = filterDigits($event)"
              />
              <p v-if="profileErrors.phone" class="help-text error-text">{{ profileErrors.phone }}</p>
            </label>

            <label class="field" :class="{ 'field--error': profileErrors.qq }">
              <span>
                QQ
                <span v-if="!qq" class="dot-notify"></span>
              </span>
              <input
                v-model="qq"
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                placeholder="仅允许数字"
                @input="qq = filterDigits($event)"
              />
              <p v-if="profileErrors.qq" class="help-text error-text">{{ profileErrors.qq }}</p>
            </label>

            <div class="field">
              <span>职能（可多选）</span>
              <div class="role-options">
                <label v-for="option in roleOptions" :key="option.id" class="role-option">
                  <input
                    type="checkbox"
                    :checked="roles.includes(option.id)"
                    @change="toggleRole(option.id)"
                  />
                  <span>{{ option.label }}</span>
                </label>
              </div>
            </div>

            <p v-if="saveError" class="alert error">{{ saveError }}</p>
            <div class="profile-actions">
              <button class="btn" type="button" @click="cancelEdit">取消</button>
              <button
                class="btn btn--primary"
                type="submit"
                :disabled="saveBusy || store.profileLoading || store.contactsLoading"
              >
                {{ saveBusy ? '保存中...' : '保存资料' }}
              </button>
            </div>
          </form>
        </div>

        <!-- Security Tab -->
        <div v-else-if="activeTab === 'security'" class="profile-panel">
          <form class="form" @submit.prevent="handleUpdatePassword">
            <h3 class="panel-title">修改密码</h3>
            <label class="field" :class="{ 'field--error': passwordErrors.currentPassword }">
              <span>当前密码</span>
              <input v-model="currentPassword" type="password" placeholder="请输入当前密码" />
              <p v-if="passwordErrors.currentPassword" class="help-text error-text">{{ passwordErrors.currentPassword }}</p>
            </label>

            <label class="field" :class="{ 'field--error': passwordErrors.newPassword }">
              <span>新密码</span>
              <input v-model="newPassword" type="password" placeholder="请输入新密码" />
              <p v-if="passwordErrors.newPassword" class="help-text error-text">{{ passwordErrors.newPassword }}</p>
            </label>

            <label class="field" :class="{ 'field--error': passwordErrors.confirmPassword }">
              <span>确认新密码</span>
              <input v-model="confirmPassword" type="password" placeholder="再次输入新密码" />
              <p v-if="passwordErrors.confirmPassword" class="help-text error-text">{{ passwordErrors.confirmPassword }}</p>
            </label>

            <p v-if="passwordError" class="alert error">{{ passwordError }}</p>
            <p v-if="passwordInfo" class="alert info">{{ passwordInfo }}</p>

            <div class="profile-actions">
              <button class="btn btn--primary" type="submit" :disabled="passwordBusy">
                {{ passwordBusy ? '更新中...' : '更新密码' }}
              </button>
            </div>
          </form>
        </div>

        <!-- Notifications Tab -->
        <div v-else-if="activeTab === 'notifications'" class="profile-panel">
          <div class="panel-head">
            <h3 class="panel-title">消息通知</h3>
            <div v-if="unreadNotifications > 0 || readNotificationsCount > 0" class="panel-head__actions">
              <button
                v-if="unreadNotifications > 0"
                class="btn btn--ghost"
                type="button"
                @click="store.markAllNotificationsRead"
              >
                全部已读
              </button>
              <button
                v-if="readNotificationsCount > 0"
                class="btn btn--danger"
                type="button"
                @click="store.deleteReadNotifications"
              >
                <Trash2 :size="16" />
                删除已读
              </button>
            </div>
          </div>

          <div v-if="notifications.length === 0" class="empty-state empty-state--compact">
            <h3>暂无消息</h3>
            <p class="muted">活动提醒与队伍消息会显示在这里</p>
          </div>

          <div v-else class="notification-list">
            <article
              v-for="item in notifications"
              :key="item.id"
              class="notification-item"
              :class="{ unread: !item.read }"
            >
              <div class="notification-item__head">
                <h4>{{ item.title }}</h4>
                <time>{{ formatDateTime(item.created_at) }}</time>
              </div>
              <p class="muted">{{ item.body }}</p>
              <div class="notification-item__actions">
                <button
                  v-if="item.link"
                  class="btn btn--ghost"
                  @click="handleNotificationClick(item)"
                >
                  查看详情
                </button>
              </div>
            </article>
          </div>
        </div>

        <!-- Teams Tab -->
        <div v-else-if="activeTab === 'teams'" class="profile-panel">
          <div class="panel-head">
            <h3 class="panel-title">我的队伍</h3>
          </div>

          <div v-if="teamsLoading" class="empty-state empty-state--compact">
            <h3>加载中</h3>
            <p class="muted">正在获取你的队伍信息...</p>
          </div>

          <div v-else>
            <section v-if="myTeamRequests.length > 0" class="profile-subsection">
              <h4 class="profile-subtitle">我的申请</h4>
              <div class="notification-list">
                <article v-for="request in myTeamRequests" :key="request.id" class="notification-item">
                  <div class="notification-item__head">
                    <h4>{{ request.teamName }}</h4>
                    <span class="pill-badge" :class="requestStatusClass(request.status)">
                      {{ requestStatusLabel(request.status) }}
                    </span>
                  </div>
                  <p class="muted">活动：{{ getEventTitle(request.eventId) }}</p>
                  <p class="muted">申请消息：{{ request.message || '无' }}</p>
                  <p class="muted">申请时间：{{ formatDateTime(request.createdAt) }}</p>
                  <div class="notification-item__actions">
                    <RouterLink
                      v-if="request.eventId"
                      class="btn btn--ghost"
                      :to="getTeamLink(request.eventId, request.teamId)"
                    >
                      查看队伍
                    </RouterLink>
                    <button
                      v-if="request.status === 'pending'"
                      class="btn btn--danger"
                      type="button"
                      :disabled="cancelRequestBusyId === request.id"
                      @click="handleCancelRequest(request)"
                    >
                      {{ cancelRequestBusyId === request.id ? '取消中...' : '取消申请' }}
                    </button>
                  </div>
                </article>
              </div>
            </section>

            <section v-if="myTeamInvites.length > 0" class="profile-subsection">
              <h4 class="profile-subtitle">邀请我的</h4>
              <div class="notification-list">
                <article v-for="invite in myTeamInvites" :key="invite.id" class="notification-item">
                  <div class="notification-item__head">
                    <h4>{{ invite.teamName }}</h4>
                    <span class="pill-badge" :class="invite.status === 'pending' ? 'pill-badge--draft' : 'pill-badge--success'">
                      {{ invite.status === 'pending' ? '待确认' : '已处理' }}
                    </span>
                  </div>
                  <p class="muted">活动：{{ getEventTitle(invite.eventId) }}</p>
                  <p class="muted" v-if="invite.invitedByName">邀请人：{{ invite.invitedByName }}</p>
                  <p class="muted">邀请时间：{{ formatDateTime(invite.createdAt) }}</p>
                  <p class="muted" v-if="invite.message">留言：{{ invite.message }}</p>
                  <div class="notification-item__actions">
                    <RouterLink
                      v-if="invite.eventId"
                      class="btn btn--ghost"
                      :to="getTeamLink(invite.eventId, invite.teamId)"
                    >
                      查看队伍
                    </RouterLink>
                    <button
                      v-if="invite.status === 'pending'"
                      class="btn btn--primary"
                      type="button"
                      :disabled="acceptInviteBusyId === invite.id"
                      @click="handleAcceptInvite(invite)"
                    >
                      {{ acceptInviteBusyId === invite.id ? '加入中...' : '同意加入' }}
                    </button>
                  </div>
                </article>
              </div>
            </section>

            <section class="profile-subsection">
              <h4 class="profile-subtitle">我的队伍</h4>
              <div v-if="myTeams.length === 0" class="empty-state empty-state--compact">
                <h3>暂无队伍</h3>
                <p class="muted">加入或创建队伍后会显示在这里</p>
              </div>
              <div v-else class="notification-list">
                <article v-for="team in myTeams" :key="team.teamId" class="notification-item">
                  <div class="notification-item__head">
                    <h4>{{ team.teamName }}</h4>
                    <div class="team-card-meta">
                      <span class="pill-badge team-count">
                        <Users :size="14" />
                        <span>成员数 {{ team.memberCount }}</span>
                      </span>
                      <span
                        class="pill-badge"
                        :class="team.role === 'leader' ? 'pill-badge--leader' : 'pill-badge--draft'"
                      >
                        {{ team.role === 'leader' ? '队长' : '成员' }}
                      </span>
                    </div>
                  </div>
                  <p class="muted">活动：{{ getEventTitle(team.eventId) }}</p>
                  <div class="notification-item__actions">
                    <RouterLink
                      v-if="team.eventId"
                      class="btn btn--ghost"
                      :to="getTeamLink(team.eventId, team.teamId)"
                    >
                      查看队伍
                    </RouterLink>
                  </div>
                </article>
              </div>
            </section>

            <p v-if="teamsError" class="alert error">{{ teamsError }}</p>
          </div>
        </div>

        <!-- Joined Events Tab -->
        <div v-else-if="activeTab === 'joined'">
          <div v-if="store.eventsLoading" class="skeleton-grid">
            <div v-for="n in 3" :key="n" class="skeleton-card"></div>
          </div>
          <div v-else-if="joinedEvents.length === 0" class="empty-state empty-state--compact">
            <h3>你还没有参加任何活动</h3>
            <p class="muted">去浏览一下最新的活动吧！</p>
            <div class="empty-state__actions">
              <RouterLink to="/events" class="btn btn--primary">查看活动</RouterLink>
            </div>
          </div>
          <div v-else class="activity-grid">
            <EventCard
              v-for="event in joinedEvents"
              :key="event.id"
              :event="event"
              :time-label="formatDateRange(event.start_time, event.end_time)"
              :summary="eventSummary(event.description)"
              @card-dblclick="handleCardDblClick($event, event.id)"
            >
              <template #badges>
                <span class="pill-badge pill-badge--success">已报名</span>
              </template>
              <template #meta>
                <span class="meta-item">地点：{{ locationLabel(event.location) }}</span>
                <span class="meta-item">队伍最大人数：{{ teamSizeLabel(event.team_max_size) }}</span>
              </template>
              <template #actions>
                <RouterLink class="btn btn--primary" :to="`/events/${event.id}`">查看详情</RouterLink>
              </template>
            </EventCard>
          </div>
        </div>

        <!-- Created Events Tab -->
        <div v-else-if="activeTab === 'created' && store.isAdmin">
          <div v-if="store.eventsLoading" class="skeleton-grid">
            <div v-for="n in 3" :key="n" class="skeleton-card"></div>
          </div>
          <div v-else-if="createdEvents.length === 0" class="empty-state empty-state--compact">
            <h3>你还没有发起活动</h3>
            <p class="muted">创建一个新的活动开始吧</p>
            <div class="empty-state__actions">
              <button class="btn btn--primary" @click="store.openCreateModal">发起活动</button>
            </div>
          </div>
          <div v-else class="activity-grid">
            <EventCard
              v-for="event in createdEvents"
              :key="event.id"
              :event="event"
              :time-label="formatDateRange(event.start_time, event.end_time)"
              :summary="eventSummary(event.description)"
              @card-dblclick="handleCardDblClick($event, event.id)"
            >
              <template #badges>
                <span v-if="event.status === 'draft'" class="pill-badge">草稿</span>
                <span v-else-if="event.status === 'published'" class="pill-badge pill-badge--success">进行中</span>
                <span v-else class="pill-badge pill-badge--neutral">已结束</span>
              </template>
              <template #meta>
                <span class="meta-item">地点：{{ locationLabel(event.location) }}</span>
                <span class="meta-item">队伍最大人数：{{ teamSizeLabel(event.team_max_size) }}</span>
              </template>
              <template #actions>
                <RouterLink class="btn btn--primary" :to="`/events/${event.id}`">管理活动</RouterLink>
              </template>
            </EventCard>
          </div>
        </div>

      </div>
    </div>
  </main>
</template>

<style scoped>
.profile-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 32px;
  align-items: start;
}

@media (max-width: 768px) {
  .profile-layout {
    grid-template-columns: 1fr;
    gap: 24px;
  }
}

/* Sidebar Styles */
.profile-sidebar {
  background: white;
  border-radius: 16px;
  padding: 16px;
  border: 1px solid var(--border);
  position: sticky;
  top: 24px;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar-tab {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: transparent;
  text-align: left;
  font-size: 0.95rem;
  color: var(--muted);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
}

.sidebar-tab:hover {
  background: var(--surface);
  color: var(--ink);
}

.sidebar-tab.active {
  background: rgba(31, 111, 109, 0.08);
  color: var(--accent);
  font-weight: 600;
}

.sidebar-divider {
  height: 1px;
  background: var(--border);
  margin: 8px 0;
  opacity: 0.5;
}

/* Content Styles */
.profile-content {
  min-width: 0; /* Prevent grid blowout */
}

.profile-panel {
  background: white;
  border-radius: 16px;
  padding: 24px;
  border: 1px solid var(--border);
}

.panel-title {
  margin: 0 0 24px;
  font-size: 1.25rem;
  font-weight: 700;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.panel-head__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.profile-subsection {
  display: grid;
  gap: 12px;
}
.profile-subsection + .profile-subsection {
  margin-top: 24px;
}
.profile-subtitle {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--ink);
}

.tab-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e04646;
  margin-left: auto;
}

.dot-notify {
  display: inline-block;
  width: 6px;
  height: 6px;
  background-color: #e04646;
  border-radius: 50%;
  vertical-align: top;
  margin-left: 2px;
}

.notification-list {
  display: grid;
  gap: 12px;
}

.notification-item {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.9);
  display: grid;
  gap: 10px;
}

.notification-item.unread {
  border-color: rgba(224, 70, 70, 0.45);
  box-shadow: 0 0 0 2px rgba(224, 70, 70, 0.08);
}

.notification-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.notification-item__head h4 {
  margin: 0;
  font-size: 1rem;
}

.notification-item__head time {
  font-size: 0.78rem;
  color: var(--muted);
}

.notification-item__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.team-card-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.team-count {
  gap: 6px;
  text-transform: none;
  letter-spacing: 0;
}

.pill-badge--leader {
  background: #fff7f5;
  color: #9a3412;
  border: 1px solid var(--accent-2);
  font-weight: 800;
  letter-spacing: 0.02em;
  box-shadow: none;
}

.team-count svg {
  flex-shrink: 0;
}

.empty-state--compact {
  background: white;
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 40px 24px;
  min-height: auto;
}

.profile-avatar {
  align-items: center;
  gap: 20px;
}

.avatar-preview-wrapper {
  flex-shrink: 0;
}

.avatar-preview-btn {
  position: relative;
  padding: 0;
  border: none;
  background: none;
  border-radius: 22px;
  cursor: pointer;
  overflow: hidden;
  display: block;
}

.avatar-preview-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.avatar-preview {
  transition: filter 0.2s ease;
}

.avatar-preview-btn:hover .avatar-preview {
  filter: brightness(0.8);
}

.avatar-edit-trigger {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: white;
  background-color: rgba(0, 0, 0, 0.4);
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
  font-weight: 600;
  font-size: 0.9rem;
}

.avatar-preview-btn:hover .avatar-edit-trigger {
  opacity: 1;
}

.avatar-actions {
  display: grid;
  gap: 8px;
  align-self: start;
}

.avatar-actions p {
  margin: 0;
  font-size: 0.9rem;
}

/* Read-only View Styles */
.profile-view {
  display: grid;
  gap: 24px;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 20px;
}

.profile-avatar-display {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid rgba(18, 33, 30, 0.12);
  background: var(--surface-strong);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.profile-avatar-display img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-info {
  display: grid;
  gap: 6px;
}

.profile-name {
  margin: 0;
  font-family: 'Sora', sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
}

.profile-roles {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.role-badge {
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--role-bg, rgba(31, 111, 109, 0.1));
  color: var(--role-text, var(--accent));
  font-size: 0.8rem;
  font-weight: 600;
}

.profile-details {
  display: grid;
  gap: 12px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 16px;
  border: 1px solid rgba(18, 33, 30, 0.06);
}

.detail-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px dashed rgba(18, 33, 30, 0.1);
}

.detail-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.detail-label {
  color: var(--muted);
  font-size: 0.9rem;
}

.detail-value {
  font-weight: 600;
  color: var(--ink);
}

.role-options {
  display: flex !important;
  flex-wrap: nowrap !important;
  gap: 16px;
  overflow-x: auto;
  padding: 4px 2px 12px;
  width: 100%;
  -webkit-overflow-scrolling: touch;
}

.role-options::-webkit-scrollbar {
  height: 4px;
}

.role-options::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 10px;
}

.role-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 0.9rem;
  flex: 0 0 auto !important;
  white-space: nowrap;
  cursor: pointer;
}
</style>
