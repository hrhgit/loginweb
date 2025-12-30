/**
 * Code splitting utilities for optimizing bundle size and loading performance
 */

import { defineAsyncComponent, type AsyncComponentLoader, type Component } from 'vue'

/**
 * Enhanced async component loader with loading and error states
 */
export function createLazyComponent<T extends Component>(
  loader: AsyncComponentLoader<T>,
  options?: {
    loadingComponent?: Component
    errorComponent?: Component
    delay?: number
    timeout?: number
    suspensible?: boolean
  }
) {
  return defineAsyncComponent({
    loader,
    loadingComponent: options?.loadingComponent,
    errorComponent: options?.errorComponent,
    delay: options?.delay ?? 200,
    timeout: options?.timeout ?? 3000,
    suspensible: options?.suspensible ?? false
  })
}

/**
 * Preload a component for better user experience
 */
export function preloadComponent(loader: AsyncComponentLoader<any>): Promise<any> {
  return loader()
}

/**
 * Lazy load components based on user interaction
 */
export function createInteractionLazyComponent<T extends Component>(
  loader: AsyncComponentLoader<T>,
  triggerEvents: string[] = ['mouseenter', 'focus']
) {
  let componentPromise: Promise<any> | null = null
  
  const preload = () => {
    if (!componentPromise) {
      componentPromise = loader()
    }
    return componentPromise
  }

  // Create event listeners for preloading
  const addPreloadListeners = (element: HTMLElement) => {
    triggerEvents.forEach(event => {
      element.addEventListener(event, preload, { once: true, passive: true })
    })
  }

  return {
    component: createLazyComponent(loader),
    preload,
    addPreloadListeners
  }
}

/**
 * Bundle size analyzer - helps identify optimization opportunities
 */
export interface BundleAnalysis {
  totalSize: number
  chunkSizes: Record<string, number>
  recommendations: string[]
}

/**
 * Get bundle analysis information (development only)
 */
export function analyzeBundleSize(): BundleAnalysis {
  if (import.meta.env.PROD) {
    return {
      totalSize: 0,
      chunkSizes: {},
      recommendations: ['Bundle analysis only available in development mode']
    }
  }

  // In development, provide basic analysis
  const recommendations: string[] = []
  
  // Check for common optimization opportunities
  if (typeof window !== 'undefined') {
    const scripts = document.querySelectorAll('script[src]')
    const totalScripts = scripts.length
    
    if (totalScripts > 10) {
      recommendations.push('Consider consolidating scripts to reduce HTTP requests')
    }
    
    recommendations.push('Use dynamic imports for route-based code splitting')
    recommendations.push('Lazy load heavy components with defineAsyncComponent')
    recommendations.push('Configure Vite manual chunks for vendor libraries')
  }

  return {
    totalSize: 0,
    chunkSizes: {},
    recommendations
  }
}

/**
 * Performance-aware component loader that adapts to network conditions
 */
export function createAdaptiveLazyComponent<T extends Component>(
  loader: AsyncComponentLoader<T>,
  fallbackLoader?: AsyncComponentLoader<T>
) {
  const getEffectiveConnection = () => {
    // @ts-ignore - navigator.connection is experimental
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    return connection?.effectiveType || '4g'
  }

  const shouldUseFallback = () => {
    const effectiveType = getEffectiveConnection()
    return fallbackLoader && (effectiveType === 'slow-2g' || effectiveType === '2g')
  }

  return createLazyComponent(() => {
    return shouldUseFallback() && fallbackLoader ? fallbackLoader() : loader()
  })
}

/**
 * Chunk loading performance tracker
 */
export class ChunkLoadingTracker {
  private loadTimes: Map<string, number> = new Map()
  private loadErrors: Map<string, Error> = new Map()

  trackChunkLoad(chunkName: string, startTime: number = performance.now()) {
    return {
      onLoad: () => {
        const loadTime = performance.now() - startTime
        this.loadTimes.set(chunkName, loadTime)
        
        // Log slow loading chunks
        if (loadTime > 3000) {
          console.warn(`Slow chunk loading detected: ${chunkName} took ${loadTime}ms`)
        }
      },
      onError: (error: Error) => {
        this.loadErrors.set(chunkName, error)
        console.error(`Chunk loading failed: ${chunkName}`, error)
      }
    }
  }

  getLoadingStats() {
    return {
      loadTimes: Object.fromEntries(this.loadTimes),
      loadErrors: Object.fromEntries(this.loadErrors),
      averageLoadTime: Array.from(this.loadTimes.values()).reduce((a, b) => a + b, 0) / this.loadTimes.size || 0
    }
  }
}

// Global chunk loading tracker instance
export const chunkTracker = new ChunkLoadingTracker()