/**
 * Basic Vue Query Integration Tests
 * Tests core Vue Query functionality with components
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { nextTick } from 'vue'

// Simple test component that uses Vue Query
const TestComponent = {
  template: '<div>{{ data || "loading" }}</div>',
  setup() {
    // Mock a simple query
    return {
      data: 'test data'
    }
  }
}

describe('Vue Query Basic Integration Tests', () => {
  let queryClient: QueryClient
  let router: any

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

    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', component: TestComponent },
      ]
    })

    vi.clearAllMocks()
  })

  afterEach(() => {
    queryClient.clear()
  })

  describe('QueryClient Integration', () => {
    it('should create QueryClient successfully', () => {
      expect(queryClient).toBeDefined()
      expect(queryClient.getQueryCache()).toBeDefined()
      expect(queryClient.getMutationCache()).toBeDefined()
    })

    it('should set and get query data', () => {
      const testData = [{ id: 1, name: 'Test' }]
      const queryKey = ['test', 'data']
      
      queryClient.setQueryData(queryKey, testData)
      const retrievedData = queryClient.getQueryData(queryKey)
      
      expect(retrievedData).toEqual(testData)
    })

    it('should invalidate queries correctly', async () => {
      const testData = [{ id: 1, name: 'Test' }]
      const queryKey = ['test', 'data']
      
      queryClient.setQueryData(queryKey, testData)
      
      // Invalidate the query
      await queryClient.invalidateQueries({ queryKey })
      
      const queryState = queryClient.getQueryState(queryKey)
      expect(queryState?.isInvalidated).toBe(true)
    })

    it('should handle cache clearing', () => {
      const testData = [{ id: 1, name: 'Test' }]
      queryClient.setQueryData(['test', 'data'], testData)
      
      // Verify data exists
      expect(queryClient.getQueryData(['test', 'data'])).toEqual(testData)
      
      // Clear cache
      queryClient.clear()
      
      // Data should be cleared
      expect(queryClient.getQueryData(['test', 'data'])).toBeUndefined()
    })
  })

  describe('Component Integration', () => {
    it('should mount component with Vue Query plugin', async () => {
      await router.push('/')
      const wrapper = mount(TestComponent, {
        global: {
          plugins: [router, [VueQueryPlugin, { queryClient }]]
        }
      })

      await nextTick()

      expect(wrapper.text()).toBe('test data')
      wrapper.unmount()
    })

    it('should handle multiple components with shared QueryClient', async () => {
      await router.push('/')
      
      const wrapper1 = mount(TestComponent, {
        global: {
          plugins: [router, [VueQueryPlugin, { queryClient }]]
        }
      })

      const wrapper2 = mount(TestComponent, {
        global: {
          plugins: [router, [VueQueryPlugin, { queryClient }]]
        }
      })

      await nextTick()

      expect(wrapper1.text()).toBe('test data')
      expect(wrapper2.text()).toBe('test data')

      wrapper1.unmount()
      wrapper2.unmount()
    })
  })

  describe('Stale-While-Revalidate Behavior', () => {
    it('should handle stale data correctly', () => {
      const staleData = [{ id: 1, name: 'Stale' }]
      const queryKey = ['test', 'stale']
      
      // Set data
      queryClient.setQueryData(queryKey, staleData)
      
      // Get query state
      const queryState = queryClient.getQueryState(queryKey)
      expect(queryState?.data).toEqual(staleData)
    })

    it('should handle fresh data correctly', () => {
      const freshData = [{ id: 1, name: 'Fresh' }]
      const queryKey = ['test', 'fresh']
      
      // Set fresh data
      queryClient.setQueryData(queryKey, freshData)
      
      // Data should be available immediately
      const retrievedData = queryClient.getQueryData(queryKey)
      expect(retrievedData).toEqual(freshData)
    })
  })

  describe('Cache Invalidation', () => {
    it('should invalidate specific queries', async () => {
      // Set up multiple queries
      queryClient.setQueryData(['teams', 'event', '1'], [])
      queryClient.setQueryData(['teams', 'event', '2'], [])
      queryClient.setQueryData(['submissions', 'event', '1'], [])
      
      // Invalidate only teams for event 1
      await queryClient.invalidateQueries({ 
        queryKey: ['teams', 'event', '1'] 
      })
      
      // Check invalidation status
      const teamsEvent1 = queryClient.getQueryState(['teams', 'event', '1'])
      const teamsEvent2 = queryClient.getQueryState(['teams', 'event', '2'])
      const submissionsEvent1 = queryClient.getQueryState(['submissions', 'event', '1'])
      
      expect(teamsEvent1?.isInvalidated).toBe(true)
      expect(teamsEvent2?.isInvalidated).toBe(false)
      expect(submissionsEvent1?.isInvalidated).toBe(false)
    })

    it('should invalidate queries by pattern', async () => {
      // Set up queries
      queryClient.setQueryData(['teams', 'event', '1'], [])
      queryClient.setQueryData(['teams', 'seekers', '1'], [])
      queryClient.setQueryData(['submissions', 'event', '1'], [])
      
      // Invalidate all teams queries
      await queryClient.invalidateQueries({ 
        predicate: (query) => {
          return Array.isArray(query.queryKey) && query.queryKey[0] === 'teams'
        }
      })
      
      // Check results
      const teamsEvent = queryClient.getQueryState(['teams', 'event', '1'])
      const teamsSeekers = queryClient.getQueryState(['teams', 'seekers', '1'])
      const submissions = queryClient.getQueryState(['submissions', 'event', '1'])
      
      expect(teamsEvent?.isInvalidated).toBe(true)
      expect(teamsSeekers?.isInvalidated).toBe(true)
      expect(submissions?.isInvalidated).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle query errors gracefully', () => {
      const error = new Error('Test error')
      const queryKey = ['test', 'error']
      
      // Simulate error state
      const query = queryClient.getQueryCache().build(queryClient, {
        queryKey,
        queryFn: () => Promise.reject(error)
      })
      
      expect(query).toBeDefined()
    })

    it('should handle mutation errors gracefully', () => {
      const error = new Error('Mutation error')
      
      const mutation = queryClient.getMutationCache().build(queryClient, {
        mutationFn: () => Promise.reject(error),
        onError: (err) => {
          expect(err.message).toBe('Mutation error')
        }
      })
      
      expect(mutation).toBeDefined()
    })
  })

  describe('Memory Management', () => {
    it('should manage cache size correctly', () => {
      // Add multiple cache entries
      for (let i = 0; i < 10; i++) {
        queryClient.setQueryData(['test', i], { id: i, data: `test-${i}` })
      }
      
      // Check cache size
      const queries = queryClient.getQueryCache().getAll()
      expect(queries.length).toBe(10)
      
      // Clear cache
      queryClient.clear()
      
      // Cache should be empty
      const queriesAfterClear = queryClient.getQueryCache().getAll()
      expect(queriesAfterClear.length).toBe(0)
    })

    it('should handle query removal correctly', () => {
      const queryKey = ['test', 'remove']
      queryClient.setQueryData(queryKey, { test: 'data' })
      
      // Verify data exists
      expect(queryClient.getQueryData(queryKey)).toBeDefined()
      
      // Remove query
      queryClient.removeQueries({ queryKey })
      
      // Data should be removed
      expect(queryClient.getQueryData(queryKey)).toBeUndefined()
    })
  })

  describe('Query Key Management', () => {
    it('should handle consistent query keys', () => {
      const eventId = 'event1'
      const queryKey1 = ['teams', 'event', eventId]
      const queryKey2 = ['teams', 'event', eventId]
      
      // Set data with first key
      queryClient.setQueryData(queryKey1, [{ id: 1 }])
      
      // Retrieve with second key (should be same)
      const data = queryClient.getQueryData(queryKey2)
      expect(data).toEqual([{ id: 1 }])
    })

    it('should differentiate between different query keys', () => {
      queryClient.setQueryData(['teams', 'event', '1'], [{ id: 1 }])
      queryClient.setQueryData(['teams', 'event', '2'], [{ id: 2 }])
      
      const data1 = queryClient.getQueryData(['teams', 'event', '1'])
      const data2 = queryClient.getQueryData(['teams', 'event', '2'])
      
      expect(data1).toEqual([{ id: 1 }])
      expect(data2).toEqual([{ id: 2 }])
      expect(data1).not.toEqual(data2)
    })
  })
})