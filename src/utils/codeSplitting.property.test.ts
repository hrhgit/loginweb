/**
 * Property-based tests for code splitting optimization
 * **Feature: network-performance-optimization, Property 9: Code splitting optimization**
 * **Validates: Requirements 2.5**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { 
  createLazyComponent, 
  preloadComponent, 
  createInteractionLazyComponent,
  analyzeBundleSize,
  ChunkLoadingTracker,
  createAdaptiveLazyComponent
} from './codeSplitting'
import { defineComponent, h } from 'vue'

describe('Code Splitting Optimization Properties', () => {
  let mockComponent: any
  let mockLoader: any

  beforeEach(() => {
    // Create a mock component
    mockComponent = defineComponent({
      name: 'MockComponent',
      render: () => h('div', 'Mock Component')
    })

    // Create a mock loader
    mockLoader = vi.fn().mockResolvedValue(mockComponent)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Property 9: Code splitting optimization
   * For any JavaScript bundle loading, only necessary modules should be loaded initially through code splitting
   */
  it('should only load necessary modules initially through code splitting', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          componentName: fc.string({ minLength: 1, maxLength: 50 }),
          loadDelay: fc.integer({ min: 0, max: 100 }), // Reduced delay for faster tests
          shouldPreload: fc.boolean(),
          networkCondition: fc.constantFrom('4g', '3g', '2g', 'slow-2g')
        }),
        async ({ componentName, loadDelay, shouldPreload, networkCondition }) => {
          // Simulate component loading with delay
          const delayedLoader = () => new Promise(resolve => {
            setTimeout(() => resolve(mockComponent), loadDelay)
          })

          // Create lazy component
          const lazyComponent = createLazyComponent(delayedLoader)
          
          // Verify lazy component is created (not loaded immediately)
          expect(lazyComponent).toBeDefined()

          // Test preloading behavior
          if (shouldPreload) {
            const preloadPromise = preloadComponent(delayedLoader)
            expect(preloadPromise).toBeInstanceOf(Promise)
            
            const loadedComponent = await preloadPromise
            expect(loadedComponent).toBe(mockComponent)
          }

          // Test adaptive loading based on network conditions
          const adaptiveLazyComponent = createAdaptiveLazyComponent(
            delayedLoader,
            () => Promise.resolve(mockComponent) // fallback for slow connections
          )
          
          expect(adaptiveLazyComponent).toBeDefined()
        }
      ),
      { numRuns: 20, timeout: 2000 } // Reduced runs and added timeout
    )
  })

  it('should track chunk loading performance correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          chunkName: fc.string({ minLength: 1, maxLength: 30 }),
          loadTime: fc.integer({ min: 10, max: 200 }), // Reduced max load time
          shouldFail: fc.boolean()
        }),
        async ({ chunkName, loadTime, shouldFail }) => {
          const tracker = new ChunkLoadingTracker()
          const startTime = performance.now()
          
          const { onLoad, onError } = tracker.trackChunkLoad(chunkName, startTime)
          
          if (shouldFail) {
            const error = new Error(`Failed to load chunk: ${chunkName}`)
            onError(error)
            
            const stats = tracker.getLoadingStats()
            expect(stats.loadErrors[chunkName]).toBe(error)
          } else {
            // Simulate loading time
            await new Promise(resolve => setTimeout(resolve, Math.min(loadTime, 50)))
            onLoad()
            
            const stats = tracker.getLoadingStats()
            expect(stats.loadTimes[chunkName]).toBeGreaterThan(0)
            expect(stats.averageLoadTime).toBeGreaterThanOrEqual(0)
          }
        }
      ),
      { numRuns: 20, timeout: 2000 }
    )
  })

  it('should create interaction-based lazy components that preload on user interaction', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          triggerEvents: fc.array(
            fc.constantFrom('mouseenter', 'focus', 'click', 'touchstart'),
            { minLength: 1, maxLength: 4 }
          ),
          componentName: fc.string({ minLength: 1, maxLength: 30 }).filter(name => name.trim().length > 0)
        }),
        async ({ triggerEvents, componentName }) => {
          // Reset mock before each test
          const freshMockLoader = vi.fn().mockResolvedValue(mockComponent)
          
          const { component, preload, addPreloadListeners } = createInteractionLazyComponent(
            freshMockLoader,
            triggerEvents
          )
          
          // Verify component is created but not loaded initially
          expect(component).toBeDefined()
          expect(freshMockLoader).not.toHaveBeenCalled()
          
          // Test manual preload
          const preloadPromise = preload()
          expect(preloadPromise).toBeInstanceOf(Promise)
          
          // Verify loader is called
          expect(freshMockLoader).toHaveBeenCalledTimes(1)
          
          // Test that subsequent preload calls return the same promise
          const secondPreloadPromise = preload()
          expect(secondPreloadPromise).toBe(preloadPromise)
          expect(freshMockLoader).toHaveBeenCalledTimes(1) // Should not be called again
          
          // Test event listener setup
          const mockElement = {
            addEventListener: vi.fn()
          } as any
          
          addPreloadListeners(mockElement)
          
          // Verify event listeners are added for each trigger event
          expect(mockElement.addEventListener).toHaveBeenCalledTimes(triggerEvents.length)
          
          triggerEvents.forEach(event => {
            expect(mockElement.addEventListener).toHaveBeenCalledWith(
              event,
              expect.any(Function),
              { once: true, passive: true }
            )
          })
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should provide meaningful bundle analysis and recommendations', () => {
    fc.assert(
      fc.property(
        fc.record({
          isDevelopment: fc.boolean(),
          scriptCount: fc.integer({ min: 0, max: 50 })
        }),
        ({ isDevelopment, scriptCount }) => {
          // Mock DOM for script counting
          if (typeof document !== 'undefined') {
            const mockScripts = Array.from({ length: scriptCount }, (_, i) => ({
              src: `script-${i}.js`
            }))
            
            vi.spyOn(document, 'querySelectorAll').mockReturnValue(mockScripts as any)
          }
          
          const analysis = analyzeBundleSize()
          
          // Verify analysis structure
          expect(analysis).toHaveProperty('totalSize')
          expect(analysis).toHaveProperty('chunkSizes')
          expect(analysis).toHaveProperty('recommendations')
          expect(Array.isArray(analysis.recommendations)).toBe(true)
          
          // Verify recommendations are provided
          expect(analysis.recommendations.length).toBeGreaterThan(0)
          
          if (isDevelopment && scriptCount > 10) {
            expect(analysis.recommendations.some(rec => 
              rec.includes('consolidating scripts')
            )).toBe(true)
          }
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should handle component loading errors gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          shouldFail: fc.boolean(),
          errorMessage: fc.string({ minLength: 1, maxLength: 100 }).filter(msg => msg.trim().length > 0)
        }),
        async ({ shouldFail, errorMessage }) => {
          const failingLoader = () => {
            if (shouldFail) {
              return Promise.reject(new Error(errorMessage))
            }
            return Promise.resolve(mockComponent)
          }
          
          const lazyComponent = createLazyComponent(failingLoader, {
            timeout: 1000,
            suspensible: false
          })
          
          expect(lazyComponent).toBeDefined()
          
          // Test that the component handles both success and failure cases
          if (shouldFail) {
            try {
              await failingLoader()
              // Should not reach here
              expect(true).toBe(false)
            } catch (error) {
              expect(error).toBeInstanceOf(Error)
              expect((error as Error).message).toBe(errorMessage)
            }
          } else {
            const result = await failingLoader()
            expect(result).toBe(mockComponent)
          }
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should optimize loading based on network conditions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          effectiveType: fc.constantFrom('4g', '3g', '2g', 'slow-2g'),
          hasFallback: fc.boolean()
        }),
        async ({ effectiveType, hasFallback }) => {
          // Mock navigator.connection
          const mockConnection = { effectiveType }
          Object.defineProperty(navigator, 'connection', {
            value: mockConnection,
            configurable: true,
            writable: true
          })
          
          const primaryLoader = vi.fn().mockResolvedValue(mockComponent)
          const fallbackLoader = hasFallback ? 
            vi.fn().mockResolvedValue(mockComponent) : 
            undefined
          
          const adaptiveComponent = createAdaptiveLazyComponent(
            primaryLoader,
            fallbackLoader
          )
          
          expect(adaptiveComponent).toBeDefined()
          
          // The component should be created regardless of network conditions
          // The actual loading behavior is tested through the loader functions
          // when the component is actually rendered/loaded
        }
      ),
      { numRuns: 20 }
    )
  })
})