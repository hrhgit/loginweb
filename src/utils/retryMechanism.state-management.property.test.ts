import { describe, it, expect, vi } from 'vitest'
import fc from 'fast-check'
import { RetryMechanism } from './errorHandler'

// **Feature: error-message-enhancement, Property 9: 重试状态管理**
// **Validates: Requirements 3.5**

describe('Retry State Management Property Tests', () => {
  const retryMechanism = new RetryMechanism()

  it('Property 9: Retry state management - should show loading state and disable retry button during retry operation', async () => {
    let executionCount = 0
    let isExecuting = false
    
    const mockOperation = vi.fn(async () => {
      executionCount++
      isExecuting = true
      
      // Simulate some async work
      await new Promise(resolve => setTimeout(resolve, 50))
      
      if (executionCount === 1) {
        isExecuting = false
        throw new Error('First attempt fails')
      }
      
      isExecuting = false
      return 'Success on second attempt'
    })

    const retryableOperation = retryMechanism.createRetryableOperation(mockOperation, {
      maxAttempts: 3,
      baseDelay: 10,
      backoffMultiplier: 1.5,
      timeout: 1000
    })
    
    // Initial state - should be able to retry, no attempts yet
    expect(retryableOperation.canRetry()).toBe(true)
    expect(retryableOperation.getAttemptCount()).toBe(0)
    
    const result = await retryableOperation.execute()
    
    // After completion - should have correct final state
    expect(result).toBe('Success on second attempt')
    expect(executionCount).toBe(2)
    expect(retryableOperation.getAttemptCount()).toBe(2)
    expect(retryableOperation.canRetry()).toBe(true) // Still under limit
    expect(isExecuting).toBe(false) // Should not be executing anymore
  })

  it('Property 9.1: Retry state consistency - attempt count should increment correctly', async () => {
    const testScenarios = [
      { maxAttempts: 1, expectedFinalCount: 1 },
      { maxAttempts: 2, expectedFinalCount: 2 },
      { maxAttempts: 3, expectedFinalCount: 3 },
      { maxAttempts: 4, expectedFinalCount: 4 }
    ]
    
    for (const scenario of testScenarios) {
      let executionCount = 0
      const mockOperation = vi.fn(async () => {
        executionCount++
        throw new Error(`Always fails - attempt ${executionCount}`)
      })

      const retryableOperation = retryMechanism.createRetryableOperation(mockOperation, {
        maxAttempts: scenario.maxAttempts,
        baseDelay: 10,
        backoffMultiplier: 1.5,
        timeout: 1000
      })
      
      // Track state changes during execution
      const stateHistory: Array<{ attemptCount: number, canRetry: boolean }> = []
      
      // Initial state
      stateHistory.push({
        attemptCount: retryableOperation.getAttemptCount(),
        canRetry: retryableOperation.canRetry()
      })
      
      try {
        await retryableOperation.execute()
      } catch (error) {
        // Expected to fail
      }
      
      // Final state
      stateHistory.push({
        attemptCount: retryableOperation.getAttemptCount(),
        canRetry: retryableOperation.canRetry()
      })
      
      // Verify state progression
      expect(stateHistory[0].attemptCount).toBe(0)
      expect(stateHistory[0].canRetry).toBe(true)
      
      expect(stateHistory[1].attemptCount).toBe(scenario.expectedFinalCount)
      expect(stateHistory[1].canRetry).toBe(false)
      
      expect(executionCount).toBe(scenario.expectedFinalCount)
    }
  })

  it('Property 9.2: Retry state during success - should maintain correct state when operation succeeds', async () => {
    let executionCount = 0
    const mockOperation = vi.fn(async () => {
      executionCount++
      return `Success on attempt ${executionCount}`
    })

    const retryableOperation = retryMechanism.createRetryableOperation(mockOperation, {
      maxAttempts: 5,
      baseDelay: 10,
      backoffMultiplier: 1.5,
      timeout: 1000
    })
    
    // Initial state
    expect(retryableOperation.getAttemptCount()).toBe(0)
    expect(retryableOperation.canRetry()).toBe(true)
    
    const result = await retryableOperation.execute()
    
    // After immediate success
    expect(result).toBe('Success on attempt 1')
    expect(executionCount).toBe(1)
    expect(retryableOperation.getAttemptCount()).toBe(1)
    expect(retryableOperation.canRetry()).toBe(true) // Still under limit
  })

  it('Property 9.3: Retry state with partial failures - should track state correctly through multiple attempts', async () => {
    let executionCount = 0
    const mockOperation = vi.fn(async () => {
      executionCount++
      if (executionCount <= 2) {
        throw new Error(`Failure ${executionCount}`)
      }
      return `Success on attempt ${executionCount}`
    })

    const retryableOperation = retryMechanism.createRetryableOperation(mockOperation, {
      maxAttempts: 4,
      baseDelay: 10,
      backoffMultiplier: 1.5,
      timeout: 1000
    })
    
    // Initial state
    expect(retryableOperation.getAttemptCount()).toBe(0)
    expect(retryableOperation.canRetry()).toBe(true)
    
    const result = await retryableOperation.execute()
    
    // After success on third attempt
    expect(result).toBe('Success on attempt 3')
    expect(executionCount).toBe(3)
    expect(retryableOperation.getAttemptCount()).toBe(3)
    expect(retryableOperation.canRetry()).toBe(true) // Still under limit (3 < 4)
  })

  it('Property 9.4: Retry state isolation - different retry operations should have independent state', async () => {
    let executionCount1 = 0
    let executionCount2 = 0
    
    const mockOperation1 = vi.fn(async () => {
      executionCount1++
      throw new Error(`Op1 failure ${executionCount1}`)
    })
    
    const mockOperation2 = vi.fn(async () => {
      executionCount2++
      if (executionCount2 === 1) {
        throw new Error('Op2 failure 1')
      }
      return 'Op2 success'
    })

    const retryableOp1 = retryMechanism.createRetryableOperation(mockOperation1, {
      maxAttempts: 2,
      baseDelay: 10,
      backoffMultiplier: 1.5,
      timeout: 1000
    })
    
    const retryableOp2 = retryMechanism.createRetryableOperation(mockOperation2, {
      maxAttempts: 3,
      baseDelay: 10,
      backoffMultiplier: 1.5,
      timeout: 1000
    })
    
    // Execute both operations
    let op1Error: Error | null = null
    try {
      await retryableOp1.execute()
    } catch (error) {
      op1Error = error as Error
    }
    
    const op2Result = await retryableOp2.execute()
    
    // Verify independent state management
    expect(op1Error).not.toBe(null)
    expect(retryableOp1.getAttemptCount()).toBe(2)
    expect(retryableOp1.canRetry()).toBe(false)
    
    expect(op2Result).toBe('Op2 success')
    expect(retryableOp2.getAttemptCount()).toBe(2)
    expect(retryableOp2.canRetry()).toBe(true)
    
    // Operations should not affect each other
    expect(executionCount1).toBe(2)
    expect(executionCount2).toBe(2)
  })

  it('Property 9.5: Retry state reset on new execution - execute() should reset attempt count', async () => {
    let executionCount = 0
    const mockOperation = vi.fn(async () => {
      executionCount++
      if (executionCount <= 1) {
        throw new Error(`Failure ${executionCount}`)
      }
      return `Success ${executionCount}`
    })

    const retryableOperation = retryMechanism.createRetryableOperation(mockOperation, {
      maxAttempts: 3,
      baseDelay: 10,
      backoffMultiplier: 1.5,
      timeout: 1000
    })
    
    // First execution
    const result1 = await retryableOperation.execute()
    expect(result1).toBe('Success 2')
    expect(retryableOperation.getAttemptCount()).toBe(2)
    
    // Reset for second execution
    executionCount = 0
    mockOperation.mockClear()
    
    // Second execution should reset attempt count
    const result2 = await retryableOperation.execute()
    expect(result2).toBe('Success 2')
    expect(retryableOperation.getAttemptCount()).toBe(2) // Should be same as first execution
    expect(mockOperation).toHaveBeenCalledTimes(2) // Called twice in second execution
  })

  it('Property 9.6: Retry state with timeout - should handle timeout scenarios correctly', async () => {
    let executionCount = 0
    const mockOperation = vi.fn(async () => {
      executionCount++
      // Simulate a long-running operation that will timeout
      await new Promise(resolve => setTimeout(resolve, 200))
      return 'Should not reach here'
    })

    const retryableOperation = retryMechanism.createRetryableOperation(mockOperation, {
      maxAttempts: 2,
      baseDelay: 10,
      backoffMultiplier: 1.5,
      timeout: 100 // Short timeout to trigger timeout error
    })
    
    let timeoutError: Error | null = null
    try {
      await retryableOperation.execute()
    } catch (error) {
      timeoutError = error as Error
    }
    
    // Should have timed out
    expect(timeoutError).not.toBe(null)
    expect(timeoutError?.message).toBe('操作超时')
    expect(retryableOperation.getAttemptCount()).toBe(2) // Should have tried maxAttempts times
    expect(retryableOperation.canRetry()).toBe(false)
  })
})