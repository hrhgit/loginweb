# 活动数据加载问题调试指南

## 问题描述

有时候活动的数据请求没成功后面不再次请求了，或者一开始就略过了请求，或者请求成功后没有更新页面。

## 已实施的修复

### 1. 改进 `ensureEventsLoaded` 函数

**问题**：如果 `eventsLoaded.value` 为 `true` 但 `events.value` 为空数组，函数会直接返回而不重新请求。

**修复**：
- 添加了状态不一致检测
- 如果标记为已加载但没有数据，会重置状态并重新加载
- 添加了加载等待机制，避免并发请求

```typescript
const ensureEventsLoaded = async () => {
  // 如果有缓存数据且未过期，直接返回
  if (eventsLoaded.value && events.value.length > 0) return
  
  // 如果正在加载中，等待加载完成
  if (eventsLoading.value) {
    // 等待当前加载完成，最多等待10秒
    let attempts = 0
    while (eventsLoading.value && attempts < 100) {
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++
    }
    return
  }
  
  // 如果标记为已加载但实际没有数据，重置状态并重新加载
  if (eventsLoaded.value && events.value.length === 0) {
    console.warn('Events marked as loaded but no data found, reloading...')
    eventsLoaded.value = false
    stateCache.remove('eventsLoaded')
    stateCache.remove('events')
  }
  
  // 如果未加载，执行加载
  if (!eventsLoaded.value) {
    await loadEvents()
  }
}
```

### 2. 改进错误处理

**问题**：网络请求失败后状态可能不正确，导致不再重试。

**修复**：
- 请求失败时重置 `eventsLoaded` 状态
- 清除缓存，确保下次会重新请求
- 添加详细的错误日志

```typescript
if (error) {
  eventsError.value = error.message
  eventErrorHandler.handleError(error, { operation: 'loadEvents' })
  events.value = []
  eventsLoaded.value = false // 重置加载状态，允许重试
  // 清除缓存，确保下次会重新请求
  stateCache.remove('events')
  stateCache.remove('eventsLoaded')
}
```

### 3. 添加强制刷新功能

**新增功能**：`forceReloadEvents` 函数，忽略缓存强制重新加载。

```typescript
const forceReloadEvents = async () => {
  console.log('Force reloading events...')
  eventsLoaded.value = false
  eventsError.value = ''
  stateCache.remove('events')
  stateCache.remove('eventsLoaded')
  return await loadEvents()
}
```

### 4. 改进网络恢复机制

**修复**：网络恢复后自动检查并重新加载活动数据。

```typescript
const handleConnectivityRestoration = async () => {
  // 如果活动数据为空或加载失败，重新加载
  if (events.value.length === 0 || eventsError.value) {
    console.log('Network restored, reloading events...')
    await forceReloadEvents()
  }
  // ... 其他恢复逻辑
}
```

### 5. 添加调试工具

**新增功能**：调试页面和调试方法，帮助诊断问题。

- **调试页面**：访问 `/debug/events` 查看详细状态
- **调试方法**：`store.debugEventsState()` 输出状态信息

## 使用调试工具

### 1. 访问调试页面

在浏览器中访问：`http://localhost:5173/debug/events`

调试页面提供以下功能：
- **检查状态**：查看当前活动数据状态
- **强制刷新**：忽略缓存重新加载
- **清除缓存**：清除所有缓存数据
- **确保加载**：使用标准加载逻辑

### 2. 在控制台使用调试方法

```javascript
// 检查当前状态
const state = store.debugEventsState()
console.log(state)

// 强制刷新
await store.forceReloadEvents()

// 清除缓存
store.stateCache.clear()
```

### 3. 常见问题诊断

#### 问题：页面显示"暂时还没有公开活动"但实际有活动

**检查步骤**：
1. 打开调试页面或运行 `store.debugEventsState()`
2. 检查 `eventsCount` 是否为 0
3. 检查 `eventsError` 是否有错误信息
4. 检查 `isOnline` 网络状态
5. 尝试"强制刷新"

#### 问题：活动数据加载后页面没有更新

**检查步骤**：
1. 检查 `eventsLoaded` 是否为 `true`
2. 检查 `eventsCount` 是否大于 0
3. 检查浏览器控制台是否有 Vue 响应式相关错误
4. 尝试刷新页面

#### 问题：网络恢复后数据没有自动刷新

**检查步骤**：
1. 检查网络状态变化日志
2. 查看是否有"Network restored, reloading events..."日志
3. 手动触发强制刷新

## 监控和日志

### 关键日志信息

- `Force reloading events...` - 强制刷新开始
- `Events marked as loaded but no data found, reloading...` - 检测到状态不一致
- `Network restored, reloading events...` - 网络恢复后重新加载
- `Retrying loadEvents (attempt X/3)` - 网络重试
- `Max retries reached for loadEvents` - 达到最大重试次数

### 性能监控

调试状态包含以下信息：
- `eventsCount` - 当前活动数量
- `eventsLoaded` - 是否标记为已加载
- `eventsLoading` - 是否正在加载
- `eventsError` - 错误信息
- `cachedEventsCount` - 缓存中的活动数量
- `isOnline` - 网络状态
- `networkRetryCount` - 网络重试次数

## 预防措施

1. **定期检查**：在关键页面加载时检查数据状态
2. **错误恢复**：网络错误后自动重试
3. **状态一致性**：定期验证缓存和实际状态的一致性
4. **用户反馈**：提供手动刷新按钮

## 后续改进建议

1. **自动健康检查**：定期检查数据状态并自动修复
2. **更智能的缓存策略**：基于数据变化频率调整缓存时间
3. **离线支持**：在离线状态下显示缓存数据
4. **用户通知**：数据加载失败时提供更好的用户反馈