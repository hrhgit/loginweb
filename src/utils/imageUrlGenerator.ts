/**
 * Centralized Image URL Generation Utility
 * 
 * This utility provides cache-busting image URL generation for all image types
 * in the application, following the requirements for preventing browser caching
 * to save cache space and ensure fresh image delivery.
 */

export interface ImageUrlOptions {
  /**
   * Whether to prevent browser caching by adding timestamp parameters
   * @default true
   */
  preventCache?: boolean
  
  /**
   * Custom timestamp to use for cache busting
   * @default Date.now()
   */
  timestamp?: number
  
  /**
   * Image type for optimization hints
   */
  type?: 'avatar' | 'cover' | 'submission' | 'general'
}

/**
 * Generates image URLs with cache-busting parameters to prevent browser caching
 * 
 * @param path - The image path or URL
 * @param options - Configuration options for URL generation
 * @returns Generated image URL with cache-busting parameters
 */
export const generateImageUrl = (path: string, options: ImageUrlOptions = {}): string => {
  if (!path) return ''
  
  const {
    preventCache = true,
    timestamp = Date.now(),
    type = 'general'
  } = options
  
  const trimmedPath = path.trim()
  if (!trimmedPath) return ''
  
  // For external URLs (already complete HTTP/HTTPS URLs)
  if (trimmedPath.startsWith('http')) {
    if (preventCache) {
      const separator = trimmedPath.includes('?') ? '&' : '?'
      return `${trimmedPath}${separator}t=${timestamp}`
    }
    return trimmedPath
  }
  
  // For Supabase storage URLs
  const projectUrl = import.meta.env.VITE_SUPABASE_URL || ''
  if (!projectUrl) {
    console.warn('VITE_SUPABASE_URL not configured for image URL generation')
    return ''
  }
  
  // Determine the appropriate bucket based on image type and path
  let bucket = 'public-assets' // default bucket
  
  if (type === 'avatar' || trimmedPath.includes('avatar')) {
    bucket = 'avatars'
  } else if (type === 'submission' || trimmedPath.includes('submission')) {
    bucket = 'submission-files'
  } else if (type === 'cover') {
    bucket = 'public-assets'
  }
  
  // Handle paths that already include bucket information
  if (trimmedPath.includes('/')) {
    const baseUrl = `${projectUrl}/storage/v1/object/public/${bucket}/${trimmedPath}`
    if (preventCache) {
      return `${baseUrl}?t=${timestamp}`
    }
    return baseUrl
  }
  
  // For simple filenames without path separators, construct the full path
  const baseUrl = `${projectUrl}/storage/v1/object/public/${bucket}/${trimmedPath}`
  if (preventCache) {
    return `${baseUrl}?t=${timestamp}`
  }
  return baseUrl
}

/**
 * Generates avatar URLs with cache-busting for user profile images
 * 
 * @param avatarPath - The avatar path from user profile
 * @param options - Additional options for URL generation
 * @returns Avatar URL with cache-busting parameters
 */
export const generateAvatarUrl = (avatarPath: string | null, options: Omit<ImageUrlOptions, 'type'> = {}): string => {
  if (!avatarPath) return ''
  
  return generateImageUrl(avatarPath, {
    ...options,
    type: 'avatar',
    preventCache: true // Always prevent caching for avatars
  })
}

/**
 * Generates cover image URLs with cache-busting for submission covers
 * 
 * @param coverPath - The cover image path from submission
 * @param options - Additional options for URL generation
 * @returns Cover image URL with cache-busting parameters
 */
export const generateCoverUrl = (coverPath: string | null, options: Omit<ImageUrlOptions, 'type'> = {}): string => {
  if (!coverPath) return ''
  
  return generateImageUrl(coverPath, {
    preventCache: false, // Allow caching for covers since they have unique filenames
    ...options,
    type: 'cover',
  })
}

/**
 * Generates submission file URLs with cache-busting
 * 
 * @param submissionPath - The submission file path
 * @param options - Additional options for URL generation
 * @returns Submission URL with cache-busting parameters
 */
export const generateSubmissionUrl = (submissionPath: string | null, options: Omit<ImageUrlOptions, 'type'> = {}): string => {
  if (!submissionPath) return ''
  
  return generateImageUrl(submissionPath, {
    ...options,
    type: 'submission',
    preventCache: true // Always prevent caching for submission files
  })
}

/**
 * Legacy compatibility function - matches the existing generateStorageUrl pattern
 * 
 * @deprecated Use generateImageUrl, generateAvatarUrl, or generateCoverUrl instead
 * @param path - The image path
 * @param timestamp - Optional timestamp for cache busting
 * @returns Generated URL with cache busting
 */
export const generateStorageUrl = (path: string, timestamp?: number): string => {
  return generateImageUrl(path, {
    preventCache: true,
    timestamp: timestamp || Date.now(),
    type: 'general'
  })
}

/**
 * Utility to check if an image URL needs cache busting
 * 
 * @param url - The image URL to check
 * @returns True if the URL already has cache-busting parameters
 */
export const hasCacheBusting = (url: string): boolean => {
  if (!url) return false
  return url.includes('t=') || url.includes('timestamp=') || url.includes('_t=')
}

/**
 * Utility to extract the base URL without cache-busting parameters
 * 
 * @param url - The image URL with potential cache-busting parameters
 * @returns Base URL without cache-busting parameters
 */
export const getBaseImageUrl = (url: string): string => {
  if (!url) return ''
  
  // Remove common cache-busting parameters
  return url.split(/[?&](?:t|timestamp|_t)=/)[0]
}