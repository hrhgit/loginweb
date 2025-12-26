export type RegistrationStep = {
  time: string
  title: string
  desc: string
}

export type TeamLobbyCard = {
  name: string
  members: number
  needs: string[]
  vibe: string
}

export type FormQuestionType = 'single' | 'multi' | 'text' | 'select'

export type FormOption = {
  id: string
  label: string
}

export type ProfileField = 'username' | 'phone' | 'qq' | 'roles'

export type RegistrationQuestion = {
  id: string
  type: FormQuestionType
  title: string
  required: boolean
  allowOther?: boolean
  options?: FormOption[]
  dependsOn?: QuestionDependency | null
  linkedProfileField?: ProfileField | null
}

export type RegistrationForm = {
  questions: RegistrationQuestion[]
}

export type QuestionDependency = {
  questionId: string
  optionId: string
}

export type EventDetailContent = {
  introductionBlocks: string[]
  highlightItems: string[]
  registrationSteps: RegistrationStep[]
  registrationForm: RegistrationForm
  teamLobby: TeamLobbyCard[]
  submissionChecklist: string[]
  submissionNote: string
}

export type EventDescriptionPayload = {
  summary?: string
  details?: EventDetailContent
}

export const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const createDefaultEventDetails = (): EventDetailContent => ({
  introductionBlocks: [
    '这是一次以创意驱动的 Game Jam，主题在开场时公布，团队需在限定时间内完成可玩的原型。',
    '我们鼓励跨学科组合：策划、程序、设计、音效与叙事共同完成作品。',
    '现场将提供创作空间与节奏管理，帮助团队更顺畅地完成迭代与展示。',
  ],
  highlightItems: [
    '主题当天公布，限制时间内完成核心玩法',
    '导师巡场，提供设计与叙事建议',
    'Demo 展示 + 点评，优秀作品推荐后续孵化',
  ],
  registrationSteps: [
    { time: 'T-7', title: '报名登记', desc: '填写报名信息，选择个人报名或加入队伍。' },
    { time: 'T-3', title: '组队匹配', desc: '进入组队大厅，补齐角色或加入其他团队。' },
    { time: 'D0', title: '主题公布', desc: '开场公布主题与评分维度，团队进入创作。' },
    { time: 'D2', title: '作品提交', desc: '上传构建包、演示视频与说明文档。' },
    { time: 'D2', title: '终局展示', desc: '现场 Demo 与评委点评，公布获奖名单。' },
  ],
  registrationForm: {
    questions: [],
  },
  teamLobby: [
    { name: '夜行飞船', members: 3, needs: ['程序', '音效'], vibe: '偏叙事与氛围体验' },
    { name: '像素工坊', members: 4, needs: ['关卡设计'], vibe: '动作 + 像素风' },
    { name: '实验室 D', members: 2, needs: ['美术', '程序'], vibe: '机制探索与快节奏原型' },
  ],
  submissionChecklist: [
    '可运行的构建包（Windows / macOS / Web 任一）',
    '1-2 分钟试玩视频或 GIF',
    '团队介绍与分工说明',
    '核心玩法与创意说明',
  ],
  submissionNote: '提交窗口将在活动后半段开放，确保所有团队公平冲刺。',
})

const normalizeTextArray = (value: unknown, fallback: string[]) => {
  if (!Array.isArray(value)) return fallback
  const next = value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
  return next
}

const normalizeSteps = (value: unknown, fallback: RegistrationStep[]) => {
  if (!Array.isArray(value)) return fallback
  const next = value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const record = item as Partial<RegistrationStep>
      const time = typeof record.time === 'string' ? record.time.trim() : ''
      const title = typeof record.title === 'string' ? record.title.trim() : ''
      const desc = typeof record.desc === 'string' ? record.desc.trim() : ''
      if (!time && !title && !desc) return null
      return { time, title, desc }
    })
    .filter((item): item is NonNullable<typeof item> => !!item)
  return next
}

const normalizeOptions = (value: unknown) => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const record = item as Partial<FormOption>
      const id = typeof record.id === 'string' ? record.id.trim() : ''
      const label = typeof record.label === 'string' ? record.label.trim() : ''
      if (!id && !label) return null
      return { id: id || generateId(), label }
    })
    .filter((item): item is NonNullable<typeof item> => !!item)
}

const normalizeDependency = (value: unknown): QuestionDependency | null => {
  if (!value || typeof value !== 'object') return null
  const record = value as Partial<QuestionDependency>
  const questionId = typeof record.questionId === 'string' ? record.questionId.trim() : ''
  const optionId = typeof record.optionId === 'string' ? record.optionId.trim() : ''
  if (!questionId || !optionId) return null
  return { questionId, optionId }
}

const normalizeQuestions = (value: unknown, fallback: RegistrationQuestion[]) => {
  if (!Array.isArray(value)) return fallback
  const next = value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const record = item as Partial<RegistrationQuestion>
      const id = typeof record.id === 'string' ? record.id.trim() : ''
      const type =
        record.type === 'single' || record.type === 'multi' || record.type === 'text' || record.type === 'select'
          ? record.type
          : 'text'
      const title = typeof record.title === 'string' ? record.title.trim() : ''
      const required = Boolean(record.required)
      const allowOther = type === 'select' ? Boolean(record.allowOther) : false
      const options = type === 'text' ? [] : normalizeOptions(record.options)
      const dependsOn = normalizeDependency(record.dependsOn)
      const linkedProfileField =
        record.linkedProfileField === 'username' ||
        record.linkedProfileField === 'phone' ||
        record.linkedProfileField === 'qq' ||
        record.linkedProfileField === 'roles'
          ? record.linkedProfileField
          : null

      if (!id && !title) return null
      return {
        id: id || generateId(),
        type,
        title,
        required,
        allowOther,
        options,
        dependsOn,
        linkedProfileField,
      }
    })
    .filter((item): item is NonNullable<typeof item> => !!item)
  return next
}

const normalizeRegistrationForm = (value: unknown, fallback: RegistrationForm) => {
  if (!value || typeof value !== 'object') return fallback
  const record = value as Partial<RegistrationForm>
  return {
    questions: normalizeQuestions(record.questions, fallback.questions),
  }
}

const normalizeTeams = (value: unknown, fallback: TeamLobbyCard[]) => {
  if (!Array.isArray(value)) return fallback
  const next = value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const record = item as Partial<TeamLobbyCard>
      const name = typeof record.name === 'string' ? record.name.trim() : ''
      const members =
        typeof record.members === 'number' && Number.isFinite(record.members) ? record.members : 0
      const needs = Array.isArray(record.needs)
        ? record.needs.filter((need) => typeof need === 'string' && need.trim()).map((need) => need.trim())
        : []
      const vibe = typeof record.vibe === 'string' ? record.vibe.trim() : ''
      if (!name && !vibe) return null
      return { name, members, needs, vibe }
    })
    .filter((item): item is NonNullable<typeof item> => !!item)
  return next
}

const normalizeDetails = (input: Partial<EventDetailContent> | null | undefined) => {
  const defaults = createDefaultEventDetails()
  if (!input) return defaults
  return {
    introductionBlocks: normalizeTextArray(input.introductionBlocks, defaults.introductionBlocks),
    highlightItems: normalizeTextArray(input.highlightItems, defaults.highlightItems),
    registrationSteps: normalizeSteps(input.registrationSteps, defaults.registrationSteps),
    registrationForm: normalizeRegistrationForm(input.registrationForm, defaults.registrationForm),
    teamLobby: normalizeTeams(input.teamLobby, defaults.teamLobby),
    submissionChecklist: normalizeTextArray(input.submissionChecklist, defaults.submissionChecklist),
    submissionNote: typeof input.submissionNote === 'string' ? input.submissionNote.trim() : defaults.submissionNote,
  }
}

const parseDescriptionPayload = (raw: string): EventDescriptionPayload | null => {
  if (!raw.trim()) return null
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return null
    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : undefined
    const details =
      parsed.details && typeof parsed.details === 'object'
        ? normalizeDetails(parsed.details as Partial<EventDetailContent>)
        : undefined
    if (!summary && !details) return null
    return { summary, details }
  } catch {
    return null
  }
}

export const getEventSummary = (description: string | null) => {
  if (!description) return ''
  const parsed = parseDescriptionPayload(description)
  if (parsed) return parsed.summary ?? ''
  return description.trim()
}

export const getEventSummaryText = (description: string | null, fallback = '暂无简介') => {
  const summary = getEventSummary(description)
  return summary || fallback
}

export const getEventDetailsFromDescription = (description: string | null) => {
  if (!description) return createDefaultEventDetails()
  const parsed = parseDescriptionPayload(description)
  if (parsed?.details) return parsed.details
  return createDefaultEventDetails()
}

export const buildEventDescription = (summary: string, details: EventDetailContent) => {
  return JSON.stringify({
    summary: summary.trim(),
    details,
  })
}
