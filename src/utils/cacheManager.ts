/**
 * Cache Manager - Intelligent caching system with multiple strategies
 * 
 * Provides cache-first, network-first, and stale-while-revalidate strategies
 * for API responses and static assets with TTL management and invalidation.
 */

import { networkManager } from './networkManager'
import { registerNetworkCleanup } from './memoryManager'

export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  size: number
}

export interface CacheRequest<T> {
  key: string
  fetcher: () => Promise<T>
  ttl?: number
  strategy?: 'cache-first' | 'network-first' | 'stale-while-revalidate'
}

export interface CacheConfig {
  maxSize: number // bytes
  maxAge: number // milliseconds
  strategies: Record<string, CacheStrategy>
  excludePatterns: string[]
}

export interface CacheStrategy {
  name: 'cache-first' | 'network-first' | 'stale-while-revalidate'
  ttl: number
  maxRetries: number
}

export interface CacheStats {
  hits: number
  misses: number
  evictions: number
  totalSize: number
  entryCount: number
}

/**
 * In-memory cache with LRU eviction and TTL support
 */
class MemoryCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private accessOrder = new Map<string, number>()
  private accessCounter = 0
  private maxSize: number
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalSize: 0,
    entryCount: 0
  }

  constructor(maxSize: number = 10 * 1024 * 1024) { // 10MB default
    this.maxSize = maxSize
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined
    
    if (!entry) {
      this.stats.misses++
      return null
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.cache.delete(key)
      this.accessOrder.delete(key)
      this.updateStats()
      this.stats.misses++
      return null
    }

    // Update access order for LRU
    this.accessOrder.set(key, ++this.accessCounter)
    this.stats.hits++
    return entry.data
  }

  set<T>(key: string, data: T, ttl: number = 3600000): void { // 1 hour default TTL
    const serialized = JSON.stringify(data)
    const size = new Blob([serialized]).size
    
    // Check if we need to evict entries to make space
    this.evictIfNeeded(size)

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      size
    }

    this.cache.set(key, entry as CacheEntry<any>)
    this.accessOrder.set(key, ++this.accessCounter)
    this.updateStats()
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key)
    if (deleted) {
      this.accessOrder.delete(key)
      this.updateStats()
    }
    return deleted
  }

  clear(): void {
    this.cache.clear()
    this.accessOrder.clear()
    this.accessCounter = 0
    this.updateStats()
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    
    if (this.isExpired(entry)) {
      this.cache.delete(key)
      this.accessOrder.delete(key)
      this.updateStats()
      return false
    }
    
    return true
  }

  getStats(): CacheStats {
    return { ...this.stats }
  }

  invalidatePattern(pattern: string): number {
    const regex = new RegExp(pattern)
    let invalidated = 0

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
        this.accessOrder.delete(key)
        invalidated++
      }
    }

    if (invalidated > 0) {
      this.updateStats()
    }

    return invalidated
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl
  }

  private evictIfNeeded(newEntrySize: number): void {
    // Remove expired entries first
    this.cleanupExpired()

    // If still over capacity, use LRU eviction
    while (this.stats.totalSize + newEntrySize > this.maxSize && this.cache.size > 0) {
      this.evictLRU()
    }
  }

  private cleanupExpired(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
        this.accessOrder.delete(key)
        this.stats.evictions++
      }
    }
    this.updateStats()
  }

  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestAccess = Infinity

    for (const [key, accessTime] of this.accessOrder.entries()) {
      if (accessTime < oldestAccess) {
        oldestAccess = accessTime
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
      this.accessOrder.delete(oldestKey)
      this.stats.evictions++
      this.updateStats()
    }
  }

  private updateStats(): void {
    this.stats.entryCount = this.cache.size
    this.stats.totalSize = Array.from(this.cache.values())
      .reduce((total, entry) => total + entry.size, 0)
  }
}

/**
 * Persistent cache using localStorage with fallback to memory
 */
class PersistentCache<T> {
  private memoryCache: MemoryCache<T>
  private storageKey: string

  constructor(storageKey: string = 'app_cache', maxSize: number = 5 * 1024 * 1024) {
    this.storageKey = storageKey
    this.memoryCache = new MemoryCache<T>(maxSize)
    this.loadFromStorage()
  }

  get<T>(key: string): T | null {
    // Try memory cache first
    const result = this.memoryCache.get<T>(key)
    if (result !== null) {
      return result
    }

    // Try localStorage
    try {
      const stored = localStorage.getItem(`${this.storageKey}:${key}`)
      if (stored) {
        const entry: CacheEntry<T> = JSON.parse(stored)
        
        // Check if expired
        if (Date.now() - entry.timestamp <= entry.ttl) {
          // Add back to memory cache
          this.memoryCache.set(key, entry.data, entry.ttl - (Date.now() - entry.timestamp))
          return entry.data
        } else {
          // Remove expired entry
          localStorage.removeItem(`${this.storageKey}:${key}`)
        }
      }
    } catch (error) {
      console.warn('Failed to read from localStorage cache:', error)
    }

    return null
  }

  set<T>(key: string, data: T, ttl: number = 3600000): void {
    // Set in memory cache
    this.memoryCache.set(key, data, ttl)

    // Try to persist to localStorage
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
        size: new Blob([JSON.stringify(data)]).size
      }
      
      localStorage.setItem(`${this.storageKey}:${key}`, JSON.stringify(entry))
    } catch (error) {
      // localStorage might be full or unavailable
      console.warn('Failed to persist to localStorage cache:', error)
    }
  }

  delete(key: string): boolean {
    const memoryDeleted = this.memoryCache.delete(key)
    
    try {
      localStorage.removeItem(`${this.storageKey}:${key}`)
    } catch (error) {
      console.warn('Failed to delete from localStorage cache:', error)
    }

    return memoryDeleted
  }

  clear(): void {
    this.memoryCache.clear()
    
    try {
      // Remove all keys with our prefix
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(`${this.storageKey}:`)) {
          keysToRemove.push(key)
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key))
    } catch (error) {
      console.warn('Failed to clear localStorage cache:', error)
    }
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  getStats(): CacheStats {
    return this.memoryCache.getStats()
  }

  invalidatePattern(pattern: string): number {
    let invalidated = this.memoryCache.invalidatePattern(pattern)

    try {
      const regex = new RegExp(pattern)
      const keysToRemove: string[] = []
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(`${this.storageKey}:`)) {
          const cacheKey = key.substring(`${this.storageKey}:`.length)
          if (regex.test(cacheKey)) {
            keysToRemove.push(key)
          }
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key)
        invalidated++
      })
    } catch (error) {
      console.warn('Failed to invalidate localStorage cache pattern:', error)
    }

    return invalidated
  }

  private loadFromStorage(): void {
    try {
      // Load existing entries from localStorage into memory cache
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(`${this.storageKey}:`)) {
          const cacheKey = key.substring(`${this.storageKey}:`.length)
          const stored = localStorage.getItem(key)
          
          if (stored) {
            const entry: CacheEntry<any> = JSON.parse(stored)
            
            // Only load non-expired entries
            if (Date.now() - entry.timestamp <= entry.ttl) {
              this.memoryCache.set(cacheKey, entry.data, entry.ttl - (Date.now() - entry.timestamp))
            } else {
              // Remove expired entry
              localStorage.removeItem(key)
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load cache from localStorage:', error)
    }
  }
}

/**
 * Main Cache Manager with multiple caching strategies
 */
export class CacheManager {
  private cache: PersistentCache<any>
  private config: CacheConfig

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      maxSize: 10 * 1024 * 1024, // 10MB
      maxAge: 3600000, // 1 hour
      strategies: {
        'api': { name: 'stale-while-revalidate', ttl: 300000, maxRetries: 3 }, // 5 minutes
        'static': { name: 'cache-first', ttl: 86400000, maxRetries: 1 }, // 24 hours
        'dynamic': { name: 'network-first', ttl: 60000, maxRetries: 2 } // 1 minute
      },
      excludePatterns: ['auth', 'login', 'logout'],
      ...config
    }

    this.cache = new PersistentCache('cache_manager', this.config.maxSize)
    this.registerMemoryCleanup()
  }

  private registerMemoryCleanup(): void {
    registerNetworkCleanup({
      clearCache: () => this.clear(),
      getCacheStats: () => {
        const stats = this.getStats()
        return {
          totalSize: stats.totalSize,
          entryCount: stats.entryCount
        }
      }
    })
  }

  async get<T>(key: string): Promise<T | null> {
    // Check if key matches exclude patterns
    if (this.isExcluded(key)) {
      return null
    }

    return this.cache.get<T>(key)
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (this.isExcluded(key)) {
      return
    }

    const effectiveTtl = ttl || this.config.maxAge
    this.cache.set(key, value, effectiveTtl)
  }

  async invalidate(pattern: string): Promise<void> {
    this.cache.invalidatePattern(pattern)
  }

  async cacheFirst<T>(request: CacheRequest<T>): Promise<T> {
    const cached = await this.get<T>(request.key)
    
    if (cached !== null) {
      return cached
    }

    // Cache miss - fetch from network
    try {
      const data = await request.fetcher()
      await this.set(request.key, data, request.ttl)
      return data
    } catch (error) {
      throw error
    }
  }

  async networkFirst<T>(request: CacheRequest<T>): Promise<T> {
    // Check network status before attempting network request
    if (!networkManager.isOnline) {
      // If offline, try cache first
      const cached = await this.get<T>(request.key)
      if (cached !== null) {
        return cached
      }
      throw new Error('No network connection and no cached data available')
    }

    try {
      // Try network first
      const data = await request.fetcher()
      await this.set(request.key, data, request.ttl)
      return data
    } catch (error) {
      // Network failed - try cache
      const cached = await this.get<T>(request.key)
      
      if (cached !== null) {
        return cached
      }

      // Both network and cache failed
      throw error
    }
  }

  async staleWhileRevalidate<T>(request: CacheRequest<T>): Promise<T> {
    const cached = await this.get<T>(request.key)
    
    if (cached !== null) {
      // Return cached data immediately
      // Only revalidate in background if online
      if (networkManager.isOnline) {
        this.revalidateInBackground(request).catch(error => {
          console.warn('Background revalidation failed:', error)
        })
      }
      
      return cached
    }

    // No cached data - fetch from network if online
    if (!networkManager.isOnline) {
      throw new Error('No network connection and no cached data available')
    }

    try {
      const data = await request.fetcher()
      await this.set(request.key, data, request.ttl)
      return data
    } catch (error) {
      throw error
    }
  }

  getStats(): CacheStats {
    return this.cache.getStats()
  }

  clear(): void {
    this.cache.clear()
  }

  private async revalidateInBackground<T>(request: CacheRequest<T>): Promise<void> {
    try {
      const data = await request.fetcher()
      await this.set(request.key, data, request.ttl)
    } catch (error) {
      // Silently fail background revalidation
      console.warn('Background revalidation failed for key:', request.key, error)
    }
  }

  private isExcluded(key: string): boolean {
    return this.config.excludePatterns.some(pattern => {
      const regex = new RegExp(pattern, 'i')
      return regex.test(key)
    })
  }
}

// Create singleton instance
export const cacheManager = new CacheManager()

// Convenience functions for common caching patterns
export async function cacheApiResponse<T>(
  key: string,
  fetcher: () => Promise<T>,
  strategy: 'cache-first' | 'network-first' | 'stale-while-revalidate' = 'stale-while-revalidate'
): Promise<T> {
  const request: CacheRequest<T> = {
    key: `api:${key}`,
    fetcher,
    strategy,
    ttl: 300000 // 5 minutes
  }

  switch (strategy) {
    case 'cache-first':
      return cacheManager.cacheFirst(request)
    case 'network-first':
      return cacheManager.networkFirst(request)
    case 'stale-while-revalidate':
      return cacheManager.staleWhileRevalidate(request)
    default:
      return cacheManager.staleWhileRevalidate(request)
  }
}

export async function cacheStaticAsset<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  return cacheManager.cacheFirst({
    key: `static:${key}`,
    fetcher,
    ttl: 86400000 // 24 hours
  })
}

export function invalidateCache(pattern: string): Promise<void> {
  return cacheManager.invalidate(pattern)
}

export function getCacheStats(): CacheStats {
  return cacheManager.getStats()
}