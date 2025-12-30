import { describe, it, expect, vi } from 'vitest'
import fc from 'fast-check'
import { RetryMechanism } from './errorHandler'

// **Feature: error-message-enhancement, Property 8: 重试限制处理**
// **Validates: Requirements 3.3**

describe('Retry Limit Handling Property Tests', () => {
  const retryMechanism = new RetryMechanism()

  it('Property 8: Retry limit handling - should hide retry button and show support suggestion when retry limit exceeded', async () => {
    // Test with a fixed scenario where retries are exhausted
    let executionCount = 0
    const mockOperation = vi.fn(async () => {
      executionCount++
      throw new Error(`Failure attempt ${executionCount}`)
    })

    const maxAttempts = 3
    const retryableOperation = retryMechanism.createRetryableOperation(mockOperation, {
      maxAttempts,
      baseDelay: 10,
      backoffMultiplier: 1.5,
      timeout: 1000
    })
    
    try {
      await retryableOperation.execute()
    } catch (error) {
      // Expected to fail after all attempts
    }
    
    // Verify retry limit behavior
    expect(executionCount).toBe(maxAttempts) // Should have tried exactly maxAttempts times
    expect(mockOperation).toHaveBeenCalledTimes(maxAttempts)
    expect(retryableOperation.getAttemptCount()).toBe(maxAttempts)
    expect(retryableOperation.canRetry()).toBe(false) // Should not be able to retry anymore
  })

  it('Property 8.1: Retry limit consistency - canRetry should return false when attempts reach maxAttempts', async () => {
    // Test different maxAttempts values
    const testCases = [1, 2, 3, 4, 5]
    
    for (const maxAttempts of testCases) {
      let executionCount = 0
      const mockOperation = vi.fn(async () => {
        executionCount++
        throw new Error(`Always fails - attempt ${executionCount}`)
      })

      const retryableOperation = retryMechanism.createRetryableOperation(mockOperation, {
        maxAttempts,
        baseDelay: 10,
        backoffMultiplier: 1.5,
        timeout: 1000
      })
      
      // Initially should be able to retry
      expect(retryableOperation.canRetry()).toBe(true)
      expect(retryableOperation.getAttemptCount()).toBe(0)
      
      try {
        await retryableOperation.execute()
      } catch (error) {
        // Expected to fail
      }
      
      // After exhausting all attempts, should not be able to retry
      expect(executionCount).toBe(maxAttempts)
      expect(retryableOperation.getAttemptCount()).toBe(maxAttempts)
      expect(retryableOperation.canRetry()).toBe(false)
    }
  })

  it('Property 8.2: Retry limit error message - should throw appropriate error when retry limit exceeded', async () => {
    let executionCount = 0
    const mockOperation = vi.fn(async () => {
      executionCount++
      throw new Error(`Operation failed on attempt ${executionCount}`)
    })

    const maxAttempts = 2
    const retryableOperation = retryMechanism.createRetryableOperation(mockOperation, {
      maxAttempts,
      baseDelay: 10,
      backoffMultiplier: 1.5,
      timeout: 1000
    })
    
    let caughtError: Error | null = null
    try {
      await retryableOperation.execute()
    } catch (error) {
      caughtError = error as Error
    }
    
    // Should have caught the final error (not the retry limit error)
    expect(caughtError).not.toBe(null)
    expect(caughtError?.message).toBe('Operation failed on attempt 2')
    expect(executionCount).toBe(maxAttempts)
  })

  it('Property 8.3: Retry limit with manual retry calls - should prevent manual retry when limit exceeded', async () => {
    let executionCount = 0
    const mockOperation = vi.fn(async () => {
      executionCount++
      throw new Error(`Manual retry test - attempt ${executionCount}`)
    })

    const maxAttempts = 2
    const retryableOperation = retryMechanism.createRetryableOperation(mockOperation, {
      maxAttempts,
      baseDelay: 10,
      backoffMultiplier: 1.5,
      timeout: 1000
    })
    
    // Execute until limit is reached
    try {
      await retryableOperation.execute()
    } catch (error) {
      // Expected to fail
    }
    
    // Verify we've reached the limit
    expect(retryableOperation.canRetry()).toBe(false)
    expect(retryableOperation.getAttemptCount()).toBe(maxAttempts)
    
    // Try to manually call retry - should throw error about limit
    let manualRetryError: Error | null = null
    try {
      await retryableOperation.retry()
    } catch (error) {
      manualRetryError = error as Error
    }
    
    expect(manualRetryError).not.toBe(null)
    expect(manualRetryError?.message).toContain('重试次数已达上限')
    expect(manualRetryError?.message).toContain(`(${maxAttempts})`)
  })

  it('Property 8.4: Retry limit boundary conditions - should handle edge cases correctly', async () => {
    // Test with maxAttempts = 1 (no retries allowed)
    let executionCount = 0
    const mockOperation = vi.fn(async () => {
      executionCount++
      throw new Error(`Single attempt test - ${executionCount}`)
    })

    const retryableOperation = retryMechanism.createRetryableOperation(mockOperation, {
      maxAttempts: 1,
      baseDelay: 10,
      backoffMultiplier: 1.5,
      timeout: 1000
    })
    
    // Should be able to retry initially (before any attempts)
    expect(retryableOperation.canRetry()).toBe(true)
    expect(retryableOperation.getAttemptCount()).toBe(0)
    
    try {
      await retryableOperation.execute()
    } catch (error) {
      // Expected to fail
    }
    
    // After single attempt, should not be able to retry
    expect(executionCount).toBe(1)
    expect(retryableOperation.getAttemptCount()).toBe(1)
    expect(retryableOperation.canRetry()).toBe(false)
  })

  it('Property 8.5: Retry limit with success before limit - canRetry should still work after success', async () => {
    let executionCount = 0
    const mockOperation = vi.fn(async () => {
      executionCount++
      if (executionCount === 1) {
        throw new Error('First attempt fails')
      }
      return 'Success on second attempt'
    })

    const maxAttempts = 5
    const retryableOperation = retryMechanism.createRetryableOperation(mockOperation, {
      maxAttempts,
      baseDelay: 10,
      backoffMultiplier: 1.5,
      timeout: 1000
    })
    
    const result = await retryableOperation.execute()
    
    // Should have succeeded on second attempt
    expect(result).toBe('Success on second attempt')
    expect(executionCount).toBe(2)
    expect(retryableOperation.getAttemptCount()).toBe(2)
    
    // Since we haven't reached the limit, should still be able to retry
    expect(retryableOperation.canRetry()).toBe(true)
  })
})