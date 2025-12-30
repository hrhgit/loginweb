/**
 * Background Processing Manager
 * 
 * Implements Web Workers for heavy network operations to prevent UI blocking
 * Validates: Requirements 3.2
 */

import { registerNetworkCleanup, trackNetworkOperation, completeNetworkOperation } from './memoryManager'

export interface BackgroundTask {
  id: string
  type: string
  data: any
  priority: 'high' | 'medium' | 'low'
  createdAt: number
}

export interface TaskResult {
  taskId: string
  result: any
  error?: Error
  processingTime: number
}

export class BackgroundProcessor {
  private workers: Map<string, Worker> = new Map()
  private taskQueue: BackgroundTask[] = []
  private activeOperations: Map<string, string> = new Map()
  private maxWorkers: number
  private workerScript: string

  constructor(maxWorkers = 4, workerScript = '/background-worker.js') {
    this.maxWorkers = maxWorkers
    this.workerScript = workerScript
    this.registerMemoryCleanup()
  }

  private registerMemoryCleanup(): void {
    registerNetworkCleanup({
      clearBackgroundTasks: () => this.cleanup(),
      getBackgroundStats: () => ({
        activeWorkers: this.workers.size,
        queuedTasks: this.taskQueue.length,
        activeOperations: this.activeOperations.size
      })
    })
  }

  /**
   * Process a heavy task in the background using Web Workers
   */
  async processHeavyTask(taskType: string, data: any, priority: 'high' | 'medium' | 'low' = 'medium'): Promise<any> {
    const task: BackgroundTask = {
      id: this.generateTaskId(),
      type: taskType,
      data,
      priority,
      createdAt: Date.now()
    }

    // Track the operation for memory management
    const operationId = `bg_${task.id}`
    trackNetworkOperation(operationId, `Background task: ${taskType}`)
    this.activeOperations.set(task.id, operationId)

    try {
      // Determine if task should use Web Worker
      if (this.isHeavyTask(data)) {
        return await this.processInWorker(task)
      } else {
        return await this.processOnMainThread(task)
      }
    } finally {
      // Clean up operation tracking
      const opId = this.activeOperations.get(task.id)
      if (opId) {
        completeNetworkOperation(opId)
        this.activeOperations.delete(task.id)
      }
    }
  }

  /**
   * Determine if a task should be processed in a Web Worker
   */
  private isHeavyTask(data: any): boolean {
    // Consider tasks heavy based on data size or complexity
    if (Array.isArray(data.items) && data.items.length > 100) return true
    if (typeof data.complexity === 'number' && data.complexity > 1000) return true
    if (data.type === 'heavy' || data.type === 'cpu-intensive') return true
    if (data.size && data.size > 1024 * 1024) return true // > 1MB
    
    return false
  }

  /**
   * Process task in Web Worker
   */
  private async processInWorker(task: BackgroundTask): Promise<any> {
    return new Promise((resolve, reject) => {
      const startTime = performance.now()
      
      try {
        // Get or create worker
        const worker = this.getOrCreateWorker(task.type)
        
        // Set up message handlers
        const messageHandler = (event: MessageEvent) => {
          if (event.data.taskId === task.id) {
            worker.removeEventListener('message', messageHandler)
            worker.removeEventListener('error', errorHandler)
            
            const processingTime = performance.now() - startTime
            
            if (event.data.error) {
              reject(new Error(event.data.error))
            } else {
              resolve({
                taskId: task.id,
                result: event.data.result,
                processingTime
              })
            }
          }
        }
        
        const errorHandler = (error: ErrorEvent) => {
          worker.removeEventListener('message', messageHandler)
          worker.removeEventListener('error', errorHandler)
          reject(error)
        }
        
        worker.addEventListener('message', messageHandler)
        worker.addEventListener('error', errorHandler)
        
        // Send task to worker
        worker.postMessage({
          taskId: task.id,
          type: task.type,
          data: task.data
        })
        
      } catch (error) {
        // Fallback to main thread processing if Worker fails
        console.warn('Web Worker not available, falling back to main thread processing')
        this.processOnMainThread(task).then(resolve).catch(reject)
      }
    })
  }

  /**
   * Process light task on main thread
   */
  private async processOnMainThread(task: BackgroundTask): Promise<any> {
    const startTime = performance.now()
    
    return new Promise((resolve, reject) => {
      try {
        // Use setTimeout to yield control and prevent blocking
        setTimeout(() => {
          try {
            let result
            
            // Simple processing based on task type
            switch (task.type) {
              case 'data-transform':
                result = this.processDataTransform(task.data)
                break
              case 'validation':
                result = this.processValidation(task.data)
                break
              case 'calculation':
                result = this.processCalculation(task.data)
                break
              default:
                result = task.data
            }
            
            const processingTime = performance.now() - startTime
            resolve({
              taskId: task.id,
              result,
              processingTime
            })
          } catch (error) {
            reject(error)
          }
        }, 0)
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Get or create a worker for the task type
   */
  private getOrCreateWorker(taskType: string): Worker {
    const workerId = `${taskType}_${this.workers.size % this.maxWorkers}`
    
    if (!this.workers.has(workerId)) {
      // Check if Worker is available
      if (typeof Worker === 'undefined') {
        throw new Error('Web Workers not supported in this environment')
      }
      
      try {
        const worker = new Worker(this.workerScript)
        this.workers.set(workerId, worker)
        return worker
      } catch (error) {
        // Fallback: if Worker creation fails, we'll process on main thread
        throw new Error(`Failed to create Web Worker: ${error}`)
      }
    }
    
    return this.workers.get(workerId)!
  }

  /**
   * Simple data processing functions for main thread
   */
  private processDataTransform(data: any): any {
    if (Array.isArray(data.items)) {
      return data.items.map((item: any) => ({ ...item, processed: true }))
    }
    return { ...data, processed: true }
  }

  private processValidation(data: any): any {
    return {
      isValid: data && typeof data === 'object',
      errors: [],
      data
    }
  }

  private processCalculation(data: any): any {
    if (typeof data.input === 'number') {
      return { result: data.input * 2 }
    }
    if (Array.isArray(data.items)) {
      return { result: data.items.length }
    }
    return { result: 0 }
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get current processing status
   */
  getStatus(): {
    activeWorkers: number
    queuedTasks: number
    activeOperations: number
  } {
    return {
      activeWorkers: this.workers.size,
      queuedTasks: this.taskQueue.length,
      activeOperations: this.activeOperations.size
    }
  }

  /**
   * Cleanup all workers and pending tasks
   */
  cleanup(): void {
    // Terminate all workers
    this.workers.forEach(worker => {
      try {
        worker.terminate()
      } catch (error) {
        console.warn('Error terminating worker:', error)
      }
    })
    
    this.workers.clear()
    this.taskQueue = []
    this.activeOperations.clear()
  }
}

// Create singleton instance
export const backgroundProcessor = new BackgroundProcessor()

// Convenience functions
export function processHeavyTask(taskType: string, data: any, priority?: 'high' | 'medium' | 'low'): Promise<any> {
  return backgroundProcessor.processHeavyTask(taskType, data, priority)
}

export function getBackgroundProcessingStatus() {
  return backgroundProcessor.getStatus()
}