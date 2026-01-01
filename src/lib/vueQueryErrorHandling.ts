/**
 * Vue Query Error Handling Integration
 * 
 * Integrates Vue Query with the existing error handling system
 */

import { 
  enhancedErrorHandler,
  authErrorHandler,
  apiErrorHandler,
  eventErrorHandler,
  teamErrorHandler,
  profileErrorHandler
} from '../store/enhancedErrorHandling'

// Re-export error handlers for use in Vue Query composables
export {
  enhancedErrorHandler,
  authErrorHandler,
  apiErrorHandler,
  eventErrorHandler,
  teamErrorHandler,
  profileErrorHandler
}

// Vue Query specific error handling utilities
export function handleVueQueryError(error: any, context: { operation: string; queryKey?: readonly unknown[] }) {
  // Determine which error handler to use based on query key
  const queryKeyString = context.queryKey?.join('-') || ''
  
  if (queryKeyString.includes('auth') || queryKeyString.includes('user')) {
    authErrorHandler.handleError(error, context)
  } else if (queryKeyString.includes('team')) {
    teamErrorHandler.handleError(error, context)
  } else if (queryKeyString.includes('event')) {
    eventErrorHandler.handleError(error, context)
  } else if (queryKeyString.includes('profile')) {
    profileErrorHandler.handleError(error, context)
  } else {
    apiErrorHandler.handleError(error, context)
  }
}

// Network error detection for Vue Query retry logic
export function isNetworkError(error: any): boolean {
  return error?.message?.includes('网络') || 
         error?.message?.includes('fetch') ||
         error?.code === 'NETWORK_ERROR' ||
         error?.name === 'NetworkError'
}

// Retry configuration for Vue Query
export const vueQueryRetryConfig = {
  retry: (failureCount: number, error: any) => {
    return isNetworkError(error) && failureCount < 3
  },
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 10000),
}