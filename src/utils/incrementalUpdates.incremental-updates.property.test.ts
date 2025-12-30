/**
 * Property-Based Tests for Incremental Updates
 * **Feature: network-performance-optimization, Property 15: Incremental updates**
 * **Validates: Requirements 4.5**
 * 
 * Tests that content updates use incremental updates rather than full page reloads
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fc from 'fast-check'
import { 
  IncrementalUpdatesManager,
  createIncrementalManager,
  computeDataDelta,
  applyIncrementalUpdate,
  type UpdateDelta,
  type IncrementalUpdateConfig
} from './incrementalUpdates'

// Mock network manager for testing
vi.mock('./networkManager', () => ({
  networkManager: {
    executeRequest: vi.fn().mockResolvedValue({ updates: [], newVersion: 1 })
  }
}))

// Mock cache manager for testing
vi.mock('./cacheManager', () => ({
  cacheManager: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined)
  }
}))

// Mock data usage optimizer for testing
vi.mock('./dataUsageOptimizer', () => ({
  dataUsageOptimizer: {
    recordDataUsage: vi.fn(),
    compressData: vi.fn().mockImplementation((data) => Promise.resolve(data)),
    currentPreferences: { compressionEnabled: true }
  }
}))

describe('Incremental Updates Property Tests', () => {
  let manager: IncrementalUpdatesManager<any>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (manager) {
      manager.removeAllChangeListeners()
    }
  })

  /**
   * Property 15: Incremental updates
   * For any content update, the system should use incremental updates rather than full page reloads
   */
  it('should use incremental updates instead of full data replacement for any content change', () => {
    fc.assert(fc.property(
      // Generate initial data structure
      fc.record({
        id: fc.string(),
        name: fc.string(),
        items: fc.array(fc.record({
          id: fc.string(),
          value: fc.string()
        })),
        metadata: fc.record({
          version: fc.integer({ min: 1, max: 100 }),
          timestamp: fc.integer({ min: 1000000000, max: 2000000000 })
        })
      }),
      // Generate updates to apply
      fc.array(fc.record({
        type: fc.constantFrom('create', 'update', 'delete'),
        path: fc.option(fc.string()),
        newValue: fc.option(fc.string())
      }), { minLength: 1, maxLength: 10 }),
      (initialData, updates) => {
        // Create manager with initial data
        manager = createIncrementalManager(initialData)
        const initialVersion = manager.version
        const initialTimestamp = manager.lastUpdateTimestamp
        
        // Apply updates incrementally
        updates.forEach((updateSpec, index) => {
          const delta: UpdateDelta = {
            id: `test_${index}`,
            type: updateSpec.type,
            timestamp: Date.now() + index + 1, // Ensure unique timestamps
            data: updateSpec.newValue ? { ...initialData, modified: updateSpec.newValue } : undefined,
            path: updateSpec.path || undefined
          }
          
          manager.applyUpdate(delta)
        })
        
        // Verify incremental behavior
        // 1. Version should increment with each update (not reset)
        expect(manager.version).toBeGreaterThan(initialVersion)
        expect(manager.version).toBe(initialVersion + updates.length)
        
        // 2. Timestamp should be updated (not reset to initial)
        expect(manager.lastUpdateTimestamp).toBeGreaterThanOrEqual(initialTimestamp)
        
        // 3. Should track pending updates (incremental approach)
        expect(manager.hasPendingUpdates).toBe(true)
        
        // 4. Should maintain data continuity (not full replacement)
        const currentData = manager.currentData
        expect(currentData).toBeDefined()
        
        // 5. Should be able to get snapshot without losing incremental state
        const snapshot = manager.getSnapshot()
        expect(snapshot.version).toBe(manager.version)
        expect(snapshot.pendingUpdates.length).toBeGreaterThan(0)
        
        // 6. Should support batching (incremental processing)
        const batches = manager.getBatchedUpdates()
        expect(Array.isArray(batches)).toBe(true)
        
        // Each batch should contain incremental updates, not full data
        batches.forEach(batch => {
          expect(batch.updates.length).toBeGreaterThan(0)
          expect(batch.totalSize).toBeGreaterThan(0)
          expect(batch.timestamp).toBeGreaterThan(0)
        })
      }
    ), { numRuns: 100 })
  })

  it('should preserve data integrity during incremental updates', () => {
    fc.assert(fc.property(
      fc.record({
        users: fc.array(fc.record({
          id: fc.string(),
          name: fc.string(),
          email: fc.string()
        })),
        settings: fc.record({
          theme: fc.string(),
          language: fc.string()
        })
      }),
      fc.array(fc.record({
        type: fc.constantFrom('create', 'update', 'delete'),
        userId: fc.option(fc.string()),
        newName: fc.option(fc.string())
      }), { minLength: 1, maxLength: 5 }),
      (initialData, updateSpecs) => {
        manager = createIncrementalManager(initialData)
        const originalDataString = JSON.stringify(initialData)
        
        // Apply incremental updates
        updateSpecs.forEach((spec, index) => {
          const delta: UpdateDelta = {
            id: `integrity_test_${index}`,
            type: spec.type,
            timestamp: Date.now() + index,
            data: spec.newName ? { ...manager.currentData, modified: spec.newName } : manager.currentData
          }
          
          manager.applyUpdate(delta)
        })
        
        // Verify data integrity is maintained
        const currentData = manager.currentData
        expect(currentData).toBeDefined()
        
        // Should not corrupt original data structure
        expect(typeof currentData).toBe('object')
        
        // Should maintain version consistency
        expect(manager.version).toBeGreaterThan(0)
        expect(manager.version).toBe(1 + updateSpecs.length)
        
        // Should be able to restore from snapshot
        const snapshot = manager.getSnapshot()
        manager.reset(initialData)
        manager.restoreFromSnapshot(snapshot)
        
        expect(manager.version).toBe(snapshot.version)
        expect(manager.lastUpdateTimestamp).toBe(snapshot.lastUpdateTimestamp)
      }
    ), { numRuns: 100 })
  })

  it('should support efficient delta computation for incremental updates', () => {
    fc.assert(fc.property(
      fc.record({
        content: fc.string(),
        count: fc.integer(),
        active: fc.boolean()
      }),
      fc.record({
        content: fc.string(),
        count: fc.integer(),
        active: fc.boolean()
      }),
      (oldData, newData) => {
        // Compute delta between old and new data
        const deltas = computeDataDelta(oldData, newData)
        
        // Verify delta computation produces incremental updates
        expect(Array.isArray(deltas)).toBe(true)
        
        if (JSON.stringify(oldData) !== JSON.stringify(newData)) {
          // Should produce at least one delta for different data
          expect(deltas.length).toBeGreaterThan(0)
          
          // Each delta should be properly structured
          deltas.forEach(delta => {
            expect(delta.id).toBeDefined()
            expect(delta.type).toMatch(/^(create|update|delete)$/)
            expect(delta.timestamp).toBeGreaterThan(0)
            expect(delta.data).toBeDefined()
            expect(delta.previousData).toBeDefined()
          })
        } else {
          // Should produce no deltas for identical data
          expect(deltas.length).toBe(0)
        }
        
        // Test applying incremental update
        const result = applyIncrementalUpdate(oldData, {
          id: 'test_delta',
          type: 'update',
          timestamp: Date.now(),
          data: newData
        })
        
        // Should produce updated data without full replacement
        expect(result).toBeDefined()
        expect(JSON.stringify(result)).toBe(JSON.stringify(newData))
      }
    ), { numRuns: 100 })
  })

  it('should handle incremental loading with caching efficiently', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        items: fc.array(fc.string()),
        lastSync: fc.integer({ min: 1000000000, max: 2000000000 })
      }),
      fc.array(fc.record({
        id: fc.string(),
        type: fc.constantFrom('create', 'update', 'delete'),
        data: fc.string()
      }), { minLength: 0, maxLength: 5 }),
      fc.boolean(), // Use cache
      async (initialData, mockUpdates, useCache) => {
        manager = createIncrementalManager(initialData)
        
        // Mock fetcher that returns incremental updates
        const mockFetcher = vi.fn().mockResolvedValue(
          mockUpdates.map(update => ({
            id: update.id,
            type: update.type,
            timestamp: Date.now(),
            data: update.data
          }))
        )
        
        // Load incremental updates
        const updates = await manager.loadIncremental(mockFetcher, useCache)
        
        // Verify incremental loading behavior
        expect(Array.isArray(updates)).toBe(true)
        expect(updates.length).toBe(mockUpdates.length)
        
        // Should call fetcher with current state (incremental approach)
        expect(mockFetcher).toHaveBeenCalledWith(
          manager.lastUpdateTimestamp,
          manager.version
        )
        
        // Should return properly structured updates
        updates.forEach(update => {
          expect(update.id).toBeDefined()
          expect(update.type).toMatch(/^(create|update|delete)$/)
          expect(update.timestamp).toBeGreaterThan(0)
        })
        
        return true // Explicit return for async property
      }
    ), { numRuns: 50 })
  })

  it('should batch incremental updates efficiently', () => {
    fc.assert(fc.property(
      fc.record({
        batchSize: fc.integer({ min: 1, max: 20 }),
        maxBatchDelay: fc.integer({ min: 100, max: 5000 })
      }),
      fc.array(fc.record({
        id: fc.string(),
        content: fc.string()
      }), { minLength: 1, max: 50 }),
      (config, items) => {
        manager = createIncrementalManager({}, config)
        
        // Apply multiple updates to trigger batching
        items.forEach((item, index) => {
          const delta: UpdateDelta = {
            id: `batch_test_${index}`,
            type: 'update',
            timestamp: Date.now() + index,
            data: item
          }
          
          manager.applyUpdate(delta)
        })
        
        // Get batched updates
        const batches = manager.getBatchedUpdates()
        
        // Verify batching behavior
        expect(Array.isArray(batches)).toBe(true)
        
        if (items.length > 0) {
          expect(batches.length).toBeGreaterThan(0)
          
          // Each batch should respect size limits
          batches.forEach(batch => {
            expect(batch.updates.length).toBeLessThanOrEqual(config.batchSize)
            expect(batch.updates.length).toBeGreaterThan(0)
            expect(batch.totalSize).toBeGreaterThan(0)
          })
          
          // Total updates in batches should equal applied updates
          const totalBatchedUpdates = batches.reduce((sum, batch) => sum + batch.updates.length, 0)
          expect(totalBatchedUpdates).toBe(items.length)
        }
        
        // Should be able to flush pending updates
        const pendingBefore = manager.hasPendingUpdates
        const flushed = manager.flushPendingUpdates()
        
        expect(Array.isArray(flushed)).toBe(true)
        if (pendingBefore) {
          expect(flushed.length).toBeGreaterThan(0)
        }
      }
    ), { numRuns: 100 })
  })

  it('should support change tracking for incremental updates', () => {
    fc.assert(fc.property(
      fc.array(fc.record({
        action: fc.constantFrom('add', 'modify', 'remove'),
        value: fc.string()
      }), { minLength: 1, maxLength: 10 }),
      (actions) => {
        manager = createIncrementalManager({ items: [] }, { trackChanges: true })
        
        const changeEvents: UpdateDelta[] = []
        
        // Add change listener
        const removeListener = manager.addChangeListener((delta) => {
          changeEvents.push(delta)
        })
        
        // Apply actions as incremental updates
        actions.forEach((action, index) => {
          const delta: UpdateDelta = {
            id: `change_${index}`,
            type: action.action === 'remove' ? 'delete' : 'update',
            timestamp: Date.now() + index,
            data: { value: action.value }
          }
          
          manager.applyUpdate(delta)
        })
        
        // Verify change tracking
        expect(changeEvents.length).toBe(actions.length)
        
        // Each change event should correspond to an incremental update
        changeEvents.forEach((event, index) => {
          expect(event.id).toBe(`change_${index}`)
          expect(event.timestamp).toBeGreaterThan(0)
          expect(event.data).toBeDefined()
        })
        
        // Should be able to remove listener
        removeListener()
        manager.removeAllChangeListeners()
        
        // Apply another update - should not trigger events
        const eventCountBefore = changeEvents.length
        manager.applyUpdate({
          id: 'after_remove',
          type: 'update',
          timestamp: Date.now(),
          data: { test: 'value' }
        })
        
        expect(changeEvents.length).toBe(eventCountBefore)
      }
    ), { numRuns: 100 })
  })
})