import { computed, proxyRefs, ref } from 'vue'
import type { Subscription, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { buildEventDescription, createDefaultEventDetails, generateId } from '../utils/eventDetails'
import { demoEvents } from './demoEvents'
import { EVENT_SELECT } from './eventSchema'
import { 
  enhancedErrorHandler, 
  handleErrorWithBanner, 
  handleSuccessWithBanner,
  authErrorHandler,
  formErrorHandler,
  apiErrorHandler,
  uploadErrorHandler,
  teamErrorHandler,
  eventErrorHandler,
  profileErrorHandler
} from './enhancedErrorHandling'
import type {
  AuthView,
  DisplayEvent,
  Event,
  EventStatus,
  Profile,
  TeamJoinRequest,
  TeamJoinRequestRecord,
  TeamInvite,
  TeamLobbyTeam,
  TeamSeeker,
  TeamMember,
  UserContacts,
  MyTeamEntry,
  MyTeamRequest,
  MyTeamInvite,
  SubmissionWithTeam,
  JudgeWithProfile,
  JudgePermission,
  UserSearchResult,
} from './models'

export type { AuthView, DisplayEvent, Event, EventStatus } from './models'

type RegistrationRow = {
  id: string
  event_id: string
  status: string | null
}

type NotificationItem = {
  id: string
  title: string
  body: string
  created_at: string
  read: boolean
  link?: string
}

const user = ref<User | null>(null)
const events = ref<Event[]>([])
const eventsLoading = ref(false)
const eventsLoaded = ref(false)
const eventsError = ref('')

const bannerInfo = ref('')
const bannerError = ref('')

const registrationsLoading = ref(false)
const registrationsLoaded = ref(false)
const registrationBusyEventId = ref<string | null>(null)
const myRegistrationByEventId = ref<Record<string, string>>({})

const deleteBusyEventId = ref<string | null>(null)

const authModalOpen = ref(false)
const authView = ref<AuthView>('sign_in')
const authEmail = ref('')
const authPassword = ref('')
const authFullName = ref('')
const authBusy = ref(false)
const authError = ref('')
const authInfo = ref('')

const createModalOpen = ref(false)
const createTitle = ref('')
const createStartTime = ref('')
const createEndTime = ref('')
const createLocation = ref('')
const createTeamMaxSize = ref('')
const createDescription = ref('')

const createBusy = ref(false)
const createError = ref('')

const isAuthed = computed(() => Boolean(user.value))
const isAdmin = computed(() => user.value?.app_metadata?.role === 'admin')
const showDemoEvents = computed(
  () => !eventsLoading.value && events.value.length === 0 && demoEvents.length > 0,
)
const displayedEvents = computed<DisplayEvent[]>(() => {
  return events.value.length ? (events.value as DisplayEvent[]) : demoEvents
})
const publicEvents = computed<DisplayEvent[]>(() => {
  return displayedEvents.value.filter((event) => event.status !== 'draft')
})
const myEvents = computed<DisplayEvent[]>(() => {
  if (!user.value) return []
  return displayedEvents.value.filter((event) => event.created_by === user.value?.id)
})
const profile = ref<Profile | null>(null)
const profileLoading = ref(false)
const profileError = ref('')

const contacts = ref<UserContacts | null>(null)
const contactsLoading = ref(false)
const contactsError = ref('')

const notifications = ref<NotificationItem[]>([])
const notificationsLoaded = ref(false)
const unreadNotifications = computed(() => notifications.value.filter((item) => !item.read).length)

const pendingRequestsCount = ref(0)
const pendingInvitesCount = ref(0)
const isProfileIncomplete = computed(() => {
  if (!user.value) return false
  // Consider incomplete if contacts not loaded yet (but only if not loading), or if phone/qq is missing
  if (!contacts.value && !contactsLoading.value) return true
  if (contacts.value) {
    return !contacts.value.phone?.trim() || !contacts.value.qq?.trim()
  }
  return false
})

const hasAnyNotification = computed(() => {
  return (
    unreadNotifications.value > 0 ||
    pendingRequestsCount.value > 0 ||
    pendingInvitesCount.value > 0 ||
    isProfileIncomplete.value
  )
})

const loadMyPendingTeamActions = async () => {
  if (!user.value) {
    pendingRequestsCount.value = 0
    pendingInvitesCount.value = 0
    return
  }

  const { count: requestCount } = await supabase
    .from('team_join_requests')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.value.id)
    .eq('status', 'pending')

  const { count: inviteCount } = await supabase
    .from('team_invites')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.value.id)
    .eq('status', 'pending')

  pendingRequestsCount.value = requestCount ?? 0
  pendingInvitesCount.value = inviteCount ?? 0
}

const teamsByEventId = ref<Record<string, TeamLobbyTeam[]>>({})
const teamMembersByTeamId = ref<Record<string, TeamMember[]>>({})
const teamMembershipByTeamId = ref<Record<string, boolean>>({})
const teamRequestStatusByTeamId = ref<Record<string, string>>({})
const teamJoinRequestsByTeamId = ref<Record<string, TeamJoinRequestRecord[]>>({})
const teamSeekersByEventId = ref<Record<string, TeamSeeker[]>>({})
const myTeamInviteByTeamId = ref<Record<string, TeamInvite | null>>({})

const submissionsByEventId = ref<Record<string, SubmissionWithTeam[]>>({})
const submissionsLoading = ref(false)
const submissionsError = ref('')

// Judge-related state
const judgesByEventId = ref<Record<string, JudgeWithProfile[]>>({})
const judgePermissionsByEventId = ref<Record<string, JudgePermission>>({})
const judgeWorkspaceLoading = ref(false)
const judgeWorkspaceError = ref('')

// Error handling utilities for judge operations
const isNetworkError = (error: any): boolean => {
  if (!error) return false
  const message = error.message || error.toString()
  return message.includes('网络') || 
         message.includes('连接') || 
         message.includes('timeout') ||
         message.includes('fetch') ||
         message.includes('NetworkError') ||
         error.code === 'NETWORK_ERROR'
}

const getJudgeErrorMessage = (error: any, operation: string): string => {
  if (!error) return `${operation}时发生未知错误`
  
  const message = error.message || error.toString()
  
  // UUID format errors
  if (message.includes('invalid input syntax for type uuid') || message.includes('UUID格式')) {
    return 'ID格式错误，请刷新页面后重试'
  }
  
  // Network errors
  if (isNetworkError(error)) {
    return `网络连接失败，请检查网络后重试`
  }
  
  // Permission errors
  if (message.includes('permission') || message.includes('权限') || error.code === '42501') {
    return '权限不足，请联系管理员'
  }
  
  // Database constraint errors
  if (message.includes('duplicate') || message.includes('重复') || error.code === '23505') {
    return '该用户已经是评委'
  }
  
  // Not found errors
  if (message.includes('not found') || message.includes('不存在') || error.code === '23503') {
    return '用户或活动不存在'
  }
  
  // Rate limiting
  if (message.includes('rate limit') || message.includes('频率限制')) {
    return '操作过于频繁，请稍后再试'
  }
  
  // Log the full error for debugging
  console.error(`Judge operation error (${operation}):`, error)
  
  // Return original message if it's user-friendly, otherwise generic message
  if (message.length < 100 && !message.includes('Error:') && !message.includes('Exception')) {
    return message
  }
  
  return `${operation}失败，请稍后重试`
}

const displayName = computed(() => {
  return profile.value?.username || user.value?.user_metadata?.full_name || '用户'
})

const isDemoEvent = (event: DisplayEvent) => Boolean(event.is_demo)

let bannerTimeout: number | undefined
const setBanner = (type: 'info' | 'error', text: string) => {
  bannerInfo.value = ''
  bannerError.value = ''
  window.clearTimeout(bannerTimeout)

  if (type === 'info') {
    bannerInfo.value = text
  } else {
    bannerError.value = text
  }

  bannerTimeout = window.setTimeout(() => {
    bannerInfo.value = ''
    bannerError.value = ''
  }, 2000) // 2 seconds then fade via transition
}

// Initialize enhanced error handler with setBanner callback
enhancedErrorHandler.setBannerCallback(setBanner)

const clearBanners = () => {
  bannerInfo.value = ''
  bannerError.value = ''
  eventsError.value = ''
}

const notificationStorageKey = () => {
  if (!user.value) return ''
  return `notifications:${user.value.id}`
}

const loadNotifications = () => {
  if (!user.value) {
    notifications.value = []
    notificationsLoaded.value = false
    return
  }
  const key = notificationStorageKey()
  if (!key) return
  const raw = window.localStorage.getItem(key)
  if (!raw) {
    notifications.value = []
    notificationsLoaded.value = true
    return
  }
  try {
    const parsed = JSON.parse(raw)
    notifications.value = Array.isArray(parsed) ? (parsed as NotificationItem[]) : []
  } catch {
    notifications.value = []
  }
  notificationsLoaded.value = true
}

const persistNotifications = () => {
  if (!user.value) return
  const key = notificationStorageKey()
  if (!key) return
  window.localStorage.setItem(key, JSON.stringify(notifications.value))
}

const pushNotification = (item: NotificationItem) => {
  if (notifications.value.some((existing) => existing.id === item.id)) return false
  notifications.value = [item, ...notifications.value].slice(0, 200)
  persistNotifications()
  return true
}

const markNotificationRead = (id: string) => {
  const next = notifications.value.map((item) => (item.id === id ? { ...item, read: true } : item))
  notifications.value = next
  persistNotifications()
}

const markAllNotificationsRead = () => {
  notifications.value = notifications.value.map((item) => ({ ...item, read: true }))
  persistNotifications()
}

const deleteReadNotifications = () => {
  const next = notifications.value.filter((item) => !item.read)
  if (next.length === notifications.value.length) return
  notifications.value = next
  persistNotifications()
}

// Judge notification helpers
const createJudgeInvitedNotification = (eventId: string, eventTitle: string): NotificationItem => {
  return {
    id: `judge-invited:${eventId}:${user.value?.id}:${Date.now()}`,
    title: '您被邀请为评委',
    body: `您已被邀请为活动"${eventTitle}"的评委，现在可以访问评委工作台查看作品。`,
    created_at: new Date().toISOString(),
    read: false,
    link: `/events/${eventId}?tab=judge` // Add tab parameter to indicate judge workspace
  }
}

const createJudgeRemovedNotification = (eventId: string, eventTitle: string): NotificationItem => {
  return {
    id: `judge-removed:${eventId}:${user.value?.id}:${Date.now()}`,
    title: '评委权限已撤销',
    body: `您在活动"${eventTitle}"的评委权限已被撤销。`,
    created_at: new Date().toISOString(),
    read: false,
    link: `/events/${eventId}` // Regular event page since they no longer have judge access
  }
}

const pushJudgeNotification = (eventId: string, userId: string, type: 'invited' | 'removed') => {
  const event = getEventById(eventId)
  if (!event) return

  // In a real implementation, this would be sent to the target user via a backend service
  // For now, we only show notifications to the current user if they are the target
  if (user.value?.id === userId) {
    const notification = type === 'invited' 
      ? createJudgeInvitedNotification(eventId, event.title)
      : createJudgeRemovedNotification(eventId, event.title)
    
    pushNotification(notification)
  }
}

// Handle judge notification clicks
const handleJudgeNotificationClick = async (notificationId: string, eventId: string) => {
  // Mark notification as read
  markNotificationRead(notificationId)
  
  // Check if user still has judge permissions
  const permission = await checkJudgePermission(eventId)
  
  // Return the appropriate route based on permissions
  if (permission.canAccessJudgeWorkspace) {
    // If judge workspace is implemented, redirect there
    // For now, redirect to event detail with judge tab parameter
    return `/events/${eventId}?tab=judge`
  } else {
    // If no judge permissions, redirect to regular event page
    return `/events/${eventId}`
  }
}

const normalizeTeamNeeds = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map((item) => `${item ?? ''}`.trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(/[,，、\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

const normalizeTeamRow = (team: any, eventId: string, members = 1): TeamLobbyTeam | null => {
  if (!team || typeof team !== 'object') return null
  const name = typeof team.name === 'string' ? team.name.trim() : ''
  if (!name) return null
  const leaderId = typeof team.leader_id === 'string' ? team.leader_id : ''
  return {
    id: typeof team.id === 'string' && team.id ? team.id : generateId(),
    event_id: typeof team.event_id === 'string' && team.event_id ? team.event_id : eventId,
    leader_id: leaderId,
    name,
    leader_qq: typeof team.leader_qq === 'string' ? team.leader_qq.trim() : '',
    intro: typeof team.intro === 'string' ? team.intro.trim() : '',
    needs: normalizeTeamNeeds(team.needs),
    extra: typeof team.extra === 'string' ? team.extra.trim() : '',
    members: Number.isFinite(members) ? Number(members) : 1,
    is_closed: Boolean((team as { is_closed?: boolean }).is_closed),
    created_at: typeof team.created_at === 'string' ? team.created_at : new Date().toISOString(),
  }
}

const normalizeTeamSeekerRow = (row: any, eventId: string): TeamSeeker | null => {
  if (!row || typeof row !== 'object') return null
  const userId = typeof row.user_id === 'string' ? row.user_id : ''
  if (!userId) return null
  const normalizeRoles = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value.map((item) => `${item ?? ''}`.trim()).filter(Boolean)
    }
    if (typeof value === 'string') {
      return value
        .split(/[,，、\s\n]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    }
    return []
  }
  return {
    id: typeof row.id === 'string' && row.id ? row.id : generateId(),
    event_id: typeof row.event_id === 'string' && row.event_id ? row.event_id : eventId,
    user_id: userId,
    intro: typeof row.intro === 'string' ? row.intro.trim() : '',
    qq: typeof row.qq === 'string' ? row.qq.trim() : '',
    roles: normalizeRoles(row.roles ?? row.role),
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
    profile: row.profile ?? null,
  }
}

const getTeamsForEvent = (eventId: string) => {
  return teamsByEventId.value[eventId] ?? []
}

const getTeamMembers = (teamId: string) => {
  return teamMembersByTeamId.value[teamId] ?? []
}

const getTeamRequestStatus = (teamId: string) => {
  return teamRequestStatusByTeamId.value[teamId] ?? ''
}

const getTeamJoinRequests = (teamId: string) => {
  return teamJoinRequestsByTeamId.value[teamId] ?? []
}

const getMyTeamInvite = (teamId: string) => {
  return myTeamInviteByTeamId.value[teamId] ?? null
}

const getTeamSeekersForEvent = (eventId: string) => {
  return teamSeekersByEventId.value[eventId] ?? []
}

const getMyTeamSeeker = (eventId: string) => {
  if (!user.value) return null
  return getTeamSeekersForEvent(eventId).find((item) => item.user_id === user.value?.id) ?? null
}

const isTeamMember = (teamId: string) => {
  return Boolean(teamMembershipByTeamId.value[teamId])
}

const loadTeamMemberCounts = async (teamIds: string[]) => {
  const counts: Record<string, number> = {}
  if (teamIds.length === 0) return counts

  const { data, error } = await supabase
    .from('team_members')
    .select('team_id,user_id')
    .in('team_id', teamIds)

  if (error) {
    teamErrorHandler.handleError(error, { operation: 'loadTeamMemberCounts' })
    return counts
  }

  for (const row of data ?? []) {
    const teamId = (row as { team_id?: string }).team_id
    if (!teamId) continue
    counts[teamId] = (counts[teamId] ?? 0) + 1
  }

  return counts
}

const loadMyTeamMemberships = async (teamIds: string[]) => {
  if (!user.value || teamIds.length === 0) return
  const next: Record<string, boolean> = {}
  for (const id of teamIds) next[id] = false

  const { data, error } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', user.value.id)
    .in('team_id', teamIds)

  if (error) {
    teamErrorHandler.handleError(error, { operation: 'loadMyTeamMemberships' })
    return
  }

  for (const row of data ?? []) {
    const teamId = (row as { team_id?: string }).team_id
    if (teamId) next[teamId] = true
  }

  teamMembershipByTeamId.value = { ...teamMembershipByTeamId.value, ...next }
}

const loadMyTeamRequests = async (teamIds: string[]) => {
  if (!user.value || teamIds.length === 0) return
  const next: Record<string, string> = {}
  for (const id of teamIds) next[id] = ''

  const { data, error } = await supabase
    .from('team_join_requests')
    .select('id,team_id,status,message,created_at,updated_at')
    .eq('user_id', user.value.id)
    .in('team_id', teamIds)

  if (error) {
    teamErrorHandler.handleError(error, { operation: 'loadMyTeamRequests' })
    return
  }

  for (const row of data ?? []) {
    const typed = row as TeamJoinRequest
    if (typed.team_id) {
      next[typed.team_id] = typed.status
    }
  }

  teamRequestStatusByTeamId.value = { ...teamRequestStatusByTeamId.value, ...next }
}

const loadMyTeamInvite = async (teamId: string) => {
  if (!user.value || !teamId) return null
  const { data, error } = await supabase
    .from('team_invites')
    .select('id,team_id,user_id,invited_by,message,status,created_at,updated_at')
    .eq('team_id', teamId)
    .eq('user_id', user.value.id)
    .maybeSingle()

  if (error) {
    // If the table isn't deployed yet, avoid breaking the whole UI.
    if (error.code === '42P01' || /team_invites/i.test(error.message)) {
      myTeamInviteByTeamId.value = { ...myTeamInviteByTeamId.value, [teamId]: null }
      return null
    }
    teamErrorHandler.handleError(error, { operation: 'loadMyTeamInvite' })
    return null
  }

  const record = (data ?? null) as TeamInvite | null
  myTeamInviteByTeamId.value = { ...myTeamInviteByTeamId.value, [teamId]: record }
  return record
}

const loadTeams = async (eventId: string) => {
  if (!eventId) return []
  const cached = teamsByEventId.value[eventId] ?? []
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (error) {
    teamErrorHandler.handleError(error, { operation: 'loadTeams' })
    return cached
  }

  const rows = Array.isArray(data) ? data : []
  const teamIds = rows.map((row) => row.id).filter(Boolean)
  const counts = await loadTeamMemberCounts(teamIds)
  const nextTeams = rows
    .map((row) => normalizeTeamRow(row, eventId, Math.max(1, counts[row.id] ?? 0)))
    .filter((team): team is TeamLobbyTeam => Boolean(team))

  teamsByEventId.value = { ...teamsByEventId.value, [eventId]: nextTeams }

  if (user.value) {
    await loadMyTeamMemberships(teamIds)
    await loadMyTeamRequests(teamIds)
  } else if (teamIds.length) {
    // 确保未登录或切换账户时，队伍成员标记不会沿用旧用户的状态
    const reset: Record<string, boolean> = {}
    for (const id of teamIds) reset[id] = false
    teamMembershipByTeamId.value = { ...teamMembershipByTeamId.value, ...reset }
  }

  return nextTeams
}

const loadTeamSeekers = async (eventId: string) => {
  if (!eventId) return []
  const { data, error } = await supabase
    .from('team_seekers')
    .select('id,event_id,user_id,intro,qq,roles,created_at,updated_at,profiles(id,username,avatar_url,roles)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (error) {
    teamErrorHandler.handleError(error, { operation: 'loadTeamSeekers' })
    teamSeekersByEventId.value = { ...teamSeekersByEventId.value, [eventId]: [] }
    return []
  }

  const nextSeekers = (data ?? []).map((row) => {
    const record = row as unknown as TeamSeeker & { profiles?: TeamSeeker['profile'] }
    return {
      id: record.id,
      event_id: record.event_id ?? eventId,
      user_id: record.user_id,
      intro: record.intro ?? '',
      qq: record.qq ?? '',
      roles: Array.isArray(record.roles)
        ? record.roles.filter((item) => typeof item === 'string')
        : typeof (record as any).role === 'string'
          ? [(record as any).role]
          : [],
      created_at: record.created_at,
      updated_at: record.updated_at ?? null,
      profile: record.profiles
        ? {
            id: record.profiles.id,
            username: record.profiles.username ?? null,
            avatar_url: record.profiles.avatar_url ?? null,
            roles: Array.isArray(record.profiles.roles) ? record.profiles.roles : null,
          }
        : null,
    }
  })

  teamSeekersByEventId.value = { ...teamSeekersByEventId.value, [eventId]: nextSeekers }
  return nextSeekers
}

const saveTeamSeeker = async (
  eventId: string,
  payload: { intro: string; qq: string; roles: string[] },
) => {
  if (!user.value) return { error: '请先登录。', seeker: null as TeamSeeker | null }
  if (!eventId) return { error: '活动ID缺失。', seeker: null as TeamSeeker | null }

  const { data, error } = await supabase
    .from('team_seekers')
    .upsert(
      {
        event_id: eventId,
        user_id: user.value.id,
        intro: payload.intro,
        qq: payload.qq,
        roles: payload.roles ?? [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'event_id,user_id' },
    )
    .select('id,event_id,user_id,intro,qq,roles,created_at,updated_at')
    .single()

  if (error) {
    return { error: error.message, seeker: null as TeamSeeker | null }
  }

  const seeker = normalizeTeamSeekerRow(data, eventId)
  await loadTeamSeekers(eventId)
  return { error: '', seeker }
}

const deleteTeamSeeker = async (eventId: string, seekerId: string) => {
  if (!user.value) return { error: '请先登录' }
  if (!eventId || !seekerId) return { error: '求组队卡片不存在' }

  const { error } = await supabase.from('team_seekers').delete().eq('id', seekerId)
  if (error) {
    return { error: error.message }
  }

  const current = teamSeekersByEventId.value[eventId] ?? []
  teamSeekersByEventId.value = {
    ...teamSeekersByEventId.value,
    [eventId]: current.filter((item) => item.id !== seekerId),
  }

  return { error: '' }
}

const loadTeamMembers = async (teamId: string) => {
  if (!teamId) return []

  const { data, error } = await supabase
    .from('team_members')
    .select('id,team_id,user_id,joined_at,profiles(id,username,avatar_url,roles)')
    .eq('team_id', teamId)
    .order('joined_at', { ascending: true })

  if (error) {
    if (!user.value) {
      const { data: fallback, error: fallbackError } = await supabase
        .from('team_members')
        .select('id,team_id,user_id,joined_at')
        .eq('team_id', teamId)
        .order('joined_at', { ascending: true })
      if (fallbackError) {
        teamErrorHandler.handleError(fallbackError, { operation: 'loadTeamMembers' })
        teamMembersByTeamId.value = { ...teamMembersByTeamId.value, [teamId]: [] }
        return []
      }
      const nextMembers = (fallback ?? []).map((row) => {
        const record = row as { id: string; team_id: string; user_id: string; joined_at: string }
        return {
          id: record.id,
          team_id: record.team_id,
          user_id: record.user_id,
          joined_at: record.joined_at,
          profile: null,
        }
      })
      teamMembersByTeamId.value = { ...teamMembersByTeamId.value, [teamId]: nextMembers }
      return nextMembers
    }
    teamErrorHandler.handleError(error, { operation: 'loadTeamMembers' })
    teamMembersByTeamId.value = { ...teamMembersByTeamId.value, [teamId]: [] }
    return []
  }

  const nextMembers = (data ?? []).map((row) => {
    const record = row as unknown as {
      id: string
      team_id: string
      user_id: string
      joined_at: string
      profiles: {
        id: string
        username: string | null
        avatar_url: string | null
        roles: string[] | null
      } | null
    }
    return {
      id: record.id,
      team_id: record.team_id,
      user_id: record.user_id,
      joined_at: record.joined_at,
      profile: record.profiles
        ? {
            id: record.profiles.id,
            username: record.profiles.username ?? null,
            avatar_url: record.profiles.avatar_url ?? null,
            roles: Array.isArray(record.profiles.roles) ? record.profiles.roles : null,
          }
        : null,
    }
  })

  teamMembersByTeamId.value = { ...teamMembersByTeamId.value, [teamId]: nextMembers }
  if (user.value) {
    teamMembershipByTeamId.value = {
      ...teamMembershipByTeamId.value,
      [teamId]: nextMembers.some((member) => member.user_id === user.value?.id),
    }
  }
  return nextMembers
}

const loadTeamJoinRequests = async (teamId: string) => {
  if (!teamId) return []
  const { data, error } = await supabase
    .from('team_join_requests')
    .select('id,team_id,user_id,status,message,created_at,updated_at,profiles(id,username,avatar_url,roles)')
    .eq('team_id', teamId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    teamJoinRequestsByTeamId.value = { ...teamJoinRequestsByTeamId.value, [teamId]: [] }
    return []
  }

  const nextRequests = (data ?? []).map((row) => {
    const record = row as unknown as TeamJoinRequestRecord & { profiles?: TeamJoinRequestRecord['profile'] }
    return {
      id: record.id,
      team_id: record.team_id,
      user_id: record.user_id,
      status: record.status,
      message: record.message ?? null,
      created_at: record.created_at,
      updated_at: record.updated_at ?? null,
      profile: record.profiles
        ? {
            id: record.profiles.id,
            username: record.profiles.username ?? null,
            avatar_url: record.profiles.avatar_url ?? null,
            roles: Array.isArray(record.profiles.roles) ? record.profiles.roles : null,
          }
        : null,
    }
  })

  teamJoinRequestsByTeamId.value = { ...teamJoinRequestsByTeamId.value, [teamId]: nextRequests }
  return nextRequests
}

const updateTeamJoinRequestStatus = async (
  requestId: string,
  status: 'approved' | 'rejected',
) => {
  if (!user.value) return { error: '请先登录' }
  const { error } = await supabase
    .from('team_join_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', requestId)
  if (error) {
    return { error: error.message }
  }
  return { error: '' }
}

const createTeam = async (
  eventId: string,
  payload: Pick<TeamLobbyTeam, 'name' | 'leader_qq' | 'intro' | 'needs' | 'extra'>,
) => {
  if (!user.value) return { error: '请先登录', team: null as TeamLobbyTeam | null }
  if (!eventId) return { error: '活动不存在', team: null as TeamLobbyTeam | null }

  const { data, error } = await supabase
    .from('teams')
    .insert({
      event_id: eventId,
      leader_id: user.value.id,
      name: payload.name,
      leader_qq: payload.leader_qq,
      intro: payload.intro,
      needs: normalizeTeamNeeds(payload.needs),
      extra: payload.extra,
    })
    .select('id,event_id,leader_id,name,intro,extra,leader_qq,needs,created_at,updated_at')
    .single()

  if (error) {
    return { error: error.message, team: null as TeamLobbyTeam | null }
  }

  const team = normalizeTeamRow(data, eventId, 1)
  await loadTeams(eventId)
  return { error: '', team }
}

const updateTeam = async (
  eventId: string,
  teamId: string,
  payload: Pick<TeamLobbyTeam, 'name' | 'leader_qq' | 'intro' | 'needs' | 'extra'>,
) => {
  if (!user.value) return { error: '请先登录', team: null as TeamLobbyTeam | null }
  if (!eventId) return { error: '活动不存在', team: null as TeamLobbyTeam | null }
  if (!teamId) return { error: '队伍不存在', team: null as TeamLobbyTeam | null }

  const { data, error } = await supabase
    .from('teams')
    .update({
      name: payload.name,
      leader_qq: payload.leader_qq,
      intro: payload.intro,
      needs: normalizeTeamNeeds(payload.needs),
      extra: payload.extra,
      updated_at: new Date().toISOString(),
    })
    .eq('id', teamId)
    .select('id,event_id,leader_id,name,intro,extra,leader_qq,needs,created_at,updated_at')
    .single()

  if (error) {
    return { error: error.message, team: null as TeamLobbyTeam | null }
  }

  const team = normalizeTeamRow(data, eventId)
  await loadTeams(eventId)
  return { error: '', team }
}

const deleteTeam = async (eventId: string, teamId: string) => {
  if (!user.value) return { error: '请先登录' }
  if (!eventId || !teamId) return { error: '队伍不存在' }

  const { error } = await supabase.from('teams').delete().eq('id', teamId)
  if (error) {
    return { error: error.message }
  }

  const current = teamsByEventId.value[eventId] ?? []
  const nextTeams = current.filter((team) => team.id !== teamId)
  teamsByEventId.value = { ...teamsByEventId.value, [eventId]: nextTeams }

  const nextMembers = { ...teamMembersByTeamId.value }
  const nextMembership = { ...teamMembershipByTeamId.value }
  const nextRequests = { ...teamRequestStatusByTeamId.value }
  const nextJoinRequests = { ...teamJoinRequestsByTeamId.value }
  delete nextMembers[teamId]
  delete nextMembership[teamId]
  delete nextRequests[teamId]
  delete nextJoinRequests[teamId]
  teamMembersByTeamId.value = nextMembers
  teamMembershipByTeamId.value = nextMembership
  teamRequestStatusByTeamId.value = nextRequests
  teamJoinRequestsByTeamId.value = nextJoinRequests

  return { error: '' }
}

const closeTeam = async (teamId: string) => {
  if (!user.value) return { error: '请先登录' }
  if (!teamId) return { error: '队伍不存在' }

  const { error } = await supabase
    .from('teams')
    .update({ is_closed: true, updated_at: new Date().toISOString() })
    .eq('id', teamId)
    .eq('leader_id', user.value.id)

  if (error) {
    return { error: error.message }
  }

  // 更新本地缓存
  const nextByEvent: Record<string, TeamLobbyTeam[]> = { ...teamsByEventId.value }
  for (const [eventId, list] of Object.entries(nextByEvent)) {
    nextByEvent[eventId] = list.map((team) =>
      team.id === teamId ? { ...team, is_closed: true } : team,
    )
  }
  teamsByEventId.value = nextByEvent
  return { error: '' }
}

const reopenTeam = async (teamId: string) => {
  if (!user.value) return { error: '请先登录' }
  if (!teamId) return { error: '队伍不存在' }

  const { error } = await supabase
    .from('teams')
    .update({ is_closed: false, updated_at: new Date().toISOString() })
    .eq('id', teamId)
    .eq('leader_id', user.value.id)

  if (error) {
    return { error: error.message }
  }

  // 更新本地缓存
  const nextByEvent: Record<string, TeamLobbyTeam[]> = { ...teamsByEventId.value }
  for (const [eventId, list] of Object.entries(nextByEvent)) {
    nextByEvent[eventId] = list.map((team) =>
      team.id === teamId ? { ...team, is_closed: false } : team,
    )
  }
  teamsByEventId.value = nextByEvent
  return { error: '' }
}

const removeTeamMember = async (teamId: string, memberId: string) => {
  if (!user.value) return { error: '请先登录' }
  if (!teamId || !memberId) return { error: '队伍不存在' }

  const { data, error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', memberId)
    .select('id')

  if (error) {
    return { error: error.message }
  }

  if (!data || data.length === 0) {
    return { error: '未能移除队员，请检查权限或成员是否存在' }
  }

  const current = teamMembersByTeamId.value[teamId] ?? []
  if (current.length) {
    teamMembersByTeamId.value = {
      ...teamMembersByTeamId.value,
      [teamId]: current.filter((member) => member.user_id !== memberId),
    }
  }

  if (user.value?.id === memberId) {
    teamMembershipByTeamId.value = { ...teamMembershipByTeamId.value, [teamId]: false }
  }

  return { error: '' }
}

const requestJoinTeam = async (teamId: string, message?: string) => {
  if (!user.value) return { error: '请先登录' }
  if (!teamId) return { error: '队伍不存在' }

  const { data: existing, error: existingError } = await supabase
    .from('team_join_requests')
    .select('id,status')
    .eq('team_id', teamId)
    .eq('user_id', user.value.id)
    .maybeSingle()

  if (existingError) {
    return { error: existingError.message }
  }

  if (existing) {
    if (existing.status === 'pending') {
      teamRequestStatusByTeamId.value = { ...teamRequestStatusByTeamId.value, [teamId]: 'pending' }
      return { error: '' }
    }
    if (existing.status === 'approved') {
      teamRequestStatusByTeamId.value = { ...teamRequestStatusByTeamId.value, [teamId]: 'approved' }
      return { error: '' }
    }
    const { data, error } = await supabase
      .from('team_join_requests')
      .update({
        status: 'pending',
        message: message ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('status')
      .single()

    if (error) {
      return { error: error.message }
    }
    teamRequestStatusByTeamId.value = {
      ...teamRequestStatusByTeamId.value,
      [teamId]: data.status ?? 'pending',
    }
    return { error: '' }
  }

  const { data, error } = await supabase
    .from('team_join_requests')
    .insert({
      team_id: teamId,
      user_id: user.value.id,
      status: 'pending',
      message: message ?? null,
    })
    .select('status')
    .single()

  if (error) {
    return { error: error.message }
  }

  teamRequestStatusByTeamId.value = {
    ...teamRequestStatusByTeamId.value,
    [teamId]: data.status ?? 'pending',
  }
  return { error: '' }
}

const cancelTeamJoinRequest = async (requestId: string) => {
  if (!user.value) return { error: '请先登录' }
  if (!requestId) return { error: '申请不存在' }

  const { data, error } = await supabase
    .from('team_join_requests')
    .delete()
    .eq('id', requestId)
    .eq('user_id', user.value.id)
    .eq('status', 'pending')
    .select('team_id')

  if (error) {
    return { error: error.message }
  }

  if (!data || data.length === 0) {
    return { error: '申请不存在或已处理' }
  }

  const teamId = (data[0] as { team_id?: string }).team_id
  if (teamId) {
    const next = { ...teamRequestStatusByTeamId.value }
    delete next[teamId]
    teamRequestStatusByTeamId.value = next
  }

  return { error: '' }
}

const acceptTeamInvite = async (inviteId: string, teamId?: string) => {
  if (!user.value) return { error: '请先登录' }
  if (!inviteId || !teamId) return { error: '邀请不存在' }

  const { error: joinError } = await supabase
    .from('team_members')
    .insert({ team_id: teamId, user_id: user.value.id })

  if (joinError) {
    // Unique violation: already a member, treat as ok.
    if (joinError.code !== '23505') {
      return { error: joinError.message }
    }
  }

  const { error: inviteError } = await supabase
    .from('team_invites')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', inviteId)

  if (inviteError) {
    // Membership succeeded; keep this a soft error.
    console.warn('failed to update invite status', inviteError.message)
  }

  teamMembershipByTeamId.value = { ...teamMembershipByTeamId.value, [teamId]: true }
  myTeamInviteByTeamId.value = { ...myTeamInviteByTeamId.value, [teamId]: null }
  return { error: '' }
}

const rejectTeamInvite = async (inviteId: string, teamId?: string) => {
  if (!user.value) return { error: '请先登录' }
  if (!inviteId) return { error: '邀请不存在' }

  const { error } = await supabase
    .from('team_invites')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', inviteId)
    .eq('user_id', user.value.id)
    .eq('status', 'pending')

  if (error) {
    return { error: error.message }
  }

  if (teamId) {
    myTeamInviteByTeamId.value = { ...myTeamInviteByTeamId.value, [teamId]: null }
  }

  return { error: '' }
}

const sendTeamInvite = async (teamId: string, userId: string, message?: string) => {
  if (!user.value) return { error: '请先登录' }
  if (!teamId || !userId) return { error: '邀请信息不完整' }
  if (userId === user.value.id) return { error: '不能邀请自己' }

  const { data: existing, error: existingError } = await supabase
    .from('team_invites')
    .select('id,status')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existingError) return { error: existingError.message }

  if (existing) {
    if (existing.status === 'pending') {
      return { error: '' }
    }
    const { error } = await supabase
      .from('team_invites')
      .update({ status: 'pending', message: message ?? null, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) return { error: error.message }
    return { error: '' }
  }

  const { error } = await supabase.from('team_invites').insert({
    team_id: teamId,
    user_id: userId,
    invited_by: user.value.id,
    message: message ?? null,
    status: 'pending',
  })

  if (error) return { error: error.message }
  return { error: '' }
}

const getMyTeamsForEvent = (eventId: string): MyTeamEntry[] => {
  if (!user.value || !eventId) return []
  
  const teams = getTeamsForEvent(eventId)
  const myTeams: MyTeamEntry[] = []
  
  for (const team of teams) {
    // Check if user is a member of this team
    const isMember = isTeamMember(team.id)
    if (!isMember) continue
    
    // Determine role (leader or member)
    const role = team.leader_id === user.value.id ? 'leader' : 'member'
    
    myTeams.push({
      teamId: team.id,
      teamName: team.name,
      role,
      memberCount: team.members,
      status: 'active', // Teams that user is member of are always active
      eventId: team.event_id,
      createdAt: team.created_at,
    })
  }
  
  return myTeams
}

const getMyTeamRequestsForEvent = (eventId: string): MyTeamRequest[] => {
  if (!user.value || !eventId) return []
  
  const teams = getTeamsForEvent(eventId)
  const myRequests: MyTeamRequest[] = []
  
  for (const team of teams) {
    const requestStatus = getTeamRequestStatus(team.id)
    if (requestStatus && requestStatus !== '') {
      myRequests.push({
        id: `${team.id}-${user.value.id}`, // Generate a composite ID
        teamId: team.id,
        teamName: team.name,
        status: requestStatus as 'pending' | 'approved' | 'rejected',
        message: null, // We don't have access to the message in current structure
        createdAt: team.created_at, // Use team creation as fallback
      })
    }
  }
  
  return myRequests
}

const getMyTeamInvitesForEvent = (eventId: string): MyTeamInvite[] => {
  if (!user.value || !eventId) return []
  
  const teams = getTeamsForEvent(eventId)
  const myInvites: MyTeamInvite[] = []
  
  for (const team of teams) {
    const invite = getMyTeamInvite(team.id)
    if (invite && invite.status === 'pending') {
      myInvites.push({
        id: invite.id,
        teamId: team.id,
        teamName: team.name,
        invitedByName: null, // We don't have access to inviter name in current structure
        status: invite.status as 'pending' | 'accepted' | 'rejected',
        message: invite.message,
        createdAt: invite.created_at,
      })
    }
  }
  
  return myInvites
}

const getSubmissionsForEvent = (eventId: string) => {
  return submissionsByEventId.value[eventId] ?? []
}

const loadSubmissions = async (eventId: string) => {
  if (!eventId) return []
  
  submissionsLoading.value = true
  submissionsError.value = ''
  
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select(`
        id,
        event_id,
        team_id,
        submitted_by,
        project_name,
        intro,
        cover_path,
        video_link,
        link_mode,
        submission_url,
        submission_storage_path,
        submission_password,
        created_at,
        updated_at,
        teams(
          id,
          name
        )
      `)
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })

    if (error) {
      submissionsError.value = error.message
      apiErrorHandler.handleError(error, { operation: 'loadSubmissions' })
      submissionsByEventId.value = { ...submissionsByEventId.value, [eventId]: [] }
      return []
    }

    // 转换数据格式
    const submissions: SubmissionWithTeam[] = (data || []).map(item => {
      // 处理队伍数据 - Supabase 的 !inner 关联可能返回对象或数组
      let teamData = null
      if (item.teams) {
        if (Array.isArray(item.teams) && item.teams.length > 0) {
          // 如果是数组，取第一个
          teamData = { id: item.teams[0].id, name: item.teams[0].name }
        } else if (typeof item.teams === 'object' && !Array.isArray(item.teams) && 'id' in item.teams) {
          // 如果是单个对象
          teamData = { id: (item.teams as any).id, name: (item.teams as any).name }
        }
      }
      
      return {
        id: item.id,
        event_id: item.event_id,
        team_id: item.team_id,
        submitted_by: item.submitted_by,
        project_name: item.project_name,
        intro: item.intro,
        cover_path: item.cover_path,
        video_link: item.video_link,
        link_mode: item.link_mode as 'link' | 'file',
        submission_url: item.submission_url,
        submission_storage_path: item.submission_storage_path,
        submission_password: item.submission_password,
        created_at: item.created_at,
        updated_at: item.updated_at,
        team: teamData
      }
    })

    submissionsByEventId.value = { ...submissionsByEventId.value, [eventId]: submissions }
    return submissions
  } catch (err: any) {
    console.error('Failed to load submissions:', err)
    submissionsError.value = err.message || '加载作品失败'
    apiErrorHandler.handleError(err, { operation: 'loadSubmissions' })
    submissionsByEventId.value = { ...submissionsByEventId.value, [eventId]: [] }
    return []
  } finally {
    submissionsLoading.value = false
  }
}

const maybePushProfileSetupNotification = () => {
  if (!user.value) return
  if (!notificationsLoaded.value) loadNotifications()
  const createdAt = Date.parse(user.value.created_at)
  if (Number.isNaN(createdAt)) return

  const maxAgeMs = 14 * 24 * 60 * 60 * 1000
  if (Date.now() - createdAt > maxAgeMs) return

  const createdTime = new Date().toISOString()
  const added = pushNotification({
    id: `onboarding:${user.value.id}:complete-profile`,
    title: '完善个人信息',
    body: '欢迎加入！为了方便组队与联系，请前往个人主页完善用户名、头像、职能与联系方式',
    created_at: createdTime,
    read: false,
    link: '/me/profile',
  })

  if (added) {
    handleSuccessWithBanner('欢迎加入！请完善个人信息', setBanner, { 
      operation: 'onboarding', 
      component: 'notification' 
    })
  }
}

const refreshUser = async () => {
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session) {
    user.value = null
    profile.value = null
    contacts.value = null
    teamMembershipByTeamId.value = {}
    teamRequestStatusByTeamId.value = {}
    teamJoinRequestsByTeamId.value = {}
    myTeamInviteByTeamId.value = {}
    return
  }

  const sessionUser = sessionData.session.user
  const { data, error } = await supabase.auth.getUser()
  if (error) {
    user.value = sessionUser
    authErrorHandler.handleError(error, { operation: 'refreshUser' })
    return
  }
  user.value = data.user
}

const loadMyProfile = async () => {
  profileError.value = ''
  if (!user.value) {
    profile.value = null
    return
  }
  profileLoading.value = true
  const { data, error } = await supabase
    .from('profiles')
    .select('id,username,avatar_url,roles')
    .eq('id', user.value.id)
    .maybeSingle()

  if (error) {
    profileError.value = error.message
    profile.value = null
  } else {
    profile.value = (data ?? null) as Profile | null
  }

  profileLoading.value = false
}

const dataURLtoBlob = (dataurl: string) => {
  const arr = dataurl.split(',')
  if (arr.length < 2) return null
  const mimeMatch = arr[0].match(/:(.*?);/)
  if (!mimeMatch) return null
  const mime = mimeMatch[1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}

const updateMyProfile = async (payload: Partial<Pick<Profile, 'username' | 'avatar_url' | 'roles'>>) => {
  if (!user.value) return { error: '请先登录' }
  profileLoading.value = true
  profileError.value = ''

  try {
    const nextPayload = { ...payload }
    // Handle avatar upload if data URL is provided
    if (nextPayload.avatar_url && nextPayload.avatar_url.startsWith('data:image')) {
      const blob = dataURLtoBlob(nextPayload.avatar_url)
      if (!blob) {
        throw new Error('无效的头像图片格式')
      }

      const filePath = `${user.value.id}/avatar.png`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, blob, {
        cacheControl: '3600',
        upsert: true,
      })

      if (uploadError) {
        throw uploadError
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
      nextPayload.avatar_url = urlData.publicUrl
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(nextPayload)
      .eq('id', user.value.id)
      .select('id,username,avatar_url,roles')
      .maybeSingle()

    if (error) {
      throw error
    }

    profile.value = (data ?? null) as Profile | null
    return { error: '' }
  } catch (error: any) {
    const errorMessage = error.message || '更新个人资料时发生未知错误'
    profileError.value = errorMessage
    return { error: errorMessage }
  } finally {
    profileLoading.value = false
  }
}

const loadMyContacts = async () => {
  contactsError.value = ''
  if (!user.value) {
    contacts.value = null
    return
  }

  contactsLoading.value = true
  const { data, error } = await supabase
    .from('user_contacts')
    .select('user_id,phone,qq,updated_at')
    .eq('user_id', user.value.id)
    .maybeSingle()

  if (error) {
    contactsError.value = error.message
    contacts.value = null
  } else {
    contacts.value = (data ?? null) as UserContacts | null
  }

  contactsLoading.value = false
}

const upsertMyContacts = async (payload: Partial<Pick<UserContacts, 'phone' | 'qq'>>) => {
  if (!user.value) return { error: '请先登录' }
  contactsLoading.value = true
  contactsError.value = ''

  const { data, error } = await supabase
    .from('user_contacts')
    .upsert(
      {
        user_id: user.value.id,
        phone: payload.phone ?? null,
        qq: payload.qq ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select('user_id,phone,qq,updated_at')
    .maybeSingle()

  if (error) {
    contactsError.value = error.message
    contactsLoading.value = false
    return { error: error.message }
  }

  contacts.value = (data ?? null) as UserContacts | null
  contactsLoading.value = false
  return { error: '' }
}

const loadEvents = async () => {
  eventsError.value = ''
  eventsLoading.value = true

  let query = supabase.from('events').select(EVENT_SELECT) as any

  if (user.value?.id && isAdmin.value) {
    query = query.or(`status.eq.published,status.eq.ended,created_by.eq.${user.value.id}`)
  } else {
    query = query.in('status', ['published', 'ended'])
  }

  const { data, error } = await query
    .order('start_time', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    eventsError.value = error.message
    eventErrorHandler.handleError(error, { operation: 'loadEvents' })
    events.value = []
  } else {
    events.value = data as Event[]
  }

  eventsLoading.value = false
  eventsLoaded.value = true
  syncNotifications()
}

const ensureEventsLoaded = async () => {
  if (eventsLoaded.value || eventsLoading.value) return
  await loadEvents()
}

const loadMyRegistrations = async () => {
  myRegistrationByEventId.value = {}
  if (!user.value) return

  registrationsLoading.value = true
  const { data, error } = await supabase
    .from('registrations')
    .select('id,event_id,status')
    .eq('user_id', user.value.id)
    .limit(500)

  if (error) {
    registrationsLoading.value = false
    authErrorHandler.handleError(error, { operation: 'loadMyRegistrations' })
    return
  }

  const next: Record<string, string> = {}
  for (const row of data as RegistrationRow[]) {
    next[row.event_id] = row.id
  }
  myRegistrationByEventId.value = next
  registrationsLoading.value = false
  registrationsLoaded.value = true
  syncNotifications()
}

const ensureRegistrationsLoaded = async () => {
  if (registrationsLoaded.value || registrationsLoading.value || !user.value) return
  await loadMyRegistrations()
}

const parseTime = (value: string | null) => {
  if (!value) return null
  const time = Date.parse(value)
  if (Number.isNaN(time)) return null
  return time
}

const syncTeamJoinResultNotifications = async () => {
  if (!user.value) return
  try {
    const { data: requests, error } = await supabase
      .from('team_join_requests')
      .select('id,team_id,status,created_at,updated_at,teams(event_id,name)')
      .eq('user_id', user.value.id)
      .in('status', ['approved', 'rejected'])

    if (error || !requests) return

    for (const row of requests as Array<{
      id: string
      team_id: string
      status: string
      created_at: string
      updated_at: string | null
      teams?: { event_id?: string | null; name?: string | null } | null
    }>) {
      const statusLabel = row.status === 'approved' ? '已通过' : '已拒绝'
      const teamName = row.teams?.name || '队伍'
      const eventId = row.teams?.event_id
      pushNotification({
        id: `team-join-result:${row.id}:${row.status}`,
        title: `入队申请${statusLabel}`,
        body: `你申请加入的「${teamName}」已${statusLabel}`,
        created_at: row.updated_at ?? row.created_at ?? new Date().toISOString(),
        read: false,
        link: eventId ? `/events/${eventId}/team/${row.team_id}` : undefined,
      })
    }
  } catch {
    return
  }
}

const syncNotifications = () => {
  if (!user.value || !eventsLoaded.value) return
  if (!notificationsLoaded.value) loadNotifications()

  const now = Date.now()
  const oneHour = 60 * 60 * 1000
  const registeredIds = registrationsLoaded.value
    ? new Set(Object.keys(myRegistrationByEventId.value))
    : new Set<string>()

  const relevantEvents = displayedEvents.value.filter((event) => {
    if (isDemoEvent(event)) return false
    if (event.status === 'draft') return false
    if (registeredIds.has(event.id)) return true
    return event.created_by === user.value?.id
  })

  const addNotification = (id: string, title: string, body: string, link?: string) => {
    const createdAt = new Date().toISOString()
    const added = pushNotification({
      id,
      title,
      body,
      created_at: createdAt,
      read: false,
      link,
    })
    if (added) {
      handleSuccessWithBanner(title, setBanner, { 
        operation: 'notification', 
        component: 'notification' 
      })
    }
  }

  for (const event of relevantEvents) {
    const startTime = parseTime(event.start_time)
    if (startTime && now >= startTime) {
      addNotification(
        `event:${event.id}:start`,
        `活动已开始：${event.title}`,
        `活动「${event.title}」已经开始，去看看最新进展吧`,
        `/events/${event.id}`,
      )
    }

    const endTime = parseTime(event.end_time)
    if (endTime) {
      const remindTime = endTime - oneHour
      if (now >= remindTime) {
        addNotification(
          `event:${event.id}:end-1h`,
          `活动即将结束：${event.title}`,
          `距离活动「${event.title}」结束还有 1 小时`,
          `/events/${event.id}`,
        )
      }
    }

    const submissionStart = parseTime(event.submission_start_time)
    if (submissionStart && now >= submissionStart) {
      addNotification(
        `event:${event.id}:submission-start`,
        `作品提交开始：${event.title}`,
        `活动「${event.title}」作品提交通道已开启`,
        `/events/${event.id}`,
      )
    }

    const submissionEnd = parseTime(event.submission_end_time)
    if (submissionEnd) {
      const remindTime = submissionEnd - oneHour
      if (now >= remindTime) {
        addNotification(
          `event:${event.id}:submission-end-1h`,
          `作品提交即将截止：${event.title}`,
          `距离活动「${event.title}」提交截止还有 1 小时`,
          `/events/${event.id}`,
        )
      }
    }
  }

  void syncTeamJoinResultNotifications()
}

let notificationTicker: number | undefined
const startNotificationTicker = () => {
  if (notificationTicker) return
  notificationTicker = window.setInterval(() => {
    syncNotifications()
  }, 60 * 1000)
}

const stopNotificationTicker = () => {
  if (!notificationTicker) return
  window.clearInterval(notificationTicker)
  notificationTicker = undefined
}

const getEventById = (id: string) => {
  return displayedEvents.value.find((event) => event.id === id) ?? null
}

const fetchEventById = async (id: string) => {
  const cached = getEventById(id)
  if (cached) return { data: cached, error: '' }

  const { data, error } = await (supabase.from('events').select(EVENT_SELECT) as any).eq('id', id).maybeSingle()

  if (error) return { data: null, error: error.message }
  if (!data) return { data: null, error: '活动不存在' }

  const next = data as Event
  if (next.status === 'draft') {
    if (!user.value) {
      await refreshUser()
    }
    if (!user.value || next.created_by !== user.value.id) {
      return { data: null, error: '草稿仅发布者可见' }
    }
  }
  if (!events.value.find((event) => event.id === next.id)) {
    events.value = [next, ...events.value]
  }
  return { data: next as DisplayEvent, error: '' }
}

const openAuth = (view: AuthView) => {
  authView.value = view
  authModalOpen.value = true
  authError.value = ''
  authInfo.value = ''
}

const closeAuth = () => {
  authModalOpen.value = false
  authError.value = ''
  authInfo.value = ''
}

const submitAuth = async () => {
  authError.value = ''
  authInfo.value = ''
  authBusy.value = true

  if (authView.value === 'sign_in') {
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail.value,
      password: authPassword.value,
    })
    if (error) authError.value = error.message
  } else {
    const { data, error } = await supabase.auth.signUp({
      email: authEmail.value,
      password: authPassword.value,
      options: {
        data: {
          full_name: authFullName.value,
        },
      },
    })

    if (error) {
      authError.value = error.message
    } else if (data.user && !data.session) {
      authInfo.value = '已发送验证邮件，请完成邮箱确认后再登录'
    }
  }

  authBusy.value = false
}

const handleSignOut = async () => {
  clearBanners()
  user.value = null
  profile.value = null
  contacts.value = null
  myRegistrationByEventId.value = {}
  registrationsLoaded.value = false
  teamMembershipByTeamId.value = {}
  teamRequestStatusByTeamId.value = {}
  teamJoinRequestsByTeamId.value = {}
  myTeamInviteByTeamId.value = {}
  void loadEvents()
  void supabase.auth.signOut().then(({ error }) => {
    if (error) authErrorHandler.handleError(error, { operation: 'signOut' })
  })
  
  // 跳转到主页
  const router = (await import('../router')).default
  router.push('/events')
}

const openCreateModal = () => {
  if (!isAdmin.value) {
    authErrorHandler.handleError(new Error('没有权限：仅管理员可发起活动'), { 
      operation: 'openCreateModal',
      component: 'modal' 
    })
    return
  }
  createError.value = ''
  createModalOpen.value = true
}

const closeCreateModal = () => {
  createModalOpen.value = false
  createError.value = ''
}

const submitCreate = async () => {
  createError.value = ''
  clearBanners()

  if (!isAdmin.value) {
    createError.value = '没有权限：仅管理员可发起活动'
    return null
  }

  const title = createTitle.value.trim()
  if (!title) {
    createError.value = '请填写活动标题'
    return null
  }

  const teamMaxSizeInput = `${createTeamMaxSize.value ?? ''}`.trim()
  let teamMaxSize = 0
  if (teamMaxSizeInput) {
    const parsed = Number.parseInt(teamMaxSizeInput, 10)
    if (!Number.isFinite(parsed) || parsed < 0) {
      createError.value = '队伍最大人数需要是 0 或大于 0 的数字'
      return null
    }
    teamMaxSize = parsed
  }

  const startDate = createStartTime.value ? new Date(createStartTime.value) : null
  const endDate = createEndTime.value ? new Date(createEndTime.value) : null
  if (startDate && Number.isNaN(startDate.getTime())) {
    createError.value = '活动开始时间无效'
    return null
  }
  if (endDate && Number.isNaN(endDate.getTime())) {
    createError.value = '活动结束时间无效'
    return null
  }
  if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
    createError.value = '活动开始时间不能晚于活动结束时间'
    return null
  }

  createBusy.value = true
  const summary = createDescription.value.trim()
  const description = buildEventDescription(summary, createDefaultEventDetails())
  const payload = {
    title,
    description,
    start_time: startDate ? startDate.toISOString() : null,
    end_time: endDate ? endDate.toISOString() : null,
    registration_start_time: startDate ? startDate.toISOString() : null,
    registration_end_time: endDate ? endDate.toISOString() : null,
    submission_start_time: startDate ? startDate.toISOString() : null,
    submission_end_time: endDate ? endDate.toISOString() : null,
    location: createLocation.value.trim() ? createLocation.value.trim() : null,
    team_max_size: teamMaxSize,
    status: 'draft',
  }

  const { data, error } = await supabase.from('events').insert(payload).select('id').single()
  if (error) {
    createError.value = error.message
    createBusy.value = false
    return null
  }

  handleSuccessWithBanner('活动已保存为草稿，进入页面继续完善', setBanner, { 
    operation: 'createEvent',
    component: 'form' 
  })
  createTitle.value = ''
  createStartTime.value = ''
  createEndTime.value = ''
  createLocation.value = ''
  createTeamMaxSize.value = ''
  createDescription.value = ''
  closeCreateModal()
  void loadEvents()
  createBusy.value = false
  return data.id as string
}

const updateEvent = async (eventId: string, updates: Partial<Event>) => {
  if (!isAdmin.value) {
    return { data: null, error: '没有权限：仅管理员可更新活动' }
  }

  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', eventId)
    .select('*')
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  events.value = events.value.map((event) =>
    event.id === data.id ? { ...event, ...data } : event,
  )

  return { data: data as Event, error: '' }
}

const updateEventStatus = async (eventId: string, status: EventStatus, description?: string | null) => {
  if (!isAdmin.value) {
    return { data: null, error: '没有权限：仅管理员可更新活动' }
  }

  // Get current event status for permission persistence tracking
  const currentEvent = getEventById(eventId)
  const oldStatus = currentEvent?.status

  const payload: { status: EventStatus; description?: string | null } = { status }
  if (description !== undefined) {
    payload.description = description
  }

  const { data, error } = await supabase
    .from('events')
    .update(payload)
    .eq('id', eventId)
    .select('id,status,description')
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  events.value = events.value.map((event) =>
    event.id === data.id ? { ...event, status: data.status, description: data.description ?? event.description } : event,
  )

  // Handle judge permission persistence during event status changes
  await handleEventStatusChange(eventId, status, oldStatus || undefined)

  return { data: data as { id: string; status: EventStatus; description: string | null }, error: '' }
}

const deleteDraftEvent = async (event: DisplayEvent) => {
  clearBanners()
  if (isDemoEvent(event)) {
    handleSuccessWithBanner('这是前端临时活动，仅用于展示，无法删除', setBanner, { 
      operation: 'deleteDraftEvent',
      component: 'demo' 
    })
    return { error: 'demo' }
  }
  if (!user.value) {
    openAuth('sign_in')
    authInfo.value = '请先登录后删除草稿'
    return { error: 'auth' }
  }
  if (!isAdmin.value) {
    authErrorHandler.handleError(new Error('没有权限：仅管理员可删除草稿'), { 
      operation: 'deleteDraftEvent',
      component: 'admin' 
    })
    return { error: 'auth' }
  }
  if (event.status !== 'draft') {
    eventErrorHandler.handleError(new Error('只有草稿可以删除'), { 
      operation: 'deleteDraftEvent',
      component: 'validation' 
    })
    return { error: 'status' }
  }
  if (event.created_by && event.created_by !== user.value.id) {
    authErrorHandler.handleError(new Error('没有权限删除他人草稿'), { 
      operation: 'deleteDraftEvent',
      component: 'permission' 
    })
    return { error: 'auth' }
  }

  deleteBusyEventId.value = event.id
  const { error } = await supabase.from('events').delete().eq('id', event.id)
  if (error) {
    eventErrorHandler.handleError(error, { operation: 'deleteDraftEvent' })
    deleteBusyEventId.value = null
    return { error: error.message }
  }

  events.value = events.value.filter((item) => item.id !== event.id)
  handleSuccessWithBanner('草稿已删除', setBanner, { 
    operation: 'deleteDraftEvent',
    component: 'event' 
  })
  deleteBusyEventId.value = null
  return { error: '' }
}

const submitRegistration = async (event: DisplayEvent, formResponse: Record<string, string | string[]>) => {
  clearBanners()
  if (isDemoEvent(event)) {
    handleSuccessWithBanner('这是前端临时活动，仅用于展示，暂不支持报名', setBanner, { 
      operation: 'submitRegistration',
      component: 'demo' 
    })
    return { error: 'demo' }
  }
  if (event.status === 'draft') {
    handleSuccessWithBanner('草稿活动暂不支持报名', setBanner, { 
      operation: 'submitRegistration',
      component: 'validation' 
    })
    return { error: 'draft' }
  }
  if (!user.value) {
    openAuth('sign_in')
    authInfo.value = '请先登录后报名'
    return { error: 'auth' }
  }

  if (myRegistrationByEventId.value[event.id]) {
    handleSuccessWithBanner('你已报名该活动', setBanner, { 
      operation: 'submitRegistration',
      component: 'validation' 
    })
    return { error: '' }
  }

  registrationBusyEventId.value = event.id
  const { data, error } = await supabase
    .from('registrations')
    .insert({
      event_id: event.id,
      user_id: user.value.id,
      status: 'registered',
      form_response: formResponse,
    })
    .select('id,event_id')
    .single()

  if (error) {
    eventErrorHandler.handleError(error, { operation: 'submitRegistration' })
    registrationBusyEventId.value = null
    return { error: error.message }
  }

  const row = data as RegistrationRow
  myRegistrationByEventId.value = {
    ...myRegistrationByEventId.value,
    [row.event_id]: row.id,
  }
  handleSuccessWithBanner('报名成功', setBanner, { 
    operation: 'submitRegistration',
    component: 'form' 
  })
  registrationBusyEventId.value = null
  return { error: '' }
}

const registrationLabel = (event: DisplayEvent) => {
  if (isDemoEvent(event)) return '仅展示'
  if (event.status === 'draft') return '草稿中'
  if (!user.value) return '登录后报名'
  return myRegistrationByEventId.value[event.id] ? '取消报名' : '报名'
}

const registrationVariant = (event: DisplayEvent) => {
  if (isDemoEvent(event)) return 'btn--ghost'
  if (event.status === 'draft') return 'btn--ghost'
  if (!user.value) return 'btn--primary'
  return myRegistrationByEventId.value[event.id] ? 'btn--danger' : 'btn--primary'
}

const toggleRegistration = async (event: DisplayEvent) => {
  clearBanners()
  if (isDemoEvent(event)) {
    handleSuccessWithBanner('这是前端临时活动，仅用于展示，暂不支持报名', setBanner, { 
      operation: 'toggleRegistration',
      component: 'demo' 
    })
    return
  }
  if (event.status === 'draft') {
    handleSuccessWithBanner('草稿活动暂不支持报名', setBanner, { 
      operation: 'toggleRegistration',
      component: 'validation' 
    })
    return
  }
  if (!user.value) {
    openAuth('sign_in')
    authInfo.value = '请先登录后报名'
    return
  }

  const existingId = myRegistrationByEventId.value[event.id]
  registrationBusyEventId.value = event.id

  if (!existingId) {
    handleSuccessWithBanner('请在活动详情页填写报名表', setBanner, { 
      operation: 'toggleRegistration',
      component: 'form' 
    })
    registrationBusyEventId.value = null
    return
  }

  const { error } = await supabase.from('registrations').delete().eq('id', existingId)

  if (error) {
    eventErrorHandler.handleError(error, { operation: 'toggleRegistration' })
  } else {
    const next = { ...myRegistrationByEventId.value }
    delete next[event.id]
    myRegistrationByEventId.value = next
    handleSuccessWithBanner('已取消报名', setBanner, { 
      operation: 'toggleRegistration',
      component: 'form' 
    })
  }

  registrationBusyEventId.value = null
}

// Judge-related functions

const checkJudgePermission = async (eventId: string): Promise<JudgePermission> => {
  if (!user.value || !eventId) {
    return {
      isJudge: false,
      isEventAdmin: false,
      canAccessJudgeWorkspace: false,
      canManageJudges: false,
    }
  }

  // Check if cached
  const cached = judgePermissionsByEventId.value[eventId]
  if (cached) {
    return cached
  }

  try {
    // Check if user is event admin (creator)
    const event = getEventById(eventId)
    const isEventAdmin = event?.created_by === user.value.id

    // Check if user is a judge for this event
    const { data: judgeRecord, error } = await supabase
      .from('event_judges')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', user.value.id)
      .maybeSingle()

    if (error) {
      console.warn('Failed to check judge permission:', error.message)
      return {
        isJudge: false,
        isEventAdmin,
        canAccessJudgeWorkspace: isEventAdmin,
        canManageJudges: isEventAdmin,
      }
    }

    const isJudge = Boolean(judgeRecord)
    const permission: JudgePermission = {
      isJudge,
      isEventAdmin,
      canAccessJudgeWorkspace: isEventAdmin || isJudge,
      canManageJudges: isEventAdmin,
    }

    // Cache the result
    judgePermissionsByEventId.value = {
      ...judgePermissionsByEventId.value,
      [eventId]: permission,
    }

    return permission
  } catch (error: any) {
    console.error('Error checking judge permission:', error)
    return {
      isJudge: false,
      isEventAdmin: false,
      canAccessJudgeWorkspace: false,
      canManageJudges: false,
    }
  }
}

const loadEventJudges = async (eventId: string): Promise<JudgeWithProfile[]> => {
  if (!eventId) {
    judgesByEventId.value = { ...judgesByEventId.value, [eventId]: [] }
    return []
  }

  // Check if user has permission to view judges
  if (!user.value) {
    judgesByEventId.value = { ...judgesByEventId.value, [eventId]: [] }
    return []
  }

  try {
    judgeWorkspaceLoading.value = true
    judgeWorkspaceError.value = ''

    const { data, error } = await supabase
      .from('event_judges')
      .select(`
        id,
        event_id,
        user_id,
        created_at,
        updated_at,
        profiles(
          id,
          username,
          avatar_url,
          roles
        )
      `)
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })

    if (error) {
      const errorMessage = getJudgeErrorMessage(error, '加载评委列表')
      judgeWorkspaceError.value = errorMessage
      
      // Only show banner for non-network errors to avoid spam
      if (!isNetworkError(error)) {
        apiErrorHandler.handleError(error, { operation: 'loadEventJudges' })
      }
      
      judgesByEventId.value = { ...judgesByEventId.value, [eventId]: [] }
      return []
    }

    // Transform the data
    const judges: JudgeWithProfile[] = (data || []).map((row: any) => ({
      id: row.id,
      event_id: row.event_id,
      user_id: row.user_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      profile: row.profiles ? {
        id: row.profiles.id,
        username: row.profiles.username || null,
        avatar_url: row.profiles.avatar_url || null,
        roles: Array.isArray(row.profiles.roles) ? row.profiles.roles : null,
      } : {
        id: row.user_id,
        username: null,
        avatar_url: null,
        roles: null,
      }
    }))

    // Cache the result
    judgesByEventId.value = { ...judgesByEventId.value, [eventId]: judges }
    judgeWorkspaceError.value = '' // Clear error on success
    
    return judges

  } catch (error: any) {
    console.error('Error loading event judges:', error)
    const errorMessage = getJudgeErrorMessage(error, '加载评委列表')
    judgeWorkspaceError.value = errorMessage
    
    // Only show banner for non-network errors
    if (!isNetworkError(error)) {
      apiErrorHandler.handleError(error, { operation: 'loadEventJudges' })
    }
    
    judgesByEventId.value = { ...judgesByEventId.value, [eventId]: [] }
    return []
  } finally {
    judgeWorkspaceLoading.value = false
  }
}

const searchUsersForJudge = async (query: string, eventId: string, limit = 20): Promise<UserSearchResult[]> => {
  if (!user.value || !eventId || !query.trim()) {
    return []
  }

  try {
    // Check if user has permission to manage judges
    const permission = await checkJudgePermission(eventId)
    if (!permission.canManageJudges) {
      authErrorHandler.handleError(new Error('您没有权限搜索用户'), { 
        operation: 'searchUsersForJudge',
        component: 'judge' 
      })
      return []
    }

    // Get existing judges for this event to mark them as already invited
    const existingJudges = judgesByEventId.value[eventId] || []
    const existingJudgeIds = new Set(existingJudges.map(judge => judge.user_id))

    // Search for users by username (no exclusion filter)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, roles')
      .ilike('username', `%${query.trim()}%`)
      .limit(limit)

    if (error) {
      const errorMessage = getJudgeErrorMessage(error, '搜索用户')
      throw new Error(errorMessage)
    }

    // Transform the data and add judge status
    const users: UserSearchResult[] = (data || [])
      .filter(row => row.username && row.username.trim()) // Only include users with usernames
      .map(row => {
        const isAlreadyJudge = existingJudgeIds.has(row.id)
        return {
          id: row.id,
          username: row.username || '',
          avatar_url: row.avatar_url || null,
          roles: Array.isArray(row.roles) ? row.roles : null,
          isAlreadyJudge, // Add judge status
        }
      })

    return users

  } catch (error: any) {
    console.error('Error searching users for judge:', error)
    const errorMessage = getJudgeErrorMessage(error, '搜索用户')
    
    // Re-throw with user-friendly message for component to handle
    throw new Error(errorMessage)
  }
}

const inviteJudge = async (eventId: string, userId: string): Promise<{ success: boolean; error?: string }> => {
  if (!user.value || !eventId || !userId) {
    return { success: false, error: '参数缺失' }
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(eventId)) {
    console.error('Invalid eventId UUID format:', eventId)
    return { success: false, error: '活动ID格式无效' }
  }
  if (!uuidRegex.test(userId)) {
    console.error('Invalid userId UUID format:', userId)
    return { success: false, error: '用户ID格式无效' }
  }

  try {
    // Check if user has permission to manage judges
    const permission = await checkJudgePermission(eventId)
    if (!permission.canManageJudges) {
      return { success: false, error: '您没有权限邀请评委' }
    }

    // Check if user is already a judge
    const existingJudges = judgesByEventId.value[eventId] || []
    const isAlreadyJudge = existingJudges.some(judge => judge.user_id === userId)
    if (isAlreadyJudge) {
      return { success: false, error: '该用户已经是评委' }
    }

    // Create judge record
    const { data, error } = await supabase
      .from('event_judges')
      .insert({
        event_id: eventId,
        user_id: userId,
      })
      .select(`
        id,
        event_id,
        user_id,
        created_at,
        updated_at,
        profiles(
          id,
          username,
          avatar_url,
          roles
        )
      `)
      .single()

    if (error) {
      const errorMessage = getJudgeErrorMessage(error, '邀请评委')
      return { success: false, error: errorMessage }
    }

    // Transform and add to cache
    const profileData = data.profiles as any
    const newJudge: JudgeWithProfile = {
      id: data.id,
      event_id: data.event_id,
      user_id: data.user_id,
      created_at: data.created_at,
      updated_at: data.updated_at,
      profile: profileData ? {
        id: profileData.id,
        username: profileData.username || null,
        avatar_url: profileData.avatar_url || null,
        roles: Array.isArray(profileData.roles) ? profileData.roles : null,
      } : {
        id: data.user_id,
        username: null,
        avatar_url: null,
        roles: null,
      }
    }

    // Update cache
    const currentJudges = judgesByEventId.value[eventId] || []
    judgesByEventId.value = {
      ...judgesByEventId.value,
      [eventId]: [...currentJudges, newJudge]
    }

    // Send notification to the invited user
    pushJudgeNotification(eventId, userId, 'invited')

    return { success: true }

  } catch (error: any) {
    console.error('Error inviting judge:', error)
    const errorMessage = getJudgeErrorMessage(error, '邀请评委')
    return { success: false, error: errorMessage }
  }
}

const removeJudge = async (eventId: string, userId: string): Promise<{ success: boolean; error?: string }> => {
  if (!user.value || !eventId || !userId) {
    return { success: false, error: '参数缺失' }
  }

  try {
    // Check if user has permission to manage judges
    const permission = await checkJudgePermission(eventId)
    if (!permission.canManageJudges) {
      return { success: false, error: '您没有权限移除评委' }
    }

    // Remove judge record
    const { error } = await supabase
      .from('event_judges')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', userId)

    if (error) {
      const errorMessage = getJudgeErrorMessage(error, '移除评委')
      return { success: false, error: errorMessage }
    }

    // Update cache
    const currentJudges = judgesByEventId.value[eventId] || []
    const updatedJudges = currentJudges.filter(judge => judge.user_id !== userId)
    judgesByEventId.value = {
      ...judgesByEventId.value,
      [eventId]: updatedJudges
    }

    // Clear cached permissions for this user if they were removed
    if (user.value.id === userId) {
      const currentPermissions = { ...judgePermissionsByEventId.value }
      delete currentPermissions[eventId]
      judgePermissionsByEventId.value = currentPermissions
    }

    // Send notification to the removed user
    pushJudgeNotification(eventId, userId, 'removed')

    return { success: true }

  } catch (error: any) {
    console.error('Error removing judge:', error)
    const errorMessage = getJudgeErrorMessage(error, '移除评委')
    return { success: false, error: errorMessage }
  }
}

// Permission persistence functions
const validateJudgePermissionPersistence = async (eventId: string): Promise<boolean> => {
  if (!user.value || !eventId) {
    return false
  }

  try {
    // Get the current event to check its status
    const event = getEventById(eventId)
    if (!event) {
      return false
    }

    // Judge permissions should persist through all event states except when:
    // 1. The event is deleted (handled by cascade delete in database)
    // 2. The judge is explicitly removed
    // 3. The user account is deleted/disabled (handled by cascade delete)
    
    // Check if the judge record still exists in the database
    const { data: judgeRecord, error } = await supabase
      .from('event_judges')
      .select('id, created_at')
      .eq('event_id', eventId)
      .eq('user_id', user.value.id)
      .maybeSingle()

    if (error) {
      console.warn('Failed to validate judge permission persistence:', error.message)
      return false
    }

    // If judge record exists, permission should be valid regardless of event status
    const hasValidPermission = Boolean(judgeRecord)
    
    // Update cached permission if it exists but doesn't match database state
    const cachedPermission = judgePermissionsByEventId.value[eventId]
    if (cachedPermission && cachedPermission.isJudge !== hasValidPermission) {
      // Clear cache to force refresh on next permission check
      const updatedPermissions = { ...judgePermissionsByEventId.value }
      delete updatedPermissions[eventId]
      judgePermissionsByEventId.value = updatedPermissions
    }

    return hasValidPermission
  } catch (error: any) {
    console.error('Error validating judge permission persistence:', error)
    return false
  }
}

const handleEventStatusChange = async (eventId: string, newStatus: EventStatus, oldStatus?: EventStatus) => {
  if (!eventId) return

  try {
    // Judge permissions should persist through all event status changes
    // This function ensures that judge permissions remain valid when events change status
    
    // Validate that judge permissions are still intact after status change
    if (user.value) {
      const isValidPermission = await validateJudgePermissionPersistence(eventId)
      
      // If user was a judge but permission is no longer valid, clear cache
      const cachedPermission = judgePermissionsByEventId.value[eventId]
      if (cachedPermission?.isJudge && !isValidPermission) {
        const updatedPermissions = { ...judgePermissionsByEventId.value }
        delete updatedPermissions[eventId]
        judgePermissionsByEventId.value = updatedPermissions
        
        // Optionally notify user if they lost judge access unexpectedly
        if (oldStatus && newStatus !== 'draft') {
          console.warn(`Judge permission lost for event ${eventId} during status change from ${oldStatus} to ${newStatus}`)
        }
      }
    }

    // Refresh judge data for this event to ensure consistency
    const currentJudges = judgesByEventId.value[eventId]
    if (currentJudges && currentJudges.length > 0) {
      // Reload judges to ensure data consistency
      await loadEventJudges(eventId)
    }

  } catch (error: any) {
    console.error('Error handling event status change for judge permissions:', error)
  }
}

const refreshJudgePermissionCache = async (eventId: string) => {
  if (!eventId) return

  try {
    // Clear cached permission to force fresh check
    const updatedPermissions = { ...judgePermissionsByEventId.value }
    delete updatedPermissions[eventId]
    judgePermissionsByEventId.value = updatedPermissions

    // Trigger fresh permission check
    await checkJudgePermission(eventId)
  } catch (error: any) {
    console.error('Error refreshing judge permission cache:', error)
  }
}

// Optimized caching and state management
const judgeDataCacheTimestamps = ref<Record<string, number>>({})
const JUDGE_CACHE_TTL = 5 * 60 * 1000 // 5 minutes cache TTL
const judgeDataRefreshPromises = ref<Record<string, Promise<any>>>({})

const isCacheValid = (eventId: string): boolean => {
  const timestamp = judgeDataCacheTimestamps.value[eventId]
  if (!timestamp) return false
  return Date.now() - timestamp < JUDGE_CACHE_TTL
}

const setCacheTimestamp = (eventId: string) => {
  judgeDataCacheTimestamps.value = {
    ...judgeDataCacheTimestamps.value,
    [eventId]: Date.now()
  }
}

const optimizedLoadEventJudges = async (eventId: string, forceRefresh = false): Promise<JudgeWithProfile[]> => {
  if (!eventId) {
    judgesByEventId.value = { ...judgesByEventId.value, [eventId]: [] }
    return []
  }

  // Return cached data if valid and not forcing refresh
  if (!forceRefresh && isCacheValid(eventId)) {
    const cached = judgesByEventId.value[eventId]
    if (cached) {
      return cached
    }
  }

  // Prevent concurrent requests for the same event
  const existingPromise = judgeDataRefreshPromises.value[eventId]
  if (existingPromise) {
    return existingPromise
  }

  // Create and cache the promise
  const refreshPromise = loadEventJudges(eventId).then(judges => {
    setCacheTimestamp(eventId)
    // Clear the promise from cache
    const updatedPromises = { ...judgeDataRefreshPromises.value }
    delete updatedPromises[eventId]
    judgeDataRefreshPromises.value = updatedPromises
    return judges
  }).catch(error => {
    // Clear the promise from cache on error
    const updatedPromises = { ...judgeDataRefreshPromises.value }
    delete updatedPromises[eventId]
    judgeDataRefreshPromises.value = updatedPromises
    throw error
  })

  judgeDataRefreshPromises.value = {
    ...judgeDataRefreshPromises.value,
    [eventId]: refreshPromise
  }

  return refreshPromise
}

const optimizedCheckJudgePermission = async (eventId: string, forceRefresh = false): Promise<JudgePermission> => {
  if (!user.value || !eventId) {
    return {
      isJudge: false,
      isEventAdmin: false,
      canAccessJudgeWorkspace: false,
      canManageJudges: false,
    }
  }

  // Return cached permission if valid and not forcing refresh
  const cached = judgePermissionsByEventId.value[eventId]
  if (!forceRefresh && cached) {
    return cached
  }

  // Use the original checkJudgePermission function which handles caching
  return checkJudgePermission(eventId)
}

// Real-time state synchronization
let judgeRealtimeSubscription: any = null

const startJudgeRealtimeSync = () => {
  if (judgeRealtimeSubscription) return

  // Subscribe to changes in event_judges table
  judgeRealtimeSubscription = supabase
    .channel('judge-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'event_judges'
      },
      async (payload) => {
        const eventId = (payload.new as any)?.event_id || (payload.old as any)?.event_id
        if (!eventId) return

        // Invalidate cache for this event
        const updatedTimestamps = { ...judgeDataCacheTimestamps.value }
        delete updatedTimestamps[eventId]
        judgeDataCacheTimestamps.value = updatedTimestamps

        // Clear cached permissions
        const updatedPermissions = { ...judgePermissionsByEventId.value }
        delete updatedPermissions[eventId]
        judgePermissionsByEventId.value = updatedPermissions

        // Refresh data if this event is currently being viewed
        const hasCurrentData = judgesByEventId.value[eventId]
        if (hasCurrentData) {
          try {
            await optimizedLoadEventJudges(eventId, true)
            // Also refresh permissions if current user might be affected
            if (user.value && (
              (payload.new as any)?.user_id === user.value.id || 
              (payload.old as any)?.user_id === user.value.id
            )) {
              await optimizedCheckJudgePermission(eventId, true)
            }
          } catch (error) {
            console.warn('Failed to refresh judge data after realtime update:', error)
          }
        }
      }
    )
    .subscribe()
}

const stopJudgeRealtimeSync = () => {
  if (judgeRealtimeSubscription) {
    supabase.removeChannel(judgeRealtimeSubscription)
    judgeRealtimeSubscription = null
  }
}

// Batch operations for better performance
const batchInvalidateJudgeCache = (eventIds: string[]) => {
  const updatedTimestamps = { ...judgeDataCacheTimestamps.value }
  const updatedPermissions = { ...judgePermissionsByEventId.value }
  
  eventIds.forEach(eventId => {
    delete updatedTimestamps[eventId]
    delete updatedPermissions[eventId]
  })
  
  judgeDataCacheTimestamps.value = updatedTimestamps
  judgePermissionsByEventId.value = updatedPermissions
}

const preloadJudgeDataForEvents = async (eventIds: string[]) => {
  if (!user.value || eventIds.length === 0) return

  // Only preload for events that don't have valid cache
  const eventsToLoad = eventIds.filter(eventId => !isCacheValid(eventId))
  
  if (eventsToLoad.length === 0) return

  // Load judge data for multiple events concurrently
  const loadPromises = eventsToLoad.map(eventId => 
    optimizedLoadEventJudges(eventId).catch(error => {
      console.warn(`Failed to preload judge data for event ${eventId}:`, error)
      return []
    })
  )

  await Promise.all(loadPromises)
}

// Cleanup function for cache management
const cleanupJudgeCache = () => {
  const now = Date.now()
  const updatedTimestamps: Record<string, number> = {}
  const updatedJudges: Record<string, JudgeWithProfile[]> = {}
  const updatedPermissions: Record<string, JudgePermission> = {}

  // Keep only non-expired cache entries
  Object.entries(judgeDataCacheTimestamps.value).forEach(([eventId, timestamp]) => {
    if (now - timestamp < JUDGE_CACHE_TTL) {
      updatedTimestamps[eventId] = timestamp
      if (judgesByEventId.value[eventId]) {
        updatedJudges[eventId] = judgesByEventId.value[eventId]
      }
      if (judgePermissionsByEventId.value[eventId]) {
        updatedPermissions[eventId] = judgePermissionsByEventId.value[eventId]
      }
    }
  })

  judgeDataCacheTimestamps.value = updatedTimestamps
  judgesByEventId.value = updatedJudges
  judgePermissionsByEventId.value = updatedPermissions
}

// Periodic cache cleanup
let cacheCleanupInterval: number | undefined

const startCacheCleanup = () => {
  if (cacheCleanupInterval) return
  // Clean up cache every 10 minutes
  cacheCleanupInterval = window.setInterval(cleanupJudgeCache, 10 * 60 * 1000)
}

const stopCacheCleanup = () => {
  if (cacheCleanupInterval) {
    window.clearInterval(cacheCleanupInterval)
    cacheCleanupInterval = undefined
  }
}

let initialized = false
let authSubscription: Subscription | null = null

const init = async () => {
  if (initialized) return
  initialized = true

  await refreshUser()
  loadNotifications()
  maybePushProfileSetupNotification()
  if (user.value) startNotificationTicker()
  void loadMyProfile()
  void loadMyContacts()
  void loadEvents()
  void loadMyRegistrations()
  void loadMyPendingTeamActions()

  // Start judge-related optimizations
  startJudgeRealtimeSync()
  startCacheCleanup()

  const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!session) {
      user.value = null
      profile.value = null
      contacts.value = null
      notifications.value = []
      notificationsLoaded.value = false
      stopNotificationTicker()
      myRegistrationByEventId.value = {}
      registrationsLoaded.value = false
      pendingRequestsCount.value = 0
      pendingInvitesCount.value = 0
      
      // Clear judge-related cache on logout
      judgesByEventId.value = {}
      judgePermissionsByEventId.value = {}
      judgeDataCacheTimestamps.value = {}
      judgeDataRefreshPromises.value = {}
      
      void loadEvents()
      return
    }

    user.value = session.user
    closeAuth()
    void refreshUser()
    loadNotifications()
    maybePushProfileSetupNotification()
    startNotificationTicker()
    void loadMyProfile()
    void loadMyContacts()
    void loadEvents()
    void loadMyRegistrations()
    void loadMyPendingTeamActions()
    closeAuth()
  })

  authSubscription = listener.subscription
}

const dispose = () => {
  authSubscription?.unsubscribe()
  authSubscription = null
  initialized = false
  stopNotificationTicker()
  
  // Clean up judge-related resources
  stopJudgeRealtimeSync()
  stopCacheCleanup()
  
  // Clear judge cache
  judgesByEventId.value = {}
  judgePermissionsByEventId.value = {}
  judgeDataCacheTimestamps.value = {}
  judgeDataRefreshPromises.value = {}
}

const store = proxyRefs({
  user,
  events,
  eventsLoading,
  eventsError,
  eventsLoaded,
  profile,
  profileLoading,
  profileError,
  contacts,
  contactsLoading,
  contactsError,
  notifications,
  unreadNotifications,
  pendingRequestsCount,
  pendingInvitesCount,
  isProfileIncomplete,
  hasAnyNotification,
  bannerInfo,
  bannerError,
  registrationsLoading,
  registrationBusyEventId,
  myRegistrationByEventId,
  deleteBusyEventId,
  authModalOpen,
  authView,
  authEmail,
  authPassword,
  authFullName,
  authBusy,
  authError,
  authInfo,
  createModalOpen,
  createTitle,
  createStartTime,
  createEndTime,
  createLocation,
  createTeamMaxSize,
  createDescription,
  createBusy,
  createError,
  submissionsLoading,
  submissionsError,
  judgesByEventId,
  judgePermissionsByEventId,
  judgeWorkspaceLoading,
  judgeWorkspaceError,
  isAuthed,
  isAdmin,
  showDemoEvents,
  displayedEvents,
  publicEvents,
  myEvents,
  displayName,
  isDemoEvent,
  setBanner,
  clearBanners,
  refreshUser,
  loadMyProfile,
  updateMyProfile,
  loadMyContacts,
  upsertMyContacts,
  loadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteReadNotifications,
  loadMyPendingTeamActions,
  loadTeams,
  getTeamsForEvent,
  loadTeamSeekers,
  getTeamSeekersForEvent,
  getMyTeamSeeker,
  loadTeamMembers,
  getTeamMembers,
  getTeamRequestStatus,
  loadTeamJoinRequests,
  getTeamJoinRequests,
  loadMyTeamInvite,
  getMyTeamInvite,
  isTeamMember,
  createTeam,
  updateTeam,
  closeTeam,
  reopenTeam,
  deleteTeam,
  removeTeamMember,
  updateTeamJoinRequestStatus,
  requestJoinTeam,
  cancelTeamJoinRequest,
  acceptTeamInvite,
  rejectTeamInvite,
  sendTeamInvite,
  getMyTeamsForEvent,
  getMyTeamRequestsForEvent,
  getMyTeamInvitesForEvent,
  saveTeamSeeker,
  deleteTeamSeeker,
  getSubmissionsForEvent,
  loadSubmissions,
  loadEvents,
  ensureEventsLoaded,
  loadMyRegistrations,
  ensureRegistrationsLoaded,
  getEventById,
  fetchEventById,
  openAuth,
  closeAuth,
  submitAuth,
  handleSignOut,
  openCreateModal,
  closeCreateModal,
  submitCreate,
  updateEvent,
  updateEventStatus,
  deleteDraftEvent,
  submitRegistration,
  registrationLabel,
  registrationVariant,
  toggleRegistration,
  checkJudgePermission,
  loadEventJudges,
  searchUsersForJudge,
  inviteJudge,
  removeJudge,
  validateJudgePermissionPersistence,
  handleEventStatusChange,
  refreshJudgePermissionCache,
  optimizedLoadEventJudges,
  optimizedCheckJudgePermission,
  batchInvalidateJudgeCache,
  preloadJudgeDataForEvents,
  cleanupJudgeCache,
  handleJudgeNotificationClick,
  init,
  dispose,
})

export const useAppStore = () => store
