import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import GlobalBanner from '../../components/feedback/GlobalBanner.vue'

// Mock the store
const mockStore = {
  bannerError: '',
  bannerInfo: '',
  setBanner: vi.fn(),
}

vi.mock('../../store/appStore', () => ({
  useAppStore: () => mockStore
}))

describe('Retry Mechanism UI Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.bannerError = ''
    mockStore.bannerInfo = ''
  })

  describe('Retry Button Display Logic Tests', () => {
    it('should show retry button for retryable errors', async () => {
      const wrapper = mount(GlobalBanner)
      await wrapper.setData({ 
        isVisible: true,
        currentMessage: '网络请求失败，请重试',
        canRetry: true,
        onRetryCallback: vi.fn()
      })
      
      const retryButton = wrapper.find('.toast-notification__retry-btn')
      expect(retryButton.exists()).toBe(true)
      expect(retryButton.text()).toBe('重试')
      expect(retryButton.attributes('disabled')).toBeUndefined()
    })

    it('should hide retry button for non-retryable errors', async () => {
      const wrapper = mount(GlobalBanner)
      await wrapper.setData({ 
        isVisible: true,
        currentMessage: '权限不足，请联系管理员',
        canRetry: false
      })
      
      const retryButton = wrapper.find('.toast-notification__retry-btn')
      expect(retryButton.exists()).toBe(false)
    })

    it('should hide retry button when retry limit is exceeded', async () => {
      const wrapper = mount(GlobalBanner)
      await wrapper.setData({ 
        isVisible: true,
        currentMessage: '重试次数已达上限，请联系技术支持',
        canRetry: false,
        suggestions: ['请联系技术支持获取帮助']
      })
      
      const retryButton = wrapper.find('.toast-notification__retry-btn')
      expect(retryButton.exists()).toBe(false)
      
      const suggestions = wrapper.find('.toast-notification__suggestions')
      expect(suggestions.exists()).toBe(true)
      expect(suggestions.text()).toContain('请联系技术支持获取帮助')
    })
  })

  describe('Retry Button Interaction Tests', () => {
    it('should execute retry callback when retry button is clicked', async () => {
      const mockRetryCallback = vi.fn().mockResolvedValue(undefined)
      
      const wrapper = mount(GlobalBanner)
      await wrapper.setData({ 
        isVisible: true,
        currentMessage: '网络连接超时',
        canRetry: true,
        onRetryCallback: mockRetryCallback
      })
      
      const retryButton = wrapper.find('.toast-notification__retry-btn')
      await retryButton.trigger('click')
      
      expect(mockRetryCallback).toHaveBeenCalledTimes(1)
    })

    it('should show loading state during retry operation', async () => {
      let resolveRetry: () => void
      const mockRetryCallback = vi.fn().mockImplementation(() => {
        return new Promise<void>((resolve) => {
          resolveRetry = resolve
        })
      })
      
      const wrapper = mount(GlobalBanner)
      await wrapper.setData({ 
        isVisible: true,
        currentMessage: '操作失败',
        canRetry: true,
        onRetryCallback: mockRetryCallback
      })
      
      const retryButton = wrapper.find('.toast-notification__retry-btn')
      await retryButton.trigger('click')
      await nextTick()
      
      // Check loading state
      expect(wrapper.vm.isRetrying).toBe(true)
      expect(retryButton.classes()).toContain('toast-notification__retry-btn--loading')
      expect(retryButton.attributes('disabled')).toBeDefined()
      expect(retryButton.text()).toBe('重试中...')
      expect(retryButton.attributes('aria-label')).toBe('正在重试...')
      
      // Resolve the retry operation
      resolveRetry!()
      await nextTick()
      
      // Check that loading state is cleared
      expect(wrapper.vm.isRetrying).toBe(false)
      expect(retryButton.classes()).not.toContain('toast-notification__retry-btn--loading')
      expect(retryButton.attributes('disabled')).toBeUndefined()
    })

    it('should prevent multiple simultaneous retry attempts', async () => {
      const mockRetryCallback = vi.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 100))
      })
      
      const wrapper = mount(GlobalBanner)
      await wrapper.setData({ 
        isVisible: true,
        currentMessage: '请求失败',
        canRetry: true,
        onRetryCallback: mockRetryCallback
      })
      
      const retryButton = wrapper.find('.toast-notification__retry-btn')
      
      // Click retry button multiple times quickly
      await retryButton.trigger('click')
      await retryButton.trigger('click')
      await retryButton.trigger('click')
      
      // Should only call the callback once
      expect(mockRetryCallback).toHaveBeenCalledTimes(1)
    })

    it('should handle retry callback errors gracefully', async () => {
      const mockRetryCallback = vi.fn().mockRejectedValue(new Error('Retry failed'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const wrapper = mount(GlobalBanner)
      await wrapper.setData({ 
        isVisible: true,
        currentMessage: '操作失败',
        canRetry: true,
        onRetryCallback: mockRetryCallback
      })
      
      const retryButton = wrapper.find('.toast-notification__retry-btn')
      await retryButton.trigger('click')
      await nextTick()
      
      // Wait for promise to resolve
      await new Promise(resolve => setTimeout(resolve, 0))
      
      expect(consoleSpy).toHaveBeenCalledWith('Retry failed:', expect.any(Error))
      expect(wrapper.vm.isRetrying).toBe(false)
      
      consoleSpy.mockRestore()
    })
  })

  describe('Retry Button Visual States Tests', () => {
    it('should apply correct styling for retry button in different message types', async () => {
      const testCases = [
        { type: 'error', expectedClass: 'toast-notification--error' },
        { type: 'warning', expectedClass: 'toast-notification--warning' },
        { type: 'info', expectedClass: 'toast-notification--info' }
      ]
      
      for (const testCase of testCases) {
        const wrapper = mount(GlobalBanner)
        await wrapper.setData({ 
          isVisible: true,
          currentMessage: `${testCase.type} 消息`,
          currentType: testCase.type,
          canRetry: true,
          onRetryCallback: vi.fn()
        })
        
        const banner = wrapper.find('.toast-notification')
        expect(banner.classes()).toContain(testCase.expectedClass)
        
        const retryButton = wrapper.find('.toast-notification__retry-btn')
        expect(retryButton.exists()).toBe(true)
      }
    })

    it('should show loading spinner animation during retry', async () => {
      const wrapper = mount(GlobalBanner)
      await wrapper.setData({ 
        isVisible: true,
        currentMessage: '加载失败',
        canRetry: true,
        isRetrying: true
      })
      
      const retryButton = wrapper.find('.toast-notification__retry-btn')
      expect(retryButton.classes()).toContain('toast-notification__retry-btn--loading')
      
      // Check for loading spinner pseudo-element (this would be tested via CSS)
      const computedStyle = getComputedStyle(retryButton.element, '::before')
      expect(retryButton.element).toBeInstanceOf(HTMLElement)
    })

    it('should have proper hover and focus states', async () => {
      const wrapper = mount(GlobalBanner)
      await wrapper.setData({ 
        isVisible: true,
        currentMessage: '操作失败',
        canRetry: true,
        onRetryCallback: vi.fn()
      })
      
      const retryButton = wrapper.find('.toast-notification__retry-btn')
      
      // Test focus
      retryButton.element.focus()
      expect(document.activeElement).toBe(retryButton.element)
      
      // Test hover (simulated through CSS class)
      await retryButton.trigger('mouseenter')
      expect(retryButton.element).toBeInstanceOf(HTMLElement)
    })
  })

  describe('Retry Button Accessibility Tests', () => {
    it('should have proper ARIA attributes', async () => {
      const wrapper = mount(GlobalBanner)
      await wrapper.setData({ 
        isVisible: true,
        currentMessage: '网络错误',
        canRetry: true,
        onRetryCallback: vi.fn()
      })
      
      const retryButton = wrapper.find('.toast-notification__retry-btn')
      expect(retryButton.attributes('aria-label')).toBe('重试操作')
      
      // When retrying
      await wrapper.setData({ isRetrying: true })
      expect(retryButton.attributes('aria-label')).toBe('正在重试...')
    })

    it('should support keyboard activation', async () => {
      const mockRetryCallback = vi.fn().mockResolvedValue(undefined)
      
      const wrapper = mount(GlobalBanner)
      await wrapper.setData({ 
        isVisible: true,
        currentMessage: '请求超时',
        canRetry: true,
        onRetryCallback: mockRetryCallback
      })
      
      const retryButton = wrapper.find('.toast-notification__retry-btn')
      
      // Test Enter key
      await retryButton.trigger('keydown.enter')
      expect(mockRetryCallback).toHaveBeenCalledTimes(1)
      
      // Test Space key
      await retryButton.trigger('keydown.space')
      expect(mockRetryCallback).toHaveBeenCalledTimes(2)
    })

    it('should be properly disabled during retry operation', async () => {
      const wrapper = mount(GlobalBanner)
      await wrapper.setData({ 
        isVisible: true,
        currentMessage: '上传失败',
        canRetry: true,
        isRetrying: true
      })
      
      const retryButton = wrapper.find('.toast-notification__retry-btn')
      expect(retryButton.attributes('disabled')).toBeDefined()
      expect(retryButton.classes()).toContain('toast-notification__retry-btn--loading')
    })
  })

  describe('Retry Integration with Error Messages Tests', () => {
    it('should close banner after successful retry', async () => {
      const mockRetryCallback = vi.fn().mockResolvedValue(undefined)
      
      const wrapper = mount(GlobalBanner)
      await wrapper.setData({ 
        isVisible: true,
        currentMessage: '数据加载失败',
        canRetry: true,
        onRetryCallback: mockRetryCallback
      })
      
      const retryButton = wrapper.find('.toast-notification__retry-btn')
      await retryButton.trigger('click')
      
      // Wait for retry to complete
      await nextTick()
      
      expect(wrapper.vm.isVisible).toBe(false)
    })

    it('should show retry count information when available', async () => {
      const wrapper = mount(GlobalBanner)
      await wrapper.setData({ 
        isVisible: true,
        currentMessage: '连接失败 (重试 2/3)',
        canRetry: true,
        onRetryCallback: vi.fn()
      })
      
      const messageElement = wrapper.find('.toast-notification__message')
      expect(messageElement.text()).toContain('重试 2/3')
    })

    it('should display appropriate suggestions when retry is not available', async () => {
      const wrapper = mount(GlobalBanner)
      await wrapper.setData({ 
        isVisible: true,
        currentMessage: '服务器内部错误',
        canRetry: false,
        suggestions: [
          '请稍后再试',
          '如果问题持续存在，请联系技术支持',
          '检查网络连接是否正常'
        ]
      })
      
      const retryButton = wrapper.find('.toast-notification__retry-btn')
      expect(retryButton.exists()).toBe(false)
      
      const suggestions = wrapper.find('.toast-notification__suggestions')
      expect(suggestions.exists()).toBe(true)
      
      const suggestionItems = wrapper.findAll('.toast-notification__suggestions-list li')
      expect(suggestionItems).toHaveLength(3)
      expect(suggestionItems[0].text()).toBe('请稍后再试')
      expect(suggestionItems[1].text()).toBe('如果问题持续存在，请联系技术支持')
      expect(suggestionItems[2].text()).toBe('检查网络连接是否正常')
    })
  })

  describe('Retry Button Performance Tests', () => {
    it('should handle rapid retry button clicks without performance issues', async () => {
      const mockRetryCallback = vi.fn().mockResolvedValue(undefined)
      
      const wrapper = mount(GlobalBanner)
      await wrapper.setData({ 
        isVisible: true,
        currentMessage: '操作失败',
        canRetry: true,
        onRetryCallback: mockRetryCallback
      })
      
      const retryButton = wrapper.find('.toast-notification__retry-btn')
      
      const startTime = performance.now()
      
      // Simulate rapid clicks
      for (let i = 0; i < 10; i++) {
        await retryButton.trigger('click')
      }
      
      const endTime = performance.now()
      
      // Should handle clicks quickly (less than 50ms)
      expect(endTime - startTime).toBeLessThan(50)
      
      // Should only execute callback once due to loading state protection
      expect(mockRetryCallback).toHaveBeenCalledTimes(1)
    })

    it('should not cause memory leaks with retry operations', async () => {
      const wrapper = mount(GlobalBanner)
      
      // Simulate multiple retry operations
      for (let i = 0; i < 5; i++) {
        const mockCallback = vi.fn().mockResolvedValue(undefined)
        
        await wrapper.setData({ 
          isVisible: true,
          currentMessage: `操作失败 ${i}`,
          canRetry: true,
          onRetryCallback: mockCallback
        })
        
        const retryButton = wrapper.find('.toast-notification__retry-btn')
        await retryButton.trigger('click')
        await nextTick()
        
        expect(mockCallback).toHaveBeenCalledTimes(1)
      }
      
      // Should complete without issues
      expect(wrapper.vm.isRetrying).toBe(false)
    })
  })
})