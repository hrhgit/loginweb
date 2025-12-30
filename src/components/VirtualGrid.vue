<template>
  <div class="virtual-grid" :style="{ height: containerHeight + 'px' }" @scroll="handleScroll">
    <div class="virtual-grid__spacer" :style="{ height: offsetY + 'px' }"></div>
    <div class="virtual-grid__content">
      <slot :items="visibleItems"></slot>
    </div>
    <div class="virtual-grid__spacer" :style="{ height: (totalHeight - offsetY - visibleHeight) + 'px' }"></div>
  </div>
</template>

<script setup lang="ts" generic="T">
import { computed, onMounted, ref } from 'vue'

interface Props<T> {
  items: T[]
  itemHeight: number
  containerHeight: number
  columns?: number
  gap?: number
}

const props = withDefaults(defineProps<Props>(), {
  columns: 3,
  gap: 16
})

const scrollTop = ref(0)
const columns = computed(() => props.columns)
const gap = computed(() => props.gap)

// 计算每行的高度（包括间距）
const rowHeight = computed(() => props.itemHeight + gap.value)

// 计算总高度
const totalHeight = computed(() => {
  const rows = Math.ceil(props.items.length / columns.value)
  return rows * rowHeight.value
})

// 计算可见的起始行
const startRow = computed(() => {
  return Math.floor(scrollTop.value / rowHeight.value)
})

// 计算可见的行数
const visibleRows = computed(() => {
  return Math.ceil(props.containerHeight / rowHeight.value) + 1
})

// 计算可见的项目
const visibleItems = computed(() => {
  const startIndex = startRow.value * columns.value
  const endIndex = Math.min(
    (startRow.value + visibleRows.value) * columns.value,
    props.items.length
  )
  return props.items.slice(startIndex, endIndex)
})

// 计算偏移量
const offsetY = computed(() => {
  return startRow.value * rowHeight.value
})

// 计算可见高度
const visibleHeight = computed(() => {
  return visibleRows.value * rowHeight.value
})

const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement
  scrollTop.value = target.scrollTop
}

onMounted(() => {
  // 初始化滚动位置
  scrollTop.value = 0
})
</script>

<style scoped>
.virtual-grid {
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
}

.virtual-grid__spacer {
  flex-shrink: 0;
}

.virtual-grid__content {
  display: grid;
  grid-template-columns: repeat(v-bind(columns), 1fr);
  gap: v-bind('gap + "px"');
  padding: 0;
}

/* 响应式设计 */
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
</style>
