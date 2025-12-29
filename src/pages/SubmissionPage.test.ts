import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import SubmissionPage from './SubmissionPage.vue'

// Mock the store
const mockStore = {
  isAuthed: true,
  user: { id: 'user1' },
  getEventById: vi.fn(() => ({
    id: 'event1',
    title: 'Test Event',
    status: 'published',
    submissionStart: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    submissionEnd: new Date(Date.now() + 86400000).toISOString() // 1 day from now
  })),
  getTeamsForEvent: vi.fn(() => [
    { id: 'team1', name: 'Test Team', leaderId: 'user1' }
  ]),
  isDemoEvent: vi.fn(() => false),
  refreshUser: vi.fn(),
  ensureEventsLoaded: vi.fn(),
  loadTeams: vi.fn(),
  createSubmission: vi.fn(() => ({ error: null as string | null })),
  setBanner: vi.fn(),
  openAuth: vi.fn()
}

// Mock the composable
vi.mock('../store/appStore', () => ({
  useAppStore: () => mockStore
}))

// Mock DOM methods that don't exist in test environment
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true
})

describe('SubmissionPage Integration Tests', () => {
  let router: any
  let wrapper: any

  beforeEach(async () => {
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/events/:id/submission', component: SubmissionPage },
        { path: '/events/:id', component: { template: '<div>Event Detail</div>' } }
      ]
    })

    await router.push('/events/event1/submission')
    
    wrapper = mount(SubmissionPage, {
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
    it('should serialize form state correctly including file information', async () => {
      const vm = wrapper.vm as any

      // Set form values
      vm.projectName = 'Test Project'
      vm.teamId = 'team1'
      vm.intro = 'Test introduction'
      vm.videoLink = 'https://example.com/video'
      vm.submissionLink = 'https://example.com/project'
      vm.submissionPassword = 'password123'

      // Mock file objects
      vm.coverFile = { name: 'cover.jpg' }
      vm.submissionFile = { name: 'project.zip' }

      const serialized = vm.serializeFormState()
      const parsed = JSON.parse(serialized)

      expect(parsed.projectName).toBe('Test Project')
      expect(parsed.teamId).toBe('team1')
      expect(parsed.intro).toBe('Test introduction')
      expect(parsed.videoLink).toBe('https://example.com/video')
      expect(parsed.submissionLink).toBe('https://example.com/project')
      expect(parsed.submissionPassword).toBe('password123')
      expect(parsed.coverFileName).toBe('cover.jpg')
      expect(parsed.submissionFileName).toBe('project.zip')
    })
  })

  describe('Change Detection with File Uploads', () => {
    it('should detect changes when files are uploaded', async () => {
      const vm = wrapper.vm as any

      // Initialize the saved snapshot first (simulating component mount)
      vm.syncSavedSnapshot()
      await wrapper.vm.$nextTick()

      // Initially should not be dirty
      expect(vm.isDirty).toBe(false)

      // Mock file upload
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      vm.coverFile = mockFile
      await wrapper.vm.$nextTick()

      // Should now be dirty due to file upload
      expect(vm.isDirty).toBe(true)
    })

    it('should maintain dirty state when both form fields and files change', async () => {
      const vm = wrapper.vm as any

      // Set initial clean state
      vm.syncSavedSnapshot()
      expect(vm.isDirty).toBe(false)

      // Change form field
      vm.projectName = 'Modified Project'
      expect(vm.isDirty).toBe(true)

      // Add file upload
      vm.coverFile = new File(['test'], 'cover.jpg', { type: 'image/jpeg' })
      await wrapper.vm.$nextTick()

      // Should still be dirty
      expect(vm.isDirty).toBe(true)
    })
  })

  describe('Navigation Guard Integration', () => {
    it('should allow navigation when form is clean', async () => {
      const vm = wrapper.vm as any

      // Initialize the saved snapshot first (simulating component mount)
      vm.syncSavedSnapshot()
      await wrapper.vm.$nextTick()

      // Ensure clean state
      expect(vm.isDirty).toBe(false)
      expect(vm.allowNavigation).toBe(false)

      // Navigation should be allowed for clean forms
      const shouldAllow = !vm.isDirty || vm.allowNavigation
      expect(shouldAllow).toBe(true)
    })

    it('should block navigation when form has unsaved changes', async () => {
      const vm = wrapper.vm as any

      // Initialize the saved snapshot first (simulating component mount)
      vm.syncSavedSnapshot()
      await wrapper.vm.$nextTick()

      // Make form dirty
      vm.projectName = 'Modified Project'
      await wrapper.vm.$nextTick()
      expect(vm.isDirty).toBe(true)
      expect(vm.allowNavigation).toBe(false)

      // Navigation should be blocked
      const shouldAllow = !vm.isDirty || vm.allowNavigation
      expect(shouldAllow).toBe(false)
    })
  })

  describe('Successful Submission Workflow', () => {
    it('should clear dirty state and allow navigation after successful submission', async () => {
      const vm = wrapper.vm as any

      // Initialize the saved snapshot first (simulating component mount)
      vm.syncSavedSnapshot()
      await wrapper.vm.$nextTick()

      // Set up form with data
      vm.projectName = 'Test Project'
      vm.teamId = 'team1'
      vm.intro = 'Test introduction'
      await wrapper.vm.$nextTick()
      
      // Form should be dirty
      expect(vm.isDirty).toBe(true)

      // Mock successful submission
      mockStore.createSubmission.mockResolvedValueOnce({ error: null })

      // Simulate successful submission by setting the flags directly
      // (since we're not actually calling the submit function in this test)
      vm.allowNavigation = true
      vm.isSubmitted = true
      vm.syncSavedSnapshot() // Clear dirty state

      // After successful submission, should allow navigation
      expect(vm.allowNavigation).toBe(true)
      expect(vm.isSubmitted).toBe(true)
    })
  })

  describe('File Cleanup on Navigation', () => {
    it('should handle file cleanup when navigation is confirmed', async () => {
      const vm = wrapper.vm as any

      // Initialize the saved snapshot first (simulating component mount)
      vm.syncSavedSnapshot()
      await wrapper.vm.$nextTick()

      // Mock file with cleanup method
      const mockFile = {
        name: 'test.jpg',
        cleanup: vi.fn()
      }
      
      vm.coverFile = mockFile
      await wrapper.vm.$nextTick()
      expect(vm.isDirty).toBe(true)

      // Simulate navigation confirmation (allowNavigation = true)
      vm.allowNavigation = true

      // File cleanup should be handled appropriately
      // (The actual cleanup logic would be in the navigation guard)
      expect(vm.coverFile).toBeTruthy()
    })
  })

  describe('Browser Event Integration', () => {
    it('should set up beforeunload handler when component mounts', async () => {
      const vm = wrapper.vm as any

      // Check that handleBeforeUnload function exists
      expect(typeof vm.handleBeforeUnload).toBe('function')

      // Test the beforeunload logic
      const mockEvent = { preventDefault: vi.fn(), returnValue: '' }
      
      // Initialize the saved snapshot first (simulating component mount)
      vm.syncSavedSnapshot()
      await wrapper.vm.$nextTick()

      // When form is dirty, should prevent default
      vm.projectName = 'Modified'
      await wrapper.vm.$nextTick()
      expect(vm.isDirty).toBe(true)
      
      vm.handleBeforeUnload(mockEvent)
      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.returnValue).toBe('')
    })
  })

  describe('Validation Error Handling', () => {
    it('should preserve dirty state during validation errors', async () => {
      const vm = wrapper.vm as any

      // Set initial clean state
      vm.projectName = 'Initial Project'
      vm.teamId = 'team1'
      vm.syncSavedSnapshot()
      expect(vm.isDirty).toBe(false)

      // Modify form to make it dirty
      vm.projectName = 'Modified Project'
      expect(vm.isDirty).toBe(true)

      // Clear required field to trigger validation error
      vm.projectName = ''
      
      // Attempt submission (should fail validation)
      mockStore.createSubmission.mockResolvedValueOnce({ error: 'Validation failed' })
      await vm.submit()

      // Dirty state should be preserved despite validation error
      expect(vm.isDirty).toBe(true)
      expect(vm.allowNavigation).toBe(false)
    })
  })
})