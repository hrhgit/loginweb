import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  generateImageUrl, 
  generateAvatarUrl, 
  generateCoverUrl, 
  generateSubmissionUrl
} from './imageUrlGenerator'

describe('Image URL Generator Integration', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
  })

  it('should generate cache-busted URLs for all image types', () => {
    const avatarPath = 'user123/avatar.jpg'
    const coverPath = 'covers/image.jpg'
    const submissionPath = 'files/project.zip'
    
    const avatarUrl = generateAvatarUrl(avatarPath)
    const coverUrl = generateCoverUrl(coverPath)
    const submissionUrl = generateSubmissionUrl(submissionPath)
    
    // All URLs should have cache busting
    expect(avatarUrl).toMatch(/[?&]t=\d+/)
    expect(coverUrl).toMatch(/[?&]t=\d+/)
    expect(submissionUrl).toMatch(/[?&]t=\d+/)
    
    // All URLs should use correct buckets
    expect(avatarUrl).toContain('/avatars/')
    expect(coverUrl).toContain('/public-assets/')
    expect(submissionUrl).toContain('/submission-files/')
    
    // All URLs should contain the original paths
    expect(avatarUrl).toContain(avatarPath)
    expect(coverUrl).toContain(coverPath)
    expect(submissionUrl).toContain(submissionPath)
  })

  it('should handle external URLs correctly', () => {
    const externalUrl = 'https://example.com/image.jpg'
    
    const result = generateImageUrl(externalUrl)
    
    expect(result).toContain(externalUrl)
    expect(result).toMatch(/[?&]t=\d+/)
  })

  it('should prevent browser caching for all image types', () => {
    const paths = [
      'user/avatar.jpg',
      'covers/image.jpg', 
      'submissions/file.zip'
    ]
    
    const generators = [generateAvatarUrl, generateCoverUrl, generateSubmissionUrl]
    
    generators.forEach((generator, index) => {
      const result = generator(paths[index])
      
      // Should always have cache busting parameters
      expect(result).toMatch(/[?&]t=\d+/)
      
      // Should not be empty
      expect(result).not.toBe('')
    })
  })

  it('should generate different URLs for same path at different times', async () => {
    const path = 'test/image.jpg'
    
    const url1 = generateImageUrl(path)
    
    // Wait a small amount to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 1))
    
    const url2 = generateImageUrl(path)
    
    // URLs should be different due to different timestamps
    expect(url1).not.toBe(url2)
    
    // But base URLs should be the same
    const base1 = url1.split('?')[0]
    const base2 = url2.split('?')[0]
    expect(base1).toBe(base2)
  })
})