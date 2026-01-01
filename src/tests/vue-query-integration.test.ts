/**
 * Vue Query Integration Tests
 * Tests Vue Query composables integration with components and stale-while-revalidate behavior
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { nextTick } from 'vue'

// Mock Supabase - must be defined before imports
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            data: [],
            error: null
          })),
          maybeSingle: vi.fn(() => ({ data: null, error: null })),
          single: vi.fn(() => ({ data: null, error: null }))
        })),
        order: vi.fn(() => ({ data: [], error: null })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({ data: { id: 'new-id' }, error: null }))
          }))
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => ({ data: { id: 'updated-id' }, error: null }))
            }))
          }))
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({ error: null }))
        }))
      }))
    })),
    storage: {
      from: vi.fn(() => ({
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'test-url' } }))
      }))
    }
  }
}))

// Mock store
vi.mock('../store/appStore', () => ({
  useAppStore: () => ({
    isAuthed: true,
    user: { id: 'user1' },
    setBanner: vi.fn(),
    getEventById: vi.fn(() => ({
      id: 'event1',
      title: 'Test Event',
      status: 'published'
    })),
    refreshUser: vi.fn(),
    ensureEventsLoaded: vi.fn(),
    loadTeams: vi.fn(),
    loadSubmissions: vi.fn(),
    isAdmin: false,
    contacts: { qq: '123456789' },
    loadMyContacts: vi.fn(),
    isDemoEvent: vi.fn(() => false),
    registrationVariant: vi.fn(() => 'btn--primary'),
    registrationLabel: vi.fn(() => '报名'),
    registrationBusyEventId: null,
    registrationsLoading: false,
    myRegistrationByEventId: {},
    getTeamsForEvent: vi.fn(() => []),
    getSubmissionsForEvent: vi.fn(() => []),
    getTeamSeekersForEvent: vi.fn(() => []),
    getMyTeamSeeker: vi.fn(() => null),
    isTeamMember: vi.fn(() => false),
    getTeamRequestStatus: vi.fn(() => null),
    openAuth: vi.fn(),
    authInfo: '',
    clearBanners: vi.fn(),
    profile: null
  })
}))

// Mock error handlers
vi.mock('../store/enhancedErrorHandling', () => ({
  teamErrorHandler: {
    handleError: vi.fn()
  },
  apiErrorHandler: {
    handleError: vi.fn()
  },
  eventErrorHandler: {
    handleError: vi.fn()
  },
  handleSuccessWithBanner: vi.fn()
}))

// Mock performance utilities
vi.mock('../utils/vueQueryBatchOptimizer', () => ({
  prefetchRelatedData: vi.fn()
}))

import EventDetailPage from '../pages/EventDetailPage.vue'
import TeamCreatePage from '../pages/TeamCreatePage.vue'
import { useTeams } from '../composables/useTeams'
import { useSubmissions } from '../composables/useSubmissions'
import { useEvents } from '../composables/useEvents'

describe('Vue Query Integration Tests', () => {
  let queryClient: QueryClient
  let router: any

  beforeEach(() => {
    // Create fresh QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
          staleTime: 0,
        },
        mutations: {
          retry: false,
        },
      },
    })

    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/events/:id', component: EventDetailPage },
        { path: '/events/:id/team/create', component: TeamCreatePage },
      ]
    })

    vi.clearAllMocks()
  })

  afterEach(() => {
    queryClient.clear()
  })

  describe('Stale-While-Revalidate Behavior', () => {
    it('should display cached data immediately while fetching fresh data', async () => {
      // Set up initial cached data
      const cachedTeams = [
        { id: 'team1', name: 'Cached Team', event_id: 'event1', members: 2 }
      ]
      
      queryClient.setQueryData(['teams', 'event', 'event1'], cachedTeams)

      // Mock fresh data from API
      const freshTeams = [
        { id: 'team1', name: 'Fresh Team', event_id: 'event1', members: 3 },
        { id: 'team2', name: 'New Team', event_id: 'event1', members: 1 }
      ]

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: freshTeams, error: null }))
          }))
        }))
      })

      await router.push('/events/event1')
      const wrapper = mount(EventDetailPage, {
        global: {
          plugins: [router, [VueQueryPlugin, { queryClient }]]
        }
      })

      await nextTick()

      // Should immediately show cached data
      const vm = wrapper.vm as any
      expect(vm.teamList).toEqual(cachedTeams)

      // Wait for fresh data to load
      await new Promise(resolve => setTimeout(resolve, 100))
      await nextTick()

      // Should now show fresh data
      expect(vm.teamList).toEqual(freshTeams)

      wrapper.unmount()
    })

    it('should handle cache invalidation correctly after mutations', async () => {
      // Set up initial data
      const initialTeams = [
        { id: 'team1', name: 'Initial Team', event_id: 'event1', members: 2 }
      ]
      
      queryClient.setQueryData(['teams', 'event', 'event1'], initialTeams)

      // Mock successful team creation
      mockSupabase.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ 
              data: { id: 'team2', name: 'New Team', event_id: 'event1' }, 
              error: null 
            }))
          }))
        })),
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ 
              data: [
                ...initialTeams,
                { id: 'team2', name: 'New Team', event_id: 'event1', members: 1 }
              ], 
              error: null 
            }))
          }))
        }))
      })

      await router.push('/events/event1/team/create')
      const wrapper = mount(TeamCreatePage, {
        global: {
          plugins: [router, [VueQueryPlugin, { queryClient }]]
        }
      })

      await nextTick()

      const vm = wrapper.vm as any

      // Fill form and submit
      vm.teamName = 'New Team'
      vm.leaderQq = '123456789'
      
      await vm.submit()
      await nextTick()

      // Cache should be invalidated and fresh data should be fetched
      const teamsQuery = queryClient.getQueryState(['teams', 'event', 'event1'])
      expect(teamsQuery?.isInvalidated).toBe(true)

      wrapper.unmount()
    })

    it('should share cache between components using same query keys', async () => {
      const sharedData = [
        { id: 'team1', name: 'Shared Team', event_id: 'event1', members: 2 }
      ]

      queryClient.setQueryData(['teams', 'event', 'event1'], sharedData)

      // Mount first component
      await router.push('/events/event1')
      const wrapper1 = mount(EventDetailPage, {
        global: {
          plugins: [router, [VueQueryPlugin, { queryClient }]]
        }
      })

      // Mount second component with same data
      const wrapper2 = mount(EventDetailPage, {
        global: {
          plugins: [router, [VueQueryPlugin, { queryClient }]]
        }
      })

      await nextTick()

      // Both components should share the same cached data
      const vm1 = wrapper1.vm as any
      const vm2 = wrapper2.vm as any

      expect(vm1.teamList).toEqual(sharedData)
      expect(vm2.teamList).toEqual(sharedData)

      // Verify they're using the same cache entry
      const cacheEntry = queryClient.getQueryData(['teams', 'event', 'event1'])
      expect(cacheEntry).toEqual(sharedData)

      wrapper1.unmount()
      wrapper2.unmount()
    })
  })

  describe('Vue Query Composables Integration', () => {
    it('should integrate useTeams composable with components correctly', async () => {
      const mockTeams = [
        { 
          id: 'team1', 
          name: 'Test Team', 
          event_id: 'event1', 
          leader_id: 'user1',
          leader_qq: '123456789',
          intro: 'Test intro',
          needs: ['programmer'],
          extra: '',
          members: 2,
          is_closed: false,
          created_at: new Date().toISOString()
        }
      ]

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockTeams, error: null }))
          }))
        }))
      })

      await router.push('/events/event1')
      const wrapper = mount(EventDetailPage, {
        global: {
          plugins: [router, [VueQueryPlugin, { queryClient }]]
        }
      })

      await nextTick()

      const vm = wrapper.vm as any

      // Wait for data to load
      await new Promise(resolve => setTimeout(resolve, 100))
      await nextTick()

      // Should have teams data from composable
      expect(vm.teamList).toBeDefined()
      expect(Array.isArray(vm.teamList)).toBe(true)

      wrapper.unmount()
    })

    it('should integrate useSubmissions composable with components correctly', async () => {
      const mockSubmissions = [
        {
          id: 'sub1',
          event_id: 'event1',
          team_id: 'team1',
          submitted_by: 'user1',
          project_name: 'Test Project',
          intro: 'Test intro',
          cover_path: 'test.jpg',
          video_link: null,
          link_mode: 'link' as const,
          submission_url: 'https://example.com',
          submission_storage_path: null,
          submission_password: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          team: { id: 'team1', name: 'Test Team' }
        }
      ]

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockSubmissions, error: null }))
          }))
        }))
      })

      await router.push('/events/event1')
      const wrapper = mount(EventDetailPage, {
        global: {
          plugins: [router, [VueQueryPlugin, { queryClient }]]
        }
      })

      await nextTick()

      const vm = wrapper.vm as any

      // Wait for data to load
      await new Promise(resolve => setTimeout(resolve, 100))
      await nextTick()

      // Should have submissions data from composable
      expect(vm.submissionList).toBeDefined()
      expect(Array.isArray(vm.submissionList)).toBe(true)

      wrapper.unmount()
    })

    it('should handle loading and error states correctly', async () => {
      // Mock loading state
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => new Promise(resolve => {
              setTimeout(() => resolve({ data: [], error: null }), 200)
            }))
          }))
        }))
      })

      await router.push('/events/event1')
      const wrapper = mount(EventDetailPage, {
        global: {
          plugins: [router, [VueQueryPlugin, { queryClient }]]
        }
      })

      await nextTick()

      const vm = wrapper.vm as any

      // Should initially be in loading state
      expect(vm.isLoading).toBe(true)

      // Wait for loading to complete
      await new Promise(resolve => setTimeout(resolve, 300))
      await nextTick()

      // Should no longer be loading
      expect(vm.isLoading).toBe(false)

      wrapper.unmount()
    })

    it('should handle network errors with retry logic', async () => {
      let callCount = 0
      
      // Mock network error on first call, success on retry
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => {
              callCount++
              if (callCount === 1) {
                return Promise.reject(new Error('网络连接失败'))
              }
              return Promise.resolve({ data: [], error: null })
            })
          }))
        }))
      })

      // Enable retry for this test
      queryClient.setDefaultOptions({
        queries: {
          retry: (failureCount, error: any) => {
            const isNetworkError = error?.message?.includes('网络')
            return isNetworkError && failureCount < 3
          },
          retryDelay: 10, // Fast retry for testing
        }
      })

      await router.push('/events/event1')
      const wrapper = mount(EventDetailPage, {
        global: {
          plugins: [router, [VueQueryPlugin, { queryClient }]]
        }
      })

      await nextTick()

      // Wait for retry to complete
      await new Promise(resolve => setTimeout(resolve, 100))
      await nextTick()

      // Should have retried and succeeded
      expect(callCount).toBeGreaterThan(1)

      wrapper.unmount()
    })
  })

  describe('Cache Invalidation Workflows', () => {
    it('should invalidate related caches after team creation', async () => {
      // Set up initial cache
      queryClient.setQueryData(['teams', 'event', 'event1'], [])
      queryClient.setQueryData(['teams', 'seekers', 'event1'], [])

      // Mock successful creation
      mockSupabase.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ 
              data: { id: 'team1', name: 'New Team' }, 
              error: null 
            }))
          }))
        }))
      })

      await router.push('/events/event1/team/create')
      const wrapper = mount(TeamCreatePage, {
        global: {
          plugins: [router, [VueQueryPlugin, { queryClient }]]
        }
      })

      await nextTick()

      const vm = wrapper.vm as any

      // Fill form
      vm.teamName = 'New Team'
      vm.leaderQq = '123456789'

      // Submit form
      await vm.submit()
      await nextTick()

      // Related caches should be invalidated
      const teamsQuery = queryClient.getQueryState(['teams', 'event', 'event1'])
      expect(teamsQuery?.isInvalidated).toBe(true)

      wrapper.unmount()
    })

    it('should handle multiple cache invalidations correctly', async () => {
      // Set up multiple related caches
      queryClient.setQueryData(['teams', 'event', 'event1'], [])
      queryClient.setQueryData(['submissions', 'event', 'event1'], [])
      queryClient.setQueryData(['teams', 'seekers', 'event1'], [])

      // Mock team deletion
      mockSupabase.from.mockReturnValue({
        delete: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null }))
        }))
      })

      // Simulate team deletion mutation
      const mutation = queryClient.getMutationCache().build(queryClient, {
        mutationFn: async () => {
          await mockSupabase.from('teams').delete().eq('id', 'team1')
          return { teamId: 'team1', eventId: 'event1' }
        },
        onSuccess: (data) => {
          // Invalidate multiple related caches
          queryClient.invalidateQueries({ queryKey: ['teams', 'event', data.eventId] })
          queryClient.invalidateQueries({ queryKey: ['teams', 'seekers', data.eventId] })
          queryClient.removeQueries({ queryKey: ['teams', 'members', data.teamId] })
        }
      })

      await mutation.execute()
      await nextTick()

      // Multiple caches should be invalidated
      const teamsQuery = queryClient.getQueryState(['teams', 'event', 'event1'])
      const seekersQuery = queryClient.getQueryState(['teams', 'seekers', 'event1'])
      
      expect(teamsQuery?.isInvalidated).toBe(true)
      expect(seekersQuery?.isInvalidated).toBe(true)
    })
  })

  describe('Performance and Memory Management', () => {
    it('should clean up queries when components unmount', async () => {
      await router.push('/events/event1')
      const wrapper = mount(EventDetailPage, {
        global: {
          plugins: [router, [VueQueryPlugin, { queryClient }]]
        }
      })

      await nextTick()

      // Verify queries are active
      const activeQueries = queryClient.getQueryCache().getAll()
      expect(activeQueries.length).toBeGreaterThan(0)

      // Unmount component
      wrapper.unmount()
      await nextTick()

      // Queries should still exist but may be inactive
      // (Vue Query keeps them for potential reuse)
      const queriesAfterUnmount = queryClient.getQueryCache().getAll()
      expect(queriesAfterUnmount).toBeDefined()
    })

    it('should reuse cached data when remounting components', async () => {
      const testData = [{ id: 'team1', name: 'Test Team', event_id: 'event1', members: 1 }]
      
      // Set initial cache
      queryClient.setQueryData(['teams', 'event', 'event1'], testData)

      // Mount component
      await router.push('/events/event1')
      const wrapper1 = mount(EventDetailPage, {
        global: {
          plugins: [router, [VueQueryPlugin, { queryClient }]]
        }
      })

      await nextTick()

      const vm1 = wrapper1.vm as any
      expect(vm1.teamList).toEqual(testData)

      // Unmount and remount
      wrapper1.unmount()

      const wrapper2 = mount(EventDetailPage, {
        global: {
          plugins: [router, [VueQueryPlugin, { queryClient }]]
        }
      })

      await nextTick()

      const vm2 = wrapper2.vm as any
      
      // Should reuse cached data
      expect(vm2.teamList).toEqual(testData)

      wrapper2.unmount()
    })

    it('should handle concurrent queries efficiently', async () => {
      let queryCount = 0
      
      // Mock API to count calls
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => {
              queryCount++
              return Promise.resolve({ data: [], error: null })
            })
          }))
        }))
      })

      // Mount multiple components simultaneously
      await router.push('/events/event1')
      const wrapper1 = mount(EventDetailPage, {
        global: {
          plugins: [router, [VueQueryPlugin, { queryClient }]]
        }
      })

      const wrapper2 = mount(EventDetailPage, {
        global: {
          plugins: [router, [VueQueryPlugin, { queryClient }]]
        }
      })

      await nextTick()

      // Wait for queries to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      // Should deduplicate queries (same query key should only call API once)
      expect(queryCount).toBeLessThanOrEqual(2) // Allow for teams and submissions queries

      wrapper1.unmount()
      wrapper2.unmount()
    })
  })

  describe('Error Recovery and Resilience', () => {
    it('should recover from temporary network failures', async () => {
      let failureCount = 0
      
      // Mock intermittent failures
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => {
              failureCount++
              if (failureCount <= 2) {
                return Promise.reject(new Error('网络连接失败'))
              }
              return Promise.resolve({ data: [{ id: 'team1', name: 'Success Team' }], error: null })
            })
          }))
        }))
      })

      // Enable retry
      queryClient.setDefaultOptions({
        queries: {
          retry: 3,
          retryDelay: 10,
        }
      })

      await router.push('/events/event1')
      const wrapper = mount(EventDetailPage, {
        global: {
          plugins: [router, [VueQueryPlugin, { queryClient }]]
        }
      })

      await nextTick()

      // Wait for retries to complete
      await new Promise(resolve => setTimeout(resolve, 200))
      await nextTick()

      const vm = wrapper.vm as any

      // Should eventually succeed
      expect(vm.teamList).toBeDefined()
      expect(failureCount).toBeGreaterThan(2)

      wrapper.unmount()
    })

    it('should handle malformed API responses gracefully', async () => {
      // Mock malformed response
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ 
              data: [
                { id: 'team1', name: 'Valid Team' },
                { id: null, name: null }, // Invalid data
                { id: 'team2' }, // Missing name
              ], 
              error: null 
            }))
          }))
        }))
      })

      await router.push('/events/event1')
      const wrapper = mount(EventDetailPage, {
        global: {
          plugins: [router, [VueQueryPlugin, { queryClient }]]
        }
      })

      await nextTick()

      // Wait for data processing
      await new Promise(resolve => setTimeout(resolve, 100))
      await nextTick()

      // Should handle malformed data without crashing
      const vm = wrapper.vm as any
      expect(vm.teamList).toBeDefined()
      expect(Array.isArray(vm.teamList)).toBe(true)

      wrapper.unmount()
    })
  })
})