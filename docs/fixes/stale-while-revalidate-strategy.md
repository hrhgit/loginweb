# Stale-While-Revalidate 缓存策略

## 策略概述

实现了 **"先显示缓存，后台更新"** 的缓存策略，提供最佳的用户体验：

1. **立即显示**：有缓存就立即显示，不等待网络请求
2. **后台更新**：同时在后台获取最新数据
3. **智能替换**：收到新数据后比较差异，有变化才更新UI
4. **用户感知**：数据更新时显示提示信息

## 执行流程

### 1. 页面加载时的执行顺序

```
用户访问页面
    ↓
ensureEventsLoaded()
    ↓
步骤1: 检查缓存
    ├─ 有缓存 → 立即显示缓存数据 (events.value = cachedEvents)
    └─ 无缓存 → 继续下一步
    ↓
步骤2: 检查是否需要后台刷新
    ├─ shouldRefreshEvents() → 根据数据年龄和用户角色判断
    └─ 需要刷新 → refreshEventsInBackground() (异步执行)
    ↓
步骤3: 如果完全没有数据
    └─ 强制加载 → loadEvents() (同步执行)
```

### 2. 后台刷新流程

```
refreshEventsInBackground() (异步)
    ↓
loadEventsData() → 获取最新数据
    ↓
compareEventsData() → 比较新旧数据
    ├─ 有变化 → updateEventsData() → 更新UI + 显示提示
    └─ 无变化 → 静默完成
    ↓
更新缓存时间戳
```

## 刷新策略

### 数据年龄判断

```typescript
const shouldRefreshEvents = (): boolean => {
  const age = Date.now() - cacheTimestamp
  
  if (isAdmin.value) {
    return age > 60 * 1000      // 管理员：1分钟
  } else {
    return age > 3 * 60 * 1000  // 普通用户：3分钟
  }
}
```

### 数据比较逻辑

```typescript
const compareEventsData = (oldData, newData): boolean => {
  // 1. 比较数量
  if (oldData.length !== newData.length) return true
  
  // 2. 比较ID列表
  const oldIds = oldData.map(e => e.id).sort()
  const newIds = newData.map(e => e.id).sort()
  if (JSON.stringify(oldIds) !== JSON.stringify(newIds)) return true
  
  // 3. 比较内容指纹（创建时间总和）
  const oldFingerprint = oldData.reduce((sum, e) => sum + new Date(e.created_at).getTime(), 0)
  const newFingerprint = newData.reduce((sum, e) => sum + new Date(e.created_at).getTime(), 0)
  return oldFingerprint !== newFingerprint
}
```

## 用户体验改进

### 1. 立即响应
- 页面打开立即显示缓存数据
- 不需要等待网络请求
- 避免白屏或加载状态

### 2. 数据新鲜度
- 管理员看到更新更及时（1分钟）
- 普通用户减少不必要的请求（3分钟）
- 后台更新不干扰用户操作

### 3. 变化感知
- 数据更新时显示 "活动列表已更新" 提示
- 用户知道数据已刷新
- 静默处理无变化的情况

## 缓存管理

### 缓存键和TTL

```typescript
// 数据缓存（1小时）
stateCache.set('events', freshData, 60)
stateCache.set('eventsLoaded', true, 60)
stateCache.set('eventsTimestamp', Date.now(), 60)
```

### 缓存清理时机

1. **用户主动刷新**：`forceReloadEvents()`
2. **网络错误**：只有在无缓存数据时才清除
3. **用户登出**：清除所有缓存
4. **数据过期**：自动清理过期缓存

## 调试功能

### 新增调试信息

```javascript
const debugInfo = store.debugEventsState()
console.log(debugInfo)

// 输出包含：
{
  eventsCount: 5,
  dataAgeSeconds: 120,        // 数据年龄（秒）
  shouldRefresh: true,        // 是否需要刷新
  cacheTimestamp: 1703123456, // 缓存时间戳
  // ... 其他状态信息
}
```

### 调试页面新功能

访问 `/debug/events` 页面：

- **检查状态**：查看详细缓存信息
- **强制刷新**：清除缓存重新加载
- **后台刷新**：测试后台更新功能
- **清除缓存**：清除所有缓存数据

## 性能优化

### 1. 减少网络请求
- 避免重复的同步请求
- 智能判断刷新时机
- 后台异步更新

### 2. 提升响应速度
- 缓存数据立即显示
- 不阻塞UI渲染
- 平滑的数据更新

### 3. 降低服务器负载
- 根据用户角色调整请求频率
- 只在数据变化时更新UI
- 静默处理无变化情况

## 错误处理

### 后台刷新失败
```typescript
catch (error) {
  console.warn('Background refresh failed:', error)
  // 静默失败，不影响用户体验
  // 用户仍然可以看到缓存数据
}
```

### 网络完全失败
```typescript
// 只有在没有任何缓存数据时才显示错误
if (events.value.length === 0) {
  eventsError.value = error.message
  eventsLoaded.value = false
}
```

## 使用示例

### 典型用户场景

1. **首次访问**：
   ```
   无缓存 → 显示加载状态 → 获取数据 → 显示数据 → 缓存数据
   ```

2. **再次访问（1分钟内）**：
   ```
   有缓存 → 立即显示 → 检查年龄 → 不需要刷新 → 完成
   ```

3. **再次访问（超过刷新时间）**：
   ```
   有缓存 → 立即显示 → 后台刷新 → 比较数据 → 更新UI（如有变化）
   ```

4. **管理员创建活动后**：
   ```
   创建成功 → 后台刷新 → 发现新活动 → 更新列表 → 显示提示
   ```

这种策略确保了最佳的用户体验：快速响应 + 数据新鲜度 + 智能更新。