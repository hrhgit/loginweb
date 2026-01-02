/**
 * 报名表单常见问题修复工具
 */

import { useQueryClient } from '@tanstack/vue-query'
import { queryKeys } from '../lib/vueQuery'

/**
 * 修复报名表单缓存问题
 */
export function fixRegistrationFormCache(eventId: string, userId: string) {
  const queryClient = useQueryClient()
  
  console.log('🔧 修复报名表单缓存问题...')
  
  // 清除相关缓存
  queryClient.invalidateQueries({
    queryKey: queryKeys.registrations.form(eventId, userId)
  })
  
  queryClient.invalidateQueries({
    queryKey: queryKeys.registrations.count(eventId)
  })
  
  queryClient.invalidateQueries({
    queryKey: queryKeys.events.detail(eventId)
  })
  
  if (userId) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.user.registrations(userId)
    })
  }
  
  console.log('✅ 缓存已清除，数据将重新获取')
}

/**
 * 强制刷新报名表单数据
 */
export function forceRefreshRegistrationForm(registrationDataQuery: any) {
  console.log('🔄 强制刷新报名表单数据...')
  
  if (registrationDataQuery?.refetchAll) {
    registrationDataQuery.refetchAll()
  } else {
    console.warn('⚠️ registrationDataQuery 不可用')
  }
}

/**
 * 检查并修复报名表单显示问题
 */
export function diagnoseAndFixRegistrationForm(params: {
  eventId: string
  userId: string
  event: any
  registrationQuestions: any[]
  registrationDataQuery: any
  hasRegistrationForm: boolean
}) {
  const { eventId, userId, event, registrationQuestions, registrationDataQuery, hasRegistrationForm } = params
  
  console.group('🔍 诊断报名表单问题')
  
  const issues: string[] = []
  const fixes: (() => void)[] = []
  
  // 检查基本条件
  if (!eventId) {
    issues.push('❌ 活动ID缺失')
  }
  
  if (!userId) {
    issues.push('❌ 用户ID缺失 - 用户需要登录')
  }
  
  if (!event) {
    issues.push('❌ 活动数据未加载')
    fixes.push(() => {
      console.log('🔧 尝试刷新活动数据...')
      // 这里可以添加刷新活动数据的逻辑
    })
  }
  
  if (registrationQuestions.length === 0) {
    issues.push('❌ 活动未配置报名表单')
  }
  
  if (!hasRegistrationForm) {
    issues.push('❌ hasRegistrationForm 为 false')
  }
  
  // 检查数据加载状态
  if (registrationDataQuery?.formLoading?.value) {
    issues.push('⏳ 表单数据正在加载中')
  }
  
  if (registrationDataQuery?.formError?.value) {
    issues.push(`❌ 表单数据加载失败: ${registrationDataQuery.formError.value.message}`)
    fixes.push(() => {
      console.log('🔧 尝试重新获取表单数据...')
      forceRefreshRegistrationForm(registrationDataQuery)
    })
  }
  
  // 检查缓存问题
  if (registrationQuestions.length > 0 && !registrationDataQuery?.formLoading?.value && !registrationDataQuery?.formError?.value) {
    issues.push('⚠️ 可能存在缓存问题')
    fixes.push(() => {
      console.log('🔧 清除缓存并重新获取数据...')
      fixRegistrationFormCache(eventId, userId)
    })
  }
  
  // 输出诊断结果
  if (issues.length > 0) {
    console.warn('🚨 发现以下问题:')
    issues.forEach(issue => console.warn(`  ${issue}`))
    
    if (fixes.length > 0) {
      console.log('🔧 尝试自动修复...')
      fixes.forEach(fix => fix())
    }
  } else {
    console.log('✅ 未发现明显问题')
  }
  
  console.groupEnd()
  
  return {
    issues,
    hasIssues: issues.length > 0,
    autoFixed: fixes.length > 0
  }
}

/**
 * 在开发环境下暴露修复工具到全局
 */
export function setupRegistrationFormFixTools() {
  if (import.meta.env.DEV) {
    ;(window as any).__REGISTRATION_FORM_FIX__ = {
      fixCache: fixRegistrationFormCache,
      forceRefresh: forceRefreshRegistrationForm,
      diagnoseAndFix: diagnoseAndFixRegistrationForm
    }
    
    console.log('🔧 报名表单修复工具已启用，使用 __REGISTRATION_FORM_FIX__ 访问')
  }
}