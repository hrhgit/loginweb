import { computed, watch, toValue, type MaybeRefOrGetter } from 'vue'
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
 * 获取活动的报名人数 - 使用数据库函数优化性能
 */
const fetchRegistrationCount = async (eventId: string): Promise<number> => {
  if (!eventId) return 0

  console.log('[useRegistrationForm] fetchRegistrationCount: Fetching count for event', { eventId })

  // 使用数据库函数获取报名人数，性能更优
  const { data, error } = await supabase
    .rpc('get_event_registration_count', { event_uuid: eventId })

  if (error) {
    console.error('[useRegistrationForm] fetchRegistrationCount: Database error', error)
    eventErrorHandler.handleError(error, { 
      operation: 'fetchRegistrationCount',
      additionalData: { eventId }
    })
    throw error
  }

  const count = data ?? 0
  console.log('[useRegistrationForm] fetchRegistrationCount: Count fetched', { eventId, count })

  return count
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
export function useRegistrationForm(eventId: MaybeRefOrGetter<string>, userId: MaybeRefOrGetter<string>) {
  const resolvedEventId = computed(() => toValue(eventId))
  const resolvedUserId = computed(() => toValue(userId))

  return useQuery({
    queryKey: computed(() => queryKeys.registrations.form(resolvedEventId.value, resolvedUserId.value)),
    queryFn: () => fetchRegistrationForm(resolvedEventId.value, resolvedUserId.value),
    enabled: computed(() => {
      const enabled = Boolean(resolvedEventId.value && resolvedUserId.value)
      console.log('[useRegistrationForm] Query enabled:', { 
        eventId: resolvedEventId.value, 
        userId: resolvedUserId.value, 
        enabled 
      })
      return enabled
    }),
    
    // 缓存策略 - 遵循项目规范
    staleTime: 1000 * 30,              // 30秒后数据过期
    gcTime: 1000 * 60 * 15,            // 15分钟后清理缓存
    
    // 重新获取策略
    refetchOnMount: false,             // 挂载时不自动重新获取
    refetchOnWindowFocus: false,       // 窗口焦点时不自动重新获取
    refetchOnReconnect: true,          // 网络重连时直接重新获取
    
    // 重试策略
    retry: (failureCount, error: any) => {
      const isNetworkError = error?.message?.includes('网络') || 
                            error?.message?.includes('fetch') ||
                            error?.code === 'NETWORK_ERROR'
      const shouldRetry = isNetworkError && failureCount < 3
      console.log('[useRegistrationForm] Retry decision:', { 
        failureCount, 
        isNetworkError, 
        shouldRetry,
        error: error?.message 
      })
      return shouldRetry
    },
    
    // 添加调试日志
    onSuccess: (data) => {
      console.log('[useRegistrationForm] Query success:', { 
        eventId: resolvedEventId.value, 
        userId: resolvedUserId.value, 
        dataKeys: Object.keys(data || {}),
        data 
      })
    },
    
    onError: (error) => {
      console.error('[useRegistrationForm] Query error:', { 
        eventId: resolvedEventId.value, 
        userId: resolvedUserId.value, 
        error: error?.message,
        fullError: error 
      })
    }
  })
}

/**
 * 使用报名人数的 Vue Query hook
 */
export function useRegistrationCount(eventId: MaybeRefOrGetter<string>) {
  const resolvedEventId = computed(() => toValue(eventId))

  return useQuery({
    queryKey: computed(() => queryKeys.registrations.count(resolvedEventId.value)),
    queryFn: () => fetchRegistrationCount(resolvedEventId.value),
    enabled: computed(() => Boolean(resolvedEventId.value)),
    
    // 缓存策略
    staleTime: 1000 * 30,              // 30秒后数据过期
    gcTime: 1000 * 60 * 15,            // 15分钟后清理缓存
    
    // 重新获取策略
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    
    // 重试策略
    retry: (failureCount, error: any) => {
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
    onSuccess: () => {
      // 清除相关缓存 - 需要清除特定的表单缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.registrations.all
      })
      
      // 也清除用户注册缓存，确保数据同步
      if (store.user?.id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.user.registrations(store.user.id)
        })
      }
      
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
export function useRegistrationData(eventId: MaybeRefOrGetter<string>, userId: MaybeRefOrGetter<string>) {
  const formQuery = useRegistrationForm(eventId, userId)
  const countQuery = useRegistrationCount(eventId)
  const resolvedEventId = computed(() => toValue(eventId))
  const resolvedUserId = computed(() => toValue(userId))
  
  // 添加调试日志
  const debugInfo = computed(() => ({
    eventId: resolvedEventId.value,
    userId: resolvedUserId.value,
    formEnabled: Boolean(resolvedEventId.value && resolvedUserId.value),
    formLoading: formQuery.isLoading.value,
    formError: formQuery.error.value?.message,
    formData: formQuery.data.value,
    countLoading: countQuery.isLoading.value,
    countError: countQuery.error.value?.message,
    countData: countQuery.data.value
  }))
  
  // 在开发环境下输出调试信息
  if (import.meta.env.DEV) {
    watch(debugInfo, (info) => {
      console.log('[useRegistrationData] State update:', info)
    }, { deep: true, immediate: true })
  }
  
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
      console.log('[useRegistrationData] Refetching all data:', { 
        eventId: resolvedEventId.value, 
        userId: resolvedUserId.value 
      })
      formQuery.refetch()
      countQuery.refetch()
    },
    
    // 调试信息（仅开发环境）
    ...(import.meta.env.DEV ? { debugInfo } : {})
  }
}
