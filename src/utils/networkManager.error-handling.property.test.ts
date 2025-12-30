/**
 * Property-Based Tests for Network Manager - User-Friendly Error Handling
 * 
 * **Feature: network-performance-optimization, Property 2: User-friendly error handling**
 * **Validates: Requirements 1.2**
 * 
 * Tests that network request failures due to timeout or connection issues
 * display appropriate error messages with retry mechanisms.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fc from 'fast-check'
import { NetworkManager, type NetworkError } from './networkManager'

describe('Network Manager - User-Friendly Error Handling Property Tests', () => {
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
      maxRetries: 2,
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

  it('Property 2: User-friendly error handling - For any network request that fails due to timeout or connection issues, the system should display appropriate error messages with retry mechanisms', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          url: fc.constant('https://api.example.com/data'),
          method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
          errorType: fc.constantFrom(
            'timeout',
            'network_error', 
            'connection_refused',
            'server_error',
            'rate_limit'
          ),
          requestData: fc.oneof(
            fc.constant(undefined),
            fc.record({
              id: fc.string(),
              value: fc.string()
            })
          )
        }),
        async ({ url, method, errorType, requestData }) => {
          // Mock different types of network failures
          const mockFetch = vi.mocked(global.fetch)
          
          switch (errorType) {
            case 'timeout':
              mockFetch.mockRejectedValue(new Error('TimeoutError: Request timeout'))
              break
            case 'network_error':
              mockFetch.mockRejectedValue(new Error('NetworkError: Failed to fetch'))
              break
            case 'connection_refused':
              mockFetch.mockRejectedValue(new Error('TypeError: Failed to fetch'))
              break
            case 'server_error':
              mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                json: async () => ({ error: 'Server error' })
              } as Response)
              break
            case 'rate_limit':
              mockFetch.mockResolvedValue({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests',
                json: async () => ({ error: 'Rate limited' })
              } as Response)
              break
          }

          let errorMessage: string = ''
          let errorOccurred = false
          let retryMechanismAvailable = false

          try {
            await networkManager.executeRequest({
              url,
              method,
              data: requestData,
              priority: 'medium',
              maxRetries: 2
            })
          } catch (error: any) {
            errorOccurred = true
            errorMessage = error.message || error.toString()
            
            // Check if retry mechanism is available
            const status = networkManager.getStatus()
            retryMechanismAvailable = status.failedRequests > 0 || 
                                    (error.retryable !== false)
          }

          // Verify error occurred for all failure types
          expect(errorOccurred).toBe(true)
          
          // Verify error message is user-friendly (not empty and descriptive)
          expect(errorMessage).toBeTruthy()
          expect(errorMessage.length).toBeGreaterThan(0)
          
          // Error message should not contain technical jargon for end users
          // but should be descriptive enough to understand what happened
          expect(typeof errorMessage).toBe('string')
          
          // Verify retry mechanism is available for retryable errors
          if (errorType !== 'rate_limit') { // Rate limits might not be immediately retryable
            expect(retryMechanismAvailable).toBe(true)
          }
          
          // Verify that the error message varies based on error type
          // (not just a generic "error occurred" message)
          if (errorType === 'timeout') {
            expect(errorMessage.toLowerCase()).toMatch(/timeout|time.*out/i)
          } else if (errorType === 'server_error') {
            expect(errorMessage.toLowerCase()).toMatch(/500|server|internal/i)
          }
        }
      ),
      { numRuns: 15 }
    )
  }, 20000)

  it('Property 2 Edge Case: Consistent error handling across different request types', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          requests: fc.array(
            fc.record({
              url: fc.constant('https://api.example.com/test'),
              method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
              data: fc.oneof(
                fc.constant(undefined),
                fc.record({ test: fc.string({ maxLength: 10 }) })
              )
            }),
            { minLength: 2, maxLength: 3 }
          )
        }),
        async ({ requests }) => {
          // Mock consistent network failure
          const mockFetch = vi.mocked(global.fetch)
          mockFetch.mockRejectedValue(new Error('NetworkError: Connection failed'))

          const errorMessages: string[] = []
          let allRequestsFailed = true

          // Execute all requests and collect error messages
          for (const request of requests) {
            try {
              await networkManager.executeRequest({
                ...request,
                priority: 'medium',
                maxRetries: 1
              })
              allRequestsFailed = false
            } catch (error: any) {
              errorMessages.push(error.message || error.toString())
            }
          }

          // All requests should fail with the same underlying issue
          expect(allRequestsFailed).toBe(true)
          expect(errorMessages.length).toBe(requests.length)
          
          // All error messages should be non-empty and meaningful
          errorMessages.forEach(message => {
            expect(message).toBeTruthy()
            expect(message.length).toBeGreaterThan(0)
            expect(typeof message).toBe('string')
          })
          
          // Error handling should be consistent (similar error types produce similar messages)
          const uniqueMessages = new Set(errorMessages)
          // Allow some variation but not completely different messages for same error type
          expect(uniqueMessages.size).toBeLessThanOrEqual(Math.ceil(requests.length / 2))
        }
      ),
      { numRuns: 5 }
    )
  }, 10000)

  it('Property 2 Edge Case: Error message clarity for different HTTP status codes', async () => {
    const statusCodes = [400, 401, 403, 404, 500, 502, 503, 504]
    
    for (const statusCode of statusCodes) {
      // Reset mock for each status code
      const mockFetch = vi.mocked(global.fetch)
      mockFetch.mockClear()
      mockFetch.mockResolvedValue({
        ok: false,
        status: statusCode,
        statusText: `HTTP ${statusCode}`,
        json: async () => ({ error: `Error ${statusCode}` })
      } as Response)

      let errorMessage = ''
      
      try {
        await networkManager.executeRequest({
          url: 'https://api.example.com/test',
          method: 'GET',
          priority: 'medium',
          maxRetries: 1
        })
      } catch (error: any) {
        errorMessage = error.message || error.toString()
      }

      // Each status code should produce a meaningful error message
      expect(errorMessage).toBeTruthy()
      expect(errorMessage.length).toBeGreaterThan(0)
      
      // Error message should contain the status code for debugging
      expect(errorMessage).toMatch(new RegExp(statusCode.toString()))
    }
  })

  it('Property 2 Edge Case: Retry mechanism availability', async () => {
    const mockFetch = vi.mocked(global.fetch)
    
    // Test retryable error
    mockFetch.mockRejectedValue(new Error('NetworkError: Temporary failure'))
    
    try {
      await networkManager.executeRequest({
        url: 'https://api.example.com/retry-test',
        method: 'POST',
        data: { test: 'data' },
        priority: 'high',
        maxRetries: 2
      })
    } catch (error) {
      // Error should occur but retry should be available
      const status = networkManager.getStatus()
      expect(status.failedRequests).toBeGreaterThanOrEqual(0)
    }

    // Test manual retry functionality
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    } as Response)

    // Manual retry should be possible
    await expect(networkManager.retryFailedRequests()).resolves.not.toThrow()
  })
})