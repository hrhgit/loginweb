/**
 * Supabase Cache Integration
 * 
 * Provides caching layer for Supabase queries to improve performance
 * and reduce network requests while maintaining data consistency.
 */

import { supabase } from '../lib/supabase'
import { cacheManager, type CacheRequest } from './cacheManager'

export interface SupabaseCacheOptions {
  ttl?: number
  strategy?: 'cache-first' | 'network-first' | 'stale-while-revalidate'
  invalidateOn?: string[] // Patterns to invalidate this cache entry
}

/**
 * Cached Supabase query wrapper
 * Automatically caches SELECT queries based on table name and filters
 */
export class CachedSupabaseQuery {
  private tableName: string
  private queryBuilder: any
  private cacheKey: string
  private options: SupabaseCacheOptions

  constructor(
    tableName: string, 
    queryBuilder: any, 
    options: SupabaseCacheOptions = {}
  ) {
    this.tableName = tableName
    this.queryBuilder = queryBuilder
    this.options = {
      ttl: 300000, // 5 minutes default
      strategy: 'stale-while-revalidate',
      ...options
    }
    this.cacheKey = this.generateCacheKey()
  }

  private generateCacheKey(): string {
    // Create a cache key based on table name and query parameters
    const baseKey = `supabase:${this.tableName}`
    
    // Try to extract query parameters for more specific caching
    const queryString = this.queryBuilder.url?.toString() || ''
    const urlParams = new URLSearchParams(queryString.split('?')[1] || '')
    
    const params: string[] = []
    urlParams.forEach((value, key) => {
      params.push(`${key}=${value}`)
    })
    
    return params.length > 0 ? `${baseKey}:${params.sort().join('&')}` : baseKey
  }

  async execute(): Promise<any> {
    const request: CacheRequest<any> = {
      key: this.cacheKey,
      fetcher: async () => {
        const result = await this.queryBuilder
        if (result.error) {
          throw new Error(result.error.message)
        }
        return result
      },
      ttl: this.options.ttl,
      strategy: this.options.strategy
    }

    switch (this.options.strategy) {
      case 'cache-first':
        return cacheManager.cacheFirst(request)
      case 'network-first':
        return cacheManager.networkFirst(request)
      case 'stale-while-revalidate':
      default:
        return cacheManager.staleWhileRevalidate(request)
    }
  }

  invalidate(): Promise<void> {
    return cacheManager.invalidate(`supabase:${this.tableName}`)
  }
}

/**
 * Enhanced Supabase client with caching capabilities
 */
export class CachedSupabaseClient {
  private client = supabase

  /**
   * Create a cached query for a table
   */
  from(tableName: string) {
    return new CachedSupabaseTableBuilder(tableName, this.client.from(tableName))
  }

  /**
   * Invalidate cache for specific table or pattern
   */
  async invalidateCache(pattern: string): Promise<void> {
    return cacheManager.invalidate(`supabase:${pattern}`)
  }

  /**
   * Clear all Supabase-related cache
   */
  async clearCache(): Promise<void> {
    return cacheManager.invalidate('supabase:')
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return cacheManager.getStats()
  }
}

/**
 * Cached table builder that wraps Supabase table operations
 */
class CachedSupabaseTableBuilder {
  private tableName: string
  private queryBuilder: any
  private cacheOptions: SupabaseCacheOptions = {}

  constructor(tableName: string, queryBuilder: any) {
    this.tableName = tableName
    this.queryBuilder = queryBuilder
  }

  // Query methods that should be cached
  select(columns?: string, options?: any) {
    this.queryBuilder = this.queryBuilder.select(columns, options)
    return this
  }

  eq(column: string, value: any) {
    this.queryBuilder = this.queryBuilder.eq(column, value)
    return this
  }

  neq(column: string, value: any) {
    this.queryBuilder = this.queryBuilder.neq(column, value)
    return this
  }

  gt(column: string, value: any) {
    this.queryBuilder = this.queryBuilder.gt(column, value)
    return this
  }

  gte(column: string, value: any) {
    this.queryBuilder = this.queryBuilder.gte(column, value)
    return this
  }

  lt(column: string, value: any) {
    this.queryBuilder = this.queryBuilder.lt(column, value)
    return this
  }

  lte(column: string, value: any) {
    this.queryBuilder = this.queryBuilder.lte(column, value)
    return this
  }

  like(column: string, pattern: string) {
    this.queryBuilder = this.queryBuilder.like(column, pattern)
    return this
  }

  ilike(column: string, pattern: string) {
    this.queryBuilder = this.queryBuilder.ilike(column, pattern)
    return this
  }

  in(column: string, values: any[]) {
    this.queryBuilder = this.queryBuilder.in(column, values)
    return this
  }

  contains(column: string, value: any) {
    this.queryBuilder = this.queryBuilder.contains(column, value)
    return this
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.queryBuilder = this.queryBuilder.order(column, options)
    return this
  }

  limit(count: number) {
    this.queryBuilder = this.queryBuilder.limit(count)
    return this
  }

  range(from: number, to: number) {
    this.queryBuilder = this.queryBuilder.range(from, to)
    return this
  }

  // Cache configuration methods
  withCache(options: SupabaseCacheOptions) {
    this.cacheOptions = { ...this.cacheOptions, ...options }
    return this
  }

  cacheFirst(ttl?: number) {
    this.cacheOptions.strategy = 'cache-first'
    if (ttl) this.cacheOptions.ttl = ttl
    return this
  }

  networkFirst(ttl?: number) {
    this.cacheOptions.strategy = 'network-first'
    if (ttl) this.cacheOptions.ttl = ttl
    return this
  }

  staleWhileRevalidate(ttl?: number) {
    this.cacheOptions.strategy = 'stale-while-revalidate'
    if (ttl) this.cacheOptions.ttl = ttl
    return this
  }

  // Execution methods
  async execute(): Promise<any> {
    const cachedQuery = new CachedSupabaseQuery(
      this.tableName,
      this.queryBuilder,
      this.cacheOptions
    )
    return cachedQuery.execute()
  }

  // For compatibility with existing code
  async then(resolve?: any, reject?: any): Promise<any> {
    try {
      const result = await this.execute()
      return resolve ? resolve(result) : result
    } catch (error) {
      if (reject) {
        return reject(error)
      }
      throw error
    }
  }

  // Single record methods
  async single(): Promise<any> {
    this.queryBuilder = this.queryBuilder.single()
    return this.execute()
  }

  async maybeSingle(): Promise<any> {
    this.queryBuilder = this.queryBuilder.maybeSingle()
    return this.execute()
  }

  // Write operations (not cached, but invalidate cache)
  async insert(values: any, options?: any): Promise<any> {
    const result = await this.queryBuilder.insert(values, options)
    
    // Invalidate cache for this table after write operations
    await cacheManager.invalidate(`supabase:${this.tableName}`)
    
    return result
  }

  async update(values: any, options?: any): Promise<any> {
    const result = await this.queryBuilder.update(values, options)
    
    // Invalidate cache for this table after write operations
    await cacheManager.invalidate(`supabase:${this.tableName}`)
    
    return result
  }

  async delete(): Promise<any> {
    const result = await this.queryBuilder.delete()
    
    // Invalidate cache for this table after write operations
    await cacheManager.invalidate(`supabase:${this.tableName}`)
    
    return result
  }

  async upsert(values: any, options?: any): Promise<any> {
    const result = await this.queryBuilder.upsert(values, options)
    
    // Invalidate cache for this table after write operations
    await cacheManager.invalidate(`supabase:${this.tableName}`)
    
    return result
  }
}

// Create singleton cached client
export const cachedSupabase = new CachedSupabaseClient()

// Convenience functions for common caching patterns
export function cacheEvents(ttl: number = 300000) {
  return cachedSupabase.from('events').staleWhileRevalidate(ttl)
}

export function cacheTeams(eventId: string, ttl: number = 180000) {
  return cachedSupabase.from('teams')
    .eq('event_id', eventId)
    .staleWhileRevalidate(ttl)
}

export function cacheProfiles(ttl: number = 600000) {
  return cachedSupabase.from('profiles').cacheFirst(ttl)
}

export function cacheSubmissions(eventId: string, ttl: number = 120000) {
  return cachedSupabase.from('submissions')
    .eq('event_id', eventId)
    .staleWhileRevalidate(ttl)
}

// Cache invalidation helpers
export async function invalidateEventCache(eventId?: string): Promise<void> {
  if (eventId) {
    await Promise.all([
      cachedSupabase.invalidateCache(`events.*${eventId}`),
      cachedSupabase.invalidateCache(`teams.*event_id=${eventId}`),
      cachedSupabase.invalidateCache(`submissions.*event_id=${eventId}`)
    ])
  } else {
    await cachedSupabase.invalidateCache('events')
  }
}

export async function invalidateTeamCache(teamId?: string): Promise<void> {
  if (teamId) {
    await cachedSupabase.invalidateCache(`teams.*${teamId}`)
  } else {
    await cachedSupabase.invalidateCache('teams')
  }
}

export async function invalidateProfileCache(userId?: string): Promise<void> {
  if (userId) {
    await cachedSupabase.invalidateCache(`profiles.*${userId}`)
  } else {
    await cachedSupabase.invalidateCache('profiles')
  }
}