import { computed, proxyRefs, ref } from 'vue'
import type { Subscription, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { getQueryClient } from '../lib/vueQuery'
import { buildEventDescription, createDefaultEventDetails } from '../utils/eventDetails'
import { getLocalizedAuthError } from '../utils/authErrorMessages'
import { validateUsername, checkUsernameExists, getUserEmailByUsername, isEmailFormat } from '../utils/authHelpers'
import { 
  enhancedErrorHandler, 
  handleSuccessWithBanner,
  authErrorHandler,
  eventErrorHandler,
  teamErrorHandler
} from './enhancedErrorHandling'
import { 
  networkManager, 
  type NetworkState
} from '../utils/networkManager'
import { cacheManager } from '../utils/cacheManager'
import { offlineManager } from '../utils/offlineManager'
import { stateCache } from '../utils/simpleStateCache'
import type {
  AuthView,
  DisplayEvent,
  Event,
  EventStatus,
  TeamJoinRequest,
  TeamJoinRequestRecord,
  TeamInvite,
  TeamLobbyTeam,
  TeamSeeker,
  TeamMember,
  MyTeamEntry,
  MyTeamRequest,
  MyTeamInvite,
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

const user = ref<User | null>(stateCache.get('user') || null)
const bannerInfo = ref('')
const bannerError = ref('')

const registrationsLoading = ref(false)
const registrationsLoaded = ref(stateCache.get('registrationsLoaded') || false)
const registrationBusyEventId = ref<string | null>(null)
const myRegistrationByEventId = ref<Record<string, string>>(stateCache.get('myRegistrations') || {})

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

const notifications = ref<NotificationItem[]>([])
const notificationsLoaded = ref(false)
const unreadNotifications = computed(() => notifications.value.filter((item) => !item.read).length)

const pendingRequestsCount = ref(0)
const pendingInvitesCount = ref(0)

const isProfileIncomplete = computed(() => {
  if (!user.value) return false
  // Profile completeness logic moved to Vue Query composables
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

// Team data is now managed by Vue Query composables - keeping only minimal state for backward compatibility
const teamsByEventId = ref<Record<string, TeamLobbyTeam[]>>({})
const teamMembersByTeamId = ref<Record<string, TeamMember[]>>({})
const teamMembershipByTeamId = ref<Record<string, boolean>>({})
const teamRequestStatusByTeamId = ref<Record<string, string>>({})
const teamJoinRequestsByTeamId = ref<Record<string, TeamJoinRequestRecord[]>>({})
const teamSeekersByEventId = ref<Record<string, TeamSeeker[]>>({})
const myTeamInviteByTeamId = ref<Record<string, TeamInvite | null>>({})
const myTeamRequestsByTeamId = ref<Record<string, TeamJoinRequest>>({}) // Store actual request records
const myTeamsByEventId = ref<Record<string, MyTeamEntry[]>>({})
const myTeamRequestsByEventId = ref<Record<string, MyTeamRequest[]>>({})
const myTeamInvitesByEventId = ref<Record<string, MyTeamInvite[]>>({})

// Submissions and judge data are now managed by Vue Query composables

// Network state management
const networkState = ref<NetworkState>(networkManager.networkState)
const isOnline = computed(() => networkState.value.isOnline)
const connectionQuality = computed(() => networkManager.connectionQuality)
const networkStatus = computed(() => networkManager.getStatus())

// Network-aware loading states
const networkAwareLoading = ref(false)
const networkRetryCount = ref(0)
const maxNetworkRetries = 3

// Offline capabilities
const isOfflineMode = computed(() => offlineManager.offline)
const offlineCapabilities = computed(() => offlineManager.getOfflineCapability())

// Performance monitoring
const performanceMetrics = ref({
  pageLoadTime: 0,
  apiResponseTime: 0,
  cacheHitRate: 0,
  networkLatency: 0
})

// Network state listener cleanup function
let networkStateCleanup: (() => void) | null = null

// Legacy helper functions removed - now handled by Vue Query composables

const handleNetworkAwareOperation = async <T>(
  operation: () => Promise<T>,
  options: {
    operationName: string
    showLoading?: boolean
    cacheKey?: string
    retryable?: boolean
  }
): Promise<T> => {
  const { operationName, showLoading = true, retryable = true } = options
  
  try {
    if (showLoading) {
      networkAwareLoading.value = true
    }

    // Check offline capabilities
    if (!isOnline.value) {
      const capability = offlineManager.getOfflineCapability()
      if (!capability.canAccessFeatures.includes(operationName)) {
        throw new Error('此功能需要网络连接，请检查网络后重试')
      }
    }

    const result = await operation()

    // Record successful operation
    networkRetryCount.value = 0 // Reset retry count on success

    return result
  } catch (error: any) {
    console.error(`Network operation failed: ${operationName}`, error)
    
    // Enhanced error handling with network awareness
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
    
    if (isNetworkError(error)) {
      if (retryable && networkRetryCount.value < maxNetworkRetries) {
        networkRetryCount.value++
        console.log(`Retrying ${operationName} (attempt ${networkRetryCount.value}/${maxNetworkRetries})`)
        const delay = Math.min(1000 * Math.pow(2, networkRetryCount.value), 10000)
        await new Promise(resolve => setTimeout(resolve, delay))
        return handleNetworkAwareOperation(operation, options)
      } else {
        console.error(`Max retries reached for ${operationName}`)
    // Store for offline retry if supported
    const capability = offlineManager.getOfflineCapability()
    if (capability.canSubmitForms) {
      await offlineManager.storeFormData(
        `${operationName}_${Date.now()}`,
        operationName,
        { operation: operationName },
        Date.now().toString()
      )
    }
      }
    }
    
    networkRetryCount.value = 0
    throw error
  } finally {
    if (showLoading) {
      networkAwareLoading.value = false
    }
  }
}

// Legacy helper functions removed - now handled by Vue Query composables

const displayName = computed(() => {
  return user.value?.user_metadata?.full_name || '用户'
})

const isDemoEvent = (event: DisplayEvent) => Boolean(event.is_demo)

const POST_LOGIN_RELOAD_KEY = 'post_login_reload'

const shouldForceReloadAfterLogin = () => {
  try {
    if (window.sessionStorage.getItem(POST_LOGIN_RELOAD_KEY)) return false
    window.sessionStorage.setItem(POST_LOGIN_RELOAD_KEY, Date.now().toString())
    return true
  } catch {
    return false
  }
}

const clearPostLoginReloadFlag = () => {
  try {
    window.sessionStorage.removeItem(POST_LOGIN_RELOAD_KEY)
  } catch {
    // Ignore storage errors (private mode, blocked storage, etc.)
  }
}

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
  // Use Vue Query mutation if available
  if (vueQueryNotificationMutations.addNotification && user.value) {
    vueQueryNotificationMutations.addNotification.mutate({
      userId: user.value.id,
      notification: item
    })
    return true
  } else {
    // Fallback to legacy method
    if (notifications.value.some((existing) => existing.id === item.id)) return false
    notifications.value = [item, ...notifications.value].slice(0, 200)
    persistNotifications()
    return true
  }
}

const markNotificationRead = (id: string) => {
  // Use Vue Query mutation if available
  if (vueQueryNotificationMutations.markAsRead && user.value) {
    vueQueryNotificationMutations.markAsRead.mutate({
      userId: user.value.id,
      notificationId: id
    })
  } else {
    // Fallback to legacy method
    const next = notifications.value.map((item) => (item.id === id ? { ...item, read: true } : item))
    notifications.value = next
    persistNotifications()
  }
}

const markAllNotificationsRead = () => {
  // Use Vue Query mutation if available
  if (vueQueryNotificationMutations.markAllAsRead && user.value) {
    vueQueryNotificationMutations.markAllAsRead.mutate({
      userId: user.value.id
    })
  } else {
    // Fallback to legacy method
    notifications.value = notifications.value.map((item) => ({ ...item, read: true }))
    persistNotifications()
  }
}

const deleteReadNotifications = () => {
  // Use Vue Query mutation if available
  if (vueQueryNotificationMutations.clearRead && user.value) {
    vueQueryNotificationMutations.clearRead.mutate({
      userId: user.value.id
    })
  } else {
    // Fallback to legacy method
    const next = notifications.value.filter((item) => !item.read)
    if (next.length === notifications.value.length) return
    notifications.value = next
    persistNotifications()
  }
}

// Vue Query integration for notifications
let vueQueryNotificationMutations: {
  addNotification?: any
  markAsRead?: any
  markAllAsRead?: any
  clearRead?: any
  clearAll?: any
} = {}

// Set Vue Query notification mutations (called from components that use the composable)
const setVueQueryNotificationMutations = (mutations: typeof vueQueryNotificationMutations) => {
  vueQueryNotificationMutations = mutations
}

// Legacy helper functions removed - now handled by Vue Query composables

// Simplified judge notification handler - detailed logic moved to Vue Query composables
// Team management methods - simplified for backward compatibility
// Full team management is now handled by Vue Query composables

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

const getMyTeamsForEvent = (eventId: string) => {
  return myTeamsByEventId.value[eventId] ?? []
}

const getMyTeamRequestsForEvent = (eventId: string) => {
  return myTeamRequestsByEventId.value[eventId] ?? []
}

const getMyTeamInvitesForEvent = (eventId: string) => {
  return myTeamInvitesByEventId.value[eventId] ?? []
}

const getTeamSeekersForEvent = (eventId: string) => {
  return teamSeekersByEventId.value[eventId] ?? []
}

const getMyTeamSeeker = (eventId: string) => {
  if (!user.value) return null
  return getTeamSeekersForEvent(eventId).find((item) => item.user_id === user.value?.id) ?? null
}

const normalizeInviteStatus = (status: string | null | undefined) => {
  if (status === 'accepted') return 'accepted'
  if (status === 'declined' || status === 'rejected') return 'rejected'
  return 'pending'
}

const fetchTeamMemberCounts = async (teamIds: string[]) => {
  if (teamIds.length === 0) return {}
  const { data, error } = await supabase
    .from('team_members')
    .select('team_id')
    .in('team_id', teamIds)
  if (error) {
    teamErrorHandler.handleError(error, { operation: 'fetchTeamMemberCounts' })
    return {}
  }
  return (data ?? []).reduce<Record<string, number>>((acc, row) => {
    const teamId = (row as { team_id?: string }).team_id
    if (teamId) acc[teamId] = (acc[teamId] ?? 0) + 1
    return acc
  }, {})
}

const loadMyTeamsForEvent = async (eventId: string) => {
  if (!eventId) return { data: [] as MyTeamEntry[], error: '' }
  if (!user.value) {
    myTeamsByEventId.value = { ...myTeamsByEventId.value, [eventId]: [] }
    return { data: [] as MyTeamEntry[], error: '' }
  }

  try {
    const userId = user.value.id
    const [
      { data: leaderTeams, error: leaderError },
      { data: memberTeams, error: memberError },
    ] = await Promise.all([
      supabase
        .from('teams')
        .select('id,event_id,leader_id,name,created_at')
        .eq('leader_id', userId)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false }),
      supabase
        .from('team_members')
        .select('team_id,joined_at,teams(id,event_id,leader_id,name,created_at)')
        .eq('user_id', userId)
        .order('joined_at', { ascending: false }),
    ])

    if (leaderError) throw leaderError
    if (memberError) throw memberError

    const leaderList = (leaderTeams ?? []).map((row) => ({
      teamId: row.id as string,
      teamName: (row.name as string) ?? 'Untitled team',
      role: 'leader' as const,
      memberCount: 1,
      status: 'active' as const,
      eventId,
      createdAt: row.created_at as string,
    }))

    const leaderIds = new Set(leaderList.map((team) => team.teamId))
    const memberList = (memberTeams ?? [])
      .map((row) => {
        const team = (row as { teams?: { id?: string; event_id?: string | null; name?: string | null; created_at?: string | null } | null }).teams
        if (!team?.id || team.event_id !== eventId || leaderIds.has(team.id)) return null
        return {
          teamId: team.id,
          teamName: team.name ?? 'Untitled team',
          role: 'member' as const,
          memberCount: 1,
          status: 'active' as const,
          eventId,
          createdAt: (row as { joined_at?: string }).joined_at || team.created_at || '',
        }
      })
      .filter((item): item is MyTeamEntry => Boolean(item))

    const teamIds = [...leaderList, ...memberList].map((team) => team.teamId)
    const memberCounts = await fetchTeamMemberCounts(teamIds)
    const attachMemberCount = (team: MyTeamEntry): MyTeamEntry => ({
      ...team,
      memberCount: Math.max(1, memberCounts[team.teamId] ?? 0),
    })
    const next = [...leaderList, ...memberList].map(attachMemberCount)

    myTeamsByEventId.value = { ...myTeamsByEventId.value, [eventId]: next }

    if (next.length > 0) {
      const membership = { ...teamMembershipByTeamId.value }
      for (const team of next) {
        membership[team.teamId] = true
      }
      teamMembershipByTeamId.value = membership
    }

    return { data: next, error: '' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load teams'
    teamErrorHandler.handleError(error, { operation: 'loadMyTeamsForEvent' })
    myTeamsByEventId.value = { ...myTeamsByEventId.value, [eventId]: [] }
    return { data: [] as MyTeamEntry[], error: message }
  }
}

const loadMyTeamRequestsForEvent = async (eventId: string) => {
  if (!eventId) return { data: [] as MyTeamRequest[], error: '' }
  if (!user.value) {
    myTeamRequestsByEventId.value = { ...myTeamRequestsByEventId.value, [eventId]: [] }
    return { data: [] as MyTeamRequest[], error: '' }
  }

  try {
    const userId = user.value.id
    const { data, error } = await supabase
      .from('team_join_requests')
      .select('id,team_id,status,message,created_at,updated_at,teams(event_id,name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    const next = (data ?? [])
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
        if (record.teams?.event_id !== eventId) return null
        if (record.status === 'cancelled') return null
        return {
          id: record.id,
          teamId: record.team_id,
          teamName: record.teams?.name ?? 'Untitled team',
          status: (record.status as MyTeamRequest['status']) ?? 'pending',
          message: record.message ?? null,
          createdAt: record.created_at,
        }
      })
      .filter((item): item is MyTeamRequest => Boolean(item))

    myTeamRequestsByEventId.value = { ...myTeamRequestsByEventId.value, [eventId]: next }

    if (data && data.length > 0) {
      const requestStatus = { ...teamRequestStatusByTeamId.value }
      const requestMap = { ...myTeamRequestsByTeamId.value }
      for (const row of data as any[]) {
        if (!row?.team_id) continue
        if (row.teams?.event_id !== eventId) continue
        requestStatus[row.team_id] = row.status ?? 'pending'
        requestMap[row.team_id] = {
          id: row.id,
          team_id: row.team_id,
          user_id: userId,
          status: row.status ?? 'pending',
          message: row.message ?? null,
          created_at: row.created_at,
          updated_at: row.updated_at ?? null,
        }
      }
      teamRequestStatusByTeamId.value = requestStatus
      myTeamRequestsByTeamId.value = requestMap
    }

    return { data: next, error: '' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load requests'
    teamErrorHandler.handleError(error, { operation: 'loadMyTeamRequestsForEvent' })
    myTeamRequestsByEventId.value = { ...myTeamRequestsByEventId.value, [eventId]: [] }
    return { data: [] as MyTeamRequest[], error: message }
  }
}

const loadMyTeamInvitesForEvent = async (eventId: string) => {
  if (!eventId) return { data: [] as MyTeamInvite[], error: '' }
  if (!user.value) {
    myTeamInvitesByEventId.value = { ...myTeamInvitesByEventId.value, [eventId]: [] }
    return { data: [] as MyTeamInvite[], error: '' }
  }

  try {
    const userId = user.value.id
    const { data, error } = await supabase
      .from('team_invites')
      .select('id,team_id,status,message,created_at,updated_at,invited_by,teams(event_id,name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    const inviterIds = new Set<string>()
    for (const row of data ?? []) {
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

    const next = (data ?? [])
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
        if (record.teams?.event_id !== eventId) return null
        return {
          id: record.id,
          teamId: record.team_id,
          teamName: record.teams?.name ?? 'Untitled team',
          invitedByName: record.invited_by ? inviterMap[record.invited_by] ?? null : null,
          status: normalizeInviteStatus(record.status) as MyTeamInvite['status'],
          message: record.message ?? null,
          createdAt: record.created_at,
        }
      })
      .filter((item): item is MyTeamInvite => Boolean(item))

    myTeamInvitesByEventId.value = { ...myTeamInvitesByEventId.value, [eventId]: next }

    if (data && data.length > 0) {
      const inviteMap = { ...myTeamInviteByTeamId.value }
      for (const row of data as any[]) {
        if (!row?.team_id) continue
        if (row.teams?.event_id !== eventId) continue
        inviteMap[row.team_id] = {
          id: row.id,
          team_id: row.team_id,
          user_id: userId,
          invited_by: row.invited_by ?? null,
          message: row.message ?? null,
          status: row.status ?? 'pending',
          created_at: row.created_at,
          updated_at: row.updated_at ?? null,
        }
      }
      myTeamInviteByTeamId.value = inviteMap
    }

    return { data: next, error: '' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load invites'
    teamErrorHandler.handleError(error, { operation: 'loadMyTeamInvitesForEvent' })
    myTeamInvitesByEventId.value = { ...myTeamInvitesByEventId.value, [eventId]: [] }
    return { data: [] as MyTeamInvite[], error: message }
  }
}

const isTeamMember = (teamId: string) => {
  return Boolean(teamMembershipByTeamId.value[teamId])
}

const loadMyTeamInvite = async (teamId: string) => {
  if (!teamId) return { data: null as TeamInvite | null, error: '' }
  if (!user.value) {
    myTeamInviteByTeamId.value = { ...myTeamInviteByTeamId.value, [teamId]: null }
    return { data: null as TeamInvite | null, error: '' }
  }

  try {
    const { data, error } = await supabase
      .from('team_invites')
      .select('id,team_id,user_id,invited_by,message,status,created_at,updated_at')
      .eq('team_id', teamId)
      .eq('user_id', user.value.id)
      .maybeSingle()

    if (error) throw error

    const invite = data
      ? ({
          id: data.id,
          team_id: data.team_id,
          user_id: data.user_id,
          invited_by: data.invited_by ?? null,
          message: data.message ?? null,
          status: data.status ?? 'pending',
          created_at: data.created_at,
          updated_at: data.updated_at ?? null,
        } as TeamInvite)
      : null

    myTeamInviteByTeamId.value = { ...myTeamInviteByTeamId.value, [teamId]: invite }
    return { data: invite, error: '' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load invite'
    teamErrorHandler.handleError(error, { operation: 'loadMyTeamInvite' })
    return { data: null as TeamInvite | null, error: message }
  }
}

const loadTeamJoinRequests = async (teamId: string) => {
  if (!teamId) return { data: [] as TeamJoinRequestRecord[], error: '' }

  try {
    const { data, error } = await supabase
      .from('team_join_requests')
      .select('id,team_id,user_id,status,message,created_at,updated_at,profiles(id,username,avatar_url,roles)')
      .eq('team_id', teamId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (error) throw error

    const next = (data ?? []).map((row) => ({
      id: row.id,
      team_id: row.team_id,
      user_id: row.user_id,
      status: row.status ?? 'pending',
      message: row.message ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at ?? null,
      profile: row.profiles && !Array.isArray(row.profiles)
        ? {
            id: (row.profiles as any).id,
            username: (row.profiles as any).username || null,
            avatar_url: (row.profiles as any).avatar_url || null,
            roles: Array.isArray((row.profiles as any).roles) ? (row.profiles as any).roles : null,
          }
        : null,
    }))

    teamJoinRequestsByTeamId.value = { ...teamJoinRequestsByTeamId.value, [teamId]: next }
    return { data: next, error: '' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load requests'
    teamErrorHandler.handleError(error, { operation: 'loadTeamJoinRequests' })
    teamJoinRequestsByTeamId.value = { ...teamJoinRequestsByTeamId.value, [teamId]: [] }
    return { data: [] as TeamJoinRequestRecord[], error: message }
  }
}

const requestJoinTeam = async (teamId: string, message?: string) => {
  if (!user.value) return { error: 'Not authenticated' }
  if (!teamId) return { error: 'Missing team id' }

  try {
    const { data: existing, error: existingError } = await supabase
      .from('team_join_requests')
      .select('id,status,created_at,updated_at')
      .eq('team_id', teamId)
      .eq('user_id', user.value.id)
      .maybeSingle()

    if (existingError) throw existingError

    let record: any = existing
    if (!existing) {
      const { data, error } = await supabase
        .from('team_join_requests')
        .insert({
          team_id: teamId,
          user_id: user.value.id,
          status: 'pending',
          message: message ?? null,
        })
        .select('id,team_id,user_id,status,message,created_at,updated_at')
        .single()
      if (error) throw error
      record = data
    } else if (existing.status !== 'pending') {
      const { data, error } = await supabase
        .from('team_join_requests')
        .update({
          status: 'pending',
          message: message ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('id,team_id,user_id,status,message,created_at,updated_at')
        .single()
      if (error) throw error
      record = data
    }

    if (record?.team_id) {
      teamRequestStatusByTeamId.value = {
        ...teamRequestStatusByTeamId.value,
        [record.team_id]: record.status ?? 'pending',
      }
      myTeamRequestsByTeamId.value = {
        ...myTeamRequestsByTeamId.value,
        [record.team_id]: {
          id: record.id,
          team_id: record.team_id,
          user_id: record.user_id,
          status: record.status ?? 'pending',
          message: record.message ?? null,
          created_at: record.created_at,
          updated_at: record.updated_at ?? null,
        },
      }

      const { data: teamData } = await supabase
        .from('teams')
        .select('event_id,name')
        .eq('id', record.team_id)
        .maybeSingle()
      const eventId = teamData?.event_id as string | undefined
      if (eventId) {
        const current = myTeamRequestsByEventId.value[eventId] ?? []
        const nextEntry: MyTeamRequest = {
          id: record.id,
          teamId: record.team_id,
          teamName: (teamData?.name as string) ?? 'Untitled team',
          status: (record.status as MyTeamRequest['status']) ?? 'pending',
          message: record.message ?? null,
          createdAt: record.created_at,
        }
        const filtered = current.filter((item) => item.id !== record.id)
        myTeamRequestsByEventId.value = {
          ...myTeamRequestsByEventId.value,
          [eventId]: [nextEntry, ...filtered],
        }
      }
    }

    return { error: '' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed'
    teamErrorHandler.handleError(error, { operation: 'requestJoinTeam' })
    return { error: message }
  }
}

const cancelTeamJoinRequest = async (requestId: string) => {
  if (!user.value) return { error: 'Not authenticated' }
  if (!requestId) return { error: 'Missing request id' }

  try {
    const { data, error } = await supabase
      .from('team_join_requests')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('user_id', user.value.id)
      .select('id,team_id,status,created_at,updated_at')
      .single()

    if (error) throw error

    const teamId = data?.team_id as string | undefined
    if (teamId) {
      teamRequestStatusByTeamId.value = {
        ...teamRequestStatusByTeamId.value,
        [teamId]: data.status ?? 'cancelled',
      }
      if (myTeamRequestsByTeamId.value[teamId]) {
        myTeamRequestsByTeamId.value = {
          ...myTeamRequestsByTeamId.value,
          [teamId]: {
            ...myTeamRequestsByTeamId.value[teamId],
            status: data.status ?? 'cancelled',
            updated_at: data.updated_at ?? new Date().toISOString(),
          },
        }
      }
    }

    const nextRequestsByEvent: Record<string, MyTeamRequest[]> = {}
    for (const key of Object.keys(myTeamRequestsByEventId.value)) {
      nextRequestsByEvent[key] = (myTeamRequestsByEventId.value[key] ?? []).filter(
        (item) => item.id !== requestId,
      )
    }
    myTeamRequestsByEventId.value = nextRequestsByEvent

    return { error: '' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cancel failed'
    teamErrorHandler.handleError(error, { operation: 'cancelTeamJoinRequest' })
    return { error: message }
  }
}

const acceptTeamInvite = async (inviteId: string, teamId: string) => {
  if (!user.value) return { error: 'Not authenticated' }
  if (!inviteId || !teamId) return { error: 'Missing invite info' }

  try {
    const { error: inviteError } = await supabase
      .from('team_invites')
      .update({
        status: 'accepted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', inviteId)
      .eq('user_id', user.value.id)

    if (inviteError) throw inviteError

    const { error: memberError } = await supabase
      .from('team_members')
      .upsert({
        team_id: teamId,
        user_id: user.value.id,
        joined_at: new Date().toISOString(),
      }, { onConflict: 'team_id,user_id' })

    if (memberError) throw memberError

    teamMembershipByTeamId.value = { ...teamMembershipByTeamId.value, [teamId]: true }
    myTeamInviteByTeamId.value = {
      ...myTeamInviteByTeamId.value,
      [teamId]: myTeamInviteByTeamId.value[teamId]
        ? { ...myTeamInviteByTeamId.value[teamId]!, status: 'accepted', updated_at: new Date().toISOString() }
        : {
            id: inviteId,
            team_id: teamId,
            user_id: user.value.id,
            invited_by: null,
            message: null,
            status: 'accepted',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
    }

    const nextInvitesByEvent: Record<string, MyTeamInvite[]> = {}
    for (const key of Object.keys(myTeamInvitesByEventId.value)) {
      nextInvitesByEvent[key] = (myTeamInvitesByEventId.value[key] ?? []).filter(
        (item) => item.id !== inviteId,
      )
    }
    myTeamInvitesByEventId.value = nextInvitesByEvent

    return { error: '' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Accept failed'
    teamErrorHandler.handleError(error, { operation: 'acceptTeamInvite' })
    return { error: message }
  }
}

const rejectTeamInvite = async (inviteId: string, teamId: string) => {
  if (!user.value) return { error: 'Not authenticated' }
  if (!inviteId || !teamId) return { error: 'Missing invite info' }

  try {
    const { error: inviteError } = await supabase
      .from('team_invites')
      .update({
        status: 'declined',
        updated_at: new Date().toISOString(),
      })
      .eq('id', inviteId)
      .eq('user_id', user.value.id)

    if (inviteError) throw inviteError

    myTeamInviteByTeamId.value = {
      ...myTeamInviteByTeamId.value,
      [teamId]: myTeamInviteByTeamId.value[teamId]
        ? { ...myTeamInviteByTeamId.value[teamId]!, status: 'declined', updated_at: new Date().toISOString() }
        : {
            id: inviteId,
            team_id: teamId,
            user_id: user.value.id,
            invited_by: null,
            message: null,
            status: 'declined',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
    }

    const nextInvitesByEvent: Record<string, MyTeamInvite[]> = {}
    for (const key of Object.keys(myTeamInvitesByEventId.value)) {
      nextInvitesByEvent[key] = (myTeamInvitesByEventId.value[key] ?? []).filter(
        (item) => item.id !== inviteId,
      )
    }
    myTeamInvitesByEventId.value = nextInvitesByEvent

    return { error: '' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Reject failed'
    teamErrorHandler.handleError(error, { operation: 'rejectTeamInvite' })
    return { error: message }
  }
}

const removeTeamMember = async (teamId: string, memberId: string) => {
  if (!teamId || !memberId) return { error: 'Missing member info' }

  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', memberId)

  if (error) {
    teamErrorHandler.handleError(error, { operation: 'removeTeamMember' })
    return { error: error.message }
  }

  const currentMembers = teamMembersByTeamId.value[teamId] ?? []
  teamMembersByTeamId.value = {
    ...teamMembersByTeamId.value,
    [teamId]: currentMembers.filter((member) => member.user_id !== memberId),
  }

  if (user.value?.id === memberId) {
    teamMembershipByTeamId.value = { ...teamMembershipByTeamId.value, [teamId]: false }
  }

  return { error: '' }
}

const updateTeamJoinRequestStatus = async (requestId: string, status: 'approved' | 'rejected') => {
  if (!requestId) return { error: 'Missing request id' }

  try {
    const { data, error } = await supabase
      .from('team_join_requests')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select('team_id,user_id,status')
      .single()

    if (error) throw error

    if (status === 'approved' && data?.team_id && data?.user_id) {
      const { error: memberError } = await supabase
        .from('team_members')
        .upsert({
          team_id: data.team_id,
          user_id: data.user_id,
          joined_at: new Date().toISOString(),
        }, { onConflict: 'team_id,user_id' })
      if (memberError) throw memberError
    }

    return { error: '' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Update failed'
    teamErrorHandler.handleError(error, { operation: 'updateTeamJoinRequestStatus' })
    return { error: message }
  }
}

const closeTeam = async (teamId: string) => {
  if (!teamId) return { error: 'Missing team id' }

  const { error } = await supabase
    .from('teams')
    .update({ is_closed: true, updated_at: new Date().toISOString() })
    .eq('id', teamId)

  if (error) {
    teamErrorHandler.handleError(error, { operation: 'closeTeam' })
    return { error: error.message }
  }

  return { error: '' }
}

const reopenTeam = async (teamId: string) => {
  if (!teamId) return { error: 'Missing team id' }

  const { error } = await supabase
    .from('teams')
    .update({ is_closed: false, updated_at: new Date().toISOString() })
    .eq('id', teamId)

  if (error) {
    teamErrorHandler.handleError(error, { operation: 'reopenTeam' })
    return { error: error.message }
  }

  return { error: '' }
}

const deleteTeam = async (eventId: string, teamId: string) => {
  if (!teamId) return { error: 'Missing team id' }

  const { error } = await supabase.from('teams').delete().eq('id', teamId)
  if (error) {
    teamErrorHandler.handleError(error, { operation: 'deleteTeam' })
    return { error: error.message }
  }

  if (eventId) {
    const currentTeams = myTeamsByEventId.value[eventId] ?? []
    myTeamsByEventId.value = {
      ...myTeamsByEventId.value,
      [eventId]: currentTeams.filter((team) => team.teamId !== teamId),
    }
  }

  const {
    [teamId]: _removedMembers,
    ...remainingMembers
  } = teamMembersByTeamId.value
  teamMembersByTeamId.value = remainingMembers

  const {
    [teamId]: _removedMembership,
    ...remainingMembership
  } = teamMembershipByTeamId.value
  teamMembershipByTeamId.value = remainingMembership

  const {
    [teamId]: _removedRequestStatus,
    ...remainingRequestStatus
  } = teamRequestStatusByTeamId.value
  teamRequestStatusByTeamId.value = remainingRequestStatus

  const {
    [teamId]: _removedRequests,
    ...remainingRequests
  } = teamJoinRequestsByTeamId.value
  teamJoinRequestsByTeamId.value = remainingRequests

  const {
    [teamId]: _removedInvite,
    ...remainingInvites
  } = myTeamInviteByTeamId.value
  myTeamInviteByTeamId.value = remainingInvites

  const {
    [teamId]: _removedMyRequest,
    ...remainingMyRequests
  } = myTeamRequestsByTeamId.value
  myTeamRequestsByTeamId.value = remainingMyRequests

  return { error: '' }
}

// Legacy team methods - these should be replaced with Vue Query composables
// Keeping minimal implementations for backward compatibility

// Simplified judge notification handler - detailed logic moved to Vue Query composables
const handleJudgeNotificationClick = async (notificationId: string, eventId: string) => {
  // Mark notification as read
  markNotificationRead(notificationId)
  
  // Return event page route - judge permission checking now handled by Vue Query composables
  return `/events/${eventId}`
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
    teamMembershipByTeamId.value = {}
    teamRequestStatusByTeamId.value = {}
    teamJoinRequestsByTeamId.value = {}
    myTeamInviteByTeamId.value = {}
    myTeamRequestsByTeamId.value = {}
    myTeamsByEventId.value = {}
    myTeamRequestsByEventId.value = {}
    myTeamInvitesByEventId.value = {}
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
  
  // 缓存用户信息
  if (user.value) {
    stateCache.set('user', user.value, 60) // 缓存1小时
  }
}

const loadMyRegistrations = async () => {
  myRegistrationByEventId.value = {}
  if (!user.value) return

  return handleNetworkAwareOperation(async () => {
    registrationsLoading.value = true
    const { data, error } = await supabase
      .from('registrations')
      .select('id,event_id,status')
      .eq('user_id', user.value!.id)
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
    
    // 缓存注册数据
    stateCache.set('myRegistrations', next, 10) // 缓存10分钟
    stateCache.set('registrationsLoaded', true, 10)
    
    syncNotifications()
    
    return next
  }, {
    operationName: 'loadMyRegistrations',
    cacheKey: user.value ? `registrations_${user.value.id}` : undefined,
    retryable: true
  })
}

const ensureRegistrationsLoaded = async () => {
  // 如果有缓存数据且未过期，直接返回
  if (registrationsLoaded.value && Object.keys(myRegistrationByEventId.value).length > 0) return
  
  if (registrationsLoaded.value || registrationsLoading.value || !user.value) return
  await loadMyRegistrations()
}

const syncNotifications = () => {
  if (!user.value) return
  // Notification syncing logic simplified - detailed logic moved to Vue Query composables
  if (!notificationsLoaded.value) loadNotifications()
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

const openAuth = (view: AuthView) => {
  authView.value = view
  authModalOpen.value = true
  authError.value = ''
  authInfo.value = ''
}

const openAuthModal = (view: AuthView) => {
  openAuth(view)
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

  try {
    if (authView.value === 'sign_in') {
      // 支持邮箱或用户名登录
      const input = authEmail.value.trim()
      let loginEmail = input
      
      // 如果输入不是邮箱格式，尝试通过用户名查找邮箱
      if (!isEmailFormat(input)) {
        const emailFromUsername = await getUserEmailByUsername(input)
        if (!emailFromUsername) {
          authError.value = '用户不存在，请检查用户名或邮箱'
          authErrorHandler.handleError(new Error('User not found'), {
            operation: 'login',
            component: 'auth-modal',
            additionalData: {
              emailOrUsername: input,
              errorCode: 400
            }
          })
          return
        }
        loginEmail = emailFromUsername
      }
      
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: authPassword.value
      })
      
      if (error) {
        const localizedError = getLocalizedAuthError(error)
        authError.value = localizedError.message
        
        authErrorHandler.handleError(error, {
          operation: 'login',
          component: 'auth-modal',
          additionalData: {
            emailOrUsername: input,
            errorCode: error.status || error.code
          }
        })
      }
    } else {
      // 注册逻辑
      const trimmedFullName = authFullName.value.trim()
      const trimmedEmail = authEmail.value.trim()
      
      // 验证用户名格式
      const usernameValidation = validateUsername(trimmedFullName)
      if (!usernameValidation.isValid) {
        authError.value = usernameValidation.message || '用户名格式不正确'
        return
      }
      
      // 检查用户名是否已存在
      const usernameExists = await checkUsernameExists(trimmedFullName)
      if (usernameExists) {
        authError.value = '该用户名已被使用，请选择其他用户名'
        return
      }

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: authPassword.value,
        options: {
          data: {
            full_name: trimmedFullName,
          },
        },
      })

      if (error) {
        const localizedError = getLocalizedAuthError(error)
        authError.value = localizedError.message
        
        authErrorHandler.handleError(error, {
          operation: 'register',
          component: 'auth-modal',
          additionalData: {
            email: trimmedEmail,
            fullName: trimmedFullName,
            errorCode: error.status || error.code
          }
        })
      } else if (data.user && !data.session) {
        authInfo.value = '已发送验证邮件，请完成邮箱确认后再登录'
      }
    }
  } catch (unexpectedError) {
    console.error('Unexpected auth error:', unexpectedError)
    authError.value = '系统错误，请稍后重试'
    
    authErrorHandler.handleError(unexpectedError, {
      operation: authView.value === 'sign_in' ? 'login' : 'register',
      component: 'auth-modal'
    })
  } finally {
    authBusy.value = false
  }
}

const handleSignOut = async () => {
  clearBanners()
  
  // 清除状态缓存
  stateCache.clear()

  clearPostLoginReloadFlag()
  
  user.value = null
  myRegistrationByEventId.value = {}
  registrationsLoaded.value = false
  teamMembershipByTeamId.value = {}
  teamRequestStatusByTeamId.value = {}
  teamJoinRequestsByTeamId.value = {}
  myTeamInviteByTeamId.value = {}
  myTeamRequestsByTeamId.value = {} // Clear stored request records
  
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

  return { data: data as Event, error: '' }
}

const updateEventStatus = async (eventId: string, status: EventStatus, description?: string | null) => {
  if (!isAdmin.value) {
    return { data: null, error: '没有权限：仅管理员可更新活动' }
  }

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

  return handleNetworkAwareOperation(async () => {
    registrationBusyEventId.value = event.id
    
    // Store form data for offline retry if needed
    if (!isOnline.value) {
      await offlineManager.storeFormData(
        `registration_${event.id}_${user.value?.id}`,
        'registration',
        {
          event_id: event.id,
          user_id: user.value?.id,
          status: 'registered',
          form_response: formResponse,
        },
        Date.now().toString()
      )
      
      handleSuccessWithBanner('网络连接不稳定，报名信息已保存，将在网络恢复后自动提交', setBanner, { 
        operation: 'submitRegistration',
        component: 'offline' 
      })
      registrationBusyEventId.value = null
      return { error: '' }
    }

    // Check if user is already registered first
    const { data: existingRegistration } = await supabase
      .from('registrations')
      .select('id,created_at')
      .eq('event_id', event.id)
      .eq('user_id', user.value!.id)
      .maybeSingle()

    if (existingRegistration) {
      // Update local state to reflect database state
      myRegistrationByEventId.value = {
        ...myRegistrationByEventId.value,
        [event.id]: existingRegistration.id,
      }
      
      handleSuccessWithBanner('你已报名该活动', setBanner, { 
        operation: 'submitRegistration',
        component: 'validation' 
      })
      registrationBusyEventId.value = null
      return { error: '' }
    }

    // Use upsert to handle race conditions gracefully
    const { data, error } = await supabase
      .from('registrations')
      .upsert({
        event_id: event.id,
        user_id: user.value!.id,
        status: 'registered',
        form_response: formResponse,
      }, {
        onConflict: 'user_id,event_id',
        ignoreDuplicates: false
      })
      .select('id,event_id,created_at')
      .single()

    if (error) {
      eventErrorHandler.handleError(error, { operation: 'submitRegistration' })
      registrationBusyEventId.value = null
      return { error: error.message }
    }

    const row = data as RegistrationRow & { created_at: string }
    myRegistrationByEventId.value = {
      ...myRegistrationByEventId.value,
      [row.event_id]: row.id,
    }
    
    // Invalidate cache
    if (user.value) {
      await cacheManager.invalidate(`registrations_${user.value.id}`)
    }
    
    // 清除相关的 Vue Query 缓存
    const queryClient = getQueryClient()
    
    // 清除报名人数缓存
    queryClient.invalidateQueries({
      queryKey: ['registrations', 'count', event.id]
    })
    
    // 清除带报名人数的活动列表缓存
    queryClient.invalidateQueries({
      queryKey: ['events', 'public', 'with-registration-count']
    })
    queryClient.invalidateQueries({
      queryKey: ['events', 'all', 'with-registration-count']
    })
    if (user.value) {
      queryClient.invalidateQueries({
        queryKey: ['events', 'my', user.value.id, 'with-registration-count']
      })
    }
    
    // Check if this was a new registration (created recently) or existing one
    const isNewRegistration = new Date(row.created_at).getTime() > (Date.now() - 5000) // Within last 5 seconds
    
    if (isNewRegistration) {
      handleSuccessWithBanner('报名成功', setBanner, { 
        operation: 'submitRegistration',
        component: 'form' 
      })
    } else {
      handleSuccessWithBanner('你已报名该活动', setBanner, { 
        operation: 'submitRegistration',
        component: 'validation' 
      })
    }
    
    registrationBusyEventId.value = null
    return { error: '' }
  }, {
    operationName: 'submitRegistration',
    retryable: true
  })
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

let initialized = false
let authSubscription: Subscription | null = null

const init = async () => {
  if (initialized) return
  initialized = true

  console.log('🚀 Initializing app store...')

  // 简化初始化流程，优先加载用户数据
  try {
    await refreshUser()
    console.log('✅ User data loaded')
  } catch (error) {
    console.warn('⚠️ Failed to load user data:', error)
  }

  // 异步加载其他数据，不阻塞主流程
  setTimeout(() => {
    loadNotifications()
    maybePushProfileSetupNotification()
    if (user.value) {
      startNotificationTicker()
      void loadMyPendingTeamActions()
    }
  }, 100)

  // 延迟初始化网络状态监控
  setTimeout(() => {
    try {
      // Initialize network state monitoring
      networkStateCleanup = networkManager.addNetworkStateListener((state) => {
        networkState.value = state
        
        // Update performance metrics
        performanceMetrics.value.networkLatency = state.rtt
        
        // Handle connectivity restoration
        if (state.isOnline && !networkState.value.isOnline) {
          handleConnectivityRestoration()
        }
      })
      console.log('✅ Network monitoring initialized')
    } catch (error) {
      console.warn('⚠️ Failed to initialize network monitoring:', error)
    }
  }, 1000)

  // 记录页面加载时间
  const pageLoadStart = performance.now()
  performanceMetrics.value.pageLoadTime = performance.now() - pageLoadStart

  const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (!session) {
      clearPostLoginReloadFlag()
      user.value = null
      notifications.value = []
      notificationsLoaded.value = false
      stopNotificationTicker()
      myRegistrationByEventId.value = {}
      registrationsLoaded.value = false
      pendingRequestsCount.value = 0
      pendingInvitesCount.value = 0
      teamMembershipByTeamId.value = {}
      teamRequestStatusByTeamId.value = {}
      teamJoinRequestsByTeamId.value = {}
      myTeamInviteByTeamId.value = {}
      myTeamRequestsByTeamId.value = {}
      myTeamsByEventId.value = {}
      myTeamRequestsByEventId.value = {}
      myTeamInvitesByEventId.value = {}
      
      // Clear network-related state
      networkRetryCount.value = 0
      
      return
    }

    user.value = session.user
    closeAuth()
    await refreshUser()
    loadNotifications()
    maybePushProfileSetupNotification()
    startNotificationTicker()
    void loadMyPendingTeamActions()
    
    // 登录成功后刷新内容
    if (event === 'SIGNED_IN') {
      if (shouldForceReloadAfterLogin()) {
        console.log('Forcing one-time reload after login')
        setTimeout(() => window.location.reload(), 50)
        return
      }

      await refreshContentAfterLogin()
    }
  })

  authSubscription = listener.subscription
  console.log('✅ App store initialized')
}

// Handle connectivity restoration
const handleConnectivityRestoration = async () => {
  // Retry failed network operations
  try {
    await networkManager.retryFailedRequests()
    
    // Sync offline changes
    const storedForms = await offlineManager.getAllStoredForms()
    if (storedForms.length > 0) {
      console.log(`Found ${storedForms.length} stored forms to sync`)
      // Here you would implement the sync logic
    }
    
    // Show restoration notification
    handleSuccessWithBanner('网络连接已恢复', setBanner, { 
      operation: 'connectivity',
      component: 'network' 
    })
  } catch (error) {
    console.warn('Failed to handle connectivity restoration:', error)
  }
}

// 登录后刷新内容
const refreshContentAfterLogin = async () => {
  try {
    console.log('🔄 Refreshing content after login...')
    
    // 使用专门的组合函数处理登录后的数据刷新
    const { useAuthRefresh } = await import('../composables/useAuthRefresh')
    const { refreshContentAfterLogin: doRefresh } = useAuthRefresh()
    
    await doRefresh()
    
  } catch (error) {
    console.warn('⚠️ Failed to refresh content after login:', error)
    // 不要因为刷新失败而影响登录流程，只记录错误
    authErrorHandler.handleError(error, { 
      operation: 'refreshContentAfterLogin',
      component: 'auth' 
    })
  }
}

const dispose = () => {
  authSubscription?.unsubscribe()
  authSubscription = null
  initialized = false
  stopNotificationTicker()
  
  // Clean up network state monitoring
  if (networkStateCleanup) {
    networkStateCleanup()
    networkStateCleanup = null
  }
}

const store = proxyRefs({
  user,
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
  isAuthed,
  isAdmin,
  displayName,
  isDemoEvent,
  setBanner,
  clearBanners,
  refreshUser,
  loadNotifications,
  setVueQueryNotificationMutations,
  markNotificationRead,
  markAllNotificationsRead,
  deleteReadNotifications,
  loadMyPendingTeamActions,
  // Legacy team methods - kept for backward compatibility but should be replaced with Vue Query
  getTeamsForEvent,
  getTeamSeekersForEvent,
  getMyTeamSeeker,
  getMyTeamsForEvent,
  getMyTeamRequestsForEvent,
  getMyTeamInvitesForEvent,
  getTeamMembers,
  getTeamRequestStatus,
  getTeamJoinRequests,
  getMyTeamInvite,
  isTeamMember,
  loadMyTeamsForEvent,
  loadMyTeamRequestsForEvent,
  loadMyTeamInvitesForEvent,
  loadMyTeamInvite,
  loadTeamJoinRequests,
  requestJoinTeam,
  cancelTeamJoinRequest,
  acceptTeamInvite,
  rejectTeamInvite,
  removeTeamMember,
  updateTeamJoinRequestStatus,
  closeTeam,
  reopenTeam,
  deleteTeam,
  // Registration management
  loadMyRegistrations,
  ensureRegistrationsLoaded,
  // Authentication
  openAuth,
  openAuthModal,
  closeAuth,
  submitAuth,
  handleSignOut,
  // Event creation (admin only)
  openCreateModal,
  closeCreateModal,
  submitCreate,
  updateEvent,
  updateEventStatus,
  deleteDraftEvent,
  // Registration actions
  submitRegistration,
  registrationLabel,
  registrationVariant,
  toggleRegistration,
  // Judge notifications
  handleJudgeNotificationClick,
  // Lifecycle
  init,
  dispose,
  
  // Content refresh
  refreshContentAfterLogin,
  
  // Network state
  networkState,
  isOnline,
  connectionQuality,
  networkStatus,
  
  // Network-aware features
  networkAwareLoading,
  networkRetryCount,
  isOfflineMode,
  offlineCapabilities,
  performanceMetrics,
  handleNetworkAwareOperation,
  handleConnectivityRestoration,
})

export const useAppStore = () => store
