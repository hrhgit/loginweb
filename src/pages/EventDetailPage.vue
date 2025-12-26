<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAppStore } from '../store/appStore'
import { supabase } from '../lib/supabase'
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

const store = useAppStore()
const route = useRoute()

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
const teamModalOpen = ref(false)
const teamFormName = ref('')
const teamFormNeeds = ref('')
const teamFormVibe = ref('')
const teamFormError = ref('')

const eventId = computed(() => String(route.params.id ?? ''))
const detailTab = ref<'intro' | 'registration' | 'team' | 'form' | 'submission'>('intro')
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
const teamCreateDisabled = computed(() => isDemo.value || event.value?.status === 'draft')
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

      if (q.type === 'text') {
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

const openTeamModal = () => {
  if (!event.value) return
  if (isDemo.value) {
    store.setBanner('info', '展示活动不支持创建队伍。')
    return
  }
  if (event.value.status === 'draft') {
    store.setBanner('info', '草稿活动暂不支持创建队伍。')
    return
  }
  if (!store.user) {
    store.openAuth('sign_in')
    store.authInfo = '请先登录后创建队伍。'
    return
  }
  teamFormError.value = ''
  teamModalOpen.value = true
}

const closeTeamModal = () => {
  teamModalOpen.value = false
  teamFormError.value = ''
}

const resetTeamForm = () => {
  teamFormName.value = ''
  teamFormNeeds.value = ''
  teamFormVibe.value = ''
}

const submitTeam = () => {
  if (!event.value) return
  teamFormError.value = ''
  const name = teamFormName.value.trim()
  if (!name) {
    teamFormError.value = '请填写队伍名称。'
    return
  }
  const needs = teamFormNeeds.value
    .split(/[,，、]/)
    .map((item) => item.trim())
    .filter(Boolean)
  const vibe = teamFormVibe.value.trim()
  const nextTeam = {
    name,
    members: 1,
    needs,
    vibe,
  }
  detailContent.value = {
    ...detailContent.value,
    teamLobby: [...detailContent.value.teamLobby, nextTeam],
  }
  resetTeamForm()
  closeTeamModal()
  store.setBanner('info', '队伍已创建（仅前端展示）。')
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

const handleSelectChange = (questionId: string, event: Event) => {
  const target = event.target as HTMLSelectElement | null
  const value = target?.value ?? ''
  registrationAnswers.value = { ...registrationAnswers.value, [questionId]: value }
  if (value !== '__other__') {
    const next = { ...registrationOtherText.value }
    delete next[questionId]
    registrationOtherText.value = next
  }
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
    if (question.type === 'text') {
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
    if (question.type === 'text' && typeof value === 'string') {
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
    detailTab.value = 'form'
  }
  registrationSubmitBusy.value = false
}

const handleRevertToDraft = async () => {
  if (!event.value || !canRevertToDraft.value) return
  const confirmed = window.confirm('确定要将该活动退回草稿吗？退回后将从公开列表隐藏。')
  if (!confirmed) return
  revertBusy.value = true
  store.clearBanners()
  const { error } = await store.updateEventStatus(event.value.id, 'draft')
  if (error) {
    store.setBanner('error', error)
  } else {
    event.value = { ...event.value, status: 'draft' }
    store.setBanner('info', '已退回草稿（仅你可见，可在“我发起的活动”中继续编辑）。')
  }
  revertBusy.value = false
}

const handleRegistrationClick = async () => {
  if (!event.value) return
  if (isRegistered.value) {
    await store.toggleRegistration(event.value)
    return
  }
  if (!store.user) {
    store.openAuth('sign_in')
    store.authInfo = '请先登录后报名。'
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

const handleFormSelectChange = (questionId: string, event: Event) => {
  const target = event.target as HTMLSelectElement | null
  const value = target?.value ?? ''
  formAnswers.value = { ...formAnswers.value, [questionId]: value }
  if (value !== '__other__') {
    const next = { ...formOtherText.value }
    delete next[questionId]
    formOtherText.value = next
  }
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
    store.authInfo = '请先登录后修改报名表单。'
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
    store.setBanner('info', '报名表单已更新。')
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

const loadEvent = async (id: string) => {
  if (!id) return
  loading.value = true
  error.value = ''

  await store.ensureEventsLoaded()
  const cached = store.getEventById(id)
  if (cached) {
    event.value = cached
    loadDetails()
    await loadRegistrationFormResponse()
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
  await loadRegistrationFormResponse()
  loading.value = false
}

onMounted(async () => {
  await store.refreshUser()
  await store.ensureEventsLoaded()
  await store.ensureRegistrationsLoaded()
  await loadEvent(eventId.value)
})

watch(eventId, async (id) => {
  await loadEvent(id)
})

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
              class="btn btn--success-solid btn--lg"
              :to="`/events/${eventId}/edit`"
            >
              编辑页面
            </RouterLink>
            <button
              v-if="canRevertToDraft"
              class="btn btn--danger-solid btn--lg"
              type="button"
              :disabled="revertBusy"
              @click="handleRevertToDraft"
            >
              {{ revertBusy ? '处理中...' : '退回草稿' }}
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
                  <span>时间</span>
                  <p>{{ detailTimeRange }}</p>
                </div>
                <div>
                  <span>地点</span>
                  <p>{{ locationLabel(event.location) }}</p>
                </div>
                <div>
                  <span>队伍最大人数</span>
                  <p>{{ teamSizeLabel(event.team_max_size) }}</p>
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
            <p v-if="isDemo" class="muted small-note">展示活动不支持报名。</p>
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
            @click="detailTab = 'intro'"
          >
            活动介绍
          </button>
          <button
            class="detail-tabs__btn"
            type="button"
            role="tab"
            :aria-selected="detailTab === 'registration'"
            :class="{ active: detailTab === 'registration' }"
            @click="detailTab = 'registration'"
          >
            报名流程
          </button>
          <button
            class="detail-tabs__btn"
            type="button"
            role="tab"
            :aria-selected="detailTab === 'team'"
            :class="{ active: detailTab === 'team' }"
            @click="detailTab = 'team'"
          >
            组队大厅
          </button>
          <button
            class="detail-tabs__btn"
            type="button"
            role="tab"
            :aria-selected="detailTab === 'form'"
            :class="{ active: detailTab === 'form' }"
            @click="detailTab = 'form'"
          >
            报名表单
          </button>
          <button
            class="detail-tabs__btn"
            type="button"
            role="tab"
            :aria-selected="detailTab === 'submission'"
            :class="{ active: detailTab === 'submission' }"
            @click="detailTab = 'submission'"
          >
            作品提交
          </button>
        </div>

        <div class="detail-tabs__content">
          <section v-if="detailTab === 'intro'" class="detail-section" role="tabpanel">
            <div class="detail-section__head">
              <h2>活动介绍</h2>
              <p class="muted">围绕 Game Jam 的创作节奏与规则，打造沉浸式体验。</p>
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
              <h2>报名流程</h2>
              <p class="muted">从报名到展示的完整节奏，一步一步走完。</p>
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
              <p class="muted">以下为示例队伍展示（仅前端模板）。</p>
            </div>
            <div class="detail-section__actions">
              <button class="btn btn--primary" type="button" :disabled="teamCreateDisabled" @click="openTeamModal">
                创建队伍
              </button>
            </div>
          </div>
          <div class="team-grid">
            <article v-for="team in detailContent.teamLobby" :key="team.name" class="team-card">
              <div class="team-card__head">
                <h3>{{ team.name }}</h3>
                <span class="pill-badge pill-badge--published">{{ team.members }} 人</span>
                </div>
                <p class="team-card__desc">{{ team.vibe }}</p>
                <div class="team-card__tags">
                  <span v-for="role in team.needs" :key="role" class="meta-item">缺 {{ role }}</span>
                </div>
                <button class="btn btn--ghost" type="button" disabled>申请加入（前端展示）</button>
              </article>
            </div>
          </section>

          <section v-else-if="detailTab === 'form'" class="detail-section" role="tabpanel">
            <div class="detail-section__head">
              <div>
                <h2>报名表单</h2>
                <p class="muted">报名成功后可查看并修改你的填写内容。</p>
              </div>
            </div>

            <div v-if="formLoading" class="detail-panel">
              <p class="muted">正在加载报名表单...</p>
            </div>
            <div v-else-if="!isRegistered" class="detail-panel">
              <p class="muted">你尚未报名该活动，报名成功后可查看与修改表单。</p>
            </div>
            <form v-else class="form" @submit.prevent="saveFormEdit">
              <div v-for="(question, index) in visibleFormQuestions" :key="question.id" class="form-question">
                <div class="form-question__title">
                  <span class="form-question__index">Q{{ index + 1 }}</span>
                  <span>{{ question.title }}</span>
                  <span v-if="question.required" class="pill-badge pill-badge--draft">必填</span>
                </div>

                <div v-if="question.type === 'text'" class="form-question__field">
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

                <div v-else-if="question.type === 'select'" class="form-question__field">
                  <select
                    :value="getFormSelectValue(question.id)"
                    :disabled="!formEditMode"
                    @change="handleFormSelectChange(question.id, $event)"
                  >
                    <option value="" disabled>请选择</option>
                    <option v-for="option in question.options ?? []" :key="option.id" :value="option.id">
                      {{ option.label }}
                    </option>
                    <option v-if="question.allowOther" value="__other__">其他</option>
                  </select>
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

          <section v-else class="detail-section" role="tabpanel">
            <div class="detail-section__head">
              <h2>作品提交</h2>
              <p class="muted">提交前准备好构建包与说明材料。</p>
            </div>
            <div class="detail-grid">
              <article class="detail-panel">
                <h3>提交清单</h3>
                <ul>
                  <li v-for="item in detailContent.submissionChecklist" :key="item">{{ item }}</li>
                </ul>
              </article>
              <article class="detail-panel detail-panel--accent">
                <h3>提交入口</h3>
                <p>{{ detailContent.submissionNote }}</p>
                <button class="btn btn--primary" type="button" disabled>进入提交入口（前端展示）</button>
              </article>
            </div>
          </section>
        </div>
      </div>
    </section>
  </main>

  <teleport to="body">
    <div v-if="registrationModalOpen" class="modal-backdrop">
      <div class="modal modal--wide">
        <header class="modal__header">
          <h2>报名表单</h2>
          <button class="icon-btn" type="button" @click="closeRegistrationForm" aria-label="close">×</button>
        </header>

        <form class="form" @submit.prevent="submitRegistrationForm">
          <div v-for="(question, index) in visibleRegistrationQuestions" :key="question.id" class="form-question">
            <div class="form-question__title">
              <span class="form-question__index">Q{{ index + 1 }}</span>
              <span>{{ question.title }}</span>
              <span v-if="question.required" class="pill-badge pill-badge--draft">必填</span>
            </div>

            <div v-if="question.type === 'text'" class="form-question__field">
              <textarea
                v-model="registrationAnswers[question.id]"
                rows="3"
                placeholder="填写你的答案"
              ></textarea>
            </div>

            <div v-else-if="question.type === 'select'" class="form-question__field">
              <select :value="getSelectValue(question.id)" @change="handleSelectChange(question.id, $event)">
                <option value="" disabled>请选择</option>
                <option v-for="option in question.options ?? []" :key="option.id" :value="option.id">
                  {{ option.label }}
                </option>
                <option v-if="question.allowOther" value="__other__">其他</option>
              </select>
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
    </div>

    <div v-if="teamModalOpen" class="modal-backdrop">
      <div class="modal">
        <header class="modal__header">
          <h2>创建队伍</h2>
          <button class="icon-btn" type="button" @click="closeTeamModal" aria-label="close">×</button>
        </header>

        <form class="form" @submit.prevent="submitTeam">
          <label class="field">
            <span>队伍名称</span>
            <input v-model="teamFormName" type="text" placeholder="例如 霓虹守夜人" required />
          </label>

          <label class="field">
            <span>招募角色（用逗号分隔）</span>
            <input v-model="teamFormNeeds" type="text" placeholder="程序、美术、音效" />
          </label>

          <label class="field">
            <span>队伍风格</span>
            <textarea v-model="teamFormVibe" rows="3" placeholder="我们想做一款节奏冒险游戏"></textarea>
          </label>

          <p v-if="teamFormError" class="alert error">{{ teamFormError }}</p>

          <div class="modal__actions">
            <button class="btn btn--ghost" type="button" @click="closeTeamModal">取消</button>
            <button class="btn btn--primary" type="submit">创建</button>
          </div>
        </form>
      </div>
    </div>
  </teleport>
</template>


