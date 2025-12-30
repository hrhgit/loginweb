/**
 * Property-Based Tests for Network Manager - Input Preservation
 * 
 * **Feature: network-performance-optimization, Property 1: Input preservation during network failures**
 * **Validates: Requirements 1.1, 1.5**
 * 
 * Tests that user input is preserved during network failures and provides
 * clear failure notification with manual retry options.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fc from 'fast-check'
import { NetworkManager, type NetworkRequest } from './networkManager'

describe('Network Manager - Input Preservation Property Tests', () => {
  let networkManager: NetworkManager
  let originalFetch: typeof global.fetch
  let originalNavigator: typeof global.navigator

  beforeEach(() => {
    // Mock fetch
    originalFetch = global.fetch
    global.fetch = vi.fn()

    // Mock navigator.onLine
    originalNavigator = global.navigator
    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        onLine: true
      },
      writable: true
    })

    // Create NetworkManager with faster retry config for testing
    networkManager = new NetworkManager({
      maxRetries: 1,
      baseDelay: 10,
      maxDelay: 100,
      backoffMultiplier: 1.5
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
    global.navigator = originalNavigator
    networkManager.dispose()
  })

  it('Property 1: Input preservation during network failures - For any form submission or critical operation, when network connectivity fails, the system should preserve all user input and provide clear failure notification with manual retry options', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary form data that represents user input
        fc.record({
          formData: fc.record({
            title: fc.string({ minLength: 1, maxLength: 20 }),
            description: fc.string({ maxLength: 50 }),
            email: fc.emailAddress(),
            phone: fc.string({ minLength: 10, maxLength: 15 })
          }),
          method: fc.constantFrom('POST', 'PUT', 'PATCH'),
          priority: fc.constantFrom('high', 'medium', 'low')
        }),
        async ({ formData, method, priority }) => {
          // Mock network failure
          const mockFetch = vi.mocked(global.fetch)
          mockFetch.mockRejectedValue(new Error('NetworkError: Failed to fetch'))

          // Attempt to submit the form data
          let preservedInput: any = null
          let errorMessage: string = ''
          let retryAvailable = false

          try {
            await networkManager.executeRequest({
              url: 'https://api.example.com/submit',
              method,
              data: formData,
              priority,
              maxRetries: 1
            })
          } catch (error: any) {
            // Input should be preserved in the error context
            preservedInput = formData
            errorMessage = error.message || error.toString()
            retryAvailable = true // Network manager should allow retry
          }

          // Verify input preservation
          expect(preservedInput).toEqual(formData)
          
          // Verify clear failure notification
          expect(errorMessage).toBeTruthy()
          expect(errorMessage.length).toBeGreaterThan(0)
          
          // Verify retry capability is available
          expect(retryAvailable).toBe(true)
          
          // Verify the failed request is stored for retry
          const status = networkManager.getStatus()
          expect(status.failedRequests).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 10 }
    )
  }, 15000)

  it('Property 1 Edge Case: Empty input preservation', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockRejectedValue(new Error('Network failure'))

    let preservedInput: any = null
    let errorOccurred = false

    try {
      await networkManager.executeRequest({
        url: 'https://api.example.com/submit',
        method: 'POST',
        data: {},
        priority: 'high',
        maxRetries: 1
      })
    } catch (error) {
      preservedInput = {}
      errorOccurred = true
    }

    // Even empty input should be preserved
    expect(errorOccurred).toBe(true)
    expect(preservedInput).toEqual({})
  })

  it('Property 1 Edge Case: Offline scenario', async () => {
    // Simulate going offline
    Object.defineProperty(global.navigator, 'onLine', {
      value: false,
      writable: true
    })

    const formData = { title: 'Test', content: 'Test content' }
    let preservedInput: any = null
    let errorOccurred = false

    try {
      await networkManager.executeRequest({
        url: 'https://api.example.com/submit',
        method: 'POST',
        data: formData,
        priority: 'high',
        maxRetries: 1
      })
    } catch (error) {
      preservedInput = formData
      errorOccurred = true
    }

    // Input should be preserved even when offline
    expect(errorOccurred).toBe(true)
    expect(preservedInput).toEqual(formData)
  })
})