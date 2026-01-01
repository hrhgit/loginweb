---
inclusion: always
---

# 缓存管理规范

## 概述

本项目使用 Vue Query (TanStack Query) 实现智能缓存管理。所有数据获取和缓存策略必须遵循本文档的规范，确保用户体验和性能的最佳平衡。

## 核心原则

### 1. "缓存和请求两件事都要做"

这是项目的核心缓存需求：
- ✅ 当有缓存时，立即显示缓存数据
- ✅ 同时在必要时发起网络请求获取最新数据
- ✅ 避免不必要的频繁请求

### 2. 差异化缓存策略

不同类型的资源采用不同的缓存策略：

| 资源类型 | 缓存策略 | 缓存时间 | 说明 |
|---------|---------|---------|------|
| **JSON数据** | stale-while-revalidate | 30秒 | 队伍、作品列表等结构化数据 |
| **图片资源** | 不缓存 | 0秒 | 作品封面等可能更新的图片 |

## Vue Query 配置规范

### 必须使用的配置

所有查询必须使用以下配置：

```typescript
export function useDataQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.data.byId(id),
    queryFn: () => fetchData(id),
    enabled: computed(() => Boolean(id)),
    
    // 缓存策略 - 必须配置
    staleTime: 1000 * 30,              // 30秒后数据过期
    gcTime: 1000 * 60 * 15,            // 15分钟后清理缓存
    
    // 重新获取策略 - 必须配置
    refetchOnMount: false,             // 挂载时不自动重新获取
    refetchOnWindowFocus: false,       // 窗口焦点时不自动重新获取
    refetchOnReconnect: true,          // 网络重连时直接重新获取
    
    // 重试策略 - 必须配置
    retry: (failureCount, error) => {
      const isNetworkError = error?.message?.includes('网络') || 
                            error?.message?.includes('fetch') ||
                            error?.code === 'NETWORK_ERROR'
      return isNetworkError && failureCount < 3
    },
  })
}
```

### 查询键管理

必须使用统一的查询键工厂：

```typescript
// 文件：src/lib/vueQuery.ts
export const queryKeys = {
  teams: {
    all: ['teams'],
    byEvent: (eventId: string) => ['teams', 'event', eventId],
    seekers: (eventId: string) => ['teams', 'seekers', eventId],
  },
  submissions: {
    all: ['submissions'],
    byEvent: (eventId: string) => ['submissions', 'event', eventId],
  },
}

// 使用方式
queryKey: queryKeys.teams.byEvent(eventId)  // ✅ 正确
queryKey: ['teams', 'event', eventId]       // ❌ 错误
```

## 请求触发策略

### 直接发起请求的情况（无条件）

以下情况必须直接发起网络请求：

1. **首次打开界面** - 没有缓存数据
2. **手动刷新页面** - 缓存被清空
3. **网络重新连接** - 需要同步数据
4. **缓存失效** - 主动清除缓存（创建/更新/删除操作后）
5. **手动调用refetch()** - 用户主动刷新
6. **参数变化** - 新的数据集（如eventId变化）

### 条件性请求的情况（基于缓存过期）

以下情况先检查缓存是否过期，过期才发起请求：

1. **窗口获得焦点** - 用户从其他标签页切换回来
2. **数据过期后访问** - 缓存超过30秒自动过期
3. **路由导航回来** - 从其他页面导航回来

## 图片资源处理规范

### 作品封面图片 - 不缓存策略

对于可能更新的图片资源，必须添加时间戳防止浏览器缓存：

```typescript
const generateImageUrl = (path: string): string => {
  if (!path) return ''
  
  // 添加时间戳防止浏览器缓存
  const timestamp = Date.now()
  
  if (path.startsWith('http')) {
    const separator = path.includes('?') ? '&' : '?'
    return `${path}${separator}t=${timestamp}`
  }
  
  // Supabase存储URL
  const projectUrl = import.meta.env.VITE_SUPABASE_URL || ''
  if (projectUrl && path.includes('/')) {
    return `${projectUrl}/storage/v1/object/public/public-assets/${path}?t=${timestamp}`
  }
  
  return ''
}
```

### 适用场景

以下图片类型必须使用不缓存策略：
- ✅ 作品封面图片
- ✅ 用户头像
- ✅ 可编辑的图片资源

以下图片类型可以使用浏览器缓存：
- ✅ 静态图标
- ✅ 背景图片
- ✅ 不可变的装饰图片

## 缓存失效管理

### 必须清除缓存的操作

执行以下操作后，必须清除相关缓存：

```typescript
export function useCreateData() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (payload) => {
      // API调用
      return await api.create(payload)
    },
    onSuccess: (data, variables) => {
      // 必须清除相关缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.data.byEvent(variables.eventId)
      })
      
      // 显示成功消息
      store.setBanner('info', '创建成功！')
    },
  })
}
```

### 缓存失效规则

| 操作类型 | 需要清除的缓存 | 示例 |
|---------|---------------|------|
| 创建 | 列表缓存 | 创建队伍 → 清除队伍列表 |
| 更新 | 详情和列表缓存 | 更新作品 → 清除作品详情和列表 |
| 删除 | 相关所有缓存 | 删除队伍 → 清除队伍详情、列表、成员 |

## 组件使用规范

### 在组件中使用Vue Query

```typescript
// ✅ 正确的使用方式
export default {
  setup() {
    const eventId = computed(() => String(route.params.id ?? ''))
    
    // 使用组合函数
    const { teams, seekers } = useTeamData(eventId.value)
    const { submissions } = useSubmissionData(eventId.value)
    
    // 在模板中使用
    const teamList = computed(() => teams.data.value || [])
    const submissionList = computed(() => submissions.data.value || [])
    
    return {
      teamList,
      submissionList,
      // 暴露查询对象用于状态检查
      teams,
      submissions,
    }
  }
}
```

### 加载和错误状态处理

```vue
<template>
  <!-- 加载状态 -->
  <div v-if="teams.isLoading.value" class="loading">
    <p>加载中...</p>
  </div>

  <!-- 错误状态 -->
  <div v-else-if="teams.error.value" class="error">
    <p>{{ teams.error.value?.message }}</p>
    <button @click="teams.refetch()">重试</button>
  </div>

  <!-- 成功状态 -->
  <div v-else class="content">
    <!-- 内容 -->
  </div>
</template>
```

## 性能优化要求

### 1. 避免频繁重新挂载

- 使用稳定的key值
- 避免在render中创建新对象
- 合理使用v-if和v-show

### 2. 合理设置缓存时间

```typescript
// 实时性要求高的数据
staleTime: 1000 * 10,  // 10秒

// 实时性要求中等的数据（推荐）
staleTime: 1000 * 30,  // 30秒

// 实时性要求低的数据
staleTime: 1000 * 60 * 5,  // 5分钟
```

### 3. 利用缓存共享

- 相同queryKey的查询自动共享缓存
- 避免重复的网络请求
- 合理设计查询键结构

## 错误处理规范

### 网络错误重试

```typescript
retry: (failureCount, error) => {
  // 仅网络错误重试，最多3次
  const isNetworkError = error?.message?.includes('网络') || 
                        error?.message?.includes('fetch') ||
                        error?.code === 'NETWORK_ERROR'
  return isNetworkError && failureCount < 3
},
```

### 错误消息显示

- 使用项目的错误处理系统
- 集成banner通知
- 提供重试选项

## 调试和监控

### 开发环境调试

在开发环境中，可以通过以下方式监控缓存状态：

1. **浏览器开发者工具** - Network标签观察请求
2. **Vue DevTools** - 查看组件状态
3. **控制台日志** - Vue Query输出的调试信息

### 生产环境监控

- 监控API调用频率
- 跟踪缓存命中率
- 观察用户体验指标

## 常见问题和解决方案

### 问题1：数据不更新

**解决方案：**
```typescript
// 手动刷新
teams.refetch()

// 或清除缓存
queryClient.invalidateQueries({
  queryKey: queryKeys.teams.byEvent(eventId)
})
```

### 问题2：频繁网络请求

**检查项：**
- staleTime设置是否过短
- 组件是否频繁重新挂载
- refetchOnMount/refetchOnWindowFocus配置

### 问题3：缓存数据过旧

**解决方案：**
- 减少staleTime值
- 在关键操作后调用refetch()
- 使用invalidateQueries()主动清除

## 最佳实践清单

### ✅ 必须做的

- [ ] 使用统一的查询键工厂
- [ ] 配置正确的缓存策略
- [ ] 在变更操作后清除相关缓存
- [ ] 为图片资源添加时间戳
- [ ] 正确处理加载和错误状态
- [ ] 使用网络错误重试机制

### ❌ 禁止做的

- [ ] 直接使用字符串数组作为queryKey
- [ ] 忽略缓存失效处理
- [ ] 在组件中直接调用API
- [ ] 使用过短或过长的staleTime
- [ ] 忽略错误处理
- [ ] 在render中创建新的查询键

## 代码审查要点

在代码审查时，必须检查以下项目：

1. **Vue Query配置** - 是否使用了正确的配置参数
2. **查询键管理** - 是否使用了查询键工厂
3. **缓存失效** - 变更操作后是否清除了相关缓存
4. **图片处理** - 是否为可变图片添加了时间戳
5. **错误处理** - 是否正确处理了加载和错误状态
6. **性能优化** - 是否避免了不必要的重新渲染

遵循这些规范，确保项目的缓存管理既高效又可靠，为用户提供最佳的使用体验。