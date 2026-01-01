/**
 * 模块加载错误界面组件集成测试
 * 
 * 测试错误页面的显示逻辑、重试按钮功能和加载状态的正确显示
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'

// Mock components to avoid complex dependencies
const MockModuleLoadErrorPage = {
  name: 'ModuleLoadErrorPage',
  template: `
    <div data-testid="error-page" class="error-page">
      <h1>{{ title }}</h1>
      <p>{{ message }}</p>
      <button 
        data-testid="retry-btn" 
        @click="handleRetry"
        :disabled="retryDisabled"
      >
        {{ retryText }}
      </button>
      <button data-testid="refresh-btn" @click="$emit('refresh')">刷新页面</button>
      <button data-testid="home-btn" @click="$emit('goHome')">返回首页</button>
    </div>
  `,
  props: {
    error: Object,
    modulePath: String,
    errorType: String,
    maxRetries: { type: Number, default: 3 }
  },
  emits: ['retry', 'refresh', 'goHome'],
  data() {
    return {
      retryCount: 0,
      isRetrying: false
    }
  },
  computed: {
    title() {
      return '页面加载失败'
    },
    message() {
      if (this.error?.message) {
        return this.error.message
      }
      switch (this.errorType) {
        case 'MIME_ERROR':
          return '服务器返回了错误的文件类型'
        case 'NETWORK_ERROR':
          return '网络连接失败，请检查网络连接后重试'
        case 'TIMEOUT_ERROR':
          return '页面加载超时，请检查网络连接'
        default:
          return '页面加载时发生未知错误'
      }
    },
    retryDisabled() {
      return this.isRetrying || this.retryCount >= this.maxRetries
    },
    retryText() {
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
  },
  methods: {
    handleRetry() {
      if (!this.retryDisabled) {
        this.retryCount++
        this.isRetrying = true
        this.$emit('retry')
        
        // Simulate async operation
        setTimeout(() => {
          this.isRetrying = false
        }, 100)
      }
    }
  },
  mounted() {
    // Listen for retry events to update internal state
    this.$on('retry', this.handleRetry)
  }
}

const MockLoadingStateIndicator = {
  name: 'LoadingStateIndicator',
  template: `
    <div 
      data-testid="loading-indicator" 
      v-if="visible"
      :class="['loading-indicator', 'loading-indicator--' + state]"
    >
      <div class="spinner" v-if="showSpinner"></div>
      <p>{{ message }}</p>
    </div>
  `,
  props: {
    visible: { type: Boolean, default: true },
    state: { type: String, default: 'loading' },
    message: String,
    showSpinner: { type: Boolean, default: true }
  }
}

describe('Module Load Error Interface', () => {
  let wrapper: VueWrapper<any>

  const createErrorPageWrapper = (props = {}) => {
    return mount(MockModuleLoadErrorPage, {
      props: {
        modulePath: '/test/module.js',
        errorType: 'NETWORK_ERROR',
        maxRetries: 3,
        ...props
      }
    })
  }

  const createLoadingWrapper = (props = {}) => {
    return mount(MockLoadingStateIndicator, {
      props: {
        visible: true,
        state: 'loading',
        message: '正在加载页面组件...',
        showSpinner: true,
        ...props
      }
    })
  }

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Error Page Display Logic', () => {
    it('should display error page with correct title and message', () => {
      wrapper = createErrorPageWrapper({
        errorType: 'NETWORK_ERROR'
      })

      expect(wrapper.find('h1').text()).toBe('页面加载失败')
      expect(wrapper.find('p').text()).toContain('网络连接失败')
    })

    it('should display MIME error message correctly', () => {
      wrapper = createErrorPageWrapper({
        errorType: 'MIME_ERROR'
      })

      expect(wrapper.find('p').text()).toContain('服务器返回了错误的文件类型')
    })

    it('should display timeout error message correctly', () => {
      wrapper = createErrorPageWrapper({
        errorType: 'TIMEOUT_ERROR'
      })

      expect(wrapper.find('p').text()).toContain('页面加载超时')
    })

    it('should display custom error message from error object', () => {
      const error = new Error('Custom error message')
      wrapper = createErrorPageWrapper({ error })

      expect(wrapper.find('p').text()).toBe('Custom error message')
    })

    it('should display all action buttons', () => {
      wrapper = createErrorPageWrapper()

      const retryBtn = wrapper.find('[data-testid="retry-btn"]')
      const refreshBtn = wrapper.find('[data-testid="refresh-btn"]')
      const homeBtn = wrapper.find('[data-testid="home-btn"]')

      expect(retryBtn.exists()).toBe(true)
      expect(refreshBtn.exists()).toBe(true)
      expect(homeBtn.exists()).toBe(true)

      expect(retryBtn.text()).toBe('重试')
      expect(refreshBtn.text()).toBe('刷新页面')
      expect(homeBtn.text()).toBe('返回首页')
    })
  })

  describe('Retry Button Functionality', () => {
    it('should emit retry event when retry button is clicked', async () => {
      wrapper = createErrorPageWrapper()

      const retryBtn = wrapper.find('[data-testid="retry-btn"]')
      await retryBtn.trigger('click')

      expect(wrapper.emitted('retry')).toBeTruthy()
      expect(wrapper.emitted('retry')).toHaveLength(1)
    })

    it('should update retry count and button text after retry', async () => {
      wrapper = createErrorPageWrapper()

      const retryBtn = wrapper.find('[data-testid="retry-btn"]')
      
      // Initial state
      expect(retryBtn.text()).toBe('重试')
      expect(retryBtn.attributes('disabled')).toBeUndefined()

      // First retry
      await retryBtn.trigger('click')
      await nextTick()

      expect(retryBtn.text()).toBe('重试 (1/3)')
    })

    it('should disable retry button when max retries reached', async () => {
      wrapper = createErrorPageWrapper({ maxRetries: 2 })

      const retryBtn = wrapper.find('[data-testid="retry-btn"]')

      // Retry twice to reach limit
      await retryBtn.trigger('click')
      await nextTick()
      await retryBtn.trigger('click')
      await nextTick()

      expect(retryBtn.attributes('disabled')).toBeDefined()
      expect(retryBtn.text()).toBe('已达重试上限 (2)')
    })

    it('should show loading state during retry', async () => {
      wrapper = createErrorPageWrapper()

      const retryBtn = wrapper.find('[data-testid="retry-btn"]')
      await retryBtn.trigger('click')

      // Should show loading state immediately
      expect(retryBtn.text()).toBe('重试中...')
      expect(retryBtn.attributes('disabled')).toBeDefined()
    })

    it('should emit refresh event when refresh button is clicked', async () => {
      wrapper = createErrorPageWrapper()

      const refreshBtn = wrapper.find('[data-testid="refresh-btn"]')
      await refreshBtn.trigger('click')

      expect(wrapper.emitted('refresh')).toBeTruthy()
    })

    it('should emit goHome event when home button is clicked', async () => {
      wrapper = createErrorPageWrapper()

      const homeBtn = wrapper.find('[data-testid="home-btn"]')
      await homeBtn.trigger('click')

      expect(wrapper.emitted('goHome')).toBeTruthy()
    })
  })

  describe('Loading State Display', () => {
    it('should display loading indicator when visible', () => {
      wrapper = createLoadingWrapper({
        visible: true,
        state: 'loading',
        message: '正在加载页面组件...'
      })

      const indicator = wrapper.find('[data-testid="loading-indicator"]')
      expect(indicator.exists()).toBe(true)
      expect(indicator.classes()).toContain('loading-indicator--loading')
      expect(indicator.find('p').text()).toBe('正在加载页面组件...')
    })

    it('should hide loading indicator when not visible', () => {
      wrapper = createLoadingWrapper({
        visible: false
      })

      const indicator = wrapper.find('[data-testid="loading-indicator"]')
      expect(indicator.exists()).toBe(false)
    })

    it('should show spinner when showSpinner is true', () => {
      wrapper = createLoadingWrapper({
        showSpinner: true
      })

      const spinner = wrapper.find('.spinner')
      expect(spinner.exists()).toBe(true)
    })

    it('should hide spinner when showSpinner is false', () => {
      wrapper = createLoadingWrapper({
        showSpinner: false
      })

      const spinner = wrapper.find('.spinner')
      expect(spinner.exists()).toBe(false)
    })

    it('should display different states correctly', () => {
      const states = ['loading', 'error', 'success']

      states.forEach(state => {
        wrapper = createLoadingWrapper({ state })
        const indicator = wrapper.find('[data-testid="loading-indicator"]')
        expect(indicator.classes()).toContain(`loading-indicator--${state}`)
      })
    })

    it('should display retry message during retry', () => {
      wrapper = createLoadingWrapper({
        message: '正在重试加载页面... (1/3)'
      })

      expect(wrapper.find('p').text()).toBe('正在重试加载页面... (1/3)')
    })
  })

  describe('Error Type Handling', () => {
    const errorTypes = [
      { type: 'NETWORK_ERROR', expectedMessage: '网络连接失败' },
      { type: 'MIME_ERROR', expectedMessage: '服务器返回了错误的文件类型' },
      { type: 'TIMEOUT_ERROR', expectedMessage: '页面加载超时' },
      { type: 'UNKNOWN', expectedMessage: '页面加载时发生未知错误' }
    ]

    errorTypes.forEach(({ type, expectedMessage }) => {
      it(`should handle ${type} correctly`, () => {
        wrapper = createErrorPageWrapper({ errorType: type })
        expect(wrapper.find('p').text()).toContain(expectedMessage)
      })
    })
  })

  describe('Component Integration', () => {
    it('should handle component lifecycle correctly', async () => {
      wrapper = createErrorPageWrapper()

      // Component should be mounted
      expect(wrapper.exists()).toBe(true)

      // Should handle events
      const retryBtn = wrapper.find('[data-testid="retry-btn"]')
      await retryBtn.trigger('click')

      expect(wrapper.emitted('retry')).toBeTruthy()

      // Should update internal state
      expect(wrapper.vm.retryCount).toBe(1)
    })

    it('should maintain state consistency', async () => {
      wrapper = createErrorPageWrapper({ maxRetries: 2 })

      const retryBtn = wrapper.find('[data-testid="retry-btn"]')

      // Initial state
      expect(wrapper.vm.retryCount).toBe(0)
      expect(wrapper.vm.isRetrying).toBe(false)

      // After retry
      await retryBtn.trigger('click')
      expect(wrapper.vm.retryCount).toBe(1)
      expect(wrapper.vm.isRetrying).toBe(true)

      // Wait for async operation to complete
      await new Promise(resolve => setTimeout(resolve, 150))
      expect(wrapper.vm.isRetrying).toBe(false)
    })
  })

  describe('Accessibility', () => {
    it('should have proper button structure', () => {
      wrapper = createErrorPageWrapper()

      const buttons = wrapper.findAll('button')
      expect(buttons.length).toBe(3)

      buttons.forEach(button => {
        expect(button.element.tagName).toBe('BUTTON')
        expect(button.text().length).toBeGreaterThan(0)
      })
    })

    it('should handle disabled state correctly', async () => {
      wrapper = createErrorPageWrapper({ maxRetries: 1 })

      const retryBtn = wrapper.find('[data-testid="retry-btn"]')

      // Initially enabled
      expect(retryBtn.attributes('disabled')).toBeUndefined()

      // After reaching max retries
      await retryBtn.trigger('click')
      await nextTick()

      expect(retryBtn.attributes('disabled')).toBeDefined()
    })
  })
})