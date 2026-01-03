/**
 * 安全的 Vue Query 包装器
 * 确保查询只在正确的 Vue 作用域中执行
 */

import { computed, getCurrentInstance, ref } from 'vue'
import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from '@tanstack/vue-query'
import { DEFAULT_REQUEST_TIMEOUT_MS, type TimeoutOptions, withTimeout } from '../utils/requestTimeout'
import { TIMEOUT_REFRESH_MESSAGE } from '../utils/errorHandler'

type SafeQueryOptions<TData, TError> = UseQueryOptions<TData, TError> & TimeoutOptions
type SafeMutationOptions<TData, TError, TVariables> = UseMutationOptions<TData, TError, TVariables> & TimeoutOptions

/**
 * 安全的 useQuery 包装器
 * 只在有效的 Vue 实例作用域中执行查询
 */
export function useSafeQuery<TData = unknown, TError = Error>(
  options: SafeQueryOptions<TData, TError>
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
  
  const { timeoutMs, timeoutMessage, queryFn, ...rest } = options
  const finalTimeoutMs = timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
  const finalTimeoutMessage = timeoutMessage ?? TIMEOUT_REFRESH_MESSAGE

  const wrappedQueryFn = queryFn
    ? (...args: any[]) =>
        withTimeout(() => (queryFn as (...params: any[]) => Promise<TData>)(...args), finalTimeoutMs, finalTimeoutMessage)
    : undefined

  return useQuery({
    ...rest,
    queryFn: wrappedQueryFn
  } as UseQueryOptions<TData, TError>)
}

/**
 * 安全的 useMutation 包装器
 */
export function useSafeMutation<TData = unknown, TError = Error, TVariables = void>(
  options: SafeMutationOptions<TData, TError, TVariables>
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
  
  const { timeoutMs, timeoutMessage, mutationFn, ...rest } = options
  const finalTimeoutMs = timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
  const finalTimeoutMessage = timeoutMessage ?? TIMEOUT_REFRESH_MESSAGE

  const wrappedMutationFn = mutationFn
    ? (variables: TVariables) =>
        withTimeout(
          () => (mutationFn as (payload: TVariables) => Promise<TData>)(variables),
          finalTimeoutMs,
          finalTimeoutMessage
        )
    : undefined

  return useMutation({
    ...rest,
    mutationFn: wrappedMutationFn
  } as UseMutationOptions<TData, TError, TVariables>)
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
  options: SafeQueryOptions<TData, TError>
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
