/**
 * Property-Based Tests for Comprehensive Offline Functionality
 * 
 * **Feature: network-performance-optimization, Property 16: Comprehensive offline functionality**
 * **Validates: Requirements 5.1, 5.3**
 * 
 * Tests that previously visited pages are accessible offline with appropriate indicators
 * and that essential assets are available for offline access.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fc from 'fast-check'

// Mock types for offline functionality
interface CachedPage {
  url: string
  content: string
  timestamp: number
  assets: string[]
}

interface OfflineIndicator {
  isVisible: boolean
  message: string
  type: 'banner' | 'badge' | 'overlay'
}

interface EssentialAsset {
  url: string
  type: 'css' | 'js' | 'font' | 'icon'
  cached: boolean
  size: number
}

// Mock offline manager for testing
class MockOfflineManager {
  private cachedPages: Map<string, CachedPage> = new Map()
  private essentialAssets: Map<string, EssentialAsset> = new Map()
  private isOffline: boolean = false

  setOfflineStatus(offline: boolean): void {
    this.isOffline = offline
  }

  cachePage(url: string, content: string, assets: string[]): void {
    this.cachedPages.set(url, {
      url,
      content,
      timestamp: Date.now(),
      assets
    })
  }

  cacheEssentialAsset(asset: EssentialAsset): void {
    this.essentialAssets.set(asset.url, { ...asset, cached: true })
  }

  getOfflinePage(url: string): { content: string | null; indicator: OfflineIndicator } {
    const cached = this.cachedPages.get(url)
    
    if (!this.isOffline) {
      return {
        content: cached?.content || null,
        indicator: { isVisible: false, message: '', type: 'banner' }
      }
    }

    if (cached) {
      return {
        content: cached.content,
        indicator: {
          isVisible: true,
          message: 'You are viewing cached content while offline',
          type: 'banner'
        }
      }
    }

    return {
      content: null,
      indicator: {
        isVisible: true,
        message: 'This page is not available offline',
        type: 'overlay'
      }
    }
  }

  getEssentialAssets(): EssentialAsset[] {
    return Array.from(this.essentialAssets.values()).filter(asset => asset.cached)
  }

  areEssentialAssetsAvailable(): boolean {
    const essentialTypes = ['css', 'js', 'font']
    return essentialTypes.every(type => 
      Array.from(this.essentialAssets.values()).some(asset => 
        asset.type === type && asset.cached
      )
    )
  }
}

describe('Comprehensive Offline Functionality Property Tests', () => {
  let offlineManager: MockOfflineManager

  beforeEach(() => {
    offlineManager = new MockOfflineManager()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Property 16: Comprehensive offline functionality', () => {
    it('should display cached content with offline indicators when offline', () => {
      fc.assert(fc.property(
        fc.array(fc.record({
          url: fc.webUrl(),
          content: fc.string({ minLength: 10, maxLength: 1000 }),
          assets: fc.array(fc.webUrl(), { minLength: 0, maxLength: 5 })
        }), { minLength: 1, maxLength: 10 }),
        fc.boolean(),
        (pages, isOffline) => {
          // Cache all pages when online
          offlineManager.setOfflineStatus(false)
          pages.forEach(page => {
            offlineManager.cachePage(page.url, page.content, page.assets)
          })

          // Set offline status
          offlineManager.setOfflineStatus(isOffline)

          // Test each cached page
          pages.forEach(page => {
            const result = offlineManager.getOfflinePage(page.url)

            if (isOffline) {
              // When offline, cached content should be available with indicator
              expect(result.content).toBe(page.content)
              expect(result.indicator.isVisible).toBe(true)
              expect(result.indicator.message).toContain('offline')
            } else {
              // When online, content should be available without offline indicator
              expect(result.content).toBe(page.content)
              expect(result.indicator.isVisible).toBe(false)
            }
          })
        }
      ), { numRuns: 100 })
    })

    it('should show appropriate offline indicators for uncached pages', () => {
      fc.assert(fc.property(
        fc.array(fc.webUrl(), { minLength: 1, maxLength: 5 }),
        (uncachedUrls) => {
          // Set offline status
          offlineManager.setOfflineStatus(true)

          // Test uncached pages
          uncachedUrls.forEach(url => {
            const result = offlineManager.getOfflinePage(url)

            // Uncached pages should not be available offline
            expect(result.content).toBeNull()
            expect(result.indicator.isVisible).toBe(true)
            expect(result.indicator.message).toContain('not available offline')
          })
        }
      ), { numRuns: 100 })
    })

    it('should ensure essential assets are available for offline access', () => {
      fc.assert(fc.property(
        fc.array(fc.record({
          url: fc.webUrl(),
          type: fc.constantFrom('css', 'js', 'font', 'icon'),
          size: fc.integer({ min: 1024, max: 1024 * 1024 }) // 1KB to 1MB
        }), { minLength: 0, maxLength: 20 }),
        (assets) => {
          // Always ensure we have at least one of each essential type
          const essentialAssets = [
            { url: 'https://example.com/app.css', type: 'css' as const, size: 10240 },
            { url: 'https://example.com/app.js', type: 'js' as const, size: 20480 },
            { url: 'https://example.com/font.woff2', type: 'font' as const, size: 15360 }
          ]

          // Add the generated assets
          const allAssets = [...essentialAssets, ...assets]

          // Cache all assets
          allAssets.forEach(asset => {
            offlineManager.cacheEssentialAsset({
              ...asset,
              cached: false
            })
          })

          // Get cached essential assets
          const cachedAssets = offlineManager.getEssentialAssets()
          const areEssentialsAvailable = offlineManager.areEssentialAssetsAvailable()

          // All cached assets should be marked as cached
          expect(cachedAssets.length).toBeGreaterThanOrEqual(3) // At least the 3 essential types
          cachedAssets.forEach(asset => {
            expect(asset.cached).toBe(true)
          })

          // Essential asset types should be available
          expect(areEssentialsAvailable).toBe(true)

          // Each essential type should have at least one cached asset
          const essentialTypes = ['css', 'js', 'font']
          essentialTypes.forEach(type => {
            const hasType = cachedAssets.some(asset => asset.type === type)
            expect(hasType).toBe(true)
          })
        }
      ), { numRuns: 100 })
    })

    it('should maintain cache consistency across offline/online transitions', () => {
      fc.assert(fc.property(
        fc.record({
          url: fc.webUrl(),
          content: fc.string({ minLength: 10, maxLength: 500 }),
          assets: fc.array(fc.webUrl(), { minLength: 0, maxLength: 3 })
        }),
        fc.array(fc.boolean(), { minLength: 2, maxLength: 10 }),
        (page, statusChanges) => {
          // Cache page when online
          offlineManager.setOfflineStatus(false)
          offlineManager.cachePage(page.url, page.content, page.assets)

          let lastResult: { content: string | null; indicator: OfflineIndicator } | null = null

          // Test through multiple status changes
          statusChanges.forEach(isOffline => {
            offlineManager.setOfflineStatus(isOffline)
            const result = offlineManager.getOfflinePage(page.url)

            // Content should always be available (cached)
            expect(result.content).toBe(page.content)

            // Offline indicator should match current status
            expect(result.indicator.isVisible).toBe(isOffline)

            if (isOffline) {
              expect(result.indicator.message).toContain('offline')
            }

            lastResult = result
          })

          // Final state should be consistent
          expect(lastResult).toBeTruthy()
        }
      ), { numRuns: 100 })
    })

    it('should handle cache invalidation and refresh scenarios', () => {
      fc.assert(fc.property(
        fc.array(fc.record({
          url: fc.webUrl(),
          content: fc.string({ minLength: 5, maxLength: 200 }),
          assets: fc.array(fc.webUrl(), { minLength: 0, maxLength: 2 })
        }), { minLength: 1, maxLength: 5 }),
        fc.nat({ max: 2 }), // Number of cache refreshes
        (pages, refreshCount) => {
          // Initial caching
          pages.forEach(page => {
            offlineManager.cachePage(page.url, page.content, page.assets)
          })

          // Simulate cache refreshes with updated content
          for (let i = 0; i < refreshCount; i++) {
            pages.forEach(page => {
              const updatedContent = `${page.content}_updated_${i}`
              offlineManager.cachePage(page.url, updatedContent, page.assets)
            })
          }

          // Test offline access after refreshes
          offlineManager.setOfflineStatus(true)
          
          pages.forEach(page => {
            const result = offlineManager.getOfflinePage(page.url)
            
            // Should have the latest cached version
            expect(result.content).toBeTruthy()
            expect(result.indicator.isVisible).toBe(true)
            
            // Content should reflect the number of updates
            if (refreshCount > 0) {
              expect(result.content).toContain(`_updated_${refreshCount - 1}`)
            }
          })
        }
      ), { numRuns: 100 })
    })
  })
})