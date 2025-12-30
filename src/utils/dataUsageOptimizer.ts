/**
 * Data Usage Optimizer - Manages data saving preferences and optimization
 * 
 * Provides user preference system for data saving mode, bandwidth-aware
 * content delivery, and data compression for large payloads.
 */

import { ref, computed, type Ref } from 'vue'
import { networkManager, type NetworkState } from './networkManager'
import { cacheManager } from './cacheManager'
import { dataCompressionManager } from './dataCompressionUtils'

export interface DataUsagePreferences {
  dataSavingMode: boolean
  imageQuality: 'low' | 'medium' | 'high' | 'auto'
  videoAutoplay: boolean
  preloadContent: boolean
  compressionEnabled: boolean
  maxImageSize: number // KB
  maxVideoSize: number // MB
}

export interface DataUsageStats {
  totalDataUsed: number // bytes
  dataSaved: number // bytes
  compressionRatio: number // percentage
  cacheHitRate: number // percentage
}

export interface BandwidthAwareConfig {
  lowBandwidthThreshold: number // Mbps
  mediumBandwidthThreshold: number // Mbps
  adaptiveQuality: boolean
  fallbackToCache: boolean
}

export interface CompressionOptions {
  enabled: boolean
  algorithm: 'gzip' | 'deflate' | 'br'
  level: number // 1-9
  minSize: number // bytes - minimum size to compress
}

/**
 * Data Usage Optimizer - Main class for managing data usage preferences
 */
export class DataUsageOptimizer {
  private preferences: Ref<DataUsagePreferences>
  private stats: Ref<DataUsageStats>
  private bandwidthConfig: BandwidthAwareConfig
  private compressionConfig: CompressionOptions

  constructor() {
    this.preferences = ref<DataUsagePreferences>({
      dataSavingMode: false,
      imageQuality: 'auto',
      videoAutoplay: true,
      preloadContent: true,
      compressionEnabled: true,
      maxImageSize: 500, // 500KB
      maxVideoSize: 10 // 10MB
    })

    this.stats = ref<DataUsageStats>({
      totalDataUsed: 0,
      dataSaved: 0,
      compressionRatio: 0,
      cacheHitRate: 0
    })

    this.bandwidthConfig = {
      lowBandwidthThreshold: 1.0, // 1 Mbps
      mediumBandwidthThreshold: 5.0, // 5 Mbps
      adaptiveQuality: true,
      fallbackToCache: true
    }

    this.compressionConfig = {
      enabled: true,
      algorithm: 'gzip',
      level: 6,
      minSize: 1024 // 1KB
    }

    this.loadPreferences()
    this.setupNetworkListener()
  }

  // Getters
  get currentPreferences(): DataUsagePreferences {
    return this.preferences.value
  }

  get currentStats(): DataUsageStats {
    return this.stats.value
  }

  get isDataSavingMode(): boolean {
    return this.preferences.value.dataSavingMode
  }

  get effectiveImageQuality(): 'low' | 'medium' | 'high' {
    if (this.preferences.value.imageQuality === 'auto') {
      return this.getAutoQualityLevel()
    }
    return this.preferences.value.imageQuality as 'low' | 'medium' | 'high'
  }

  // Preference Management
  updatePreferences(updates: Partial<DataUsagePreferences>): void {
    this.preferences.value = {
      ...this.preferences.value,
      ...updates
    }
    this.savePreferences()
  }

  enableDataSavingMode(): void {
    this.updatePreferences({
      dataSavingMode: true,
      imageQuality: 'low',
      videoAutoplay: false,
      preloadContent: false,
      compressionEnabled: true,
      maxImageSize: 200, // Reduced to 200KB
      maxVideoSize: 5 // Reduced to 5MB
    })
  }

  disableDataSavingMode(): void {
    this.updatePreferences({
      dataSavingMode: false,
      imageQuality: 'auto',
      videoAutoplay: true,
      preloadContent: true,
      compressionEnabled: true,
      maxImageSize: 500, // Back to 500KB
      maxVideoSize: 10 // Back to 10MB
    })
  }

  resetToDefaults(): void {
    this.preferences.value = {
      dataSavingMode: false,
      imageQuality: 'auto',
      videoAutoplay: true,
      preloadContent: true,
      compressionEnabled: true,
      maxImageSize: 500,
      maxVideoSize: 10
    }
    this.savePreferences()
  }

  // Bandwidth-Aware Content Delivery
  shouldLoadHighQualityContent(): boolean {
    if (this.preferences.value.dataSavingMode) {
      return false
    }

    const networkState = networkManager.networkState
    const bandwidth = networkState.downlink

    if (bandwidth >= this.bandwidthConfig.mediumBandwidthThreshold) {
      return true
    }

    return false
  }

  getOptimalImageSize(originalSize: number): number {
    const maxSize = this.preferences.value.maxImageSize * 1024 // Convert KB to bytes
    
    if (this.preferences.value.dataSavingMode) {
      // In data saving mode, apply significant reduction to original size
      const reducedSize = originalSize * 0.5 // 50% reduction
      return Math.min(reducedSize, maxSize * 0.5) // Also respect reduced max size
    }

    const networkState = networkManager.networkState
    const bandwidth = networkState.downlink

    if (bandwidth < this.bandwidthConfig.lowBandwidthThreshold) {
      return Math.min(originalSize, maxSize * 0.3) // 70% reduction for low bandwidth
    } else if (bandwidth < this.bandwidthConfig.mediumBandwidthThreshold) {
      return Math.min(originalSize, maxSize * 0.7) // 30% reduction for medium bandwidth
    }

    return Math.min(originalSize, maxSize) // Full size for high bandwidth
  }

  shouldPreloadContent(): boolean {
    if (this.preferences.value.dataSavingMode) {
      return false
    }

    if (!this.preferences.value.preloadContent) {
      return false
    }

    const networkState = networkManager.networkState
    return networkState.downlink >= this.bandwidthConfig.lowBandwidthThreshold
  }

  shouldAutoplayVideo(): boolean {
    if (this.preferences.value.dataSavingMode) {
      return false
    }

    if (!this.preferences.value.videoAutoplay) {
      return false
    }

    const networkState = networkManager.networkState
    return networkState.downlink >= this.bandwidthConfig.mediumBandwidthThreshold
  }

  // Data Compression
  async compressData(data: string | ArrayBuffer): Promise<string | ArrayBuffer> {
    if (!this.compressionConfig.enabled || !this.preferences.value.compressionEnabled) {
      return data
    }

    const dataSize = typeof data === 'string' ? 
      new Blob([data]).size : 
      data.byteLength

    if (dataSize < this.compressionConfig.minSize) {
      return data
    }

    try {
      const result = await dataCompressionManager.compress(data, {
        algorithm: this.compressionConfig.algorithm,
        level: this.compressionConfig.level,
        minSize: this.compressionConfig.minSize
      })
      
      this.updateCompressionStats(result.originalSize, result.compressedSize, result.compressionRatio)
      
      return result.compressed
    } catch (error) {
      console.warn('Compression failed, returning original data:', error)
      return data
    }
  }

  async decompressData(compressedData: string | ArrayBuffer): Promise<string | ArrayBuffer> {
    if (!this.compressionConfig.enabled) {
      return compressedData
    }

    try {
      const result = await dataCompressionManager.decompress(
        compressedData instanceof ArrayBuffer ? compressedData : new TextEncoder().encode(compressedData as string).buffer,
        this.compressionConfig.algorithm
      )
      return result
    } catch (error) {
      console.warn('Decompression failed, returning original data:', error)
      return compressedData
    }
  }

  // Statistics and Monitoring
  recordDataUsage(bytes: number, fromCache: boolean = false): void {
    this.stats.value.totalDataUsed += bytes
    
    if (fromCache) {
      this.stats.value.dataSaved += bytes
    }

    this.updateCacheHitRate()
  }

  getDataUsageReport(): string {
    const stats = this.stats.value
    const preferences = this.preferences.value
    
    return [
      '=== Data Usage Report ===',
      `Data Saving Mode: ${preferences.dataSavingMode ? 'Enabled' : 'Disabled'}`,
      `Image Quality: ${preferences.imageQuality}`,
      `Video Autoplay: ${preferences.videoAutoplay ? 'Enabled' : 'Disabled'}`,
      `Preload Content: ${preferences.preloadContent ? 'Enabled' : 'Disabled'}`,
      `Compression: ${preferences.compressionEnabled ? 'Enabled' : 'Disabled'}`,
      '',
      `Total Data Used: ${this.formatBytes(stats.totalDataUsed)}`,
      `Data Saved: ${this.formatBytes(stats.dataSaved)}`,
      `Compression Ratio: ${stats.compressionRatio.toFixed(1)}%`,
      `Cache Hit Rate: ${stats.cacheHitRate.toFixed(1)}%`
    ].join('\n')
  }

  resetStats(): void {
    this.stats.value = {
      totalDataUsed: 0,
      dataSaved: 0,
      compressionRatio: 0,
      cacheHitRate: 0
    }
  }

  // Private Methods
  private getAutoQualityLevel(): 'low' | 'medium' | 'high' {
    const networkState = networkManager.networkState
    const bandwidth = networkState.downlink

    if (networkState.saveData || bandwidth < this.bandwidthConfig.lowBandwidthThreshold) {
      return 'low'
    } else if (bandwidth < this.bandwidthConfig.mediumBandwidthThreshold) {
      return 'medium'
    }

    return 'high'
  }

  private setupNetworkListener(): void {
    networkManager.addNetworkStateListener((state: NetworkState) => {
      // Auto-adjust preferences based on network conditions
      if (this.bandwidthConfig.adaptiveQuality && this.preferences.value.imageQuality === 'auto') {
        // Trigger reactive updates by accessing computed properties
        this.effectiveImageQuality
      }
    })
  }

  private loadPreferences(): void {
    try {
      const stored = localStorage.getItem('dataUsagePreferences')
      if (stored) {
        const parsed = JSON.parse(stored)
        this.preferences.value = {
          ...this.preferences.value,
          ...parsed
        }
      }
    } catch (error) {
      console.warn('Failed to load data usage preferences:', error)
    }
  }

  private savePreferences(): void {
    try {
      localStorage.setItem('dataUsagePreferences', JSON.stringify(this.preferences.value))
    } catch (error) {
      console.warn('Failed to save data usage preferences:', error)
    }
  }

  private updateCompressionStats(originalSize: number, compressedSize: number, ratio: number): void {
    const dataSaved = originalSize - compressedSize
    this.stats.value.dataSaved += dataSaved
    
    // Update running average of compression ratio
    const currentRatio = this.stats.value.compressionRatio
    this.stats.value.compressionRatio = (currentRatio + ratio) / 2
  }

  private updateCacheHitRate(): void {
    const cacheStats = cacheManager.getStats()
    const total = cacheStats.hits + cacheStats.misses
    
    if (total > 0) {
      this.stats.value.cacheHitRate = (cacheStats.hits / total) * 100
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

// Create singleton instance
export const dataUsageOptimizer = new DataUsageOptimizer()

// Convenience functions
export function enableDataSavingMode(): void {
  dataUsageOptimizer.enableDataSavingMode()
}

export function disableDataSavingMode(): void {
  dataUsageOptimizer.disableDataSavingMode()
}

export function updateDataUsagePreferences(preferences: Partial<DataUsagePreferences>): void {
  dataUsageOptimizer.updatePreferences(preferences)
}

export function getDataUsagePreferences(): DataUsagePreferences {
  return dataUsageOptimizer.currentPreferences
}

export function getDataUsageStats(): DataUsageStats {
  return dataUsageOptimizer.currentStats
}

export function shouldLoadHighQualityContent(): boolean {
  return dataUsageOptimizer.shouldLoadHighQualityContent()
}

export function getOptimalImageSize(originalSize: number): number {
  return dataUsageOptimizer.getOptimalImageSize(originalSize)
}

export function shouldPreloadContent(): boolean {
  return dataUsageOptimizer.shouldPreloadContent()
}

export function shouldAutoplayVideo(): boolean {
  return dataUsageOptimizer.shouldAutoplayVideo()
}

export function recordDataUsage(bytes: number, fromCache: boolean = false): void {
  dataUsageOptimizer.recordDataUsage(bytes, fromCache)
}