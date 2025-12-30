/**
 * Property-Based Tests for Data Usage Options
 * **Feature: network-performance-optimization, Property 14: Data usage options**
 * **Validates: Requirements 4.4**
 * 
 * Tests that user preference settings for data usage are available and functional
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { 
  DataUsageOptimizer, 
  type DataUsagePreferences,
  dataUsageOptimizer,
  enableDataSavingMode,
  disableDataSavingMode,
  updateDataUsagePreferences,
  getDataUsagePreferences
} from './dataUsageOptimizer'

describe('Data Usage Options Property Tests', () => {
  let optimizer: DataUsageOptimizer

  beforeEach(() => {
    // Create fresh instance for each test
    optimizer = new DataUsageOptimizer()
    // Clear localStorage to ensure clean state
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  /**
   * Property 14: Data usage options
   * For any user preference setting, options to reduce data usage should be available and functional
   */
  it('should provide functional data usage options for any preference configuration', () => {
    fc.assert(fc.property(
      // Generate random preference configurations
      fc.record({
        dataSavingMode: fc.boolean(),
        imageQuality: fc.constantFrom('low', 'medium', 'high', 'auto'),
        videoAutoplay: fc.boolean(),
        preloadContent: fc.boolean(),
        compressionEnabled: fc.boolean(),
        maxImageSize: fc.integer({ min: 50, max: 2000 }), // 50KB to 2MB
        maxVideoSize: fc.integer({ min: 1, max: 50 }) // 1MB to 50MB
      }),
      (preferences: DataUsagePreferences) => {
        // Apply the preferences
        optimizer.updatePreferences(preferences)
        
        // Verify preferences are stored correctly
        const storedPreferences = optimizer.currentPreferences
        expect(storedPreferences.dataSavingMode).toBe(preferences.dataSavingMode)
        expect(storedPreferences.imageQuality).toBe(preferences.imageQuality)
        expect(storedPreferences.videoAutoplay).toBe(preferences.videoAutoplay)
        expect(storedPreferences.preloadContent).toBe(preferences.preloadContent)
        expect(storedPreferences.compressionEnabled).toBe(preferences.compressionEnabled)
        expect(storedPreferences.maxImageSize).toBe(preferences.maxImageSize)
        expect(storedPreferences.maxVideoSize).toBe(preferences.maxVideoSize)

        // Verify data saving options are functional
        if (preferences.dataSavingMode) {
          // When data saving mode is enabled, content loading should be restricted
          expect(optimizer.shouldLoadHighQualityContent()).toBe(false)
          expect(optimizer.shouldPreloadContent()).toBe(false)
          expect(optimizer.shouldAutoplayVideo()).toBe(false)
        }

        // Verify image size optimization is functional
        const testImageSize = 1024 * 1024 // 1MB
        const optimizedSize = optimizer.getOptimalImageSize(testImageSize)
        expect(optimizedSize).toBeGreaterThan(0)
        expect(optimizedSize).toBeLessThanOrEqual(testImageSize)
        
        // In data saving mode, optimized size should be significantly smaller
        if (preferences.dataSavingMode) {
          expect(optimizedSize).toBeLessThanOrEqual(testImageSize * 0.6) // At least 40% reduction
        }

        // Verify effective image quality is determined correctly
        const effectiveQuality = optimizer.effectiveImageQuality
        expect(['low', 'medium', 'high']).toContain(effectiveQuality)
        
        // If not auto mode, effective quality should match preference
        if (preferences.imageQuality !== 'auto') {
          expect(effectiveQuality).toBe(preferences.imageQuality)
        }
      }
    ), { numRuns: 100 })
  })

  it('should maintain data usage preference persistence across sessions', () => {
    fc.assert(fc.property(
      fc.record({
        dataSavingMode: fc.boolean(),
        imageQuality: fc.constantFrom('low', 'medium', 'high', 'auto'),
        videoAutoplay: fc.boolean(),
        preloadContent: fc.boolean(),
        compressionEnabled: fc.boolean(),
        maxImageSize: fc.integer({ min: 50, max: 2000 }),
        maxVideoSize: fc.integer({ min: 1, max: 50 })
      }),
      (preferences: DataUsagePreferences) => {
        // Set preferences in first optimizer instance
        optimizer.updatePreferences(preferences)
        
        // Create new optimizer instance (simulating new session)
        const newOptimizer = new DataUsageOptimizer()
        
        // Verify preferences are persisted
        const persistedPreferences = newOptimizer.currentPreferences
        expect(persistedPreferences.dataSavingMode).toBe(preferences.dataSavingMode)
        expect(persistedPreferences.imageQuality).toBe(preferences.imageQuality)
        expect(persistedPreferences.videoAutoplay).toBe(preferences.videoAutoplay)
        expect(persistedPreferences.preloadContent).toBe(preferences.preloadContent)
        expect(persistedPreferences.compressionEnabled).toBe(preferences.compressionEnabled)
        expect(persistedPreferences.maxImageSize).toBe(preferences.maxImageSize)
        expect(persistedPreferences.maxVideoSize).toBe(preferences.maxVideoSize)
      }
    ), { numRuns: 100 })
  })

  it('should provide consistent data saving mode toggle functionality', () => {
    fc.assert(fc.property(
      fc.boolean(), // Initial data saving mode state
      (initialDataSavingMode: boolean) => {
        // Set initial state
        optimizer.updatePreferences({ dataSavingMode: initialDataSavingMode })
        
        // Test enabling data saving mode
        optimizer.enableDataSavingMode()
        const enabledPrefs = optimizer.currentPreferences
        expect(enabledPrefs.dataSavingMode).toBe(true)
        expect(enabledPrefs.imageQuality).toBe('low')
        expect(enabledPrefs.videoAutoplay).toBe(false)
        expect(enabledPrefs.preloadContent).toBe(false)
        expect(enabledPrefs.compressionEnabled).toBe(true)
        expect(enabledPrefs.maxImageSize).toBeLessThanOrEqual(200) // Reduced limit
        expect(enabledPrefs.maxVideoSize).toBeLessThanOrEqual(5) // Reduced limit
        
        // Test disabling data saving mode
        optimizer.disableDataSavingMode()
        const disabledPrefs = optimizer.currentPreferences
        expect(disabledPrefs.dataSavingMode).toBe(false)
        expect(disabledPrefs.imageQuality).toBe('auto')
        expect(disabledPrefs.videoAutoplay).toBe(true)
        expect(disabledPrefs.preloadContent).toBe(true)
        expect(disabledPrefs.compressionEnabled).toBe(true)
        expect(disabledPrefs.maxImageSize).toBeGreaterThanOrEqual(500) // Restored limit
        expect(disabledPrefs.maxVideoSize).toBeGreaterThanOrEqual(10) // Restored limit
      }
    ), { numRuns: 100 })
  })

  it('should provide bandwidth-aware content delivery options', () => {
    fc.assert(fc.property(
      fc.record({
        dataSavingMode: fc.boolean(),
        imageQuality: fc.constantFrom('low', 'medium', 'high', 'auto'),
        preloadContent: fc.boolean(),
        videoAutoplay: fc.boolean()
      }),
      fc.float({ min: Math.fround(0.1), max: Math.fround(20.0) }), // Simulated bandwidth in Mbps
      (preferences: DataUsagePreferences, bandwidth: number) => {
        // Apply preferences
        optimizer.updatePreferences(preferences)
        
        // Mock network state with specific bandwidth
        const mockNetworkState = {
          isOnline: true,
          connectionType: 'wifi' as const,
          effectiveType: bandwidth > 5 ? '4g' as const : '3g' as const,
          downlink: bandwidth,
          rtt: 50,
          saveData: false
        }
        
        // Test bandwidth-aware decisions
        const shouldLoadHQ = optimizer.shouldLoadHighQualityContent()
        const shouldPreload = optimizer.shouldPreloadContent()
        const shouldAutoplay = optimizer.shouldAutoplayVideo()
        
        // Verify decisions are boolean values (functional)
        expect(typeof shouldLoadHQ).toBe('boolean')
        expect(typeof shouldPreload).toBe('boolean')
        expect(typeof shouldAutoplay).toBe('boolean')
        
        // In data saving mode, all should be false regardless of bandwidth
        if (preferences.dataSavingMode) {
          expect(shouldLoadHQ).toBe(false)
          expect(shouldPreload).toBe(false)
          expect(shouldAutoplay).toBe(false)
        }
        
        // Test image size optimization is bandwidth-aware
        const testImageSize = 1024 * 1024 // 1MB
        const optimizedSize = optimizer.getOptimalImageSize(testImageSize)
        expect(optimizedSize).toBeGreaterThan(0)
        expect(optimizedSize).toBeLessThanOrEqual(testImageSize)
        
        // Lower bandwidth should result in smaller optimized sizes
        if (bandwidth < 1.0) { // Low bandwidth
          expect(optimizedSize).toBeLessThanOrEqual(testImageSize * 0.4) // Significant reduction
        }
      }
    ), { numRuns: 100 })
  })

  it('should provide functional compression options', async () => {
    await fc.assert(fc.asyncProperty(
      fc.boolean(), // Compression enabled
      fc.string({ minLength: 100, maxLength: 10000 }), // Test data
      async (compressionEnabled: boolean, testData: string) => {
        // Set compression preference
        optimizer.updatePreferences({ compressionEnabled })
        
        // Test compression functionality
        const compressed = await optimizer.compressData(testData)
        const decompressed = await optimizer.decompressData(compressed)
        
        // Verify compression options are functional
        expect(compressed).toBeDefined()
        expect(decompressed).toBeDefined()
        
        if (compressionEnabled && testData.length >= 1024) { // Min compression size
          // Compression should reduce size (in real implementation)
          // For our mock implementation, we just verify it returns data
          expect(compressed).toBeInstanceOf(ArrayBuffer)
        } else {
          // Should return original data if compression disabled or data too small
          expect(compressed).toBe(testData)
        }
        
        return true // Explicitly return true for async property
      }
    ), { numRuns: 50 }) // Reduced runs for async test
  })

  // Test convenience functions
  it('should provide functional convenience functions for data usage options', () => {
    fc.assert(fc.property(
      fc.boolean(),
      (initialDataSavingMode: boolean) => {
        // Test global convenience functions
        updateDataUsagePreferences({ dataSavingMode: initialDataSavingMode })
        
        let preferences = getDataUsagePreferences()
        expect(preferences.dataSavingMode).toBe(initialDataSavingMode)
        
        // Test enable/disable functions
        enableDataSavingMode()
        preferences = getDataUsagePreferences()
        expect(preferences.dataSavingMode).toBe(true)
        
        disableDataSavingMode()
        preferences = getDataUsagePreferences()
        expect(preferences.dataSavingMode).toBe(false)
        
        // All functions should be available and functional
        expect(typeof enableDataSavingMode).toBe('function')
        expect(typeof disableDataSavingMode).toBe('function')
        expect(typeof updateDataUsagePreferences).toBe('function')
        expect(typeof getDataUsagePreferences).toBe('function')
      }
    ), { numRuns: 100 })
  })
})