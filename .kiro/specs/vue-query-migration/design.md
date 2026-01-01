# Vue Query Migration Design Document

## Overview

This design document outlines the complete migration of the event management platform's data management system from traditional store-based caching to Vue Query (TanStack Query). While Vue Query has already been successfully implemented for teams and submissions data, significant portions of the application still rely on legacy store-based methods. This migration will unify the data management approach, improve performance, and provide a consistent developer experience.

The migration follows the established "stale-while-revalidate" pattern, ensuring users see cached data immediately while fresh data is fetched in the background. The design maintains all existing functionality while removing manual cache management code and replacing it with Vue Query's intelligent caching system.

## Architecture

### Current State Analysis

**Already Migrated (✅):**
- Teams data management (`src/composables/useTeams.ts`)
- Submissions data management (`src/composables/useSubmissions.ts`)
- Vue Query configuration (`src/lib/vueQuery.ts`)
- Query key factory pattern
- Stale-while-revalidate behavior for teams and submissions

**Needs Migration (🔄):**
- Events data management (loadEvents, getEventById, etc.)
- User profile and contacts management
- Registration status management
- Judge permissions and workspace data
- Notification management
- Legacy store methods and reactive state variables

### Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Vue Components                          │
├─────────────────────────────────────────────────────────────┤
│                Vue Query Composables                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────┐ │
│  │ useEvents   │ │ useTeams    │ │useSubmissions│ │useUsers│ │
│  │             │ │ (existing)  │ │ (existing)   │ │        │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────┘ │
├─────────────────────────────────────────────────────────────┤
│                    Vue Query Core                           │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Query Client (Cache Management, Background Updates)    │ │
│  └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                  Data Fetching Layer                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────┐ │
│  │fetchEvents  │ │fetchTeams   │ │fetchSubmiss.│ │fetchUser│ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────┘ │
├─────────────────────────────────────────────────────────────┤
│                     Supabase API                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 Simplified Store                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │Authentication│ │ UI State    │ │Business Logic│          │
│  │             │ │             │ │             │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### New Vue Query Composables

#### 1. Events Management (`src/composables/useEvents.ts`)

```typescript
// Public events query
export function usePublicEvents(): UseQueryResult<Event[], Error>

// User's created events query  
export function useMyEvents(userId: string): UseQueryResult<Event[], Error>

// Single event query
export function useEvent(eventId: string): UseQueryResult<Event | null, Error>

// Event creation mutation
export function useCreateEvent(): UseMutationResult<Event, Error, CreateEventPayload>

// Event update mutation
export function useUpdateEvent(): UseMutationResult<Event, Error, UpdateEventPayload>

// Event deletion mutation
export function useDeleteEvent(): UseMutationResult<void, Error, string>

// Convenience wrapper
export function useEventData(): {
  publicEvents: UseQueryResult<Event[], Error>
  myEvents: UseQueryResult<Event[], Error>
  isLoading: ComputedRef<boolean>
  error: ComputedRef<Error | null>
  refetch: () => void
}
```

#### 2. User Management (`src/composables/useUsers.ts`)

```typescript
// User profile query
export function useProfile(userId: string): UseQueryResult<Profile | null, Error>

// User contacts query
export function useContacts(userId: string): UseQueryResult<UserContacts | null, Error>

// Profile update mutation
export function useUpdateProfile(): UseMutationResult<Profile, Error, UpdateProfilePayload>

// Contacts update mutation
export function useUpdateContacts(): UseMutationResult<UserContacts, Error, UpdateContactsPayload>

// User registrations query
export function useRegistrations(userId: string): UseQueryResult<Registration[], Error>

// Registration mutation
export function useRegisterForEvent(): UseMutationResult<Registration, Error, RegistrationPayload>
```

#### 3. Judge Management (`src/composables/useJudges.ts`)

```typescript
// Judge permissions query
export function useJudgePermissions(eventId: string, userId: string): UseQueryResult<JudgePermission, Error>

// Event judges query
export function useEventJudges(eventId: string): UseQueryResult<JudgeWithProfile[], Error>

// Add judge mutation
export function useAddJudge(): UseMutationResult<void, Error, AddJudgePayload>

// Remove judge mutation
export function useRemoveJudge(): UseMutationResult<void, Error, RemoveJudgePayload>
```

#### 4. Notifications Management (`src/composables/useNotifications.ts`)

```typescript
// User notifications query
export function useNotifications(userId: string): UseQueryResult<NotificationItem[], Error>

// Mark notification read mutation
export function useMarkNotificationRead(): UseMutationResult<void, Error, string>

// Clear notifications mutation
export function useClearNotifications(): UseMutationResult<void, Error, string>
```

### Query Key Extensions

```typescript
// Extend existing query keys factory
export const queryKeys = {
  // Existing keys...
  teams: { /* existing */ },
  submissions: { /* existing */ },
  
  // New keys
  events: {
    all: ['events'] as const,
    public: ['events', 'public'] as const,
    my: (userId: string) => ['events', 'my', userId] as const,
    detail: (eventId: string) => ['events', 'detail', eventId] as const,
  },
  
  users: {
    profile: (userId: string) => ['users', 'profile', userId] as const,
    contacts: (userId: string) => ['users', 'contacts', userId] as const,
    registrations: (userId: string) => ['users', 'registrations', userId] as const,
  },
  
  judges: {
    permissions: (eventId: string, userId: string) => ['judges', 'permissions', eventId, userId] as const,
    byEvent: (eventId: string) => ['judges', 'event', eventId] as const,
  },
  
  notifications: {
    byUser: (userId: string) => ['notifications', 'user', userId] as const,
  },
} as const
```

## Data Models

### Existing Models (No Changes)
- `TeamLobbyTeam`, `TeamMember`, `TeamSeeker` - Already used with Vue Query
- `SubmissionWithTeam` - Already used with Vue Query
- `Event`, `Profile`, `UserContacts` - Will be used with new Vue Query composables

### New Interface Extensions

```typescript
// Query result wrapper for consistent error handling
export interface QueryResult<T> {
  data: T | undefined
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
  isFetching: boolean
}

// Mutation result wrapper
export interface MutationResult<T, TVariables> {
  mutate: (variables: TVariables) => void
  mutateAsync: (variables: TVariables) => Promise<T>
  isPending: boolean
  isError: boolean
  error: Error | null
  reset: () => void
}

// Cache invalidation patterns
export interface CacheInvalidationMap {
  events: {
    create: string[]  // Query keys to invalidate after event creation
    update: string[]  // Query keys to invalidate after event update
    delete: string[]  // Query keys to invalidate after event deletion
  }
  users: {
    updateProfile: string[]
    updateContacts: string[]
    register: string[]
  }
  judges: {
    add: string[]
    remove: string[]
  }
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, several properties can be consolidated to eliminate redundancy:

- **Cache behavior properties** (1.1, 1.2, 1.4, 1.5) can be combined into comprehensive cache behavior tests
- **Migration verification properties** (4.1, 4.2, 4.3, 11.1-11.5, 12.1-12.5) can be grouped as migration completeness tests
- **Error handling properties** (3.1, 3.2, 8.1, 8.2) can be consolidated into comprehensive error handling tests
- **Data management properties** (6.1-6.5) can be verified through consistent interface tests

### Core Properties

**Property 1: Stale-while-revalidate cache behavior**
*For any* cached data that is less than 30 seconds old, the system should display it immediately without triggering background requests, and for any cached data older than 30 seconds, the system should display it immediately while triggering background updates
**Validates: Requirements 1.1, 1.2, 1.4, 1.5**

**Property 2: Vue Query composable consistency**
*For any* data fetching operation, the system should use Vue Query composables that follow the established query key factory pattern and provide consistent loading, error, and success states
**Validates: Requirements 2.1, 2.2, 2.5**

**Property 3: Automatic cache invalidation**
*For any* data mutation (create, update, delete), the system should automatically invalidate all related cache entries and trigger background refetches
**Validates: Requirements 2.4, 7.1, 7.2, 7.3**

**Property 4: Network error retry behavior**
*For any* network error, the system should retry up to 3 times with exponential backoff, and after exhausting retries, should display cached data if available with appropriate error messages
**Validates: Requirements 3.1, 3.2, 8.1, 8.2**

**Property 5: Network state responsiveness**
*For any* network state change (reconnection, tab focus), the system should automatically check for data updates and refetch when appropriate
**Validates: Requirements 3.3, 3.4**

**Property 6: Image cache prevention**
*For any* image URL generation, the system should include cache-busting parameters to prevent browser caching and save cache space
**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

**Property 7: Migration completeness**
*For any* component that previously used store methods for data fetching, the system should now use Vue Query composables and no legacy store data methods should remain
**Validates: Requirements 4.1, 4.2, 11.1, 11.2, 11.3, 11.4, 11.5, 12.2, 12.3, 12.4**

**Property 8: Memory management**
*For any* cached data, the system should automatically clean up unused cache entries after 15 minutes and share cache entries efficiently between components
**Validates: Requirements 9.1, 9.2, 9.3, 9.4**

**Property 9: Error integration consistency**
*For any* error that occurs in Vue Query operations, the system should integrate with the existing error handling system to provide consistent user feedback
**Validates: Requirements 2.3, 8.2, 8.4**

**Property 10: Functional preservation**
*For any* existing functionality, the system should maintain the same behavior after migration to Vue Query
**Validates: Requirements 4.4**

## Error Handling

### Integration with Existing Error System

The migration maintains integration with the existing error handling system:

```typescript
// Error handlers from enhancedErrorHandling.ts
import { 
  authErrorHandler,
  apiErrorHandler,
  eventErrorHandler,
  teamErrorHandler,
  profileErrorHandler
} from '../store/enhancedErrorHandling'

// Example integration in Vue Query composable
export function useEvents() {
  return useQuery({
    queryKey: queryKeys.events.public,
    queryFn: async () => {
      try {
        return await fetchPublicEvents()
      } catch (error) {
        eventErrorHandler.handleError(error, { operation: 'fetchPublicEvents' })
        throw error
      }
    },
    retry: (failureCount, error: any) => {
      const isNetworkError = error?.message?.includes('网络') || 
                            error?.message?.includes('fetch') ||
                            error?.code === 'NETWORK_ERROR'
      return isNetworkError && failureCount < 3
    },
  })
}
```

### Error Classification and Retry Logic

```typescript
// Centralized error classification for Vue Query
export const createVueQueryErrorConfig = () => ({
  retry: (failureCount: number, error: any) => {
    // Network errors: retry up to 3 times
    if (isNetworkError(error)) {
      return failureCount < 3
    }
    
    // Permission errors: don't retry
    if (isPermissionError(error)) {
      return false
    }
    
    // Server errors (5xx): retry once
    if (isServerError(error)) {
      return failureCount < 1
    }
    
    // Client errors (4xx): don't retry
    return false
  },
  
  retryDelay: (attemptIndex: number) => 
    Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff, max 10s
})
```

## Testing Strategy

### Dual Testing Approach

The migration requires both unit testing and property-based testing to ensure comprehensive coverage:

**Unit Tests:**
- Test specific Vue Query composable functions
- Verify error handling integration
- Test cache invalidation scenarios
- Verify component integration with Vue Query hooks

**Property-Based Tests:**
- Test stale-while-revalidate behavior across different cache states
- Verify retry logic with various error types
- Test cache invalidation patterns across different mutation types
- Verify image URL generation always includes cache-busting parameters

### Property-Based Testing Requirements

The design specifies using **Vitest** with **fast-check** for property-based testing:

```typescript
// Example property-based test structure
import { fc, test } from '@fast-check/vitest'

// **Feature: vue-query-migration, Property 1: Stale-while-revalidate cache behavior**
test.prop([
  fc.record({
    cacheAge: fc.integer({ min: 0, max: 120 }), // seconds
    data: fc.array(fc.record({ id: fc.string(), name: fc.string() }))
  })
])('should handle cache staleness correctly', async ({ cacheAge, data }) => {
  // Test implementation
})
```

Each property-based test must:
- Run a minimum of 100 iterations
- Include a comment with the exact format: `**Feature: vue-query-migration, Property {number}: {property_text}**`
- Reference the corresponding correctness property from this design document

### Migration Testing Strategy

```typescript
// Test that verifies migration completeness
describe('Migration Completeness', () => {
  test('should not use legacy store methods', () => {
    // Scan all Vue components for legacy store method usage
    // Verify no components call store.loadEvents, store.loadSubmissions, etc.
  })
  
  test('should use Vue Query for all data operations', () => {
    // Verify all data operations use Vue Query composables
  })
  
  test('should maintain functional equivalence', () => {
    // Run existing integration tests to verify behavior is preserved
  })
})
```

## Implementation Plan

### Phase 1: Events Data Migration

1. Create `src/composables/useEvents.ts`
2. Implement events query functions
3. Update components using events data
4. Remove legacy events methods from store

### Phase 2: User Data Migration

1. Create `src/composables/useUsers.ts`
2. Implement profile and contacts queries
3. Update profile and registration components
4. Remove legacy user methods from store

### Phase 3: Judge Data Migration

1. Create `src/composables/useJudges.ts`
2. Implement judge permission and management queries
3. Update judge-related components
4. Remove legacy judge methods from store

### Phase 4: Notifications Migration

1. Create `src/composables/useNotifications.ts`
2. Implement notification queries and mutations
3. Update notification components
4. Remove legacy notification methods from store

### Phase 5: Store Cleanup

1. Remove all legacy data fetching methods
2. Remove manual cache management code
3. Remove unused reactive state variables
4. Update store to contain only auth, UI state, and business logic

### Phase 6: Testing and Validation

1. Implement property-based tests for all new composables
2. Update existing unit tests
3. Verify migration completeness
4. Performance testing and optimization

## Cache Configuration Standards

### Stale Time Configuration

```typescript
// Different stale times based on data characteristics
const CACHE_CONFIG = {
  // Real-time data (frequently changing)
  realTime: {
    staleTime: 1000 * 10,     // 10 seconds
    gcTime: 1000 * 60 * 5,    // 5 minutes
  },
  
  // Standard data (moderately changing)
  standard: {
    staleTime: 1000 * 30,     // 30 seconds
    gcTime: 1000 * 60 * 15,   // 15 minutes
  },
  
  // Static data (rarely changing)
  static: {
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30,   // 30 minutes
  },
}

// Apply to different data types
const useEvents = () => useQuery({
  // Events change moderately
  ...CACHE_CONFIG.standard,
  // ... other config
})

const useProfile = () => useQuery({
  // Profiles change rarely
  ...CACHE_CONFIG.static,
  // ... other config
})
```

### Cache Invalidation Patterns

```typescript
// Centralized cache invalidation mapping
export const CACHE_INVALIDATION_MAP: CacheInvalidationMap = {
  events: {
    create: [
      queryKeys.events.public,
      queryKeys.events.my('*'), // Invalidate all user events
    ],
    update: [
      queryKeys.events.detail('*'), // Invalidate all event details
      queryKeys.events.public,
    ],
    delete: [
      queryKeys.events.public,
      queryKeys.events.my('*'),
      queryKeys.events.detail('*'),
    ],
  },
  
  users: {
    updateProfile: [
      queryKeys.users.profile('*'),
    ],
    updateContacts: [
      queryKeys.users.contacts('*'),
    ],
    register: [
      queryKeys.users.registrations('*'),
      queryKeys.events.detail('*'), // May affect event registration counts
    ],
  },
  
  judges: {
    add: [
      queryKeys.judges.byEvent('*'),
      queryKeys.judges.permissions('*', '*'),
    ],
    remove: [
      queryKeys.judges.byEvent('*'),
      queryKeys.judges.permissions('*', '*'),
    ],
  },
}
```

## Performance Considerations

### Memory Management

```typescript
// Configure garbage collection for optimal memory usage
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 15, // 15 minutes default
      staleTime: 1000 * 30,   // 30 seconds default
    },
  },
})

// Monitor cache size in development
if (import.meta.env.DEV) {
  setInterval(() => {
    const cache = queryClient.getQueryCache()
    console.log(`Vue Query cache size: ${cache.getAll().length} entries`)
  }, 30000) // Log every 30 seconds
}
```

### Network Optimization

```typescript
// Batch related queries when possible
export function useEventDetailData(eventId: string) {
  const event = useEvent(eventId)
  const teams = useTeams(eventId)
  const submissions = useSubmissions(eventId)
  
  // All queries will be batched and cached independently
  return {
    event,
    teams,
    submissions,
    isLoading: computed(() => 
      event.isLoading.value || teams.isLoading.value || submissions.isLoading.value
    ),
  }
}
```

### Image URL Cache Busting

```typescript
// Centralized image URL generation with cache busting
export const generateImageUrl = (path: string, options?: {
  preventCache?: boolean
  timestamp?: number
}): string => {
  if (!path) return ''
  
  const { preventCache = true, timestamp = Date.now() } = options || {}
  
  // For external URLs
  if (path.startsWith('http')) {
    if (preventCache) {
      const separator = path.includes('?') ? '&' : '?'
      return `${path}${separator}t=${timestamp}`
    }
    return path
  }
  
  // For Supabase storage URLs
  const projectUrl = import.meta.env.VITE_SUPABASE_URL || ''
  if (projectUrl && path.includes('/')) {
    const baseUrl = `${projectUrl}/storage/v1/object/public/public-assets/${path}`
    if (preventCache) {
      return `${baseUrl}?t=${timestamp}`
    }
    return baseUrl
  }
  
  return ''
}

// Usage in components
const coverUrl = computed(() => 
  generateImageUrl(props.submission.cover_path, { preventCache: true })
)
```

This design provides a comprehensive migration plan that maintains all existing functionality while modernizing the data management approach with Vue Query's intelligent caching system.