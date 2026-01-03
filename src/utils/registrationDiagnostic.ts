/**
 * 报名表单显示问题诊断工具
 */

import { supabase } from '../lib/supabase'

export interface DiagnosticResult {
  hasPermission: boolean
  hasRegistration: boolean
  hasFormData: boolean
  registrationData: any
  eventData: any
  issues: string[]
  suggestions: string[]
}

export async function diagnoseRegistrationIssue(
  eventId: string, 
  userId: string
): Promise<DiagnosticResult> {
  const result: DiagnosticResult = {
    hasPermission: false,
    hasRegistration: false,
    hasFormData: false,
    registrationData: null,
    eventData: null,
    issues: [],
    suggestions: []
  }

  try {
    // 1. 检查活动信息
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('id, title, created_by, status, description')
      .eq('id', eventId)
      .single()

    if (eventError) {
      result.issues.push(`活动查询失败: ${eventError.message}`)
      return result
    }

    result.eventData = eventData

    // 2. 检查权限
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    // 检查是否是活动创建者或管理员
    result.hasPermission = eventData.created_by === userId
    
    if (!result.hasPermission) {
      result.issues.push('权限不足：你不是此活动的创建者')
      result.suggestions.push('请确认你是活动的创建者，或联系管理员')
      return result
    }

    // 3. 检查报名记录
    const { data: registrationData, error: regError } = await supabase
      .from('registrations')
      .select('id, user_id, event_id, form_response, status, created_at')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle()

    if (regError) {
      result.issues.push(`报名记录查询失败: ${regError.message}`)
      return result
    }

    result.hasRegistration = !!registrationData
    result.registrationData = registrationData

    if (!result.hasRegistration) {
      result.issues.push('未找到报名记录：你可能没有成功报名此活动')
      result.suggestions.push('请先报名此活动')
      return result
    }

    // 4. 检查表单数据
    const formResponse = registrationData.form_response
    result.hasFormData = !!(formResponse && 
      typeof formResponse === 'object' && 
      Object.keys(formResponse).length > 0)

    if (!result.hasFormData) {
      result.issues.push('报名记录存在但表单数据为空')
      result.suggestions.push('可能原因：')
      result.suggestions.push('1. 报名时活动还没有设置报名表单')
      result.suggestions.push('2. 报名表单数据保存失败')
      result.suggestions.push('3. 需要重新提交报名表单')
    }

    // 5. 检查活动是否有报名表单配置
    let hasEventForm = false
    try {
      const description = eventData.description
      if (description) {
        const parsed = typeof description === 'string' ? JSON.parse(description) : description
        const questions = parsed?.details?.registrationForm || []
        hasEventForm = Array.isArray(questions) && questions.length > 0
        
        if (!hasEventForm) {
          result.issues.push('活动未配置报名表单')
          result.suggestions.push('请在活动编辑页面配置报名表单')
        }
      }
    } catch (e) {
      result.issues.push('活动描述解析失败')
    }

    // 6. 生成最终建议
    if (result.hasPermission && result.hasRegistration && result.hasFormData) {
      result.suggestions.push('数据看起来正常，可能是前端显示问题')
      result.suggestions.push('尝试刷新页面或清除缓存')
    }

  } catch (error: any) {
    result.issues.push(`诊断过程出错: ${error.message}`)
  }

  return result
}

/**
 * 在浏览器控制台中使用的诊断函数
 */
export function createDiagnosticTool() {
  // @ts-ignore
  window.__DIAGNOSE_REGISTRATION__ = async (eventId?: string, userId?: string) => {
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
      console.log('💡 使用方法: __DIAGNOSE_REGISTRATION__("活动ID", "用户ID")')
      return
    }

    console.group('🔍 报名表单显示问题诊断')
    console.log('📋 诊断参数:', { eventId, userId })

    try {
      const result = await diagnoseRegistrationIssue(eventId, userId)
      
      console.log('✅ 权限检查:', result.hasPermission ? '通过' : '失败')
      console.log('📝 报名记录:', result.hasRegistration ? '存在' : '不存在')
      console.log('📄 表单数据:', result.hasFormData ? '有数据' : '无数据')
      
      if (result.registrationData) {
        console.log('📊 报名详情:', result.registrationData)
      }
      
      if (result.issues.length > 0) {
        console.group('❌ 发现的问题:')
        result.issues.forEach(issue => console.log(`• ${issue}`))
        console.groupEnd()
      }
      
      if (result.suggestions.length > 0) {
        console.group('💡 建议解决方案:')
        result.suggestions.forEach(suggestion => console.log(`• ${suggestion}`))
        console.groupEnd()
      }
      
      return result
      
    } catch (error) {
      console.error('❌ 诊断失败:', error)
    } finally {
      console.groupEnd()
    }
  }

  console.log('🔧 诊断工具已加载，使用方法: __DIAGNOSE_REGISTRATION__()')
}