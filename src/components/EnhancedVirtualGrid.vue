<template>
  <div 
    class="enhanced-virtual-grid" 
    :style="containerStyle"
    @scroll="handleScroll"
    ref="container"
  >
    <!-- Loading indicator -->
    <div v-if="loading" class="virtual-grid__loading">
      <div class="loading-spinner"></div>
      <span>Loading items...</span>
    </div>
    
    <!-- Virtual scroll content -->
    <template v-else>
      <div class="virtual-grid__spacer-top" :style="{ height: offsetY + 'px' }"></div>
      
      <div class="virtual-grid__content" :style="contentStyle">
        <div 
          v-for="(item, index) in visibleItems" 
          :key="getItemKey(item, startIndex + index)"
          class="virtual-grid__item"
          :style="itemStyle"
        >
          <slot 
            :item="item" 
            :index="startIndex + index"
            :isVisible="true"
          >
            {{ item }}
          </slot>
        </div>
      </div>
      
      <div class="virtual-grid__spacer-bottom" :style="{ height: bottomSpacerHeight + 'px' }"></div>
    </template>
    
    <!-- Performance metrics (dev mode) -->
    <div v-if="showMetrics && isDev" class="virtual-grid__metrics">
      <div>Rendered: {{ visibleItems.length }} / {{ items.length }}</div>
      <div>Ratio: {{ renderRatio.toFixed(2) }}%</div>
      <div>Scroll: {{ scrollTop }}px</div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { debounce, calculateVirtualScrollParams, progressiveLoadingTracker } from '../utils/progressiveLoading'

interface Props<T> {
  items: T[]
  itemHeight: number
  containerHeight: number
  columns?: number
  gap?: number
  overscan?: number
  loading?: boolean
  keyField?: keyof T | ((item: T) => string | number)
  threshold?: number
  enableMetrics?: boolean
  showMetrics?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  columns: 3,
  gap: 16,
  overscan: 5,
  loading: false,
  threshold: 100,
  enableMetrics: true,
  showMetrics: false
})

const emit = defineEmits<{
  scroll: [{ scrollTop: number; direction: 'up' | 'down' }]
  visibilityChange: [{ startIndex: number; endIndex: number; visibleItems: T[] }]
  loadMore: []
}>()

const container = ref<HTMLElement>()
const scrollTop = ref(0)
const lastScrollTop = ref(0)
const isDev = ref(import.meta.env.DEV)

// Computed properties
const columns = computed(() => props.columns)
const gap = computed(() => props.gap)

const rowHeight = computed(() => props.itemHeight + gap.value)

const totalRows = computed(() => Math.ceil(props.items.length / columns.value))

const totalHeight = computed(() => totalRows.value * rowHeight.value)

const scrollParams = computed(() => 
  calculateVirtualScrollParams(
    scrollTop.value,
    rowHeight.value,
    props.containerHeight,
    totalRows.value,
    props.overscan
  )
)

const startIndex = computed(() => scrollParams.value.startIndex * columns.value)
const endIndex = computed(() => Math.min(
  (scrollParams.value.endIndex + 1) * columns.value - 1,
  props.items.length - 1
))

const visibleItems = computed(() => {
  const start = startIndex.value
  const end = endIndex.value + 1
  return props.items.slice(start, end)
})

const offsetY = computed(() => scrollParams.value.offsetY)

const bottomSpacerHeight = computed(() => {
  const remainingRows = totalRows.value - (scrollParams.value.endIndex + 1)
  return Math.max(0, remainingRows * rowHeight.value)
})

const renderRatio = computed(() => {
  if (props.items.length === 0) return 0
  return (visibleItems.value.length / props.items.length) * 100
})

// Styles
const containerStyle = computed(() => ({
  height: `${props.containerHeight}px`,
  overflow: 'auto',
  position: 'relative'
}))

const contentStyle = computed(() => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${columns.value}, 1fr)`,
  gap: `${gap.value}px`,
  padding: '0'
}))

const itemStyle = computed(() => ({
  minHeight: `${props.itemHeight}px`
}))

// Methods
const getItemKey = (item: T, index: number): string | number => {
  if (typeof props.keyField === 'function') {
    return props.keyField(item)
  } else if (props.keyField && typeof item === 'object' && item !== null) {
    return (item as any)[props.keyField] ?? index
  }
  return index
}

const handleScroll = debounce((event: Event) => {
  const target = event.target as HTMLElement
  const newScrollTop = target.scrollTop
  
  scrollTop.value = newScrollTop
  
  const direction = newScrollTop > lastScrollTop.value ? 'down' : 'up'
  lastScrollTop.value = newScrollTop
  
  emit('scroll', { scrollTop: newScrollTop, direction })
  
  // Check if near bottom for infinite scroll
  const scrollHeight = target.scrollHeight
  const clientHeight = target.clientHeight
  const threshold = props.threshold
  
  if (scrollHeight - (newScrollTop + clientHeight) < threshold) {
    emit('loadMore')
  }
}, 16) // ~60fps

const scrollToIndex = (index: number, behavior: ScrollBehavior = 'smooth'): void => {
  if (!container.value) return
  
  const row = Math.floor(index / columns.value)
  const targetScrollTop = row * rowHeight.value
  
  container.value.scrollTo({
    top: targetScrollTop,
    behavior
  })
}

const scrollToTop = (behavior: ScrollBehavior = 'smooth'): void => {
  scrollToIndex(0, behavior)
}

const getVisibleRange = () => ({
  startIndex: startIndex.value,
  endIndex: endIndex.value,
  visibleItems: visibleItems.value
})

// Watchers
watch(
  () => ({ start: startIndex.value, end: endIndex.value, items: visibleItems.value }),
  (newRange) => {
    emit('visibilityChange', {
      startIndex: newRange.start,
      endIndex: newRange.end,
      visibleItems: newRange.items
    })
    
    // Update performance metrics
    if (props.enableMetrics) {
      progressiveLoadingTracker.setVirtualScrollMetrics(
        visibleItems.value.length,
        props.items.length
      )
    }
  },
  { immediate: true }
)

// Lifecycle
onMounted(() => {
  scrollTop.value = 0
})

onUnmounted(() => {
  // Clean up any pending debounced calls
})

// Expose methods
defineExpose({
  scrollToIndex,
  scrollToTop,
  getVisibleRange,
  container
})
</script>

<style scoped>
.enhanced-virtual-grid {
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
}

.virtual-grid__spacer-top,
.virtual-grid__spacer-bottom {
  flex-shrink: 0;
}

.virtual-grid__content {
  display: grid;
  gap: v-bind('gap + "px"');
  padding: 0;
}

.virtual-grid__item {
  display: flex;
  flex-direction: column;
}

.virtual-grid__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  gap: 16px;
  color: var(--muted);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border);
  border-top: 3px solid var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.virtual-grid__metrics {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  font-family: monospace;
  z-index: 1000;
}

.virtual-grid__metrics > div {
  margin-bottom: 2px;
}

/* Responsive design */
@media (max-width: 1200px) {
  .virtual-grid__content {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .virtual-grid__content {
    grid-template-columns: 1fr;
  }
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .loading-spinner {
    animation: none;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .virtual-grid__metrics {
    border: 2px solid white;
  }
}
</style>