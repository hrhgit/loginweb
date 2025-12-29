﻿<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  Clock,
  MapPin,
  Users,
  Edit,
  Undo2,
  Filter,
  UserPlus,
  Info,
  ListOrdered,
  FileText,
  Upload,
  Plus,
  X,
  Eye,
  Trash2,
  Send,
} from 'lucide-vue-next'
import { useAppStore } from '../store/appStore'
import { supabase } from '../lib/supabase'
import MyTeamsTabContent from '../components/MyTeamsTabContent.vue'
import SubmissionCard from '../components/showcase/SubmissionCard.vue'
import {
  teamSizeLabel,
  formatTimeRange,
  locationLabel,
  statusClass,
  statusLabel,
} from '../utils/eventFormat'
import {
  createDefaultEventDetails,
  getEventDetailsFromDescription,
  getEventSummaryText,
  type QuestionDependency,
  type RegistrationQuestion,
} from '../utils/eventDetails'
import { getRoleTagClass, getRoleTagKey, sortRoleLabels } from '../utils/roleTags'

const store = useAppStore()
const route = useRoute()
const router = useRouter()

type DetailTab = 'intro' | 'registration' | 'form' | 'team' | 'showcase'
const props = defineProps<{ tab: DetailTab }>()

const event = ref(store.getEventById(String(route.params.id ?? '')))
const loading = ref(false)
const error = ref('')
const registrationModalOpen = ref(false)
const registrationSubmitBusy = ref(false)
const revertBusy = ref(false)
const registrationError = ref('')
const registrationErrors = ref<Record<string, string>>({})
const registrationAnswers = ref<Record<string, string | string[]>>({})
const registrationOtherText = ref<Record<string, string>>({})
const formEditMode = ref(false)
const formSaveBusy = ref(false)
const formSaveError = ref('')
const formErrors = ref<Record<string, string>>({})
const formAnswers = ref<Record<string, string | string[]>>({})
const formOtherText = ref<Record<string, string>>({})
const formSnapshot = ref('')
const formLoading = ref(false)
const joinModalOpen = ref(false)
const joinTargetTeamId = ref<string | null>(null)
const joinMessage = ref('')
const joinSubmitBusy = ref(false)
const joinError = ref('')
const registrationCount = ref<number | null>(null)

type AutocompleteScope = 'reg' | 'form'
const autocompleteOpen = ref<Record<string, boolean>>({})
const autocompleteCloseTimers: Record<string, number> = {}

const getAutocompleteKey = (scope: AutocompleteScope, questionId: string) => `${scope}-${questionId}`

const clearAutocompleteTimer = (key: string) => {
  const timer = autocompleteCloseTimers[key]
  if (timer) {
    window.clearTimeout(timer)
    delete autocompleteCloseTimers[key]
  }
}

const setAutocompleteOpen = (scope: AutocompleteScope, questionId: string, open: boolean) => {
  const key = getAutocompleteKey(scope, questionId)
  autocompleteOpen.value[key] = open
  if (!open) clearAutocompleteTimer(key)
}

const openAutocomplete = (scope: AutocompleteScope, questionId: string, enabled = true) => {
  if (!enabled) return
  const key = getAutocompleteKey(scope, questionId)
  clearAutocompleteTimer(key)
  autocompleteOpen.value[key] = true
}

const scheduleCloseAutocomplete = (scope: AutocompleteScope, questionId: string) => {
  const key = getAutocompleteKey(scope, questionId)
  clearAutocompleteTimer(key)
  autocompleteCloseTimers[key] = window.setTimeout(() => {
    autocompleteOpen.value[key] = false
    delete autocompleteCloseTimers[key]
  }, 140)
}

const isAutocompleteOpen = (scope: AutocompleteScope, questionId: string) => {
  return Boolean(autocompleteOpen.value[getAutocompleteKey(scope, questionId)])
}

const getAutocompleteMatches = (question: RegistrationQuestion, value: string | string[] | undefined) => {
  const options = question.options ?? []
  const query = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!query) return options
  return options.filter((option) => option.label.toLowerCase().includes(query))
}

const applyAutocompleteValue = (scope: AutocompleteScope, questionId: string, value: string) => {
  if (scope === 'reg') {
    registrationAnswers.value = { ...registrationAnswers.value, [questionId]: value }
  } else {
    formAnswers.value = { ...formAnswers.value, [questionId]: value }
  }
  setAutocompleteOpen(scope, questionId, false)
}

const closeAutocompleteScope = (scope: AutocompleteScope) => {
  const prefix = `${scope}-`
  for (const key of Object.keys(autocompleteOpen.value)) {
    if (key.startsWith(prefix)) {
      autocompleteOpen.value[key] = false
      clearAutocompleteTimer(key)
    }
  }
}

watch(formEditMode, (enabled) => {
  if (!enabled) closeAutocompleteScope('form')
})

watch(registrationModalOpen, (open) => {
  if (!open) closeAutocompleteScope('reg')
})

const eventId = computed(() => String(route.params.id ?? ''))
const detailTab = computed<DetailTab>(() => props.tab)
const goTab = async (tab: DetailTab) => {
  const id = eventId.value
  if (!id) return
  const nextPath = tab === 'intro' ? `/events/${id}` : `/events/${id}/${tab}`
  if (route.path === nextPath) return
  await router.push(nextPath)
}
const isDemo = computed(() => (event.value ? store.isDemoEvent(event.value) : false))
const canEditDraft = computed(() => {
  if (!event.value || isDemo.value) return false
  if (!store.user) return false
  if (event.value.status !== 'draft') return false
  return store.isAdmin && event.value.created_by === store.user.id
})
const canRevertToDraft = computed(() => {
  if (!event.value || isDemo.value) return false
  if (!store.user) return false
  if (event.value.status !== 'published') return false
  return store.isAdmin && event.value.created_by === store.user.id
})
const eventSummary = computed(() => getEventSummaryText(event.value?.description ?? null))
const registrationQuestions = computed(() => detailContent.value.registrationForm.questions)
const teamCreateDisabled = computed(
  () => isDemo.value || event.value?.status !== 'published' || !isRegistered.value,
)
const teamCreateNeedsRegistration = computed(
  () => !isRegistered.value && !isDemo.value && event.value?.status === 'published',
)
const teamCreateLabel = computed(() => (teamCreateNeedsRegistration.value ? '请先报名' : '创建队伍'))
type TeamLobbyTab = 'teams' | 'seekers' | 'myteams'
const teamLobbyTab = ref<TeamLobbyTab>('teams')
const teamLobbyTeams = computed(() => store.getTeamsForEvent(eventId.value))
const teamSeekers = computed(() => store.getTeamSeekersForEvent(eventId.value))
const myTeamSeeker = computed(() => store.getMyTeamSeeker(eventId.value))
const myTeamsCount = computed(() => {
  if (!store.user) return 0
  const teams = store.getMyTeamsForEvent(eventId.value)
  return teams.length
})

type ShowcaseTab = 'all' | 'mine'
const showcaseTab = ref<ShowcaseTab>('all')
const submissions = computed(() => store.getSubmissionsForEvent(eventId.value))
const allSubmissions = computed(() => submissions.value)
const mySubmissions = computed(() => {
  if (!store.user) return []
  return submissions.value.filter(submission => 
    submission.submitted_by === store.user?.id
  )
})

const canSubmit = computed(() => {
  if (!event.value || !store.user) return false
  if (event.value.status !== 'published') return false
  if (!isRegistered.value) return false
  if (!isSubmissionStarted.value) return false
  return true
})

const loadSubmissionsData = async () => {
  if (!eventId.value) return
  await store.loadSubmissions(eventId.value)
}

const handleSubmissionClick = (submission: any) => {
  // Handle single click - currently no action, reserved for future functionality
  console.log('Clicked submission:', submission)
}

const handleSubmissionDoubleClick = async (submission: any) => {
  // Navigate to submission detail view on double-click
  if (eventId.value && submission.id) {
    await router.push({
      name: 'submission-detail',
      params: {
        eventId: eventId.value,
        submissionId: submission.id
      }
    })
  }
}

const handleSubmissionTitleClick = async (submission: any) => {
  // Navigate to submission detail view on title click
  if (eventId.value && submission.id) {
    await router.push({
      name: 'submission-detail',
      params: {
        eventId: eventId.value,
        submissionId: submission.id
      }
    })
  }
}
const displayedSubmissions = computed(() => {
  return showcaseTab.value === 'all' ? allSubmissions.value : mySubmissions.value
})
const sampleTeamLobby = computed(() =>
  detailContent.value.teamLobby.map((team, index) => ({
    id: `sample-${eventId.value}-${index}`,
    event_id: eventId.value,
    leader_id: '',
    name: team.name,
    leader_qq: '',
    intro: team.vibe,
    needs: team.needs,
    extra: '',
    members: team.members,
    created_at: '',
  })),
)
const teamLobbyList = computed(() =>
  isDemo.value
    ? sampleTeamLobby.value
    : teamLobbyTeams.value.filter((team) => !team.is_closed),
)
const leaderTeams = computed(() => {
  if (!store.user) return []
  return teamLobbyTeams.value.filter((team) => team.leader_id === store.user?.id)
})
const canInviteSeekers = computed(() => leaderTeams.value.length > 0)
const seekerActionDisabled = computed(
  () => isDemo.value || event.value?.status !== 'published' || !isRegistered.value,
)
const seekerActionLabel = computed(() => {
  if (!isRegistered.value) return '请先报名'
  return myTeamSeeker.value ? '修改信息' : '寻求组队'
})
const seekerModalOpen = ref(false)
const seekerIntro = ref('')
const seekerQq = ref('')
const seekerRoles = ref<string[]>([])
const seekerBusy = ref(false)
const seekerError = ref('')
const seekerInviteError = ref('')
const inviteModalOpen = ref(false)
const inviteTargetSeekerId = ref<string | null>(null)
const inviteSelectedTeamId = ref('')
const inviteMessage = ref('')
const inviteBusy = ref(false)
const inviteError = ref('')
const seekerRoleOptions = [
  { key: 'planner', label: '策划' },
  { key: 'programmer', label: '程序' },
  { key: 'artist', label: '美术' },
  { key: 'audio', label: '音乐音效' },
]
const roleKeyToLabel = (key: string) => {
  const match = seekerRoleOptions.find((option) => option.key === key)
  return match?.label ?? ''
}
const profileRoleLabels = computed(() => {
  const roles = store.profile?.roles
  if (!roles || !roles.length) return []
  const labels = roles.map(roleKeyToLabel).filter(Boolean)
  return sortRoleLabels(labels)
})
const tagCharLimit = 6
const tagDisplayLimit = 4
const formatTagLabel = (value: string) => {
  if (value.length <= tagCharLimit) return value
  return `${value.slice(0, tagCharLimit)}...`
}
const teamTagsPreview = (tags: string[]) => {
  const sorted = sortRoleLabels(Array.isArray(tags) ? tags : [])
  return sorted.slice(0, tagDisplayLimit).map((tag) => ({
    raw: tag,
    label: formatTagLabel(tag),
    className: getRoleTagClass(tag),
  }))
}
const teamTagsOverflow = (tags: string[]) => {
  const length = Array.isArray(tags) ? tags.length : 0
  return Math.max(0, length - tagDisplayLimit)
}
const sortedRoleLabels = (roles: string[] | null | undefined) => sortRoleLabels(roles ?? [])
const seekerDisplayName = (seeker: { profile: { username: string | null } | null; user_id: string }) => {
  return seeker.profile?.username || `玩家${seeker.user_id.slice(0, 4)}`
}

const isMySeeker = (seeker: { user_id: string }) => {
  if (!store.user) return false
  return seeker.user_id === store.user.id
}
const teamSearch = ref('')
const teamRoleFilters = ref<string[]>([])
const teamRoleOptions = [
  { key: 'planner', label: '缺策划' },
  { key: 'programmer', label: '缺程序' },
  { key: 'artist', label: '缺美术' },
  { key: 'audio', label: '缺音乐音效' },
]

// 找队友搜索筛选
const seekerSearch = ref('')
const seekerRoleFilters = ref<string[]>([])
const seekerRoleFilterOptions = [
  { key: 'planner', label: '策划' },
  { key: 'programmer', label: '程序' },
  { key: 'artist', label: '美术' },
  { key: 'audio', label: '音乐音效' },
]

const toggleTeamRoleFilter = (key: string) => {
  if (teamRoleFilters.value.includes(key)) {
    teamRoleFilters.value = teamRoleFilters.value.filter((item) => item !== key)
    return
  }
  teamRoleFilters.value = [...teamRoleFilters.value, key]
}

const clearTeamFilters = () => {
  teamRoleFilters.value = []
}

const toggleSeekerRoleFilter = (key: string) => {
  if (seekerRoleFilters.value.includes(key)) {
    seekerRoleFilters.value = seekerRoleFilters.value.filter((item) => item !== key)
    return
  }
  seekerRoleFilters.value = [...seekerRoleFilters.value, key]
}

const clearSeekerFilters = () => {
  seekerRoleFilters.value = []
}

const filteredTeamLobbyList = computed(() => {
  const keyword = teamSearch.value.trim().toLowerCase()
  const activeRoles = new Set(teamRoleFilters.value)

  return teamLobbyList.value.filter((team) => {
    const tags = Array.isArray(team.needs) ? team.needs : []
    const matchesRole =
      activeRoles.size === 0 || tags.some((tag) => activeRoles.has(getRoleTagKey(tag)))

    if (!keyword) return matchesRole
    
    const name = team.name?.toLowerCase() ?? ''
    const intro = (team.intro || '').toLowerCase()
    const leaderQq = (team.leader_qq || '').toLowerCase()
    
    return matchesRole && (
      name.includes(keyword) || 
      intro.includes(keyword) || 
      leaderQq.includes(keyword)
    )
  })
})

const filteredTeamSeekers = computed(() => {
  const keyword = seekerSearch.value.trim().toLowerCase()
  const activeRoles = new Set(seekerRoleFilters.value)

  return teamSeekers.value.filter((seeker) => {
    const roles = Array.isArray(seeker.roles) ? seeker.roles : []
    const matchesRole =
      activeRoles.size === 0 || roles.some((role) => activeRoles.has(getRoleTagKey(role)))

    if (!keyword) return matchesRole
    
    const displayName = seekerDisplayName(seeker).toLowerCase()
    const intro = (seeker.intro || '').toLowerCase()
    const qq = (seeker.qq || '').toLowerCase()
    
    return matchesRole && (
      displayName.includes(keyword) || 
      intro.includes(keyword) || 
      qq.includes(keyword)
    )
  })
})

const isMyTeam = (team: { leader_id?: string }) => {
  if (!store.user) return false
  return Boolean(team.leader_id && team.leader_id === store.user.id)
}

const handleDeleteTeam = async (teamId: string) => {
  if (!eventId.value) return
  const confirmed = window.confirm('确定要删除该队伍吗？删除后将从组队大厅移除')
  if (!confirmed) return
  const { error: deleteError } = await store.deleteTeam(eventId.value, teamId)
  if (deleteError) {
    store.setBanner('error', deleteError)
  } else {
    store.setBanner('info', '队伍已删除')
  }
}

const joinLabel = (teamId: string) => {
  if (isDemo.value) return '仅展示'
  if (!store.user) return '登录后申请'
  if (store.isTeamMember(teamId)) return '已在队伍'
  if (!isRegistered.value) return '报名后可申请'
  const status = store.getTeamRequestStatus(teamId)
  if (status === 'pending') return '已申请'
  return '申请加入'
}

const joinDisabled = (teamId: string) => {
  if (isDemo.value) return true
  if (store.isTeamMember(teamId)) return true
  if (store.user && !isRegistered.value) return true
  const status = store.getTeamRequestStatus(teamId)
  return status === 'pending' || status === 'approved'
}

const handleJoinTeam = async (teamId: string) => {
  if (!store.user) {
    store.openAuth('sign_in')
    store.authInfo = '请先登录后申请加入'
    return
  }
  if (!isRegistered.value) {
    store.setBanner('info', '请先报名该活动后再申请加入队伍')
    return
  }
  joinTargetTeamId.value = teamId
  joinMessage.value = ''
  joinError.value = ''
  joinModalOpen.value = true
}

const sanitizeDigits = (value: string) => value.replace(/\D/g, '')

const toggleSeekerRole = (label: string, event: Event) => {
  const target = event.target as HTMLInputElement | null
  const checked = Boolean(target?.checked)
  if (checked) {
    if (!seekerRoles.value.includes(label)) {
      seekerRoles.value = [...seekerRoles.value, label]
    }
  } else {
    seekerRoles.value = seekerRoles.value.filter((item) => item !== label)
  }
}

const openSeekerModal = async () => {
  if (!event.value) return
  if (isDemo.value) {
    store.setBanner('info', '展示活动暂不支持求组队')
    return
  }
  if (event.value.status !== 'published') {
    store.setBanner('info', '仅进行中活动支持求组队')
    return
  }
  if (!store.user) {
    store.openAuth('sign_in')
    store.authInfo = '请先登录后发布求组队'
    return
  }
  if (!isRegistered.value) {
    store.setBanner('info', '请先报名该活动后再发布求组队')
    return
  }
  if (!store.contacts) {
    await store.loadMyContacts()
  }
  seekerIntro.value = myTeamSeeker.value?.intro ?? ''
  seekerQq.value = myTeamSeeker.value?.qq || store.contacts?.qq || ''
  seekerRoles.value =
    (myTeamSeeker.value?.roles && myTeamSeeker.value.roles.length
      ? [...myTeamSeeker.value.roles]
      : profileRoleLabels.value.length
        ? [...profileRoleLabels.value]
        : [])
  seekerError.value = ''
  seekerModalOpen.value = true
}

const closeSeekerModal = () => {
  if (seekerBusy.value) return
  seekerModalOpen.value = false
  seekerError.value = ''
}

const handleSeekerQqInput = (event: Event) => {
  const target = event.target as HTMLInputElement | null
  const raw = target?.value ?? ''
  const next = sanitizeDigits(raw)
  if (target && raw !== next) target.value = next
  seekerQq.value = next
}

const saveSeeker = async () => {
  if (!event.value) return
  if (!store.user) return
  seekerBusy.value = true
  seekerError.value = ''
  const payload = {
    intro: seekerIntro.value.trim(),
    qq: sanitizeDigits(seekerQq.value),
    roles: seekerRoles.value.map((role) => role.trim()).filter(Boolean),
  }
  const { error: saveError } = await store.saveTeamSeeker(event.value.id, payload)
  if (saveError) {
    seekerError.value = saveError
    seekerBusy.value = false
    return
  }
  store.setBanner('info', myTeamSeeker.value ? '求组队卡片已更新' : '进行中求组队卡片')
  seekerModalOpen.value = false
  seekerBusy.value = false
}

const deleteSeeker = async (seekerId: string) => {
  if (!event.value) return
  const confirmed = window.confirm('确定要删除求组队卡片吗？删除后将从列表移除')
  if (!confirmed) return
  const { error: deleteError } = await store.deleteTeamSeeker(event.value.id, seekerId)
  if (deleteError) {
    store.setBanner('error', deleteError)
    return
  }
  store.setBanner('info', '求组队卡片已删除')
}

const handleInviteSeeker = (seekerId: string) => {
  seekerInviteError.value = ''
  inviteError.value = ''
  if (!canInviteSeekers.value) return
  inviteTargetSeekerId.value = seekerId
  inviteSelectedTeamId.value = leaderTeams.value[0]?.id ?? ''
  inviteMessage.value = ''
  inviteModalOpen.value = true
}

const closeInviteModal = () => {
  if (inviteBusy.value) return
  inviteModalOpen.value = false
  inviteTargetSeekerId.value = null
  inviteSelectedTeamId.value = ''
  inviteMessage.value = ''
  inviteError.value = ''
}

const inviteTarget = computed(() => {
  const id = inviteTargetSeekerId.value
  if (!id) return null
  return teamSeekers.value.find((seeker) => seeker.id === id) ?? null
})

const inviteTeamOptions = computed(() => {
  return leaderTeams.value.map((team) => ({
    id: team.id,
    name: team.name,
    members: team.members,
  }))
})

const submitInvite = async () => {
  if (!inviteTarget.value) return
  if (!inviteSelectedTeamId.value) {
    inviteError.value = '请选择一个队伍'
    return
  }
  if (!store.user) {
    store.openAuth('sign_in')
    store.authInfo = '请先登录后邀请'
    return
  }

  inviteBusy.value = true
  inviteError.value = ''
  const { error } = await store.sendTeamInvite(
    inviteSelectedTeamId.value,
    inviteTarget.value.user_id,
    inviteMessage.value.trim() ? inviteMessage.value.trim() : undefined,
  )
  if (error) {
    inviteError.value = error
    inviteBusy.value = false
    return
  }
  const teamName = inviteTeamOptions.value.find((t) => t.id === inviteSelectedTeamId.value)?.name ?? '队伍'
  store.setBanner('info', `已邀请 ${seekerDisplayName(inviteTarget.value)} 加入：${teamName}`)
  inviteBusy.value = false
  closeInviteModal()
}

const closeJoinModal = () => {
  if (joinSubmitBusy.value) return
  joinModalOpen.value = false
  joinTargetTeamId.value = null
  joinMessage.value = ''
  joinError.value = ''
}

const submitJoinRequest = async () => {
  if (!joinTargetTeamId.value) return
  joinSubmitBusy.value = true
  joinError.value = ''
  const message = joinMessage.value.trim()
  const { error: requestError } = await store.requestJoinTeam(
    joinTargetTeamId.value,
    message ? message : undefined,
  )
  if (requestError) {
    joinError.value = requestError
    joinSubmitBusy.value = false
    return
  }
  store.setBanner('info', '已提交入队申请')
  joinModalOpen.value = false
  joinTargetTeamId.value = null
  joinMessage.value = ''
  joinSubmitBusy.value = false
}
const isDependencyMet = (
  dependency: QuestionDependency,
  answers: Record<string, string | string[]>,
) => {
  const answer = answers[dependency.questionId]
  if (Array.isArray(answer)) {
    return answer.includes(dependency.optionId)
  }
  return answer === dependency.optionId
}
const isQuestionVisible = (
  question: RegistrationQuestion,
  answers: Record<string, string | string[]>,
) => {
  if (!question.dependsOn) return true
  return isDependencyMet(question.dependsOn, answers)
}
const isTextLikeQuestion = (question: RegistrationQuestion) =>
  question.type === 'text' || question.type === 'textarea' || question.type === 'autocomplete'
const visibleRegistrationQuestions = computed(() =>
  registrationQuestions.value.filter((question) => isQuestionVisible(question, registrationAnswers.value)),
)
const visibleFormQuestions = computed(() =>
  registrationQuestions.value.filter((question) => isQuestionVisible(question, formAnswers.value)),
)
const hasRegistrationForm = computed(() => registrationQuestions.value.length > 0)
const isRegistered = computed(() =>
  event.value ? Boolean(store.myRegistrationByEventId[event.value.id]) : false,
)
const isSubmissionStarted = computed(() => {
  if (!event.value || isDemo.value) return false
  if (!event.value.submission_start_time) return false
  const now = new Date()
  const submissionStart = new Date(event.value.submission_start_time)
  return now >= submissionStart
})

const detailContent = ref(createDefaultEventDetails())

const detailTimeRange = computed(() =>
  formatTimeRange(event.value?.start_time ?? null, event.value?.end_time ?? null),
)
const loadDetails = () => {
  detailContent.value = getEventDetailsFromDescription(event.value?.description ?? null)
}

const resetRegistrationForm = () => {
  registrationAnswers.value = {}
  registrationOtherText.value = {}
  registrationErrors.value = {}
  registrationError.value = ''
}

const syncFormSnapshot = () => {
  formSnapshot.value = JSON.stringify({
    answers: formAnswers.value,
    other: formOtherText.value,
  })
}

const restoreFormSnapshot = () => {
  if (!formSnapshot.value) return
  try {
    const parsed = JSON.parse(formSnapshot.value) as {
      answers?: Record<string, string | string[]>
      other?: Record<string, string>
    }
    formAnswers.value = parsed.answers ?? {}
    formOtherText.value = parsed.other ?? {}
  } catch {
    formAnswers.value = {}
    formOtherText.value = {}
  }
}

const openRegistrationForm = () => {
  resetRegistrationForm()

  // Auto-fill form based on linked profile fields
  if (store.user) {
    visibleRegistrationQuestions.value.forEach((q) => {
      if (!q.linkedProfileField) return

      if (isTextLikeQuestion(q)) {
        if (q.linkedProfileField === 'username' && store.profile?.username) {
          registrationAnswers.value[q.id] = store.profile.username
        } else if (q.linkedProfileField === 'phone' && store.contacts?.phone) {
          registrationAnswers.value[q.id] = store.contacts.phone
        } else if (q.linkedProfileField === 'qq' && store.contacts?.qq) {
          registrationAnswers.value[q.id] = store.contacts.qq
        }
      } else if (q.linkedProfileField === 'roles' && store.profile?.roles?.length) {
        const ROLE_MAP: Record<string, string> = {
          programmer: '程序',
          planner: '策划',
          artist: '美术',
          audio: '音乐音效',
        }
        const userLabels = store.profile.roles.map((r) => ROLE_MAP[r]).filter(Boolean)

        if (q.type === 'multi') {
          const matches =
            q.options?.filter((o) => userLabels.includes(o.label)).map((o) => o.id) || []
          if (matches.length) {
            registrationAnswers.value[q.id] = matches
          }
        } else {
          // single or select
          const firstLabel = userLabels[0]
          const match = q.options?.find((o) => o.label === firstLabel)
          if (match) {
            registrationAnswers.value[q.id] = match.id
          }
        }
      }
    })
  }

  registrationModalOpen.value = true
}

const closeRegistrationForm = () => {
  registrationModalOpen.value = false
}

const openTeamCreate = async () => {
  if (!event.value) return
  if (isDemo.value) {
    store.setBanner('info', '展示活动不支持创建队伍')
    return
  }
  if (event.value.status !== 'published') {
    store.setBanner('info', '仅进行中活动支持创建队伍')
    return
  }
  if (!isRegistered.value) {
    store.setBanner('info', '请先报名该活动后再创建队伍')
    return
  }
  if (!store.user) {
    store.openAuth('sign_in')
    store.authInfo = '请先登录后创建队伍'
    return
  }
  await router.push(`/events/${eventId.value}/team/create`)
}

const openTeamDetail = async (teamId: string) => {
  if (!eventId.value) return
  await router.push(`/events/${eventId.value}/team/${teamId}`)
}

const updateMultiAnswer = (questionId: string, optionId: string, checked: boolean) => {
  const current = registrationAnswers.value[questionId]
  const next = Array.isArray(current) ? [...current] : []
  if (checked) {
    if (!next.includes(optionId)) next.push(optionId)
  } else {
    const idx = next.indexOf(optionId)
    if (idx >= 0) next.splice(idx, 1)
  }
  registrationAnswers.value = { ...registrationAnswers.value, [questionId]: next }
}

const getSelectValue = (questionId: string) => {
  const current = registrationAnswers.value[questionId]
  return typeof current === 'string' ? current : ''
}

const getSelectLabel = (question: RegistrationQuestion, value: string) => {
  if (!value) return ''
  if (value === '__other__') return '其他'
  const match = question.options?.find((option) => option.id === value)
  return match?.label ?? ''
}

const setRegistrationSelectValue = (questionId: string, value: string) => {
  registrationAnswers.value = { ...registrationAnswers.value, [questionId]: value }
  if (value !== '__other__') {
    const next = { ...registrationOtherText.value }
    delete next[questionId]
    registrationOtherText.value = next
  }
  setAutocompleteOpen('reg', questionId, false)
}

const handleMultiChange = (questionId: string, optionId: string, event: Event) => {
  const target = event.target as HTMLInputElement | null
  updateMultiAnswer(questionId, optionId, Boolean(target?.checked))
}

const validateRegistrationAnswers = (
  answers: Record<string, string | string[]>,
  otherText: Record<string, string>,
  questions: RegistrationQuestion[],
) => {
  const nextErrors: Record<string, string> = {}
  for (const question of questions) {
    if (!question.required) continue
    const answer = answers[question.id]
    if (isTextLikeQuestion(question)) {
      if (!answer || (typeof answer === 'string' && !answer.trim())) {
        nextErrors[question.id] = '必填项'
      }
    } else if (question.type === 'single') {
      if (!answer) {
        nextErrors[question.id] = '必填项'
      }
    } else if (question.type === 'select') {
      if (!answer) {
        nextErrors[question.id] = '必填项'
      } else if (question.allowOther && answer === '__other__') {
        const otherValue = otherText[question.id]?.trim()
        if (!otherValue) {
          nextErrors[question.id] = '请填写其他选项'
        }
      }
    } else if (question.type === 'multi') {
      if (!Array.isArray(answer) || answer.length === 0) {
        nextErrors[question.id] = '必填项'
      }
    }
  }
  return nextErrors
}

const validateRegistration = () => {
  const nextErrors = validateRegistrationAnswers(
    registrationAnswers.value,
    registrationOtherText.value,
    visibleRegistrationQuestions.value,
  )
  registrationErrors.value = nextErrors
  return Object.keys(nextErrors).length === 0
}

const validateFormAnswers = () => {
  const nextErrors = validateRegistrationAnswers(formAnswers.value, formOtherText.value, visibleFormQuestions.value)
  formErrors.value = nextErrors
  return Object.keys(nextErrors).length === 0
}

const buildFormResponse = (
  answers: Record<string, string | string[]>,
  otherText: Record<string, string>,
  questions: RegistrationQuestion[],
) => {
  const visibleIds = new Set(questions.map((question) => question.id))
  const filteredAnswers = Object.fromEntries(
    Object.entries(answers).filter(([questionId]) => visibleIds.has(questionId)),
  )
  for (const question of questions) {
    if (question.type !== 'select' || !question.allowOther) continue
    if (filteredAnswers[question.id] === '__other__') {
      const otherValue = otherText[question.id]?.trim()
      if (otherValue) {
        filteredAnswers[question.id] = otherValue
      }
    }
  }
  return filteredAnswers
}

const applyFormResponse = (response: Record<string, string | string[]>) => {
  const nextAnswers: Record<string, string | string[]> = {}
  const nextOther: Record<string, string> = {}
  for (const question of registrationQuestions.value) {
    const value = response[question.id]
    if (value === undefined || value === null) continue
    if (isTextLikeQuestion(question) && typeof value === 'string') {
      nextAnswers[question.id] = value
      continue
    }
    if (question.type === 'multi' && Array.isArray(value)) {
      nextAnswers[question.id] = value
      continue
    }
    if ((question.type === 'single' || question.type === 'select') && typeof value === 'string') {
      const optionIds = new Set((question.options ?? []).map((option) => option.id))
      if (optionIds.has(value)) {
        nextAnswers[question.id] = value
      } else if (question.type === 'select' && question.allowOther) {
        nextAnswers[question.id] = '__other__'
        nextOther[question.id] = value
      }
    }
  }
  formAnswers.value = nextAnswers
  formOtherText.value = nextOther
  syncFormSnapshot()
}

const submitRegistrationForm = async () => {
  if (!event.value) return
  if (!validateRegistration()) return
  const filteredAnswers = buildFormResponse(
    registrationAnswers.value,
    registrationOtherText.value,
    visibleRegistrationQuestions.value,
  )
  registrationSubmitBusy.value = true
  registrationError.value = ''
  const { error } = await store.submitRegistration(event.value, filteredAnswers)
  if (error && error !== 'demo' && error !== 'draft' && error !== 'auth') {
    registrationError.value = error
  } else if (!error) {
    registrationModalOpen.value = false
  applyFormResponse(filteredAnswers)
  await loadRegistrationCount(event.value.id)
  await goTab('form')
}
  registrationSubmitBusy.value = false
}

const handleRevertToDraft = async () => {
  if (!event.value || !canRevertToDraft.value) return
  const confirmed = window.confirm('确定要将该活动退回草稿吗？退回后将从公开列表隐藏')
  if (!confirmed) return
  revertBusy.value = true
  store.clearBanners()
  const { error } = await store.updateEventStatus(event.value.id, 'draft')
  if (error) {
    store.setBanner('error', error)
  } else {
    event.value = { ...event.value, status: 'draft' }
    store.setBanner('info', '已退回草稿（仅你可见，可在“我发起的活动”中继续编辑）')
  }
  revertBusy.value = false
}

const handleRegistrationClick = async () => {
  if (!event.value) return
  if (isRegistered.value) {
    await store.toggleRegistration(event.value)
    await loadRegistrationCount(event.value.id)
    return
  }
  if (!store.user) {
    store.openAuth('sign_in')
    store.authInfo = '请先登录后报名'
    return
  }
  if (hasRegistrationForm.value) {
    openRegistrationForm()
    return
  }
  await store.submitRegistration(event.value, {})
}

const updateFormMultiAnswer = (questionId: string, optionId: string, checked: boolean) => {
  const current = formAnswers.value[questionId]
  const next = Array.isArray(current) ? [...current] : []
  if (checked) {
    if (!next.includes(optionId)) next.push(optionId)
  } else {
    const idx = next.indexOf(optionId)
    if (idx >= 0) next.splice(idx, 1)
  }
  formAnswers.value = { ...formAnswers.value, [questionId]: next }
}

const getFormSelectValue = (questionId: string) => {
  const current = formAnswers.value[questionId]
  return typeof current === 'string' ? current : ''
}

const setFormSelectValue = (questionId: string, value: string) => {
  formAnswers.value = { ...formAnswers.value, [questionId]: value }
  if (value !== '__other__') {
    const next = { ...formOtherText.value }
    delete next[questionId]
    formOtherText.value = next
  }
  setAutocompleteOpen('form', questionId, false)
}

const handleFormMultiChange = (questionId: string, optionId: string, event: Event) => {
  const target = event.target as HTMLInputElement | null
  updateFormMultiAnswer(questionId, optionId, Boolean(target?.checked))
}

const startFormEdit = () => {
  if (!isRegistered.value) return
  formSaveError.value = ''
  formErrors.value = {}
  formEditMode.value = true
}

const cancelFormEdit = () => {
  restoreFormSnapshot()
  formSaveError.value = ''
  formErrors.value = {}
  formEditMode.value = false
}

const saveFormEdit = async () => {
  if (!event.value) return
  if (!store.user) {
    store.openAuth('sign_in')
    store.authInfo = '请先登录后修改报名表单'
    return
  }
  if (!validateFormAnswers()) return
  const registrationId = store.myRegistrationByEventId[event.value.id]
  if (!registrationId) return
  formSaveBusy.value = true
  formSaveError.value = ''
  const response = buildFormResponse(formAnswers.value, formOtherText.value, visibleFormQuestions.value)
  const { error } = await supabase
    .from('registrations')
    .update({ form_response: response })
    .eq('id', registrationId)
    .select('id')
    .single()

  if (error) {
    formSaveError.value = error.message
  } else {
    store.setBanner('info', '报名表单已更新')
    applyFormResponse(response)
    formEditMode.value = false
  }
  formSaveBusy.value = false
}

const loadRegistrationFormResponse = async () => {
  if (!event.value || !store.user || !isRegistered.value) return
  if (isDemo.value) return
  const registrationId = store.myRegistrationByEventId[event.value.id]
  if (!registrationId) return
  formLoading.value = true
  formSaveError.value = ''
  const { data, error } = await supabase
    .from('registrations')
    .select('form_response')
    .eq('id', registrationId)
    .maybeSingle()

  if (error) {
    formSaveError.value = error.message
  } else {
    const response = (data?.form_response ?? {}) as Record<string, string | string[]>
    applyFormResponse(response)
  }
  formLoading.value = false
}

const loadRegistrationCount = async (id: string) => {
  registrationCount.value = null
  if (!id || isDemo.value) return
  const { count, error } = await supabase
    .from('registrations')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', id)
  if (!error && typeof count === 'number') {
    registrationCount.value = count
  }
}

const loadEvent = async (id: string) => {
  if (!id) return
  loading.value = true
  error.value = ''

  await store.ensureEventsLoaded()
  const cached = store.getEventById(id)
  if (cached) {
    event.value = cached
    loadDetails()
    await store.loadTeams(id)
    await store.loadTeamSeekers(id)
    await loadRegistrationFormResponse()
    await loadRegistrationCount(id)
    loading.value = false
    return
  }

  const { data, error: fetchError } = await store.fetchEventById(id)
  if (fetchError) {
    error.value = fetchError
    event.value = null
  } else {
    event.value = data
  }
  loadDetails()
  await store.loadTeams(id)
  await store.loadTeamSeekers(id)
  await loadRegistrationFormResponse()
  await loadRegistrationCount(id)
  loading.value = false
}

onMounted(async () => {
  await store.refreshUser()
  await store.ensureEventsLoaded()
  await store.ensureRegistrationsLoaded()
  await loadEvent(eventId.value)
  if (eventId.value) {
    await loadSubmissionsData()
  }
})

watch(eventId, async (id) => {
  await loadEvent(id)
  if (id) {
    await loadSubmissionsData()
  }
})

watch(
  () => store.user?.id,
  async () => {
    if (!eventId.value || isDemo.value) return
    await store.loadTeams(eventId.value)
    await store.loadTeamSeekers(eventId.value)
  },
)

watch(isRegistered, async (value) => {
  if (value) {
    await loadRegistrationFormResponse()
  } else {
    formEditMode.value = false
    formAnswers.value = {}
    formOtherText.value = {}
    formSnapshot.value = ''
    formErrors.value = {}
    formSaveError.value = ''
  }
})
</script>

<template>
  <main class="detail-page">
    <section v-if="loading" class="detail-loading">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </section>

    <section v-else-if="error" class="empty-state">
      <h2>活动未找到</h2>
      <p class="muted">{{ error }}</p>
      <RouterLink class="btn btn--ghost" to="/events">返回活动页</RouterLink>
    </section>

    <section v-else-if="event" class="detail-hero">
      <div class="detail-hero__main">
        <div class="detail-hero__head-row">
          <p class="detail-eyebrow">Game Jam / 活动详情</p>
          <div v-if="canRevertToDraft || canEditDraft" class="detail-hero__head-actions">
            <RouterLink
              v-if="canEditDraft || canRevertToDraft"
              class="btn btn--success-solid btn--lg btn--icon-text"
              :to="`/events/${eventId}/edit`"
            >
              <Edit :size="18" />
              <span>编辑页面</span>
            </RouterLink>
            <button
              v-if="canRevertToDraft"
              class="btn btn--danger-solid btn--lg btn--icon-text"
              type="button"
              :disabled="revertBusy"
              @click="handleRevertToDraft"
            >
              <Undo2 :size="18" />
              <span>{{ revertBusy ? '处理中...' : '退回草稿' }}</span>
            </button>
          </div>
        </div>
        <h1>{{ event.title }}</h1>
        <p class="detail-lead">{{ eventSummary }}</p>
        <div class="detail-tags">
          <span v-if="event.status" class="pill-badge" :class="statusClass(event.status)">
            {{ statusLabel(event.status) }}
          </span>
          <span v-if="isDemo" class="pill-badge pill-badge--draft">前端展示</span>
        </div>
          <div class="detail-hero__bottom">
            <div class="detail-card detail-hero__meta">
              <h4>活动信息</h4>
              <div class="detail-meta">
                <div>
                  <span class="meta-label"><Clock :size="16" /> 时间</span>
                  <p>{{ detailTimeRange }}</p>
                </div>
                <div>
                  <span class="meta-label"><MapPin :size="16" /> 地点</span>
                  <p>{{ locationLabel(event.location) }}</p>
                </div>
                <div>
                  <span class="meta-label"><Users :size="16" /> 队伍最大人数</span>
                  <p>{{ teamSizeLabel(event.team_max_size) }}</p>
                </div>
                <div>
                  <span class="meta-label"><UserPlus :size="16" /> 已报名人数</span>
                  <p>{{ registrationCount !== null ? `${registrationCount} 人` : '—' }}</p>
                </div>
              </div>
            </div>

          <div class="detail-hero__cta">
            <button
              class="btn btn--xl"
              :class="store.registrationVariant(event)"
              type="button"
              :disabled="
                isDemo ||
                event.status === 'draft' ||
                store.registrationBusyEventId === event.id ||
                store.registrationsLoading ||
                registrationSubmitBusy
              "
              @click="handleRegistrationClick"
            >
              {{
                store.registrationBusyEventId === event.id
                  ? '处理中...'
                  : store.registrationsLoading
                    ? '加载中...'
                    : store.registrationLabel(event)
              }}
            </button>
            <p v-if="isDemo" class="muted small-note">展示活动不支持报名</p>
          </div>
        </div>
      </div>
    </section>

    <section v-if="event" class="detail-tabs">
      <div class="detail-tabs__shell">
        <div class="detail-tabs__bar" role="tablist" aria-label="活动内容">
          <button
            class="detail-tabs__btn"
            type="button"
            role="tab"
            :aria-selected="detailTab === 'intro'"
            :class="{ active: detailTab === 'intro' }"
            @click="goTab('intro')"
          >
            <Info :size="16" />
            活动介绍
          </button>
          <button
            class="detail-tabs__btn"
            type="button"
            role="tab"
            :aria-selected="detailTab === 'registration'"
            :class="{ active: detailTab === 'registration' }"
            @click="goTab('registration')"
          >
            <ListOrdered :size="16" />
            活动流程
          </button>
          <button
            v-if="hasRegistrationForm && isRegistered"
            class="detail-tabs__btn"
            type="button"
            role="tab"
            :aria-selected="detailTab === 'form'"
            :class="{ active: detailTab === 'form' }"
            @click="goTab('form')"
          >
            <FileText :size="16" />
            报名表单
          </button>
          <button
            class="detail-tabs__btn"
            type="button"
            role="tab"
            :aria-selected="detailTab === 'team'"
            :class="{ active: detailTab === 'team' }"
            @click="goTab('team')"
          >
            <Users :size="16" />
            组队大厅
          </button>
          <button
            v-if="isSubmissionStarted"
            class="detail-tabs__btn"
            type="button"
            role="tab"
            :aria-selected="detailTab === 'showcase'"
            :class="{ active: detailTab === 'showcase' }"
            @click="goTab('showcase')"
          >
            <Eye :size="16" />
            作品展示
          </button>
        </div>

        <div class="detail-tabs__content">
          <section v-if="detailTab === 'intro'" class="detail-section" role="tabpanel">
            <div class="detail-section__head">
              <h2>活动介绍</h2>
              <p class="muted">围绕 Game Jam 的创作节奏与规则，打造沉浸式体验</p>
            </div>
            <div class="detail-grid">
              <article class="detail-panel">
                <h3>活动概述</h3>
                <p v-for="block in detailContent.introductionBlocks" :key="block">{{ block }}</p>
              </article>
              <article class="detail-panel">
                <h3>关键亮点</h3>
                <ul>
                  <li v-for="item in detailContent.highlightItems" :key="item">{{ item }}</li>
                </ul>
              </article>
            </div>
          </section>

          <section v-else-if="detailTab === 'registration'" class="detail-section" role="tabpanel">
            <div class="detail-section__head">
              <h2>活动流程</h2>
              <p class="muted">从报名到展示的完整节奏，一步一步走完</p>
            </div>
            <div class="flow-grid">
              <div v-for="step in detailContent.registrationSteps" :key="step.title" class="flow-card">
                <span class="flow-card__time">{{ step.time }}</span>
                <h3>{{ step.title }}</h3>
                <p>{{ step.desc }}</p>
              </div>
            </div>
          </section>

        <section v-else-if="detailTab === 'team'" class="detail-section" role="tabpanel">
          <div class="detail-section__head">
            <div>
              <h2>组队大厅</h2>
            </div>
            <div class="detail-section__actions">
              <button
                v-if="teamLobbyTab === 'teams'"
                class="btn btn--icon-text"
                :class="{ 'btn--primary': !teamCreateNeedsRegistration }"
                type="button"
                :disabled="teamCreateDisabled"
                @click="openTeamCreate"
              >
                <Plus v-if="!teamCreateNeedsRegistration" :size="18" />
                <span>{{ teamCreateLabel }}</span>
              </button>
              <button
                v-else
                class="btn btn--icon-text"
                :class="{ 'btn--primary': !seekerActionDisabled }"
                type="button"
                :disabled="seekerActionDisabled"
                @click="openSeekerModal"
              >
                <UserPlus v-if="!seekerActionDisabled" :size="18" />
                <span>{{ seekerActionLabel }}</span>
              </button>
            </div>
          </div>
          <div class="team-lobby-tabs tab-nav">
            <button
              class="tab-nav__btn"
              type="button"
              :class="{ active: teamLobbyTab === 'teams' }"
              @click="teamLobbyTab = 'teams'"
            >
              找队伍
              <span v-if="filteredTeamLobbyList.length > 0" class="showcase-count">
                {{ filteredTeamLobbyList.length }}
              </span>
            </button>
            <button
              class="tab-nav__btn"
              type="button"
              :class="{ active: teamLobbyTab === 'seekers' }"
              @click="teamLobbyTab = 'seekers'"
            >
              找队友
              <span v-if="filteredTeamSeekers.length > 0" class="showcase-count">
                {{ filteredTeamSeekers.length }}
              </span>
            </button>
            <button
              v-if="store.user"
              class="tab-nav__btn"
              type="button"
              :class="{ active: teamLobbyTab === 'myteams' }"
              @click="teamLobbyTab = 'myteams'"
            >
              我的队伍
              <span v-if="myTeamsCount > 0" class="showcase-count">
                {{ myTeamsCount }}
              </span>
            </button>
          </div>
          <div v-if="teamLobbyTab === 'teams'">
            <div class="team-filters">
              <div class="team-filters__bar">
                <div class="team-filters__search">
                  <input v-model="teamSearch" type="text" placeholder="搜索队伍名称、简介或队长QQ" />
                  <button
                    v-if="teamSearch"
                    class="icon-btn icon-btn--small"
                    type="button"
                    aria-label="清除搜索"
                    @click="teamSearch = ''"
                  >
                    <X :size="16" />
                  </button>
                </div>
                <details class="team-filter-menu">
                  <summary class="btn btn--ghost team-filter-menu__button">
                    <Filter :size="16" />
                    <span>筛选</span>
                    <span v-if="teamRoleFilters.length" class="team-filter-menu__count">
                      {{ teamRoleFilters.length }}
                    </span>
                  </summary>
                  <div class="team-filter-menu__panel">
                    <div class="team-filter-menu__header">
                      <p class="team-filter-menu__title">需求筛选</p>
                      <button
                        class="btn btn--ghost team-filter-menu__clear"
                        type="button"
                        :disabled="teamRoleFilters.length === 0"
                        @click="clearTeamFilters"
                      >
                        清除筛选
                      </button>
                    </div>
                    <label v-for="option in teamRoleOptions" :key="option.key" class="team-filter-option">
                      <input
                        type="checkbox"
                        :checked="teamRoleFilters.includes(option.key)"
                        @change="toggleTeamRoleFilter(option.key)"
                      />
                      <span class="team-filter-option__label" :class="getRoleTagClass(option.label)">
                        {{ option.label }}
                      </span>
                    </label>
                  </div>
                </details>
              </div>
            </div>
            <div class="team-grid">
              <article
                v-for="team in filteredTeamLobbyList"
                :key="team.id"
                class="team-card"
                @dblclick="openTeamDetail(team.id)"
              >
                <div class="team-card__head">
                  <div class="team-card__title-group">
                    <RouterLink class="team-card__title" :to="`/events/${eventId}/team/${team.id}`">
                      {{ team.name }}
                    </RouterLink>
                    <p v-if="team.leader_qq" class="muted team-card__qq">队长QQ：{{ team.leader_qq }}</p>
                  </div>
                  <span class="pill-badge pill-badge--published">{{ team.members }} 人</span>
                </div>
                
                <div class="team-card__section">
                  <h5 class="team-card__label">队伍介绍</h5>
                  <p class="team-card__desc">{{ team.intro || '暂无队伍介绍' }}</p>
                  
                  <div class="team-card__tags">
                    <span
                      v-for="tag in teamTagsPreview(team.needs)"
                      :key="tag.raw"
                      class="meta-item"
                      :class="tag.className"
                    >
                      {{ tag.label }}
                    </span>
                    <span v-if="teamTagsOverflow(team.needs) > 0" class="meta-item">+{{ teamTagsOverflow(team.needs) }}</span>
                    <span v-if="!team.needs || team.needs.length === 0" class="muted text-sm">暂无需求</span>
                  </div>
                </div>

                                <div class="team-card__section team-card__actions">  

                                  <template v-if="isMyTeam(team)">

                                    <RouterLink class="btn btn--ghost btn--icon-text" :to="`/events/${eventId}/team/${team.id}/edit`"><Edit :size="14" /> 编辑</RouterLink>

                                    <button class="btn btn--danger btn--icon-text" type="button" @click="handleDeleteTeam(team.id)"><Trash2 :size="14" /> 删除</button>

                                  </template>     

                                  <button
                    v-else
                    class="btn btn--ghost btn--icon-text"
                    type="button"
                    :disabled="joinDisabled(team.id)"
                    @click="handleJoinTeam(team.id)"
                  >
                    <UserPlus :size="14" />
                    {{ joinLabel(team.id) }}
                  </button>
                </div>
              </article>
            </div>
            <div v-if="filteredTeamLobbyList.length === 0" class="team-empty">
              <p>无符合条件的队伍</p>
            </div>
          </div>
          <div v-else-if="teamLobbyTab === 'seekers'">
            <div class="team-filters">
              <div class="team-filters__bar">
                <div class="team-filters__search">
                  <input v-model="seekerSearch" type="text" placeholder="搜索队友姓名、简介或QQ" />
                  <button
                    v-if="seekerSearch"
                    class="icon-btn icon-btn--small"
                    type="button"
                    aria-label="清除搜索"
                    @click="seekerSearch = ''"
                  >
                    <X :size="16" />
                  </button>
                </div>
                <details class="team-filter-menu">
                  <summary class="btn btn--ghost team-filter-menu__button">
                    <Filter :size="16" />
                    <span>筛选</span>
                    <span v-if="seekerRoleFilters.length" class="team-filter-menu__count">
                      {{ seekerRoleFilters.length }}
                    </span>
                  </summary>
                  <div class="team-filter-menu__panel">
                    <div class="team-filter-menu__header">
                      <p class="team-filter-menu__title">职能筛选</p>
                      <button
                        class="btn btn--ghost team-filter-menu__clear"
                        type="button"
                        :disabled="seekerRoleFilters.length === 0"
                        @click="clearSeekerFilters"
                      >
                        清除筛选
                      </button>
                    </div>
                    <label v-for="option in seekerRoleFilterOptions" :key="option.key" class="team-filter-option">
                      <input
                        type="checkbox"
                        :checked="seekerRoleFilters.includes(option.key)"
                        @change="toggleSeekerRoleFilter(option.key)"
                      />
                      <span class="team-filter-option__label" :class="getRoleTagClass(option.label)">
                        {{ option.label }}
                      </span>
                    </label>
                  </div>
                </details>
              </div>
            </div>
            <div class="seeker-grid">
              <article v-for="seeker in filteredTeamSeekers" :key="seeker.id" class="seeker-card">
                <div class="seeker-card__head">
              <div class="seeker-card__title">
                <h4>{{ seekerDisplayName(seeker) }}</h4>
                <p v-if="seeker.qq" class="muted seeker-card__qq">QQ：{{ seeker.qq }}</p>
              </div>
              <span class="pill-badge pill-badge--draft">求组队</span>
            </div>
            <div v-if="seeker.roles?.length" class="seeker-card__roles">
              <span
                v-for="role in sortedRoleLabels(seeker.roles)"
                :key="role"
                class="meta-item"
                :class="getRoleTagClass(role)"
              >
                {{ role }}
              </span>
            </div>
            <p class="seeker-card__intro">{{ seeker.intro || '暂无个人简介' }}</p>
            <div class="seeker-card__actions">
                  <template v-if="isMySeeker(seeker)">
                    <button class="btn btn--ghost btn--icon-text" type="button" @click="openSeekerModal"><Edit :size="14" /> 编辑</button>
                    <button class="btn btn--danger btn--icon-text" type="button" @click="deleteSeeker(seeker.id)"><Trash2 :size="14" /> 删除</button>
                  </template>
                  <button
                    v-else-if="canInviteSeekers"
                    class="btn btn--ghost btn--icon-text"
                    type="button"
                    :disabled="inviteBusy && inviteTargetSeekerId === seeker.id"
                    @click="handleInviteSeeker(seeker.id)"
                  >
                    <Send :size="14" />
                    邀请组队
                  </button>
                </div>
              </article>
            </div>
            <div v-if="filteredTeamSeekers.length === 0" class="team-empty">
              <p>无符合条件的队友</p>
            </div>
            <p v-if="seekerInviteError" class="alert error">{{ seekerInviteError }}</p>
          </div>
          <div v-else-if="teamLobbyTab === 'myteams'">
            <MyTeamsTabContent 
              :event-id="eventId" 
              :is-demo="isDemo"
              @switch-tab="(tab) => teamLobbyTab = tab"
            />
          </div>
        </section>

        <section v-else-if="detailTab === 'showcase'" class="detail-section" role="tabpanel">
          <div class="detail-section__head">
            <div>
              <h2>作品展示</h2>
            </div>
            <div class="detail-section__actions">
              <RouterLink 
                v-if="canSubmit"
                :to="`/events/${eventId}/submit`"
                class="btn btn--primary btn--icon-text"
              >
                <Upload :size="18" />
                <span>提交作品</span>
              </RouterLink>
            </div>
          </div>
          <div class="showcase-tabs tab-nav">
            <button
              class="tab-nav__btn"
              type="button"
              :class="{ active: showcaseTab === 'all' }"
              @click="showcaseTab = 'all'"
            >
              所有作品
              <span v-if="allSubmissions.length > 0" class="showcase-count">
                {{ allSubmissions.length }}
              </span>
            </button>
            <button
              v-if="store.user"
              class="tab-nav__btn"
              type="button"
              :class="{ active: showcaseTab === 'mine' }"
              @click="showcaseTab = 'mine'"
            >
              我的作品
              <span v-if="mySubmissions.length > 0" class="showcase-count">
                {{ mySubmissions.length }}
              </span>
            </button>
          </div>
          
          <!-- 加载状态 -->
          <div v-if="store.submissionsLoading" class="showcase-loading">
            <div class="loading-spinner"></div>
            <p>加载作品中...</p>
          </div>

          <!-- 错误状态 -->
          <div v-else-if="store.submissionsError" class="showcase-error">
            <p>{{ store.submissionsError }}</p>
            <button class="btn btn--ghost" @click="loadSubmissionsData">
              重新加载
            </button>
          </div>

          <!-- 空状态 -->
          <div v-else-if="displayedSubmissions.length === 0" class="showcase-empty">
            <div class="showcase-empty__icon">📋</div>
            <h3 class="showcase-empty__title">
              {{ showcaseTab === 'all' ? '暂无作品' : '你还没有提交作品' }}
            </h3>
            <p class="showcase-empty__desc">
              {{ showcaseTab === 'all' 
                ? '还没有队伍提交作品，期待第一个作品的出现！' 
                : '快去提交你的作品，与大家分享你的创意！' 
              }}
            </p>
            <RouterLink 
              v-if="showcaseTab === 'mine' && canSubmit"
              :to="`/events/${eventId}/submit`"
              class="btn btn--primary"
            >
              提交作品
            </RouterLink>
          </div>

          <!-- 作品网格 -->
          <div v-else class="showcase-grid">
            <SubmissionCard
              v-for="submission in displayedSubmissions"
              :key="submission.id"
              :submission="submission"
              @click="handleSubmissionClick(submission)"
              @double-click="handleSubmissionDoubleClick(submission)"
              @title-click="handleSubmissionTitleClick(submission)"
            >
              <template #actions v-if="showcaseTab === 'mine'">
                <RouterLink 
                  :to="`/events/${eventId}/submissions/${submission.id}/edit`" 
                  class="btn btn--compact btn--ghost"
                  @click.stop
                >
                  <Edit :size="14" />
                  编辑
                </RouterLink>
              </template>
            </SubmissionCard>
          </div>
        </section>

          <section v-else-if="detailTab === 'form'" class="detail-section" role="tabpanel">
            <div class="detail-section__head">
              <div>
                <h2>报名表单</h2>
                <p class="muted">报名成功后可查看并修改你的填写内容</p>
              </div>
            </div>

            <div v-if="formLoading" class="detail-panel">
              <p class="muted">正在加载报名表单...</p>
            </div>
            <div v-else-if="!isRegistered" class="detail-panel">
              <p class="muted">你尚未报名该活动，报名成功后可查看与修改表单</p>
            </div>
            <form v-else class="form" @submit.prevent="saveFormEdit">
              <div v-for="(question, index) in visibleFormQuestions" :key="question.id" class="form-question">
                <div class="form-question__title">
                  <span class="form-question__index">Q{{ index + 1 }}</span>
                  <span>{{ question.title }}</span>
                  <span v-if="question.required" class="pill-badge pill-badge--draft">必填</span>
                </div>

                <div v-if="question.type === 'text'" class="form-question__field">
                  <input
                    v-model="formAnswers[question.id]"
                    type="text"
                    placeholder="填写你的答案"
                    :readonly="!formEditMode"
                  />
                  <p v-if="formEditMode && formErrors[question.id]" class="alert error">
                    {{ formErrors[question.id] }}
                  </p>
                </div>

                <div v-else-if="question.type === 'textarea'" class="form-question__field">
                  <textarea
                    v-model="formAnswers[question.id]"
                    rows="3"
                    placeholder="填写你的答案"
                    :readonly="!formEditMode"
                  ></textarea>
                  <p v-if="formEditMode && formErrors[question.id]" class="alert error">
                    {{ formErrors[question.id] }}
                  </p>
                </div>

                <div v-else-if="question.type === 'autocomplete'" class="form-question__field">
                  <div class="autocomplete">
                    <input
                      v-model="formAnswers[question.id]"
                      type="text"
                      placeholder="输入关键字搜索选项"
                      :readonly="!formEditMode"
                      @focus="openAutocomplete('form', question.id, formEditMode)"
                      @input="openAutocomplete('form', question.id, formEditMode)"
                      @keydown.escape="setAutocompleteOpen('form', question.id, false)"
                      @blur="scheduleCloseAutocomplete('form', question.id)"
                    />
                    <div
                      v-if="
                        formEditMode &&
                        isAutocompleteOpen('form', question.id) &&
                        getAutocompleteMatches(question, formAnswers[question.id]).length
                      "
                      class="autocomplete__dropdown"
                      role="listbox"
                    >
                      <button
                        v-for="option in getAutocompleteMatches(question, formAnswers[question.id])"
                        :key="option.id"
                        class="autocomplete__option"
                        type="button"
                        @mousedown.prevent="applyAutocompleteValue('form', question.id, option.label)"
                      >
                        {{ option.label }}
                      </button>
                    </div>
                  </div>
                  <p v-if="formEditMode && formErrors[question.id]" class="alert error">
                    {{ formErrors[question.id] }}
                  </p>
                </div>

                <div v-else-if="question.type === 'select'" class="form-question__field">
                  <div class="autocomplete">
                    <input
                      :value="getSelectLabel(question, getFormSelectValue(question.id))"
                      type="text"
                      placeholder="请选择"
                      readonly
                      @focus="openAutocomplete('form', question.id, formEditMode)"
                      @click="openAutocomplete('form', question.id, formEditMode)"
                      @keydown.escape="setAutocompleteOpen('form', question.id, false)"
                      @blur="scheduleCloseAutocomplete('form', question.id)"
                    />
                    <div
                      v-if="formEditMode && isAutocompleteOpen('form', question.id)"
                      class="autocomplete__dropdown"
                      role="listbox"
                    >
                      <button
                        v-for="option in question.options ?? []"
                        :key="option.id"
                        class="autocomplete__option"
                        type="button"
                        @mousedown.prevent="setFormSelectValue(question.id, option.id)"
                      >
                        {{ option.label }}
                      </button>
                      <button
                        v-if="question.allowOther"
                        class="autocomplete__option"
                        type="button"
                        @mousedown.prevent="setFormSelectValue(question.id, '__other__')"
                      >
                        其他
                      </button>
                    </div>
                  </div>
                  <input
                    v-if="question.allowOther && getFormSelectValue(question.id) === '__other__'"
                    v-model="formOtherText[question.id]"
                    class="form-question__other"
                    type="text"
                    placeholder="填写其他选项"
                    :disabled="!formEditMode"
                  />
                  <p v-if="formEditMode && formErrors[question.id]" class="alert error">
                    {{ formErrors[question.id] }}
                  </p>
                </div>

                <div v-else-if="question.type === 'single'" class="form-question__field">
                  <label
                    v-for="option in question.options ?? []"
                    :key="option.id"
                    class="form-question__option"
                  >
                    <input
                      type="radio"
                      :name="`form-${question.id}`"
                      :value="option.id"
                      :disabled="!formEditMode"
                      v-model="formAnswers[question.id]"
                    />
                    {{ option.label }}
                  </label>
                  <p v-if="formEditMode && formErrors[question.id]" class="alert error">
                    {{ formErrors[question.id] }}
                  </p>
                </div>

                <div v-else class="form-question__field">
                  <label
                    v-for="option in question.options ?? []"
                    :key="option.id"
                    class="form-question__option"
                  >
                    <input
                      type="checkbox"
                      :value="option.id"
                      :checked="
                        Array.isArray(formAnswers[question.id]) &&
                        formAnswers[question.id].includes(option.id)
                      "
                      :disabled="!formEditMode"
                      @change="handleFormMultiChange(question.id, option.id, $event)"
                    />
                    {{ option.label }}
                  </label>
                  <p v-if="formEditMode && formErrors[question.id]" class="alert error">
                    {{ formErrors[question.id] }}
                  </p>
                </div>
              </div>

              <p v-if="formSaveError" class="alert error">{{ formSaveError }}</p>

              <div class="detail-form-actions">
                <template v-if="formEditMode">
                  <button class="btn btn--ghost" type="button" @click="cancelFormEdit">取消</button>
                  <button class="btn btn--primary" type="submit" :disabled="formSaveBusy">
                    {{ formSaveBusy ? '保存中...' : '保存' }}
                  </button>
                </template>
                <button v-else class="btn btn--primary" type="button" @click="startFormEdit">修改</button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </section>
  </main>

  <teleport to="body">
    <div v-if="registrationModalOpen" class="modal-backdrop">
      <div class="modal-shell">
        <div class="modal modal--wide">
        <header class="modal__header">
          <h2>报名表单</h2>
        </header>

        <form class="form" @submit.prevent="submitRegistrationForm">
          <div v-for="(question, index) in visibleRegistrationQuestions" :key="question.id" class="form-question">
            <div class="form-question__title">
              <span class="form-question__index">Q{{ index + 1 }}</span>
              <span>{{ question.title }}</span>
              <span v-if="question.required" class="pill-badge pill-badge--draft">必填</span>
            </div>

            <div v-if="question.type === 'text'" class="form-question__field">
              <input
                v-model="registrationAnswers[question.id]"
                type="text"
                placeholder="填写你的答案"
              />
            </div>

            <div v-else-if="question.type === 'textarea'" class="form-question__field">
              <textarea
                v-model="registrationAnswers[question.id]"
                rows="3"
                placeholder="填写你的答案"
              ></textarea>
            </div>

            <div v-else-if="question.type === 'autocomplete'" class="form-question__field">
              <div class="autocomplete">
                <input
                  v-model="registrationAnswers[question.id]"
                  type="text"
                  placeholder="输入关键字搜索选项"
                  @focus="openAutocomplete('reg', question.id)"
                  @input="openAutocomplete('reg', question.id)"
                  @keydown.escape="setAutocompleteOpen('reg', question.id, false)"
                  @blur="scheduleCloseAutocomplete('reg', question.id)"
                />
                <div
                  v-if="
                    isAutocompleteOpen('reg', question.id) &&
                    getAutocompleteMatches(question, registrationAnswers[question.id]).length
                  "
                  class="autocomplete__dropdown"
                  role="listbox"
                >
                  <button
                    v-for="option in getAutocompleteMatches(question, registrationAnswers[question.id])"
                    :key="option.id"
                    class="autocomplete__option"
                    type="button"
                    @mousedown.prevent="applyAutocompleteValue('reg', question.id, option.label)"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>
            </div>

            <div v-else-if="question.type === 'select'" class="form-question__field">
              <div class="autocomplete">
                <input
                  :value="getSelectLabel(question, getSelectValue(question.id))"
                  type="text"
                  placeholder="请选择"
                  readonly
                  @focus="openAutocomplete('reg', question.id)"
                  @click="openAutocomplete('reg', question.id)"
                  @keydown.escape="setAutocompleteOpen('reg', question.id, false)"
                  @blur="scheduleCloseAutocomplete('reg', question.id)"
                />
                <div
                  v-if="isAutocompleteOpen('reg', question.id)"
                  class="autocomplete__dropdown"
                  role="listbox"
                >
                  <button
                    v-for="option in question.options ?? []"
                    :key="option.id"
                    class="autocomplete__option"
                    type="button"
                    @mousedown.prevent="setRegistrationSelectValue(question.id, option.id)"
                  >
                    {{ option.label }}
                  </button>
                  <button
                    v-if="question.allowOther"
                    class="autocomplete__option"
                    type="button"
                    @mousedown.prevent="setRegistrationSelectValue(question.id, '__other__')"
                  >
                    其他
                  </button>
                </div>
              </div>
              <input
                v-if="question.allowOther && getSelectValue(question.id) === '__other__'"
                v-model="registrationOtherText[question.id]"
                class="form-question__other"
                type="text"
                placeholder="请输入其他选项"
              />
            </div>

            <div v-else class="form-question__field">
              <label v-for="option in question.options ?? []" :key="option.id" class="form-question__option">
                <input
                  v-if="question.type === 'single'"
                  type="radio"
                  :name="question.id"
                  :value="option.id"
                  v-model="registrationAnswers[question.id]"
                />
                <input
                  v-else
                  type="checkbox"
                  :checked="Array.isArray(registrationAnswers[question.id]) && registrationAnswers[question.id].includes(option.id)"
                  @change="handleMultiChange(question.id, option.id, $event)"
                />
                <span>{{ option.label }}</span>
              </label>
            </div>

            <p v-if="registrationErrors[question.id]" class="alert error">{{ registrationErrors[question.id] }}</p>
          </div>

          <p v-if="registrationError" class="alert error">{{ registrationError }}</p>

          <button class="btn btn--primary btn--full" type="submit" :disabled="registrationSubmitBusy">
            {{ registrationSubmitBusy ? '提交中...' : '提交报名' }}
          </button>
        </form>
        </div>
        <button class="icon-btn modal-close" type="button" @click="closeRegistrationForm" aria-label="close">
          <X :size="20" />
        </button>
      </div>
    </div>

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
            <button class="btn btn--ghost" type="button" :disabled="joinSubmitBusy" @click="closeJoinModal">取消</button>
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

    <div v-if="seekerModalOpen" class="modal-backdrop">
      <div class="modal-shell">
        <div class="modal">
        <header class="modal__header">
          <h2>求组队信息</h2>
        </header>

        <form class="form" @submit.prevent="saveSeeker">
          <label class="field">
            <span>个人简介</span>
            <textarea v-model="seekerIntro" rows="4" placeholder="介绍一下你自己（可选）"></textarea>
          </label>

          <div class="field">
            <span>职能（可多选）</span>
            <div class="role-options seeker-role-options">
              <label v-for="option in seekerRoleOptions" :key="option.key" class="role-option">
                <input
                  type="checkbox"
                  :value="option.label"
                  :checked="seekerRoles.includes(option.label)"
                  @change="toggleSeekerRole(option.label, $event)"
                />
                <span class="tag-pill">{{ option.label }}</span>
              </label>
            </div>
          </div>

          <label class="field">
            <span>QQ</span>
            <input
              :value="seekerQq"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              placeholder="仅数字，可选"
              @input="handleSeekerQqInput"
            />
          </label>

          <p v-if="seekerError" class="alert error">{{ seekerError }}</p>

          <div class="modal__actions">
            <button class="btn btn--ghost" type="button" :disabled="seekerBusy" @click="closeSeekerModal">
              取消
            </button>
            <button class="btn btn--primary" type="submit" :disabled="seekerBusy">
              {{ seekerBusy ? '保存中...' : '保存' }}
            </button>
          </div>
        </form>
        </div>
        <button class="icon-btn modal-close" type="button" @click="closeSeekerModal" aria-label="close">
          <X :size="20" />
        </button>
      </div>
    </div>

    <div v-if="inviteModalOpen" class="modal-backdrop">
      <div class="modal-shell">
        <div class="modal">
          <header class="modal__header">
            <h2>邀请组队</h2>
          </header>

          <form class="form" @submit.prevent="submitInvite">
            <div class="form-question">
              <div class="form-question__title">
                <span>选择队伍</span>
              </div>
              <div class="form-question__field">
                <select v-model="inviteSelectedTeamId">
                  <option disabled value="">请选择你的队伍</option>
                  <option v-for="team in inviteTeamOptions" :key="team.id" :value="team.id">
                    {{ team.name }}（{{ team.members }}人）
                  </option>
                </select>
              </div>
            </div>

            <div class="form-question">
              <div class="form-question__title">
                <span>留言（可选）</span>
              </div>
              <div class="form-question__field">
                <textarea v-model="inviteMessage" rows="3" placeholder="简单介绍一下队伍或想邀请的原因"></textarea>
              </div>
            </div>

            <p v-if="inviteError" class="alert error">{{ inviteError }}</p>

            <div class="modal__actions">
              <button class="btn btn--ghost" type="button" :disabled="inviteBusy" @click="closeInviteModal">
                取消
              </button>
              <button class="btn btn--primary" type="submit" :disabled="inviteBusy">
                {{ inviteBusy ? '发送中...' : '发送邀请' }}
              </button>
            </div>
          </form>
        </div>
        <button class="icon-btn modal-close" type="button" @click="closeInviteModal" aria-label="close">
          <X :size="20" />
        </button>
      </div>
    </div>

  </teleport>
</template>

<style scoped>
.btn--icon-text {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.meta-label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 0.9rem;
  margin-bottom: 4px;
}

.detail-tabs__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.team-card__section {
  margin-top: 10px;
}

.team-card__section:first-child {
  margin-top: 0;
}

.team-card__label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--muted);
  margin: 0 0 4px 0;
}

.team-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.team-filter-menu__button {
  list-style: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.team-filter-menu__button::-webkit-details-marker {
  display: none;
}

.showcase-redirect {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 20rem;
  padding: 2rem;
}

.showcase-redirect__content {
  display: grid;
  gap: 1rem;
  text-align: center;
  max-width: 400px;
}

.showcase-redirect__icon {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

.showcase-redirect__title {
  margin: 0;
  font-family: Sora, sans-serif;
  font-size: 1.5rem;
}

.showcase-redirect__desc {
  margin: 0;
  color: var(--muted);
  line-height: 1.5;
}

/* Showcase Count Badge */
.showcase-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.25rem;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 0.625rem;
  margin-left: 0.5rem;
}

/* Showcase States */
.showcase-loading,
.showcase-error,
.showcase-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1.5rem;
  text-align: center;
  border-radius: 18px;
  border: 1px dashed var(--border);
  background: var(--surface-muted);
  min-height: 200px;
}

.showcase-loading .loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--surface-strong);
  border-top: 3px solid var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.showcase-empty__icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.6;
}

.showcase-empty__title {
  margin: 0 0 0.5rem 0;
  font-family: Sora, sans-serif;
  font-size: 1.25rem;
  color: var(--ink);
}

.showcase-empty__desc {
  margin: 0 0 1.5rem 0;
  color: var(--muted);
  line-height: 1.5;
  max-width: 400px;
}

/* Showcase Grid */
.showcase-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.5rem;
  max-width: 100%;
}

@media (min-width: 1200px) {
  .showcase-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 980px) and (max-width: 1199px) {
  .showcase-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .showcase-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}
</style>