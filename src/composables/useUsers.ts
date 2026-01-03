/**
 * 用户数据管理 - 使用 Vue Query
 * 提供用户资料、联系方式、注册状态的智能缓存和状态管理
 */

import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useSafeMutation as useMutation, useSafeQuery as useQuery } from './useSafeQuery'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/vueQuery'
import { useAppStore } from '../store/appStore'
import { 
  authErrorHandler, 
  profileErrorHandler,
  handleSuccessWithBanner 
} from '../store/enhancedErrorHandling'
import type { Profile, UserContacts } from '../store/models'
import { generateAvatarUrl } from '../utils/imageUrlGenerator'

// 注册记录类型
type RegistrationRow = {
  id: string
  event_id: string
  status: string | null
}

type Registration = {
  id: string
  eventId: string
  status: string | null
}

// 用户资料获取函数
const fetchProfile = async (userId: string): Promise<Profile | null> => {
  console.log('[useUsers] fetchProfile called with userId:', userId)
  
  if (!userId) {
    console.log('[useUsers] fetchProfile: No userId provided, returning null')
    return null
  }

  // 检查用户会话是否有效
  const { data: sessionData } = await supabase.auth.getSession()
  console.log('[useUsers] fetchProfile: Session check result:', !!sessionData.session)
  
  if (!sessionData.session) {
    console.warn('[useUsers] fetchProfile: No valid session found when loading profile')
    return null
  }

  console.log('[useUsers] fetchProfile: Fetching profile from database...')
  const { data, error } = await supabase
    .from('profiles')
    .select('id,username,avatar_url,roles')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('[useUsers] fetchProfile: Database error:', error)
    profileErrorHandler.handleError(error, { operation: 'fetchProfile' })
    throw error
  }

  console.log('[useUsers] fetchProfile: Profile fetched successfully:', !!data)

  // 从会话中获取邮箱信息
  const email = sessionData.session.user?.email || null

  return data ? { ...data, email } as Profile : null
}

// 用户联系方式获取函数
const fetchContacts = async (userId: string): Promise<UserContacts | null> => {
  if (!userId) return null

  const { data, error } = await supabase
    .from('user_contacts')
    .select('user_id,phone,qq,updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    profileErrorHandler.handleError(error, { operation: 'fetchContacts' })
    throw error
  }

  return data as UserContacts | null
}

// 用户注册记录获取函数
const fetchRegistrations = async (userId: string): Promise<Registration[]> => {
  if (!userId) return []

  const { data, error } = await supabase
    .from('registrations')
    .select('id,event_id,status')
    .eq('user_id', userId)
    .limit(500)

  if (error) {
    authErrorHandler.handleError(error, { operation: 'fetchRegistrations' })
    throw error
  }

  return (data as RegistrationRow[]).map(row => ({
    id: row.id,
    eventId: row.event_id,
    status: row.status,
  }))
}

// 头像上传辅助函数
const dataURLtoBlob = (dataurl: string): Blob | null => {
  const arr = dataurl.split(',')
  if (arr.length < 2) return null
  const mimeMatch = arr[0].match(/:(.*?);/)
  if (!mimeMatch) return null
  const mime = mimeMatch[1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}

// Vue Query Hooks

/**
 * 获取用户资料
 */
export function useProfile(userId: MaybeRefOrGetter<string>) {
  const resolvedUserId = computed(() => toValue(userId))

  return useQuery({
    queryKey: computed(() => queryKeys.user.profile(resolvedUserId.value)),
    queryFn: () => fetchProfile(resolvedUserId.value),
    enabled: computed(() => Boolean(resolvedUserId.value)),
    staleTime: 1000 * 60 * 5, // 5分钟内数据保持新鲜（用户资料变化较少）
    gcTime: 1000 * 60 * 30, // 30分钟后从内存中清除
    refetchOnMount: false, // 挂载时不自动重新获取（除非缓存不存在）
    refetchOnWindowFocus: false, // 窗口焦点时不自动重新获取
    refetchOnReconnect: true, // 网络重连时重新获取
    retry: (failureCount, error: any) => {
      // 网络错误重试，其他错误不重试
      const isNetworkError = error?.message?.includes('网络') || 
                            error?.message?.includes('fetch') ||
                            error?.message?.includes('timeout') ||
                            error?.message?.includes('??') ||
                            error?.code === 'NETWORK_ERROR'
      return isNetworkError && failureCount < 3
    },
  })
}

/**
 * 获取用户联系方式
 */
export function useContacts(userId: MaybeRefOrGetter<string>) {
  const resolvedUserId = computed(() => toValue(userId))

  return useQuery({
    queryKey: computed(() => queryKeys.user.contacts(resolvedUserId.value)),
    queryFn: () => fetchContacts(resolvedUserId.value),
    enabled: computed(() => Boolean(resolvedUserId.value)),
    staleTime: 1000 * 60 * 5, // 5分钟内数据保持新鲜
    gcTime: 1000 * 60 * 30, // 30分钟后从内存中清除
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: (failureCount, error: any) => {
      const isNetworkError = error?.message?.includes('网络') || 
                            error?.message?.includes('fetch') ||
                            error?.message?.includes('timeout') ||
                            error?.message?.includes('??') ||
                            error?.code === 'NETWORK_ERROR'
      return isNetworkError && failureCount < 3
    },
  })
}

/**
 * 获取用户注册记录
 */
export function useRegistrations(userId: MaybeRefOrGetter<string>) {
  const resolvedUserId = computed(() => toValue(userId))

  return useQuery({
    queryKey: computed(() => queryKeys.user.registrations(resolvedUserId.value)),
    queryFn: () => fetchRegistrations(resolvedUserId.value),
    enabled: computed(() => Boolean(resolvedUserId.value)),
    staleTime: 1000 * 30, // 30秒内数据保持新鲜（注册状态可能变化）
    gcTime: 1000 * 60 * 15, // 15分钟后从内存中清除
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: (failureCount, error: any) => {
      const isNetworkError = error?.message?.includes('网络') || 
                            error?.message?.includes('fetch') ||
                            error?.message?.includes('timeout') ||
                            error?.message?.includes('??') ||
                            error?.code === 'NETWORK_ERROR'
      return isNetworkError && failureCount < 3
    },
  })
}

/**
 * 更新用户资料
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient()
  const store = useAppStore()

  return useMutation({
    mutationFn: async (payload: {
      userId: string
      profileData: Partial<Pick<Profile, 'username' | 'avatar_url' | 'roles'>>
    }) => {
      if (!store.user) throw new Error('请先登录')

      const nextPayload = { ...payload.profileData }

      // 处理头像上传（如果是 data URL）
      if (nextPayload.avatar_url && nextPayload.avatar_url.startsWith('data:image')) {
        const blob = dataURLtoBlob(nextPayload.avatar_url)
        if (!blob) {
          throw new Error('无效的头像图片格式')
        }

        const filePath = `${payload.userId}/avatar-${Date.now()}.jpg`
        
        // 并行操作：上传和获取URL
        const uploadPromise = supabase.storage.from('avatars').upload(filePath, blob, {
          cacheControl: '3600',
          upsert: true,
        })
        
        // Generate avatar URL using centralized utility
        const avatarUrl = generateAvatarUrl(filePath)
        const { error: uploadError } = await uploadPromise

        if (uploadError) {
          throw uploadError
        }

        nextPayload.avatar_url = avatarUrl
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(nextPayload)
        .eq('id', payload.userId)
        .select('id,username,avatar_url,roles')
        .maybeSingle()

      if (error) {
        profileErrorHandler.handleError(error, { operation: 'updateProfile' })
        throw error
      }

      return data as Profile | null
    },
    onSuccess: (_, variables) => {
      // 更新缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.user.profile(variables.userId)
      })
      
      handleSuccessWithBanner('个人资料更新成功', store.setBanner, {
        operation: 'updateProfile',
        component: 'profile'
      })
    },
    onError: (error: any) => {
      store.setBanner('error', error.message || '更新个人资料失败')
    },
  })
}

/**
 * 更新用户联系方式
 */
export function useUpdateContacts() {
  const queryClient = useQueryClient()
  const store = useAppStore()

  return useMutation({
    mutationFn: async (payload: {
      userId: string
      contactsData: Partial<Pick<UserContacts, 'phone' | 'qq'>>
    }) => {
      if (!store.user) throw new Error('请先登录')

      const { data, error } = await supabase
        .from('user_contacts')
        .upsert(
          {
            user_id: payload.userId,
            phone: payload.contactsData.phone ?? null,
            qq: payload.contactsData.qq ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .select('user_id,phone,qq,updated_at')
        .maybeSingle()

      if (error) {
        profileErrorHandler.handleError(error, { operation: 'updateContacts' })
        throw error
      }

      return data as UserContacts | null
    },
    onSuccess: (_, variables) => {
      // 更新缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.user.contacts(variables.userId)
      })
      
      handleSuccessWithBanner('联系方式更新成功', store.setBanner, {
        operation: 'updateContacts',
        component: 'profile'
      })
    },
    onError: (error: any) => {
      store.setBanner('error', error.message || '更新联系方式失败')
    },
  })
}

/**
 * 活动报名
 */
export function useRegisterForEvent() {
  const queryClient = useQueryClient()
  const store = useAppStore()

  return useMutation({
    mutationFn: async (payload: {
      userId: string
      eventId: string
      formResponse?: Record<string, string | string[]>
    }) => {
      if (!store.user) throw new Error('请先登录')

      // Check if user is already registered first
      const { data: existingRegistration } = await supabase
        .from('registrations')
        .select('id,event_id,status,created_at')
        .eq('event_id', payload.eventId)
        .eq('user_id', payload.userId)
        .maybeSingle()

      if (existingRegistration) {
        // User is already registered, return existing registration
        return {
          id: existingRegistration.id,
          eventId: existingRegistration.event_id,
          status: existingRegistration.status,
          isNewRegistration: false,
        } as Registration & { isNewRegistration: boolean }
      }

      // Use upsert to handle race conditions gracefully
      const { data, error } = await supabase
        .from('registrations')
        .upsert({
          user_id: payload.userId,
          event_id: payload.eventId,
          status: 'registered',
          form_response: payload.formResponse || {},
        }, {
          onConflict: 'user_id,event_id',
          ignoreDuplicates: false
        })
        .select('id,event_id,status,created_at')
        .single()

      if (error) {
        authErrorHandler.handleError(error, { operation: 'registerForEvent' })
        throw error
      }

      // Check if this was a new registration (created recently) or existing one
      const isNewRegistration = new Date(data.created_at).getTime() > (Date.now() - 5000) // Within last 5 seconds

      return {
        id: data.id,
        eventId: data.event_id,
        status: data.status,
        isNewRegistration,
      } as Registration & { isNewRegistration: boolean }
    },
    onSuccess: (data, variables) => {
      // 更新注册记录缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.user.registrations(variables.userId)
      })
      
      // 可能需要更新活动详情缓存（如果显示注册人数）
      queryClient.invalidateQueries({
        queryKey: queryKeys.events.detail(variables.eventId)
      })
      
      // Show appropriate message based on whether this was a new registration
      if (data.isNewRegistration) {
        handleSuccessWithBanner('报名成功！', store.setBanner, {
          operation: 'registerForEvent',
          component: 'event'
        })
      } else {
        handleSuccessWithBanner('你已报名该活动', store.setBanner, {
          operation: 'registerForEvent',
          component: 'validation'
        })
      }
    },
    onError: (error: any) => {
      store.setBanner('error', error.message || '报名失败')
    },
  })
}

// 便捷的组合函数

/**
 * 获取当前用户的完整数据
 */
export function useCurrentUserData() {
  const store = useAppStore()
  const userId = computed(() => store.user?.id || '')
  
  const profile = useProfile(userId)
  const contacts = useContacts(userId)
  const registrations = useRegistrations(userId)

  return {
    profile,
    contacts,
    registrations,
    isLoading: computed(() => 
      profile.isLoading.value || 
      contacts.isLoading.value || 
      registrations.isLoading.value
    ),
    error: computed(() => 
      profile.error.value || 
      contacts.error.value || 
      registrations.error.value
    ),
    refetch: () => {
      profile.refetch()
      contacts.refetch()
      registrations.refetch()
    },
  }
}

/**
 * 获取用户基本信息（资料 + 联系方式）
 */
export function useUserInfo(userId: MaybeRefOrGetter<string>) {
  const profile = useProfile(userId)
  const contacts = useContacts(userId)

  return {
    profile,
    contacts,
    isLoading: computed(() => profile.isLoading.value || contacts.isLoading.value),
    error: computed(() => profile.error.value || contacts.error.value),
    refetch: () => {
      profile.refetch()
      contacts.refetch()
    },
  }
}
