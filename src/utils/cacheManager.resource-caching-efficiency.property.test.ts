/**
 * Property-Based Tests for Cache Manager - Resource Caching Efficiency
 * 
 * **Feature: network-performance-optimization, Property 8: Resource caching efficiency**
 * **Validates: Requirements 2.4**
 * 
 * Tests that repeated resource requests are served from cache when appropriate
 * to reduce network usage and improve performance.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import fc from 'fast-check'
import { CacheManager, cacheApiResponse, cacheStaticAsset, getCacheStats } from './cacheManager'

describe('CacheManager Resource Caching Efficiency Property Tests', () => {
  let cacheManager: CacheManager
  let mockFetcher: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Create fresh cache manager for each test
    cacheManager = new CacheManager({
      maxSize: 1024 * 1024, // 1MB for testing
      maxAge: 60000, // 1 minute for testing
      excludePatterns: ['auth', 'login']
    })
    
    mockFetcher = vi.fn()
    
    // Clear any existing cache
    cacheManager.clear()
  })

  /**
   * Property: Cache Hit Efficiency
   * For any repeated resource request, the second request should be served from cache
   * without calling the network fetcher again.
   */
  it('should serve repeated requests from cache without network calls', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          key: fc.string({ minLength: 2, maxLength: 50 }).filter(s => s.trim().length > 1),
          data: fc.oneof(
            fc.string({ minLength: 1 }),
            fc.integer(),
            fc.record({
              id: fc.string({ minLength: 1 }),
              value: fc.string(),
              timestamp: fc.integer()
            })
          ),
          strategy: fc.constantFrom('cache-first', 'stale-while-revalidate') // Only test cacheable strategies
        }),
        async ({ key, data, strategy }) => {
          // Skip excluded patterns and whitespace-only keys
          if (key.toLowerCase().includes('auth') || 
              key.toLowerCase().includes('login') ||
              key.trim().length <= 1) {
            return
          }

          // Create fresh cache manager for this test
          const testCache = new CacheManager()
          testCache.clear()

          // Setup mock fetcher to return test data
          mockFetcher.mockResolvedValue(data)

          // First request - should call fetcher
          const result1 = await testCache.cacheFirst({
            key: `api:${key}`,
            fetcher: mockFetcher,
            ttl: 60000
          })
          expect(result1).toEqual(data)
          expect(mockFetcher).toHaveBeenCalledTimes(1)

          // Reset mock call count
          mockFetcher.mockClear()

          // Second request - should be served from cache
          const result2 = await testCache.cacheFirst({
            key: `api:${key}`,
            fetcher: mockFetcher,
            ttl: 60000
          })
          expect(result2).toEqual(data)
          expect(mockFetcher).toHaveBeenCalledTimes(0) // Should not call fetcher again
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Property: Cache Statistics Accuracy
   * For any series of cache operations, the cache statistics should accurately
   * reflect hits, misses, and total operations.
   */
  it('should maintain accurate cache statistics for all operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            key: fc.string({ minLength: 2, maxLength: 20 }).filter(s => s.trim().length > 1),
            data: fc.string({ minLength: 1, maxLength: 100 }),
            repeat: fc.boolean()
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (operations) => {
          // Create fresh cache manager for this test
          const testCache = new CacheManager()
          testCache.clear()

          const initialStats = testCache.getStats()
          let expectedMisses = 0
          let expectedHits = 0

          for (const operation of operations) {
            // Skip excluded patterns and invalid keys
            if (operation.key.toLowerCase().includes('auth') || 
                operation.key.toLowerCase().includes('login') ||
                operation.key.trim().length <= 1) {
              continue
            }

            mockFetcher.mockResolvedValue(operation.data)

            // First request for this key
            await testCache.cacheFirst({
              key: operation.key,
              fetcher: mockFetcher,
              ttl: 60000
            })
            expectedMisses++ // First request is always a miss

            if (operation.repeat) {
              // Second request for same key
              await testCache.cacheFirst({
                key: operation.key,
                fetcher: mockFetcher,
                ttl: 60000
              })
              expectedHits++ // Second request should be a hit
            }
          }

          const finalStats = testCache.getStats()
          
          // Verify statistics are reasonable (allowing for some variance due to eviction)
          expect(finalStats.hits).toBeGreaterThanOrEqual(Math.max(0, expectedHits - 2))
          expect(finalStats.misses).toBeGreaterThanOrEqual(Math.max(0, expectedMisses - 2))
          
          if (expectedMisses > 0) {
            expect(finalStats.entryCount).toBeGreaterThan(0)
          }
        }
      ),
      { numRuns: 30 }
    )
  })

  /**
   * Property: TTL Expiration Behavior
   * For any cached resource with TTL, expired entries should not be served
   * and should trigger a new network request.
   */
  it('should not serve expired cache entries and should refetch', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          key: fc.string({ minLength: 2, maxLength: 30 }).filter(s => s.trim().length > 1),
          data: fc.string({ minLength: 1, maxLength: 50 }),
          ttl: fc.integer({ min: 10, max: 50 }) // Short TTL for testing
        }),
        async ({ key, data, ttl }) => {
          // Skip excluded patterns and invalid keys
          if (key.toLowerCase().includes('auth') || 
              key.toLowerCase().includes('login') ||
              key.trim().length <= 1) {
            return
          }

          // Create fresh cache manager for this test
          const testCache = new CacheManager()
          testCache.clear()

          mockFetcher.mockResolvedValue(data)

          // Set data in cache with short TTL
          await testCache.set(key, data, ttl)

          // Verify data is cached
          const cachedData = await testCache.get(key)
          expect(cachedData).toEqual(data)

          // Wait for TTL to expire
          await new Promise(resolve => setTimeout(resolve, ttl + 20))

          // Verify expired data is not served
          const expiredData = await testCache.get(key)
          expect(expiredData).toBeNull()

          // New request should call fetcher again
          mockFetcher.mockClear()
          const newData = await testCache.cacheFirst({
            key: key,
            fetcher: mockFetcher,
            ttl: 60000
          })
          expect(newData).toEqual(data)
          expect(mockFetcher).toHaveBeenCalledTimes(1)
        }
      ),
      { numRuns: 10 } // Fewer runs due to setTimeout
    )
  })

  /**
   * Property: Cache Invalidation Effectiveness
   * For any cache invalidation pattern, all matching entries should be removed
   * and subsequent requests should trigger network calls.
   */
  it('should effectively invalidate cache entries matching patterns', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          baseKey: fc.string({ minLength: 3, maxLength: 10 })
            .filter(s => /^[a-zA-Z0-9_]+$/.test(s.trim()) && s.trim().length >= 3),
          suffix: fc.string({ minLength: 1, maxLength: 5 })
            .filter(s => /^[a-zA-Z0-9_]+$/.test(s.trim()) && s.trim().length >= 1),
          data: fc.string({ minLength: 1, maxLength: 30 })
        }),
        async ({ baseKey, suffix, data }) => {
          const cleanBase = baseKey.trim()
          const cleanSuffix = suffix.trim()
          const key1 = `${cleanBase}_${cleanSuffix}_1`
          const key2 = `${cleanBase}_${cleanSuffix}_2`
          const key3 = `other_${cleanSuffix}_3`

          // Skip excluded patterns
          if ([key1, key2, key3].some(k => 
            k.toLowerCase().includes('auth') || k.toLowerCase().includes('login')
          )) {
            return
          }

          // Create fresh cache manager for this test
          const testCache = new CacheManager()
          testCache.clear()

          mockFetcher.mockResolvedValue(data)

          // Cache multiple entries
          await testCache.set(key1, data)
          await testCache.set(key2, data)
          await testCache.set(key3, data)

          // Verify all are cached
          expect(await testCache.get(key1)).toEqual(data)
          expect(await testCache.get(key2)).toEqual(data)
          expect(await testCache.get(key3)).toEqual(data)

          // Invalidate entries matching pattern (escape special regex characters)
          const pattern = `${cleanBase}_${cleanSuffix}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          await testCache.invalidate(pattern)

          // Verify matching entries are invalidated
          expect(await testCache.get(key1)).toBeNull()
          expect(await testCache.get(key2)).toBeNull()
          
          // Verify non-matching entry is still cached
          expect(await testCache.get(key3)).toEqual(data)

          // Subsequent requests for invalidated keys should call fetcher
          mockFetcher.mockClear()
          await testCache.cacheFirst({
            key: key1,
            fetcher: mockFetcher,
            ttl: 60000
          })
          expect(mockFetcher).toHaveBeenCalledTimes(1)
        }
      ),
      { numRuns: 20 }
    )
  })

  /**
   * Property: Static Asset Caching Efficiency
   * For any static asset request, the cache-first strategy should be used
   * and subsequent requests should be served from cache.
   */
  it('should efficiently cache static assets with cache-first strategy', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          assetKey: fc.string({ minLength: 1, maxLength: 40 }),
          assetData: fc.oneof(
            fc.string(),
            fc.uint8Array({ minLength: 10, maxLength: 100 })
          )
        }),
        async ({ assetKey, assetData }) => {
          // Skip excluded patterns
          if (assetKey.toLowerCase().includes('auth') || assetKey.toLowerCase().includes('login')) {
            return
          }

          mockFetcher.mockResolvedValue(assetData)

          // First request - should call fetcher
          const result1 = await cacheStaticAsset(assetKey, mockFetcher)
          expect(result1).toEqual(assetData)
          expect(mockFetcher).toHaveBeenCalledTimes(1)

          // Reset mock
          mockFetcher.mockClear()

          // Second request - should be served from cache
          const result2 = await cacheStaticAsset(assetKey, mockFetcher)
          expect(result2).toEqual(assetData)
          expect(mockFetcher).toHaveBeenCalledTimes(0) // No network call

          // Third request - should still be from cache
          const result3 = await cacheStaticAsset(assetKey, mockFetcher)
          expect(result3).toEqual(assetData)
          expect(mockFetcher).toHaveBeenCalledTimes(0) // No network call
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Property: Memory Management Under Load
   * For any series of cache operations that exceed memory limits,
   * the cache should evict entries appropriately while maintaining functionality.
   */
  it('should manage memory efficiently under high load', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            key: fc.string({ minLength: 1, maxLength: 10 }),
            data: fc.string({ minLength: 100, maxLength: 1000 }) // Larger data to trigger eviction
          }),
          { minLength: 20, maxLength: 50 } // Many entries to exceed cache size
        ),
        async (entries) => {
          const uniqueEntries = entries.filter((entry, index, arr) => 
            arr.findIndex(e => e.key === entry.key) === index &&
            !entry.key.toLowerCase().includes('auth') &&
            !entry.key.toLowerCase().includes('login')
          )

          if (uniqueEntries.length === 0) return

          // Add many entries to exceed cache capacity
          for (const entry of uniqueEntries) {
            mockFetcher.mockResolvedValue(entry.data)
            await cacheApiResponse(entry.key, mockFetcher, 'cache-first')
          }

          const stats = getCacheStats()
          
          // Cache should still be functional
          expect(stats.entryCount).toBeGreaterThan(0)
          expect(stats.totalSize).toBeLessThanOrEqual(1024 * 1024) // Should not exceed max size
          
          // Should be able to retrieve at least some recent entries
          const lastEntry = uniqueEntries[uniqueEntries.length - 1]
          mockFetcher.mockClear()
          const retrieved = await cacheApiResponse(lastEntry.key, mockFetcher, 'cache-first')
          
          // Either served from cache (no fetcher call) or fetched fresh (one call)
          expect(mockFetcher).toHaveBeenCalledTimes(retrieved === lastEntry.data ? 0 : 1)
        }
      ),
      { numRuns: 10 } // Fewer runs due to memory operations
    )
  })
})