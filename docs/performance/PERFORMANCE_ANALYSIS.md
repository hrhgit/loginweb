# 活动详情页面性能问题分析

## 🔴 关键性能瓶颈

### 1. **SubmissionCard 中的 coverUrl 计算属性（最严重）**
**位置**: `src/components/showcase/SubmissionCard.vue` 第 57-75 行

**问题**:
```typescript
const coverUrl = computed(() => {
  // ... 每次都调用 supabase.storage.getPublicUrl()
  const { data } = supabase.storage
    .from('public-assets')
    .getPublicUrl(coverPath)
  return data.publicUrl
})
```

**为什么卡顿**:
- 每个 SubmissionCard 组件都有一个 `coverUrl` 计算属性
- 当有 50+ 个提交时，就有 50+ 个计算属性在不断重新计算
- 每次计算都调用 `supabase.storage.getPublicUrl()`，这是一个同步操作但涉及字符串处理
- 计算属性在任何响应式数据变化时都会重新执行（即使 cover_path 没变）
- 这导致浏览器主线程被大量计算占用，UI 渲染被阻塞

**影响范围**: 
- 页面初始加载时：50 个卡片 × 计算属性 = 50 次 URL 生成
- 任何状态变化时：所有 50 个计算属性都会重新执行

---

### 2. **formatSubmissionTime 计算属性（中等严重）**
**位置**: `src/components/showcase/SubmissionCard.vue` 第 85-110 行

**问题**:
```typescript
const formatSubmissionTime = computed(() => {
  const date = new Date(props.submission.created_at)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  // ... 复杂的时间计算逻辑
})
```

**为什么卡顿**:
- 每个卡片都在计算相对时间
- 这个计算涉及多个 Date 对象创建和时间计算
- 50 个卡片 = 50 次 Date 对象创建和计算
- 计算属性没有缓存，任何响应式变化都会重新计算

---

### 3. **truncatedIntro 计算属性（轻微）**
**位置**: `src/components/showcase/SubmissionCard.vue` 第 77-83 行

**问题**:
```typescript
const truncatedIntro = computed(() => {
  const intro = props.submission.intro
  if (!intro) return ''
  if (intro.length <= 80) return intro
  return intro.slice(0, 80) + '...'
})
```

**为什么卡顿**:
- 虽然逻辑简单，但 50 个卡片都在做字符串截断
- 累积效应明显

---

### 4. **过度的事件监听和 emit**
**位置**: `src/pages/EventDetailPage.vue` 第 1772-1790 行

**问题**:
```vue
<SubmissionCard
  v-for="submission in displayedSubmissions"
  :key="submission.id"
  :submission="submission"
  @click="handleSubmissionClick(submission)"
  @double-click="handleSubmissionDoubleClick(submission)"
  @title-click="handleSubmissionTitleClick(submission)"
>
```

**为什么卡顿**:
- 每个卡片都有 3 个事件监听器
- 50 个卡片 = 150 个事件监听器
- 事件处理函数虽然简单，但累积效应明显

---

### 5. **图片加载和渲染**
**位置**: `src/components/showcase/SubmissionCard.vue` 第 10-18 行

**问题**:
```vue
<img 
  v-if="coverUrl"
  :src="coverUrl" 
  :alt="submission.project_name"
  class="submission-card__image"
  @error="handleImageError"
/>
```

**为什么卡顿**:
- 50 个图片同时加载
- 浏览器需要处理 50 个 HTTP 请求
- 图片解码和渲染占用大量 GPU 资源
- 没有图片懒加载机制

---

### 6. **过度的 CSS 转换和动画**
**位置**: `src/components/showcase/SubmissionCard.vue` 第 130-160 行

**问题**:
```css
.submission-card {
  transition: all 0.18s ease;  /* 所有属性都有过渡 */
}

.submission-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.submission-card__image {
  transition: transform 0.18s ease;
}

.submission-card:hover .submission-card__image {
  transform: scale(1.02);
}
```

**为什么卡顿**:
- `transition: all` 会监听所有属性变化
- 50 个卡片都有这个过渡
- 任何样式变化都会触发 50 个过渡动画
- 浏览器需要不断重新计算和重绘

---

## 📊 性能问题总结

| 问题 | 严重程度 | 影响 | 数量 |
|------|--------|------|------|
| coverUrl 计算属性 | 🔴 严重 | 每个卡片都在调用 supabase API | 50+ |
| formatSubmissionTime 计算属性 | 🟠 中等 | Date 对象创建和计算 | 50+ |
| truncatedIntro 计算属性 | 🟡 轻微 | 字符串截断 | 50+ |
| 事件监听器 | 🟠 中等 | 150+ 个事件监听器 | 150+ |
| 图片加载 | 🟠 中等 | 50+ 个 HTTP 请求 | 50+ |
| CSS 过渡动画 | 🟠 中等 | 所有属性都有过渡 | 50+ |

---

## 🎯 优化方案

### 优先级 1（立即修复）
1. **移除 coverUrl 中的 supabase.storage 调用**
   - 预先生成 URL 或使用固定的 URL 模式
   - 避免在计算属性中调用 API

2. **使用虚拟滚动（Virtual Scrolling）**
   - 只渲染可见的卡片
   - 可以将 50 个卡片减少到 3-5 个实际 DOM 节点

3. **添加图片懒加载**
   - 使用 Intersection Observer API
   - 只加载可见的图片

### 优先级 2（重要优化）
4. **优化计算属性**
   - 使用 `useMemo` 或缓存
   - 避免在计算属性中进行复杂计算

5. **简化 CSS 过渡**
   - 使用 `transition: transform 0.18s ease` 替代 `transition: all`
   - 只过渡必要的属性

6. **减少事件监听器**
   - 使用事件委托
   - 或者使用 `@click.stop` 避免冒泡

### 优先级 3（长期优化）
7. **分页加载**
   - 初始只加载 20 个提交
   - 滚动到底部时加载更多

8. **预加载优化**
   - 预先生成图片 URL
   - 使用 CDN 加速图片加载

---

## 💡 根本原因

**主要原因**: 在 Vue 3 中，计算属性会在任何响应式依赖变化时重新执行。当有 50+ 个组件实例，每个都有多个计算属性时，任何状态变化都会导致大量重新计算，最终导致主线程被阻塞。

**次要原因**: 
- 没有使用虚拟滚动，所有 DOM 节点都在内存中
- 没有图片懒加载，所有图片同时加载
- CSS 过渡动画过于复杂

