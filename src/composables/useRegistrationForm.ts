import { computed } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/vueQuery'
import { 
  handleSuccessWithBanner,
  eventErrorHandler 
} from '../store/enhancedErrorHandling'
import { useAppStore } from '../store/appStore'

// 报名表响应数据类型
export type RegistrationFormResponse = Record<string, string | string[]>

// 报名记录类型
export type RegistrationRecord = {
  id: string
  event_id: string
  user_id: string
  form_response: RegistrationFormResponse
  status: string
  created_at: string
}

/**
 * 获取用户在特定活动的报名表数据
 */
const fetchRegistrationForm = async (eventId: string, userId: string): Promise<RegistrationFormResponse> => {
  if (!eventId || !userId) {
    console.log('[useRegistrationForm] fetchRegistrationForm: Missing parameters', { eventId, userId })
    return {}
  }

  console.log('[useRegistrationForm] fetchRegistrationForm: Fetching form data', { eventId, userId })

  const { data, error } = await supabase
    .from('registrations')
    .select('form_response')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[useRegistrationForm] fetchRegistrationForm: Database error', error)
    eventErrorHandler.handleError(error, { 
      operation: 'fetchRegistrationForm',
      additionalData: { eventId, userId }
    })
    throw error
  }

  console.log('[useRegistrationForm] fetchRegistrationForm: Form data fetched', { 
    hasData: !!data, 
    hasFormResponse: !!data?.form_response,
    formResponseKeys: data?.form_response ? Object.keys(data.form_response) : []
  })

  return (data?.form_response ?? {}) as RegistrationFormResponse
}

/**
 * 获取活动的报名人数
 */
const fetchRegistrationCount = async (eventId: string): Promise<number> => {
  if (!eventId) return 0

  const { count, error } = await supabase
    .from('registrations')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)

  if (error) {
    eventErrorHandler.handleError(error, { 
      operation: 'fetchRegistrationCount',
      additionalData: { eventId }
    })
    throw error
  }

  return count ?? 0
}

/**
 * 更新报名表数据
 */
const updateRegistrationForm = async (params: {
  registrationId: string
  formResponse: RegistrationFormResponse
}): Promise<void> => {
  const { registrationId, formResponse } = params

  const { error } = await supabase
    .from('registrations')
    .update({ form_response: formResponse })
    .eq('id', registrationId)
    .select('id')
    .single()

  if (error) {
    eventErrorHandler.handleError(error, { 
      operation: 'updateRegistrationForm',
      additionalData: { registrationId }
    })
    throw error
  }
}

/**
 * 使用报名表数据的 Vue Query hook
 */
export function useRegistrationForm(eventId: string, userId: string) {
  return useQuery({
    queryKey: queryKeys.registrations.form(eventId, userId),
    queryFn: () => fetchRegistrationForm(eventId, userId),
    enabled: computed(() => Boolean(eventId && userId)),
    
    // 缓存策略 - 遵循项目规范
    staleTime: 1000 * 30,              // 30秒后数据过期
    gcTime: 1000 * 60 * 15,            // 15分钟后清理缓存
    
    // 重新获取策略
    refetchOnMount: false,             // 挂载时不自动重新获取
    refetchOnWindowFocus: false,       // 窗口焦点时不自动重新获取
    refetchOnReconnect: true,          // 网络重连时直接重新获取
    
    // 重试策略
    retry: (failureCount, error) => {
      const isNetworkError = error?.message?.includes('网络') || 
                            error?.message?.includes('fetch') ||
                            error?.code === 'NETWORK_ERROR'
      return isNetworkError && failureCount < 3
    },
  })
}

/**
 * 使用报名人数的 Vue Query hook
 */
export function useRegistrationCount(eventId: string) {
  return useQuery({
    queryKey: queryKeys.registrations.count(eventId),
    queryFn: () => fetchRegistrationCount(eventId),
    enabled: computed(() => Boolean(eventId)),
    
    // 缓存策略
    staleTime: 1000 * 30,              // 30秒后数据过期
    gcTime: 1000 * 60 * 15,            // 15分钟后清理缓存
    
    // 重新获取策略
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    
    // 重试策略
    retry: (failureCount, error) => {
      const isNetworkError = error?.message?.includes('网络') || 
                            error?.message?.includes('fetch') ||
                            error?.code === 'NETWORK_ERROR'
      return isNetworkError && failureCount < 3
    },
  })
}

/**
 * 更新报名表数据的 mutation hook
 */
export function useUpdateRegistrationForm() {
  const queryClient = useQueryClient()
  const store = useAppStore()

  return useMutation({
    mutationFn: updateRegistrationForm,
    onSuccess: (_, variables) => {
      // 清除相关缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.registrations.all
      })
      
      // 显示成功消息
      handleSuccessWithBanner('报名表单已更新', store.setBanner, { 
        operation: 'updateRegistrationForm',
        component: 'form' 
      })
    },
    onError: (error) => {
      eventErrorHandler.handleError(error, { 
        operation: 'updateRegistrationForm'
      })
    }
  })
}

/**
 * 组合函数：获取用户的报名表数据和报名人数
 */
export function useRegistrationData(eventId: string, userId: string) {
  const formQuery = useRegistrationForm(eventId, userId)
  const countQuery = useRegistrationCount(eventId)
  
  return {
    // 报名表数据
    formData: formQuery.data,
    formLoading: formQuery.isLoading,
    formError: formQuery.error,
    refetchForm: formQuery.refetch,
    
    // 报名人数
    registrationCount: countQuery.data,
    countLoading: countQuery.isLoading,
    countError: countQuery.error,
    refetchCount: countQuery.refetch,
    
    // 整体状态
    isLoading: computed(() => formQuery.isLoading.value || countQuery.isLoading.value),
    error: computed(() => formQuery.error.value || countQuery.error.value),
    
    // 刷新所有数据
    refetchAll: () => {
      formQuery.refetch()
      countQuery.refetch()
    }
  }
}