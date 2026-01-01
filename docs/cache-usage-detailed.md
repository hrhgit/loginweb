# 项目缓存使用详细清单

## 📊 Vue Query 缓存使用情况

### 1. Events (活动数据) 缓存

#### 1.1 公开活动列表
- **文件**: `src/composables/useEvents.ts`
- **函数**: `usePublicEvents()`
- **查询键**: `queryKeys.events.public` → `['events', 'public']`
- **缓存配置**:
  ```typescript
  staleTime: 1000 * 60 * 2,  // 2分钟
  gcTime: 1000 * 60 * 30,    // 30分钟
  ```
- **使用页面**: 
  - `src/pages/EventsPage.vue`
  - `src/pages/ProfilePage.vue`

#### 1.2 用户创建的活动
- **文件**: `src/composables/useEvents.ts`
- **函数**: `useMyEvents(userId)`
- **查询键**: `queryKeys.events.my(userId)` → `['events', 'my', userId]`
- **缓存配置**:
  ```typescript
  staleTime: 1000 * 30,      // 30秒
  gcTime: 1000 * 60 * 15,    // 15分钟
  ```
- **使用页面**: 
  - `src/pages/MyEventsPage.vue`

#### 1.3 单个活动详情
- **文件**: `src/composables/useEvents.ts`
- **函数**: `useEvent(eventId)`
- **查询键**: `queryKeys.events.detail(eventId)` → `['events', 'detail', eventId]`
- **缓存配置**:
  ```typescript
  staleTime: 1000 * 30,      // 30秒
  gcTime: 1000 * 60 * 15,    // 15分钟
  ```
- **使用页面**: 
  - `src/pages/EventDetailPage.vue`
  - `src/pages/EventEditPage.vue`
  - `src/pages/JudgeWorkspacePage.vue`
  - `src/pages/TeamDetailPage.vue`
  - `src/pages/TeamCreatePage.vue`

### 2. Teams (队伍数据) 缓存

#### 2.1 活动队伍列表
- **文件**: `src/composables/useTeams.ts`
- **函数**: `useTeams(eventId)`
- **查询键**: `queryKeys.teams.byEvent(eventId)` → `['teams', 'event', eventId]`
- **缓存配置**:
  ```typescript
  staleTime: 1000 * 30,      // 30秒
  gcTime: 1000 * 60 * 15,    // 15分钟
  ```
- **使用页面**: 
  - `src/pages/EventDetailPage.vue`
  - `src/pages/TeamDetailPage.vue`
  - `src/pages/TeamCreatePage.vue`
  - `src/pages/SubmissionDetailPage.vue`

#### 2.2 队伍成员列表
- **文件**: `src/composables/useTeams.ts`
- **函数**: `useTeamMembers(teamId)`
- **查询键**: `queryKeys.teams.members(teamId)` → `['teams', 'members', teamId]`
- **缓存配置**:
  ```typescript
  staleTime: 1000 * 30,      // 30秒
  gcTime: 1000 * 60 * 15,    // 15分钟
  ```
- **使用页面**: 
  - `src/pages/TeamDetailPage.vue`

#### 2.3 求组队列表
- **文件**: `src/composables/useTeams.ts`
- **函数**: `useTeamSeekers(eventId)`
- **查询键**: `queryKeys.teams.seekers(eventId)` → `['teams', 'seekers', eventId]`
- **缓存配置**:
  ```typescript
  staleTime: 1000 * 30,      // 30秒
  gcTime: 1000 * 60 * 15,    // 15分钟
  ```
- **使用页面**: 
  - `src/pages/EventDetailPage.vue`

#### 2.4 综合队伍数据
- **文件**: `src/composables/useTeams.ts`
- **函数**: `useTeamData(eventId)`
- **查询键**: 组合多个查询键
- **使用页面**: 
  - `src/pages/EventDetailPage.vue`
  - `src/pages/VueQueryDemoPage.vue`

### 3. Submissions (作品数据) 缓存

#### 3.1 活动作品列表
- **文件**: `src/composables/useSubmissions.ts`
- **函数**: `useSubmissions(eventId)`
- **查询键**: `queryKeys.submissions.byEvent(eventId)` → `['submissions', 'event', eventId]`
- **缓存配置**:
  ```typescript
  staleTime: 1000 * 30,      // 30秒
  gcTime: 1000 * 60 * 15,    // 15分钟
  ```
- **使用页面**: 
  - `src/pages/EventDetailPage.vue`
  - `src/pages/SubmissionPage.vue`
  - `src/pages/SubmissionDetailPage.vue`

#### 3.2 队伍作品列表
- **文件**: `src/composables/useSubmissions.ts`
- **函数**: `useTeamSubmissions(teamId)`
- **查询键**: `queryKeys.submissions.byTeam(teamId)` → `['submissions', 'team', teamId]`
- **缓存配置**:
  ```typescript
  staleTime: 1000 * 30,      // 30秒
  gcTime: 1000 * 60 * 15,    // 15分钟
  ```
- **使用页面**: 
  - `src/pages/SubmissionDetailPage.vue`

#### 3.3 综合作品数据
- **文件**: `src/composables/useSubmissions.ts`
- **函数**: `useSubmissionData(eventId)`
- **查询键**: 组合查询键
- **使用页面**: 
  - `src/pages/EventDetailPage.vue`

### 4. Users (用户数据) 缓存

#### 4.1 用户资料
- **文件**: `src/composables/useUsers.ts`
- **函数**: `useProfile(userId)`
- **查询键**: `queryKeys.user.profile(userId)` → `['user', 'profile', userId]`
- **缓存配置**:
  ```typescript
  staleTime: 1000 * 60 * 5,  // 5分钟
  gcTime: 1000 * 60 * 30,    // 30分钟
  ```
- **使用页面**: 
  - `src/pages/EventDetailPage.vue`
  - `src/pages/TeamDetailPage.vue`
  - `src/pages/TeamCreatePage.vue`

#### 4.2 用户联系方式
- **文件**: `src/composables/useUsers.ts`
- **函数**: `useContacts(userId)`
- **查询键**: `queryKeys.user.contacts(userId)` → `['user', 'contacts', userId]`
- **缓存配置**:
  ```typescript
  staleTime: 1000 * 60 * 5,  // 5分钟
  gcTime: 1000 * 60 * 30,    // 30分钟
  ```
- **使用页面**: 
  - `src/pages/EventDetailPage.vue`
  - `src/pages/TeamDetailPage.vue`
  - `src/pages/TeamCreatePage.vue`

#### 4.3 用户报名记录
- **文件**: `src/composables/useUsers.ts`
- **函数**: `useRegistrations(userId)`
- **查询键**: `queryKeys.user.registrations(userId)` → `['user', 'registrations', userId]`
- **缓存配置**:
  ```typescript
  staleTime: 1000 * 30,      // 30秒
  gcTime: 1000 * 60 * 15,    // 15分钟
  ```
- **使用页面**: 
  - `src/pages/EventDetailPage.vue`
  - `src/pages/TeamDetailPage.vue`
  - `src/pages/TeamCreatePage.vue`

#### 4.4 当前用户完整数据
- **文件**: `src/composables/useUsers.ts`
- **函数**: `useCurrentUserData()`
- **查询键**: 组合多个用户相关查询键
- **使用页面**: 
  - `src/pages/EventDetailPage.vue`
  - `src/pages/TeamDetailPage.vue`
  - `src/pages/TeamCreatePage.vue`

### 5. Judges (评委数据) 缓存

#### 5.1 评委权限
- **文件**: `src/composables/useJudges.ts`
- **函数**: `useJudgePermissions(eventId, userId)`
- **查询键**: `queryKeys.judges.permissions(eventId, userId)` → `['judges', 'permissions', eventId, userId]`
- **缓存配置**:
  ```typescript
  staleTime: 1000 * 60 * 5,  // 5分钟
  gcTime: 1000 * 60 * 30,    // 30分钟
  ```
- **使用页面**: 
  - `src/pages/EventDetailPage.vue`
  - `src/pages/JudgeWorkspacePage.vue`

#### 5.2 活动评委列表
- **文件**: `src/composables/useJudges.ts`
- **函数**: `useEventJudges(eventId)`
- **查询键**: `queryKeys.judges.byEvent(eventId)` → `['judges', 'event', eventId]`
- **缓存配置**:
  ```typescript
  staleTime: 1000 * 60 * 5,  // 5分钟
  gcTime: 1000 * 60 * 30,    // 30分钟
  ```

### 6. Notifications (通知数据) 缓存

#### 6.1 用户通知列表
- **文件**: `src/composables/useNotifications.ts`
- **函数**: `useNotifications(userId)`
- **查询键**: `queryKeys.notifications.byUser(userId)` → `['notifications', 'user', userId]`
- **缓存配置**:
  ```typescript
  staleTime: 1000 * 10,      // 10秒
  gcTime: 1000 * 60 * 5,     // 5分钟
  ```

## 🔄 Mutation 缓存失效策略

### 1. Events Mutations
- **创建活动**: 清除 `queryKeys.events.public` 和 `queryKeys.events.my(userId)`
- **更新活动**: 清除 `queryKeys.events.detail(eventId)` 和相关列表缓存
- **删除活动**: 清除所有相关活动缓存

### 2. Teams Mutations
- **创建队伍**: 清除 `queryKeys.teams.byEvent(eventId)`
- **更新队伍**: 清除 `queryKeys.teams.byEvent(eventId)` 和 `queryKeys.teams.members(teamId)`
- **删除队伍**: 清除所有相关队伍缓存
- **加入队伍**: 清除 `queryKeys.teams.byEvent(eventId)` 和 `queryKeys.teams.members(teamId)`
- **保存求组队**: 清除 `queryKeys.teams.seekers(eventId)`
- **删除求组队**: 清除 `queryKeys.teams.seekers(eventId)`

### 3. Submissions Mutations
- **创建作品**: 清除 `queryKeys.submissions.byEvent(eventId)`
- **更新作品**: 清除 `queryKeys.submissions.byEvent(eventId)` 和 `queryKeys.submissions.byTeam(teamId)`
- **删除作品**: 清除所有相关作品缓存

### 4. Users Mutations
- **更新资料**: 清除 `queryKeys.user.profile(userId)`
- **更新联系方式**: 清除 `queryKeys.user.contacts(userId)`
- **活动报名**: 清除 `queryKeys.user.registrations(userId)`

### 5. Judges Mutations
- **添加评委**: 清除 `queryKeys.judges.byEvent(eventId)`
- **移除评委**: 清除 `queryKeys.judges.byEvent(eventId)` 和 `queryKeys.judges.permissions(eventId, userId)`

### 6. Notifications Mutations
- **添加通知**: 清除 `queryKeys.notifications.byUser(userId)`
- **标记已读**: 清除 `queryKeys.notifications.byUser(userId)`
- **清空通知**: 清除 `queryKeys.notifications.byUser(userId)`

## 🖼️ 图片资源缓存策略

### 1. 不缓存的图片类型
- **作品封面图片**: 使用时间戳防止浏览器缓存
  ```typescript
  // src/utils/imageUrlGenerator.ts
  generateCoverUrl(path) // 添加 ?t=timestamp
  ```
- **用户头像**: 使用时间戳防止浏览器缓存
  ```typescript
  generateAvatarUrl(path) // 添加 ?t=timestamp
  ```
- **作品文件**: 使用时间戳防止浏览器缓存
  ```typescript
  generateSubmissionUrl(path) // 添加 ?t=timestamp
  ```

### 2. 允许缓存的图片类型
- **静态图标**: 不添加时间戳，允许浏览器缓存
- **背景图片**: 不添加时间戳，允许浏览器缓存
- **装饰图片**: 不添加时间戳，允许浏览器缓存

## 🧠 内存缓存管理

### 1. Vue Query 内存缓存
- **配置文件**: `src/lib/vueQuery.ts`
- **全局配置**:
  ```typescript
  gcTime: 1000 * 60 * 10,    // 10分钟
  staleTime: 1000 * 20,      // 20秒
  ```
- **内存管理器**: `src/utils/vueQueryMemoryManager.ts`
  ```typescript
  maxCacheEntries: 50,       // 最大50个缓存条目
  maxMemoryUsage: 30,        // 30MB内存阈值
  cleanupInterval: 1000 * 60 * 2, // 2分钟清理间隔
  ```

### 2. 缓存优化器
- **文件**: `src/utils/vueQueryCacheOptimizer.ts`
- **功能**: 
  - 每2分钟自动检查内存使用
  - 分类清理不同类型的数据
  - 激进清理策略（保留最近20个查询）

### 3. 性能监控
- **文件**: `src/utils/vueQueryPerformanceMonitor.ts`
- **监控指标**:
  - 缓存大小
  - 内存使用量
  - 查询时间
  - 缓存命中率

## 🔧 缓存配置层级

### 1. 全局默认配置
```typescript
// src/lib/vueQuery.ts
defaultOptions: {
  queries: {
    gcTime: 1000 * 60 * 10,        // 10分钟
    staleTime: 1000 * 20,          // 20秒
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  }
}
```

### 2. 数据类型配置
```typescript
// src/utils/vueQueryPerformanceMonitor.ts
realTimeData: {
  staleTime: 1000 * 10,     // 10秒
  gcTime: 1000 * 60 * 5,    // 5分钟
},
standardData: {
  staleTime: 1000 * 30,     // 30秒
  gcTime: 1000 * 60 * 15,   // 15分钟
},
staticData: {
  staleTime: 1000 * 60 * 5, // 5分钟
  gcTime: 1000 * 60 * 30,   // 30分钟
}
```

### 3. 特定查询配置
```typescript
// 公开活动使用更长缓存
usePublicEvents() {
  staleTime: 1000 * 60 * 2,  // 2分钟
  gcTime: 1000 * 60 * 30,    // 30分钟
}
```

## 📊 缓存使用统计

### 总计缓存类型
- **Vue Query 查询**: 24种不同类型
- **Mutation 操作**: 17种不同操作
- **图片资源**: 3种不缓存类型
- **页面覆盖**: 11个主要页面

### 缓存键分布
- **Events**: 4种查询键
- **Teams**: 8种查询键
- **Submissions**: 3种查询键
- **Users**: 4种查询键
- **Judges**: 3种查询键
- **Notifications**: 2种查询键

### 内存使用目标
- **开发环境**: < 30MB
- **生产环境**: < 20MB
- **缓存条目**: < 50个
- **清理频率**: 每2分钟

## 🛠️ 调试和监控工具

### 浏览器控制台命令
```javascript
// 查看缓存统计
__VUE_QUERY_DEBUG__.getCacheStats()

// 查看内存统计
__VUE_QUERY_DEBUG__.getMemoryStats()

// 手动优化缓存
__VUE_QUERY_DEBUG__.optimizeCache()

// 分析缓存使用
analyzeCacheUsage()

// 清空所有缓存
__VUE_QUERY_DEBUG__.clearCache()
```

### 自动监控
- **缓存监控**: `src/utils/cacheMonitor.ts`
- **性能监控**: 每分钟输出统计信息
- **内存警告**: 超过35MB时自动警告
- **自动优化**: 内存压力大时自动清理

这个详细清单涵盖了项目中所有缓存的使用情况，包括Vue Query缓存、图片资源缓存、内存管理和监控工具。