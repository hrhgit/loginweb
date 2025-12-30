/**
 * Data Usage Integration - Integrates all data usage optimization features
 * 
 * Provides a unified interface for data usage optimization, incremental updates,
 * compression, and bandwidth-aware delivery.
 */

import { dataUsageOptimizer } from './dataUsageOptimizer'
import { bandwidthAwareDelivery } from './bandwidthAwareDelivery'
import { createIncrementalManager, type IncrementalUpdatesManager } from './incrementalUpdates'
import { dataCompressionManager } from './dataCompressionUtils'
import { networkManager } from './networkManager'
import { cacheManager } from './cacheManager'

export interface OptimizedRequest {
  url: string
  method: string
  data?: any
  useCompression: boolean
  useIncremental: boolean
  cacheStrategy: 'cache-first' | 'network-first' | 'stale-while-revalidate'
  priority: 'high' | 'medium' | 'low'
}

export interface OptimizationResult {
  dataSaved: number
  compressionRatio: number
  cacheHit: boolean
  incrementalUpdate: boolean
  networkOptimized: boolean
}

/**
 * Unified Data Usage Optimization Manager
 */
export class DataUsageIntegrationManager {
  private incrementalManagers: Map<string, IncrementalUpdatesManager> = new Map()

  /**
   * Optimize a network request with all available optimizations
   */
  async optimizeRequest<T>(
    url: string,
    options: {
      method?: string
      data?: any
      useCompression?: boolean
      useIncremental?: boolean
      useCache?: boolean
      priority?: 'high' | 'medium' | 'low'
    } = {}
  ): Promise<{ data: T; optimization: OptimizationResult }> {
    const startTime = Date.now()
    let dataSaved = 0
    let compressionRatio = 0
    let cacheHit = false
    let incrementalUpdate = false
    let networkOptimized = false

    // 1. Check if we should use incremental updates
    if (options.useIncremental !== false) {
      const incrementalResult = await this.tryIncrementalUpdate<T>(url, options)
      if (incrementalResult) {
        incrementalUpdate = true
        return {
          data: incrementalResult,
          optimization: {
            dataSaved: 0, // Incremental updates save bandwidth inherently
            compressionRatio: 0,
            cacheHit: false,
            incrementalUpdate: true,
            networkOptimized: true
          }
        }
      }
    }

    // 2. Try cache first if enabled
    if (options.useCache !== false) {
      const cached = await cacheManager.get<T>(`optimized:${url}`)
      if (cached) {
        cacheHit = true
        dataUsageOptimizer.recordDataUsage(JSON.stringify(cached).length, true)
        return {
          data: cached,
          optimization: {
            dataSaved: 0, // Cache hits save all network data
            compressionRatio: 0,
            cacheHit: true,
            incrementalUpdate: false,
            networkOptimized: true
          }
        }
      }
    }

    // 3. Optimize request through bandwidth-aware delivery
    try {
      const optimizedOptions = {
        method: options.method || 'GET',
        data: options.data,
        priority: options.priority || 'medium',
        useCompression: options.useCompression !== false && dataUsageOptimizer.currentPreferences.compressionEnabled,
        useCache: options.useCache !== false
      }

      // Compress request data if applicable
      let requestData = optimizedOptions.data
      if (optimizedOptions.useCompression && requestData) {
        const originalSize = JSON.stringify(requestData).length
        const compressionResult = await dataCompressionManager.compress(JSON.stringify(requestData))
        
        if (compressionResult.compressionRatio > 0) {
          requestData = compressionResult.compressed
          compressionRatio = compressionResult.compressionRatio
          dataSaved += compressionResult.originalSize - compressionResult.compressedSize
        }
      }

      // Execute optimized request
      const result = await bandwidthAwareDelivery.optimizeApiRequest<T>(url, {
        ...optimizedOptions,
        data: requestData
      })

      networkOptimized = true

      // Cache the result
      if (options.useCache !== false) {
        const ttl = dataUsageOptimizer.currentPreferences.dataSavingMode ? 600000 : 300000
        await cacheManager.set(`optimized:${url}`, result, ttl)
      }

      // Record data usage
      const responseSize = JSON.stringify(result).length
      dataUsageOptimizer.recordDataUsage(responseSize, false)

      return {
        data: result,
        optimization: {
          dataSaved,
          compressionRatio,
          cacheHit: false,
          incrementalUpdate: false,
          networkOptimized: true
        }
      }

    } catch (error) {
      console.error('Optimized request failed:', error)
      throw error
    }
  }

  /**
   * Optimize image loading with bandwidth-aware delivery
   */
  optimizeImage(
    imageUrl: string,
    options: {
      quality?: 'low' | 'medium' | 'high' | 'auto'
      maxSize?: number
      enableProgressive?: boolean
    } = {}
  ) {
    return bandwidthAwareDelivery.adaptImageUrl(imageUrl, {
      quality: options.quality || 'auto',
      maxSize: options.maxSize || dataUsageOptimizer.currentPreferences.maxImageSize * 1024,
      enableProgressive: options.enableProgressive !== false,
      format: 'auto',
      fallbackToCache: true
    })
  }

  /**
   * Create or get incremental update manager for a data source
   */
  getIncrementalManager<T>(
    key: string,
    initialData: T,
    config?: any
  ): IncrementalUpdatesManager<T> {
    if (!this.incrementalManagers.has(key)) {
      const manager = createIncrementalManager(initialData, {
        batchSize: dataUsageOptimizer.currentPreferences.dataSavingMode ? 5 : 10,
        maxBatchDelay: 2000,
        enableDeltaCompression: dataUsageOptimizer.currentPreferences.compressionEnabled,
        trackChanges: true,
        ...config
      })
      this.incrementalManagers.set(key, manager)
    }
    return this.incrementalManagers.get(key)!
  }

  /**
   * Check if content should be preloaded based on current conditions
   */
  shouldPreloadContent(
    contentType: 'image' | 'video' | 'data',
    size: number
  ): boolean {
    // Check user preferences first
    if (dataUsageOptimizer.currentPreferences.dataSavingMode) {
      return false
    }

    // Check network conditions
    return bandwidthAwareDelivery.shouldPreloadContent(contentType, size)
  }

  /**
   * Get progressive loading strategy for large content
   */
  getProgressiveLoadingStrategy(contentSize: number) {
    const strategy = bandwidthAwareDelivery.getProgressiveLoadingStrategy(contentSize)
    
    // Adjust based on data saving preferences
    if (dataUsageOptimizer.currentPreferences.dataSavingMode) {
      return {
        ...strategy,
        chunkSize: Math.min(strategy.chunkSize, 32 * 1024), // Max 32KB chunks in data saving mode
        initialChunks: 1 // Only load one chunk initially
      }
    }

    return strategy
  }

  /**
   * Get comprehensive data usage report
   */
  getDataUsageReport(): string {
    const optimizerReport = dataUsageOptimizer.getDataUsageReport()
    const cacheStats = cacheManager.getStats()
    const networkState = networkManager.networkState

    return [
      optimizerReport,
      '',
      '=== Network & Cache Statistics ===',
      `Network Status: ${networkState.isOnline ? 'Online' : 'Offline'}`,
      `Connection Type: ${networkState.connectionType}`,
      `Effective Type: ${networkState.effectiveType}`,
      `Bandwidth: ${networkState.downlink} Mbps`,
      `RTT: ${networkState.rtt} ms`,
      `Save Data: ${networkState.saveData ? 'Enabled' : 'Disabled'}`,
      '',
      `Cache Hits: ${cacheStats.hits}`,
      `Cache Misses: ${cacheStats.misses}`,
      `Cache Size: ${this.formatBytes(cacheStats.totalSize)}`,
      `Cache Entries: ${cacheStats.entryCount}`,
      `Cache Evictions: ${cacheStats.evictions}`
    ].join('\n')
  }

  /**
   * Reset all optimization statistics
   */
  resetStatistics(): void {
    dataUsageOptimizer.resetStats()
    // Note: We don't clear cache as it's still valuable for performance
  }

  /**
   * Configure optimization based on user preferences
   */
  configureOptimization(preferences: {
    dataSavingMode?: boolean
    compressionEnabled?: boolean
    imageQuality?: 'low' | 'medium' | 'high' | 'auto'
    preloadContent?: boolean
    videoAutoplay?: boolean
  }): void {
    dataUsageOptimizer.updatePreferences(preferences)
  }

  // Private Methods

  private async tryIncrementalUpdate<T>(
    url: string,
    options: any
  ): Promise<T | null> {
    // Check if we have an incremental manager for this URL
    const manager = this.incrementalManagers.get(url)
    if (!manager) {
      return null
    }

    try {
      // Try to load incremental updates
      const updates = await manager.loadIncremental(
        async (lastTimestamp, version) => {
          // This would call your API's incremental endpoint
          const incrementalUrl = `${url}?since=${lastTimestamp}&version=${version}`
          return await networkManager.executeRequest({
            url: incrementalUrl,
            method: 'GET',
            priority: 'medium',
            maxRetries: 2
          })
        },
        true // Use cache
      )

      if (updates.length > 0) {
        // Apply updates and return current data
        updates.forEach(update => manager.applyUpdate(update))
        return manager.currentData
      }

      return null
    } catch (error) {
      console.warn('Incremental update failed:', error)
      return null
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
export const dataUsageIntegration = new DataUsageIntegrationManager()

// Convenience functions
export async function optimizeRequest<T>(url: string, options?: any) {
  return dataUsageIntegration.optimizeRequest<T>(url, options)
}

export function optimizeImage(imageUrl: string, options?: any) {
  return dataUsageIntegration.optimizeImage(imageUrl, options)
}

export function getIncrementalManager<T>(key: string, initialData: T, config?: any) {
  return dataUsageIntegration.getIncrementalManager(key, initialData, config)
}

export function shouldPreloadContent(contentType: 'image' | 'video' | 'data', size: number): boolean {
  return dataUsageIntegration.shouldPreloadContent(contentType, size)
}

export function getProgressiveLoadingStrategy(contentSize: number) {
  return dataUsageIntegration.getProgressiveLoadingStrategy(contentSize)
}

export function getDataUsageReport(): string {
  return dataUsageIntegration.getDataUsageReport()
}

export function configureDataUsageOptimization(preferences: any): void {
  return dataUsageIntegration.configureOptimization(preferences)
}