/**
 * Offline Form Handler
 * 
 * Provides utilities for handling form submissions in offline scenarios,
 * including local storage and sync when connectivity is restored.
 */

import { ref, computed, watch } from 'vue'
import { useOfflineManager, type OfflineIndicator } from './offlineManager'

export interface FormSubmissionOptions {
  formId: string
  formType: string
  submissionUrl: string
  method?: string
  onSuccess?: (data: any) => void
  onError?: (error: any) => void
  validateBeforeSubmit?: (data: any) => boolean | string
}

export interface OfflineFormState {
  isStored: boolean
  canSubmit: boolean
  indicator: OfflineIndicator
  pendingSubmission: boolean
}

/**
 * Composable for handling offline form submissions
 */
export function useOfflineForm(options: FormSubmissionOptions) {
  const { 
    isOffline, 
    isOnline, 
    storeFormData, 
    getStoredFormData, 
    removeStoredFormData,
    getOfflineIndicator 
  } = useOfflineManager()

  const formData = ref<Record<string, any>>({})
  const isSubmitting = ref(false)
  const hasStoredData = ref(false)
  const lastStoredTimestamp = ref<number | null>(null)

  // Check for existing stored data on initialization
  const checkStoredData = async () => {
    try {
      const stored = await getStoredFormData(options.formId)
      if (stored) {
        hasStoredData.value = true
        lastStoredTimestamp.value = stored.timestamp
        formData.value = stored.data
      }
    } catch (error) {
      console.error('Failed to check stored form data:', error)
    }
  }

  // Initialize stored data check
  checkStoredData()

  const formState = computed<OfflineFormState>(() => {
    const canSubmit = isOnline.value && !isSubmitting.value
    let indicator: OfflineIndicator

    if (isOffline.value) {
      if (hasStoredData.value) {
        indicator = {
          isVisible: true,
          message: 'Form data saved locally. Submit when connection is restored.',
          type: 'warning'
        }
      } else {
        indicator = getOfflineIndicator('form')
      }
    } else if (hasStoredData.value) {
      indicator = {
        isVisible: true,
        message: 'Connection restored! You can now submit your saved form.',
        type: 'success'
      }
    } else {
      indicator = {
        isVisible: false,
        message: '',
        type: 'info'
      }
    }

    return {
      isStored: hasStoredData.value,
      canSubmit,
      indicator,
      pendingSubmission: isSubmitting.value
    }
  })

  /**
   * Save form data (either for offline storage or immediate submission)
   */
  const saveFormData = async (data: Record<string, any>): Promise<OfflineIndicator> => {
    formData.value = data

    try {
      const indicator = await storeFormData(
        options.formId,
        options.formType,
        data,
        options.submissionUrl,
        options.method
      )

      hasStoredData.value = true
      lastStoredTimestamp.value = Date.now()

      return indicator
    } catch (error) {
      console.error('Failed to save form data:', error)
      return {
        isVisible: true,
        message: 'Failed to save form data.',
        type: 'error'
      }
    }
  }

  /**
   * Submit form data (online only)
   */
  const submitForm = async (data?: Record<string, any>): Promise<{ success: boolean; error?: string }> => {
    if (isOffline.value) {
      return {
        success: false,
        error: 'Cannot submit form while offline. Data has been saved locally.'
      }
    }

    const submitData = data || formData.value

    // Validate before submit if validator provided
    if (options.validateBeforeSubmit) {
      const validation = options.validateBeforeSubmit(submitData)
      if (validation !== true) {
        return {
          success: false,
          error: typeof validation === 'string' ? validation : 'Form validation failed'
        }
      }
    }

    isSubmitting.value = true

    try {
      const response = await fetch(options.submissionUrl, {
        method: options.method || 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submitData)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      // Clear stored data on successful submission
      if (hasStoredData.value) {
        await removeStoredFormData(options.formId)
        hasStoredData.value = false
        lastStoredTimestamp.value = null
      }

      options.onSuccess?.(result)

      return { success: true }
    } catch (error) {
      console.error('Form submission failed:', error)
      
      // Store data for later retry if not already stored
      if (!hasStoredData.value) {
        await saveFormData(submitData)
      }

      const errorMessage = error instanceof Error ? error.message : 'Form submission failed'
      options.onError?.(error)

      return {
        success: false,
        error: errorMessage
      }
    } finally {
      isSubmitting.value = false
    }
  }

  /**
   * Clear stored form data
   */
  const clearStoredData = async (): Promise<void> => {
    try {
      await removeStoredFormData(options.formId)
      hasStoredData.value = false
      lastStoredTimestamp.value = null
      formData.value = {}
    } catch (error) {
      console.error('Failed to clear stored form data:', error)
    }
  }

  /**
   * Get formatted timestamp for stored data
   */
  const getStoredDataTimestamp = computed(() => {
    if (!lastStoredTimestamp.value) return null
    
    const date = new Date(lastStoredTimestamp.value)
    return date.toLocaleString()
  })

  // Watch for connectivity changes to update stored data status
  watch(isOnline, async (online) => {
    if (online) {
      // Re-check stored data when coming back online
      await checkStoredData()
    }
  })

  return {
    // State
    formData,
    formState,
    isSubmitting,
    hasStoredData,
    getStoredDataTimestamp,

    // Actions
    saveFormData,
    submitForm,
    clearStoredData,
    checkStoredData,

    // Computed
    canSubmit: computed(() => formState.value.canSubmit),
    indicator: computed(() => formState.value.indicator),
    isStored: computed(() => formState.value.isStored)
  }
}

/**
 * Enhanced form submission that handles both online and offline scenarios
 */
export async function handleFormSubmission(
  data: Record<string, any>,
  options: FormSubmissionOptions
): Promise<{ success: boolean; error?: string; stored?: boolean }> {
  const { isOffline, storeFormData } = useOfflineManager()

  if (isOffline.value) {
    // Store for later submission
    try {
      await storeFormData(
        options.formId,
        options.formType,
        data,
        options.submissionUrl,
        options.method
      )

      return {
        success: true,
        stored: true
      }
    } catch (error) {
      return {
        success: false,
        error: 'Failed to store form data for offline submission',
        stored: false
      }
    }
  }

  // Online submission
  try {
    // Validate if validator provided
    if (options.validateBeforeSubmit) {
      const validation = options.validateBeforeSubmit(data)
      if (validation !== true) {
        return {
          success: false,
          error: typeof validation === 'string' ? validation : 'Form validation failed'
        }
      }
    }

    const response = await fetch(options.submissionUrl, {
      method: options.method || 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()
    options.onSuccess?.(result)

    return { success: true }
  } catch (error) {
    console.error('Form submission failed:', error)
    
    // Store for later retry on network error
    try {
      await storeFormData(
        options.formId,
        options.formType,
        data,
        options.submissionUrl,
        options.method
      )
    } catch (storeError) {
      console.error('Failed to store form data after submission failure:', storeError)
    }

    const errorMessage = error instanceof Error ? error.message : 'Form submission failed'
    options.onError?.(error)

    return {
      success: false,
      error: errorMessage,
      stored: true
    }
  }
}