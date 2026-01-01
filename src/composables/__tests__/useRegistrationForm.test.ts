import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRegistrationForm, useRegistrationCount, useUpdateRegistrationForm } from '../useRegistrationForm'
import { supabase } from '../../lib/supabase'

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(),
          })),
        })),
      })),
    })),
  },
}))

// Mock Vue Query
vi.mock('@tanstack/vue-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
}))

// Mock store
vi.mock('../../store/appStore', () => ({
  useAppStore: vi.fn(() => ({
    setBanner: vi.fn(),
  })),
}))

// Mock error handlers
vi.mock('../../store/enhancedErrorHandling', () => ({
  handleSuccessWithBanner: vi.fn(),
  eventErrorHandler: {
    handleError: vi.fn(),
  },
}))

describe('useRegistrationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchRegistrationForm', () => {
    it('should return empty object when eventId or userId is missing', async () => {
      const { fetchRegistrationForm } = await import('../useRegistrationForm')
      
      // Access the internal function for testing
      const result1 = await (fetchRegistrationForm as any)('', 'user123')
      const result2 = await (fetchRegistrationForm as any)('event123', '')
      
      expect(result1).toEqual({})
      expect(result2).toEqual({})
    })

    it('should fetch registration form data successfully', async () => {
      const mockData = { form_response: { question1: 'answer1' } }
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: mockData, error: null }),
          })),
        })),
      }))
      
      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any)

      const { fetchRegistrationForm } = await import('../useRegistrationForm')
      const result = await (fetchRegistrationForm as any)('event123', 'user123')
      
      expect(result).toEqual({ question1: 'answer1' })
      expect(supabase.from).toHaveBeenCalledWith('registrations')
    })
  })

  describe('fetchRegistrationCount', () => {
    it('should return 0 when eventId is missing', async () => {
      const { fetchRegistrationCount } = await import('../useRegistrationForm')
      
      const result = await (fetchRegistrationCount as any)('')
      expect(result).toBe(0)
    })

    it('should fetch registration count successfully', async () => {
      const mockSelect = vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
      }))
      
      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any)

      const { fetchRegistrationCount } = await import('../useRegistrationForm')
      const result = await (fetchRegistrationCount as any)('event123')
      
      expect(result).toBe(5)
      expect(supabase.from).toHaveBeenCalledWith('registrations')
    })
  })

  describe('updateRegistrationForm', () => {
    it('should update registration form successfully', async () => {
      const mockUpdate = vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: {}, error: null }),
          })),
        })),
      }))
      
      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as any)

      const { updateRegistrationForm } = await import('../useRegistrationForm')
      
      await (updateRegistrationForm as any)({
        registrationId: 'reg123',
        formResponse: { question1: 'answer1' },
      })
      
      expect(supabase.from).toHaveBeenCalledWith('registrations')
      expect(mockUpdate).toHaveBeenCalledWith({ form_response: { question1: 'answer1' } })
    })
  })
})