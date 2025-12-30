/**
 * Progressive Image Loading Directive
 * 
 * Enhanced image lazy loading with responsive images, placeholders, and performance tracking
 */

import type { DirectiveBinding } from 'vue'
import { 
  generateResponsiveSrcset, 
  generateWebPSrcset, 
  generateDefaultSizes,
  createPlaceholderImage,
  calculateOptimalImageWidth,
  progressiveLoadingTracker
} from '../utils/progressiveLoading'

interface ProgressiveImageOptions {
  src: string
  alt?: string
  sizes?: string
  width?: number
  height?: number
  quality?: number
  enableWebP?: boolean
  enablePlaceholder?: boolean
  placeholderColor?: string
  loading?: 'lazy' | 'eager'
  threshold?: number
}

interface ProgressiveImageElement extends HTMLElement {
  _progressiveImageObserver?: IntersectionObserver
  _progressiveImageStartTime?: number
  _progressiveImageLoaded?: boolean
}

// Create intersection observer for lazy loading
const createProgressiveImageObserver = (threshold: number = 50) => {
  return new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const element = entry.target as ProgressiveImageElement
          loadProgressiveImage(element)
          progressiveImageObserver.unobserve(element)
        }
      })
    },
    {
      rootMargin: `${threshold}px`
    }
  )
}

let progressiveImageObserver = createProgressiveImageObserver()

/**
 * Load progressive image with responsive sources
 */
function loadProgressiveImage(element: ProgressiveImageElement): void {
  const options = element.dataset.progressiveOptions ? 
    JSON.parse(element.dataset.progressiveOptions) as ProgressiveImageOptions : 
    {} as ProgressiveImageOptions

  if (!options.src) return

  const startTime = performance.now()
  element._progressiveImageStartTime = startTime

  // Create picture element for responsive images
  const picture = document.createElement('picture')
  
  // Add WebP source if enabled
  if (options.enableWebP !== false) {
    const webpSource = document.createElement('source')
    webpSource.type = 'image/webp'
    webpSource.srcset = generateWebPSrcset(options.src)
    webpSource.sizes = options.sizes || generateDefaultSizes()
    picture.appendChild(webpSource)
  }
  
  // Add fallback source
  const fallbackSource = document.createElement('source')
  fallbackSource.srcset = generateResponsiveSrcset(options.src)
  fallbackSource.sizes = options.sizes || generateDefaultSizes()
  picture.appendChild(fallbackSource)
  
  // Create img element
  const img = document.createElement('img')
  
  // Calculate optimal src for current viewport
  const viewportWidth = window.innerWidth
  const devicePixelRatio = window.devicePixelRatio || 1
  const optimalWidth = calculateOptimalImageWidth(viewportWidth, devicePixelRatio, options.width)
  
  const baseSrc = options.src.replace(/\.(jpg|jpeg|png|webp)$/i, '')
  const ext = options.src.match(/\.(jpg|jpeg|png|webp)$/i)?.[0] || '.jpg'
  img.src = `${baseSrc}_${optimalWidth}w${ext}`
  
  img.alt = options.alt || ''
  img.loading = options.loading || 'lazy'
  
  if (options.width) img.width = options.width
  if (options.height) img.height = options.height
  
  // Copy classes and styles from original element
  img.className = element.className
  if (element.getAttribute('style')) {
    img.setAttribute('style', element.getAttribute('style')!)
  }
  
  // Handle load events
  img.onload = () => {
    const loadTime = performance.now() - startTime
    progressiveLoadingTracker.recordImageLoad(loadTime, false)
    element._progressiveImageLoaded = true
    
    // Fade in effect
    img.style.opacity = '0'
    img.style.transition = 'opacity 0.3s ease'
    
    requestAnimationFrame(() => {
      img.style.opacity = '1'
    })
  }
  
  img.onerror = () => {
    // Fallback to original src
    img.src = options.src
  }
  
  picture.appendChild(img)
  
  // Replace element with picture
  if (element.parentNode) {
    element.parentNode.replaceChild(picture, element)
  }
}

/**
 * Set up placeholder for progressive image
 */
function setupPlaceholder(element: ProgressiveImageElement, options: ProgressiveImageOptions): void {
  if (options.enablePlaceholder === false) return
  
  const width = options.width || 400
  const height = options.height || 300
  const color = options.placeholderColor || '#f0f0f0'
  
  if (element.tagName.toLowerCase() === 'img') {
    (element as HTMLImageElement).src = createPlaceholderImage(width, height, color)
  } else {
    element.style.backgroundColor = color
    element.style.minHeight = `${height}px`
    element.style.display = 'flex'
    element.style.alignItems = 'center'
    element.style.justifyContent = 'center'
    element.innerHTML = '<div style="color: #999; font-size: 14px;">Loading...</div>'
  }
}

export const vProgressiveImage = {
  mounted(el: ProgressiveImageElement, binding: DirectiveBinding<ProgressiveImageOptions>) {
    const options = binding.value || {} as ProgressiveImageOptions
    
    // Store options in dataset
    el.dataset.progressiveOptions = JSON.stringify(options)
    
    // Set up placeholder
    setupPlaceholder(el, options)
    
    // Set up intersection observer for lazy loading
    if (options.loading !== 'eager') {
      // Update observer threshold if specified
      if (options.threshold && options.threshold !== 50) {
        progressiveImageObserver = createProgressiveImageObserver(options.threshold)
      }
      
      progressiveImageObserver.observe(el)
      el._progressiveImageObserver = progressiveImageObserver
    } else {
      // Load immediately for eager loading
      loadProgressiveImage(el)
    }
    
    // Track total images
    progressiveLoadingTracker.setImageTotal(
      progressiveLoadingTracker.getMetrics().imagesTotal + 1
    )
  },
  
  updated(el: ProgressiveImageElement, binding: DirectiveBinding<ProgressiveImageOptions>) {
    const options = binding.value || {} as ProgressiveImageOptions
    const oldOptions = el.dataset.progressiveOptions ? 
      JSON.parse(el.dataset.progressiveOptions) as ProgressiveImageOptions : 
      {} as ProgressiveImageOptions
    
    // Check if src changed
    if (options.src && options.src !== oldOptions.src) {
      el.dataset.progressiveOptions = JSON.stringify(options)
      
      if (!el._progressiveImageLoaded) {
        setupPlaceholder(el, options)
        
        if (options.loading !== 'eager') {
          if (el._progressiveImageObserver) {
            el._progressiveImageObserver.observe(el)
          }
        } else {
          loadProgressiveImage(el)
        }
      }
    }
  },
  
  unmounted(el: ProgressiveImageElement) {
    if (el._progressiveImageObserver) {
      el._progressiveImageObserver.unobserve(el)
    }
  }
}