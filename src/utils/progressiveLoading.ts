/**
 * Progressive Loading Utilities
 * 
 * Provides utilities for progressive loading, image optimization, and performance enhancements
 */

export interface ImageOptimizationOptions {
  width?: number
  height?: number
  quality?: number
  format?: 'webp' | 'jpeg' | 'png' | 'auto'
  sizes?: string
  loading?: 'lazy' | 'eager'
}

export interface VirtualScrollOptions {
  itemHeight: number
  containerHeight: number
  overscan?: number
  threshold?: number
}

export interface ProgressiveLoadingConfig {
  enableLazyLoading: boolean
  enableVirtualScrolling: boolean
  enableImageOptimization: boolean
  enablePlaceholders: boolean
  placeholderColor?: string
  loadingThreshold?: number
}

/**
 * Generate responsive image srcset based on base URL and sizes
 */
export function generateResponsiveSrcset(baseUrl: string, sizes: number[] = [320, 640, 768, 1024, 1280, 1920]): string {
  if (!baseUrl) return ''
  
  const baseSrc = baseUrl.replace(/\.(jpg|jpeg|png|webp)$/i, '')
  const ext = baseUrl.match(/\.(jpg|jpeg|png|webp)$/i)?.[0] || '.jpg'
  
  return sizes
    .map(size => `${baseSrc}_${size}w${ext} ${size}w`)
    .join(', ')
}

/**
 * Generate WebP srcset for modern browsers
 */
export function generateWebPSrcset(baseUrl: string, sizes: number[] = [320, 640, 768, 1024, 1280, 1920]): string {
  if (!baseUrl) return ''
  
  const baseSrc = baseUrl.replace(/\.(jpg|jpeg|png|webp)$/i, '')
  
  return sizes
    .map(size => `${baseSrc}_${size}w.webp ${size}w`)
    .join(', ')
}

/**
 * Calculate optimal image width based on viewport and device pixel ratio
 */
export function calculateOptimalImageWidth(
  viewportWidth: number, 
  devicePixelRatio: number = 1,
  maxWidth?: number
): number {
  let baseWidth = maxWidth || viewportWidth
  
  // Apply viewport-based sizing
  if (viewportWidth <= 640) {
    baseWidth = Math.min(baseWidth, viewportWidth)
  } else if (viewportWidth <= 1024) {
    baseWidth = Math.min(baseWidth, viewportWidth * 0.5)
  } else {
    baseWidth = Math.min(baseWidth, viewportWidth * 0.33)
  }
  
  // Apply device pixel ratio
  const targetWidth = Math.ceil(baseWidth * devicePixelRatio)
  
  // Round to nearest standard size
  const standardSizes = [320, 640, 768, 1024, 1280, 1920]
  return standardSizes.find(size => size >= targetWidth) || standardSizes[standardSizes.length - 1]
}

/**
 * Generate default responsive sizes attribute
 */
export function generateDefaultSizes(): string {
  return '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
}

/**
 * Create a placeholder image data URL
 */
export function createPlaceholderImage(width: number, height: number, color: string = '#f0f0f0'): string {
  return `data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"%3E%3Crect fill="${encodeURIComponent(color)}" width="${width}" height="${height}"/%3E%3C/svg%3E`
}

/**
 * Calculate virtual scroll parameters
 */
export function calculateVirtualScrollParams(
  scrollTop: number,
  itemHeight: number,
  containerHeight: number,
  totalItems: number,
  overscan: number = 5
) {
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const visibleCount = Math.ceil(containerHeight / itemHeight)
  const endIndex = Math.min(totalItems - 1, startIndex + visibleCount + overscan * 2)
  
  return {
    startIndex,
    endIndex,
    offsetY: startIndex * itemHeight,
    visibleCount: endIndex - startIndex + 1
  }
}

/**
 * Debounce function for scroll events
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    
    timeout = setTimeout(() => {
      func(...args)
    }, wait)
  }
}

/**
 * Check if an element is in viewport
 */
export function isInViewport(element: Element, threshold: number = 0): boolean {
  const rect = element.getBoundingClientRect()
  const windowHeight = window.innerHeight || document.documentElement.clientHeight
  const windowWidth = window.innerWidth || document.documentElement.clientWidth
  
  return (
    rect.top >= -threshold &&
    rect.left >= -threshold &&
    rect.bottom <= windowHeight + threshold &&
    rect.right <= windowWidth + threshold
  )
}

/**
 * Progressive loading configuration
 */
export const defaultProgressiveLoadingConfig: ProgressiveLoadingConfig = {
  enableLazyLoading: true,
  enableVirtualScrolling: true,
  enableImageOptimization: true,
  enablePlaceholders: true,
  placeholderColor: '#f0f0f0',
  loadingThreshold: 50
}

/**
 * Performance metrics for progressive loading
 */
export interface ProgressiveLoadingMetrics {
  imagesLoaded: number
  imagesTotal: number
  averageLoadTime: number
  cacheHitRate: number
  virtualScrollActive: boolean
  renderedItems: number
  totalItems: number
}

/**
 * Progressive loading performance tracker
 */
export class ProgressiveLoadingTracker {
  private metrics: ProgressiveLoadingMetrics = {
    imagesLoaded: 0,
    imagesTotal: 0,
    averageLoadTime: 0,
    cacheHitRate: 0,
    virtualScrollActive: false,
    renderedItems: 0,
    totalItems: 0
  }
  
  private loadTimes: number[] = []
  private cacheHits = 0
  private cacheMisses = 0
  
  recordImageLoad(loadTime: number, fromCache: boolean = false): void {
    this.metrics.imagesLoaded++
    this.loadTimes.push(loadTime)
    this.metrics.averageLoadTime = this.loadTimes.reduce((a, b) => a + b, 0) / this.loadTimes.length
    
    if (fromCache) {
      this.cacheHits++
    } else {
      this.cacheMisses++
    }
    
    const total = this.cacheHits + this.cacheMisses
    this.metrics.cacheHitRate = total > 0 ? (this.cacheHits / total) * 100 : 0
  }
  
  setImageTotal(total: number): void {
    this.metrics.imagesTotal = total
  }
  
  setVirtualScrollMetrics(rendered: number, total: number): void {
    this.metrics.virtualScrollActive = total > rendered
    this.metrics.renderedItems = rendered
    this.metrics.totalItems = total
  }
  
  getMetrics(): ProgressiveLoadingMetrics {
    return { ...this.metrics }
  }
  
  reset(): void {
    this.metrics = {
      imagesLoaded: 0,
      imagesTotal: 0,
      averageLoadTime: 0,
      cacheHitRate: 0,
      virtualScrollActive: false,
      renderedItems: 0,
      totalItems: 0
    }
    this.loadTimes = []
    this.cacheHits = 0
    this.cacheMisses = 0
  }
}

// Global tracker instance
export const progressiveLoadingTracker = new ProgressiveLoadingTracker()