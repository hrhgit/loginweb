import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import TeamCreatePage from './TeamCreatePage.vue'

// Mock the store
const mockStore = {
  isAuthed: true,
  user: { id: 'user1' },
  contacts: { qq: '123456789' },
  getEventById: vi.fn(() => ({
    id: 'event1',
    title: 'Test Event',
    status: 'published'
  })),
  getTeamsForEvent: vi.fn(() => []),
  isDemoEvent: vi.fn(() => false),
  refreshUser: vi.fn(),
  loadMyContacts: vi.fn(),
  ensureEventsLoaded: vi.fn(),
  loadTeams: vi.fn(),
  createTeam: vi.fn(() => ({ error: null })),
  updateTeam: vi.fn(() => ({ error: null })),
  setBanner: vi.fn(),
  openAuth: vi.fn()
}

// Mock the composable
vi.mock('../store/appStore', () => ({
  useAppStore: () => mockStore
}))

// Mock utils
vi.mock('../utils/roleTags', () => ({
  getRoleTagClass: vi.fn(() => 'role-tag--programmer'),
  sortRoleLabels: vi.fn((labels) => labels)
}))

describe('TeamCreatePage', () => {
  let router: any
  let wrapper: any

  beforeEach(async () => {
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/events/:id/team/create', component: TeamCreatePage },
        { path: '/events/:id/team', component: { template: '<div>Team List</div>' } }
      ]
    })

    await router.push('/events/event1/team/create')
    
    wrapper = mount(TeamCreatePage, {
      global: {
        plugins: [router],
        stubs: {
          RouterLink: true
        }
      }
    })

    await wrapper.vm.$nextTick()
  })

  describe('Form State Serialization', () => {
    it('should serialize form state correctly', async () => {
      // Access the component's internal methods
      const vm = wrapper.vm as any

      // Set form values
      await wrapper.find('input[placeholder="例如：霓虹守夜人"]').setValue('Test Team')
      await wrapper.find('input[placeholder="仅数字"]').setValue('123456789')
      await wrapper.find('textarea[placeholder="介绍一下队伍目标与风格（可选）"]').setValue('Test intro')

      // Get serialized state
      const serialized = vm.serializeFormState()
      const parsed = JSON.parse(serialized)

      expect(parsed.teamName).toBe('Test Team')
      expect(parsed.leaderQq).toBe('123456789')
      expect(parsed.teamIntro).toBe('Test intro')
      expect(Array.isArray(parsed.teamNeeds)).toBe(true)
      expect(typeof parsed.teamExtra).toBe('string')
    })
  })

  describe('Change Detection', () => {
    it('should detect changes when form is modified', async () => {
      const vm = wrapper.vm as any

      // Initially should not be dirty
      expect(vm.isDirty).toBe(false)

      // Modify form
      await wrapper.find('input[placeholder="例如：霓虹守夜人"]').setValue('Modified Team')
      await wrapper.vm.$nextTick()

      // Should now be dirty
      expect(vm.isDirty).toBe(true)
    })

    it('should not be dirty when form matches saved snapshot', async () => {
      const vm = wrapper.vm as any

      // Set initial values
      await wrapper.find('input[placeholder="例如：霓虹守夜人"]').setValue('Test Team')
      
      // Sync snapshot
      vm.syncSavedSnapshot()
      await wrapper.vm.$nextTick()

      // Should not be dirty
      expect(vm.isDirty).toBe(false)
    })
  })

  describe('Form Validation', () => {
    it('should validate required fields', async () => {
      const vm = wrapper.vm as any

      // Ensure form fields are empty
      vm.teamName = ''
      vm.leaderQq = ''

      // Try to validate empty form
      const isValid = vm.validate()

      expect(isValid).toBe(false)
      expect(vm.fieldErrors.teamName).toBeTruthy()
      expect(vm.fieldErrors.leaderQq).toBeTruthy()
    })

    it('should pass validation with valid data', async () => {
      const vm = wrapper.vm as any

      // Set valid data
      vm.teamName = 'Valid Team Name'
      vm.leaderQq = '123456789'

      const isValid = vm.validate()

      expect(isValid).toBe(true)
      expect(Object.keys(vm.fieldErrors)).toHaveLength(0)
    })

    it('should preserve dirty state during validation errors', async () => {
      const vm = wrapper.vm as any

      // Set initial clean state
      vm.teamName = 'Initial Team'
      vm.leaderQq = '123456789'
      vm.syncSavedSnapshot()
      expect(vm.isDirty).toBe(false)

      // Modify form to make it dirty
      vm.teamName = 'Modified Team'
      expect(vm.isDirty).toBe(true)

      // Clear required field to trigger validation error
      vm.leaderQq = ''
      
      // Validate (should fail)
      const isValid = vm.validate()
      expect(isValid).toBe(false)
      expect(vm.fieldErrors.leaderQq).toBeTruthy()

      // Dirty state should be preserved despite validation error
      expect(vm.isDirty).toBe(true)
    })
  })

  describe('Navigation Guard', () => {
    it('should allow navigation when not dirty', async () => {
      const vm = wrapper.vm as any

      // Should allow navigation when not dirty
      vm.allowNavigation = false
      expect(vm.isDirty).toBe(false)

      // The navigation guard logic should return true for clean forms
      const shouldAllow = !vm.isDirty || vm.allowNavigation
      expect(shouldAllow).toBe(true)
    })
  })
})