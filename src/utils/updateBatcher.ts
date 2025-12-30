/**
 * Update Batching System
 * 
 * Batches real-time updates to prevent excessive re-rendering
 * Validates: Requirements 3.5
 */

import { ref } from 'vue'
import { registerNetworkCleanup } from './memoryManager'

export interface BatchConfig {
  batchSize: number
  batchDelay: number
  maxBatchAge: number
}

export interface UpdateBatch<T = any> {
  updates: T[]
  createdAt: number
  lastUpdated: number
}

export type UpdateCallback<T = any> = (updates: T[]) => void

export class UpdateBatcher {
  private pendingUpdates: Map<string, any[]> = new Map()
  private batchTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map()
  private updateCallbacks: Map<string, UpdateCallback> = new Map()
  private batchConfigs: Map<string, BatchConfig> = new Map()
  private renderCount = 0
  private defaultConfig: BatchConfig

  constructor(defaultConfig?: Partial<BatchConfig>) {
    this.defaultConfig = {
      batchSize: 10,
      batchDelay: 50,
      maxBatchAge: 1000,
      ...defaultConfig
    }
    
    this.registerMemoryCleanup()
  }

  private registerMemoryCleanup(): void {
    registerNetworkCleanup({
      clearUpdateBatches: () => this.cleanup(),
      getUpdateBatchStats: () => ({
        pendingBatches: this.pendingUpdates.size,
        activeTimeouts: this.batchTimeouts.size,
        totalRenders: this.renderCount
      })
    })
  }

  /**
   * Register an update callback for a specific update type
   */
  registerUpdateCallback<T = any>(
    updateType: string, 
    callback: UpdateCallback<T>,
    config?: Partial<BatchConfig>
  ): void {
    this.updateCallbacks.set(updateType, callback)
    
    if (config) {
      this.batchConfigs.set(updateType, {
        ...this.defaultConfig,
        ...config
      })
    }
  }

  /**
   * Add an update to the batch
   */
  addUpdate<T = any>(updateType: string, update: T): void {
    if (!this.updateCallbacks.has(updateType)) {
      console.warn(`No callback registered for update type: ${updateType}`)
      return
    }

    // Initialize batch if it doesn't exist
    if (!this.pendingUpdates.has(updateType)) {
      this.pendingUpdates.set(updateType, [])
    }

    const updates = this.pendingUpdates.get(updateType)!
    const config = this.getConfig(updateType)
    
    updates.push(update)

    // Check if we should flush immediately due to batch size
    if (updates.length >= config.batchSize) {
      this.flushUpdates(updateType)
    } else {
      // Set or reset the batch timeout
      this.resetBatchTimeout(updateType)
    }
  }

  /**
   * Add multiple updates at once
   */
  addUpdates<T = any>(updateType: string, updates: T[]): void {
    updates.forEach(update => this.addUpdate(updateType, update))
  }

  /**
   * Flush updates for a specific type
   */
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
      try {
        this.renderCount++
        callback([...updates]) // Copy to prevent mutation
      } catch (error) {
        console.error(`Error processing batch for ${updateType}:`, error)
      }
    }

    // Clear the batch
    this.pendingUpdates.set(updateType, [])
  }

  /**
   * Reset the batch timeout for delayed flushing
   */
  private resetBatchTimeout(updateType: string): void {
    // Clear existing timeout
    const existingTimeout = this.batchTimeouts.get(updateType)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    const config = this.getConfig(updateType)

    // Set new timeout
    const timeout = setTimeout(() => {
      this.flushUpdates(updateType)
    }, config.batchDelay)

    this.batchTimeouts.set(updateType, timeout)
  }

  /**
   * Get configuration for update type
   */
  private getConfig(updateType: string): BatchConfig {
    return this.batchConfigs.get(updateType) || this.defaultConfig
  }

  /**
   * Force flush all pending updates
   */
  flushAll(): void {
    for (const updateType of this.pendingUpdates.keys()) {
      this.flushUpdates(updateType)
    }
  }

  /**
   * Force flush updates for a specific type
   */
  flush(updateType: string): void {
    this.flushUpdates(updateType)
  }

  /**
   * Get current batch status
   */
  getBatchStatus(): {
    pendingCounts: Record<string, number>
    totalPending: number
    renderCount: number
    activeTimeouts: number
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
      renderCount: this.renderCount,
      activeTimeouts: this.batchTimeouts.size
    }
  }

  /**
   * Get pending updates for a specific type (for debugging)
   */
  getPendingUpdates(updateType: string): any[] {
    return [...(this.pendingUpdates.get(updateType) || [])]
  }

  /**
   * Reset render count (useful for testing)
   */
  resetRenderCount(): void {
    this.renderCount = 0
  }

  /**
   * Remove callback and clear pending updates for a type
   */
  unregisterUpdateCallback(updateType: string): void {
    this.updateCallbacks.delete(updateType)
    this.batchConfigs.delete(updateType)
    
    // Clear pending updates and timeout
    const timeout = this.batchTimeouts.get(updateType)
    if (timeout) {
      clearTimeout(timeout)
      this.batchTimeouts.delete(updateType)
    }
    
    this.pendingUpdates.delete(updateType)
  }

  /**
   * Cleanup all batches and timeouts
   */
  cleanup(): void {
    // Clear all timeouts
    for (const timeout of this.batchTimeouts.values()) {
      clearTimeout(timeout)
    }
    
    this.batchTimeouts.clear()
    this.pendingUpdates.clear()
    this.updateCallbacks.clear()
    this.batchConfigs.clear()
    this.renderCount = 0
  }
}

// Create singleton instance
export const updateBatcher = new UpdateBatcher()

// Reactive status for Vue components
export const batchStatus = ref(updateBatcher.getBatchStatus())

// Update status periodically
setInterval(() => {
  batchStatus.value = updateBatcher.getBatchStatus()
}, 1000)

// Convenience functions
export function registerBatchedUpdates<T = any>(
  updateType: string,
  callback: UpdateCallback<T>,
  config?: Partial<BatchConfig>
): void {
  updateBatcher.registerUpdateCallback(updateType, callback, config)
}

export function addBatchedUpdate<T = any>(updateType: string, update: T): void {
  updateBatcher.addUpdate(updateType, update)
}

export function addBatchedUpdates<T = any>(updateType: string, updates: T[]): void {
  updateBatcher.addUpdates(updateType, updates)
}

export function flushBatchedUpdates(updateType?: string): void {
  if (updateType) {
    updateBatcher.flush(updateType)
  } else {
    updateBatcher.flushAll()
  }
}

export function getBatchedUpdateStatus() {
  return updateBatcher.getBatchStatus()
}