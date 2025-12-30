/**
 * Bandwidth-Aware Content Delivery - Adapts content delivery based on network conditions
 * 
 * Provides intelligent content delivery that adapts to network bandwidth,
 * connection quality, and user preferences to optimize data usage.
 */

import { networkManager, type NetworkState } from './networkManager'
import { dataUsageOptimizer } from './dataUsageOptimizer'
import { cacheManager } from './cacheManager'

export interface ContentDeliveryOptions {
  quality: 'low' | 'medium' | 'high' | 'auto'
  format: 'webp' | 'jpeg' | 'png' | 'auto'
  maxSize: number // bytes
  enableProgressive: boolean
  fallbackToCache: boolean
}

export interface AdaptiveContent {
  url: string
  quality: 'low' | 'medium' | 'high'
  format: string
  size: number
  dimensions?: { width: number; height: number }
}

export interface BandwidthProfile {
  name: string
  minBandwidth: number // Mbps
  maxBandwidth: number // Mbps
  recommendedQuality: 'low' | 'medium' | 'high'
  maxImageSize: number // KB
  maxVideoSize: number // MB
  enablePreload: boolean
  enableAutoplay: boolean
}

/**
 * Bandwidth-Aware Content Delivery Manager
 */
export class BandwidthAwareDeliveryManager {
  private profiles: BandwidthProfile[] = [
    {
      name: 'slow',
      minBandwidth: 0,
      maxBandwidth: 1.0,
      recommendedQuality: 'low',
      maxImageSize: 100, // 100KB
      maxVideoSize: 2, // 2MB
      enablePreload: false,
      enableAutoplay: false
    },
    {
      name: 'medium',
      minBandwidth: 1.0,
      maxBandwidth: 5.0,
      recommendedQuality: 'medium',
      maxImageSize: 300, // 300KB
      maxVideoSize: 5, // 5MB
      enablePreload: true,
      enableAutoplay: false
    },
    {
      name: 'fast',
      minBandwidth: 5.0,
      maxBandwidth: Infinity,
      recommendedQuality: 'high',
      maxImageSize: 1000, // 1MB
      maxVideoSize: 20, // 20MB
      enablePreload: true,
      enableAutoplay: true
    }
  ]

  constructor() {
    this.setupNetworkListener()
  }

  /**
   * Get optimal content delivery options based on current network conditions
   */
  getOptimalDeliveryOptions(baseOptions?: Partial<ContentDeliveryOptions>): ContentDeliveryOptions {
    const networkState = networkManager.networkState
    const profile = this.getCurrentBandwidthProfile(networkState)
    const userPrefs = dataUsageOptimizer.currentPreferences

    // Start with profile recommendations
    let options: ContentDeliveryOptions = {
      quality: profile.recommendedQuality,
      format: 'auto',
      maxSize: profile.maxImageSize * 1024, // Convert KB to bytes
      enableProgressive: true,
      fallbackToCache: true,
      ...baseOptions
    }

    // Apply user preferences override
    if (userPrefs.dataSavingMode) {
      options = {
        ...options,
        quality: 'low',
        maxSize: Math.min(options.maxSize, userPrefs.maxImageSize * 1024 * 0.5), // 50% reduction
        enableProgressive: false
      }
    }

    // Apply image quality preference
    if (userPrefs.imageQuality !== 'auto') {
      options.quality = userPrefs.imageQuality
    }

    return options
  }

  /**
   * Adapt image URL based on network conditions and preferences
   */
  adaptImageUrl(
    baseUrl: string,
    options?: Partial<ContentDeliveryOptions>
  ): AdaptiveContent {
    const deliveryOptions = this.getOptimalDeliveryOptions(options)
    const networkState = networkManager.networkState

    // Determine optimal format
    const format = this.getOptimalImageFormat(deliveryOptions.format, networkState)
    
    // Determine optimal quality and dimensions
    const quality = deliveryOptions.quality
    const dimensions = this.getOptimalDimensions(quality, deliveryOptions.maxSize)

    // Build adaptive URL (this would integrate with your CDN/image service)
    const adaptiveUrl = this.buildAdaptiveImageUrl(baseUrl, {
      quality,
      format,
      dimensions,
      maxSize: deliveryOptions.maxSize
    })

    return {
      url: adaptiveUrl,
      quality,
      format,
      size: this.estimateImageSize(dimensions, quality, format),
      dimensions
    }
  }

  /**
   * Check if content should be preloaded based on network conditions
   */
  shouldPreloadContent(contentType: 'image' | 'video' | 'data', size: number): boolean {
    const networkState = networkManager.networkState
    const profile = this.getCurrentBandwidthProfile(networkState)
    const userPrefs = dataUsageOptimizer.currentPreferences

    // User preference override
    if (userPrefs.dataSavingMode || !userPrefs.preloadContent) {
      return false
    }

    // Network-based decision
    if (!profile.enablePreload) {
      return false
    }

    // Size-based decision
    const maxSizes = {
      image: profile.maxImageSize * 1024, // KB to bytes
      video: profile.maxVideoSize * 1024 * 1024, // MB to bytes
      data: 1024 * 1024 // 1MB for data
    }

    return size <= maxSizes[contentType]
  }

  /**
   * Check if video should autoplay based on network conditions
   */
  shouldAutoplayVideo(videoSize: number): boolean {
    const networkState = networkManager.networkState
    const profile = this.getCurrentBandwidthProfile(networkState)
    const userPrefs = dataUsageOptimizer.currentPreferences

    // User preference override
    if (userPrefs.dataSavingMode || !userPrefs.videoAutoplay) {
      return false
    }

    // Network-based decision
    if (!profile.enableAutoplay) {
      return false
    }

    // Size-based decision
    const maxVideoSize = profile.maxVideoSize * 1024 * 1024 // MB to bytes
    return videoSize <= maxVideoSize
  }

  /**
   * Get progressive loading strategy for large content
   */
  getProgressiveLoadingStrategy(contentSize: number): {
    useProgressive: boolean
    chunkSize: number
    initialChunks: number
  } {
    const networkState = networkManager.networkState
    const profile = this.getCurrentBandwidthProfile(networkState)

    // Determine if progressive loading should be used
    const useProgressive = contentSize > 1024 * 1024 && // > 1MB
                          profile.name !== 'fast' &&
                          !dataUsageOptimizer.currentPreferences.dataSavingMode

    if (!useProgressive) {
      return {
        useProgressive: false,
        chunkSize: contentSize,
        initialChunks: 1
      }
    }

    // Calculate optimal chunk size based on bandwidth
    const bandwidth = networkState.downlink || 1.0
    const chunkSize = Math.max(
      64 * 1024, // Minimum 64KB
      Math.min(
        512 * 1024, // Maximum 512KB
        Math.floor(bandwidth * 100 * 1024) // ~100KB per Mbps
      )
    )

    const initialChunks = profile.name === 'slow' ? 1 : 2

    return {
      useProgressive: true,
      chunkSize,
      initialChunks
    }
  }

  /**
   * Optimize API request based on network conditions
   */
  async optimizeApiRequest<T>(
    url: string,
    options: {
      method?: string
      data?: any
      priority?: 'high' | 'medium' | 'low'
      useCompression?: boolean
      useCache?: boolean
    } = {}
  ): Promise<T> {
    const networkState = networkManager.networkState
    const profile = this.getCurrentBandwidthProfile(networkState)
    
    // Determine if we should use cache first for slow connections
    if (profile.name === 'slow' && options.useCache !== false) {
      const cached = await cacheManager.get<T>(`api:${url}`)
      if (cached) {
        return cached
      }
    }

    // Optimize request based on network conditions
    const optimizedOptions = {
      ...options,
      priority: profile.name === 'slow' ? 'high' : (options.priority || 'medium'),
      maxRetries: profile.name === 'slow' ? 5 : 3
    }

    // Execute request through network manager
    const result = await networkManager.executeRequest<T>({
      url,
      method: optimizedOptions.method || 'GET',
      data: optimizedOptions.data,
      priority: optimizedOptions.priority,
      maxRetries: optimizedOptions.maxRetries
    })

    // Cache result for future use
    if (options.useCache !== false) {
      const ttl = profile.name === 'slow' ? 600000 : 300000 // 10min vs 5min
      await cacheManager.set(`api:${url}`, result, ttl)
    }

    return result
  }

  // Private Methods

  private getCurrentBandwidthProfile(networkState: NetworkState): BandwidthProfile {
    const bandwidth = networkState.downlink || 0

    for (const profile of this.profiles) {
      if (bandwidth >= profile.minBandwidth && bandwidth < profile.maxBandwidth) {
        return profile
      }
    }

    // Fallback to slow profile
    return this.profiles[0]
  }

  private getOptimalImageFormat(
    preferredFormat: ContentDeliveryOptions['format'],
    networkState: NetworkState
  ): string {
    if (preferredFormat !== 'auto') {
      return preferredFormat
    }

    // Use WebP for modern browsers and good connections
    const supportsWebP = this.supportsWebP()
    const bandwidth = networkState.downlink || 0

    if (supportsWebP && bandwidth > 1.0) {
      return 'webp'
    } else if (bandwidth > 2.0) {
      return 'jpeg'
    } else {
      return 'jpeg' // Most compatible and efficient for slow connections
    }
  }

  private getOptimalDimensions(
    quality: 'low' | 'medium' | 'high',
    maxSize: number
  ): { width: number; height: number } {
    // Base dimensions for different quality levels
    const baseDimensions = {
      low: { width: 480, height: 320 },
      medium: { width: 720, height: 480 },
      high: { width: 1080, height: 720 }
    }

    let dimensions = baseDimensions[quality]

    // Adjust dimensions based on max size constraint
    const estimatedSize = this.estimateImageSize(dimensions, quality, 'jpeg')
    if (estimatedSize > maxSize) {
      const scaleFactor = Math.sqrt(maxSize / estimatedSize)
      dimensions = {
        width: Math.floor(dimensions.width * scaleFactor),
        height: Math.floor(dimensions.height * scaleFactor)
      }
    }

    return dimensions
  }

  private buildAdaptiveImageUrl(
    baseUrl: string,
    options: {
      quality: string
      format: string
      dimensions: { width: number; height: number }
      maxSize: number
    }
  ): string {
    // This would integrate with your CDN or image processing service
    // For now, return a mock adaptive URL
    const params = new URLSearchParams({
      q: options.quality,
      f: options.format,
      w: options.dimensions.width.toString(),
      h: options.dimensions.height.toString(),
      s: options.maxSize.toString()
    })

    return `${baseUrl}?${params.toString()}`
  }

  private estimateImageSize(
    dimensions: { width: number; height: number },
    quality: 'low' | 'medium' | 'high',
    format: string
  ): number {
    const pixels = dimensions.width * dimensions.height
    
    // Bytes per pixel estimates for different formats and qualities
    const bytesPerPixel = {
      webp: { low: 0.3, medium: 0.5, high: 0.8 },
      jpeg: { low: 0.4, medium: 0.7, high: 1.2 },
      png: { low: 1.0, medium: 2.0, high: 3.0 }
    }

    const formatMultiplier = bytesPerPixel[format as keyof typeof bytesPerPixel] || bytesPerPixel.jpeg
    return Math.floor(pixels * formatMultiplier[quality])
  }

  private supportsWebP(): boolean {
    // Check if browser supports WebP
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0
  }

  private setupNetworkListener(): void {
    networkManager.addNetworkStateListener((state: NetworkState) => {
      // Could trigger adaptive content updates based on network changes
      console.log('Network state changed, current profile:', this.getCurrentBandwidthProfile(state).name)
    })
  }
}

// Create singleton instance
export const bandwidthAwareDelivery = new BandwidthAwareDeliveryManager()

// Convenience functions
export function getOptimalContentOptions(options?: Partial<ContentDeliveryOptions>): ContentDeliveryOptions {
  return bandwidthAwareDelivery.getOptimalDeliveryOptions(options)
}

export function adaptImageForNetwork(baseUrl: string, options?: Partial<ContentDeliveryOptions>): AdaptiveContent {
  return bandwidthAwareDelivery.adaptImageUrl(baseUrl, options)
}

export function shouldPreloadContent(contentType: 'image' | 'video' | 'data', size: number): boolean {
  return bandwidthAwareDelivery.shouldPreloadContent(contentType, size)
}

export function shouldAutoplayVideo(videoSize: number): boolean {
  return bandwidthAwareDelivery.shouldAutoplayVideo(videoSize)
}

export function getProgressiveLoadingStrategy(contentSize: number) {
  return bandwidthAwareDelivery.getProgressiveLoadingStrategy(contentSize)
}

export function optimizeApiRequest<T>(url: string, options?: any): Promise<T> {
  return bandwidthAwareDelivery.optimizeApiRequest<T>(url, options)
}