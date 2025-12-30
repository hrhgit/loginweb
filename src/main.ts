import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { vLazyLoad } from './directives/vLazyLoad'
import { setupGlobalErrorHandling, logGlobalError } from './utils/globalErrorHandler'
import { ErrorType, MessageSeverity } from './utils/errorHandler'
import './style.css'

const app = createApp(App)

// 设置全局错误处理
setupGlobalErrorHandling()

// 设置Vue应用错误处理
app.config.errorHandler = (error: unknown, instance: any, info: string) => {
  const errorObj = error instanceof Error ? error : new Error(String(error))
  logGlobalError(
    errorObj,
    {
      operation: 'vue_error',
      component: instance?.$options?.name || instance?.__name || 'unknown',
      additionalData: {
        info,
        componentName: instance?.$options?.name || instance?.__name,
        route: instance?.$route?.path || window.location.pathname
      }
    },
    ErrorType.CLIENT,
    MessageSeverity.FATAL
  )
  
  console.error('Vue error caught:', error, info)
}

// 设置Vue警告处理
app.config.warnHandler = (msg: string, instance: any, trace: string) => {
  logGlobalError(
    new Error(`Vue warning: ${msg}`),
    {
      operation: 'vue_warning',
      component: instance?.$options?.name || instance?.__name || 'unknown',
      additionalData: {
        message: msg,
        trace,
        componentName: instance?.$options?.name || instance?.__name,
        route: instance?.$route?.path || window.location.pathname
      }
    },
    ErrorType.CLIENT,
    MessageSeverity.WARNING
  )
  
  console.warn('Vue warning caught:', msg, trace)
}

app.directive('lazy-load', vLazyLoad)
app.use(router).mount('#app')
