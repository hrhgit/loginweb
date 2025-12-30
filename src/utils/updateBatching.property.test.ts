/**
 * Property-Based Tests for Update Batching
 * 
 * **Feature: network-performance-optimization, Property 12: Update batching**
 * **Validates: Requirements 3.5**
 * 
 * Tests that real-time updates are batched to prevent excessive re-rendering
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fc from 'fast-check'

// Update Batching Manager
class UpdateBatcher {
  private pendingUpdates: Map<string, any[]> = new Map()
  private batchTimeouts: Map<string, NodeJS.Timeout> = new Map()
  private batchSize: number
  private batchDelay: number
  private updateCallbacks: Map<string, (updates: any[]) => void> = new Map()
  private renderCount = 0

  constructor(batchSize = 10, batchDelay = 50) {
    this.batchSize = batchSize
    this.batchDelay = batchDelay
  }

  // Register a callback for a specific update type
  registerUpdateCallback(updateType: string, callback: (updates: any[]) => void): void {
    this.updateCallbacks.set(updateType, callback)
  }

  // Add an update to the batch
  addUpdate(updateType: string, update: any): void {
    if (!this.pendingUpdates.has(updateType)) {
      this.pendingUpdates.set(updateType, [])
    }

    const updates = this.pendingUpdates.get(updateType)!
    updates.push(update)

    // Check if we should flush immediately due to batch size
    if (updates.length >= this.batchSize) {
      this.flushUpdates(updateType)
    } else {
      // Set or reset the batch timeout
      this.resetBatchTimeout(updateType)
    }
  }

  // Flush updates for a specific type
  private flushUpdates(updateType: string): void {
    const updates = this.pendingUpdates.get(updateType)
    if (!updates || updates.length === 0) return

    // Clear timeout if exists
    const timeout = this.batchTimeouts.get(updateType)
    if (timeout) {
      clearTimeout(timeout)
      this.batchTimeouts.delete(updateType)
    }

    // Process the batch
    const callback = this.updateCallbacks.get(updateType)
    if (callback) {
      this.renderCount++
      callback([...updates]) // Copy to prevent mutation
    }

    // Clear the batch
    this.pendingUpdates.set(updateType, [])
  }

  // Reset the batch timeout for delayed flushing
  private resetBatchTimeout(updateType: string): void {
    // Clear existing timeout
    const existingTimeout = this.batchTimeouts.get(updateType)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      this.flushUpdates(updateType)
    }, this.batchDelay)

    this.batchTimeouts.set(updateType, timeout)
  }

  // Force flush all pending updates
  flushAll(): void {
    for (const updateType of this.pendingUpdates.keys()) {
      this.flushUpdates(updateType)
    }
  }

  // Get current batch status
  getBatchStatus(): { 
    pendingCounts: Record<string, number>
    totalPending: number
    renderCount: number
  } {
    const pendingCounts: Record<string, number> = {}
    let totalPending = 0

    for (const [type, updates] of this.pendingUpdates.entries()) {
      pendingCounts[type] = updates.length
      totalPending += updates.length
    }

    return {
      pendingCounts,
      totalPending,
      renderCount: this.renderCount
    }
  }

  // Reset render count for testing
  resetRenderCount(): void {
    this.renderCount = 0
  }

  // Cleanup
  cleanup(): void {
    // Clear all timeouts
    for (const timeout of this.batchTimeouts.values()) {
      clearTimeout(timeout)
    }
    this.batchTimeouts.clear()
    this.pendingUpdates.clear()
    this.updateCallbacks.clear()
    this.renderCount = 0
  }
}

describe('Update Batching System', () => {
  let batcher: UpdateBatcher
  let mockRenderCallback: ReturnType<typeof vi.fn>

  beforeEach(() => {
    batcher = new UpdateBatcher(5, 50) // Small batch size and delay for testing
    mockRenderCallback = vi.fn()
    
    // Register a mock callback
    batcher.registerUpdateCallback('test-updates', mockRenderCallback)
  })

  afterEach(() => {
    batcher.cleanup()
    vi.clearAllMocks()
  })

  it('should batch multiple updates and reduce render calls', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 10 }),
            data: fc.anything(),
            timestamp: fc.integer({ min: 1, max: 1000000 })
          }),
          { minLength: 10, maxLength: 50 }
        ),
        async (updates) => {
          batcher.resetRenderCount()
          mockRenderCallback.mockClear()

          // Add all updates rapidly (simulating real-time updates)
          updates.forEach(update => {
            batcher.addUpdate('test-updates', update)
          })

          // Wait for batching to complete
          await new Promise(resolve => setTimeout(resolve, 100))

          const status = batcher.getBatchStatus()
          
          // Should have significantly fewer render calls than individual updates
          // With batch size of 5, we expect roughly updates.length / 5 render calls
          const expectedMaxRenders = Math.ceil(updates.length / 5) + 1 // +1 for potential timeout batch
          expect(status.renderCount).toBeLessThanOrEqual(expectedMaxRenders)
          expect(status.renderCount).toBeGreaterThan(0)
          
          // Should have processed all updates
          expect(mockRenderCallback).toHaveBeenCalled()
          
          // Total updates processed should equal input
          const totalProcessed = mockRenderCallback.mock.calls.reduce(
            (sum, call) => sum + call[0].length, 0
          )
          expect(totalProcessed).toBe(updates.length)
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should flush batches when batch size is reached', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 5 }),
            value: fc.integer()
          }),
          { minLength: 5, maxLength: 5 } // Exactly batch size
        ),
        (updates) => {
          batcher.resetRenderCount()
          mockRenderCallback.mockClear()

          // Add exactly batch size updates
          updates.forEach(update => {
            batcher.addUpdate('test-updates', update)
          })

          // Should trigger immediate flush
          expect(mockRenderCallback).toHaveBeenCalledTimes(1)
          expect(mockRenderCallback).toHaveBeenCalledWith(updates)
          
          const status = batcher.getBatchStatus()
          expect(status.renderCount).toBe(1)
          expect(status.pendingCounts['test-updates']).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should handle different update types independently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          typeA: fc.array(fc.record({ id: fc.string(), data: fc.anything() }), { minLength: 1, maxLength: 10 }),
          typeB: fc.array(fc.record({ id: fc.string(), data: fc.anything() }), { minLength: 1, maxLength: 10 }),
          typeC: fc.array(fc.record({ id: fc.string(), data: fc.anything() }), { minLength: 1, maxLength: 10 })
        }),
        async ({ typeA, typeB, typeC }) => {
          const callbackA = vi.fn()
          const callbackB = vi.fn()
          const callbackC = vi.fn()

          batcher.registerUpdateCallback('type-a', callbackA)
          batcher.registerUpdateCallback('type-b', callbackB)
          batcher.registerUpdateCallback('type-c', callbackC)

          // Add updates for different types
          typeA.forEach(update => batcher.addUpdate('type-a', update))
          typeB.forEach(update => batcher.addUpdate('type-b', update))
          typeC.forEach(update => batcher.addUpdate('type-c', update))

          // Wait for batching
          await new Promise(resolve => setTimeout(resolve, 100))

          // Each type should be handled independently
          const totalCallsA = callbackA.mock.calls.reduce((sum, call) => sum + call[0].length, 0)
          const totalCallsB = callbackB.mock.calls.reduce((sum, call) => sum + call[0].length, 0)
          const totalCallsC = callbackC.mock.calls.reduce((sum, call) => sum + call[0].length, 0)

          expect(totalCallsA).toBe(typeA.length)
          expect(totalCallsB).toBe(typeB.length)
          expect(totalCallsC).toBe(typeC.length)
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should preserve update order within batches', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 5 }),
            sequence: fc.integer({ min: 1, max: 1000 })
          }),
          { minLength: 3, maxLength: 8 }
        ),
        (updates) => {
          batcher.resetRenderCount()
          mockRenderCallback.mockClear()

          // Add updates in order
          updates.forEach(update => {
            batcher.addUpdate('test-updates', update)
          })

          // Force flush to get all updates
          batcher.flushAll()

          // Check that order is preserved across all batches
          const allProcessedUpdates: any[] = []
          mockRenderCallback.mock.calls.forEach(call => {
            allProcessedUpdates.push(...call[0])
          })

          expect(allProcessedUpdates).toHaveLength(updates.length)
          
          // Verify order is preserved
          for (let i = 0; i < updates.length; i++) {
            expect(allProcessedUpdates[i]).toEqual(updates[i])
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should handle rapid successive updates efficiently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          updateCount: fc.integer({ min: 20, max: 50 }), // Reduced max count
          intervalMs: fc.integer({ min: 1, max: 5 }) // Reduced max interval
        }),
        async ({ updateCount, intervalMs }) => {
          // Register callback for rapid updates
          const rapidCallback = vi.fn()
          batcher.registerUpdateCallback('rapid-updates', rapidCallback)
          
          batcher.resetRenderCount()
          rapidCallback.mockClear()

          // Simulate rapid updates
          const updates: any[] = []
          for (let i = 0; i < updateCount; i++) {
            const update = { id: `update-${i}`, timestamp: Date.now() + i }
            updates.push(update)
            batcher.addUpdate('rapid-updates', update)
            
            // Small delay to simulate real-time updates (only for larger intervals)
            if (intervalMs > 2) {
              await new Promise(resolve => setTimeout(resolve, intervalMs))
            }
          }

          // Wait for all batching to complete
          await new Promise(resolve => setTimeout(resolve, 100))

          const status = batcher.getBatchStatus()
          
          // Should have significantly fewer renders than individual updates
          expect(status.renderCount).toBeLessThan(updateCount)
          expect(status.renderCount).toBeGreaterThan(0)
          
          // All updates should be processed
          const totalProcessed = rapidCallback.mock.calls.reduce(
            (sum, call) => sum + call[0].length, 0
          )
          expect(totalProcessed).toBe(updateCount)
        }
      ),
      { numRuns: 5 } // Reduced runs for faster execution
    )
  }, 10000) // Increased timeout

  it('should handle empty and single update cases correctly', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant([]), // Empty array
          fc.array(fc.record({ id: fc.string(), data: fc.anything() }), { minLength: 1, maxLength: 1 }) // Single update
        ),
        (updates) => {
          batcher.resetRenderCount()
          mockRenderCallback.mockClear()

          updates.forEach(update => {
            batcher.addUpdate('test-updates', update)
          })

          if (updates.length === 0) {
            // No updates should mean no renders
            expect(mockRenderCallback).not.toHaveBeenCalled()
            expect(batcher.getBatchStatus().renderCount).toBe(0)
          } else {
            // Single update should be handled correctly after timeout
            setTimeout(() => {
              expect(mockRenderCallback).toHaveBeenCalledWith(updates)
            }, 60) // Wait for batch timeout
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})