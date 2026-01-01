/**
 * Minimal responsive design tests for GlobalBanner component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import GlobalBanner from '../../components/feedback/GlobalBanner.vue'

// Mock store
const mockStore = {
  bannerError: '',
  bannerInfo: '',
  setBanner: vi.fn(),
  networkState: {
    isOnline: true,
    effectiveType: '4g',
    rtt: 100,
    downlink: 10
  },
  connectionQuality: 'good',
  networkRetryCount: 0
}

// Mock useAppStore
vi.mock('../../store/appStore', () => ({
  useAppStore: () => mockStore
}))

describe('Responsive Design Tests (Minimal)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.bannerError = ''
    mockStore.bannerInfo = ''
  })

  it('should render banner with error message', async () => {
    mockStore.bannerError = '测试错误消息'
    
    const wrapper = mount(GlobalBanner)
    await nextTick()
    
    // Wait for debounced message update (50ms + buffer)
    await new Promise(resolve => setTimeout(resolve, 100))
    await nextTick()
    
    const banner = wrapper.find('.toast-notification')
    expect(banner.exists()).toBe(true)
  })

  it('should render banner with info message', async () => {
    mockStore.bannerInfo = '测试信息消息'
    
    const wrapper = mount(GlobalBanner)
    await nextTick()
    
    // Wait for debounced message update (50ms + buffer)
    await new Promise(resolve => setTimeout(resolve, 100))
    await nextTick()
    
    const banner = wrapper.find('.toast-notification')
    expect(banner.exists()).toBe(true)
  })
})