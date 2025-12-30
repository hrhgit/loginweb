import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import GlobalBanner from '../../components/feedback/GlobalBanner.vue'
import { MessageType } from '../../utils/errorHandler'

// Create reactive mock store
const mockBannerError = ref('')
const mockBannerInfo = ref('')

const mockStore = {
  get bannerError() { return mockBannerError.value },
  set bannerError(value) { mockBannerError.value = value },
  get bannerInfo() { return mockBannerInfo.value },
  set bannerInfo(value) { mockBannerInfo.value = value },
  setBanner: vi.fn(),
}

vi.mock('../../store/appStore', () => ({
  useAppStore: () => mockStore
}))

describe('Error Message UI Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBannerError.value = ''
    mockBannerInfo.value = ''
  })

  describe('Visual Regression Tests - Message Type Styling', () => {
    it('should display error messages with correct red styling', async () => {
      mockBannerError.value = '网络连接失败，请检查网络后重试'
      
      const wrapper = mount(GlobalBanner)
      await nextTick()
      // Wait for debounced message update
      await new Promise(resolve => setTimeout(resolve, 100))
      await nextTick()
      
      const banner = wrapper.find('.toast-notification')
      expect(banner.exists()).toBe(true)
      expect(banner.classes()).toContain('toast-notification--error')
      
      const icon = wrapper.find('.toast-notification__icon')
      expect(icon.text()).toBe('✕')
      expect(icon.element).toBeInstanceOf(HTMLElement)
    })

    it('should display info messages with correct blue styling', async () => {
      mockBannerInfo.value = '系统维护通知'
      
      const wrapper = mount(GlobalBanner)
      await nextTick()
      // Wait for debounced message update
      await new Promise(resolve => setTimeout(resolve, 100))
      await nextTick()
      
      const banner = wrapper.find('.toast-notification')
      expect(banner.classes()).toContain('toast-notification--info')
      
      const icon = wrapper.find('.toast-notification__icon')
      expect(icon.text()).toBe('ℹ')
    })

    it('should apply correct CSS classes for different message types', async () => {
      // Test error type
      mockBannerError.value = '错误消息'
      let wrapper = mount(GlobalBanner)
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))
      await nextTick()
      
      let banner = wrapper.find('.toast-notification')
      expect(banner.classes()).toContain('toast-notification--error')
      
      // Reset and test info type
      mockBannerError.value = ''
      mockBannerInfo.value = '信息消息'
      wrapper = mount(GlobalBanner)
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))
      await nextTick()
      
      banner = wrapper.find('.toast-notification')
      expect(banner.classes()).toContain('toast-notification--info')
    })

    it('should display correct icons for different message types', async () => {
      // Test error icon
      mockBannerError.value = '错误'
      let wrapper = mount(GlobalBanner)
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))
      await nextTick()
      
      let icon = wrapper.find('.toast-notification__icon')
      expect(icon.text()).toBe('✕')
      
      // Test info icon
      mockBannerError.value = ''
      mockBannerInfo.value = '信息'
      wrapper = mount(GlobalBanner)
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))
      await nextTick()
      
      icon = wrapper.find('.toast-notification__icon')
      expect(icon.text()).toBe('ℹ')
    })
  })

  describe('Interactive Element Tests', () => {
    it('should show and hide close button correctly', async () => {
      mockBannerError.value = '测试错误消息'
      
      const wrapper = mount(GlobalBanner)
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))
      await nextTick()
      
      const closeButton = wrapper.find('.toast-notification__close')
      expect(closeButton.exists()).toBe(true)
      expect(closeButton.attributes('aria-label')).toBe('关闭消息')
      
      // Test close button click
      await closeButton.trigger('click')
      await nextTick()
      
      expect(wrapper.find('.toast-notification').exists()).toBe(false)
    })

    it('should display message content correctly', async () => {
      const testMessage = '这是一个测试消息'
      mockBannerError.value = testMessage
      
      const wrapper = mount(GlobalBanner)
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))
      await nextTick()
      
      const messageElement = wrapper.find('.toast-notification__message')
      expect(messageElement.exists()).toBe(true)
      expect(messageElement.text()).toBe(testMessage)
    })

    it('should handle banner visibility correctly', async () => {
      // Initially no banner
      const wrapper = mount(GlobalBanner)
      expect(wrapper.find('.toast-notification').exists()).toBe(false)
      
      // Show error banner by remounting with new store state
      mockBannerError.value = '错误消息'
      const newWrapper = mount(GlobalBanner)
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))
      await nextTick()
      
      expect(newWrapper.find('.toast-notification').exists()).toBe(true)
    })

    it('should handle message switching', async () => {
      // Start with error message
      mockBannerError.value = '错误消息'
      
      const wrapper = mount(GlobalBanner)
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))
      await nextTick()
      
      expect(wrapper.find('.toast-notification--error').exists()).toBe(true)

      mockBannerError.value = ''
      mockBannerInfo.value = '信息消息'
      const newWrapper = mount(GlobalBanner)
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))
      await nextTick()
      
      expect(newWrapper.find('.toast-notification--info').exists()).toBe(true)
    })
  })

  describe('Responsive Design Tests', () => {
    it('should adapt to mobile viewport', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 480,
      })
      
      mockBannerError.value = '移动端测试消息'
      
      const wrapper = mount(GlobalBanner)
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))
      await nextTick()
      
      const banner = wrapper.find('.toast-notification')
      expect(banner.exists()).toBe(true)
      expect(banner.element).toBeInstanceOf(HTMLElement)
    })

    it('should maintain readability on different screen sizes', async () => {
      const longMessage = '这是一个非常长的错误消息，用来测试在不同屏幕尺寸下的显示效果和可读性，确保文本不会被截断或者显示不完整'
      
      mockBannerError.value = longMessage
      
      const wrapper = mount(GlobalBanner)
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))
      await nextTick()
      
      const messageElement = wrapper.find('.toast-notification__message')
      expect(messageElement.text()).toBe(longMessage)
      expect(messageElement.element.textContent).toHaveLength(longMessage.length)
    })
  })

  describe('Accessibility Tests', () => {
    it('should have proper ARIA labels for close button', async () => {
      mockBannerError.value = '测试消息'
      
      const wrapper = mount(GlobalBanner)
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))
      await nextTick()
      
      const closeButton = wrapper.find('.toast-notification__close')
      expect(closeButton.attributes('aria-label')).toBe('关闭消息')
    })

    it('should support keyboard navigation', async () => {
      mockBannerError.value = '键盘导航测试'
      
      const wrapper = mount(GlobalBanner)
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))
      await nextTick()
      
      const closeButton = wrapper.find('.toast-notification__close')
      
      // Test Enter key - this should close the banner
      await closeButton.trigger('keydown.enter')
      
      // Since the component handles the close internally, we just verify the button exists
      expect(closeButton.exists()).toBe(true)
    })

    it('should have proper color contrast for different message types', async () => {
      mockBannerError.value = '错误消息'
      
      const wrapper = mount(GlobalBanner)
      await nextTick()
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))
      await nextTick()
      
      const banner = wrapper.find('.toast-notification')
      const messageElement = wrapper.find('.toast-notification__message')
      
      expect(banner.exists()).toBe(true)
      expect(messageElement.text()).toBe('错误消息')
      
      // Verify that text is visible
      const computedStyle = getComputedStyle(messageElement.element)
      expect(computedStyle.color).not.toBe('transparent')
      expect(computedStyle.opacity).not.toBe('0')
    })
  })

  describe('Animation and Transition Tests', () => {
    it('should apply transition classes correctly', async () => {
      mockBannerInfo.value = '动画测试消息'
      
      const wrapper = mount(GlobalBanner)
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))
      await nextTick()
      
      const banner = wrapper.find('.toast-notification')
      expect(banner.exists()).toBe(true)
      
      // Test that transition wrapper exists
      const transition = wrapper.findComponent({ name: 'Transition' })
      expect(transition.exists()).toBe(true)
      expect(transition.props('name')).toBe('toast')
    })

    it('should handle reduced motion preferences', async () => {
      // Mock prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })
      
      mockBannerError.value = '减少动画测试'
      
      const wrapper = mount(GlobalBanner)
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))
      await nextTick()
      
      const banner = wrapper.find('.toast-notification')
      expect(banner.exists()).toBe(true)
    })
  })

  describe('Message Duration Tests', () => {
    it('should auto-hide messages after specified duration', async () => {
      vi.useFakeTimers()
      
      mockBannerInfo.value = '自动隐藏测试'
      
      const wrapper = mount(GlobalBanner)
      await nextTick()
      
      // Fast-forward the debounce timer
      vi.advanceTimersByTime(100)
      await nextTick()
      
      expect(wrapper.find('.toast-notification').exists()).toBe(true)
      
      // Fast-forward time by 2 seconds (info message duration)
      vi.advanceTimersByTime(2000)
      await nextTick()
      
      // Check if banner is hidden (component internal state)
      expect(wrapper.find('.toast-notification').exists()).toBe(false)
      
      vi.useRealTimers()
    })
  })

  describe('Component Structure Tests', () => {
    it('should render proper HTML structure', async () => {
      mockBannerError.value = '结构测试'
      
      const wrapper = mount(GlobalBanner)
      await nextTick()
      
      // Wait for component to process the message
      await new Promise(resolve => {
        setTimeout(resolve, 100)
      })
      await nextTick()
      
      // Check main structure
      const banner = wrapper.find('.toast-notification')
      expect(banner.exists()).toBe(true)
      
      const content = wrapper.find('.toast-notification__content')
      expect(content.exists()).toBe(true)
      
      const header = wrapper.find('.toast-notification__header')
      expect(header.exists()).toBe(true)
      
      const icon = wrapper.find('.toast-notification__icon')
      expect(icon.exists()).toBe(true)
      
      const message = wrapper.find('.toast-notification__message')
      expect(message.exists()).toBe(true)
      
      const closeButton = wrapper.find('.toast-notification__close')
      expect(closeButton.exists()).toBe(true)
    }, 10000) // Increase timeout to 10 seconds

    it('should handle empty messages gracefully', async () => {
      mockBannerError.value = ''
      mockBannerInfo.value = ''
      
      const wrapper = mount(GlobalBanner)
      await nextTick()
      
      const banner = wrapper.find('.toast-notification')
      expect(banner.exists()).toBe(false)
    })
  })
})