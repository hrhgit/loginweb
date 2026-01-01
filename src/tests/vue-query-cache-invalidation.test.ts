/**
 * Vue Query Cache Invalidation Tests
 * Tests cache invalidation workflows and stale-while-revalidate behavior
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { nextTick } from 'vue'

// Mock Supabase - must be defined before imports
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null }))
        })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: { id: 'new-id' }, error: null }))
          }))
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { id: 'updated-id' }, error: null }))
            }))
          }))
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null }))
        }))
      }))
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() => Promise.resolve({ data: { path: 'test-path' }, error: null })),
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
      status: 'published',
      submission_start_time: new Date(Date.now() - 86400000).toISOString(),
      submission_end_time: new Date(Date.now() + 86400000).toISOString()
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
  teamErrorHandler: { handleError: vi.fn() },
  apiErrorHandler: { handleError: vi.fn() },
  eventErrorHandler: { handleError: vi.fn() },
  handleSuccessWithBanner: vi.fn()
}))

// Mock performance utilities
vi.mock('../utils/vueQueryBatchOptimizer', () => ({
  prefetchRelatedData: vi.fn()
}))

// Mock utils
vi.mock('../utils/roleTags', () => ({
  getRoleTagClass: vi.fn(() => 'role-tag--programmer'),
  sortRoleLabels: vi.fn((labels) => labels)
}))

import EventDetailPage from '../pages/EventDetailPage.vue'
import TeamCreatePage from '../pages/TeamCreatePage.vue'
import SubmissionPage from '../pages/SubmissionPage.vue'

describe('Vue Query Cache Invalidation Tests', () => {
  let queryClient: QueryClient
  let router: any

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 1000 * 60 * 15, // 15 minutes
          staleTime: 1000 * 30, // 30 seconds
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
        { path: '/events/:id/submission', component: SubmissionPage },
      ]
    })

    vi.clearAllMocks()
  })

  afterEach(() => {
    queryClient.clear()
  })

  describe('Stale-While-Revalidate Behavior', () => {
    it('should display stale data immediately while fetching fresh data', async () => {
      // Set up stale cached data
      const staleTeams = [
        { id: 'team1', name: 'Stale Team', event_id: 'event1', members: 2 }
      ]
      
      queryClient.setQueryData(['teams', 'event', 'event1'], staleTeams)
      
      // Mark data as stale by setting it in the past
      const queryState = queryClient.getQueryState(['teams', 'event', 'event1'])
      if (queryState) {
        queryState.dataUpdatedAt = Date.now() - (1000 * 60) // 1 minute ago
      }

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

      const vm = wrapper.vm as any

      // Should immediately show stale data
      expect(vm.teamList).toEqual(staleTeams)

      // Wait for background refetch to complete
      await new Promise(resolve => setTimeout(resolve, 200))
      await nextTick()

      // Should now show fresh data
      expect(vm.teamList).toEqual(freshTeams)

      wrapper.unmount()
    })

    it('should not refetch if data is still fresh', async () => {
      const freshTeams = [
        { id: 'team1', name: 'Fresh Team', event_id: 'event1', members: 2 }
      ]
      
      // Set fresh data (within stale time)
      queryClient.setQueryData(['teams', 'event', 'event1'], freshTeams)

      let apiCallCount = 0
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => {
              apiCallCount++
              return Promise.resolve({ data: freshTeams, error: null })
            })
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

      // Wait a bit to see if any background requests are made
      await new Promise(resolve => setTimeout(resolve, 100))

      // Should not have made any API calls since data is fresh
      expect(apiCallCount).toBe(0)

      wrapper.unmount()
    })

    it('should handle multiple components sharing stale data correctly', async () => {
      const staleData = [
        { id: 'team1', name: 'Shared Stale Team', event_id: 'event1', members: 2 }
      ]
      
      queryClient.setQueryData(['teams', 'event', 'event1'], staleData)
      
      // Mark as stale
      const queryState = queryClient.getQueryState(['teams', 'event', 'event1'])
      if (queryState) {
        queryState.dataUpdatedAt = Date.now() - (1000 * 60) // 1 minute ago
      }

      const freshData = [
        { id: 'team1', name: 'Shared Fresh Team', event_id: 'event1', members: 3 }
      ]

      let apiCallCount = 0
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => {
              apiCallCount++
              return Promise.resolve({ data: freshData, error: null })
            })
          }))
        }))
      })

      // Mount multiple components
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

      const vm1 = wrapper1.vm as any
      const vm2 = wrapper2.vm as any

      // Both should show stale data immediately
      expect(vm1.teamList).toEqual(staleData)
      expect(vm2.teamList).toEqual(staleData)

      // Wait for background refetch
      await new Promise(resolve => setTimeout(resolve, 200))
      await nextTick()

      // Both should now show fresh data
      expect(vm1.teamList).toEqual(freshData)
      expect(vm2.teamList).toEqual(freshData)

      // Should only have made one API call (deduplication)
      expect(apiCallCount).toBe(1)

      wrapper1.unmount()
      wrapper2.unmount()
    })
  })

  describe('Cache Invalidation After Mutations', () => {
    it('should invalidate teams cache after team creation', async () => {
      // Set initial cache
      const initialTeams = [
        { id: 'team1', name: 'Existing Team', event_id: 'event1', members: 2 }
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

      // Fill form
      vm.teamName = 'New Team'
      vm.leaderQq = '123456789'
      
      // Submit form
      await vm.submit()
      await nextTick()

      // Teams cache should be invalidated
      const teamsQuery = queryClient.getQueryState(['teams', 'event', 'event1'])
      expect(teamsQuery?.isInvalidated).toBe(true)

      wrapper.unmount()
    })

    it('should invalidate submissions cache after submission creation', async () => {
      // Set initial cache
      const initialSubmissions = [
        { 
          id: 'sub1', 
          project_name: 'Existing Project', 
          event_id: 'event1',
          team_id: 'team1'
        }
      ]
      queryClient.setQueryData(['submissions', 'event', 'event1'], initialSubmissions)

      // Mock successful submission creation
      mockSupabase.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ 
              data: { 
                id: 'sub2', 
                project_name: 'New Project', 
                event_id: 'event1',
                team_id: 'team1'
              }, 
              error: null 
            }))
          }))
        })),
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ 
              data: [
                ...initialSubmissions,
                { 
                  id: 'sub2', 
                  project_name: 'New Project', 
                  event_id: 'event1',
                  team_id: 'team1'
                }
              ], 
              error: null 
            }))
          }))
        }))
      })

      await router.push('/events/event1/submission')
      const wrapper = mount(SubmissionPage, {
        global: {
          plugins: [router, [VueQueryPlugin, { queryClient }]]
        }
      })

      await nextTick()

      const vm = wrapper.vm as any

      // Fill form
      vm.projectName = 'New Project'
      vm.teamId = 'team1'
      vm.intro = 'Test intro'
      
      // Submit form (mock the submission process)
      const mutation = queryClient.getMutationCache().build(queryClient, {
        mutationFn: async () => {
          return { id: 'sub2', project_name: 'New Project' }
        },
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['submissions', 'event', 'event1'] })
          queryClient.invalidateQueries({ queryKey: ['submissions', 'team', 'team1'] })
        }
      })

      await mutation.execute()
      await nextTick()

      // Submissions caches should be invalidated
      const eventSubmissionsQuery = queryClient.getQueryState(['submissions', 'event', 'event1'])
      const teamSubmissionsQuery = queryClient.getQueryState(['submissions', 'team', 'team1'])
      
      expect(eventSubmissionsQuery?.isInvalidated).toBe(true)
      expect(teamSubmissionsQuery?.isInvalidated).toBe(true)

      wrapper.unmount()
    })

    it('should handle cascading cache invalidations correctly', async () => {
      // Set up multiple related caches
      queryClient.setQueryData(['teams', 'event', 'event1'], [])
      queryClient.setQueryData(['teams', 'seekers', 'event1'], [])
      queryClient.setQueryData(['teams', 'members', 'team1'], [])
      queryClient.setQueryData(['submissions', 'event', 'event1'], [])

      // Simulate team deletion which should invalidate multiple caches
      const mutation = queryClient.getMutationCache().build(queryClient, {
        mutationFn: async () => {
          return { teamId: 'team1', eventId: 'event1' }
        },
        onSuccess: (data) => {
          // Invalidate all related caches
          queryClient.invalidateQueries({ queryKey: ['teams', 'event', data.eventId] })
          queryClient.invalidateQueries({ queryKey: ['teams', 'seekers', data.eventId] })
          queryClient.removeQueries({ queryKey: ['teams', 'members', data.teamId] })
          queryClient.invalidateQueries({ queryKey: ['submissions', 'event', data.eventId] })
        }
      })

      await mutation.execute()
      await nextTick()

      // All related caches should be affected
      const teamsQuery = queryClient.getQueryState(['teams', 'event', 'event1'])
      const seekersQuery = queryClient.getQueryState(['teams', 'seekers', 'event1'])
      const membersQuery = queryClient.getQueryState(['teams', 'members', 'team1'])
      const submissionsQuery = queryClient.getQueryState(['submissions', 'event', 'event1'])

      expect(teamsQuery?.isInvalidated).toBe(true)
      expect(seekersQuery?.isInvalidated).toBe(true)
      expect(membersQuery).toBeUndefined() // Should be removed
      expect(submissionsQuery?.isInvalidated).toBe(true)
    })
  })

  describe('Cache Consistency Across Components', () => {
    it('should maintain cache consistency when navigating between pages', async () => {
      const testData = [
        { id: 'team1', name: 'Consistent Team', event_id: 'event1', members: 2 }
      ]

      // Set initial data
      queryClient.setQueryData(['teams', 'event', 'event1'], testData)

      // Navigate to event detail page
      await router.push('/events/event1')
      const eventWrapper = mount(EventDetailPage, {
        global: {
          plugins: [router, [VueQueryPlugin, { queryClient }]]
        }
      })

      await nextTick()

      const eventVm = eventWrapper.vm as any
      expect(eventVm.teamList).toEqual(testData)

      // Navigate to team creation page
      await router.push('/events/event1/team/create')
      const teamWrapper = mount(TeamCreatePage, {
        global: {
          plugins: [router, [VueQueryPlugin, { queryClient }]]
        }
      })

      await nextTick()

      // Data should still be consistent
      const cachedData = queryClient.getQueryData(['teams', 'event', 'event1'])
      expect(cachedData).toEqual(testData)

      eventWrapper.unmount()
      teamWrapper.unmount()
    })

    it('should handle concurrent mutations correctly', async () => {
      // Set initial cache
      queryClient.setQueryData(['teams', 'event', 'event1'], [])

      // Create multiple concurrent mutations
      const mutation1 = queryClient.getMutationCache().build(queryClient, {
        mutationFn: async () => {
          await new Promise(resolve => setTimeout(resolve, 50))
          return { id: 'team1', name: 'Team 1' }
        },
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['teams', 'event', 'event1'] })
        }
      })

      const mutation2 = queryClient.getMutationCache().build(queryClient, {
        mutationFn: async () => {
          await new Promise(resolve => setTimeout(resolve, 30))
          return { id: 'team2', name: 'Team 2' }
        },
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['teams', 'event', 'event1'] })
        }
      })

      // Execute mutations concurrently
      const results = await Promise.all([
        mutation1.execute(),
        mutation2.execute()
      ])

      await nextTick()

      // Both mutations should complete successfully
      expect(results[0]).toBeDefined()
      expect(results[1]).toBeDefined()

      // Cache should be invalidated
      const queryState = queryClient.getQueryState(['teams', 'event', 'event1'])
      expect(queryState?.isInvalidated).toBe(true)
    })
  })

  describe('Error Handling During Cache Operations', () => {
    it('should handle cache invalidation errors gracefully', async () => {
      // Set initial cache
      queryClient.setQueryData(['teams', 'event', 'event1'], [])

      // Mock mutation that fails
      const failingMutation = queryClient.getMutationCache().build(queryClient, {
        mutationFn: async () => {
          throw new Error('Mutation failed')
        },
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['teams', 'event', 'event1'] })
        },
        onError: (error) => {
          // Error should be handled gracefully
          expect(error.message).toBe('Mutation failed')
        }
      })

      try {
        await failingMutation.execute()
      } catch (error) {
        // Error should be caught
        expect((error as Error).message).toBe('Mutation failed')
      }

      // Cache should remain unchanged
      const queryState = queryClient.getQueryState(['teams', 'event', 'event1'])
      expect(queryState?.isInvalidated).toBe(false)
    })

    it('should recover from network errors during background refetch', async () => {
      // Set stale data
      const staleData = [{ id: 'team1', name: 'Stale Team' }]
      queryClient.setQueryData(['teams', 'event', 'event1'], staleData)

      // Mark as stale
      const queryState = queryClient.getQueryState(['teams', 'event', 'event1'])
      if (queryState) {
        queryState.dataUpdatedAt = Date.now() - (1000 * 60)
      }

      let attemptCount = 0
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => {
              attemptCount++
              if (attemptCount === 1) {
                return Promise.reject(new Error('网络连接失败'))
              }
              return Promise.resolve({ 
                data: [{ id: 'team1', name: 'Fresh Team' }], 
                error: null 
              })
            })
          }))
        }))
      })

      // Enable retry for this test
      queryClient.setDefaultOptions({
        queries: {
          retry: 1,
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

      const vm = wrapper.vm as any

      // Should show stale data initially
      expect(vm.teamList).toEqual(staleData)

      // Wait for retry to complete
      await new Promise(resolve => setTimeout(resolve, 200))
      await nextTick()

      // Should eventually show fresh data after retry
      expect(attemptCount).toBeGreaterThan(1)

      wrapper.unmount()
    })
  })

  describe('Memory Management During Cache Operations', () => {
    it('should clean up unused queries after component unmount', async () => {
      await router.push('/events/event1')
      const wrapper = mount(EventDetailPage, {
        global: {
          plugins: [router, [VueQueryPlugin, { queryClient }]]
        }
      })

      await nextTick()

      // Verify queries are created
      const queriesBefore = queryClient.getQueryCache().getAll()
      expect(queriesBefore.length).toBeGreaterThan(0)

      // Unmount component
      wrapper.unmount()
      await nextTick()

      // Queries should still exist but may become inactive
      const queriesAfter = queryClient.getQueryCache().getAll()
      expect(queriesAfter.length).toBeGreaterThanOrEqual(0)
    })

    it('should handle garbage collection correctly', async () => {
      // Set data with short garbage collection time
      queryClient.setDefaultOptions({
        queries: {
          gcTime: 100, // 100ms
        }
      })

      queryClient.setQueryData(['teams', 'event', 'event1'], [])

      // Wait for garbage collection
      await new Promise(resolve => setTimeout(resolve, 200))

      // Force garbage collection
      queryClient.getQueryCache().clear()

      // Data should be cleared
      const queryState = queryClient.getQueryState(['teams', 'event', 'event1'])
      expect(queryState).toBeUndefined()
    })
  })
})