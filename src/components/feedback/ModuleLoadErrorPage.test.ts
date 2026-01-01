/**
 * 模块加载错误页面组件单元测试
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ModuleLoadErrorPage from './ModuleLoadErrorPage.vue'
import { createTestQueryClient } from '../../tests/setup'
import type { LoadError } from '../../utils/moduleLoader'

// Mock the router
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  currentRoute: {
    value: {
      fullPath: '/test-route'
    }
  }
}

// Mock the store
const mockStore = {
  networkState: {
    isOnline: true,
    effectiveType: '4g',
    rtt: 100,
    downlink: 10
  },
  connectionQuality: 'fast',
  networkRetryCount: 0
}

// Mock Lucide icons
vi.mock('lucide-vue-next', () => ({
  AlertCircle: { name: 'AlertCircle', template: '<div data-testid="alert-circle-icon"></div>' },
  ChevronDown: { name: 'ChevronDown', template: '<div data-testid="chevron-down-icon"></div>' },
  RotateCcw: { name: 'RotateCcw', template: '<div data-testid="rotate-ccw-icon"></div>' },
  RefreshCw: { name: 'RefreshCw', template: '<div data-testid="refresh-cw-icon"></div>' },
  Home: { name: 'Home', template: '<div data-testid="home-icon"></div>' },
  CheckCircle: { name: 'CheckCircle', template: '<div data-testid="check-circle-icon"></div>' },
  Clock: { name: 'Clock', template: '<div data-testid="clock-icon"></div>' },
  Wifi: { name: 'Wifi', template: '<div data-testid="wifi-icon"></div>' },
  WifiOff: { name: 'WifiOff', template: '<div data-testid="wifi-off-icon"></div>' },
  Signal: { name: 'Signal', template: '<div data-testid="signal-icon"></div>' }
}))

// Mock LoadingStateIndicator component
vi.mock('./LoadingStateIndicator.vue', () => ({
  default: {
    name: 'LoadingStateIndicator',
    template: '<div data-testid="loading-state-indicator" :data-visible="visible" :data-state="state"></div>',
    props: ['visible', 'state', 'message', 'showSpinner', 'showNetworkQuality', 'variant', 'size']
  }
}))

// Mock the store composable
vi.mock('../../store/appStore', () => ({
  useAppStore: () => mockStore
}))

// Mock the router composable
vi.mock('vue-router', () => ({
  useRouter: () => mockRouter,
  useRoute: () => ({ params: { id: 'test-event' } })
}))

// Mock error handler
vi.mock('../../utils/errorHandler', () => ({
  errorHandler: {
    handleError: vi.fn()
  }
}))

// Mock module loader
vi.mock('../../utils/moduleLoader', () => ({
  moduleLoader: {
    retryLoad: vi.fn()
  }
}))

describe('ModuleLoadErrorPage', () => {
  let wrapper: VueWrapper<any>

  const createWrapper = (props = {}) => {
    return mount(ModuleLoadErrorPage, {
      props: {
        modulePath: '/test/module.js',
        errorType: 'NETWORK_ERROR',
        maxRetries: 3,
        showDetails: true,
        showNetworkStatus: true,
        ...props
      },
      global: {
        stubs: {
          LoadingStateIndicator: true
        }
      }
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock store state
    mockStore.networkState.isOnline = true
    mockStore.connectionQuality = 'fast'
    mockStore.networkRetryCount = 0
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Error Display', () => {
    it('should display error page with correct title', () => {
      wrapper = createWrapper()
      
      const title = wrapper.find('.module-load-error-page__title')
      expect(title.exists()).toBe(true)
      expect(title.text()).toBe('页面加载失败')
    })

    it('should display correct error message for NETWORK_ERROR', () => {
      wrapper = createWrapper({ errorType: 'NETWORK_ERROR' })
      
      const subtitle = wrapper.find('.module-load-error-page__subtitle')
      expect(subtitle.text()).toContain('网络连接失败')
    })

    it('should display correct error message for MIME_ERROR', () => {
      wrapper = createWrapper({ errorType: 'MIME_ERROR' })
      
      const subtitle = wrapper.find('.module-load-error-page__subtitle')
      expect(subtitle.text()).toContain('服务器返回了错误的文件类型')
    })

    it('should display correct error message for TIMEOUT_ERROR', () => {
      wrapper = createWrapper({ errorType: 'TIMEOUT_ERROR' })
      
      const subtitle = wrapper.find('.module-load-error-page__subtitle')
      expect(subtitle.text()).toContain('页面加载超时')
    })

    it('should display error message from error object', () => {
      const error = new Error('Custom error message')
      
      wrapper = createWrapper({ error })
      
      const subtitle = wrapper.find('.module-load-error-page__subtitle')
      expect(subtitle.text()).toBe('Custom error message')
    })

    it('should display alert circle icon', () => {
      wrapper = createWrapper()
      
      const icon = wrapper.find('[data-testid="alert-circle-icon"]')
      expect(icon.exists()).toBe(true)
    })
  })

  describe('Error Details', () => {
    it('should show details toggle when showDetails is true', () => {
      wrapper = createWrapper({ showDetails: true })
      
      const toggle = wrapper.find('.module-load-error-page__details-toggle')
      expect(toggle.exists()).toBe(true)
      expect(toggle.text()).toContain('错误详情')
    })

    it('should hide details toggle when showDetails is false', () => {
      wrapper = createWrapper({ showDetails: false })
      
      const toggle = wrapper.find('.module-load-error-page__details-toggle')
      expect(toggle.exists()).toBe(false)
    })

    it('should toggle details content when clicked', async () => {
      wrapper = createWrapper({ showDetails: true })
      
      const toggle = wrapper.find('.module-load-error-page__details-toggle')
      const detailsContent = wrapper.find('.module-load-error-page__details-content')
      
      // Initially hidden
      expect(detailsContent.exists()).toBe(false)
      
      // Click to show
      await toggle.trigger('click')
      await nextTick()
      
      const detailsContentAfterClick = wrapper.find('.module-load-error-page__details-content')
      expect(detailsContentAfterClick.exists()).toBe(true)
    })

    it('should display module path in details', async () => {
      wrapper = createWrapper({ 
        showDetails: true,
        modulePath: '/test/specific-module.js'
      })
      
      const toggle = wrapper.find('.module-load-error-page__details-toggle')
      await toggle.trigger('click')
      await nextTick()
      
      const detailsContent = wrapper.find('.module-load-error-page__details-content')
      expect(detailsContent.text()).toContain('/test/specific-module.js')
    })

    it('should display retry count in details when retryCount > 0', async () => {
      wrapper = createWrapper({ showDetails: true })
      
      // Simulate retry
      await wrapper.find('.btn--primary').trigger('click')
      await nextTick()
      
      const toggle = wrapper.find('.module-load-error-page__details-toggle')
      await toggle.trigger('click')
      await nextTick()
      
      const detailsContent = wrapper.find('.module-load-error-page__details-content')
      expect(detailsContent.text()).toContain('重试次数')
    })
  })

  describe('Action Buttons', () => {
    it('should display all action buttons', () => {
      wrapper = createWrapper()
      
      const retryBtn = wrapper.find('.btn--primary')
      const refreshBtn = wrapper.find('.btn--ghost')
      const homeBtn = wrapper.find('.btn--flat')
      
      expect(retryBtn.exists()).toBe(true)
      expect(refreshBtn.exists()).toBe(true)
      expect(homeBtn.exists()).toBe(true)
      
      expect(retryBtn.text()).toContain('重试')
      expect(refreshBtn.text()).toContain('刷新页面')
      expect(homeBtn.text()).toContain('返回首页')
    })

    it('should emit retry event when retry button is clicked', async () => {
      wrapper = createWrapper()
      
      const retryBtn = wrapper.find('.btn--primary')
      await retryBtn.trigger('click')
      
      expect(wrapper.emitted('retry')).toBeTruthy()
    })

    it('should emit refresh event when refresh button is clicked', async () => {
      wrapper = createWrapper()
      
      const refreshBtn = wrapper.find('.btn--ghost')
      await refreshBtn.trigger('click')
      
      expect(wrapper.emitted('refresh')).toBeTruthy()
    })

    it('should emit goHome event when home button is clicked', async () => {
      wrapper = createWrapper()
      
      const homeBtn = wrapper.find('.btn--flat')
      await homeBtn.trigger('click')
      
      expect(wrapper.emitted('goHome')).toBeTruthy()
    })

    it('should disable retry button when max retries exceeded', async () => {
      wrapper = createWrapper({ maxRetries: 2 })
      
      const retryBtn = wrapper.find('.btn--primary')
      
      // Retry twice to reach limit
      await retryBtn.trigger('click')
      await nextTick()
      await retryBtn.trigger('click')
      await nextTick()
      
      expect(retryBtn.attributes('disabled')).toBeDefined()
      expect(retryBtn.text()).toContain('已达重试上限')
    })

    it('should show retry count in button text', async () => {
      wrapper = createWrapper({ maxRetries: 3 })
      
      const retryBtn = wrapper.find('.btn--primary')
      
      // First retry
      await retryBtn.trigger('click')
      await nextTick()
      
      expect(retryBtn.text()).toContain('重试 (1/3)')
    })

    it('should show loading state during retry', async () => {
      const onRetry = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      wrapper = createWrapper({ onRetry })
      
      const retryBtn = wrapper.find('.btn--primary')
      await retryBtn.trigger('click')
      await nextTick()
      
      // Should show loading state in the component itself
      expect(wrapper.vm.isRetrying).toBe(true)
    })
  })

  describe('Suggestions', () => {
    it('should display suggestions for NETWORK_ERROR', () => {
      wrapper = createWrapper({ errorType: 'NETWORK_ERROR' })
      
      const suggestions = wrapper.find('.module-load-error-page__suggestions')
      expect(suggestions.exists()).toBe(true)
      
      const suggestionItems = wrapper.findAll('.suggestion-item')
      expect(suggestionItems.length).toBeGreaterThan(0)
      
      const suggestionText = suggestions.text()
      expect(suggestionText).toContain('检查网络连接')
    })

    it('should display suggestions for MIME_ERROR', () => {
      wrapper = createWrapper({ errorType: 'MIME_ERROR' })
      
      const suggestions = wrapper.find('.module-load-error-page__suggestions')
      const suggestionText = suggestions.text()
      expect(suggestionText).toContain('刷新页面重新加载')
      expect(suggestionText).toContain('清除浏览器缓存')
    })

    it('should display suggestions for TIMEOUT_ERROR', () => {
      wrapper = createWrapper({ errorType: 'TIMEOUT_ERROR' })
      
      const suggestions = wrapper.find('.module-load-error-page__suggestions')
      const suggestionText = suggestions.text()
      expect(suggestionText).toContain('检查网络速度')
    })

    it('should display check circle icons for suggestions', () => {
      wrapper = createWrapper()
      
      const checkIcons = wrapper.findAll('[data-testid="check-circle-icon"]')
      expect(checkIcons.length).toBeGreaterThan(0)
    })
  })

  describe('Network Status', () => {
    it('should show network status when showNetworkStatus is true', () => {
      wrapper = createWrapper({ showNetworkStatus: true })
      
      const networkStatus = wrapper.find('.module-load-error-page__network')
      expect(networkStatus.exists()).toBe(true)
    })

    it('should hide network status when showNetworkStatus is false', () => {
      wrapper = createWrapper({ showNetworkStatus: false })
      
      const networkStatus = wrapper.find('.module-load-error-page__network')
      expect(networkStatus.exists()).toBe(false)
    })

    it('should display offline status when network is offline', () => {
      mockStore.networkState.isOnline = false
      wrapper = createWrapper({ showNetworkStatus: true })
      
      const networkStatus = wrapper.find('.module-load-error-page__network')
      expect(networkStatus.text()).toContain('网络连接已断开')
      
      const wifiOffIcon = wrapper.find('[data-testid="wifi-off-icon"]')
      expect(wifiOffIcon.exists()).toBe(true)
    })

    it('should display slow connection status', () => {
      mockStore.connectionQuality = 'slow'
      wrapper = createWrapper({ showNetworkStatus: true })
      
      const networkStatus = wrapper.find('.module-load-error-page__network')
      expect(networkStatus.text()).toContain('网络连接较慢')
    })

    it('should display normal connection status', () => {
      mockStore.networkState.isOnline = true
      mockStore.connectionQuality = 'fast'
      wrapper = createWrapper({ showNetworkStatus: true })
      
      const networkStatus = wrapper.find('.module-load-error-page__network')
      expect(networkStatus.text()).toContain('网络连接正常')
      
      const wifiIcon = wrapper.find('[data-testid="wifi-icon"]')
      expect(wifiIcon.exists()).toBe(true)
    })
  })

  describe('Timeout Display', () => {
    it('should show timeout message when showTimeout is true', () => {
      wrapper = createWrapper({ showTimeout: true })
      
      const timeout = wrapper.find('.module-load-error-page__timeout')
      expect(timeout.exists()).toBe(true)
      expect(timeout.text()).toContain('页面加载已超时')
      
      const clockIcon = wrapper.find('[data-testid="clock-icon"]')
      expect(clockIcon.exists()).toBe(true)
    })

    it('should hide timeout message when showTimeout is false', () => {
      wrapper = createWrapper({ showTimeout: false })
      
      const timeout = wrapper.find('.module-load-error-page__timeout')
      expect(timeout.exists()).toBe(false)
    })
  })

  describe('Custom Callbacks', () => {
    it('should call custom onRetry callback', async () => {
      const onRetry = vi.fn().mockResolvedValue(undefined)
      wrapper = createWrapper({ onRetry })
      
      const retryBtn = wrapper.find('.btn--primary')
      await retryBtn.trigger('click')
      
      expect(onRetry).toHaveBeenCalled()
    })

    it('should call custom onRefresh callback', async () => {
      const onRefresh = vi.fn()
      wrapper = createWrapper({ onRefresh })
      
      const refreshBtn = wrapper.find('.btn--ghost')
      await refreshBtn.trigger('click')
      
      expect(onRefresh).toHaveBeenCalled()
    })

    it('should call custom onGoHome callback', async () => {
      const onGoHome = vi.fn()
      wrapper = createWrapper({ onGoHome })
      
      const homeBtn = wrapper.find('.btn--flat')
      await homeBtn.trigger('click')
      
      expect(onGoHome).toHaveBeenCalled()
    })

    it('should use default router navigation when no custom callback provided', async () => {
      wrapper = createWrapper()
      
      const homeBtn = wrapper.find('.btn--flat')
      await homeBtn.trigger('click')
      
      expect(mockRouter.push).toHaveBeenCalledWith('/events')
    })
  })

  describe('Error Logging', () => {
    it('should log error on mount', () => {
      const errorHandlerMock = vi.mocked(require('../../utils/errorHandler').errorHandler)
      
      wrapper = createWrapper()
      
      expect(errorHandlerMock.handleError).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      wrapper = createWrapper({ showDetails: true })
      
      const toggle = wrapper.find('.module-load-error-page__details-toggle')
      expect(toggle.attributes('aria-expanded')).toBeDefined()
    })

    it('should update aria-expanded when details are toggled', async () => {
      wrapper = createWrapper({ showDetails: true })
      
      const toggle = wrapper.find('.module-load-error-page__details-toggle')
      
      // Initially collapsed
      expect(toggle.attributes('aria-expanded')).toBe('false')
      
      // Click to expand
      await toggle.trigger('click')
      await nextTick()
      
      expect(toggle.attributes('aria-expanded')).toBe('true')
    })
  })
})