/**
 * 报名表单调试工具
 * 用于诊断报名表单加载问题
 */

import type { RegistrationQuestion } from './eventDetails'

export interface RegistrationFormDebugInfo {
  eventId: string
  userId: string
  hasEvent: boolean
  hasUser: boolean
  eventStatus: string | null
  registrationQuestions: RegistrationQuestion[]
  questionCount: number
  visibleQuestionCount: number
  registrationAnswers: Record<string, string | string[]>
  formDataLoading: boolean
  formDataError: string | null
  hasRegistrationForm: boolean
  isRegistered: boolean
  modalOpen: boolean
}

/**
 * 收集报名表单调试信息
 */
export function collectRegistrationFormDebugInfo(params: {
  eventId: string
  userId: string
  event: any
  user: any
  registrationQuestions: RegistrationQuestion[]
  registrationAnswers: Record<string, string | string[]>
  registrationDataQuery: any
  hasRegistrationForm: boolean
  isRegistered: boolean
  registrationModalOpen: boolean
}): RegistrationFormDebugInfo {
  const {
    eventId,
    userId,
    event,
    user,
    registrationQuestions,
    registrationAnswers,
    registrationDataQuery,
    hasRegistrationForm,
    isRegistered,
    registrationModalOpen
  } = params

  // 计算可见问题数量
  const visibleQuestions = registrationQuestions.filter(question => {
    if (!question.dependsOn) return true
    // 简化的依赖检查
    return true
  })

  return {
    eventId,
    userId,
    hasEvent: !!event,
    hasUser: !!user,
    eventStatus: event?.status || null,
    registrationQuestions,
    questionCount: registrationQuestions.length,
    visibleQuestionCount: visibleQuestions.length,
    registrationAnswers,
    formDataLoading: registrationDataQuery?.formLoading?.value || false,
    formDataError: registrationDataQuery?.formError?.value?.message || null,
    hasRegistrationForm,
    isRegistered,
    modalOpen: registrationModalOpen
  }
}

/**
 * 打印调试信息到控制台
 */
export function logRegistrationFormDebug(debugInfo: RegistrationFormDebugInfo) {
  console.group('🔍 报名表单调试信息')
  
  console.log('📋 基本信息:', {
    eventId: debugInfo.eventId,
    userId: debugInfo.userId,
    hasEvent: debugInfo.hasEvent,
    hasUser: debugInfo.hasUser,
    eventStatus: debugInfo.eventStatus
  })
  
  console.log('📝 表单配置:', {
    questionCount: debugInfo.questionCount,
    visibleQuestionCount: debugInfo.visibleQuestionCount,
    hasRegistrationForm: debugInfo.hasRegistrationForm,
    questions: debugInfo.registrationQuestions.map(q => ({
      id: q.id,
      title: q.title,
      type: q.type,
      required: q.required,
      dependsOn: q.dependsOn
    }))
  })
  
  console.log('💾 数据状态:', {
    formDataLoading: debugInfo.formDataLoading,
    formDataError: debugInfo.formDataError,
    isRegistered: debugInfo.isRegistered,
    answersCount: Object.keys(debugInfo.registrationAnswers).length,
    answers: debugInfo.registrationAnswers
  })
  
  console.log('🎭 UI状态:', {
    modalOpen: debugInfo.modalOpen
  })
  
  // 问题诊断
  const issues: string[] = []
  
  if (!debugInfo.hasEvent) {
    issues.push('❌ 活动数据未加载')
  }
  
  if (!debugInfo.hasUser) {
    issues.push('❌ 用户未登录')
  }
  
  if (debugInfo.questionCount === 0) {
    issues.push('❌ 活动未配置报名表单')
  }
  
  if (debugInfo.visibleQuestionCount === 0 && debugInfo.questionCount > 0) {
    issues.push('⚠️ 所有问题都被依赖条件隐藏')
  }
  
  if (debugInfo.formDataLoading) {
    issues.push('⏳ 表单数据正在加载中')
  }
  
  if (debugInfo.formDataError) {
    issues.push(`❌ 表单数据加载失败: ${debugInfo.formDataError}`)
  }
  
  if (issues.length > 0) {
    console.warn('🚨 发现问题:', issues)
  } else {
    console.log('✅ 表单状态正常')
  }
  
  console.groupEnd()
}

/**
 * 生成修复建议
 */
export function generateRegistrationFormFixSuggestions(debugInfo: RegistrationFormDebugInfo): string[] {
  const suggestions: string[] = []
  
  if (!debugInfo.hasEvent) {
    suggestions.push('等待活动数据加载完成，或检查活动ID是否正确')
  }
  
  if (!debugInfo.hasUser) {
    suggestions.push('用户需要先登录才能查看报名表单')
  }
  
  if (debugInfo.questionCount === 0) {
    suggestions.push('活动管理员需要在活动编辑页面配置报名表单')
  }
  
  if (debugInfo.visibleQuestionCount === 0 && debugInfo.questionCount > 0) {
    suggestions.push('检查问题的依赖条件设置，可能所有问题都被隐藏了')
  }
  
  if (debugInfo.formDataLoading) {
    suggestions.push('等待表单数据加载完成，如果长时间加载可以尝试刷新页面')
  }
  
  if (debugInfo.formDataError) {
    suggestions.push('表单数据加载失败，请检查网络连接或联系技术支持')
  }
  
  if (suggestions.length === 0) {
    suggestions.push('表单状态正常，如果仍有问题请联系技术支持')
  }
  
  return suggestions
}

/**
 * 在开发环境下暴露调试工具到全局
 */
export function setupRegistrationFormDebugTools() {
  if (import.meta.env.DEV) {
    ;(window as any).__REGISTRATION_FORM_DEBUG__ = {
      collectDebugInfo: collectRegistrationFormDebugInfo,
      logDebug: logRegistrationFormDebug,
      generateSuggestions: generateRegistrationFormFixSuggestions
    }
    
    console.log('🔧 报名表单调试工具已启用，使用 __REGISTRATION_FORM_DEBUG__ 访问')
  }
}