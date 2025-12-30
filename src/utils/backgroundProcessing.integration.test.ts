/**
 * Integration Tests for Background Processing and Update Batching
 * 
 * Tests the integration between background processing, update batching,
 * and the existing network management system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { backgroundProcessor } from './backgroundProcessor'
import { updateBatcher } from './updateBatcher'
import { setupRealtimeUpdateBatching, addTeamUpdate, addEventUpdate } from './realtimeUpdateIntegration'

describe('Background Processing Integration', () => {
  beforeEach(() => {
    // Setup the real-time update batching
    setupRealtimeUpdateBatching()
  })

  afterEach(() => {
    // Cleanup
    backgroundProcessor.cleanup()
    updateBatcher.cleanup()
  })

  it('should process heavy tasks in background without blocking', async () => {
    const heavyData = {
      items: Array.from({ length: 200 }, (_, i) => ({ id: i, value: Math.random() })),
      complexity: 5000,
      type: 'heavy'
    }

    const startTime = performance.now()
    const result = await backgroundProcessor.processHeavyTask('data-processing', heavyData)
    const endTime = performance.now()

    // Should complete without blocking main thread for too long
    expect(endTime - startTime).toBeLessThan(200)
    expect(result).toBeDefined()
    expect(result.taskId).toBeDefined()
  })

  it('should batch real-time updates efficiently', async () => {
    const mockCallback = vi.fn()
    updateBatcher.registerUpdateCallback('test-integration', mockCallback)

    // Add multiple updates rapidly
    const updates = Array.from({ length: 15 }, (_, i) => ({
      id: `update-${i}`,
      data: `test-data-${i}`,
      timestamp: Date.now() + i
    }))

    updates.forEach(update => {
      updateBatcher.addUpdate('test-integration', update)
    })

    // Wait for batching to complete
    await new Promise(resolve => setTimeout(resolve, 100))

    // Should have batched the updates (fewer calls than individual updates)
    expect(mockCallback.mock.calls.length).toBeLessThan(updates.length)
    expect(mockCallback.mock.calls.length).toBeGreaterThan(0)

    // All updates should be processed
    const totalProcessed = mockCallback.mock.calls.reduce(
      (sum, call) => sum + call[0].length, 0
    )
    expect(totalProcessed).toBe(updates.length)
  })

  it('should handle team updates through batching system', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    // Add multiple team updates
    for (let i = 0; i < 8; i++) {
      addTeamUpdate({
        teamId: `team-${Math.floor(i / 3)}`, // Group some updates by team
        action: 'member-added',
        data: { userId: `user-${i}` },
        timestamp: Date.now() + i
      })
    }

    // Wait for batching
    await new Promise(resolve => setTimeout(resolve, 150))

    // Should have logged batch processing
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Processing') && expect.stringContaining('team updates in batch')
    )

    consoleSpy.mockRestore()
  })

  it('should handle event updates through batching system', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    // Add multiple event updates
    for (let i = 0; i < 5; i++) {
      addEventUpdate({
        eventId: `event-${Math.floor(i / 2)}`, // Group some updates by event
        action: 'status-changed',
        data: { status: 'published' },
        timestamp: Date.now() + i
      })
    }

    // Wait for batching
    await new Promise(resolve => setTimeout(resolve, 200))

    // Should have logged batch processing
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Processing') && expect.stringContaining('event updates in batch')
    )

    consoleSpy.mockRestore()
  })

  it('should maintain system performance under load', async () => {
    const startTime = performance.now()

    // Simulate high load with mixed operations
    const promises: Promise<any>[] = []

    // Background processing tasks
    for (let i = 0; i < 5; i++) {
      promises.push(
        backgroundProcessor.processHeavyTask('calculation', {
          numbers: Array.from({ length: 100 }, () => Math.random() * 1000),
          operation: 'standardDeviation'
        })
      )
    }

    // Batched updates
    for (let i = 0; i < 50; i++) {
      addTeamUpdate({
        teamId: `team-${i % 10}`,
        action: 'update',
        data: { value: i }
      })
    }

    // Wait for all operations to complete
    await Promise.all(promises)
    await new Promise(resolve => setTimeout(resolve, 200))

    const endTime = performance.now()
    const totalTime = endTime - startTime

    // Should handle the load efficiently
    expect(totalTime).toBeLessThan(2000) // Should complete within 2 seconds
    
    // Verify background processor status
    const bgStatus = backgroundProcessor.getStatus()
    expect(bgStatus.activeOperations).toBe(0) // All operations should be complete

    // Verify update batcher status
    const batchStatus = updateBatcher.getBatchStatus()
    expect(batchStatus.totalPending).toBeLessThanOrEqual(10) // Most updates should be processed
  })

  it('should handle errors gracefully in background processing', async () => {
    // Test with invalid data that should cause an error
    const invalidData = {
      items: null, // This should cause an error
      type: 'heavy'
    }

    try {
      await backgroundProcessor.processHeavyTask('data-processing', invalidData)
      // Should not reach here
      expect(false).toBe(true)
    } catch (error) {
      // Should catch and handle the error
      expect(error).toBeDefined()
    }

    // System should still be functional after error
    const validData = {
      input: 42,
      type: 'light'
    }

    const result = await backgroundProcessor.processHeavyTask('calculation', validData)
    expect(result).toBeDefined()
  })
})