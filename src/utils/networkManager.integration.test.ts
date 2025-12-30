/**
 * Integration Tests for Network Manager
 * 
 * Tests the integration of NetworkManager with the existing application structure
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { 
  NetworkManager, 
  networkManager, 
  isOnline, 
  getConnectionQuality, 
  getNetworkState, 
  executeNetworkRequest,
  addNetworkStateListener
} from './networkManager'

describe('Network Manager Integration Tests', () => {
  let originalFetch: typeof global.fetch
  let originalNavigator: typeof global.navigator

  beforeEach(() => {
    originalFetch = global.fetch
    global.fetch = vi.fn()

    originalNavigator = global.navigator
    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        onLine: true
      },
      writable: true
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
    global.navigator = originalNavigator
  })

  it('should export singleton instance and convenience functions', () => {
    expect(networkManager).toBeInstanceOf(NetworkManager)
    expect(typeof isOnline).toBe('function')
    expect(typeof getConnectionQuality).toBe('function')
    expect(typeof getNetworkState).toBe('function')
    expect(typeof executeNetworkRequest).toBe('function')
    expect(typeof addNetworkStateListener).toBe('function')
  })

  it('should provide correct network state information', () => {
    const state = getNetworkState()
    expect(state).toHaveProperty('isOnline')
    expect(state).toHaveProperty('connectionType')
    expect(state).toHaveProperty('effectiveType')
    expect(state).toHaveProperty('downlink')
    expect(state).toHaveProperty('rtt')
    expect(state).toHaveProperty('saveData')

    expect(typeof state.isOnline).toBe('boolean')
    expect(typeof state.connectionType).toBe('string')
    expect(typeof state.effectiveType).toBe('string')
  })

  it('should handle successful network requests', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: 'test' })
    } as Response)

    const result = await executeNetworkRequest('https://api.example.com/test')
    expect(result).toEqual({ success: true, data: 'test' })
  })

  it('should handle network request failures', async () => {
    // Create a new instance to avoid singleton state issues
    const testManager = new NetworkManager({
      maxRetries: 1,
      baseDelay: 10,
      maxDelay: 100,
      backoffMultiplier: 1.5
    })

    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockRejectedValue(new Error('Network error'))

    await expect(
      testManager.executeRequest({
        url: 'https://api.example.com/test',
        method: 'GET',
        priority: 'medium',
        maxRetries: 1
      })
    ).rejects.toThrow('Network error')

    testManager.dispose()
  })

  it('should allow network state listeners', () => {
    let listenerCalled = false
    const removeListener = addNetworkStateListener((state) => {
      listenerCalled = true
      expect(state).toHaveProperty('isOnline')
    })

    expect(typeof removeListener).toBe('function')
    
    // Simulate network state change
    Object.defineProperty(global.navigator, 'onLine', {
      value: false,
      writable: true
    })
    
    // Trigger offline event
    window.dispatchEvent(new Event('offline'))
    
    // Clean up
    removeListener()
  })

  it('should integrate with existing error handling patterns', async () => {
    // Create a new instance to avoid singleton state issues
    const testManager = new NetworkManager({
      maxRetries: 1,
      baseDelay: 10,
      maxDelay: 100,
      backoffMultiplier: 1.5
    })

    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ error: 'Server error' })
    } as Response)

    try {
      await testManager.executeRequest({
        url: 'https://api.example.com/test',
        method: 'POST',
        data: { test: 'data' },
        priority: 'medium',
        maxRetries: 1
      })
    } catch (error: any) {
      expect(error.message).toMatch(/HTTP 500/)
      expect(error.message).toMatch(/Internal Server Error/)
    }

    testManager.dispose()
  })

  it('should provide status information', () => {
    const status = networkManager.getStatus()
    expect(status).toHaveProperty('isOnline')
    expect(status).toHaveProperty('connectionQuality')
    expect(status).toHaveProperty('queueStatus')
    expect(status).toHaveProperty('failedRequests')

    expect(typeof status.isOnline).toBe('boolean')
    expect(['fast', 'slow', 'offline']).toContain(status.connectionQuality)
    expect(typeof status.queueStatus.pending).toBe('number')
    expect(typeof status.queueStatus.processing).toBe('boolean')
    expect(typeof status.failedRequests).toBe('number')
  })
})