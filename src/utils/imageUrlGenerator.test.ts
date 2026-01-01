import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  generateImageUrl, 
  generateAvatarUrl, 
  generateCoverUrl, 
  generateSubmissionUrl,
  generateStorageUrl,
  hasCacheBusting,
  getBaseImageUrl
} from './imageUrlGenerator'

// Mock environment variable
const mockSupabaseUrl = 'https://test.supabase.co'

describe('imageUrlGenerator', () => {
  beforeEach(() => {
    // Mock environment variable
    vi.stubEnv('VITE_SUPABASE_URL', mockSupabaseUrl)
  })

  describe('generateImageUrl', () => {
    it('should return empty string for empty path', () => {
      expect(generateImageUrl('')).toBe('')
      expect(generateImageUrl('   ')).toBe('')
    })

    it('should handle external HTTP URLs with cache busting', () => {
      const externalUrl = 'https://example.com/image.jpg'
      const result = generateImageUrl(externalUrl)
      
      expect(result).toContain(externalUrl)
      expect(result).toMatch(/[?&]t=\d+/)
    })

    it('should handle external HTTP URLs without cache busting', () => {
      const externalUrl = 'https://example.com/image.jpg'
      const result = generateImageUrl(externalUrl, { preventCache: false })
      
      expect(result).toBe(externalUrl)
      expect(result).not.toMatch(/[?&]t=\d+/)
    })

    it('should generate Supabase storage URLs with cache busting', () => {
      const path = 'avatars/user123.jpg'
      const result = generateImageUrl(path, { type: 'avatar' })
      
      expect(result).toContain(mockSupabaseUrl)
      expect(result).toContain('/storage/v1/object/public/avatars/')
      expect(result).toContain(path)
      expect(result).toMatch(/[?&]t=\d+/)
    })

    it('should use custom timestamp', () => {
      const path = 'covers/image.jpg'
      const customTimestamp = 1234567890
      const result = generateImageUrl(path, { timestamp: customTimestamp })
      
      expect(result).toContain(`t=${customTimestamp}`)
    })

    it('should determine correct bucket based on type', () => {
      const path = 'test.jpg'
      
      const avatarResult = generateImageUrl(path, { type: 'avatar' })
      expect(avatarResult).toContain('/avatars/')
      
      const coverResult = generateImageUrl(path, { type: 'cover' })
      expect(coverResult).toContain('/public-assets/')
      
      const submissionResult = generateImageUrl('submission/test.jpg', { type: 'submission' })
      expect(submissionResult).toContain('/submission-files/')
    })
  })

  describe('generateAvatarUrl', () => {
    it('should return empty string for null/empty path', () => {
      expect(generateAvatarUrl(null)).toBe('')
      expect(generateAvatarUrl('')).toBe('')
    })

    it('should generate avatar URL with cache busting', () => {
      const path = 'user123/avatar.jpg'
      const result = generateAvatarUrl(path)
      
      expect(result).toContain(mockSupabaseUrl)
      expect(result).toContain('/avatars/')
      expect(result).toContain(path)
      expect(result).toMatch(/[?&]t=\d+/)
    })

    it('should always prevent caching for avatars', () => {
      const path = 'user123/avatar.jpg'
      const result = generateAvatarUrl(path, { preventCache: false })
      
      // Should still have cache busting despite preventCache: false
      expect(result).toMatch(/[?&]t=\d+/)
    })
  })

  describe('generateCoverUrl', () => {
    it('should return empty string for null/empty path', () => {
      expect(generateCoverUrl(null)).toBe('')
      expect(generateCoverUrl('')).toBe('')
    })

    it('should generate cover URL with cache busting', () => {
      const path = 'covers/image123.jpg'
      const result = generateCoverUrl(path)
      
      expect(result).toContain(mockSupabaseUrl)
      expect(result).toContain('/public-assets/')
      expect(result).toContain(path)
      expect(result).toMatch(/[?&]t=\d+/)
    })
  })

  describe('generateSubmissionUrl', () => {
    it('should return empty string for null/empty path', () => {
      expect(generateSubmissionUrl(null)).toBe('')
      expect(generateSubmissionUrl('')).toBe('')
    })

    it('should generate submission URL with cache busting', () => {
      const path = 'submissions/project.zip'
      const result = generateSubmissionUrl(path)
      
      expect(result).toContain(mockSupabaseUrl)
      expect(result).toContain('/submission-files/')
      expect(result).toContain(path)
      expect(result).toMatch(/[?&]t=\d+/)
    })
  })

  describe('generateStorageUrl (legacy)', () => {
    it('should work as legacy compatibility function', () => {
      const path = 'test/image.jpg'
      const result = generateStorageUrl(path)
      
      expect(result).toContain(mockSupabaseUrl)
      expect(result).toContain(path)
      expect(result).toMatch(/[?&]t=\d+/)
    })

    it('should use custom timestamp', () => {
      const path = 'test/image.jpg'
      const customTimestamp = 9876543210
      const result = generateStorageUrl(path, customTimestamp)
      
      expect(result).toContain(`t=${customTimestamp}`)
    })
  })

  describe('hasCacheBusting', () => {
    it('should detect cache busting parameters', () => {
      expect(hasCacheBusting('https://example.com/image.jpg?t=123')).toBe(true)
      expect(hasCacheBusting('https://example.com/image.jpg?timestamp=123')).toBe(true)
      expect(hasCacheBusting('https://example.com/image.jpg?_t=123')).toBe(true)
      expect(hasCacheBusting('https://example.com/image.jpg')).toBe(false)
      expect(hasCacheBusting('')).toBe(false)
    })
  })

  describe('getBaseImageUrl', () => {
    it('should remove cache busting parameters', () => {
      const baseUrl = 'https://example.com/image.jpg'
      
      expect(getBaseImageUrl(`${baseUrl}?t=123`)).toBe(baseUrl)
      expect(getBaseImageUrl(`${baseUrl}?timestamp=123`)).toBe(baseUrl)
      expect(getBaseImageUrl(`${baseUrl}?_t=123`)).toBe(baseUrl)
      expect(getBaseImageUrl(`${baseUrl}?other=param&t=123`)).toBe(`${baseUrl}?other=param`)
      expect(getBaseImageUrl(baseUrl)).toBe(baseUrl)
      expect(getBaseImageUrl('')).toBe('')
    })
  })

  describe('error handling', () => {
    it('should handle missing VITE_SUPABASE_URL', () => {
      vi.stubEnv('VITE_SUPABASE_URL', '')
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const result = generateImageUrl('test/image.jpg')
      
      expect(result).toBe('')
      expect(consoleSpy).toHaveBeenCalledWith('VITE_SUPABASE_URL not configured for image URL generation')
      
      consoleSpy.mockRestore()
    })
  })
})