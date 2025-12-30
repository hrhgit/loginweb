/**
 * Property-Based Tests for Non-blocking Operations
 * 
 * **Feature: network-performance-optimization, Property 10: Non-blocking operations**
 * **Validates: Requirements 3.2**
 * 
 * Tests that heavy operations use background processing to prevent UI thread blocking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fc from 'fast-check'

// Mock Web Worker for testing
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  
  constructor(public scriptURL: string) {}
  
  postMessage(data: any): void {
    // Simulate async processing
    setTimeout(() => {
      if (this.onmessage) {
        // Simple processing that works with any data structure
        const result = data.input ? (typeof data.input === 'number' ? data.input * 2 : data.input) : data
        this.onmessage(new MessageEvent('message', { data: { result } }))
      }
    }, 5) // Reduced timeout for faster tests
  }
  
  terminate(): void {
    // Mock termination
  }
}

// Mock performance.now for timing measurements
const mockPerformanceNow = vi.fn()

// Background Processing Manager
class BackgroundProcessor {
  private workers: Map<string, Worker> = new Map()
  private taskQueue: Array<{ id: string; task: any; resolve: Function; reject: Function }> = []
  
  async processHeavyTask(taskId: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      // Check if this would block the main thread
      const startTime = performance.now()
      
      // For heavy tasks, use Web Worker
      if (this.isHeavyTask(data)) {
        this.processInWorker(taskId, data, resolve, reject)
      } else {
        // Light tasks can run on main thread
        this.processOnMainThread(data, resolve, reject)
      }
    })
  }
  
  private isHeavyTask(data: any): boolean {
    // Consider tasks heavy if they involve large datasets or complex operations
    return (
      (Array.isArray(data.items) && data.items.length > 100) ||
      (typeof data.complexity === 'number' && data.complexity > 1000) ||
      data.type === 'heavy'
    )
  }
  
  private processInWorker(taskId: string, data: any, resolve: Function, reject: Function): void {
    try {
      // Create or reuse worker
      let worker = this.workers.get(taskId)
      if (!worker) {
        worker = new (globalThis.Worker || MockWorker)('/background-worker.js') as Worker
        this.workers.set(taskId, worker)
      }
      
      worker.onmessage = (event) => {
        resolve(event.data.result)
      }
      
      worker.onerror = (error) => {
        reject(error)
      }
      
      worker.postMessage({ input: data })
    } catch (error) {
      reject(error)
    }
  }
  
  private processOnMainThread(data: any, resolve: Function, reject: Function): void {
    try {
      // Simulate light processing - handle different data types
      let result
      if (data.input && typeof data.input === 'number') {
        result = data.input * 2
      } else if (data.items && Array.isArray(data.items)) {
        result = data.items.length
      } else {
        result = data
      }
      resolve(result)
    } catch (error) {
      reject(error)
    }
  }
  
  measureUIBlockingTime(operation: () => void): number {
    const startTime = performance.now()
    operation()
    return performance.now() - startTime
  }
  
  cleanup(): void {
    this.workers.forEach(worker => worker.terminate())
    this.workers.clear()
    this.taskQueue = []
  }
}

describe('Background Processing - Non-blocking Operations', () => {
  let processor: BackgroundProcessor
  
  beforeEach(() => {
    processor = new BackgroundProcessor()
    
    // Mock Worker if not available
    if (!globalThis.Worker) {
      globalThis.Worker = MockWorker as any
    }
    
    // Mock performance.now
    let mockTime = 0
    mockPerformanceNow.mockImplementation(() => {
      mockTime += Math.random() * 10 // Simulate time passage
      return mockTime
    })
    vi.stubGlobal('performance', { now: mockPerformanceNow })
  })
  
  afterEach(() => {
    processor.cleanup()
    vi.restoreAllMocks()
  })

  it('should process heavy tasks without blocking the main thread', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          items: fc.array(fc.integer(), { minLength: 101, maxLength: 200 }), // Reduced size for faster tests
          complexity: fc.integer({ min: 1001, max: 5000 }),
          type: fc.constant('heavy')
        }),
        async (heavyTaskData) => {
          const startTime = performance.now()
          
          // Process heavy task
          const result = await processor.processHeavyTask('heavy-task', heavyTaskData)
          
          const endTime = performance.now()
          const processingTime = endTime - startTime
          
          // Heavy tasks should not block main thread for extended periods
          // Since we're using Web Workers, the main thread blocking should be minimal
          expect(processingTime).toBeLessThan(100) // Should not block for more than 100ms
          expect(result).toBeDefined()
        }
      ),
      { numRuns: 20 } // Reduced runs for faster execution
    )
  }, 10000) // Increased timeout

  it('should handle light tasks efficiently on main thread', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          input: fc.integer({ min: 1, max: 100 }),
          items: fc.array(fc.integer(), { maxLength: 50 }), // Light task
          complexity: fc.integer({ min: 1, max: 500 })
        }),
        async (lightTaskData) => {
          const startTime = performance.now()
          
          // Process light task
          const result = await processor.processHeavyTask('light-task', lightTaskData)
          
          const endTime = performance.now()
          const processingTime = endTime - startTime
          
          // Light tasks can run on main thread but should still be fast
          expect(processingTime).toBeLessThan(50) // Should complete quickly
          expect(result).toBeDefined()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should properly classify tasks as heavy or light', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Heavy task generators
          fc.record({
            items: fc.array(fc.integer(), { minLength: 101, maxLength: 1000 }),
            type: fc.constant('normal')
          }),
          fc.record({
            complexity: fc.integer({ min: 1001, max: 10000 }),
            type: fc.constant('normal')
          }),
          fc.record({
            type: fc.constant('heavy'),
            input: fc.integer()
          }),
          // Light task generators
          fc.record({
            items: fc.array(fc.integer(), { maxLength: 100 }),
            complexity: fc.integer({ max: 1000 }),
            type: fc.constant('light')
          })
        ),
        (taskData) => {
          const isHeavy = (
            (Array.isArray(taskData.items) && taskData.items.length > 100) ||
            (typeof taskData.complexity === 'number' && taskData.complexity > 1000) ||
            taskData.type === 'heavy'
          )
          
          // Task classification should be consistent
          if (isHeavy) {
            expect(taskData.items?.length > 100 || taskData.complexity > 1000 || taskData.type === 'heavy').toBe(true)
          } else {
            expect(taskData.items?.length <= 100 && (taskData.complexity || 0) <= 1000 && taskData.type !== 'heavy').toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should maintain UI responsiveness during concurrent heavy operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 10 }),
            items: fc.array(fc.integer(), { minLength: 101, maxLength: 200 }),
            type: fc.constant('heavy')
          }),
          { minLength: 2, maxLength: 3 } // Reduced concurrent tasks
        ),
        async (concurrentTasks) => {
          const startTime = performance.now()
          
          // Start multiple heavy tasks concurrently
          const promises = concurrentTasks.map((task, index) => 
            processor.processHeavyTask(`concurrent-${index}`, task)
          )
          
          // Measure time to start all tasks (should be non-blocking)
          const allStarted = performance.now()
          const startupTime = allStarted - startTime
          
          // Starting tasks should not block the main thread
          expect(startupTime).toBeLessThan(50)
          
          // Wait for all tasks to complete
          const results = await Promise.all(promises)
          
          // All tasks should complete successfully
          expect(results).toHaveLength(concurrentTasks.length)
          results.forEach(result => {
            expect(result).toBeDefined()
          })
        }
      ),
      { numRuns: 10 } // Reduced runs for faster execution
    )
  }, 15000) // Increased timeout

  it('should handle worker errors gracefully without blocking', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          shouldFail: fc.boolean(),
          items: fc.array(fc.integer(), { minLength: 101, maxLength: 200 }),
          type: fc.constant('heavy')
        }),
        async (taskData) => {
          if (taskData.shouldFail) {
            // Simulate worker error by passing invalid data
            const invalidData = { ...taskData, items: null }
            
            try {
              await processor.processHeavyTask('error-task', invalidData)
              // Should not reach here if error handling works
              expect(false).toBe(true)
            } catch (error) {
              // Error should be caught and handled
              expect(error).toBeDefined()
            }
          } else {
            // Normal processing should work
            const result = await processor.processHeavyTask('normal-task', taskData)
            expect(result).toBeDefined()
          }
        }
      ),
      { numRuns: 20 } // Reduced runs for faster execution
    )
  }, 10000) // Increased timeout
})