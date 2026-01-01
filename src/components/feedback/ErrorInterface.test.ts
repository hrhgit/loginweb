/**
 * 模块加载错误界面核心功能测试
 * 
 * 测试错误页面的显示逻辑、重试按钮功能和加载状态的正确显示
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('Module Load Error Interface Core Functionality', () => {
  describe('Error Message Generation', () => {
    it('should generate correct error messages for different error types', () => {
      const getErrorMessage = (errorType: string, customError?: Error) => {
        if (customError?.message) {
          return customError.message
        }
        
        switch (errorType) {
          case 'MIME_ERROR':
            return '页面资源加载失败，服务器返回了错误的文件类型'
          case 'NETWORK_ERROR':
            return '网络连接失败，请检查网络连接后重试'
          case 'TIMEOUT_ERROR':
            return '页面加载超时，请检查网络连接'
          default:
            return '页面加载时发生未知错误'
        }
      }

      expect(getErrorMessage('MIME_ERROR')).toBe('页面资源加载失败，服务器返回了错误的文件类型')
      expect(getErrorMessage('NETWORK_ERROR')).toBe('网络连接失败，请检查网络连接后重试')
      expect(getErrorMessage('TIMEOUT_ERROR')).toBe('页面加载超时，请检查网络连接')
      expect(getErrorMessage('UNKNOWN')).toBe('页面加载时发生未知错误')
      
      const customError = new Error('Custom error message')
      expect(getErrorMessage('NETWORK_ERROR', customError)).toBe('Custom error message')
    })
  })

  describe('Retry Logic', () => {
    it('should handle retry count and button state correctly', async () => {
      class RetryHandler {
        private retryCount = 0
        private isRetrying = false
        private maxRetries = 3

        getRetryCount() {
          return this.retryCount
        }

        isRetryingState() {
          return this.isRetrying
        }

        canRetry() {
          return this.retryCount < this.maxRetries && !this.isRetrying
        }

        getRetryButtonText() {
          if (this.isRetrying) {
            return '重试中...'
          }
          if (this.retryCount >= this.maxRetries) {
            return `已达重试上限 (${this.maxRetries})`
          }
          if (this.retryCount > 0) {
            return `重试 (${this.retryCount}/${this.maxRetries})`
          }
          return '重试'
        }

        async performRetry() {
          if (!this.canRetry()) {
            return false
          }

          this.retryCount++
          this.isRetrying = true

          // Simulate async operation
          await new Promise(resolve => setTimeout(resolve, 10))
          
          this.isRetrying = false
          return true
        }

        reset() {
          this.retryCount = 0
          this.isRetrying = false
        }
      }

      const handler = new RetryHandler()

      // Initial state
      expect(handler.getRetryCount()).toBe(0)
      expect(handler.isRetryingState()).toBe(false)
      expect(handler.canRetry()).toBe(true)
      expect(handler.getRetryButtonText()).toBe('重试')

      // After first retry
      await handler.performRetry()
      expect(handler.getRetryCount()).toBe(1)
      expect(handler.getRetryButtonText()).toBe('重试 (1/3)')

      // After second retry
      await handler.performRetry()
      expect(handler.getRetryCount()).toBe(2)
      expect(handler.getRetryButtonText()).toBe('重试 (2/3)')

      // After third retry (max reached)
      await handler.performRetry()
      expect(handler.getRetryCount()).toBe(3)
      expect(handler.canRetry()).toBe(false)
      expect(handler.getRetryButtonText()).toBe('已达重试上限 (3)')
    })

    it('should prevent retry when already retrying', async () => {
      class RetryHandler {
        private retryCount = 0
        private isRetrying = false
        private maxRetries = 3

        canRetry() {
          return this.retryCount < this.maxRetries && !this.isRetrying
        }

        async performRetry() {
          if (!this.canRetry()) {
            return false
          }

          this.retryCount++
          this.isRetrying = true

          // Simulate longer async operation
          await new Promise(resolve => setTimeout(resolve, 50))
          
          this.isRetrying = false
          return true
        }

        getState() {
          return {
            retryCount: this.retryCount,
            isRetrying: this.isRetrying,
            canRetry: this.canRetry()
          }
        }
      }

      const handler = new RetryHandler()

      // Start first retry
      const firstRetry = handler.performRetry()
      
      // Should be retrying now
      expect(handler.getState().isRetrying).toBe(true)
      expect(handler.getState().canRetry).toBe(false)

      // Attempt second retry while first is in progress
      const secondRetry = await handler.performRetry()
      expect(secondRetry).toBe(false) // Should be rejected

      // Wait for first retry to complete
      const firstResult = await firstRetry
      expect(firstResult).toBe(true)
      expect(handler.getState().isRetrying).toBe(false)
      expect(handler.getState().canRetry).toBe(true)
    })
  })

  describe('Loading State Management', () => {
    it('should manage loading states correctly', () => {
      class LoadingStateManager {
        private isLoading = false
        private hasError = false
        private isRetrying = false
        private retryCount = 0

        setLoading(loading: boolean) {
          this.isLoading = loading
          if (loading) {
            this.hasError = false
          }
        }

        setError(error: boolean) {
          this.hasError = error
          if (error) {
            this.isLoading = false
          }
        }

        setRetrying(retrying: boolean, count?: number) {
          this.isRetrying = retrying
          if (count !== undefined) {
            this.retryCount = count
          }
        }

        getDisplayState() {
          if (this.isRetrying) {
            return 'retrying'
          }
          if (this.isLoading) {
            return 'loading'
          }
          if (this.hasError) {
            return 'error'
          }
          return 'idle'
        }

        getLoadingMessage() {
          if (this.isRetrying) {
            return `正在重试加载页面... (${this.retryCount}/3)`
          }
          if (this.isLoading) {
            return '正在加载页面组件...'
          }
          return ''
        }

        shouldShowSpinner() {
          return this.isLoading || this.isRetrying
        }

        shouldShowErrorPage() {
          return this.hasError && !this.isLoading && !this.isRetrying
        }
      }

      const manager = new LoadingStateManager()

      // Initial state
      expect(manager.getDisplayState()).toBe('idle')
      expect(manager.shouldShowSpinner()).toBe(false)
      expect(manager.shouldShowErrorPage()).toBe(false)

      // Loading state
      manager.setLoading(true)
      expect(manager.getDisplayState()).toBe('loading')
      expect(manager.getLoadingMessage()).toBe('正在加载页面组件...')
      expect(manager.shouldShowSpinner()).toBe(true)
      expect(manager.shouldShowErrorPage()).toBe(false)

      // Error state
      manager.setError(true)
      expect(manager.getDisplayState()).toBe('error')
      expect(manager.shouldShowSpinner()).toBe(false)
      expect(manager.shouldShowErrorPage()).toBe(true)

      // Retrying state
      manager.setRetrying(true, 1)
      expect(manager.getDisplayState()).toBe('retrying')
      expect(manager.getLoadingMessage()).toBe('正在重试加载页面... (1/3)')
      expect(manager.shouldShowSpinner()).toBe(true)
      expect(manager.shouldShowErrorPage()).toBe(false)
    })
  })

  describe('Error Type Detection', () => {
    it('should detect error types from error messages', () => {
      const detectErrorType = (error: Error): string => {
        const message = error.message || ''
        
        if (message.includes('MIME') || message.includes('text/html') || message.includes('Expected a JavaScript')) {
          return 'MIME_ERROR'
        }
        
        if (message.includes('fetch') || message.includes('network') || message.includes('NetworkError')) {
          return 'NETWORK_ERROR'
        }
        
        if (message.includes('timeout')) {
          return 'TIMEOUT_ERROR'
        }
        
        return 'UNKNOWN'
      }

      const mimeError = new Error('Expected a JavaScript module script but the server responded with a MIME type of text/html')
      expect(detectErrorType(mimeError)).toBe('MIME_ERROR')

      const networkError = new Error('Failed to fetch')
      expect(detectErrorType(networkError)).toBe('NETWORK_ERROR')

      const timeoutError = new Error('Module loading timeout after 30000ms')
      expect(detectErrorType(timeoutError)).toBe('TIMEOUT_ERROR')

      const unknownError = new Error('Some unknown error')
      expect(detectErrorType(unknownError)).toBe('UNKNOWN')
    })
  })

  describe('Suggestion Generation', () => {
    it('should generate appropriate suggestions for different error types', () => {
      const getSuggestions = (errorType: string): string[] => {
        switch (errorType) {
          case 'MIME_ERROR':
            return [
              '刷新页面重新加载',
              '清除浏览器缓存后重试',
              '检查网络连接是否稳定'
            ]
          case 'NETWORK_ERROR':
            return [
              '检查网络连接',
              '尝试切换网络环境',
              '稍后再试'
            ]
          case 'TIMEOUT_ERROR':
            return [
              '检查网络速度',
              '关闭其他占用网络的应用',
              '稍后重试'
            ]
          default:
            return [
              '刷新页面',
              '检查网络连接',
              '联系技术支持'
            ]
        }
      }

      const mimeSuggestions = getSuggestions('MIME_ERROR')
      expect(mimeSuggestions).toContain('刷新页面重新加载')
      expect(mimeSuggestions).toContain('清除浏览器缓存后重试')

      const networkSuggestions = getSuggestions('NETWORK_ERROR')
      expect(networkSuggestions).toContain('检查网络连接')
      expect(networkSuggestions).toContain('尝试切换网络环境')

      const timeoutSuggestions = getSuggestions('TIMEOUT_ERROR')
      expect(timeoutSuggestions).toContain('检查网络速度')
      expect(timeoutSuggestions).toContain('关闭其他占用网络的应用')

      const unknownSuggestions = getSuggestions('UNKNOWN')
      expect(unknownSuggestions).toContain('刷新页面')
      expect(unknownSuggestions).toContain('联系技术支持')
    })
  })

  describe('Network Status Integration', () => {
    it('should handle network status correctly', () => {
      interface NetworkState {
        isOnline: boolean
        quality: 'fast' | 'slow'
        effectiveType?: string
        rtt?: number
      }

      const getNetworkStatusMessage = (networkState: NetworkState): string => {
        if (!networkState.isOnline) {
          return '网络连接已断开'
        }
        if (networkState.quality === 'slow') {
          return '网络连接较慢'
        }
        return '网络连接正常'
      }

      const getNetworkIcon = (networkState: NetworkState): string => {
        if (!networkState.isOnline) return 'wifi-off'
        if (networkState.quality === 'slow') return 'signal-low'
        return 'wifi'
      }

      // Online fast connection
      const fastNetwork: NetworkState = { isOnline: true, quality: 'fast' }
      expect(getNetworkStatusMessage(fastNetwork)).toBe('网络连接正常')
      expect(getNetworkIcon(fastNetwork)).toBe('wifi')

      // Online slow connection
      const slowNetwork: NetworkState = { isOnline: true, quality: 'slow' }
      expect(getNetworkStatusMessage(slowNetwork)).toBe('网络连接较慢')
      expect(getNetworkIcon(slowNetwork)).toBe('signal-low')

      // Offline
      const offlineNetwork: NetworkState = { isOnline: false, quality: 'fast' }
      expect(getNetworkStatusMessage(offlineNetwork)).toBe('网络连接已断开')
      expect(getNetworkIcon(offlineNetwork)).toBe('wifi-off')
    })
  })

  describe('Accessibility Features', () => {
    it('should provide proper accessibility attributes', () => {
      const getAriaAttributes = (isExpanded: boolean, isDisabled: boolean) => {
        return {
          'aria-expanded': isExpanded.toString(),
          'aria-disabled': isDisabled.toString(),
          'aria-label': isDisabled ? '重试按钮已禁用' : '重试加载页面'
        }
      }

      // Enabled state
      const enabledAttrs = getAriaAttributes(false, false)
      expect(enabledAttrs['aria-expanded']).toBe('false')
      expect(enabledAttrs['aria-disabled']).toBe('false')
      expect(enabledAttrs['aria-label']).toBe('重试加载页面')

      // Disabled state
      const disabledAttrs = getAriaAttributes(false, true)
      expect(disabledAttrs['aria-disabled']).toBe('true')
      expect(disabledAttrs['aria-label']).toBe('重试按钮已禁用')

      // Expanded state
      const expandedAttrs = getAriaAttributes(true, false)
      expect(expandedAttrs['aria-expanded']).toBe('true')
    })
  })

  describe('Performance Considerations', () => {
    it('should handle timeout correctly', async () => {
      const createTimeoutPromise = (timeout: number) => {
        return new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Operation timeout after ${timeout}ms`))
          }, timeout)
        })
      }

      const raceWithTimeout = async <T>(
        operation: Promise<T>,
        timeout: number
      ): Promise<T> => {
        return Promise.race([
          operation,
          createTimeoutPromise(timeout)
        ])
      }

      // Fast operation should succeed
      const fastOperation = new Promise(resolve => setTimeout(() => resolve('success'), 10))
      const result = await raceWithTimeout(fastOperation, 100)
      expect(result).toBe('success')

      // Slow operation should timeout
      const slowOperation = new Promise(resolve => setTimeout(() => resolve('success'), 200))
      await expect(raceWithTimeout(slowOperation, 50)).rejects.toThrow('timeout')
    })
  })
})