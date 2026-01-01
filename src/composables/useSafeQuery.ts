/**
 * 安全的 Vue Query 包装器
 * 确保查询只在正确的 Vue 作用域中执行
 */

import { computed, getCurrentInstance, ref } from 'vue'
import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from '@tanstack/vue-query'

/**
 * 安全的 useQuery 包装器
 * 只在有效的 Vue 实例作用域中执行查询
 */
export function useSafeQuery<TData = unknown, TError = Error>(
  options: UseQueryOptions<TData, TError>
) {
  const instance = getCurrentInstance()
  
  if (!instance) {
    console.warn('[useSafeQuery] Called outside of Vue component setup, returning mock query')
    return {
      data: ref(null),
      isLoading: ref(false),
      error: ref(null),
      refetch: () => Promise.resolve(),
      isSuccess: ref(false),
      isError: ref(false),
      isPending: ref(false),
    }
  }
  
  return useQuery(options)
}

/**
 * 安全的 useMutation 包装器
 */
export function useSafeMutation<TData = unknown, TError = Error, TVariables = void>(
  options: UseMutationOptions<TData, TError, TVariables>
) {
  const instance = getCurrentInstance()
  
  if (!instance) {
    console.warn('[useSafeMutation] Called outside of Vue component setup, returning mock mutation')
    return {
      mutate: () => {},
      mutateAsync: () => Promise.reject(new Error('Called outside Vue scope')),
      isPending: ref(false),
      isError: ref(false),
      isSuccess: ref(false),
      error: ref(null),
      data: ref(null),
    }
  }
  
  return useMutation(options)
}

/**
 * 安全的 useQueryClient 包装器
 */
export function useSafeQueryClient() {
  const instance = getCurrentInstance()
  
  if (!instance) {
    console.warn('[useSafeQueryClient] Called outside of Vue component setup, returning mock client')
    return {
      invalidateQueries: () => Promise.resolve(),
      setQueryData: () => {},
      getQueryData: () => null,
      removeQueries: () => {},
      clear: () => {},
    }
  }
  
  return useQueryClient()
}

/**
 * 条件性查询包装器
 * 当条件不满足时返回空的查询对象
 */
export function useConditionalQuery<TData = unknown, TError = Error>(
  condition: () => boolean,
  options: UseQueryOptions<TData, TError>
) {
  const shouldExecute = computed(condition)
  
  if (!shouldExecute.value) {
    return {
      data: ref(null),
      isLoading: ref(false),
      error: ref(null),
      refetch: () => Promise.resolve(),
      isSuccess: ref(false),
      isError: ref(false),
      isPending: ref(false),
    }
  }
  
  return useSafeQuery({
    ...options,
    enabled: computed(() => {
      const optionsAny = options as any
      const baseEnabled = typeof optionsAny.enabled === 'function' 
        ? optionsAny.enabled() 
        : optionsAny.enabled?.value ?? optionsAny.enabled ?? true
      return shouldExecute.value && baseEnabled
    }),
  })
}