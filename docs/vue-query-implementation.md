# Vue Query 实现方案

## 概述

Vue Query (TanStack Query) 是一个强大的数据获取和状态管理库，专门为现代 Web 应用设计。本文档详细说明了在队伍和作品数据管理中使用 Vue Query 的实现方案。

## 方案对比

### 当前方案 vs Vue Query

| 特性 | 当前方案（内存缓存） | Vue Query |
|------|---------------------|-----------|
| **缓存持久化** | ❌ 页面刷新丢失 | ✅ 内存 + localStorage |
| **智能缓存策略** | ❌ 简单内存存储 | ✅ 多种策略（cache-first, network-first, stale-while-revalidate） |
| **后台更新** | ❌ 需手动刷新 | ✅ 自动后台更新 |
| **离线支持** | ❌ 无离线能力 | ✅ 离线时使用缓存 |
| **网络感知** | ❌ 无网络状态感知 | ✅ 网络重连自动同步 |
| **错误重试** | ❌ 需手动实现 | ✅ 智能重试机制 |
| **加载状态** | ❌ 需手动管理 | ✅ 统一状态管理 |
| **开发体验** | ❌ 大量样板代码 | ✅ 简洁的 API |

## 核心优势

### 1. 智能缓存管理

```typescript
// 自动缓存管理
const { data: teams, isLoading, error } = useTeams(eventId)

// 配置缓存策略
{
  staleTime: 1000 * 60 * 5, // 5分钟内数据保持新鲜
  gcTime: 1000 * 60 * 15,   // 15分钟后从内存清除
  retry: 3,                 // 失败重试3次
}
```

### 2. 多种缓存策略

#### Cache First（缓存优先）
```typescript
// 适用于静态数据，如用户信息
const { data } = useQuery({
  queryKey: ['user', userId],
  queryFn: fetchUser,
  staleTime: Infinity, // 永不过期
})
```

#### Network First（网络优先）
```typescript
// 适用于实时性要求高的数据
const { data } = useQuery({
  queryKey: ['submissions', eventId],
  queryFn: fetchSubmissions,
  staleTime: 0, // 立即过期，总是从网络获取
})
```

#### Stale While Revalidate（过期时重新验证）
```typescript
// 平衡性能和实时性的最佳策略
const { data } = useQuery({
  queryKey: ['teams', eventId],
  queryFn: fetchTeams,
  staleTime: 1000 * 60 * 5, // 5分钟后过期
  // 过期后先返回缓存，同时后台更新
})
```

### 3. 统一的状态管理

```typescript
const {
  data,           // 查询数据
  isLoading,      // 首次加载状态
  isFetching,     // 任何获取状态（包括后台更新）
  isError,        // 错误状态
  error,          // 错误信息
  isStale,        // 数据是否过期
  refetch,        // 手动重新获取
} = useTeams(eventId)
```

### 4. 乐观更新

```typescript
const createTeamMutation = useMutation({
  mutationFn: createTeam,
  onMutate: async (newTeam) => {
    // 取消正在进行的查询
    await queryClient.cancelQueries(['teams', eventId])
    
    // 获取当前数据
    const previousTeams = queryClient.getQueryData(['teams', eventId])
    
    // 乐观更新
    queryClient.setQueryData(['teams', eventId], old => [...old, newTeam])
    
    return { previousTeams }
  },
  onError: (err, newTeam, context) => {
    // 回滚到之前的数据
    queryClient.setQueryData(['teams', eventId], context.previousTeams)
  },
  onSettled: () => {
    // 重新获取数据确保一致性
    queryClient.invalidateQueries(['teams', eventId])
  },
})
```

### 5. 网络感知和离线支持

```typescript
// 自动处理网络状态
const { data, isLoading, error } = useTeams(eventId, {
  // 网络重连时自动重新获取
  refetchOnReconnect: true,
  // 窗口重新获得焦点时重新获取
  refetchOnWindowFocus: true,
  // 离线时不重试
  retry: (failureCount, error) => {
    return navigator.onLine && failureCount < 3
  }
})
```

## 实现细节

### 1. 查询键管理

```typescript
// 统一的查询键工厂
export const queryKeys = {
  teams: {
    all: ['teams'] as const,
    byEvent: (eventId: string) => ['teams', 'event', eventId] as const,
    members: (teamId: string) => ['teams', 'members', teamId] as const,
  },
  submissions: {
    all: ['submissions'] as const,
    byEvent: (eventId: string) => ['submissions', 'event', eventId] as const,
  },
}
```

### 2. 缓存失效策略

```typescript
// 创建队伍后使相关缓存失效
const createTeamMutation = useMutation({
  mutationFn: createTeam,
  onSuccess: (data, variables) => {
    // 使队伍列表缓存失效
    queryClient.invalidateQueries({
      queryKey: queryKeys.teams.byEvent(variables.eventId)
    })
  },
})
```

### 3. 并行查询优化

```typescript
// 同时获取队伍和求组队数据
export function useTeamData(eventId: string) {
  const teams = useTeams(eventId)
  const seekers = useTeamSeekers(eventId)

  return {
    teams,
    seekers,
    isLoading: computed(() => teams.isLoading.value || seekers.isLoading.value),
    error: computed(() => teams.error.value || seekers.error.value),
  }
}
```

## 性能优化

### 1. 内存管理

```typescript
// 配置缓存大小和清理策略
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 15, // 15分钟后清理
      staleTime: 1000 * 60 * 5, // 5分钟过期时间
    },
  },
})
```

### 2. 请求去重

```typescript
// 相同查询键的并发请求会自动去重
const Component1 = () => {
  const { data } = useTeams(eventId) // 发起请求
}

const Component2 = () => {
  const { data } = useTeams(eventId) // 复用上面的请求
}
```

### 3. 预加载

```typescript
// 预加载相关数据
const prefetchTeamData = async (eventId: string) => {
  await queryClient.prefetchQuery({
    queryKey: queryKeys.teams.byEvent(eventId),
    queryFn: () => fetchTeams(eventId),
  })
}
```

## 迁移指南

### 1. 渐进式迁移

```typescript
// 第一步：保持现有 API，内部使用 Vue Query
const useTeamsLegacy = (eventId: string) => {
  const { data, isLoading, error } = useTeams(eventId)
  
  // 兼容现有接口
  return {
    teams: data,
    loading: isLoading,
    error: error?.message || '',
  }
}
```

### 2. 数据格式兼容

```typescript
// 确保数据格式与现有代码兼容
const fetchTeams = async (eventId: string): Promise<TeamLobbyTeam[]> => {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('event_id', eventId)

  if (error) throw error

  // 转换为现有数据格式
  return data.map(normalizeTeamRow)
}
```

### 3. 错误处理集成

```typescript
// 集成现有错误处理系统
const useTeams = (eventId: string) => {
  return useQuery({
    queryKey: queryKeys.teams.byEvent(eventId),
    queryFn: () => fetchTeams(eventId),
    onError: (error) => {
      // 使用现有错误处理
      teamErrorHandler.handleError(error, { operation: 'fetchTeams' })
    },
  })
}
```

## 最佳实践

### 1. 查询键设计

```typescript
// ✅ 好的查询键设计
const queryKeys = {
  teams: {
    all: ['teams'],
    byEvent: (eventId: string) => ['teams', 'event', eventId],
    detail: (teamId: string) => ['teams', 'detail', teamId],
  }
}

// ❌ 避免的查询键设计
const badKeys = {
  teams: 'teams', // 字符串不够灵活
  teamsByEvent: (eventId: string) => `teams-${eventId}`, // 难以批量操作
}
```

### 2. 缓存时间配置

```typescript
// 根据数据特性配置不同的缓存时间
const queries = {
  // 用户信息：变化少，缓存时间长
  userProfile: { staleTime: 1000 * 60 * 30 }, // 30分钟
  
  // 队伍列表：中等变化频率
  teams: { staleTime: 1000 * 60 * 5 }, // 5分钟
  
  // 实时消息：变化频繁，缓存时间短
  messages: { staleTime: 1000 * 30 }, // 30秒
}
```

### 3. 错误边界

```typescript
// 为 Vue Query 添加错误边界
const QueryErrorBoundary = {
  setup(props, { slots }) {
    const queryClient = useQueryClient()
    
    // 全局错误处理
    queryClient.setMutationDefaults(['teams'], {
      onError: (error) => {
        console.error('Team mutation error:', error)
        // 显示用户友好的错误信息
      }
    })
    
    return () => slots.default?.()
  }
}
```

## 监控和调试

### 1. 开发工具

```typescript
// 开发环境启用 Vue Query DevTools
if (process.env.NODE_ENV === 'development') {
  import('@tanstack/vue-query-devtools').then(({ VueQueryDevtools }) => {
    app.use(VueQueryDevtools)
  })
}
```

### 2. 性能监控

```typescript
// 监控查询性能
const useTeamsWithMetrics = (eventId: string) => {
  const startTime = performance.now()
  
  const result = useTeams(eventId)
  
  // 记录查询时间
  if (result.isSuccess.value) {
    const duration = performance.now() - startTime
    console.log(`Teams query took ${duration}ms`)
  }
  
  return result
}
```

### 3. 缓存统计

```typescript
// 获取缓存统计信息
const getCacheStats = () => {
  const queryCache = queryClient.getQueryCache()
  const queries = queryCache.getAll()
  
  return {
    totalQueries: queries.length,
    staleQueries: queries.filter(q => q.isStale()).length,
    errorQueries: queries.filter(q => q.state.status === 'error').length,
  }
}
```

## 总结

Vue Query 为队伍和作品数据管理提供了完整的解决方案：

1. **智能缓存**：自动管理数据缓存，减少网络请求
2. **后台更新**：用户无感知的数据同步
3. **离线支持**：网络断开时的优雅降级
4. **统一状态**：简化加载、错误、成功状态管理
5. **性能优化**：请求去重、并行查询、内存管理
6. **开发体验**：减少样板代码，提供强大的调试工具

通过渐进式迁移，可以在不影响现有功能的前提下，逐步享受 Vue Query 带来的所有优势。