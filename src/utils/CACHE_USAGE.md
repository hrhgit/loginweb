# Cache Manager Usage Guide

The Cache Manager provides intelligent caching for API responses and static assets with multiple caching strategies to improve performance and reduce network requests.

## Quick Start

```typescript
import { cacheApiResponse, cacheStaticAsset, invalidateCache } from './cacheManager'

// Cache an API response with stale-while-revalidate strategy
const events = await cacheApiResponse(
  'events:public',
  async () => {
    const { data, error } = await supabase.from('events').select('*')
    if (error) throw new Error(error.message)
    return data
  },
  'stale-while-revalidate'
)

// Cache a static asset with cache-first strategy
const config = await cacheStaticAsset(
  'app-config',
  async () => {
    const response = await fetch('/api/config')
    return response.json()
  }
)
```

## Caching Strategies

### 1. Cache-First
Best for: Static assets, configuration data, rarely changing content
```typescript
await cacheApiResponse(key, fetcher, 'cache-first')
```
- Returns cached data immediately if available
- Only fetches from network if cache miss
- Fastest response time for cached data

### 2. Network-First
Best for: Critical data that must be fresh, user-specific data
```typescript
await cacheApiResponse(key, fetcher, 'network-first')
```
- Always tries network first
- Falls back to cache if network fails
- Ensures data freshness when possible

### 3. Stale-While-Revalidate (Default)
Best for: General API responses, frequently accessed data
```typescript
await cacheApiResponse(key, fetcher, 'stale-while-revalidate')
```
- Returns cached data immediately
- Updates cache in background
- Best balance of speed and freshness

## Integration with Existing Code

### AppStore Integration
```typescript
// Before (direct Supabase call)
const { data, error } = await supabase.from('events').select('*')

// After (with caching)
import { loadEventsCached } from './appStoreCacheIntegration'
const data = await loadEventsCached(isAdmin, userId)
```

### Supabase Integration
```typescript
import { cachedSupabase } from './supabaseCacheIntegration'

// Cached query with automatic invalidation on writes
const events = await cachedSupabase
  .from('events')
  .select('*')
  .eq('status', 'published')
  .staleWhileRevalidate(300000) // 5 minutes TTL
```

## Cache Invalidation

### Manual Invalidation
```typescript
// Invalidate specific cache entries
await invalidateCache('events:public')

// Invalidate by pattern (all event-related caches)
await invalidateCache('events:')
```

### Automatic Invalidation
```typescript
// Write operations automatically invalidate related caches
await cachedSupabase.from('events').insert(newEvent)
// This automatically invalidates all 'events:*' cache entries
```

### Bulk Invalidation
```typescript
import { invalidateEventCaches, invalidateUserCaches } from './appStoreCacheIntegration'

// Invalidate all event-related caches
await invalidateEventCaches()

// Invalidate user-specific caches
await invalidateUserCaches(userId)
```

## Performance Monitoring

```typescript
import { getCacheStats } from './cacheManager'

// Get cache performance metrics
const stats = getCacheStats()
console.log({
  hitRate: (stats.hits / (stats.hits + stats.misses)) * 100,
  totalEntries: stats.entryCount,
  memoryUsage: stats.totalSize,
  evictions: stats.evictions
})
```

## Network-Aware Caching

The cache manager integrates with the network manager to provide intelligent behavior:

- **Offline Mode**: Serves cached data when network is unavailable
- **Slow Connections**: Prioritizes cached responses for better UX
- **Network Recovery**: Automatically revalidates stale data when connection is restored

## Best Practices

### 1. Choose Appropriate TTL
```typescript
// Short TTL for frequently changing data
await cacheApiResponse(key, fetcher, 'stale-while-revalidate', 60000) // 1 minute

// Long TTL for static data
await cacheStaticAsset(key, fetcher, 86400000) // 24 hours
```

### 2. Use Descriptive Cache Keys
```typescript
// Good: Specific and hierarchical
'events:public:page:1'
'user:profile:123'
'team:members:456'

// Bad: Generic or unclear
'data'
'response'
'temp'
```

### 3. Invalidate on Data Changes
```typescript
const updateEvent = async (eventId, updates) => {
  // Update the event
  await supabase.from('events').update(updates).eq('id', eventId)
  
  // Invalidate related caches
  await invalidateCache(`event:${eventId}`)
  await invalidateCache('events:')
}
```

### 4. Handle Cache Errors Gracefully
```typescript
try {
  const data = await cacheApiResponse(key, fetcher)
  return data
} catch (error) {
  // Log error but don't break the application
  console.warn('Cache operation failed:', error)
  // Fallback to direct API call if needed
  return await directApiCall()
}
```

## Configuration

The cache manager can be configured with custom settings:

```typescript
import { CacheManager } from './cacheManager'

const customCache = new CacheManager({
  maxSize: 20 * 1024 * 1024, // 20MB
  maxAge: 1800000, // 30 minutes default TTL
  excludePatterns: ['auth', 'login', 'sensitive-data'],
  strategies: {
    'api': { name: 'stale-while-revalidate', ttl: 300000, maxRetries: 3 },
    'static': { name: 'cache-first', ttl: 86400000, maxRetries: 1 },
    'dynamic': { name: 'network-first', ttl: 60000, maxRetries: 2 }
  }
})
```

## Testing

The cache manager includes comprehensive property-based tests that verify:
- Cache hit efficiency
- TTL expiration behavior
- Pattern-based invalidation
- Memory management under load
- Network integration

Run tests with:
```bash
npm test -- src/utils/cacheManager.resource-caching-efficiency.property.test.ts
```