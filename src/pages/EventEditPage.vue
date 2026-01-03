﻿<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  Link2,
  Eye,
  Save,
  Trash2,
  Send,
  Undo2,
  FileText,
  Calendar,
  Settings,
  Plus,
  X,
  Info,
  ListOrdered,
  Users,
  Upload,
} from 'lucide-vue-next'
import { RouterLink, onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { useAppStore, type EventStatus } from '../store/appStore'
import type { Event as AppEvent } from '../store/models'
import {
  teamSizeLabel,
  formatTimeRange,
  locationLabel,
  statusClass,
  statusLabel,
} from '../utils/eventFormat'
import {
  buildEventDescription,
  createDefaultEventDetails,
  generateId,
  getEventDetailsFromDescription,
  getEventSummary,
  type EventDetailContent,
  type FormOption,
  type FormQuestionType,
  type QuestionDependency,
  type RegistrationForm,
  type RegistrationQuestion,
  type RegistrationStep,
  type TeamLobbyCard,
} from '../utils/eventDetails'

import { useEvent } from '../composables/useEvents'

const store = useAppStore()
const route = useRoute()
const router = useRouter()

const eventId = computed(() => String(route.params.id ?? ''))

// 优先使用路由传递的活动数据，避免不必要的查询
const routeEvent = computed(() => {
  // 从路由状态获取活动数据
  const state = history.state as any
  return state?.event || null
})

// 只有在没有路由数据时才查询
const eventQuery = useEvent(eventId.value)

// 合并数据源：优先使用路由数据，其次使用查询数据
const event = computed(() => {
  if (routeEvent.value) {
    console.log('🚀 [EventEditPage] Using route event data:', routeEvent.value.id)
    return routeEvent.value
  }
  
  if (eventQuery.data.value) {
    console.log('🔄 [EventEditPage] Using query event data:', eventQuery.data.value.id)
    return eventQuery.data.value
  }
  
  return null
})
const loading = ref(false)
const loadError = ref('')
const saveBusy = ref(false)
const fieldErrors = reactive<Record<string, string>>({})
const questionErrors = reactive<Record<string, { title?: string; options?: string }>>({})
const questionOptionErrors = reactive<Record<string, string[]>>({})
const editorTab = ref<'details' | 'schedule' | 'form'>('details')
const previewTab = ref<'intro' | 'registration' | 'team' | 'form' | 'showcase'>('intro')
const summary = ref('')
const teamLobbyState = ref<TeamLobbyCard[]>(createDefaultEventDetails().teamLobby)
const formQuestions = ref<RegistrationQuestion[]>([])
const dependencyModalOpen = ref(false)
const dependencyTargetId = ref<string | null>(null)
const dependencyQuestionId = ref('')
const dependencyOptionId = ref('')
const activeLinkMenuQuestionId = ref<string | null>(null)

const editTitle = ref('')
const editStartTime = ref('')
const editEndTime = ref('')
const editRegistrationStartTime = ref('')
const editRegistrationEndTime = ref('')
const editSubmissionStartTime = ref('')
const editSubmissionEndTime = ref('')
const editLocation = ref('')
const editTeamMaxSize = ref('')
const savedSnapshot = ref('')
const allowNavigation = ref(false)

const isDemo = computed(() => (event.value ? store.isDemoEvent(event.value) : false))
const canEdit = computed(() => {
  if (!event.value || !store.user || isDemo.value) return false
  return store.isAdmin && event.value.created_by === store.user?.id
})
const isPreview = computed(() => {
  const view = Array.isArray(route.query.view) ? route.query.view[0] : route.query.view
  return view === 'preview'
})
const isDeleting = computed(() =>
  event.value ? store.deleteBusyEventId === event.value.id : false,
)

const form = reactive({
  introBlocks: '',
  highlightItems: '',
  registrationSteps: '',
})

const detailTimeRange = computed(() =>
  formatTimeRange(event.value?.start_time ?? null, event.value?.end_time ?? null),
)
const questionTypeLabel = (type: FormQuestionType) => {
  switch (type) {
    case 'single':
      return '单选题'
    case 'multi':
      return '多选题'
    case 'select':
      return '下拉选择'
    case 'text':
      return '填空题'
    case 'textarea':
      return '简答题'
    case 'autocomplete':
      return '带选项填空'
    default:
      return '未知题型'
  }
}

const toLines = (items: string[]) => items.join('\n')
const toStepLines = (steps: RegistrationStep[]) =>
  steps.map((step) => `${step.time} | ${step.title} | ${step.desc}`.trim()).join('\n')
const createOption = (): FormOption => ({
  id: generateId(),
  label: '',
})

const parseOptionTable = (raw: string) => {
  const lines = raw
    .replace(/\uFEFF/g, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const labels: string[] = []
  for (const line of lines) {
    const cells = line.split(/[\t,]/).map((cell) => cell.trim()).filter(Boolean)
    if (cells.length) labels.push(...cells)
  }
  return Array.from(new Set(labels))
}

const parseOptionRows = (rows: unknown[][]) => {
  const labels: string[] = []
  for (const row of rows) {
    if (!Array.isArray(row)) continue
    for (const cell of row) {
      if (cell === null || cell === undefined) continue
      const value = `${cell}`.trim()
      if (value) labels.push(value)
    }
  }
  return Array.from(new Set(labels))
}

const applyOptionLabels = (question: RegistrationQuestion, labels: string[]) => {
  if (!labels.length) return
  question.options = labels.map((label) => ({ id: generateId(), label }))
}

const handleOptionFileUpload = async (question: RegistrationQuestion, event: Event) => {
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.[0]
  if (!file) return
  const name = file.name.toLowerCase()
  let labels: string[] = []
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const { read, utils } = await import('xlsx')
    const data = await file.arrayBuffer()
    const workbook = read(data, { type: 'array' })
    const firstSheet = workbook.SheetNames[0]
    if (firstSheet) {
      const rows = utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1 }) as unknown[][]
      labels = parseOptionRows(rows)
    }
  } else {
    const text = await file.text()
    labels = parseOptionTable(text)
  }
  if (!labels.length) {
    store.setBanner('info', '未解析到选项，请检查文件内容')
    return
  }
  applyOptionLabels(question, labels)
  if (target) target.value = ''
}

const clearQuestionOptions = (question: RegistrationQuestion) => {
  question.options = []
}

const createQuestion = (type: FormQuestionType): RegistrationQuestion => ({
  id: generateId(),
  type,
  title: '',
  required: false,
  allowOther: false,
  dependsOn: null,
  options: type === 'text' || type === 'textarea' ? [] : [createOption(), createOption()],
})

const applyDetailsToForm = (details: EventDetailContent) => {
  form.introBlocks = toLines(details.introductionBlocks)
  form.highlightItems = toLines(details.highlightItems)
  form.registrationSteps = toStepLines(details.registrationSteps)
  teamLobbyState.value = details.teamLobby
  formQuestions.value = details.registrationForm.questions.map((question) => ({
    id: question.id,
    type: question.type,
    title: question.title,
    required: question.required,
    allowOther: question.allowOther ?? false,
    dependsOn: question.dependsOn ?? null,
    options:
      question.type === 'text' || question.type === 'textarea'
        ? []
        : (question.options ?? []).map((option) => ({ id: option.id, label: option.label })),
  }))
}

const parseLines = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

const parseSteps = (value: string): RegistrationStep[] => {
  return parseLines(value)
    .map((line) => {
      const [time = '', title = '', desc = ''] = line.split('|').map((part) => part.trim())
      if (!time && !title && !desc) return null
      return { time, title, desc }
    })
    .filter((item): item is RegistrationStep => Boolean(item))
}

const sanitizeQuestions = (questions: RegistrationQuestion[]): RegistrationForm => {
  const normalized = questions
    .map((question) => {
      const title = question.title.trim()
      if (!title) return null
      if (question.type === 'text' || question.type === 'textarea') {
        return { ...question, title, options: [], allowOther: false, dependsOn: question.dependsOn ?? null }
      }
      const allowOther = question.type === 'select' ? Boolean(question.allowOther) : false
      const options =
        question.options
          ?.map((option) => ({ ...option, label: option.label.trim() }))
          .filter((option) => option.label) ?? []
      return { ...question, title, options, allowOther, dependsOn: question.dependsOn ?? null } as RegistrationQuestion
    })
    .filter((item): item is RegistrationQuestion => Boolean(item))

  const indexById = new Map(normalized.map((question, idx) => [question.id, idx]))
  const optionsById = new Map(
    normalized.map((question) => [question.id, new Set((question.options ?? []).map((option) => option.id))]),
  )

  const cleaned = normalized.map((question) => {
    const dependency = question.dependsOn ?? null
    if (!dependency) return { ...question, dependsOn: null }
    const dependencyIndex = indexById.get(dependency.questionId)
    const currentIndex = indexById.get(question.id)
    const optionSet = optionsById.get(dependency.questionId)
    if (
      dependencyIndex === undefined ||
      currentIndex === undefined ||
      dependencyIndex >= currentIndex ||
      !optionSet ||
      !optionSet.has(dependency.optionId)
    ) {
      return { ...question, dependsOn: null }
    }
    return question
  })

  return { questions: cleaned }
}

const addQuestion = (type: FormQuestionType) => {
  formQuestions.value = [...formQuestions.value, createQuestion(type)]
}

const removeQuestion = (index: number) => {
  const removedId = formQuestions.value[index]?.id
  const next = formQuestions.value.filter((_, idx) => idx !== index)
  formQuestions.value = next.map((question) => {
    if (removedId && question.dependsOn?.questionId === removedId) {
      return { ...question, dependsOn: null }
    }
    return question
  })
}

const addOption = (question: RegistrationQuestion) => {
  if (question.type === 'text' || question.type === 'textarea') return
  question.options = [...(question.options ?? []), createOption()]
}

const removeOption = (question: RegistrationQuestion, optionIndex: number) => {
  if (!question.options) return
  const removedOptionId = question.options[optionIndex]?.id
  question.options = question.options.filter((_, idx) => idx !== optionIndex)
  if (!removedOptionId) return
  formQuestions.value = formQuestions.value.map((item) => {
    if (item.dependsOn?.questionId === question.id && item.dependsOn?.optionId === removedOptionId) {
      return { ...item, dependsOn: null }
    }
    return item
  })
}

const handleQuestionTypeChange = (question: RegistrationQuestion) => {
  const isTextLike = question.type === 'text' || question.type === 'textarea' || question.type === 'autocomplete'

  // Reset linked profile field if incompatible
  if (isTextLike) {
    if (question.linkedProfileField === 'roles') {
      question.linkedProfileField = null
    }
  } else {
    if (['phone', 'qq', 'username'].includes(question.linkedProfileField ?? '')) {
      question.linkedProfileField = null
    }
  }

  if (isTextLike) {
    if (question.type === 'autocomplete') {
      if (!question.options || question.options.length === 0) {
        question.options = [createOption(), createOption()]
      }
    } else {
      question.options = []
    }
    question.allowOther = false
    formQuestions.value = formQuestions.value.map((item) => {
      if (item.dependsOn?.questionId === question.id) {
        return { ...item, dependsOn: null }
      }
      return item
    })
    return
  }

  if (!question.options || question.options.length === 0) {
    question.options = [createOption(), createOption()]
  }
  if (question.type !== 'select') {
    question.allowOther = false
  }
}

const toggleLinkMenu = (id: string) => {
  if (activeLinkMenuQuestionId.value === id) {
    activeLinkMenuQuestionId.value = null
  } else {
    activeLinkMenuQuestionId.value = id
  }
}

const linkedRoleOptions = ['策划', '程序', '美术', '音乐音效']
const applyLinkedFieldDefaults = (question: RegistrationQuestion, field: string | null) => {
  if (!field) return
  const isTextLike = question.type === 'text' || question.type === 'textarea' || question.type === 'autocomplete'
  const title = getLinkFieldLabel(field)
  if (field === 'roles' && isTextLike) {
    question.type = 'multi'
    handleQuestionTypeChange(question)
  }
  if (['phone', 'qq', 'username'].includes(field) && question.type !== 'text') {
    question.type = 'text'
    handleQuestionTypeChange(question)
  }
  if (!question.title.trim() && title) {
    question.title = title
  }
  if (field === 'roles') {
    question.options = linkedRoleOptions.map((label) => ({ id: generateId(), label }))
    question.allowOther = false
  }
}

const selectLinkField = (question: RegistrationQuestion, field: string | null) => {
  question.linkedProfileField = field as any
  applyLinkedFieldDefaults(question, field)
  activeLinkMenuQuestionId.value = null
}

const getLinkFieldLabel = (field: string | null | undefined) => {
  if (!field) return ''
  const map: Record<string, string> = {
    phone: '手机',
    qq: 'QQ',
    username: '昵称',
    roles: '职能',
  }
  return map[field] || field
}

const getDependencyLabel = (question: RegistrationQuestion) => {
  const dependency = question.dependsOn
  if (!dependency) return ''
  const targetIndex = formQuestions.value.findIndex((item) => item.id === dependency.questionId)
  const target = formQuestions.value.find((item) => item.id === dependency.questionId)
  const optionLabel = target?.options?.find((option) => option.id === dependency.optionId)?.label?.trim()
  const questionLabel = targetIndex >= 0 ? `Q${targetIndex + 1}` : '前置题'
  return `${questionLabel} · ${optionLabel || '某选项'}`
}

const getAvailableDependencyQuestions = (targetId: string | null) => {
  if (!targetId) return []
  const targetIndex = formQuestions.value.findIndex((item) => item.id === targetId)
  if (targetIndex <= 0) return []
  return formQuestions.value
    .slice(0, targetIndex)
    .filter(
      (item) =>
        item.type !== 'text' &&
        item.type !== 'textarea' &&
        item.type !== 'autocomplete' &&
        (item.options ?? []).length > 0,
    )
}

const availableDependencyQuestions = computed(() =>
  getAvailableDependencyQuestions(dependencyTargetId.value),
)
const availableDependencyOptions = computed(() => {
  const target = availableDependencyQuestions.value.find((item) => item.id === dependencyQuestionId.value)
  return target?.options ?? []
})
const canApplyDependency = computed(() => {
  if (availableDependencyQuestions.value.length === 0) return false
  if (dependencyQuestionId.value.trim() === '' || dependencyOptionId.value.trim() === '') return false
  return availableDependencyOptions.value.some((option) => option.id === dependencyOptionId.value)
})

const syncDependencyOption = () => {
  const options = availableDependencyOptions.value
  dependencyOptionId.value = options[0]?.id ?? ''
}

const openDependencyModal = (question: RegistrationQuestion) => {
  dependencyTargetId.value = question.id
  const candidates = getAvailableDependencyQuestions(question.id)
  if (question.dependsOn && candidates.find((item) => item.id === question.dependsOn!.questionId)) {
    const selected = candidates.find((item) => item.id === question.dependsOn!.questionId)
    dependencyQuestionId.value = question.dependsOn.questionId
    dependencyOptionId.value =
      selected?.options?.find((option) => option.id === question.dependsOn?.optionId)?.id ??
      selected?.options?.[0]?.id ??
      ''
  } else {
    dependencyQuestionId.value = candidates[0]?.id ?? ''
    dependencyOptionId.value = candidates[0]?.options?.[0]?.id ?? ''
  }
  dependencyModalOpen.value = true
}

const closeDependencyModal = () => {
  dependencyModalOpen.value = false
}

const applyDependency = () => {
  const target = formQuestions.value.find((item) => item.id === dependencyTargetId.value)
  if (!target) return
  if (!canApplyDependency.value) {
    target.dependsOn = null
    closeDependencyModal()
    return
  }
  target.dependsOn = {
    questionId: dependencyQuestionId.value,
    optionId: dependencyOptionId.value,
  } satisfies QuestionDependency
  closeDependencyModal()
}

const clearDependency = () => {
  const target = formQuestions.value.find((item) => item.id === dependencyTargetId.value)
  if (target) {
    target.dependsOn = null
  }
  closeDependencyModal()
}

const previewDetails = computed<EventDetailContent>(() => ({
  introductionBlocks: parseLines(form.introBlocks),
  highlightItems: parseLines(form.highlightItems),
  registrationSteps: parseSteps(form.registrationSteps),
  registrationForm: sanitizeQuestions(formQuestions.value),
  teamLobby: teamLobbyState.value,
  submissionChecklist: [],
  submissionNote: '',
}))

const serializeEditorState = () =>
  JSON.stringify({
    title: editTitle.value,
    startTime: editStartTime.value,
    endTime: editEndTime.value,
    registrationStartTime: editRegistrationStartTime.value,
    registrationEndTime: editRegistrationEndTime.value,
    submissionStartTime: editSubmissionStartTime.value,
    submissionEndTime: editSubmissionEndTime.value,
    location: editLocation.value,
    teamMaxSize: editTeamMaxSize.value,
    summary: summary.value,
    introBlocks: form.introBlocks,
    highlightItems: form.highlightItems,
    registrationSteps: form.registrationSteps,
    teamLobby: teamLobbyState.value,
    questions: formQuestions.value.map((question) => ({
      id: question.id,
      type: question.type,
      title: question.title,
      required: question.required,
      allowOther: question.allowOther ?? false,
      dependsOn: question.dependsOn ?? null,
      options: (question.options ?? []).map((option) => ({ id: option.id, label: option.label })),
    })),
  })

const syncSavedSnapshot = () => {
  savedSnapshot.value = serializeEditorState()
}

const isDirty = computed(() => {
  if (!savedSnapshot.value) return false
  return savedSnapshot.value !== serializeEditorState()
})

const focusQuestion = (questionId: string) => {
  editorTab.value = 'form'
  nextTick(() => {
    const node = document.querySelector(`[data-question-id="${questionId}"]`)
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}

const clearQuestionErrors = () => {
  Object.keys(questionErrors).forEach((key) => delete questionErrors[key])
  Object.keys(questionOptionErrors).forEach((key) => delete questionOptionErrors[key])
}

const validateFormQuestions = () => {
  clearQuestionErrors()
  if (formQuestions.value.length === 0) return true
  for (let index = 0; index < formQuestions.value.length; index += 1) {
    const question = formQuestions.value[index]
    if (!question.title.trim()) {
      questionErrors[question.id] = { title: `报名表单第 ${index + 1} 题标题未填写` }
      focusQuestion(question.id)
      return false
    }
    if (question.type === 'text' || question.type === 'textarea') continue
    const options = question.options ?? []
    if (options.length === 0) {
      questionErrors[question.id] = { options: `报名表单第 ${index + 1} 题至少需要一个选项` }
      focusQuestion(question.id)
      return false
    }
    const emptyOptionIds = options.filter((option) => !option.label.trim()).map((option) => option.id)
    if (emptyOptionIds.length > 0) {
      questionErrors[question.id] = { options: `报名表单第 ${index + 1} 题还有未填写的选项` }
      questionOptionErrors[question.id] = emptyOptionIds
      focusQuestion(question.id)
      return false
    }
  }
  return true
}

const validateFields = (): boolean => {
  let isValid = true
  // Clear previous errors
  Object.keys(fieldErrors).forEach((key) => delete fieldErrors[key])

  if (!editTitle.value.trim()) {
    fieldErrors.title = '活动标题不能为空'
    isValid = false
  }

  const teamMaxSizeInput = `${editTeamMaxSize.value ?? ''}`.trim()
  if (teamMaxSizeInput) {
    const parsed = Number.parseInt(teamMaxSizeInput, 10)
    if (!Number.isFinite(parsed) || parsed < 0) {
      fieldErrors.teamMaxSize = '队伍最大人数需要是 0 或大于 0 的数字'
      isValid = false
    }
  }

  const startDate = editStartTime.value ? new Date(editStartTime.value) : null
  const endDate = editEndTime.value ? new Date(editEndTime.value) : null
  if (startDate && Number.isNaN(startDate.getTime())) {
    fieldErrors.startTime = '活动开始时间无效'
    isValid = false
  }
  if (endDate && Number.isNaN(endDate.getTime())) {
    fieldErrors.endTime = '活动结束时间无效'
    isValid = false
  }
  if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
    fieldErrors.endTime = '活动开始时间不能晚于活动结束时间'
    isValid = false
  }

  const registrationStartDate = editRegistrationStartTime.value
    ? new Date(editRegistrationStartTime.value)
    : null
  const registrationEndDate = editRegistrationEndTime.value ? new Date(editRegistrationEndTime.value) : null
  if (registrationStartDate && Number.isNaN(registrationStartDate.getTime())) {
    fieldErrors.registrationStartTime = '报名开始时间无效'
    isValid = false
  }
  if (registrationEndDate && Number.isNaN(registrationEndDate.getTime())) {
    fieldErrors.registrationEndTime = '报名结束时间无效'
    isValid = false
  }
  if (
    registrationStartDate &&
    registrationEndDate &&
    registrationStartDate.getTime() > registrationEndDate.getTime()
  ) {
    fieldErrors.registrationEndTime = '报名开始时间不能晚于报名结束时间'
    isValid = false
  }

  const submissionStartDate = editSubmissionStartTime.value
    ? new Date(editSubmissionStartTime.value)
    : null
  const submissionEndDate = editSubmissionEndTime.value ? new Date(editSubmissionEndTime.value) : null
  if (submissionStartDate && Number.isNaN(submissionStartDate.getTime())) {
    fieldErrors.submissionStartTime = '提交开始时间无效'
    isValid = false
  }
  if (submissionEndDate && Number.isNaN(submissionEndDate.getTime())) {
    fieldErrors.submissionEndTime = '提交结束时间无效'
    isValid = false
  }
  if (
    submissionStartDate &&
    submissionEndDate &&
    submissionStartDate.getTime() > submissionEndDate.getTime()
  ) {
    fieldErrors.submissionEndTime = '提交开始时间不能晚于提交结束时间'
    isValid = false
  }

  // TODO: Add validation for description related fields (form.introBlocks, etc.) if needed.

  return isValid
}

const validateAndScroll = (): boolean => {
  const isValid = validateFields()
  if (!isValid) {
    // Scroll to first error
    nextTick(() => {
      const firstErrorField = document.querySelector('.field--error')
      firstErrorField?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }
  return isValid
}

// 提取表单数据填充逻辑
const populateFormData = (eventData: AppEvent) => {
  summary.value = getEventSummary(eventData.description ?? null)
  applyDetailsToForm(getEventDetailsFromDescription(eventData.description ?? null))

  // Populate new refs
  editTitle.value = eventData.title ?? ''
  editStartTime.value = eventData.start_time ? eventData.start_time.substring(0, 16) : ''
  editEndTime.value = eventData.end_time ? eventData.end_time.substring(0, 16) : ''
  editRegistrationStartTime.value = eventData.registration_start_time
    ? eventData.registration_start_time.substring(0, 16)
    : ''
  editRegistrationEndTime.value = eventData.registration_end_time
    ? eventData.registration_end_time.substring(0, 16)
    : ''
  editSubmissionStartTime.value = eventData.submission_start_time
    ? eventData.submission_start_time.substring(0, 16)
    : ''
  editSubmissionEndTime.value = eventData.submission_end_time
    ? eventData.submission_end_time.substring(0, 16)
    : ''
  editLocation.value = eventData.location ?? ''
  editTeamMaxSize.value = eventData.team_max_size?.toString() ?? ''
  
  syncSavedSnapshot()
}

// Event loading is now handled by Vue Query composables
// Watch for event data changes and update form accordingly
watch(event, (newEvent) => {
  if (newEvent) {
    // Check permissions and status
    if (store.isDemoEvent(newEvent)) {
      loadError.value = '演示活动不支持编辑'
      return
    } else if (!store.isAdmin || newEvent.created_by !== store.user?.id) {
      loadError.value = '没有权限编辑此活动'
      return
    }
    
    // Fill form data
    populateFormData(newEvent)
  }
}, { immediate: true })

const handleSave = async (nextStatus: EventStatus) => {
  if (!event.value || !canEdit.value) return false
  saveBusy.value = true
  store.clearBanners()

  if (!validateAndScroll()) {
    saveBusy.value = false
    return false
  }
  if (!validateFormQuestions()) {
    saveBusy.value = false
    return false
  }

  // Validate Max Participants - re-evaluate after validateAndScroll
  const teamMaxSizeInput = `${editTeamMaxSize.value ?? ''}`.trim()
  let teamMaxSize = 0
  if (teamMaxSizeInput) {
    const parsed = Number.parseInt(teamMaxSizeInput, 10)
    if (Number.isFinite(parsed) && parsed >= 0) { // Only assign if valid, validation done in validateFields
      teamMaxSize = parsed
    }
  }

  // Validate Dates - re-evaluate after validateAndScroll
  const startDate = editStartTime.value ? new Date(editStartTime.value) : null
  const endDate = editEndTime.value ? new Date(editEndTime.value) : null
  const registrationStartDate = editRegistrationStartTime.value
    ? new Date(editRegistrationStartTime.value)
    : null
  const registrationEndDate = editRegistrationEndTime.value
    ? new Date(editRegistrationEndTime.value)
    : null
  const submissionStartDate = editSubmissionStartTime.value
    ? new Date(editSubmissionStartTime.value)
    : null
  const submissionEndDate = editSubmissionEndTime.value
    ? new Date(editSubmissionEndTime.value)
    : null

  const description = buildEventDescription(summary.value, previewDetails.value)

  const updates: Partial<AppEvent> = {
    title: editTitle.value.trim(),
    start_time: startDate ? startDate.toISOString() : null,
    end_time: endDate ? endDate.toISOString() : null,
    registration_start_time: registrationStartDate ? registrationStartDate.toISOString() : null,
    registration_end_time: registrationEndDate ? registrationEndDate.toISOString() : null,
    submission_start_time: submissionStartDate ? submissionStartDate.toISOString() : null,
    submission_end_time: submissionEndDate ? submissionEndDate.toISOString() : null,
    location: editLocation.value.trim() || null,
    team_max_size: teamMaxSize,
    description: description,
    status: nextStatus,
  }

  const { error } = await store.updateEvent(event.value.id, updates)
  if (error) {
    store.setBanner('error', `保存失败：${error}`)
    saveBusy.value = false
    return false
  } else {
    // Update local event object after successful save
    Object.assign(event.value, updates)
    syncSavedSnapshot()
    store.setBanner('info', nextStatus === 'published' ? '活动进行中！' : '草稿已保存！')
  }
  saveBusy.value = false
  return true
}


const handleSaveDraft = async () => {
  await handleSave('draft')
}

const handleSaveChanges = async () => {
  if (!event.value) return
  const status = event.value.status ?? 'draft'
  const ok = await handleSave(status)
  if (!ok || status !== 'published') return
  allowNavigation.value = true
  await router.push(`/events/${event.value.id}`)
}

const handlePublish = async () => {
  const ok = await handleSave('published')
  if (!ok || !event.value) return
  allowNavigation.value = true
  await router.push(`/events/${event.value.id}`)
}

const revertBusy = ref(false)
const handleRevertToDraft = async () => {
  if (!event.value || !canEdit.value) return
  if (event.value.status !== 'published') return
  const confirmed = window.confirm('确定要将该活动退回草稿吗？退回后将从公开列表隐藏')
  if (!confirmed) return
  revertBusy.value = true
  store.clearBanners()
  const { error } = await store.updateEventStatus(event.value.id, 'draft')
  if (error) {
    store.setBanner('error', error)
  } else {
    if (event.value) {
      Object.assign(event.value, { status: 'draft' })
    }
    syncSavedSnapshot()
    store.setBanner('info', '已退回草稿（仅你可见，可在“我发起的活动”中继续编辑）')
  }
  revertBusy.value = false
}

const togglePreview = () => {
  const nextQuery = { ...route.query }
  if (isPreview.value) {
    delete nextQuery.view
  } else {
    nextQuery.view = 'preview'
  }
  router.replace({ path: route.path, query: nextQuery })
}

const handleDeleteDraft = async () => {
  if (!event.value) return
  Object.keys(fieldErrors).forEach((key) => delete fieldErrors[key]) // Clear field errors
  if (event.value.status !== 'draft') {
    store.setBanner('error', '只有草稿可以删除')
    return
  }
  const confirmed = window.confirm('确定要删除该草稿吗？删除后无法恢复')
  if (!confirmed) return
  const { error } = await store.deleteDraftEvent(event.value)
  if (error) {
    if (error === 'demo') store.setBanner('error', '演示活动不支持删除')
    else if (error === 'auth') store.setBanner('error', '请先登录并确保有权限删除草稿')
    else if (error === 'status') store.setBanner('error', '只有草稿可以删除')
    else store.setBanner('error', `删除失败：${error}`)
    return
  }
  allowNavigation.value = true
  await router.push('/events/mine')
}

onMounted(async () => {
  // 添加事件监听器
  window.addEventListener('beforeunload', handleBeforeUnload)
  document.addEventListener('click', closeLinkMenu)
  
  // 初始化表单
  applyDetailsToForm(createDefaultEventDetails())
})

// Remove the watch for eventId since Vue Query handles this automatically

const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  if (!isDirty.value) return
  event.preventDefault()
  event.returnValue = ''
}

onBeforeRouteLeave(() => {
  if (allowNavigation.value) {
    allowNavigation.value = false
    return true
  }
  if (!isDirty.value) return true
  return window.confirm('当前修改尚未保存，确定要离开吗？')
})

const closeLinkMenu = () => {
  activeLinkMenuQuestionId.value = null
}

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
  document.removeEventListener('click', closeLinkMenu)
})
</script>

<template>
  <main class="editor-page">
    <section v-if="loading" class="detail-loading">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </section>

    <section v-else-if="loadError" class="empty-state">
      <h2>无法编辑活动</h2>
      <p class="muted">{{ loadError }}</p>
      <div class="empty-state__actions">
        <button v-if="!store.isAuthed" class="btn btn--primary" type="button" @click="store.openAuth('sign_in')">
          登录后继续
        </button>
        <RouterLink class="btn btn--ghost" to="/events">返回活动页</RouterLink>
      </div>
    </section>

    <template v-else-if="event">
      <section class="editor-header">
        <div class="editor-header__info">
          <p class="detail-eyebrow">活动编辑</p>
          <h1>{{ editTitle || event.title }}</h1>
          <p class="muted">
            时间：{{ detailTimeRange }} · 地点：{{ editLocation || locationLabel(event.location) }} · 队伍最大人数：{{
              teamSizeLabel(event.team_max_size)
            }}
          </p>
          <p class="muted">详细内容会保存到数据库，发布后对所有用户可见</p>
        </div>
        <div class="editor-actions" :class="{ 'editor-actions--stack-primary': event.status === 'draft' || event.status === 'published' }">
          <span v-if="event.status" class="pill-badge" :class="statusClass(event.status)">
            {{ statusLabel(event.status) }}
          </span>
          <button class="btn btn--ghost btn--icon-text" type="button" @click="togglePreview">
            <Eye :size="18" />
            <span>{{ isPreview ? '返回编辑' : '预览页面' }}</span>
          </button>
          <template v-if="event.status === 'draft'">
            <button
              class="btn btn--ghost btn--icon-text"
              type="button"
              :disabled="saveBusy"
              @click="handleSaveDraft"
            >
              <Save :size="18" />
              <span>保存草稿</span>
            </button>
            <button class="btn btn--primary btn--icon-text" type="button" :disabled="saveBusy" @click="handlePublish">
              <Send :size="18" />
              <span>发布活动</span>
            </button>
          </template>
          <button v-else class="btn btn--primary btn--icon-text" type="button" :disabled="saveBusy" @click="handleSaveChanges">
            <Save :size="18" />
            <span>保存修改</span>
          </button>
          <span
            v-if="event.status === 'draft' || event.status === 'published'"
            class="editor-actions__break"
            aria-hidden="true"
          ></span>
          <button
            v-if="event.status === 'published'"
            class="btn btn--danger btn--icon-text"
            type="button"
            :disabled="revertBusy"
            @click="handleRevertToDraft"
          >
            <Undo2 :size="18" />
            <span>{{ revertBusy ? '处理中...' : '退回草稿' }}</span>
          </button>
          <button
            v-if="event.status === 'draft'"
            class="btn btn--danger btn--icon-text"
            type="button"
            :disabled="saveBusy || isDeleting"
            @click="handleDeleteDraft"
          >
            <Trash2 :size="18" />
            <span>{{ isDeleting ? '删除中...' : '删除草稿' }}</span>
          </button>
        </div>
      </section>


      <section class="editor-grid editor-grid--single">
        <div v-if="!isPreview" class="editor-panel">
          <div class="editor-tabs editor-tabs--wide">
            <button
              class="editor-tab"
              type="button"
              :class="{ active: editorTab === 'details' }"
              @click="editorTab = 'details'"
            >
              <FileText :size="16" />
              <span>活动详情</span>
            </button>
            <button
              class="editor-tab"
              type="button"
              :class="{ active: editorTab === 'schedule' }"
              @click="editorTab = 'schedule'"
            >
              <Calendar :size="16" />
              <span>时间与名额</span>
            </button>
            <button
              class="editor-tab"
              type="button"
              :class="{ active: editorTab === 'form' }"
              @click="editorTab = 'form'"
            >
              <Settings :size="16" />
              <span>报名表单设置</span>
            </button>
          </div>
          <div class="form">
            <template v-if="editorTab === 'details'">
              <div class="editor-subsection">
                <h3 class="editor-subsection__title">活动内容</h3>
                <label class="field" :class="{ 'field--error': fieldErrors.title }">
                  <span>活动标题</span>
                  <input v-model="editTitle" type="text" placeholder="例如 周末 Game Jam" />
                  <p v-if="fieldErrors.title" class="help-text error-text">{{ fieldErrors.title }}</p>
                </label>

                <label class="field">
                  <span>活动简介</span>
                  <textarea v-model="summary" rows="3" placeholder="用于列表与详情头图的简介"></textarea>
                </label>

                <label class="field">
                  <span>活动介绍（多段）</span>
                  <textarea v-model="form.introBlocks" rows="6" placeholder="每段一行"></textarea>
                </label>

                <label class="field">
                  <span>关键亮点（列表）</span>
                  <textarea v-model="form.highlightItems" rows="4" placeholder="每条一行"></textarea>
                </label>

                <label class="field">
                  <span>活动流程</span>
                  <textarea
                    v-model="form.registrationSteps"
                    rows="6"
                    placeholder="T-7 | 报名登记 | 填写报名信息"
                  ></textarea>
                  <p class="help-text">一行一个步骤，使用 | 分隔 时间 / 标题 / 描述</p>
                </label>
              </div>
            </template>

            <template v-else-if="editorTab === 'schedule'">
              <div class="editor-subsection">
                <h3 class="editor-subsection__title">时间与名额</h3>
                <label class="field" :class="{ 'field--error': fieldErrors.location }">
                  <span>地点</span>
                  <input v-model="editLocation" type="text" placeholder="线上或具体地址" />
                  <p v-if="fieldErrors.location" class="help-text error-text">{{ fieldErrors.location }}</p>
                </label>

                <label class="field" :class="{ 'field--error': fieldErrors.teamMaxSize }">
                  <span>队伍最大人数</span>
                  <input v-model="editTeamMaxSize" type="number" min="0" placeholder="例如 30 (0 表示不限)" />
                  <p v-if="fieldErrors.teamMaxSize" class="help-text error-text">{{ fieldErrors.teamMaxSize }}</p>
                </label>

                <div class="field-row">
                  <label class="field" :class="{ 'field--error': fieldErrors.startTime }">
                    <span>活动开始时间</span>
                    <input v-model="editStartTime" type="datetime-local" />
                    <p v-if="fieldErrors.startTime" class="help-text error-text">{{ fieldErrors.startTime }}</p>
                  </label>

                  <label class="field" :class="{ 'field--error': fieldErrors.endTime }">
                    <span>活动结束时间</span>
                    <input v-model="editEndTime" type="datetime-local" />
                    <p v-if="fieldErrors.endTime" class="help-text error-text">{{ fieldErrors.endTime }}</p>
                  </label>
                </div>

                <div class="field-row">
                  <label class="field" :class="{ 'field--error': fieldErrors.registrationStartTime }">
                    <span>报名开始时间</span>
                    <input v-model="editRegistrationStartTime" type="datetime-local" />
                    <p v-if="fieldErrors.registrationStartTime" class="help-text error-text">
                      {{ fieldErrors.registrationStartTime }}
                    </p>
                  </label>

                  <label class="field" :class="{ 'field--error': fieldErrors.registrationEndTime }">
                    <span>报名结束时间</span>
                    <input v-model="editRegistrationEndTime" type="datetime-local" />
                    <p v-if="fieldErrors.registrationEndTime" class="help-text error-text">
                      {{ fieldErrors.registrationEndTime }}
                    </p>
                  </label>
                </div>

                <div class="field-row">
                  <label class="field" :class="{ 'field--error': fieldErrors.submissionStartTime }">
                    <span>提交开始时间</span>
                    <input v-model="editSubmissionStartTime" type="datetime-local" />
                    <p v-if="fieldErrors.submissionStartTime" class="help-text error-text">
                      {{ fieldErrors.submissionStartTime }}
                    </p>
                  </label>

                  <label class="field" :class="{ 'field--error': fieldErrors.submissionEndTime }">
                    <span>提交结束时间</span>
                    <input v-model="editSubmissionEndTime" type="datetime-local" />
                    <p v-if="fieldErrors.submissionEndTime" class="help-text error-text">
                      {{ fieldErrors.submissionEndTime }}
                    </p>
                  </label>
                </div>
              </div>
            </template>

            <template v-else>
              <section class="form-builder">
                <header class="form-builder__header">
                  <div>
                    <h3>报名表单</h3>
                    <p class="muted">参与者报名时需填写，支持单选、多选、下拉、带选项填空与填空题</p>
                  </div>
                </header>

                <div v-if="formQuestions.length === 0" class="form-builder__empty">
                  <button class="form-builder__add form-builder__add--empty" type="button" @click="addQuestion('single')">
                    <Plus :size="24" />
                    添加新问题
                  </button>
                </div>

                <template v-else>
                  <article
                    v-for="(question, index) in formQuestions"
                    :key="question.id"
                    class="question-editor"
                    :data-question-id="question.id"
                  >
                    <header class="question-editor__head">
                    <div class="question-editor__meta">
                      <span class="pill-badge">
                        {{ `Q${index + 1}` }}
                        <span v-if="question.required" class="question-editor__required">*</span>
                      </span>
                      <select
                        class="question-editor__type-select"
                        v-model="question.type"
                        @change="handleQuestionTypeChange(question)"
                      >
                        <option value="single">单选题</option>
                        <option value="multi">多选题</option>
                        <option value="select">下拉选择</option>
                        <option value="autocomplete">带选项填空</option>
                        <option value="text">填空题</option>
                        <option value="textarea">简答题</option>
                      </select>
                      
                      <div class="link-menu-wrapper">
                        <button
                          type="button"
                          class="btn-link-trigger"
                          :class="{ 'btn-link-trigger--active': !!question.linkedProfileField }"
                          @click.stop="toggleLinkMenu(question.id)"
                          title="关联用户信息"
                        >
                          <Link2 :size="16" />
                          <span v-if="question.linkedProfileField">{{
                            getLinkFieldLabel(question.linkedProfileField)
                          }}</span>
                        </button>

                        <div
                          v-if="activeLinkMenuQuestionId === question.id"
                          class="link-menu-dropdown"
                        >
                          <button
                            type="button"
                            class="link-menu-item muted"
                            @click="selectLinkField(question, null)"
                          >
                            不关联
                          </button>
                          <template
                            v-if="
                              question.type === 'text' || question.type === 'textarea' || question.type === 'autocomplete'
                            "
                          >
                            <button
                              type="button"
                              class="link-menu-item"
                              @click="selectLinkField(question, 'phone')"
                            >
                              关联手机号
                            </button>
                            <button
                              type="button"
                              class="link-menu-item"
                              @click="selectLinkField(question, 'qq')"
                            >
                              关联QQ号
                            </button>
                            <button
                              type="button"
                              class="link-menu-item"
                              @click="selectLinkField(question, 'username')"
                            >
                              关联昵称
                            </button>
                          </template>
                          <template v-else>
                            <button
                              type="button"
                              class="link-menu-item"
                              @click="selectLinkField(question, 'roles')"
                            >
                              关联职能
                            </button>
                          </template>
                        </div>
                      </div>
                    </div>
                      <button
                        class="icon-btn icon-btn--small icon-btn--danger"
                        type="button"
                        @click="removeQuestion(index)"
                        aria-label="remove"
                      >
                        <Trash2 :size="16" />
                      </button>
                    </header>

                    <div class="question-editor__title">
                      <span class="question-editor__label">标题</span>
                      <input
                        v-model="question.title"
                        type="text"
                        placeholder="请输入题目标题"
                        :class="{ 'input-error': questionErrors[question.id]?.title }"
                      />
                    </div>
                    <p v-if="questionErrors[question.id]?.title" class="help-text error-text">
                      {{ questionErrors[question.id]?.title }}
                    </p>

                    <div class="question-editor__options">
                      <div v-if="question.type === 'text'" class="question-editor__text-hint">
                        填空题无须选项，报名时将提供文本输入框
                      </div>
                      <div v-else-if="question.type === 'textarea'" class="question-editor__text-hint">
                        简答题无需选项，报名时将提供多行文本输入框
                      </div>
                      <template v-else>
                        <div v-if="question.type === 'autocomplete'" class="question-editor__text-hint">
                          带选项填空将在填写时提供联想下拉，仍可输入任意文本
                        </div>
                        <div v-if="question.type === 'autocomplete'" class="question-editor__option-upload">
                          <label class="btn btn--ghost btn--text">
                            导入选项
                            <input
                              type="file"
                              accept=".csv,.tsv,.txt,.xlsx,.xls"
                              @change="handleOptionFileUpload(question, $event)"
                            />
                          </label>
                          <button class="btn btn--ghost btn--text" type="button" @click="clearQuestionOptions(question)">
                            清空选项
                          </button>
                          <p class="help-text">支持 Excel（.xlsx/.xls）或 CSV/TSV 文本，每行或单元格作为一个选项</p>
                        </div>
                        <div
                          v-for="(option, optionIndex) in question.options ?? []"
                          :key="option.id"
                          class="question-editor__option-row"
                          :class="{ 'question-editor__option-row--full': question.type === 'select' }"
                        >
                          <span
                            v-if="question.type !== 'select'"
                            class="question-editor__indicator"
                            :class="{ 'question-editor__indicator--multi': question.type === 'multi' }"
                          ></span>
                          <input
                            v-model="option.label"
                            type="text"
                            placeholder="选项内容"
                            :class="{ 'input-error': questionOptionErrors[question.id]?.includes(option.id) }"
                          />
                          <button
                            class="icon-btn icon-btn--small"
                            type="button"
                            @click="removeOption(question, optionIndex)"
                            aria-label="remove option"
                          >
                            <X :size="14" />
                          </button>
                        </div>
                      </template>
                    </div>
                    <p v-if="questionErrors[question.id]?.options" class="help-text error-text">
                      {{ questionErrors[question.id]?.options }}
                    </p>

                    <div class="question-editor__toolbar">
                      <div class="question-editor__toolbar-left">
                        <button
                          class="btn btn--ghost btn--text"
                          type="button"
                          :disabled="question.type === 'text' || question.type === 'textarea'"
                          @click="addOption(question)"
                        >
                          + 添加选项
                        </button>
                      </div>
                    </div>

                  <div class="question-editor__footer">
                    <div class="question-editor__footer-right">
                      <label class="question-editor__check">
                        <input v-model="question.required" type="checkbox" />
                        <span>必答</span>
                      </label>
                      <label v-if="question.type === 'select'" class="question-editor__check">
                        <input v-model="question.allowOther" type="checkbox" />
                        <span>允许其他项</span>
                      </label>
                      <button class="btn btn--ghost btn--text" type="button" @click="openDependencyModal(question)">
                        前置问题
                      </button>
                      <span v-if="question.dependsOn" class="question-editor__dependency">
                        显示于 {{ getDependencyLabel(question) }}
                      </span>
                    </div>
                  </div>
                  </article>

                  <button class="form-builder__add form-builder__add--footer" type="button" @click="addQuestion('single')">
                    <Plus :size="18" />
                    添加新问题
                  </button>
                </template>
              </section>
            </template>

            <div class="editor-footer-actions">
              <button v-if="event.status === 'draft'" class="btn btn--ghost" type="button" :disabled="saveBusy" @click="handleSaveDraft">
                保存草稿
              </button>
              <button v-else class="btn btn--ghost" type="button" :disabled="saveBusy" @click="handleSaveChanges">
                保存修改
              </button>
              <button class="btn btn--primary" type="button" :disabled="saveBusy" @click="togglePreview">
                预览界面
              </button>
            </div>
          </div>
        </div>

        <aside v-else class="editor-preview editor-preview--full">
          <section class="detail-hero">
            <div class="detail-hero__main">
              <div class="detail-hero__head-row">
                <p class="detail-eyebrow">Game Jam / 活动详情</p>
              </div>
              <h1>{{ event.title }}</h1>
              <p class="detail-lead">{{ summary || '暂无简介' }}</p>
              <div class="detail-tags">
                <span v-if="event.status" class="pill-badge" :class="statusClass(event.status)">
                  {{ statusLabel(event.status) }}
                </span>
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
                    :disabled="isDemo || event.status === 'draft'"
                  >
                    {{ store.registrationLabel(event) }}
                  </button>
                  <p v-if="isDemo" class="muted small-note">展示活动不支持报名</p>
                </div>
              </div>
            </div>
          </section>

          <section class="detail-tabs">
            <div class="detail-tabs__shell">
              <div class="detail-tabs__bar" role="tablist" aria-label="活动内容">
                <button
                  class="detail-tabs__btn"
                  type="button"
                  role="tab"
                  :aria-selected="previewTab === 'intro'"
                  :class="{ active: previewTab === 'intro' }"
                  @click="previewTab = 'intro'"
                >
                  <Info :size="16" />
                  活动介绍
                </button>
                <button
                  class="detail-tabs__btn"
                  type="button"
                  role="tab"
                  :aria-selected="previewTab === 'registration'"
                  :class="{ active: previewTab === 'registration' }"
                  @click="previewTab = 'registration'"
                >
                  <ListOrdered :size="16" />
                  活动流程
                </button>
                <button
                  class="detail-tabs__btn"
                  type="button"
                  role="tab"
                  :aria-selected="previewTab === 'team'"
                  :class="{ active: previewTab === 'team' }"
                  @click="previewTab = 'team'"
                >
                  <Users :size="16" />
                  组队大厅
                </button>
                <button
                  class="detail-tabs__btn"
                  type="button"
                  role="tab"
                  :aria-selected="previewTab === 'form'"
                  :class="{ active: previewTab === 'form' }"
                  @click="previewTab = 'form'"
                >
                  <FileText :size="16" />
                  报名表单
                </button>
                <button
                  class="detail-tabs__btn"
                  type="button"
                  role="tab"
                  :aria-selected="previewTab === 'showcase'"
                  :class="{ active: previewTab === 'showcase' }"
                  @click="previewTab = 'showcase'"
                >
                  <Eye :size="16" />
                  作品展示
                </button>
              </div>

              <div class="detail-tabs__content">
                <section v-if="previewTab === 'intro'" class="detail-section" role="tabpanel">
                  <div class="detail-section__head">
                    <h2>活动介绍</h2>
                    <p class="muted">围绕 Game Jam 的创作节奏与规则，打造沉浸式体验</p>
                  </div>
                  <div class="detail-grid">
                    <article class="detail-panel">
                      <h3>活动概述</h3>
                      <p v-for="block in previewDetails.introductionBlocks" :key="block">{{ block }}</p>
                    </article>
                    <article class="detail-panel">
                      <h3>关键亮点</h3>
                      <ul>
                        <li v-for="item in previewDetails.highlightItems" :key="item">{{ item }}</li>
                      </ul>
                    </article>
                  </div>
                </section>

                <section v-else-if="previewTab === 'registration'" class="detail-section" role="tabpanel">
                  <div class="detail-section__head">
                    <h2>活动流程</h2>
                    <p class="muted">从报名到展示的完整节奏，一步一步走完</p>
                  </div>
                  <div class="flow-grid">
                    <div v-for="step in previewDetails.registrationSteps" :key="step.title" class="flow-card">
                      <span class="flow-card__time">{{ step.time }}</span>
                      <h3>{{ step.title }}</h3>
                      <p>{{ step.desc }}</p>
                    </div>
                  </div>
                </section>

                <section v-else-if="previewTab === 'team'" class="detail-section" role="tabpanel">
                  <div class="detail-section__head">
                    <div>
                      <h2>组队大厅</h2>
                    </div>
                    <div class="detail-section__actions">
                      <button class="btn btn--primary btn--icon-text" type="button" disabled>
                        <Plus :size="18" />
                        <span>创建队伍</span>
                      </button>
                    </div>
                  </div>
                  <div class="team-lobby-tabs tab-nav">
                    <button class="tab-nav__btn active" type="button">
                      找队伍
                      <span class="showcase-count">{{ previewDetails.teamLobby.length }}</span>
                    </button>
                    <button class="tab-nav__btn" type="button">
                      找队友
                      <span class="showcase-count">0</span>
                    </button>
                    <button class="tab-nav__btn" type="button">
                      我的队伍
                      <span class="showcase-count">0</span>
                    </button>
                  </div>
                  <div class="team-grid">
                    <article v-for="team in previewDetails.teamLobby" :key="team.name" class="team-card">
                      <div class="team-card__head">
                        <h3>{{ team.name }}</h3>
                        <span class="pill-badge pill-badge--published">{{ team.members }} 人</span>
                      </div>
                      <p class="team-card__desc">{{ team.vibe }}</p>
                      <div class="team-card__tags">
                        <span v-for="role in team.needs" :key="role" class="meta-item">缺 {{ role }}</span>
                      </div>
                      <button class="btn btn--ghost" type="button" disabled>申请加入（预览模式）</button>
                    </article>
                  </div>
                </section>

                <section v-else-if="previewTab === 'form'" class="detail-section" role="tabpanel">
                  <div class="detail-section__head">
                    <h2>报名表单</h2>
                    <p class="muted">报名成功后可查看并修改填写内容</p>
                  </div>
                  <div v-if="previewDetails.registrationForm.questions.length === 0" class="detail-panel">
                    <p class="muted">暂未设置报名表单</p>
                  </div>
                  <div v-else class="detail-panel">
                    <div
                      v-for="(question, index) in previewDetails.registrationForm.questions"
                      :key="question.id"
                      class="form-question"
                    >
                      <div class="form-question__title">
                        <span class="form-question__index">Q{{ index + 1 }}</span>
                        <span>{{ question.title || '未命名问题' }}</span>
                        <span v-if="question.required" class="pill-badge pill-badge--draft">必填</span>
                        <span class="pill-badge pill-badge--success">{{ questionTypeLabel(question.type) }}</span>
                      </div>
                      <div v-if="question.type !== 'text' && question.type !== 'textarea'" class="detail-form-options">
                        <span v-for="option in question.options ?? []" :key="option.id" class="meta-item">
                          {{ option.label || '未命名选项' }}
                        </span>
                        <span v-if="question.allowOther" class="meta-item">允许其他</span>
                      </div>
                      <p v-else class="muted small-note">
                        {{ question.type === 'textarea' ? '简答题在报名时填写' : '填空题在报名时填写' }}
                      </p>
                    </div>
                  </div>
                </section>

                <section v-else class="detail-section" role="tabpanel">
                  <div class="detail-section__head">
                    <div>
                      <h2>作品展示</h2>
                    </div>
                    <div class="detail-section__actions">
                      <button class="btn btn--primary btn--icon-text" type="button" disabled>
                        <Upload :size="18" />
                        <span>提交作品</span>
                      </button>
                    </div>
                  </div>
                  <div class="showcase-tabs tab-nav">
                    <button class="tab-nav__btn active" type="button">
                      所有作品
                      <span class="showcase-count">0</span>
                    </button>
                    <button class="tab-nav__btn" type="button">
                      我的作品
                      <span class="showcase-count">0</span>
                    </button>
                  </div>
                  
                  <div class="showcase-empty">
                    <div class="showcase-empty__icon">📋</div>
                    <h3 class="showcase-empty__title">暂无作品</h3>
                    <p class="showcase-empty__desc">
                      还没有队伍提交作品，期待第一个作品的出现！
                    </p>
                    <button class="btn btn--primary" type="button" disabled>
                      提交作品（预览模式）
                    </button>
                  </div>
                </section>
              </div>
            </div>
          </section>

          <div class="editor-preview-actions">
            <button v-if="event.status === 'draft'" class="btn btn--primary btn--full" type="button" :disabled="saveBusy" @click="handlePublish">
              发布活动
            </button>
            <button v-else class="btn btn--primary btn--full" type="button" :disabled="saveBusy" @click="handleSaveChanges">
              保存修改
            </button>
          </div>
        </aside>
      </section>
    </template>
  </main>

  <teleport to="body">
    <div v-if="dependencyModalOpen" class="modal-backdrop">
      <div class="modal">
        <header class="modal__header">
          <h2>前置问题</h2>
          <button class="icon-btn" type="button" @click="closeDependencyModal" aria-label="close"><X :size="20" /></button>
        </header>

        <div v-if="availableDependencyQuestions.length === 0" class="empty-state">
          <h3>暂无可选的前置问题</h3>
          <p class="muted">请先在该题之前添加选择题并设置选项</p>
          <div class="empty-state__actions">
            <button class="btn btn--primary" type="button" @click="closeDependencyModal">知道了</button>
          </div>
        </div>

        <form v-else class="form" @submit.prevent="applyDependency">
          <label class="field">
            <span>前置题目</span>
            <select v-model="dependencyQuestionId" @change="syncDependencyOption">
              <option v-for="question in availableDependencyQuestions" :key="question.id" :value="question.id">
                {{
                  `Q${formQuestions.findIndex((item) => item.id === question.id) + 1} ${
                    question.title || '未命名题目'
                  }`
                }}
              </option>
            </select>
          </label>

          <label class="field">
            <span>触发选项</span>
            <select v-model="dependencyOptionId">
              <option v-for="option in availableDependencyOptions" :key="option.id" :value="option.id">
                {{ option.label || '未命名选项' }}
              </option>
            </select>
          </label>

          <div class="modal__actions">
            <button class="btn btn--ghost" type="button" @click="clearDependency">清除前置</button>
            <button class="btn btn--ghost" type="button" @click="closeDependencyModal">取消</button>
            <button class="btn btn--primary" type="submit" :disabled="!canApplyDependency">确认</button>
          </div>
        </form>
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

.editor-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.form-builder__add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.detail-tabs__btn {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>



