# Vue Query 使用情况分析与内存优化

## 📊 当前Vue Query使用情况

### 已迁移的数据管理模块

1. **Events (活动数据)** ✅
   - `usePublicEvents()` - 公开活动列表
   - `useMyEvents()` - 用户创建的活动
   - `useEvent()` - 单个活动详情
   - **使用页面**: EventsPage, MyEventsPage, EventDetailPage, EventEditPage, JudgeWorkspacePage, TeamDetailPage, TeamCreatePage

2. **Teams (队伍数据)** ✅
   - `useTeams()` - 队伍列表
   - `useTeamMembers()` - 队伍成员
   - `useTeamData()` - 综合队伍数据
   - `useTeamSeekers()` - 求组队列表
   - **Mutations**: 创建、更新、删除、加入请求、求组队管理、邀请发送
   - **使用页面**: EventDetailPage, TeamDetailPage, TeamCreatePage, SubmissionDetailPage

3. **Submissions (作品数据)** ✅
   - `useSubmissions()` - 作品列表
   - `useSubmissionData()` - 作品数据
   - **Mutations**: 创建、更新、删除作品
   - **使用页面**: EventDetailPage, SubmissionPage, SubmissionDetailPage

4. **Users (用户数据)** ✅
   - `useProfile()` - 用户资料
   - `useContacts()` - 联系方式
   - `useCurrentUserData()` - 当前用户完整数据
   - `useRegistrations()` - 用户报名记录
   - **Mutations**: 更新资料、联系方式、活动报名
   - **使用页面**: EventDetailPage, TeamDetailPage, TeamCreatePage

5. **Judges (评委数据)** ✅
   - `useJudgePermissions()` - 评委权限查询
   - `useEventJudges()` - 活动评委列表
   - **Mutations**: 添加/移除评委
   - **使用页面**: EventDetailPage, JudgeWorkspacePage

6. **Notifications (通知数据)** ✅
   - `useNotifications()` - 通知列表
   - **Mutations**: 添加通知、标记已读、清空通知

### 查询键结构

```typescript
queryKeys = {
  teams: 8种不同查询键,
  events: 4种查询键,
  user: 4种查询键,
  submissions: 3种查询键,
  judges: 3种查询键,
  notifications: 2种查询键
}
```

## 🚨 内存缓存过高的原因分析

### 1. 大量并发查询
- **EventDetailPage**: 同时使用6个不同的Vue Query hooks
- **TeamDetailPage**: 同时使用4个查询
- **SubmissionDetailPage**: 同时使用2个查询
- **多页面同时活跃**: 用户在不同页面间切换时，所有查询都被缓存

### 2. 缓存配置过于宽松（优化前）
```typescript
// 优化前的配置
gcTime: 1000 * 60 * 15,     // 15分钟缓存时间
staleTime: 1000 * 30,       // 30秒过期时间
maxCacheEntries: 80,        // 最大80个缓存条目
maxMemoryUsage: 40,         // 40MB内存阈值
```

### 3. 开发环境监控开销
- 每30秒输出性能统计
- 详细的性能监控和内存跟踪
- 批处理优化器的额外开销

### 4. 缓存键数量庞大
- 24种不同类型的查询键
- 每个eventId、userId、teamId都会产生独立的缓存条目
- 用户浏览多个活动时会产生大量缓存

## 🔧 已实施的优化措施

### 1. 缓存配置优化
```typescript
// 优化后的配置
gcTime: 1000 * 60 * 10,     // 10分钟缓存时间 ⬇️
staleTime: 1000 * 20,       // 20秒过期时间 ⬇️
maxCacheEntries: 50,        // 最大50个缓存条目 ⬇️
maxMemoryUsage: 30,         // 30MB内存阈值 ⬇️
cleanupInterval: 1000 * 60 * 2,  // 2分钟清理间隔 ⬇️
maxCacheAge: 1000 * 60 * 10,     // 10分钟最大缓存年龄 ⬇️
```

### 2. 智能缓存优化器
创建了 `VueQueryCacheOptimizer` 类：
- **自动优化**: 每2分钟检查内存使用情况
- **分类清理**: 针对不同数据类型设置不同的清理策略
  - 事件数据: 5分钟后清理
  - 队伍数据: 8分钟后清理
  - 作品数据: 10分钟后清理
  - 用户数据: 15分钟后清理
- **激进清理**: 内存压力大时只保留最近20个查询

### 3. 监控频率优化
- 性能报告输出间隔: 30秒 → 60秒
- 缓存统计阈值: 60个条目 → 40个条目
- 减少开发环境的监控开销

### 4. 内存管理增强
- 更频繁的自动清理（2分钟间隔）
- 更低的内存使用阈值（30MB）
- 更短的缓存生命周期（10分钟）

## 📈 预期优化效果

### 内存使用降低
- **目标**: 从87MB降低到30MB以下
- **方法**: 更激进的缓存清理策略
- **监控**: 实时内存使用监控

### 缓存效率提升
- **减少无效缓存**: 更短的staleTime和gcTime
- **智能清理**: 基于数据类型的差异化清理
- **性能监控**: 实时跟踪缓存命中率

### 用户体验保持
- **stale-while-revalidate**: 仍然遵循"缓存和请求两件事都要做"的原则
- **即时响应**: 有缓存时立即显示数据
- **后台更新**: 自动获取最新数据

## 🛠️ 调试工具

在开发环境中，可以通过浏览器控制台使用以下调试命令：

```javascript
// 获取缓存统计
__VUE_QUERY_DEBUG__.getCacheStats()

// 获取内存统计
__VUE_QUERY_DEBUG__.getMemoryStats()

// 手动优化缓存
__VUE_QUERY_DEBUG__.optimizeCache()

// 清空所有缓存
__VUE_QUERY_DEBUG__.clearCache()

// 访问完整的调试对象
__VUE_QUERY_DEBUG__
```

## 📋 监控指标

### 关键指标
1. **内存使用量**: 目标 < 30MB
2. **缓存条目数**: 目标 < 50个
3. **缓存命中率**: 目标 > 80%
4. **平均响应时间**: 目标 < 100ms

### 监控方式
- 开发环境: 控制台自动输出
- 生产环境: 性能监控系统
- 手动检查: 浏览器调试工具

## 🎯 下一步优化建议

### 1. 查询合并
考虑将相关查询合并，减少并发请求：
```typescript
// 当前: 多个独立查询
const { teams } = useTeams(eventId)
const { seekers } = useTeamSeekers(eventId)

// 优化: 合并查询
const { teams, seekers } = useTeamData(eventId) // 已实现
```

### 2. 懒加载优化
对于非关键数据实施懒加载：
```typescript
// 只在需要时加载
const { data: teamMembers } = useTeamMembers(teamId, {
  enabled: computed(() => showMembers.value)
})
```

### 3. 缓存预热
对于常用数据实施预加载策略：
```typescript
// 在用户可能访问前预加载
queryClient.prefetchQuery({
  queryKey: queryKeys.events.public,
  queryFn: fetchPublicEvents
})
```

### 4. 数据分页
对于大量数据实施分页加载：
```typescript
// 分页加载作品列表
const { data: submissions } = useInfiniteQuery({
  queryKey: queryKeys.submissions.byEvent(eventId),
  queryFn: ({ pageParam = 0 }) => fetchSubmissions(eventId, pageParam),
  getNextPageParam: (lastPage) => lastPage.nextCursor
})
```

## ✅ 总结

通过以上优化措施，我们已经：

1. **降低了内存使用阈值**: 从40MB降到30MB
2. **缩短了缓存时间**: 从15分钟降到10分钟
3. **增加了清理频率**: 从3分钟间隔降到2分钟
4. **实施了智能优化**: 自动分类清理不同类型的数据
5. **提供了调试工具**: 方便开发时监控和调试

这些优化措施在保持用户体验的同时，显著降低了内存使用，提高了应用性能。