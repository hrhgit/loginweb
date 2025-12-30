<template>
  <picture class="responsive-image" :class="imageClasses">
    <!-- WebP source for modern browsers -->
    <source 
      v-if="enableWebP && webpSrcset"
      :srcset="webpSrcset" 
      :sizes="computedSizes"
      type="image/webp"
    />
    
    <!-- Fallback source -->
    <source 
      v-if="computedSrcset"
      :srcset="computedSrcset" 
      :sizes="computedSizes"
      :type="imageType"
    />
    
    <!-- Main image element -->
    <img 
      :src="optimizedSrc"
      :alt="alt"
      :width="width"
      :height="height"
      :loading="loading"
      :class="['responsive-image__img', { 'loaded': imageLoaded, 'error': imageError }]"
      :style="imageStyle"
      @load="onImageLoad"
      @error="onImageError"
      ref="imageElement"
    />
    
    <!-- Loading placeholder -->
    <div 
      v-if="showPlaceholder && !imageLoaded && !imageError"
      class="responsive-image__placeholder"
      :style="placeholderStyle"
    >
      <div class="placeholder-content">
        <div v-if="showLoadingSpinner" class="loading-spinner"></div>
        <span v-if="placeholderText">{{ placeholderText }}</span>
      </div>
    </div>
    
    <!-- Error state -->
    <div 
      v-if="imageError && showErrorState"
      class="responsive-image__error"
      :style="errorStyle"
    >
      <div class="error-content">
        <span>{{ errorText || 'Failed to load image' }}</span>
        <button v-if="allowRetry" @click="retryLoad" class="retry-button">
          Retry
        </button>
      </div>
    </div>
  </picture>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { 
  generateResponsiveSrcset, 
  generateWebPSrcset, 
  generateDefaultSizes,
  calculateOptimalImageWidth,
  progressiveLoadingTracker
} from '../utils/progressiveLoading'

interface Props {
  src: string
  alt: string
  width?: number
  height?: number
  sizes?: string
  srcset?: string
  quality?: number
  loading?: 'lazy' | 'eager'
  enableWebP?: boolean
  showPlaceholder?: boolean
  placeholderColor?: string
  placeholderText?: string
  showLoadingSpinner?: boolean
  showErrorState?: boolean
  errorText?: string
  allowRetry?: boolean
  aspectRatio?: string
  objectFit?: 'cover' | 'contain' | 'fill' | 'scale-down' | 'none'
  borderRadius?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: 'lazy',
  enableWebP: true,
  showPlaceholder: true,
  placeholderColor: '#f0f0f0',
  showLoadingSpinner: true,
  showErrorState: true,
  allowRetry: true,
  objectFit: 'cover'
})

const emit = defineEmits<{
  load: [event: Event]
  error: [event: Event]
  retry: []
}>()

// Reactive state
const imageElement = ref<HTMLImageElement>()
const imageLoaded = ref(false)
const imageError = ref(false)
const loadStartTime = ref<number>()
const retryCount = ref(0)

// Computed properties
const devicePixelRatio = computed(() => 
  typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
)

const viewportWidth = computed(() => 
  typeof window !== 'undefined' ? window.innerWidth : 1024
)

const optimalWidth = computed(() => 
  calculateOptimalImageWidth(viewportWidth.value, devicePixelRatio.value, props.width)
)

const optimizedSrc = computed(() => {
  if (!props.src) return ''
  
  const baseSrc = props.src.replace(/\.(jpg|jpeg|png|webp)$/i, '')
  const ext = props.src.match(/\.(jpg|jpeg|png|webp)$/i)?.[0] || '.jpg'
  
  return `${baseSrc}_${optimalWidth.value}w${ext}`
})

const computedSrcset = computed(() => {
  if (props.srcset) return props.srcset
  if (!props.src) return ''
  
  return generateResponsiveSrcset(props.src)
})

const webpSrcset = computed(() => {
  if (!props.enableWebP || !props.src) return ''
  
  return generateWebPSrcset(props.src)
})

const computedSizes = computed(() => {
  return props.sizes || generateDefaultSizes()
})

const imageType = computed(() => {
  if (!props.src) return ''
  
  const ext = props.src.match(/\.(jpg|jpeg|png|webp)$/i)?.[1]?.toLowerCase()
  
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    default:
      return 'image/jpeg'
  }
})

const imageClasses = computed(() => ({
  'responsive-image--loaded': imageLoaded.value,
  'responsive-image--error': imageError.value,
  'responsive-image--loading': !imageLoaded.value && !imageError.value
}))

const imageStyle = computed(() => ({
  aspectRatio: props.aspectRatio,
  objectFit: props.objectFit,
  borderRadius: props.borderRadius,
  width: '100%',
  height: '100%'
}))

const placeholderStyle = computed(() => ({
  backgroundColor: props.placeholderColor,
  aspectRatio: props.aspectRatio,
  borderRadius: props.borderRadius
}))

const errorStyle = computed(() => ({
  backgroundColor: '#f5f5f5',
  aspectRatio: props.aspectRatio,
  borderRadius: props.borderRadius
}))

// Methods
const onImageLoad = (event: Event) => {
  imageLoaded.value = true
  imageError.value = false
  
  if (loadStartTime.value) {
    const loadTime = performance.now() - loadStartTime.value
    progressiveLoadingTracker.recordImageLoad(loadTime, false)
  }
  
  emit('load', event)
}

const onImageError = (event: Event) => {
  imageError.value = true
  imageLoaded.value = false
  
  emit('error', event)
}

const retryLoad = () => {
  if (retryCount.value >= 3) return // Max 3 retries
  
  retryCount.value++
  imageError.value = false
  imageLoaded.value = false
  loadStartTime.value = performance.now()
  
  if (imageElement.value) {
    // Force reload by changing src
    const currentSrc = imageElement.value.src
    imageElement.value.src = ''
    setTimeout(() => {
      if (imageElement.value) {
        imageElement.value.src = currentSrc
      }
    }, 100)
  }
  
  emit('retry')
}

// Watchers
watch(() => props.src, (newSrc) => {
  if (newSrc) {
    imageLoaded.value = false
    imageError.value = false
    retryCount.value = 0
    loadStartTime.value = performance.now()
  }
}, { immediate: true })

// Lifecycle
onMounted(() => {
  if (props.src) {
    loadStartTime.value = performance.now()
  }
})
</script>

<style scoped>
.responsive-image {
  position: relative;
  display: block;
  width: 100%;
  overflow: hidden;
}

.responsive-image__img {
  display: block;
  width: 100%;
  height: auto;
  transition: opacity 0.3s ease;
  opacity: 0;
}

.responsive-image__img.loaded {
  opacity: 1;
}

.responsive-image__img.error {
  display: none;
}

.responsive-image__placeholder,
.responsive-image__error {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.responsive-image--loaded .responsive-image__placeholder {
  display: none;
}

.placeholder-content,
.error-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 14px;
  text-align: center;
  padding: 16px;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border);
  border-top: 2px solid var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.retry-button {
  padding: 4px 12px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.2s ease;
}

.retry-button:hover {
  background: var(--accent-2);
}

.error-content {
  color: var(--danger);
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .responsive-image__img {
    transition: none;
  }
  
  .loading-spinner {
    animation: none;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .responsive-image__placeholder,
  .responsive-image__error {
    border: 2px solid currentColor;
  }
}
</style>