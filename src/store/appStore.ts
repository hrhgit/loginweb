import { computed, proxyRefs, ref } from 'vue'
import type { Subscription, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { buildEventDescription, createDefaultEventDetails } from '../utils/eventDetails'
import { demoEvents } from './demoEvents'
import { EVENT_SELECT } from './eventSchema'
import type { AuthView, DisplayEvent, Event, EventStatus, Profile, UserContacts } from './models'

export type { AuthView, DisplayEvent, Event, EventStatus } from './models'

type RegistrationRow = {
  id: string
  event_id: string
  status: string | null
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

const clearBanners = () => {
  bannerInfo.value = ''
  bannerError.value = ''
  eventsError.value = ''
}

const refreshUser = async () => {
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session) {
    user.value = null
    profile.value = null
    contacts.value = null
    return
  }

  const sessionUser = sessionData.session.user
  const { data, error } = await supabase.auth.getUser()
  if (error) {
    user.value = sessionUser
    setBanner('error', error.message)
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
    .select('id,username,avatar_url,roles,is_admin')
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
  if (!user.value) return { error: '请先登录。' }
  profileLoading.value = true
  profileError.value = ''

  try {
    const nextPayload = { ...payload }
    // Handle avatar upload if data URL is provided
    if (nextPayload.avatar_url && nextPayload.avatar_url.startsWith('data:image')) {
      const blob = dataURLtoBlob(nextPayload.avatar_url)
      if (!blob) {
        throw new Error('无效的头像图片格式。')
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
      .select('id,username,avatar_url,roles,is_admin')
      .maybeSingle()

    if (error) {
      throw error
    }

    profile.value = (data ?? null) as Profile | null
    return { error: '' }
  } catch (error: any) {
    const errorMessage = error.message || '更新个人资料时发生未知错误。'
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
  if (!user.value) return { error: '请先登录。' }
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
    setBanner('error', error.message)
    events.value = []
  } else {
    events.value = data as Event[]
  }

  eventsLoading.value = false
  eventsLoaded.value = true
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
    setBanner('error', error.message)
    return
  }

  const next: Record<string, string> = {}
  for (const row of data as RegistrationRow[]) {
    next[row.event_id] = row.id
  }
  myRegistrationByEventId.value = next
  registrationsLoading.value = false
  registrationsLoaded.value = true
}

const ensureRegistrationsLoaded = async () => {
  if (registrationsLoaded.value || registrationsLoading.value || !user.value) return
  await loadMyRegistrations()
}

const getEventById = (id: string) => {
  return displayedEvents.value.find((event) => event.id === id) ?? null
}

const fetchEventById = async (id: string) => {
  const cached = getEventById(id)
  if (cached) return { data: cached, error: '' }

  const { data, error } = await (supabase.from('events').select(EVENT_SELECT) as any).eq('id', id).maybeSingle()

  if (error) return { data: null, error: error.message }
  if (!data) return { data: null, error: '活动不存在。' }

  const next = data as Event
  if (next.status === 'draft') {
    if (!user.value) {
      await refreshUser()
    }
    if (!user.value || next.created_by !== user.value.id) {
      return { data: null, error: '草稿仅发布者可见。' }
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
      authInfo.value = '已发送验证邮件，请完成邮箱确认后再登录。'
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
  void loadEvents()
  void supabase.auth.signOut().then(({ error }) => {
    if (error) setBanner('error', error.message)
  })
}

const openCreateModal = () => {
  if (!isAdmin.value) {
    setBanner('error', '没有权限：仅管理员可发起活动。')
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
    createError.value = '没有权限：仅管理员可发起活动。'
    return null
  }

  const title = createTitle.value.trim()
  if (!title) {
    createError.value = '请填写活动标题。'
    return null
  }

  const teamMaxSizeInput = `${createTeamMaxSize.value ?? ''}`.trim()
  let teamMaxSize = 0
  if (teamMaxSizeInput) {
    const parsed = Number.parseInt(teamMaxSizeInput, 10)
    if (!Number.isFinite(parsed) || parsed < 0) {
      createError.value = '队伍最大人数需要是 0 或大于 0 的数字。'
      return null
    }
    teamMaxSize = parsed
  }

  const startDate = createStartTime.value ? new Date(createStartTime.value) : null
  const endDate = createEndTime.value ? new Date(createEndTime.value) : null
  if (startDate && Number.isNaN(startDate.getTime())) {
    createError.value = '开始时间无效。'
    return null
  }
  if (endDate && Number.isNaN(endDate.getTime())) {
    createError.value = '结束时间无效。'
    return null
  }
  if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
    createError.value = '开始时间不能晚于结束时间。'
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

  setBanner('info', '活动已保存为草稿，进入页面继续完善。')
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
    return { data: null, error: '没有权限：仅管理员可更新活动。' }
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
    return { data: null, error: '没有权限：仅管理员可更新活动。' }
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

  events.value = events.value.map((event) =>
    event.id === data.id ? { ...event, status: data.status, description: data.description ?? event.description } : event,
  )

  return { data: data as { id: string; status: EventStatus; description: string | null }, error: '' }
}

const deleteDraftEvent = async (event: DisplayEvent) => {
  clearBanners()
  if (isDemoEvent(event)) {
    setBanner('info', '这是前端临时活动，仅用于展示，无法删除。')
    return { error: 'demo' }
  }
  if (!user.value) {
    openAuth('sign_in')
    authInfo.value = '请先登录后删除草稿。'
    return { error: 'auth' }
  }
  if (!isAdmin.value) {
    setBanner('error', '没有权限：仅管理员可删除草稿。')
    return { error: 'auth' }
  }
  if (event.status !== 'draft') {
    setBanner('error', '只有草稿可以删除。')
    return { error: 'status' }
  }
  if (event.created_by && event.created_by !== user.value.id) {
    setBanner('error', '没有权限删除他人草稿。')
    return { error: 'auth' }
  }

  deleteBusyEventId.value = event.id
  const { error } = await supabase.from('events').delete().eq('id', event.id)
  if (error) {
    setBanner('error', error.message)
    deleteBusyEventId.value = null
    return { error: error.message }
  }

  events.value = events.value.filter((item) => item.id !== event.id)
  setBanner('info', '草稿已删除。')
  deleteBusyEventId.value = null
  return { error: '' }
}

const submitRegistration = async (event: DisplayEvent, formResponse: Record<string, string | string[]>) => {
  clearBanners()
  if (isDemoEvent(event)) {
    setBanner('info', '这是前端临时活动，仅用于展示，暂不支持报名。')
    return { error: 'demo' }
  }
  if (event.status === 'draft') {
    setBanner('info', '草稿活动暂不支持报名。')
    return { error: 'draft' }
  }
  if (!user.value) {
    openAuth('sign_in')
    authInfo.value = '请先登录后报名。'
    return { error: 'auth' }
  }

  if (myRegistrationByEventId.value[event.id]) {
    setBanner('info', '你已报名该活动。')
    return { error: '' }
  }

  registrationBusyEventId.value = event.id
  const { data, error } = await supabase
    .from('registrations')
    .insert({
      event_id: event.id,
      user_id: user.value.id,
      status: 'pending',
      form_response: formResponse,
    })
    .select('id,event_id')
    .single()

  if (error) {
    setBanner('error', error.message)
    registrationBusyEventId.value = null
    return { error: error.message }
  }

  const row = data as RegistrationRow
  myRegistrationByEventId.value = {
    ...myRegistrationByEventId.value,
    [row.event_id]: row.id,
  }
  setBanner('info', '报名成功。')
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
    setBanner('info', '这是前端临时活动，仅用于展示，暂不支持报名。')
    return
  }
  if (event.status === 'draft') {
    setBanner('info', '草稿活动暂不支持报名。')
    return
  }
  if (!user.value) {
    openAuth('sign_in')
    authInfo.value = '请先登录后报名。'
    return
  }

  const existingId = myRegistrationByEventId.value[event.id]
  registrationBusyEventId.value = event.id

  if (!existingId) {
    setBanner('info', '请在活动详情页填写报名表。')
    registrationBusyEventId.value = null
    return
  }

  const { error } = await supabase.from('registrations').delete().eq('id', existingId)

  if (error) {
    setBanner('error', error.message)
  } else {
    const next = { ...myRegistrationByEventId.value }
    delete next[event.id]
    myRegistrationByEventId.value = next
    setBanner('info', '已取消报名。')
  }

  registrationBusyEventId.value = null
}

let initialized = false
let authSubscription: Subscription | null = null

const init = async () => {
  if (initialized) return
  initialized = true

  await refreshUser()
  void loadMyProfile()
  void loadMyContacts()
  void loadEvents()
  void loadMyRegistrations()

  const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!session) {
      user.value = null
      profile.value = null
      contacts.value = null
      myRegistrationByEventId.value = {}
      registrationsLoaded.value = false
      void loadEvents()
      return
    }

    user.value = session.user
    closeAuth()
    void refreshUser()
    void loadMyProfile()
    void loadMyContacts()
    void loadEvents()
    void loadMyRegistrations()
    closeAuth()
  })

  authSubscription = listener.subscription
}

const dispose = () => {
  authSubscription?.unsubscribe()
  authSubscription = null
  initialized = false
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
  init,
  dispose,
})

export const useAppStore = () => store
