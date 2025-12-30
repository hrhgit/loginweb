/**
 * Integration test for progressive loading features
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ResponsiveImage from '../components/ResponsiveImage.vue'
import EnhancedVirtualGrid from '../components/EnhancedVirtualGrid.vue'
import { 
  generateResponsiveSrcset, 
  generateWebPSrcset, 
  calculateOptimalImageWidth,
  progressiveLoadingTracker
} from '../utils/progressiveLoading'

describe('Progressive Loading Integration', () => {
  it('should generate responsive srcsets correctly', () => {
    const baseUrl = 'https://example.com/image.jpg'
    const srcset = generateResponsiveSrcset(baseUrl)
    
    expect(srcset).toContain('320w')
    expect(srcset).toContain('640w')
    expect(srcset).toContain('1024w')
    expect(srcset).toContain('1920w')
  })

  it('should generate WebP srcsets correctly', () => {
    const baseUrl = 'https://example.com/image.jpg'
    const webpSrcset = generateWebPSrcset(baseUrl)
    
    expect(webpSrcset).toContain('.webp')
    expect(webpSrcset).toContain('320w')
    expect(webpSrcset).toContain('640w')
  })

  it('should calculate optimal image width based on viewport', () => {
    // Small viewport
    const smallWidth = calculateOptimalImageWidth(320, 1)
    expect(smallWidth).toBe(320)
    
    // Medium viewport
    const mediumWidth = calculateOptimalImageWidth(768, 1)
    expect(mediumWidth).toBe(640) // 768 * 0.5 = 384, rounds up to 640
    
    // Large viewport with high DPR
    const largeWidth = calculateOptimalImageWidth(1200, 2)
    expect(largeWidth).toBe(1024) // 1200 * 0.33 * 2 = 792, rounds up to 1024
  })

  it('should render ResponsiveImage component correctly', async () => {
    const wrapper = mount(ResponsiveImage, {
      props: {
        src: 'https://example.com/test.jpg',
        alt: 'Test image',
        width: 400,
        height: 300
      }
    })

    await nextTick()

    // Check that picture element is rendered
    expect(wrapper.find('picture').exists()).toBe(true)
    
    // Check that img element has correct attributes
    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('alt')).toBe('Test image')
    
    // Check that WebP source is present
    const webpSource = wrapper.find('source[type="image/webp"]')
    expect(webpSource.exists()).toBe(true)
  })

  it('should render EnhancedVirtualGrid component correctly', async () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` }))
    
    const wrapper = mount(EnhancedVirtualGrid, {
      props: {
        items,
        itemHeight: 60,
        containerHeight: 300,
        columns: 2
      }
    })

    await nextTick()

    // Check that virtual grid container is rendered
    expect(wrapper.find('.enhanced-virtual-grid').exists()).toBe(true)
    
    // Check that only visible items are rendered (not all 100)
    const renderedItems = wrapper.findAll('.virtual-grid__item')
    expect(renderedItems.length).toBeLessThan(items.length)
    expect(renderedItems.length).toBeGreaterThan(0)
  })

  it('should track performance metrics', () => {
    // Reset tracker
    progressiveLoadingTracker.reset()
    
    // Record some metrics
    progressiveLoadingTracker.recordImageLoad(150, false)
    progressiveLoadingTracker.recordImageLoad(200, true)
    progressiveLoadingTracker.setImageTotal(10)
    progressiveLoadingTracker.setVirtualScrollMetrics(5, 100)
    
    const metrics = progressiveLoadingTracker.getMetrics()
    
    expect(metrics.imagesLoaded).toBe(2)
    expect(metrics.imagesTotal).toBe(10)
    expect(metrics.averageLoadTime).toBe(175) // (150 + 200) / 2
    expect(metrics.cacheHitRate).toBe(50) // 1 hit out of 2 total
    expect(metrics.virtualScrollActive).toBe(true)
    expect(metrics.renderedItems).toBe(5)
    expect(metrics.totalItems).toBe(100)
  })
})