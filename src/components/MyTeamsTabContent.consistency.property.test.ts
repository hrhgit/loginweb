import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import fc from 'fast-check'
import MyTeamsTabContent from './MyTeamsTabContent.vue'
import { useAppStore } from '../store/appStore'

// **Feature: team-management-integration, Property 7: 功能一致性保持**
// **Validates: Requirements 1.5, 4.1, 4.5**

// Mock the store
vi.mock('../store/appStore', () => ({
  useAppStore: vi.fn()
}))

// Mock router
const mockRouter = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: { template: '<div>Home</div>' } },
    { path: '/events/:eventId/team/:teamId', name: 'team-detail', component: { template: '<div>Team Detail</div>' } }
  ]
})

describe('MyTeamsTabContent Consistency Property Tests', () => {
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

  it('Property 7: Functionality consistency maintenance - team management operations should provide consistent functionality across pages', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          eventId: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          teams: fc.array(
            fc.record({
              teamId: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
              teamName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              role: fc.constantFrom('leader', 'member'),
              memberCount: fc.integer({ min: 1, max: 10 }),
              status: fc.constantFrom('active', 'pending')
            }),
            { minLength: 0, maxLength: 3 }
          ),
          requests: fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
              teamId: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
              teamName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              status: fc.constantFrom('pending', 'approved', 'rejected'),
              message: fc.option(fc.string({ maxLength: 100 }))
            }),
            { minLength: 0, maxLength: 2 }
          ),
          invites: fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
              teamId: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
              teamName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              invitedByName: fc.option(fc.string({ minLength: 1, maxLength: 30 })),
              status: fc.constantFrom('pending', 'accepted', 'rejected'),
              message: fc.option(fc.string({ maxLength: 100 }))
            }),
            { minLength: 0, maxLength: 2 }
          )
        }),
        async ({ eventId, teams, requests, invites }) => {
          // Setup mock store with generated data
          mockStore.getMyTeamsForEvent.mockReturnValue(teams)
          mockStore.getMyTeamRequestsForEvent.mockReturnValue(requests)
          mockStore.getMyTeamInvitesForEvent.mockReturnValue(invites)

          // Mount component
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

          // Verify consistent data display - teams section
          const teamCards = wrapper.findAll('.team-card')
          expect(teamCards.length).toBe(teams.length)

          // Verify each team is displayed with consistent information
          for (let i = 0; i < teams.length; i++) {
            const team = teams[i]
            const teamCard = teamCards[i]
            
            // Team name should be displayed
            const teamNameElement = teamCard.find('.team-card__title')
            expect(teamNameElement.exists()).toBe(true)
            expect(teamNameElement.text().trim()).toBe(team.teamName.trim())
            
            // Role should be displayed consistently
            const roleElement = teamCard.find('.role-badge')
            expect(roleElement.exists()).toBe(true)
            expect(roleElement.text()).toContain(team.role === 'leader' ? '队长' : '队员')
            
            // Member count should be displayed
            const memberCountElement = teamCard.find('.pill-badge')
            expect(memberCountElement.exists()).toBe(true)
            expect(memberCountElement.text()).toContain(team.memberCount.toString())
          }

          // Verify consistent data display - requests section
          const requestCards = wrapper.findAll('.request-card')
          expect(requestCards.length).toBe(requests.length)

          // Verify consistent data display - invites section
          const inviteCards = wrapper.findAll('.invite-card')
          expect(inviteCards.length).toBe(invites.length)

          // Verify consistent action buttons are available
          for (const request of requests) {
            if (request.status === 'pending') {
              const requestCards = wrapper.findAll('.request-card')
              const requestCard = requestCards.find(card => {
                const titleElement = card.find('.request-card__title')
                return titleElement.exists() && titleElement.text().includes(request.teamName)
              })
              
              if (requestCard) {
                const cancelButton = requestCard.find('.btn--ghost')
                expect(cancelButton.exists()).toBe(true)
                expect(cancelButton.text()).toContain('取消申请')
              }
            }
          }

          for (const invite of invites) {
            if (invite.status === 'pending') {
              const inviteCards = wrapper.findAll('.invite-card')
              const inviteCard = inviteCards.find(card => {
                const titleElement = card.find('.invite-card__title')
                return titleElement.exists() && titleElement.text().includes(invite.teamName)
              })
              
              if (inviteCard) {
                const acceptButton = inviteCard.find('.btn--primary')
                const rejectButton = inviteCard.find('.btn--ghost')
                expect(acceptButton.exists()).toBe(true)
                expect(rejectButton.exists()).toBe(true)
                expect(acceptButton.text()).toContain('接受邀请')
                expect(rejectButton.text()).toContain('拒绝')
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})