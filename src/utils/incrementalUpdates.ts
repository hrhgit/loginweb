/**
 * Incremental Updates Manager - Handles incremental data loading and updates
 * 
 * Provides functionality to update content incrementally rather than full page reloads,
 * optimizing data usage and improving user experience.
 */

import { ref, computed, type Ref } from 'vue'
import { cacheManager } from './cacheManager'
import { networkManager } from './networkManager'
import { dataUsageOptimizer } from './dataUsageOptimizer'

export interface UpdateDelta<T = any> {
  id: string
  type: 'create' | 'update' | 'delete'
  timestamp: number
  data?: T
  previousData?: T
  path?: string // For nested updates
}

export interface IncrementalUpdateConfig {
  batchSize: number
  maxBatchDelay: number // milliseconds
  enableDeltaCompression: boolean
  trackChanges: boolean
}

export interface UpdateBatch<T = any> {
  id: string
  updates: UpdateDelta<T>[]
  timestamp: number
  totalSize: number
}

export interface IncrementalState<T = any> {
  lastUpdateTimestamp: number
  version: number
  data: T
  pendingUpdates: UpdateDelta<T>[]
}

/**
 * Incremental Updates Manager - Main class for handling incremental updates
 */
export class IncrementalUpdatesManager<T = any> {
  private state: Ref<IncrementalState<T>>
  private config: IncrementalUpdateConfig
  private updateQueue: UpdateDelta<T>[] = []
  private batchTimer: number | null = null
  private changeListeners: Set<(delta: UpdateDelta<T>) => void> = new Set()

  constructor(initialData: T, config?: Partial<IncrementalUpdateConfig>) {
    this.config = {
      batchSize: 10,
      maxBatchDelay: 1000, // 1 second
      enableDeltaCompression: true,
      trackChanges: true,
      ...config
    }

    this.state = ref<IncrementalState<T>>({
      lastUpdateTimestamp: Date.now(),
      version: 1,
      data: initialData,
      pendingUpdates: []
    })
  }

  // Getters
  get currentData(): T {
    return this.state.value.data
  }

  get version(): number {
    return this.state.value.version
  }

  get lastUpdateTimestamp(): number {
    return this.state.value.lastUpdateTimestamp
  }

  get hasPendingUpdates(): boolean {
    return this.state.value.pendingUpdates.length > 0 || this.updateQueue.length > 0
  }

  // Update Operations
  applyUpdate(delta: UpdateDelta<T>): void {
    if (this.config.trackChanges) {
      this.state.value.pendingUpdates.push(delta)
    }

    // Apply the update to current data
    this.state.value.data = this.applyDeltaToData(this.state.value.data, delta)
    this.state.value.version++
    this.state.value.lastUpdateTimestamp = Date.now()

    // Notify listeners
    this.notifyChangeListeners(delta)

    // Queue for batching if needed
    if (this.shouldBatchUpdate(delta)) {
      this.queueUpdate(delta)
    }
  }

  applyBatch(batch: UpdateBatch<T>): void {
    batch.updates.forEach(delta => {
      this.applyUpdate(delta)
    })
  }

  createUpdate(type: 'create' | 'update' | 'delete', data?: T, path?: string): UpdateDelta<T> {
    return {
      id: this.generateUpdateId(),
      type,
      timestamp: Date.now(),
      data,
      previousData: this.config.trackChanges ? this.getCurrentDataAtPath(path) : undefined,
      path
    }
  }

  // Incremental Loading
  async loadIncremental(
    fetcher: (lastTimestamp: number, version: number) => Promise<UpdateDelta<T>[]>,
    useCache: boolean = true
  ): Promise<UpdateDelta<T>[]> {
    const cacheKey = `incremental_${this.state.value.lastUpdateTimestamp}_${this.state.value.version}`
    
    if (useCache) {
      const cached = await cacheManager.get<UpdateDelta<T>[]>(cacheKey)
      if (cached) {
        dataUsageOptimizer.recordDataUsage(JSON.stringify(cached).length, true)
        return cached
      }
    }

    try {
      const updates = await fetcher(this.state.value.lastUpdateTimestamp, this.state.value.version)
      
      // Cache the updates if enabled
      if (useCache && updates.length > 0) {
        await cacheManager.set(cacheKey, updates, 300000) // 5 minutes TTL
      }

      // Record data usage
      dataUsageOptimizer.recordDataUsage(JSON.stringify(updates).length, false)

      return updates
    } catch (error) {
      console.error('Failed to load incremental updates:', error)
      throw error
    }
  }

  async syncWithServer(
    syncEndpoint: string,
    options: {
      useCompression?: boolean
      batchUpdates?: boolean
    } = {}
  ): Promise<void> {
    const { useCompression = true, batchUpdates = true } = options

    try {
      // Prepare sync payload
      const payload = {
        lastTimestamp: this.state.value.lastUpdateTimestamp,
        version: this.state.value.version,
        pendingUpdates: batchUpdates ? this.getBatchedUpdates() : this.state.value.pendingUpdates
      }

      // Compress payload if enabled and data saving allows
      let syncData: string | ArrayBuffer = JSON.stringify(payload)
      if (useCompression && dataUsageOptimizer.currentPreferences.compressionEnabled) {
        syncData = await dataUsageOptimizer.compressData(syncData)
      }

      // Execute sync request
      const response = await networkManager.executeRequest<{
        updates: UpdateDelta<T>[]
        newVersion: number
      }>({
        url: syncEndpoint,
        method: 'POST',
        data: syncData,
        priority: 'medium',
        maxRetries: 3
      })

      // Apply received updates
      if (response.updates && response.updates.length > 0) {
        response.updates.forEach(update => this.applyUpdate(update))
      }

      // Update version if provided
      if (response.newVersion) {
        this.state.value.version = response.newVersion
      }

      // Clear pending updates after successful sync
      this.state.value.pendingUpdates = []

    } catch (error) {
      console.error('Failed to sync with server:', error)
      throw error
    }
  }

  // Delta Computation
  computeDelta(oldData: T, newData: T): UpdateDelta<T>[] {
    const deltas: UpdateDelta<T>[] = []

    // Simple delta computation - in real implementation would use deep diff
    if (JSON.stringify(oldData) !== JSON.stringify(newData)) {
      deltas.push({
        id: this.generateUpdateId(),
        type: 'update',
        timestamp: Date.now(),
        data: newData,
        previousData: oldData
      })
    }

    return deltas
  }

  mergeDelta(baseDelta: UpdateDelta<T>, newDelta: UpdateDelta<T>): UpdateDelta<T> {
    // Merge two deltas - newer takes precedence
    return {
      ...baseDelta,
      ...newDelta,
      timestamp: Math.max(baseDelta.timestamp, newDelta.timestamp),
      previousData: baseDelta.previousData // Keep original previous data
    }
  }

  // Batching Operations
  getBatchedUpdates(): UpdateBatch<T>[] {
    const batches: UpdateBatch<T>[] = []
    const updates = [...this.state.value.pendingUpdates]

    for (let i = 0; i < updates.length; i += this.config.batchSize) {
      const batchUpdates = updates.slice(i, i + this.config.batchSize)
      const batch: UpdateBatch<T> = {
        id: this.generateBatchId(),
        updates: batchUpdates,
        timestamp: Date.now(),
        totalSize: JSON.stringify(batchUpdates).length
      }
      batches.push(batch)
    }

    return batches
  }

  flushPendingUpdates(): UpdateDelta<T>[] {
    const pending = [...this.state.value.pendingUpdates]
    this.state.value.pendingUpdates = []
    return pending
  }

  // Change Tracking
  addChangeListener(listener: (delta: UpdateDelta<T>) => void): () => void {
    this.changeListeners.add(listener)
    return () => this.changeListeners.delete(listener)
  }

  removeAllChangeListeners(): void {
    this.changeListeners.clear()
  }

  // State Management
  getSnapshot(): IncrementalState<T> {
    return JSON.parse(JSON.stringify(this.state.value))
  }

  restoreFromSnapshot(snapshot: IncrementalState<T>): void {
    this.state.value = snapshot
  }

  reset(newData: T): void {
    this.state.value = {
      lastUpdateTimestamp: Date.now(),
      version: 1,
      data: newData,
      pendingUpdates: []
    }
    this.updateQueue = []
    this.clearBatchTimer()
  }

  // Private Methods
  private applyDeltaToData(data: T, delta: UpdateDelta<T>): T {
    // Simple implementation - in real app would handle nested paths and complex operations
    switch (delta.type) {
      case 'create':
      case 'update':
        return delta.data || data
      case 'delete':
        // For delete operations, return previous state or empty
        return delta.previousData || data
      default:
        return data
    }
  }

  private getCurrentDataAtPath(path?: string): T | undefined {
    if (!path) return this.state.value.data

    // Simple path resolution - in real implementation would handle nested object paths
    try {
      return path.split('.').reduce((obj: any, key) => obj?.[key], this.state.value.data)
    } catch {
      return undefined
    }
  }

  private shouldBatchUpdate(delta: UpdateDelta<T>): boolean {
    // Batch updates for better performance, except for high-priority operations
    return delta.type !== 'delete' && this.config.batchSize > 1
  }

  private queueUpdate(delta: UpdateDelta<T>): void {
    this.updateQueue.push(delta)

    // Process batch when size limit reached
    if (this.updateQueue.length >= this.config.batchSize) {
      this.processBatch()
    } else {
      // Set timer for delayed batch processing
      this.setBatchTimer()
    }
  }

  private setBatchTimer(): void {
    if (this.batchTimer) return

    this.batchTimer = window.setTimeout(() => {
      this.processBatch()
    }, this.config.maxBatchDelay)
  }

  private clearBatchTimer(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }
  }

  private processBatch(): void {
    if (this.updateQueue.length === 0) return

    const batch: UpdateBatch<T> = {
      id: this.generateBatchId(),
      updates: [...this.updateQueue],
      timestamp: Date.now(),
      totalSize: JSON.stringify(this.updateQueue).length
    }

    // Clear queue and timer
    this.updateQueue = []
    this.clearBatchTimer()

    // Process the batch (in real implementation would send to server)
    console.log('Processing batch:', batch)
  }

  private notifyChangeListeners(delta: UpdateDelta<T>): void {
    this.changeListeners.forEach(listener => {
      try {
        listener(delta)
      } catch (error) {
        console.error('Error in change listener:', error)
      }
    })
  }

  private generateUpdateId(): string {
    return `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// Convenience functions for common use cases
export function createIncrementalManager<T>(
  initialData: T,
  config?: Partial<IncrementalUpdateConfig>
): IncrementalUpdatesManager<T> {
  return new IncrementalUpdatesManager(initialData, config)
}

export function computeDataDelta<T>(oldData: T, newData: T): UpdateDelta<T>[] {
  const manager = new IncrementalUpdatesManager(oldData)
  return manager.computeDelta(oldData, newData)
}

export function applyIncrementalUpdate<T>(
  data: T,
  delta: UpdateDelta<T>
): T {
  const manager = new IncrementalUpdatesManager(data)
  manager.applyUpdate(delta)
  return manager.currentData
}

// Export types for external use
export type { UpdateDelta, IncrementalUpdateConfig, UpdateBatch, IncrementalState }