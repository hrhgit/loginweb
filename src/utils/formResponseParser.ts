import type { RegistrationQuestion } from './eventDetails'

export interface ParsedFormResponse {
  questionId: string
  questionTitle: string
  questionType: string
  answer: string | string[]
  displayValue: string
}

export interface FormResponseParseResult {
  parsedResponses: ParsedFormResponse[]
  hasUnknownQuestions: boolean
  totalQuestions: number
}

/**
 * 解析单个表单回答的显示值
 */
const parseAnswerDisplayValue = (
  answer: string | string[],
  question: RegistrationQuestion | null
): string => {
  if (!answer) return '未填写'
  
  // 如果没有问题定义，直接显示原始值
  if (!question) {
    if (Array.isArray(answer)) {
      return answer.join(', ')
    }
    return String(answer)
  }

  // 文本类型题目
  if (question.type === 'text' || question.type === 'textarea') {
    return Array.isArray(answer) ? answer.join(', ') : String(answer)
  }

  // 选择类型题目，需要根据选项ID查找标签
  if (question.type === 'single' || question.type === 'multi' || question.type === 'select') {
    const options = question.options || []
    
    if (Array.isArray(answer)) {
      // 多选答案
      const labels = answer.map(optionId => {
        const option = options.find(opt => opt.id === optionId)
        return option?.label || `未知选项(${optionId})`
      })
      return labels.join(', ')
    } else {
      // 单选答案
      const option = options.find(opt => opt.id === answer)
      return option?.label || `未知选项(${answer})`
    }
  }

  // 其他类型，直接显示
  return Array.isArray(answer) ? answer.join(', ') : String(answer)
}

/**
 * 解析表单回答数据
 */
export const parseFormResponse = (
  formResponse: Record<string, any>,
  questions: RegistrationQuestion[]
): FormResponseParseResult => {
  const parsedResponses: ParsedFormResponse[] = []
  let hasUnknownQuestions = false

  // 遍历表单回答中的每个问题
  Object.entries(formResponse).forEach(([questionId, answer]) => {
    // 查找对应的问题定义
    const question = questions.find(q => q.id === questionId)
    
    if (!question) {
      hasUnknownQuestions = true
    }

    const displayValue = parseAnswerDisplayValue(answer, question || null)

    parsedResponses.push({
      questionId,
      questionTitle: question?.title || `未知问题 (${questionId})`,
      questionType: question?.type || 'unknown',
      answer,
      displayValue
    })
  })

  return {
    parsedResponses,
    hasUnknownQuestions,
    totalQuestions: parsedResponses.length
  }
}

/**
 * 获取问题类型的中文显示名
 */
export const getQuestionTypeLabel = (type: string): string => {
  const typeLabels: Record<string, string> = {
    'single': '单选',
    'multi': '多选',
    'text': '填空',
    'textarea': '长文本',
    'select': '下拉选择',
    'autocomplete': '自动完成',
    'unknown': '未知类型'
  }
  
  return typeLabels[type] || type
}

/**
 * 检查表单回答是否为空
 */
export const isFormResponseEmpty = (formResponse: Record<string, any>): boolean => {
  if (!formResponse || typeof formResponse !== 'object') {
    return true
  }
  
  return Object.keys(formResponse).length === 0
}

/**
 * 获取表单回答的统计信息
 */
export const getFormResponseStats = (formResponse: Record<string, any>) => {
  if (isFormResponseEmpty(formResponse)) {
    return {
      totalQuestions: 0,
      answeredQuestions: 0,
      emptyQuestions: 0
    }
  }

  const entries = Object.entries(formResponse)
  const answeredQuestions = entries.filter(([_, answer]) => {
    if (Array.isArray(answer)) {
      return answer.length > 0
    }
    return answer !== null && answer !== undefined && String(answer).trim() !== ''
  }).length

  return {
    totalQuestions: entries.length,
    answeredQuestions,
    emptyQuestions: entries.length - answeredQuestions
  }
}

/**
 * 为表格显示生成表单回答数据
 */
export interface FormResponseTableData {
  userId: string
  username: string
  status: string
  createdAt: string
  responses: Record<string, string> // questionId -> displayValue
}

export interface FormResponseTableColumn {
  key: string
  title: string
  type: string
  isStandard: boolean
}

export interface FormResponseTableResult {
  columns: FormResponseTableColumn[]
  rows: FormResponseTableData[]
  hasFormData: boolean
}

/**
 * 生成表单回答的表格数据
 */
export const generateFormResponseTable = (
  registrations: Array<{
    id: string
    user_id: string
    form_response: Record<string, any>
    status: string
    created_at: string
    profile?: { username?: string | null }
  }>,
  questions: RegistrationQuestion[]
): FormResponseTableResult => {
  // 标准列
  const standardColumns: FormResponseTableColumn[] = [
    { key: 'username', title: '用户名', type: 'text', isStandard: true },
    { key: 'status', title: '状态', type: 'status', isStandard: true },
    { key: 'createdAt', title: '报名时间', type: 'date', isStandard: true }
  ]

  // 收集所有问题ID
  const allQuestionIds = new Set<string>()
  registrations.forEach(reg => {
    if (reg.form_response && typeof reg.form_response === 'object') {
      Object.keys(reg.form_response).forEach(questionId => {
        allQuestionIds.add(questionId)
      })
    }
  })

  // 生成问题列
  const questionColumns: FormResponseTableColumn[] = Array.from(allQuestionIds).map(questionId => {
    const question = questions.find(q => q.id === questionId)
    return {
      key: questionId,
      title: question?.title || `未知问题 (${questionId.substring(0, 8)}...)`,
      type: question?.type || 'unknown',
      isStandard: false
    }
  })

  // 合并所有列
  const columns = [...standardColumns, ...questionColumns]

  // 生成行数据
  const rows: FormResponseTableData[] = registrations.map(reg => {
    const responses: Record<string, string> = {}
    
    // 处理表单回答
    if (reg.form_response && typeof reg.form_response === 'object') {
      Object.entries(reg.form_response).forEach(([questionId, answer]) => {
        const question = questions.find(q => q.id === questionId)
        responses[questionId] = parseAnswerDisplayValue(answer, question || null)
      })
    }

    return {
      userId: reg.user_id,
      username: reg.profile?.username || '未知用户',
      status: reg.status === 'registered' ? '已报名' : '未报名',
      createdAt: new Date(reg.created_at).toLocaleDateString(),
      responses
    }
  })

  return {
    columns,
    rows,
    hasFormData: questionColumns.length > 0
  }
}