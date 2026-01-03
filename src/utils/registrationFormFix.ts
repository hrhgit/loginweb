/**
 * 报名表单显示问题修复工具
 */

import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/vue-query'
import { queryKeys } from '../lib/vueQuery'

export interface RegistrationFixResult {
  success: boolean
  message: string
  details?: any
}

/**
 * 修复报名表单缓存问题
 */
export function fixRegistrationFormCache(eventId: string, userId: string): RegistrationFixResult {
  try {
    const queryClient = useQueryClient()
    
    console.log('🔧 修复报名表单缓存问题...')
    
    // 清除相关缓存
    queryClient.invalidateQueries({
      queryKey: queryKeys.registrations.all
    })
    
    queryClient.invalidateQueries({
      queryKey: queryKeys.registrations.form(eventId, userId)
    })
    
    queryClient.invalidateQueries({
      queryKey: queryKeys.registrations.count(eventId)
    })
    
    // 清除用户相关缓存
    queryClient.invalidateQueries({
      queryKey: queryKeys.user.registrations(userId)
    })
    
    console.log('✅ 缓存已清除')
    
    return {
      success: true,
      message: '缓存已清除，请刷新页面查看最新数据'
    }
  } catch (error: any) {
    console.error('❌ 缓存清除失败:', error)
    return {
      success: false,
      message: `缓存清除失败: ${error.message}`
    }
  }
}

/**
 * 强制刷新报名表单数据
 */
export async function forceRefreshRegistrationData(eventId: string): Promise<RegistrationFixResult> {
  try {
    console.log('🔄 强制刷新报名表单数据...')
    
    // 直接查询最新数据
    const { data: registrations, error } = await supabase
      .from('registrations')
      .select('*, profiles(username, avatar_url)')
      .eq('event_id', eventId)
    
    if (error) {
      throw error
    }
    
    console.log('📊 查询结果:', {
      totalRegistrations: registrations?.length || 0,
      registrations: registrations?.map(reg => ({
        userId: reg.user_id,
        username: reg.profiles?.username,
        hasFormResponse: !!reg.form_response && Object.keys(reg.form_response || {}).length > 0,
        formResponseKeys: Object.keys(reg.form_response || {})
      }))
    })
    
    return {
      success: true,
      message: `成功获取 ${registrations?.length || 0} 条报名记录`,
      details: registrations
    }
  } catch (error: any) {
    console.error('❌ 数据刷新失败:', error)
    return {
      success: false,
      message: `数据刷新失败: ${error.message}`
    }
  }
}

/**
 * 检查并修复报名表单显示问题
 */
export async function diagnoseAndFixRegistrationForm(params: {
  eventId: string
  userId: string
  event: any
  registrationQuestions: any[]
  hasRegistrationForm: boolean
}): Promise<RegistrationFixResult> {
  const { eventId, userId, event, registrationQuestions, hasRegistrationForm } = params
  
  console.group('🔍 诊断报名表单问题')
  
  const issues: string[] = []
  const fixes: string[] = []
  
  // 1. 检查基本参数
  if (!eventId) {
    issues.push('❌ 活动ID缺失')
  }
  
  if (!userId) {
    issues.push('❌ 用户ID缺失')
  }
  
  if (!event) {
    issues.push('❌ 活动数据缺失')
  }
  
  if (registrationQuestions.length === 0) {
    issues.push('❌ 活动未配置报名表单')
    fixes.push('活动管理员需要在活动编辑页面配置报名表单')
  }
  
  // 2. 检查权限
  const isCreator = event?.created_by === userId
  if (!isCreator) {
    issues.push('❌ 权限不足：你不是活动创建者')
    fixes.push('请确认你是活动的创建者')
  }
  
  // 3. 检查报名记录
  try {
    const { data: registration, error } = await supabase
      .from('registrations')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle()
    
    if (error) {
      issues.push(`❌ 查询报名记录失败: ${error.message}`)
    } else if (!registration) {
      issues.push('❌ 未找到报名记录')
      fixes.push('请先报名此活动')
    } else {
      console.log('✅ 找到报名记录:', registration)
      
      const hasFormData = registration.form_response && 
        typeof registration.form_response === 'object' && 
        Object.keys(registration.form_response).length > 0
      
      if (!hasFormData) {
        issues.push('❌ 报名记录存在但表单数据为空')
        fixes.push('可能需要重新提交报名表单')
      } else {
        console.log('✅ 表单数据正常:', registration.form_response)
      }
    }
  } catch (error: any) {
    issues.push(`❌ 检查报名记录时出错: ${error.message}`)
  }
  
  // 4. 输出诊断结果
  console.log('📋 诊断结果:')
  if (issues.length > 0) {
    console.group('❌ 发现的问题:')
    issues.forEach(issue => console.log(issue))
    console.groupEnd()
  }
  
  if (fixes.length > 0) {
    console.group('💡 建议的修复方案:')
    fixes.forEach(fix => console.log(fix))
    console.groupEnd()
  }
  
  // 5. 尝试自动修复
  if (issues.length === 0 || (isCreator && hasRegistrationForm)) {
    console.log('🔧 尝试清除缓存修复显示问题...')
    const cacheResult = fixRegistrationFormCache(eventId, userId)
    fixes.push(cacheResult.message)
  }
  
  console.groupEnd()
  
  // 6. 在开发环境下提供调试工具
  if (import.meta.env.DEV) {
    // @ts-ignore
    window.__REGISTRATION_FORM_FIX__ = {
      diagnose: () => diagnoseAndFixRegistrationForm(params),
      clearCache: () => fixRegistrationFormCache(eventId, userId),
      refreshData: () => forceRefreshRegistrationData(eventId),
      checkRegistration: async () => {
        const { data } = await supabase
          .from('registrations')
          .select('*')
          .eq('event_id', eventId)
          .eq('user_id', userId)
          .maybeSingle()
        return data
      }
    }
    
    console.log('🔧 报名表单修复工具已启用，使用 __REGISTRATION_FORM_FIX__ 访问')
  }
  
  return {
    success: issues.length === 0,
    message: issues.length === 0 ? '诊断完成，未发现问题' : `发现 ${issues.length} 个问题`,
    details: { issues, fixes }
  }
}

/**
 * 创建浏览器控制台调试工具
 */
export function createRegistrationDebugTool() {
  // @ts-ignore
  window.__DEBUG_REGISTRATION_FORM__ = {
    async diagnose(eventId?: string, userId?: string) {
      // 尝试从当前页面获取参数
      if (!eventId) {
        const pathMatch = window.location.pathname.match(/\/events\/([^\/]+)/)
        eventId = pathMatch ? pathMatch[1] : null
      }
      
      if (!userId) {
        // @ts-ignore
        userId = window.__APP_STORE__?.user?.id
      }

      if (!eventId || !userId) {
        console.error('❌ 缺少必要参数:', { eventId, userId })
        console.log('💡 使用方法: __DEBUG_REGISTRATION_FORM__.diagnose("活动ID", "用户ID")')
        return
      }

      return await diagnoseAndFixRegistrationForm({
        eventId,
        userId,
        event: null, // 会在函数内部查询
        registrationQuestions: [],
        hasRegistrationForm: true
      })
    },

    clearCache(eventId?: string, userId?: string) {
      if (!eventId || !userId) {
        console.error('❌ 缺少必要参数')
        return
      }
      return fixRegistrationFormCache(eventId, userId)
    },

    async refreshData(eventId?: string) {
      if (!eventId) {
        const pathMatch = window.location.pathname.match(/\/events\/([^\/]+)/)
        eventId = pathMatch ? pathMatch[1] : null
      }
      
      if (!eventId) {
        console.error('❌ 缺少活动ID')
        return
      }
      
      return await forceRefreshRegistrationData(eventId)
    }
  }

  console.log('🔧 报名表单调试工具已加载')
  console.log('使用方法:')
  console.log('• __DEBUG_REGISTRATION_FORM__.diagnose() - 诊断问题')
  console.log('• __DEBUG_REGISTRATION_FORM__.clearCache() - 清除缓存')
  console.log('• __DEBUG_REGISTRATION_FORM__.refreshData() - 刷新数据')
}