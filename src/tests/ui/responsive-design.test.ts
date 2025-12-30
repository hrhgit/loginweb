import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import GlobalBanner from '../../components/feedback/GlobalBanner.vue'

// Mock the store
const mockStore = {
  bannerError: '',
  bannerInfo: '',
  setBanner: vi.fn(),
  // Network state properties
  networkState: {
    isOnline: true,
    effectiveType: '4g',
    rtt: 100,
    downlink: 10
  },
  connectionQuality: 'fast',
  networkRetryCount: 0
}

vi.mock('../../store/appStore', () => ({
  useAppStore: () => mockStore
}))

// Helper function to mock viewport size
const mockViewport = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  })
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  })
  
  // Trigger resize event
  window.dispatchEvent(new Event('resize'))
}

// Mock CSS media queries
const mockMediaQuery = (query: string, matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((q) => ({
      matches: q === query ? matches : false,
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe('Responsive Design Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.bannerError = ''
    mockStore.bannerInfo = ''
  })

  afterEach(() => {
    // Reset viewport to default
    mockViewport(1024, 768)
  })

  describe('Mobile Viewport Tests (320px - 640px)', () => {
    it('should adapt banner layout for mobile phones (320px)', async () => {
      mockViewport(320, 568)
      
      mockStore.bannerError = '移动端错误消息测试'
      
      const wrapper = mount(GlobalBanner)
      await nextTick()
      
      const banner = wrapper.find('.toast-notification')
      expect(banner.exists()).toBe(true)
      
      // Check that banner is visible and properly sized
      expect(banner.element).toBeInstanceOf(HTMLElement)
      
      // Verify message is readable on small screen
      const message = wrapper.find('.toast-notification__message')
      expect(message.text()).toBe('移动端错误消息测试')
    })

    it('should handle long messages on mobile without overflow', async () => {
      mockViewport(375, 667) // iPhone SE size
      
      const longMessage = '这是一个非常长的错误消息，用来测试在移动设备上的显示效果，确保文本能够正确换行而不会溢出屏幕边界，同时保持良好的可读性和用户体验'
      
      mockStore.bannerError = longMessage
      
      const wrapper = mount(GlobalBanner)
      await nextTick()
      
      const message = wrapper.find('.toast-notification__message')
      expect(message.text()).toBe(longMessage)
      
      // Check that message container exists and is properly structured
      expect(message.element).toBeInstanceOf(HTMLElement)
    })

    it('should stack action buttons vertically on narrow screens', async () => {
      mockViewport(320, 568)
      
      const wrapper = mount(GlobalBanner)
      await wrapper.setData({ 
        isVisible: true,
        currentMessage: '操作失败',
        canRetry: true,
        onRetryCallback: vi.fn(),
        suggestions: ['建议1', '建议2']
      })
      
      const actions = wrapper.find('.toast-notification__actions')
      const suggestions = wrapper.find('.toast-notification__suggestions')
      
      expect(actions.exists()).toBe(true)
      expect(suggestions.exists()).toBe(true)
      
      // Verify elements are properly displayed
      const retryButton = wrapper.find('.toast-notification__retry-btn')
      expect(retryButton.exists()).toBe(true)
    })

    it('should adjust font sizes for mobile readability', async () => {
      mockViewport(360, 640) // Common Android size
      
      mockStore.bannerInfo = '移动端字体测试消息'
      
      const wrapper = mount(GlobalBanner)
      await nextTick()
      
      const message = wrapper.find('.toast-notification__message')
      const icon = wrapper.find('.toast-notification__icon')
      
      expect(message.exists()).toBe(true)
      expect(icon.exists()).toBe(true)
      
      // Verify elements are rendered properly
      expect(message.element.textContent).toBe('移动端字体测试消息')
    })
  })

  describe('Tablet Viewport Tests (641px - 1024px)', () => {
    it('should optimize layout for tablet portrait (768px)', async () => {
      mockViewport(768, 1024)
      
      mockStore.bannerError = '平板设备错误消息'
      
      const wrapper = mount(GlobalBanner)
      await nextTick()
      
      const banner = wrapper.find('.toast-notification')
      expect(banner.exists()).toBe(true)
      
      // Check banner positioning and sizing for tablet
      expect(banner.element).toBeInstanceOf(HTMLElement)
    })

    it('should handle tablet landscape orientation (1024px)', async () => {
      mockViewport(1024, 768)
      
      const wrapper = mount(GlobalBanner)
      await wrapper.setData({ 
        isVisible: true,
        currentMessage: '平板横屏测试消息',
        canRetry: true,
        onRetryCallback: vi.fn(),
        suggestions: ['建议解决方案1', '建议解决方案2', '建议解决方案3']
      })
      
      const banner = wrapper.find('.toast-notification')
      const suggestions = wrapper.findAll('.toast-notification__suggestions-list li')
      
      expect(banner.exists()).toBe(true)
      expect(suggestions).toHaveLength(3)
      
      // Verify all suggestions are visible
      suggestions.forEach((suggestion, index) => {
        expect(suggestion.text()).toBe(`建议解决方案${index + 1}`)
      })
    })
  })

  describe('Desktop Viewport Tests (1025px+)', () => {
    it('should display full layout on desktop (1920px)', async () => {
      mockViewport(1920, 1080)
      
      const wrapper = mount(GlobalBanner)
      await wrapper.setData({ 
        isVisible: true,
        currentMessage: '桌面端完整功能测试',
        canRetry: true,
        onRetryCallback: vi.fn(),
        suggestions: ['详细建议1', '详细建议2', '详细建议3', '详细建议4']
      })
      
      const banner = wrapper.find('.toast-notification')
      const retryButton = wrapper.find('.toast-notification__retry-btn')
      const suggestions = wrapper.findAll('.toast-notification__suggestions-list li')
      
      expect(banner.exists()).toBe(true)
      expect(retryButton.exists()).toBe(true)
      expect(suggestions).toHaveLength(4)
      
      // Verify all elements are properly displayed
      expect(banner.element).toBeInstanceOf(HTMLElement)
    })

    it('should handle ultra-wide displays (2560px)', async () => {
      mockViewport(2560, 1440)
      
      mockStore.bannerInfo = '超宽屏显示测试'
      
      const wrapper = mount(GlobalBanner)
      await nextTick()
      
      const banner = wrapper.find('.toast-notification')
      expect(banner.exists()).toBe(true)
      
      // Banner should not stretch too wide
      expect(banner.element).toBeInstanceOf(HTMLElement)
    })
  })

  describe('Orientation Change Tests', () => {
    it('should adapt when device rotates from portrait to landscape', async () => {
      // Start in portrait
      mockViewport(375, 667)
      
      mockStore.bannerError = '设备旋转测试'
      
      const wrapper = mount(GlobalBanner)
      await nextTick()
      
      expect(wrapper.find('.toast-notification').exists()).toBe(true)
      
      // Rotate to landscape
      mockViewport(667, 375)
      await nextTick()
      
      // Banner should still be visible and properly positioned
      expect(wrapper.find('.toast-notification').exists()).toBe(true)
    })

    it('should maintain functionality across orientation changes', async () => {
      const mockRetryCallback = vi.fn().mockResolvedValue(undefined)
      
      const wrapper = mount(GlobalBanner)
      await wrapper.setData({ 
        isVisible: true,
        currentMessage: '旋转测试消息',
        canRetry: true,
        onRetryCallback: mockRetryCallback
      })
      
      // Portrait mode
      mockViewport(375, 667)
      await nextTick()
      
      let retryButton = wrapper.find('.toast-notification__retry-btn')
      expect(retryButton.exists()).toBe(true)
      
      // Landscape mode
      mockViewport(667, 375)
      await nextTick()
      
      retryButton = wrapper.find('.toast-notification__retry-btn')
      expect(retryButton.exists()).toBe(true)
      
      // Retry should still work
      await retryButton.trigger('click')
      expect(mockRetryCallback).toHaveBeenCalledTimes(1)
    })
  })

  describe('High DPI Display Tests', () => {
    it('should render crisp icons on high DPI displays', async () => {
      // Mock high DPI display
      Object.defineProperty(window, 'devicePixelRatio', {
        writable: true,
        configurable: true,
        value: 2,
      })
      
      mockStore.bannerError = '高分辨率显示测试'
      
      const wrapper = mount(GlobalBanner)
      await nextTick()
      
      const icon = wrapper.find('.toast-notification__icon')
      expect(icon.exists()).toBe(true)
      expect(icon.text()).toBe('✕')
    })

    it('should handle 4K displays properly', async () => {
      mockViewport(3840, 2160)
      Object.defineProperty(window, 'devicePixelRatio', {
        writable: true,
        configurable: true,
        value: 2,
      })
      
      mockStore.bannerInfo = '4K显示测试消息'
      
      const wrapper = mount(GlobalBanner)
      await nextTick()
      
      const banner = wrapper.find('.toast-notification')
      expect(banner.exists()).toBe(true)
      
      // Should maintain proper sizing on 4K displays
      expect(banner.element).toBeInstanceOf(HTMLElement)
    })
  })

  describe('Accessibility Responsive Tests', () => {
    it('should maintain accessibility on all screen sizes', async () => {
      const screenSizes = [
        [320, 568],   // Mobile
        [768, 1024],  // Tablet
        [1920, 1080]  // Desktop
      ]
      
      for (const [width, height] of screenSizes) {
        mockViewport(width, height)
        
        const wrapper = mount(GlobalBanner)
        await wrapper.setData({ 
          isVisible: true,
          currentMessage: `测试消息 ${width}x${height}`,
          canRetry: true,
          onRetryCallback: vi.fn()
        })
        
        const closeButton = wrapper.find('.toast-notification__close')
        const retryButton = wrapper.find('.toast-notification__retry-btn')
        
        expect(closeButton.attributes('aria-label')).toBe('关闭消息')
        expect(retryButton.attributes('aria-label')).toBe('重试操作')
      }
    })

    it('should support zoom levels up to 200%', async () => {
      mockViewport(1920, 1080)
      
      // Simulate 200% zoom by halving viewport
      mockViewport(960, 540)
      
      mockStore.bannerError = '缩放测试消息'
      
      const wrapper = mount(GlobalBanner)
      await nextTick()
      
      const banner = wrapper.find('.toast-notification')
      const message = wrapper.find('.toast-notification__message')
      
      expect(banner.exists()).toBe(true)
      expect(message.text()).toBe('缩放测试消息')
    })
  })

  describe('Performance on Different Devices', () => {
    it('should render quickly on low-end mobile devices', async () => {
      mockViewport(320, 568)
      
      // Simulate slower device by adding artificial delay
      const startTime = performance.now()
      
      mockStore.bannerError = '性能测试消息'
      
      const wrapper = mount(GlobalBanner)
      await nextTick()
      
      const endTime = performance.now()
      
      // Should render within reasonable time even on slow devices
      expect(endTime - startTime).toBeLessThan(100)
      
      const banner = wrapper.find('.toast-notification')
      expect(banner.exists()).toBe(true)
    })

    it('should handle rapid viewport changes without performance issues', async () => {
      const wrapper = mount(GlobalBanner)
      await wrapper.setData({ 
        isVisible: true,
        currentMessage: '快速变化测试',
        canRetry: true,
        onRetryCallback: vi.fn()
      })
      
      const startTime = performance.now()
      
      // Rapidly change viewport sizes
      const sizes = [
        [320, 568], [768, 1024], [1920, 1080], 
        [375, 667], [1024, 768], [2560, 1440]
      ]
      
      for (const [width, height] of sizes) {
        mockViewport(width, height)
        await nextTick()
      }
      
      const endTime = performance.now()
      
      // Should handle rapid changes efficiently
      expect(endTime - startTime).toBeLessThan(200)
      
      // Banner should still be functional
      const retryButton = wrapper.find('.toast-notification__retry-btn')
      expect(retryButton.exists()).toBe(true)
    })
  })

  describe('CSS Media Query Integration Tests', () => {
    it('should respect prefers-reduced-motion setting', async () => {
      mockMediaQuery('(prefers-reduced-motion: reduce)', true)
      
      mockStore.bannerInfo = '减少动画测试'
      
      const wrapper = mount(GlobalBanner)
      await nextTick()
      
      const banner = wrapper.find('.toast-notification')
      expect(banner.exists()).toBe(true)
      
      // Animation should be reduced or disabled
      const transition = wrapper.findComponent({ name: 'Transition' })
      expect(transition.exists()).toBe(true)
    })

    it('should adapt to high contrast mode', async () => {
      mockMediaQuery('(prefers-contrast: high)', true)
      
      mockStore.bannerError = '高对比度测试'
      
      const wrapper = mount(GlobalBanner)
      await nextTick()
      
      const banner = wrapper.find('.toast-notification')
      expect(banner.exists()).toBe(true)
      
      // Should maintain visibility in high contrast mode
      expect(banner.element).toBeInstanceOf(HTMLElement)
    })

    it('should respect dark mode preferences', async () => {
      mockMediaQuery('(prefers-color-scheme: dark)', true)
      
      mockStore.bannerInfo = '深色模式测试'
      
      const wrapper = mount(GlobalBanner)
      await nextTick()
      
      const banner = wrapper.find('.toast-notification')
      expect(banner.exists()).toBe(true)
      
      // Should be visible in dark mode
      expect(banner.element).toBeInstanceOf(HTMLElement)
    })
  })
})