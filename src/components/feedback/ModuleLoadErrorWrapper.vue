<template>
  <div class="module-load-error-wrapper">
    <!-- Show loading state while attempting to load -->
    <LoadingStateIndicator
      v-if="isLoading && !hasError"
      :visible="true"
      state="loading"
      :message="loadingMessage"
      :show-spinner="true"
      :show-network-quality="true"
      variant="overlay"
      size="large"
      :can-cancel="canCancel"
      :can-retry="canRetry"
      @cancel="handleCancel"
      @retry="handleRetry"
    />

    <!-- Show error page when loading fails -->
    <ModuleLoadErrorPage
      v-else-if="hasError"
      :error="loadError"
      :module-path="modulePath"
      :error-type="errorType"
      :max-retries="maxRetries"
      :show-details="showErrorDetails"
      :show-network-status="true"
      :show-timeout="hasTimedOut"
      @retry="handleRetry"
      @refresh="handleRefresh"
      @go-home="handleGoHome"
    />

    <!-- Render the actual component when loaded successfully -->
    <component 
      v-else-if="loadedComponent"
      :is="loadedComponent"
      v-bind="componentProps"
    />

    <!-- Fallback content -->
    <div v-else class="module-load-error-wrapper__fallback">
      <p>正在准备页面内容...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import ModuleLoadErrorPage from './ModuleLoadErrorPage.vue'
import LoadingStateIndicator from './LoadingStateIndicator.vue'
import { moduleLoader, type LoadError } from '../../utils/moduleLoader'
import { errorHandler } from '../../utils/errorHandler'
import { useAppStore } from '../../store/appStore'

interface Props {
  // Module loading configuration
  moduleFactory: () => Promise<any>
  modulePath?: string
  
  // Component configuration
  componentProps?: Record<string, any>
  
  // Loading configuration
  timeout?: number
  maxRetries?: number
  retryDelay?: number
  
  // UI configuration
  showErrorDetails?: boolean
  canCancel?: boolean
  canRetry?: boolean
  
  // Fallback configuration
  fallbackComponent?: any
  enableFallback?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  timeout: 30000, // 30 seconds
  maxRetries: 3,
  retryDelay: 1000,
  showErrorDetails: true,
  canCancel: false,
  canRetry: true,
  enableFallback: true
})

const emit = defineEmits<{
  loaded: [component: any]
  error: [error: Error | LoadError]
  retry: [attempt: number]
  cancel: []
  timeout: []
}>()

const router = useRouter()
const route = useRoute()
const store = useAppStore()

// Component state
const isLoading = ref(false)
const hasError = ref(false)
const hasTimedOut = ref(false)
const loadedComponent = ref<any>(null)
const loadError = ref<Error | LoadError | null>(null)
const retryCount = ref(0)
const timeoutTimer = ref<number>()
const loadStartTime = ref<number>(0)

// Computed properties
const errorType = computed(() => {
  if (!loadError.value) return undefined
  
  if ('type' in loadError.value) {
    return loadError.value.type
  }
  
  const message = loadError.value.message || ''
  if (message.includes('MIME') || message.includes('text/html')) {
    return 'MIME_ERROR'
  }
  if (message.includes('fetch') || message.includes('network')) {
    return 'NETWORK_ERROR'
  }
  if (message.includes('timeout') || message.includes('超时')) {
    return 'TIMEOUT_ERROR'
  }
  
  return 'UNKNOWN'
})

const loadingMessage = computed(() => {
  if (retryCount.value > 0) {
    return `正在重试加载页面... (${retryCount.value}/${props.maxRetries})`
  }
  return '正在加载页面组件...'
})

const canRetryComputed = computed(() => {
  return props.canRetry && retryCount.value < props.maxRetries
})

// Methods
const loadModule = async (): Promise<void> => {
  isLoading.value = true
  hasError.value = false
  hasTimedOut.value = false
  loadError.value = null
  loadStartTime.value = Date.now()

  // Set timeout timer
  if (props.timeout > 0) {
    timeoutTimer.value = window.setTimeout(() => {
      handleTimeout()
    }, props.timeout)
  }

  try {
    // Use the enhanced module loader
    const module = await props.moduleFactory()
    
    // Clear timeout
    if (timeoutTimer.value) {
      clearTimeout(timeoutTimer.value)
      timeoutTimer.value = undefined
    }

    // Set loaded component
    loadedComponent.value = module.default || module
    
    // Log successful load
    const loadTime = Date.now() - loadStartTime.value
    console.log(`Module loaded successfully in ${loadTime}ms:`, props.modulePath)
    
    emit('loaded', loadedComponent.value)
  } catch (error) {
    // Clear timeout
    if (timeoutTimer.value) {
      clearTimeout(timeoutTimer.value)
      timeoutTimer.value = undefined
    }

    handleLoadError(error as Error)
  } finally {
    isLoading.value = false
  }
}

const handleLoadError = (error: Error): void => {
  hasError.value = true
  loadError.value = error

  // Create LoadError if it's a regular Error
  if (!('type' in error)) {
    const loadErr: LoadError = {
      type: errorType.value as any || 'NETWORK_ERROR',
      originalError: error,
      path: props.modulePath || 'unknown',
      retryCount: retryCount.value
    }
    loadError.value = loadErr
  }

  // Log error
  errorHandler.handleError(error, {
    operation: 'loadModuleComponent',
    component: 'moduleLoadErrorWrapper',
    additionalData: {
      modulePath: props.modulePath,
      retryCount: retryCount.value,
      loadTime: Date.now() - loadStartTime.value
    }
  })

  emit('error', loadError.value)
}

const handleTimeout = (): void => {
  hasTimedOut.value = true
  const timeoutError = new Error(`Module loading timeout after ${props.timeout}ms`)
  handleLoadError(timeoutError)
  emit('timeout')
}

const handleRetry = async (): Promise<void> => {
  if (retryCount.value >= props.maxRetries) {
    return
  }

  retryCount.value++
  emit('retry', retryCount.value)

  // Add delay before retry
  if (props.retryDelay > 0) {
    await new Promise(resolve => setTimeout(resolve, props.retryDelay))
  }

  await loadModule()
}

const handleCancel = (): void => {
  // Clear timeout
  if (timeoutTimer.value) {
    clearTimeout(timeoutTimer.value)
    timeoutTimer.value = undefined
  }

  isLoading.value = false
  emit('cancel')
  
  // Navigate back or to home
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/events')
  }
}

const handleRefresh = (): void => {
  // Reset state and reload
  retryCount.value = 0
  loadedComponent.value = null
  loadModule()
}

const handleGoHome = (): void => {
  router.push('/events')
}

// Watchers
watch(() => props.moduleFactory, () => {
  // Reload when module factory changes
  retryCount.value = 0
  loadedComponent.value = null
  loadModule()
}, { immediate: false })

// Lifecycle
onMounted(() => {
  loadModule()
})

onUnmounted(() => {
  if (timeoutTimer.value) {
    clearTimeout(timeoutTimer.value)
  }
})
</script>

<style scoped>
.module-load-error-wrapper {
  min-height: 100vh;
  width: 100%;
}

.module-load-error-wrapper__fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  color: var(--muted);
  font-size: var(--text-base);
}
</style>
