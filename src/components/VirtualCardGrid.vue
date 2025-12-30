<template>
  <div 
    ref="containerRef"
    class="virtual-card-grid"
    :style="containerStyle"
    @scroll="handleScroll"
  >
    <!-- 顶部占位 -->
    <div class="virtual-card-grid__spacer" :style="{ height: topSpacerHeight + 'px' }"></div>
    
    <!-- 可见内容区域 - 使用原有的 grid class -->
    <div :class="gridClass">
      <slot :items="visibleItems" :start-index="startIndex"></slot>
    </div>
    
    <!-- 底部占位 -->
    <div class="virtual-card-grid__spacer" :style="{ height: bottomSpacerHeight + 'px' }"></div>
  </div>
</template>

<script setup lang="ts" generic="T">
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'

interface Props {
  /** 所有数据项 */
  items: T[]
  /** 每个卡片的预估高度 */
  itemHeight: number
  /** 容器最大高度，超过此高度启用虚拟滚动 */
  maxHeight?: number
  /** 列数 */
  columns?: number
  /** 行间距 */
  gap?: number
  /** 预渲染的额外行数 */
  overscan?: number
  /** 原有的 grid class 名称 */
  gridClass?: string
  /** 唯一标识字段 */
  keyField?: keyof T | ((item: T) => string | number)
  /** 是否启用虚拟滚动（数据量小时可禁用） */
  enabled?: boolean
  /** 启用虚拟滚动的最小数据量 */
  minItemsForVirtual?: number
}

const props = withDefaults(defineProps<Props>(), {
  maxHeight: 800,
  columns: 3,
  gap: 14,
  overscan: 2,
  gridClass: 'team-grid',
  enabled: true,
  minItemsForVirtual: 12
})

const emit = defineEmits<{
  scroll: [{ scrollTop: number; direction: 'up' | 'down' }]
}>()

const containerRef = ref<HTMLElement>()
const scrollTop = ref(0)
const lastScrollTop = ref(0)
const containerHeight = ref(props.maxHeight)

// 响应式列数计算
const responsiveColumns = ref(props.columns)

const updateResponsiveColumns = () => {
  const width = window.innerWidth
  if (width <= 640) {
    responsiveColumns.value = 1
  } else if (width <= 980) {
    responsiveColumns.value = 2
  } else {
    responsiveColumns.value = props.columns
  }
}

// 是否启用虚拟滚动
const shouldVirtualize = computed(() => {
  return props.enabled && props.items.length >= props.minItemsForVirtual
})

// 每行高度（包含间距）
const rowHeight = computed(() => props.itemHeight + props.gap)

// 总行数
const totalRows = computed(() => Math.ceil(props.items.length / responsiveColumns.value))

// 总高度
const totalHeight = computed(() => {
  if (totalRows.value === 0) return 0
  return totalRows.value * rowHeight.value - props.gap // 最后一行不需要间距
})

// 可见行数
const visibleRows = computed(() => {
  return Math.ceil(containerHeight.value / rowHeight.value) + props.overscan * 2
})

// 起始行索引
const startRow = computed(() => {
  if (!shouldVirtualize.value) return 0
  return Math.max(0, Math.floor(scrollTop.value / rowHeight.value) - props.overscan)
})

// 结束行索引
const endRow = computed(() => {
  if (!shouldVirtualize.value) return totalRows.value - 1
  return Math.min(totalRows.value - 1, startRow.value + visibleRows.value)
})

// 起始数据索引
const startIndex = computed(() => startRow.value * responsiveColumns.value)

// 结束数据索引
const endIndex = computed(() => {
  return Math.min(
    (endRow.value + 1) * responsiveColumns.value,
    props.items.length
  )
})

// 可见的数据项
const visibleItems = computed(() => {
  if (!shouldVirtualize.value) return props.items
  return props.items.slice(startIndex.value, endIndex.value)
})

// 顶部占位高度
const topSpacerHeight = computed(() => {
  if (!shouldVirtualize.value) return 0
  return startRow.value * rowHeight.value
})

// 底部占位高度
const bottomSpacerHeight = computed(() => {
  if (!shouldVirtualize.value) return 0
  const renderedRows = endRow.value - startRow.value + 1
  const remainingRows = totalRows.value - startRow.value - renderedRows
  return Math.max(0, remainingRows * rowHeight.value)
})

// 容器样式
const containerStyle = computed(() => {
  if (!shouldVirtualize.value) {
    return {}
  }
  return {
    maxHeight: `${props.maxHeight}px`,
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const
  }
})

// 滚动处理
let scrollTimeout: number | null = null
const handleScroll = (event: Event) => {
  if (!shouldVirtualize.value) return
  
  const target = event.target as HTMLElement
  const newScrollTop = target.scrollTop
  
  // 使用 requestAnimationFrame 优化滚动性能
  if (scrollTimeout) {
    cancelAnimationFrame(scrollTimeout)
  }
  
  scrollTimeout = requestAnimationFrame(() => {
    scrollTop.value = newScrollTop
    
    const direction = newScrollTop > lastScrollTop.value ? 'down' : 'up'
    lastScrollTop.value = newScrollTop
    
    emit('scroll', { scrollTop: newScrollTop, direction })
  })
}

// 获取项目的唯一标识
const getItemKey = (item: T, index: number): string | number => {
  if (typeof props.keyField === 'function') {
    return props.keyField(item)
  } else if (props.keyField && typeof item === 'object' && item !== null) {
    return (item as any)[props.keyField] ?? index
  }
  return index
}

// 滚动到指定索引
const scrollToIndex = (index: number, behavior: ScrollBehavior = 'smooth') => {
  if (!containerRef.value || !shouldVirtualize.value) return
  
  const row = Math.floor(index / responsiveColumns.value)
  const targetScrollTop = row * rowHeight.value
  
  containerRef.value.scrollTo({
    top: targetScrollTop,
    behavior
  })
}

// 滚动到顶部
const scrollToTop = (behavior: ScrollBehavior = 'smooth') => {
  scrollToIndex(0, behavior)
}

// 监听窗口大小变化
onMounted(() => {
  updateResponsiveColumns()
  window.addEventListener('resize', updateResponsiveColumns)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateResponsiveColumns)
  if (scrollTimeout) {
    cancelAnimationFrame(scrollTimeout)
  }
})

// 数据变化时重置滚动位置
watch(() => props.items.length, () => {
  nextTick(() => {
    if (containerRef.value) {
      scrollTop.value = containerRef.value.scrollTop
    }
  })
})

// 暴露方法
defineExpose({
  scrollToIndex,
  scrollToTop,
  getItemKey,
  containerRef
})
</script>

<style scoped>
.virtual-card-grid {
  position: relative;
}

.virtual-card-grid__spacer {
  flex-shrink: 0;
  pointer-events: none;
}

/* 滚动条样式 */
.virtual-card-grid::-webkit-scrollbar {
  width: 8px;
}

.virtual-card-grid::-webkit-scrollbar-track {
  background: var(--surface-muted);
  border-radius: 4px;
}

.virtual-card-grid::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 4px;
}

.virtual-card-grid::-webkit-scrollbar-thumb:hover {
  background: var(--muted);
}

/* 无障碍支持 */
@media (prefers-reduced-motion: reduce) {
  .virtual-card-grid {
    scroll-behavior: auto;
  }
}
</style>
