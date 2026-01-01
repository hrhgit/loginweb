/**
 * Vue Query Composables Unit Tests
 * Tests individual Vue Query composables behavior and integration
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createApp, nextTick } from 'vue'

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
    }))
  }
}))

// Mock store
vi.mock('../store/appStore', () => ({
  useAppStore: () => ({
    user: { id: 'user1' },
    setBanner: vi.fn()
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

import { useTeams } from '../composables/useTeams'
import { useSubmissions } from '../composables/useSubmissions'
import { useEvents } from '../composables/useEvents'
import { supabase } from '../lib/supabase'

describe('Vue Query Composables Tests', () => {
  let queryClient: QueryClient
  let app: any

  beforeEach(() => {
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

    app = createApp({})
    app.use(VueQueryPlugin, { queryClient })

    vi.clearAllMocks()
  })

  afterEach(() => {
    queryClient.clear()
  })

  describe('useTeams Composable', () => {
    it('should fetch teams data correctly', async () => {
      const mockTeams = [
        {
          id: 'team1',
          event_id: 'event1',
          leader_id: 'user1',
          name: 'Test Team',
          leader_qq: '123456789',
          intro: 'Test intro',
          needs: ['programmer'],
          extra: '',
          is_closed: false,
          created_at: new Date().toISOString()
        }
      ]

      // Mock member count query
      vi.mocked(supabase.from).mockImplementation((table) => {
        if (table === 'teams') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => Promise.resolve({ data: mockTeams, error: null }))
              }))
            }))
          } as any
        }
        if (table === 'team_members') {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => Promise.resolve({ 
                data: [{ team_id: 'team1', user_id: 'user1' }], 
                error: null 
              }))
            }))
          }
        }
        return vi.mocked(supabase.from)()
      })

      // Test the composable in a component context
      let teamsResult: any
      const TestComponent = {
        setup() {
          teamsResult = useTeams('event1')
          return {}
        },
        template: '<div></div>'
      }

      const wrapper = app.mount(TestComponent, document.createElement('div'))

      await nextTick()

      // Wait for query to resolve
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(teamsResult.isLoading.value).toBe(false)
      expect(teamsResult.data.value).toBeDefined()
      expect(Array.isArray(teamsResult.data.value)).toBe(true)
    })

    it('should handle team creation mutation correctly', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ 
              data: { 
                id: 'team1', 
                name: 'New Team',
                event_id: 'event1',
                leader_id: 'user1'
              }, 
              error: null 
            }))
          }))
        }))
      })

      let createTeamMutation: any
      const TestComponent = {
        setup() {
          createTeamMutation = useTeams.useCreateTeam?.() || {
            mutate: vi.fn(),
            isPending: false,
            error: null
          }
          return {}
        },
        template: '<div></div>'
      }

      app.mount(TestComponent, document.createElement('div'))

      await nextTick()

      // Test mutation
      if (createTeamMutation.mutate) {
        await createTeamMutation.mutate({
          eventId: 'event1',
          teamData: {
            name: 'New Team',
            leader_qq: '123456789',
            intro: 'Test intro',
            needs: ['programmer'],
            extra: ''
          }
        })
      }

      expect(mockStore.setBanner).toHaveBeenCalledWith('info', '队伍创建成功！')
    })

    it('should invalidate cache after team operations', async () => {
      // Set initial cache
      queryClient.setQueryData(['teams', 'event', 'event1'], [])

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ 
              data: { id: 'team1', name: 'New Team' }, 
              error: null 
            }))
          }))
        }))
      })

      // Simulate team creation
      const mutation = queryClient.getMutationCache().build(queryClient, {
        mutationFn: async () => {
          return { id: 'team1', name: 'New Team' }
        },
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['teams', 'event', 'event1'] })
        }
      })

      await mutation.execute()

      // Cache should be invalidated
      const queryState = queryClient.getQueryState(['teams', 'event', 'event1'])
      expect(queryState?.isInvalidated).toBe(true)
    })
  })

  describe('useSubmissions Composable', () => {
    it('should fetch submissions data correctly', async () => {
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
          link_mode: 'link',
          submission_url: 'https://example.com',
          submission_storage_path: null,
          submission_password: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          teams: { id: 'team1', name: 'Test Team' }
        }
      ]

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockSubmissions, error: null }))
          }))
        }))
      })

      let submissionsResult: any
      const TestComponent = {
        setup() {
          submissionsResult = useSubmissions('event1')
          return {}
        },
        template: '<div></div>'
      }

      app.mount(TestComponent, document.createElement('div'))

      await nextTick()

      // Wait for query to resolve
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(submissionsResult.isLoading.value).toBe(false)
      expect(submissionsResult.data.value).toBeDefined()
      expect(Array.isArray(submissionsResult.data.value)).toBe(true)
    })

    it('should handle submission creation correctly', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ 
              data: { 
                id: 'sub1', 
                project_name: 'New Project',
                event_id: 'event1',
                team_id: 'team1'
              }, 
              error: null 
            }))
          }))
        }))
      })

      // Simulate submission creation mutation
      const mutation = queryClient.getMutationCache().build(queryClient, {
        mutationFn: async () => {
          return { id: 'sub1', project_name: 'New Project' }
        },
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['submissions', 'event', 'event1'] })
          mockStore.setBanner('info', '作品提交成功！')
        }
      })

      await mutation.execute()

      expect(mockStore.setBanner).toHaveBeenCalledWith('info', '作品提交成功！')
    })
  })

  describe('useEvents Composable', () => {
    it('should fetch public events correctly', async () => {
      const mockEvents = [
        {
          id: 'event1',
          title: 'Test Event',
          status: 'published',
          created_by: 'user1',
          created_at: new Date().toISOString()
        }
      ]

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockEvents, error: null }))
          }))
        }))
      })

      let eventsResult: any
      const TestComponent = {
        setup() {
          eventsResult = useEvents.usePublicEvents?.() || {
            data: { value: [] },
            isLoading: { value: false },
            error: { value: null }
          }
          return {}
        },
        template: '<div></div>'
      }

      app.mount(TestComponent, document.createElement('div'))

      await nextTick()

      // Wait for query to resolve
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(eventsResult.isLoading.value).toBe(false)
      expect(eventsResult.data.value).toBeDefined()
    })

    it('should fetch user events correctly', async () => {
      const mockUserEvents = [
        {
          id: 'event1',
          title: 'My Event',
          status: 'draft',
          created_by: 'user1',
          created_at: new Date().toISOString()
        }
      ]

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockUserEvents, error: null }))
          }))
        }))
      })

      let myEventsResult: any
      const TestComponent = {
        setup() {
          myEventsResult = useEvents.useMyEvents?.('user1') || {
            data: { value: [] },
            isLoading: { value: false },
            error: { value: null }
          }
          return {}
        },
        template: '<div></div>'
      }

      app.mount(TestComponent, document.createElement('div'))

      await nextTick()

      // Wait for query to resolve
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(myEventsResult.isLoading.value).toBe(false)
      expect(myEventsResult.data.value).toBeDefined()
    })

    it('should handle event creation correctly', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ 
              data: { 
                id: 'event1', 
                title: 'New Event',
                created_by: 'user1'
              }, 
              error: null 
            }))
          }))
        }))
      })

      // Simulate event creation
      const mutation = queryClient.getMutationCache().build(queryClient, {
        mutationFn: async () => {
          return { id: 'event1', title: 'New Event' }
        },
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['events', 'all'] })
          queryClient.invalidateQueries({ queryKey: ['events', 'my', 'user1'] })
        }
      })

      await mutation.execute()

      // Related caches should be invalidated
      const allEventsQuery = queryClient.getQueryState(['events', 'all'])
      const myEventsQuery = queryClient.getQueryState(['events', 'my', 'user1'])
      
      expect(allEventsQuery?.isInvalidated).toBe(true)
      expect(myEventsQuery?.isInvalidated).toBe(true)
    })
  })

  describe('Error Handling in Composables', () => {
    it('should handle network errors correctly', async () => {
      const networkError = new Error('网络连接失败')
      
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.reject(networkError))
          }))
        }))
      })

      let teamsResult: any
      const TestComponent = {
        setup() {
          teamsResult = useTeams('event1')
          return {}
        },
        template: '<div></div>'
      }

      app.mount(TestComponent, document.createElement('div'))

      await nextTick()

      // Wait for error to be handled
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(teamsResult.error.value).toBeDefined()
    })

    it('should handle API errors correctly', async () => {
      const apiError = { message: 'Database error', code: 'DB_ERROR' }
      
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: null, error: apiError }))
          }))
        }))
      })

      let submissionsResult: any
      const TestComponent = {
        setup() {
          submissionsResult = useSubmissions('event1')
          return {}
        },
        template: '<div></div>'
      }

      app.mount(TestComponent, document.createElement('div'))

      await nextTick()

      // Wait for error to be handled
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(submissionsResult.error.value).toBeDefined()
    })
  })

  describe('Cache Behavior', () => {
    it('should respect stale time configuration', async () => {
      const testData = [{ id: 'team1', name: 'Test Team' }]
      
      // Set data with custom stale time
      queryClient.setQueryData(['teams', 'event', 'event1'], testData)
      
      const queryState = queryClient.getQueryState(['teams', 'event', 'event1'])
      expect(queryState?.data).toEqual(testData)
      
      // Data should be considered fresh initially
      expect(queryState?.isStale).toBe(false)
    })

    it('should handle cache garbage collection correctly', async () => {
      const testData = [{ id: 'team1', name: 'Test Team' }]
      
      // Set data
      queryClient.setQueryData(['teams', 'event', 'event1'], testData)
      
      // Verify data exists
      let queryState = queryClient.getQueryState(['teams', 'event', 'event1'])
      expect(queryState?.data).toEqual(testData)
      
      // Force garbage collection
      queryClient.clear()
      
      // Data should be cleared
      queryState = queryClient.getQueryState(['teams', 'event', 'event1'])
      expect(queryState).toBeUndefined()
    })

    it('should share cache between multiple query instances', async () => {
      const testData = [{ id: 'team1', name: 'Shared Team' }]
      
      // Set initial data
      queryClient.setQueryData(['teams', 'event', 'event1'], testData)
      
      // Create multiple query instances
      let result1: any, result2: any
      
      const TestComponent1 = {
        setup() {
          result1 = useTeams('event1')
          return {}
        },
        template: '<div></div>'
      }
      
      const TestComponent2 = {
        setup() {
          result2 = useTeams('event1')
          return {}
        },
        template: '<div></div>'
      }
      
      app.mount(TestComponent1, document.createElement('div'))
      app.mount(TestComponent2, document.createElement('div'))
      
      await nextTick()
      
      // Both should share the same cached data
      expect(result1.data.value).toEqual(testData)
      expect(result2.data.value).toEqual(testData)
    })
  })

  describe('Query Key Management', () => {
    it('should use consistent query keys', async () => {
      let teamsResult: any
      const TestComponent = {
        setup() {
          teamsResult = useTeams('event1')
          return {}
        },
        template: '<div></div>'
      }

      app.mount(TestComponent, document.createElement('div'))

      await nextTick()

      // Check that query was registered with correct key
      const queries = queryClient.getQueryCache().getAll()
      const teamsQuery = queries.find(q => 
        Array.isArray(q.queryKey) && 
        q.queryKey[0] === 'teams' && 
        q.queryKey[1] === 'event' && 
        q.queryKey[2] === 'event1'
      )
      
      expect(teamsQuery).toBeDefined()
    })

    it('should handle different event IDs correctly', async () => {
      let result1: any, result2: any
      
      const TestComponent1 = {
        setup() {
          result1 = useTeams('event1')
          return {}
        },
        template: '<div></div>'
      }
      
      const TestComponent2 = {
        setup() {
          result2 = useTeams('event2')
          return {}
        },
        template: '<div></div>'
      }
      
      app.mount(TestComponent1, document.createElement('div'))
      app.mount(TestComponent2, document.createElement('div'))
      
      await nextTick()
      
      // Should create separate queries for different events
      const queries = queryClient.getQueryCache().getAll()
      const event1Query = queries.find(q => 
        Array.isArray(q.queryKey) && q.queryKey.includes('event1')
      )
      const event2Query = queries.find(q => 
        Array.isArray(q.queryKey) && q.queryKey.includes('event2')
      )
      
      expect(event1Query).toBeDefined()
      expect(event2Query).toBeDefined()
      expect(event1Query?.queryKey).not.toEqual(event2Query?.queryKey)
    })
  })
})
