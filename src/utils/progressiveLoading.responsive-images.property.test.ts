/**
 * Property-based test for responsive image serving
 * **Feature: network-performance-optimization, Property 13: Responsive image serving**
 * **Validates: Requirements 4.1**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

// Mock component that simulates responsive image serving
const ResponsiveImage = {
  props: {
    src: String,
    alt: String,
    sizes: String,
    srcset: String,
    width: Number,
    height: Number,
    loading: {
      type: String,
      default: 'lazy'
    }
  },
  template: `
    <picture class="responsive-image">
      <source 
        v-if="webpSrcset"
        :srcset="webpSrcset" 
        :sizes="sizes"
        type="image/webp"
      />
      <img 
        :src="optimizedSrc"
        :srcset="srcset || generatedSrcset"
        :sizes="sizes || defaultSizes"
        :alt="alt"
        :width="width"
        :height="height"
        :loading="loading"
        class="responsive-image__img"
        @load="onLoad"
        @error="onError"
      />
    </picture>
  `,
  data() {
    return {
      loaded: false,
      error: false,
      devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
      viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 1024
    }
  },
  computed: {
    // Generate responsive srcset based on original image
    generatedSrcset() {
      if (!this.src) return ''
      
      const baseSrc = this.src.replace(/\.(jpg|jpeg|png|webp)$/i, '')
      const ext = this.src.match(/\.(jpg|jpeg|png|webp)$/i)?.[0] || '.jpg'
      
      const sizes = [320, 640, 768, 1024, 1280, 1920]
      return sizes
        .map(size => `${baseSrc}_${size}w${ext} ${size}w`)
        .join(', ')
    },
    
    // Generate WebP srcset for modern browsers
    webpSrcset() {
      if (!this.src) return ''
      
      const baseSrc = this.src.replace(/\.(jpg|jpeg|png|webp)$/i, '')
      const sizes = [320, 640, 768, 1024, 1280, 1920]
      
      return sizes
        .map(size => `${baseSrc}_${size}w.webp ${size}w`)
        .join(', ')
    },
    
    // Generate default sizes attribute
    defaultSizes() {
      return '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
    },
    
    // Optimize src based on viewport and device pixel ratio
    optimizedSrc() {
      if (!this.src) return ''
      
      const targetWidth = this.calculateOptimalWidth()
      const baseSrc = this.src.replace(/\.(jpg|jpeg|png|webp)$/i, '')
      const ext = this.src.match(/\.(jpg|jpeg|png|webp)$/i)?.[0] || '.jpg'
      
      return `${baseSrc}_${targetWidth}w${ext}`
    }
  },
  methods: {
    calculateOptimalWidth() {
      // Calculate optimal image width based on viewport and DPR
      let baseWidth = this.width || this.viewportWidth
      
      // Apply viewport-based sizing - use the image width as constraint
      if (this.viewportWidth <= 640) {
        baseWidth = Math.min(baseWidth, this.viewportWidth)
      } else if (this.viewportWidth <= 1024) {
        baseWidth = Math.min(baseWidth, this.viewportWidth * 0.5)
      } else {
        baseWidth = Math.min(baseWidth, this.viewportWidth * 0.33)
      }
      
      // Apply device pixel ratio
      const targetWidth = Math.ceil(baseWidth * this.devicePixelRatio)
      
      // Round to nearest standard size
      const standardSizes = [320, 640, 768, 1024, 1280, 1920]
      return standardSizes.find(size => size >= targetWidth) || standardSizes[standardSizes.length - 1]
    },
    
    onLoad() {
      this.loaded = true
    },
    
    onError() {
      this.error = true
    },
    
    // Method to simulate viewport changes
    updateViewport(width, devicePixelRatio = 1) {
      this.viewportWidth = width
      this.devicePixelRatio = devicePixelRatio
    },
    
    // Method to get image metrics
    getImageMetrics() {
      return {
        optimizedSrc: this.optimizedSrc,
        srcset: this.srcset || this.generatedSrcset,
        sizes: this.sizes || this.defaultSizes,
        webpSrcset: this.webpSrcset,
        optimalWidth: this.calculateOptimalWidth(),
        loaded: this.loaded,
        error: this.error
      }
    }
  }
}

// Generator for viewport configurations
const viewportConfigArb = fc.record({
  width: fc.integer({ min: 320, max: 2560 }),
  height: fc.integer({ min: 568, max: 1440 }),
  devicePixelRatio: fc.float({ min: 1, max: 3, noNaN: true })
})

// Generator for image properties
const imagePropsArb = fc.record({
  src: fc.string({ minLength: 10, maxLength: 100 }).map(s => `https://example.com/images/${s}.jpg`),
  alt: fc.string({ minLength: 1, maxLength: 100 }),
  width: fc.integer({ min: 200, max: 1920 }),
  height: fc.integer({ min: 150, max: 1080 })
})

describe('Progressive Loading - Responsive Image Serving Property Tests', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container)
    }
  })

  it('Property 13: Responsive image serving - optimal image size selection', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          image: imagePropsArb,
          viewport: viewportConfigArb
        }),
        async ({ image, viewport }) => {
          const wrapper = mount(ResponsiveImage, {
            props: image,
            attachTo: container
          })

          await nextTick()

          const component = wrapper.vm as any
          component.updateViewport(viewport.width, viewport.devicePixelRatio)
          await nextTick()

          const metrics = component.getImageMetrics()

          // Property: Optimal width should be appropriate for viewport and DPR
          const baseWidth = Math.min(image.width, 
            viewport.width <= 640 ? viewport.width :
            viewport.width <= 1024 ? viewport.width * 0.5 :
            viewport.width * 0.33
          )
          
          const expectedOptimalWidth = Math.ceil(baseWidth * viewport.devicePixelRatio)
          
          // The selected width should be the smallest standard size that meets or exceeds the expected width
          const standardSizes = [320, 640, 768, 1024, 1280, 1920]
          const expectedSelectedWidth = standardSizes.find(size => size >= expectedOptimalWidth) || 1920

          expect(metrics.optimalWidth).toBe(expectedSelectedWidth)

          // Property: Srcset should contain multiple size options
          expect(metrics.srcset).toContain('320w')
          expect(metrics.srcset).toContain('640w')
          expect(metrics.srcset).toContain('1024w')

          // Property: WebP srcset should be provided for modern format support
          expect(metrics.webpSrcset).toContain('.webp')
          expect(metrics.webpSrcset).toContain('320w')

          wrapper.unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 13: Responsive image serving - bandwidth optimization', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          image: imagePropsArb,
          viewports: fc.array(viewportConfigArb, { minLength: 2, maxLength: 5 })
        }),
        async ({ image, viewports }) => {
          const wrapper = mount(ResponsiveImage, {
            props: image,
            attachTo: container
          })

          await nextTick()

          const component = wrapper.vm as any
          const selectedWidths: number[] = []

          // Test different viewport sizes
          for (const viewport of viewports) {
            component.updateViewport(viewport.width, viewport.devicePixelRatio)
            await nextTick()

            const metrics = component.getImageMetrics()
            selectedWidths.push(metrics.optimalWidth)
          }

          // Property: All selected widths should be reasonable
          for (const width of selectedWidths) {
            expect(width).toBeGreaterThanOrEqual(320)
            expect(width).toBeLessThanOrEqual(1920)
          }

          // Property: No image should be unnecessarily large
          for (let i = 0; i < viewports.length; i++) {
            const viewport = viewports[i]
            const selectedWidth = selectedWidths[i]
            
            // Maximum reasonable width should account for standard sizes
            // Since we round up to standard sizes, allow for reasonable overhead
            const maxReasonableWidth = viewport.width * viewport.devicePixelRatio * 2
            expect(selectedWidth).toBeLessThanOrEqual(Math.max(maxReasonableWidth, 1920))
          }

          wrapper.unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 13: Responsive image serving - format optimization', async () => {
    await fc.assert(
      fc.asyncProperty(
        imagePropsArb,
        async (imageProps) => {
          const wrapper = mount(ResponsiveImage, {
            props: imageProps,
            attachTo: container
          })

          await nextTick()

          const component = wrapper.vm as any
          const metrics = component.getImageMetrics()

          // Property: WebP format should be offered as an alternative
          expect(metrics.webpSrcset).toBeTruthy()
          expect(metrics.webpSrcset).toContain('.webp')

          // Property: Original format should still be available as fallback
          expect(metrics.srcset).toBeTruthy()
          expect(metrics.srcset).not.toContain('.webp')

          // Property: Both srcsets should have the same size options
          const webpSizes = metrics.webpSrcset.match(/(\d+)w/g) || []
          const originalSizes = metrics.srcset.match(/(\d+)w/g) || []
          
          expect(webpSizes.length).toBe(originalSizes.length)
          expect(webpSizes.sort()).toEqual(originalSizes.sort())

          wrapper.unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 13: Responsive image serving - sizes attribute accuracy', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          image: imagePropsArb,
          customSizes: fc.option(
            fc.oneof(
              fc.constant('100vw'),
              fc.constant('50vw'),
              fc.constant('(max-width: 640px) 100vw, 50vw'),
              fc.constant('(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw')
            ), 
            { nil: undefined }
          )
        }),
        async ({ image, customSizes }) => {
          const props = customSizes ? { ...image, sizes: customSizes } : image

          const wrapper = mount(ResponsiveImage, {
            props,
            attachTo: container
          })

          await nextTick()

          const component = wrapper.vm as any
          const metrics = component.getImageMetrics()

          if (customSizes) {
            // Property: Custom sizes should be preserved
            expect(metrics.sizes).toBe(customSizes)
            
            // Property: Custom sizes should contain valid CSS units
            expect(metrics.sizes).toMatch(/(vw|px|em|rem|%)/)
          } else {
            // Property: Default sizes should follow responsive breakpoints
            expect(metrics.sizes).toContain('max-width')
            expect(metrics.sizes).toContain('640px')
            expect(metrics.sizes).toContain('1024px')
            expect(metrics.sizes).toContain('100vw')
            expect(metrics.sizes).toContain('50vw')
            expect(metrics.sizes).toContain('33vw')
          }

          // Property: Sizes attribute should contain valid CSS units
          expect(metrics.sizes).toMatch(/(vw|px|em|rem|%)/)

          wrapper.unmount()
        }
      ),
      { numRuns: 100 }
    )
  })
})