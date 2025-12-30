/**
 * 图片懒加载指令
 * 使用 Intersection Observer API 实现高性能的图片懒加载
 * 
 * 用法: <img v-lazy-load="imageUrl" />
 */

import type { DirectiveBinding } from 'vue'

interface LazyLoadElement extends HTMLImageElement {
  _lazyLoadObserver?: IntersectionObserver
}

const lazyLoadObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement
        const src = img.dataset.src
        
        if (src) {
          img.src = src
          img.removeAttribute('data-src')
          lazyLoadObserver.unobserve(img)
        }
      }
    })
  },
  {
    rootMargin: '50px' // 提前 50px 开始加载
  }
)

export const vLazyLoad = {
  mounted(el: LazyLoadElement, binding: DirectiveBinding<string>) {
    if (binding.value) {
      el.dataset.src = binding.value
      el.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 225"%3E%3Crect fill="%23f0f0f0" width="400" height="225"/%3E%3C/svg%3E'
      lazyLoadObserver.observe(el)
      el._lazyLoadObserver = lazyLoadObserver
    }
  },
  
  updated(el: LazyLoadElement, binding: DirectiveBinding<string>) {
    if (binding.value && binding.value !== binding.oldValue) {
      el.dataset.src = binding.value
      if (!el.src || el.src.includes('data:image')) {
        lazyLoadObserver.observe(el)
      }
    }
  },
  
  unmounted(el: LazyLoadElement) {
    if (el._lazyLoadObserver) {
      el._lazyLoadObserver.unobserve(el)
    }
  }
}
