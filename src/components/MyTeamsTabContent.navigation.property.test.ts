import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import fc from 'fast-check'
import MyTeamsTabContent from './MyTeamsTabContent.vue'
import { useAppStore } from '../store/appStore'

// **Feature: team-management-integration, Property 9: 导航功能正确性**
// **Validates: Requirements 4.2**

// Mock the store
vi.mock('../store/appStore', () => ({
  useAppStore: vi.fn()
}))

// Mock router
const mockRouter = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: { template: '<div>Home</div>' } },
    { path: '/events/:eventId/team/:teamId', name: 'team-detail', component: { template: '<div>Team Detail</div>' } },
    { path: '/events/:eventId/team/:teamId/edit', name: 'team-edit', component: { template: '<div>Team Edit</div>' } }
  ]
})

describe('MyTeamsTabContent Navigation Property Tests', () => {
  let mockStore: any

  beforeEach(() => {
    mockStore = {
      user: { id: 'user-123' },
      getMyTeamsForEvent: vi.fn(() => []),
      getMyTeamRequestsForEvent: vi.fn(() => []),
      getMyTeamInvitesForEvent: vi.fn(() => []),
      setBanner: vi.fn(),
      cancelTeamJoinRequest: vi.fn(() => Promise.resolve({ error: '' })),
      acceptTeamInvite: vi.fn(() => Promise.resolve({ error: '' })),
      rejectTeamInvite: vi.fn(() => Promise.resolve({ error: '' })),
      openAuthModal: vi.fn()
    }
    
    vi.mocked(useAppStore).mockReturnValue(mockStore)
  })

  it('Property 9: Navigation functionality correctness - team detail links should navigate to correct routes', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random team data with unique IDs and names
        fc.record({
          eventId: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0 && !s.includes('/')),
          teams: fc.array(
            fc.record({
              teamName: fc.string({ minLength: 2, maxLength: 50 }).filter(s => s.trim().length > 1),
              role: fc.constantFrom('leader', 'member'),
              memberCount: fc.integer({ min: 1, max: 10 }),
              status: fc.constantFrom('active', 'pending'),
              createdAt: fc.integer({ min: 1640995200000, max: 1735689600000 }).map(timestamp => new Date(timestamp).toISOString())
            }),
            { minLength: 0, maxLength: 3 }
          ).map(teams => {
            // Ensure unique team IDs and names
            return teams.map((team, index) => ({
              ...team,
              teamId: `team-${index}`,
              teamName: `UniqueTeam${index}-${team.teamName}`,
              eventId: 'test-event'
            }))
          })
        }),
        async ({ eventId, teams }) => {
          // Setup mock store to return the generated teams
          mockStore.getMyTeamsForEvent.mockReturnValue(teams)
          mockStore.getMyTeamRequestsForEvent.mockReturnValue([])
          mockStore.getMyTeamInvitesForEvent.mockReturnValue([])

          // Mount component with router
          const wrapper = mount(MyTeamsTabContent, {
            props: {
              eventId,
              isDemo: false
            },
            global: {
              plugins: [mockRouter],
              stubs: {
                RouterLink: {
                  template: '<a :href="to" @click="$emit(\'navigate\', to)"><slot /></a>',
                  props: ['to'],
                  emits: ['navigate']
                }
              }
            }
          })

          await wrapper.vm.$nextTick()

          // Verify that all navigation links contain the correct eventId and teamId parameters
          const allLinks = wrapper.findAll('a[href]')
          
          for (const link of allLinks) {
            const href = link.attributes('href')
            if (href && href.includes('/events/') && href.includes('/team/')) {
              // Extract eventId and teamId from href
              const match = href.match(/\/events\/([^/]+)\/team\/([^/]+)/)
              if (match) {
                const [, linkEventId, linkTeamId] = match
                
                // Verify eventId matches the component prop
                expect(linkEventId).toBe(eventId)
                
                // Verify teamId exists in our teams data
                const teamExists = teams.some(team => team.teamId === linkTeamId)
                expect(teamExists).toBe(true)
              }
            }
          }

          // Only check for team links if there are teams to display
          if (teams.length > 0) {
            // For each team, verify that the correct navigation links exist
            for (const team of teams) {
              const expectedDetailPath = `/events/${eventId}/team/${team.teamId}`
              
              // Check if detail link exists
              const detailLinks = allLinks.filter(link => 
                link.attributes('href') === expectedDetailPath
              )
              expect(detailLinks.length).toBeGreaterThan(0)
            }
          } else {
            // If there are no teams, verify that no team-related navigation links exist
            const teamLinks = allLinks.filter(link => {
              const href = link.attributes('href')
              return href && href.includes('/events/') && href.includes('/team/')
            })
            expect(teamLinks.length).toBe(0)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 9: Navigation functionality correctness - request team links should navigate to correct team detail pages', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          eventId: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0 && !s.includes('/')),
          requests: fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
              teamId: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0 && !s.includes('/')),
              teamName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              status: fc.constantFrom('pending', 'approved', 'rejected'),
              message: fc.option(fc.string({ maxLength: 100 })),
              createdAt: fc.integer({ min: 1640995200000, max: 1735689600000 }).map(timestamp => new Date(timestamp).toISOString())
            }),
            { minLength: 0, maxLength: 3 }
          ).map(requests => {
            // Ensure unique request IDs and team IDs
            return requests.map((request, index) => ({
              ...request,
              id: `request-${index}`,
              teamId: `team-${index}`,
              teamName: `Team ${index} ${request.teamName}`
            }))
          })
        }),
        async ({ eventId, requests }) => {
          // Setup mock store
          mockStore.getMyTeamRequestsForEvent.mockReturnValue(requests)
          mockStore.getMyTeamsForEvent.mockReturnValue([])
          mockStore.getMyTeamInvitesForEvent.mockReturnValue([])

          const wrapper = mount(MyTeamsTabContent, {
            props: {
              eventId,
              isDemo: false
            },
            global: {
              plugins: [mockRouter],
              stubs: {
                RouterLink: {
                  template: '<a :href="to"><slot /></a>',
                  props: ['to']
                }
              }
            }
          })

          await wrapper.vm.$nextTick()

          // Verify request team name links navigate to correct team detail pages
          for (const request of requests) {
            const requestCards = wrapper.findAll('.request-card')
            const requestCard = requestCards.find(card => {
              const titleElement = card.find('.request-card__title')
              return titleElement.exists() && titleElement.text().includes(request.teamName)
            })

            if (requestCard) {
              const teamLink = requestCard.find('.request-card__title')
              if (teamLink.exists()) {
                const expectedPath = `/events/${eventId}/team/${request.teamId}`
                expect(teamLink.attributes('href')).toBe(expectedPath)
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 9: Navigation functionality correctness - invite team links should navigate to correct team detail pages', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          eventId: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0 && !s.includes('/')),
          invites: fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
              teamId: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0 && !s.includes('/')),
              teamName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              invitedByName: fc.option(fc.string({ minLength: 1, maxLength: 30 })),
              status: fc.constantFrom('pending', 'accepted', 'rejected'),
              message: fc.option(fc.string({ maxLength: 100 })),
              createdAt: fc.integer({ min: 1640995200000, max: 1735689600000 }).map(timestamp => new Date(timestamp).toISOString())
            }),
            { minLength: 0, maxLength: 3 }
          ).map(invites => {
            // Ensure unique invite IDs and team IDs
            return invites.map((invite, index) => ({
              ...invite,
              id: `invite-${index}`,
              teamId: `team-${index}`,
              teamName: `Team ${index} ${invite.teamName}`
            }))
          })
        }),
        async ({ eventId, invites }) => {
          // Setup mock store
          mockStore.getMyTeamInvitesForEvent.mockReturnValue(invites)
          mockStore.getMyTeamsForEvent.mockReturnValue([])
          mockStore.getMyTeamRequestsForEvent.mockReturnValue([])

          const wrapper = mount(MyTeamsTabContent, {
            props: {
              eventId,
              isDemo: false
            },
            global: {
              plugins: [mockRouter],
              stubs: {
                RouterLink: {
                  template: '<a :href="to"><slot /></a>',
                  props: ['to']
                }
              }
            }
          })

          await wrapper.vm.$nextTick()

          // Verify invite team name links navigate to correct team detail pages
          for (const invite of invites) {
            const inviteCards = wrapper.findAll('.invite-card')
            const inviteCard = inviteCards.find(card => {
              const titleElement = card.find('.invite-card__title')
              return titleElement.exists() && titleElement.text().includes(invite.teamName)
            })

            if (inviteCard) {
              const teamLink = inviteCard.find('.invite-card__title')
              if (teamLink.exists()) {
                const expectedPath = `/events/${eventId}/team/${invite.teamId}`
                expect(teamLink.attributes('href')).toBe(expectedPath)
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})