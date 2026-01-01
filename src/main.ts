import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { vLazyLoad } from './directives/vLazyLoad'
import { setupGlobalErrorHandling, logGlobalError } from './utils/globalErrorHandler'
import { ErrorType, MessageSeverity } from './utils/errorHandler'
import { offlineManager } from './utils/offlineManager'
import { setupVueQuery } from './lib/vueQuery'
import { startCacheMonitoring } from './utils/cacheMonitor'
import './style.css'

async function initializeApp() {
  const app = createApp(App)

  // 设置全局错误处理
  setupGlobalErrorHandling()

  // Initialize offline manager
  offlineManager.init().catch(error => {
    console.error('Failed to initialize offline manager:', error)
  })

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

  // 配置 Vue Query (异步初始化)
  await setupVueQuery(app)

  // 启动缓存监控（仅开发环境）
  if (import.meta.env.DEV) {
    startCacheMonitoring()
  }

  app.use(router).mount('#app')
}

// 初始化应用
initializeApp().catch(error => {
  console.error('Failed to initialize application:', error)
})
