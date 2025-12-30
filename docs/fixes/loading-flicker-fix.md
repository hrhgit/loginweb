# 加载闪烁问题修复

## 问题描述

在主页加载卡片时会遇到闪烁现象：
1. 卡片先显示出来（可能是缓存数据）
2. 然后被"正在加载"状态替换
3. 最后又马上加载出来

## 问题原因

1. **多重加载状态冲突**：
   - `eventsLoading` - 事件数据加载状态
   - `networkAwareLoading` - 网络感知加载状态
   - 两个状态的时序不同步

2. **状态切换时序问题**：
   - 初始时显示卡片（缓存数据）
   - `networkAwareLoading` 变为 true → 显示加载状态
   - `eventsLoading` 变为 true
   - 两个状态都变为 false → 重新显示卡片

3. **条件渲染逻辑问题**：
   ```vue
   <!-- 原有的问题代码 -->
   <LoadingStateIndicator v-if="isNetworkAwareLoading" />
   <section v-else-if="store.eventsLoading" class="skeleton-grid" />
   ```

## 解决方案

### 1. 优化加载状态逻辑

```vue
<!-- 修复后的代码 -->
<script setup>
// 防止闪烁：只有在真正需要加载且没有数据时才显示加载状态
const shouldShowLoading = computed(() => {
  // 如果已经有数据，即使在加载中也不显示加载状态（避免闪烁）
  if (store.publicEvents.length > 0) return false
  
  // 如果数据已加载完成且没有数据，不显示加载状态（显示空状态）
  if (store.eventsLoaded && store.publicEvents.length === 0) return false
  
  // 只有在真正加载中且没有数据时才显示加载状态
  return isLoading.value
})
</script>

<template>
  <!-- 只在真正需要时显示加载状态 -->
  <LoadingStateIndicator v-if="shouldShowLoading" />
  
  <!-- 骨架屏作为备用 -->
  <section v-else-if="isLoading && !store.eventsLoaded" class="skeleton-grid" />
  
  <!-- 内容区域 -->
  <template v-else>
    <!-- 实际内容 -->
  </template>
</template>
```

### 2. 优化刷新逻辑

```vue
<script setup>
// 独立的刷新状态，避免与数据加载状态混淆
const isRefreshing = ref(false)

const handleRefresh = async () => {
  try {
    isRefreshing.value = true
    await store.loadEvents()
  } catch (error) {
    console.error('Failed to refresh events:', error)
  } finally {
    isRefreshing.value = false
  }
}
</script>
```

### 3. 统一加载状态管理

```vue
<script setup>
// 合并所有相关的加载状态
const isLoading = computed(() => 
  store.eventsLoading || store.networkAwareLoading
)

// 按钮状态考虑刷新状态
const isButtonDisabled = computed(() => 
  isLoading.value || isRefreshing.value
)
</script>
```

### 4. 详情页面加载优化

```typescript
// 修复前的问题代码
const loadEvent = async (id: string) => {
  loading.value = true  // 立即显示加载状态
  
  await store.ensureEventsLoaded()
  const cached = store.getEventById(id)
  if (cached) {
    event.value = cached  // 有缓存数据
    // ...
    loading.value = false  // 关闭加载状态 -> 造成闪烁
    return
  }
  // ...
}

// 修复后的代码
const loadEvent = async (id: string) => {
  // 先检查缓存，避免不必要的加载状态
  await store.ensureEventsLoaded()
  const cached = store.getEventById(id)
  
  if (cached) {
    // 有缓存数据时直接使用，不显示加载状态
    event.value = cached
    // ... 其他操作
    return
  }

  // 只有在没有缓存数据时才显示加载状态
  loading.value = true
  // ... 处理无缓存情况
  loading.value = false
}
```

```vue
<!-- 模板优化 -->
<template>
  <!-- 只有在真正需要加载且没有数据时才显示加载状态 -->
  <section v-if="loading && !event" class="detail-loading">
    <div class="skeleton-card"></div>
  </section>
  
  <section v-else-if="error && !event" class="empty-state">
    <!-- 错误状态 -->
  </section>
  
  <section v-else-if="event" class="detail-content">
    <!-- 实际内容 -->
  </section>
</template>
```

## 修复效果

- ✅ 消除了卡片加载时的闪烁现象
- ✅ 保持了良好的用户体验
- ✅ 维持了网络感知功能
- ✅ 保留了所有原有功能

## 涉及文件

- `src/pages/EventsPage.vue` - 主要事件列表页面
- `src/pages/MyEventsPage.vue` - 我的事件页面
- `src/pages/EventDetailPage.vue` - 事件详情页面
- `src/pages/TeamDetailPage.vue` - 团队详情页面
- `src/pages/SubmissionPage.vue` - 作品提交页面（新增修复）
- `src/pages/SubmissionDetailPage.vue` - 作品详情页面（新增修复）
- `src/utils/loadingStateOptimization.ts` - 加载状态优化工具（新增）

## 最佳实践

1. **数据优先原则**：如果已有数据，优先显示数据而不是加载状态
2. **状态分离**：将刷新状态与数据加载状态分开管理
3. **条件优化**：使用计算属性优化复杂的条件判断
4. **用户体验**：避免不必要的状态切换造成的视觉干扰