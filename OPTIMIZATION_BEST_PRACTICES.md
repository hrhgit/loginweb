# Vue 3 性能优化最佳实践指南

基于活动详情页面的优化经验，这是一份通用的性能优化指南。

## 🎯 核心原则

### 1. 避免在计算属性中调用 API
```typescript
// ❌ 不好 - 每次计算属性执行都调用 API
const imageUrl = computed(() => {
  return supabase.storage.getPublicUrl(path).data.publicUrl
})

// ✅ 好 - 使用纯函数生成 URL
const generateUrl = (path: string) => {
  return `${baseUrl}/storage/v1/object/public/${path}`
}
const imageUrl = computed(() => generateUrl(props.path))
```

### 2. 优化 CSS 过渡
```css
/* ❌ 不好 - 监听所有属性 */
.card {
  transition: all 0.3s ease;
}

/* ✅ 好 - 只过渡必要的属性 */
.card {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
```

### 3. 实现图片懒加载
```vue
<!-- ❌ 不好 - 一次性加载所有图片 -->
<img v-for="item in items" :src="item.image" />

<!-- ✅ 好 - 使用懒加载指令 -->
<img v-for="item in items" v-lazy-load="item.image" />
```

### 4. 实现分页或虚拟滚动
```typescript
// ❌ 不好 - 一次性渲染所有项目
const displayedItems = computed(() => items.value)

// ✅ 好 - 分页加载
const itemsPerPage = 20
const currentPage = ref(1)
const displayedItems = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  return items.value.slice(start, start + itemsPerPage)
})
```

---

## 📋 性能检查清单

### 组件级别
- [ ] 计算属性中没有 API 调用
- [ ] 计算属性中没有复杂的循环或递归
- [ ] 使用了 `v-show` 而不是 `v-if`（对于频繁切换的元素）
- [ ] 列表项有唯一的 `:key`
- [ ] 没有在模板中进行复杂计算
- [ ] 使用了 `Object.freeze()` 处理不需要响应式的大对象

### 样式级别
- [ ] 没有使用 `transition: all`
- [ ] 避免了过度的 box-shadow
- [ ] 使用了 `will-change` 优化动画性能
- [ ] 避免了频繁的 DOM 重排

### 数据加载级别
- [ ] 实现了分页或虚拟滚动
- [ ] 实现了图片懒加载
- [ ] 使用了请求缓存
- [ ] 避免了 N+1 查询问题

### 渲染级别
- [ ] 使用了 `v-memo` 缓存不变的子树
- [ ] 使用了 `<Suspense>` 处理异步组件
- [ ] 使用了 `<Teleport>` 避免深层嵌套
- [ ] 避免了过度的 watcher

---

## 🛠️ 常见优化技巧

### 1. 使用 v-memo 缓存子树
```vue
<template>
  <!-- 只有当 item 变化时才重新渲染 -->
  <div v-memo="[item]">
    <h3>{{ item.title }}</h3>
    <p>{{ item.description }}</p>
  </div>
</template>
```

### 2. 使用 Object.freeze 冻结对象
```typescript
// 对于不需要响应式的大对象
const staticData = Object.freeze({
  items: [...],
  config: {...}
})
```

### 3. 使用 shallowRef 处理大对象
```typescript
// 对于不需要深层响应式的对象
const largeObject = shallowRef({
  data: [...] // 这个不会被深层监听
})
```

### 4. 使用 shallowReactive 处理大数组
```typescript
// 对于大数组，避免深层响应式
const items = shallowReactive([...])
```

### 5. 使用 computed 缓存计算结果
```typescript
// ✅ 好 - 结果被缓存，只在依赖变化时重新计算
const filteredItems = computed(() => {
  return items.value.filter(item => item.active)
})

// ❌ 不好 - 每次都重新计算
const filteredItems = () => {
  return items.value.filter(item => item.active)
}
```

### 6. 使用 watchEffect 替代 watch
```typescript
// ✅ 好 - 自动追踪依赖
watchEffect(() => {
  console.log(count.value)
})

// ❌ 不好 - 需要手动指定依赖
watch(count, () => {
  console.log(count.value)
})
```

---

## 📊 性能监控

### 使用 Performance API
```typescript
// 测量函数执行时间
const measurePerformance = async (name: string, fn: () => Promise<void>) => {
  const start = performance.now()
  await fn()
  const end = performance.now()
  console.log(`${name} took ${end - start}ms`)
}

// 使用
await measurePerformance('loadData', async () => {
  await store.loadSubmissions(eventId)
})
```

### 使用 Chrome DevTools
1. 打开 Performance 标签
2. 点击录制按钮
3. 执行操作
4. 停止录制
5. 分析火焰图

### 关键指标
- **FCP (First Contentful Paint)**: < 1.8s
- **LCP (Largest Contentful Paint)**: < 2.5s
- **CLS (Cumulative Layout Shift)**: < 0.1
- **TTI (Time to Interactive)**: < 3.8s

---

## 🚀 优化优先级

### 立即修复（高影响）
1. 移除计算属性中的 API 调用
2. 实现分页或虚拟滚动
3. 实现图片懒加载
4. 优化 CSS 过渡

### 重要优化（中等影响）
5. 使用 v-memo 缓存子树
6. 使用 shallowRef/shallowReactive
7. 优化 watcher 和 computed
8. 减少 DOM 节点数量

### 长期优化（低影响）
9. 使用 CDN 加速资源
10. 实现请求缓存
11. 使用 Service Worker
12. 优化打包体积

---

## 📚 参考资源

- [Vue 3 性能优化指南](https://vuejs.org/guide/best-practices/performance.html)
- [Web Vitals](https://web.dev/vitals/)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)
- [Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)

---

## 💡 常见误区

### 误区 1: 过度优化
```typescript
// ❌ 不必要的优化
const items = shallowReactive([...]) // 如果只有 10 个项目，不需要
```

### 误区 2: 忽视用户体验
```typescript
// ❌ 虽然快，但用户体验差
// 分页时没有加载指示器
const displayedItems = computed(() => {
  return items.value.slice(start, end)
})
```

### 误区 3: 过度使用 v-if
```vue
<!-- ❌ 频繁切换时性能差 -->
<div v-if="show">...</div>

<!-- ✅ 频繁切换时使用 v-show -->
<div v-show="show">...</div>
```

---

## ✅ 总结

性能优化的关键是：
1. **测量** - 使用工具找出真正的瓶颈
2. **分析** - 理解问题的根本原因
3. **优化** - 实施有针对性的解决方案
4. **验证** - 确认优化效果

记住：**过早优化是万恶之源，但忽视性能也是错误的。**

