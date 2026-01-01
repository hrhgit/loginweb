# Vue Query 缓存管理指南

## 📋 目录

1. [概述](#概述)
2. [缓存需求](#缓存需求)
3. [Vue Query 配置](#vue-query-配置)
4. [请求触发策略](#请求触发策略)
5. [实现细节](#实现细节)
6. [使用示例](#使用示例)
7. [特殊情况：图片资源处理](#特殊情况图片资源处理)
8. [故障排除](#故障排除)

---

## 概述

本项目使用 Vue Query (TanStack Query) 实现智能缓存管理。系统采用 **stale-while-revalidate** 策略，确保用户能够立即看到缓存数据，同时在必要时获取最新数据。

### 核心目标

- ✅ **立即响应** - 缓存数据立即显示，无需等待
- ✅ **数据新鲜** - 在必要时自动更新数据
- ✅ **智能请求** - 避免不必要的频繁网络请求
- ✅ **良好体验** - 用户既能快速看到内容，又能获得最新数据

---

## 缓存需求

### 用户需求分析

用户对缓存的需求可以总结为：**"缓存和请求两件事都要做"**

这意味着：
1. 当有缓存时，立即显示缓存数据
2. 同时在必要时发起网络请求获取最新数据
3. 避免不必要的频繁请求

### 请求触发分类

#### 直接发起请求（无条件）

这些情况下必须发起网络请求，不能仅依赖缓存：

| # | 情况 | 原因 | 示例 |
|---|------|------|------|
| 1 | 首次打开界面 | 没有缓存数据 | 用户第一次访问事件详情页 |
| 2 | 手动刷新页面 | 缓存被清空 | 用户按 F5 或 Ctrl+R |
| 4 | 网络重新连接 | 需要同步数据 | 用户从离线恢复到在线 |
| 7 | 缓存失效 | 主动清除缓存 | 创建/更新/删除操作后 |
| 8 | 手动调用refetch() | 用户主动刷新 | 点击"刷新"按钮 |
| 9 | eventId参数变化 | 新的数据集 | 访问不同的事件 |

#### 条件性请求（基于缓存过期）

这些情况下先检查缓存是否过期，过期才发起请求：

| # | 情况 | 过期时间 | 行为 |
|---|------|---------|------|
| 3 | 窗口获得焦点 | 30秒 | 用户从其他标签页切换回来 |
| 5 | 数据过期后访问 | 30秒 | 缓存超过30秒自动过期 |
| 6 | 路由导航回来 | 30秒 | 从其他页面导航回来 |

---

## Vue Query 配置

### 全局配置

**文件：** `src/lib/vueQuery.ts`

```typescript
export const vueQueryOptions: VueQueryPluginOptions = {
  queryClientConfig: {
    defaultOptions: {
      queries: {
        gcTime: 1000 * 60 * 15,        // 15分钟后清理缓存
        staleTime: 1000 * 60 * 5,      // 5分钟后数据过期
        retry: (failureCount, error) => {
          // 仅网络错误重试，最多3次
          const isNetworkError = error?.message?.includes('网络') || 
                                error?.message?.includes('fetch')
          return isNetworkError && failureCount < 3
        },
        retryDelay: (attemptIndex) => 
          Math.min(1000 * 2 ** attemptIndex, 30000), // 指数退避
      },
    },
  },
}
```

### 查询配置

**文件：** `src/composables/useTeams.ts` 和 `src/composables/useSubmissions.ts`

```typescript
export function useTeams(eventId: string) {
  return useQuery({
    queryKey: queryKeys.teams.byEvent(eventId),
    queryFn: () => fetchTeams(eventId),
    enabled: computed(() => Boolean(eventId)),
    
    // 缓存策略
    staleTime: 1000 * 30,              // 30秒后数据过期
    gcTime: 1000 * 60 * 15,            // 15分钟后清理缓存
    
    // 重新获取策略
    refetchOnMount: false,             // 挂载时不自动重新获取
    refetchOnWindowFocus: false,       // 窗口焦点时不自动重新获取
    refetchOnReconnect: true,          // 网络重连时直接重新获取
    
    // 重试策略
    retry: (failureCount, error) => {
      const isNetworkError = error?.message?.includes('网络') || 
                            error?.message?.includes('fetch') ||
                            error?.code === 'NETWORK_ERROR'
      return isNetworkError && failureCount < 3
    },
  })
}
```

### 配置参数说明

| 参数 | 值 | 说明 |
|------|-----|------|
| `staleTime` | 30秒 | 数据新鲜度时间，超过此时间数据被标记为过期 |
| `gcTime` | 15分钟 | 垃圾回收时间，超过此时间未使用的缓存被清理 |
| `refetchOnMount` | false | 组件挂载时不自动重新获取（除非无缓存） |
| `refetchOnWindowFocus` | false | 窗口获得焦点时不自动重新获取（除非无缓存） |
| `refetchOnReconnect` | true | 网络重连时直接重新获取 |
| `retry` | 3次 | 网络错误时最多重试3次 |

---

## 请求触发策略

### 决策流程图

```
触发事件
  ↓
是否是直接请求情况？
(首次加载、手动刷新、网络重连、缓存失效、手动refetch、eventId变化)
  ├─ 是 → 直接发起请求
  └─ 否 → 检查缓存
      ├─ 无缓存 → 发起请求
      └─ 有缓存 → 检查是否过期？
          ├─ 未过期(30秒内) → 显示缓存，不请求
          └─ 已过期(30秒后) → 显示缓存，发起请求
```

### 时间线示例

#### 场景1：首次访问

```
时间  操作              缓存状态    网络请求    UI显示
─────────────────────────────────────────────────
0秒   打开页面          无缓存      发起        Loading
2秒   数据返回          已缓存      完成        显示数据
```

#### 场景2：在页面停留30秒后切换标签页再回来

```
时间  操作              缓存状态    网络请求    UI显示
─────────────────────────────────────────────────
0秒   打开页面          无缓存      发起        Loading
2秒   数据返回          已缓存      完成        显示数据
30秒  切换标签页        新鲜        无          （离开）
35秒  切换回来          已过期      发起        立即显示缓存
37秒  新数据返回        更新        完成        更新UI
```

#### 场景3：手动刷新页面

```
时间  操作              缓存状态    网络请求    UI显示
─────────────────────────────────────────────────
0秒   打开页面          无缓存      发起        Loading
2秒   数据返回          已缓存      完成        显示数据
10秒  用户按F5          清空        发起        Loading
12秒  新数据返回        已缓存      完成        显示数据
```

#### 场景4：网络断开后恢复

```
时间  操作              缓存状态    网络请求    UI显示
─────────────────────────────────────────────────
0秒   打开页面          无缓存      发起        Loading
2秒   数据返回          已缓存      完成        显示数据
10秒  网络断开          有缓存      无          显示缓存
15秒  网络恢复          有缓存      发起        立即显示缓存
17秒  新数据返回        更新        完成        更新UI
```

---

## 实现细节

### 查询键管理

**文件：** `src/lib/vueQuery.ts`

```typescript
export const queryKeys = {
  teams: {
    all: ['teams'],
    byEvent: (eventId: string) => ['teams', 'event', eventId],
    seekers: (eventId: string) => ['teams', 'seekers', eventId],
    members: (teamId: string) => ['teams', 'members', teamId],
  },
  submissions: {
    all: ['submissions'],
    byEvent: (eventId: string) => ['submissions', 'event', eventId],
    byTeam: (teamId: string) => ['submissions', 'team', teamId],
  },
}
```

**优势：**
- 统一管理查询键，避免重复和冲突
- 相同键的查询自动共享缓存
- 便于缓存失效管理

### 缓存失效

当执行创建/更新/删除操作时，需要主动清除相关缓存：

```typescript
export function useCreateTeam() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (payload) => {
      // 创建队伍的API调用
      return await supabase.from('teams').insert(payload)
    },
    onSuccess: (data, variables) => {
      // 清除该事件的队伍列表缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.teams.byEvent(variables.eventId)
      })
      
      store.setBanner('info', '队伍创建成功！')
    },
  })
}
```

### 数据获取函数

```typescript
const fetchTeams = async (eventId: string): Promise<TeamLobbyTeam[]> => {
  if (!eventId) return []

  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (error) {
    teamErrorHandler.handleError(error, { operation: 'fetchTeams' })
    throw error
  }

  return data.map(team => ({
    id: team.id,
    event_id: team.event_id,
    leader_id: team.leader_id,
    name: team.name || '',
    // ... 其他字段
  }))
}
```

---

## 使用示例

### 在组件中使用

**文件：** `src/pages/EventDetailPage.vue`

```typescript
import { useTeamData } from '../composables/useTeams'
import { useSubmissionData } from '../composables/useSubmissions'

export default {
  setup() {
    const eventId = computed(() => String(route.params.id ?? ''))
    
    // 获取队伍数据
    const { teams, seekers } = useTeamData(eventId.value)
    
    // 获取作品数据
    const { submissions } = useSubmissionData(eventId.value)
    
    // 在模板中使用
    const teamLobbyTeams = computed(() => teams.data.value || [])
    const allSubmissions = computed(() => submissions.data.value || [])
    
    return {
      teamLobbyTeams,
      allSubmissions,
      teams,
      submissions,
    }
  }
}
```

### 在模板中显示加载和错误状态

```vue
<!-- 加载状态 -->
<div v-if="submissions.isLoading.value" class="loading">
  <p>加载作品中...</p>
</div>

<!-- 错误状态 -->
<div v-else-if="submissions.error.value" class="error">
  <p>{{ submissions.error.value?.message }}</p>
  <button @click="submissions.refetch()">重新加载</button>
</div>

<!-- 成功状态 -->
<div v-else class="submissions-list">
  <div v-for="submission in allSubmissions" :key="submission.id">
    {{ submission.project_name }}
  </div>
</div>
```

### 手动刷新数据

```typescript
// 手动刷新队伍数据
const refreshTeams = () => {
  teams.refetch()
}

// 手动刷新作品数据
const refreshSubmissions = () => {
  submissions.refetch()
}
```

### 创建新数据并更新缓存

```typescript
import { useCreateTeam } from '../composables/useTeams'

export default {
  setup() {
    const createTeamMutation = useCreateTeam()
    
    const handleCreateTeam = async (teamData) => {
      try {
        await createTeamMutation.mutateAsync({
          eventId: eventId.value,
          teamData,
        })
        // 缓存会自动更新
      } catch (error) {
        console.error('创建队伍失败:', error)
      }
    }
    
    return { handleCreateTeam }
  }
}
```

---

## 故障排除

### 问题1：数据不更新

**症状：** 修改了数据但页面没有更新

**原因：**
- 缓存没有被正确失效
- 网络请求失败

**解决方案：**
```typescript
// 手动刷新数据
teams.refetch()

// 或者手动清除缓存
queryClient.invalidateQueries({
  queryKey: queryKeys.teams.byEvent(eventId)
})
```

### 问题2：频繁的网络请求

**症状：** 页面频繁发起网络请求

**原因：**
- `staleTime` 设置过短
- 组件频繁重新挂载
- `refetchOnWindowFocus` 或 `refetchOnMount` 设置不当

**解决方案：**
- 增加 `staleTime` 值
- 检查组件是否有不必要的重新渲染
- 确认配置中 `refetchOnMount: false` 和 `refetchOnWindowFocus: false`

### 问题3：缓存数据过旧

**症状：** 用户看到的数据太旧

**原因：**
- `staleTime` 设置过长
- 没有在必要时主动刷新

**解决方案：**
- 减少 `staleTime` 值
- 在关键操作后调用 `refetch()`
- 使用 `invalidateQueries()` 主动清除缓存

### 问题4：离线时无法显示数据

**症状：** 网络断开后页面无法显示任何数据

**原因：**
- 没有缓存数据
- 网络请求失败

**解决方案：**
- 确保用户在离线前访问过页面（建立缓存）
- 实现离线提示
- 考虑实现 Service Worker 进行离线缓存

---

## 最佳实践

### 1. 合理设置缓存时间

```typescript
// 实时性要求高的数据
staleTime: 1000 * 10,  // 10秒

// 实时性要求中等的数据
staleTime: 1000 * 30,  // 30秒

// 实时性要求低的数据
staleTime: 1000 * 60 * 5,  // 5分钟
```

### 2. 在关键操作后刷新数据

```typescript
const handleDeleteTeam = async (teamId: string) => {
  await deleteTeam(teamId)
  
  // 删除后刷新列表
  teams.refetch()
}
```

### 3. 使用查询键工厂避免重复

```typescript
// ✅ 好的做法
const queryKey = queryKeys.teams.byEvent(eventId)

// ❌ 避免
const queryKey = ['teams', 'event', eventId]
```

### 4. 正确处理错误

```typescript
const { error } = useTeams(eventId)

if (error.value) {
  // 显示错误信息
  console.error('加载失败:', error.value.message)
  
  // 提供重试选项
  <button @click="teams.refetch()">重试</button>
}
```

### 5. 监控缓存状态

```typescript
// 检查是否正在加载
if (teams.isLoading.value) {
  // 显示加载状态
}

// 检查是否有错误
if (teams.isError.value) {
  // 显示错误状态
}

// 检查是否正在后台获取
if (teams.isFetching.value) {
  // 可选：显示"更新中"指示器
}
```

---

## 特殊情况：图片资源处理

### 作品封面图片 - 不缓存策略

对于作品展示中的封面图片，需要特殊处理：**不缓存图片，每次都重新请求**。

#### 原因

- 用户可能更新作品封面
- 需要显示最新的封面图片
- 图片文件可能在服务器端更新

#### 实现方法

在生成图片URL时，添加时间戳或版本号查询参数：

```typescript
// 文件：src/components/showcase/SubmissionCard.vue

const generateStorageUrl = (path: string, timestamp?: number): string => {
  if (!path) return ''
  const trimmed = path.trim()
  if (trimmed.startsWith('http')) {
    // 对于外部URL，添加时间戳防止缓存
    const separator = trimmed.includes('?') ? '&' : '?'
    return `${trimmed}${separator}t=${timestamp || Date.now()}`
  }
  
  // 使用固定的 URL 模式
  const projectUrl = import.meta.env.VITE_SUPABASE_URL || ''
  if (projectUrl && trimmed.includes('/')) {
    const baseUrl = `${projectUrl}/storage/v1/object/public/public-assets/${trimmed}`
    // 添加时间戳防止浏览器缓存
    return `${baseUrl}?t=${timestamp || Date.now()}`
  }
  return ''
}

// 计算属性 - 每次都生成新的URL（包含当前时间戳）
const coverUrl = computed(() => {
  if (!props.submission.cover_path) return null
  try {
    // 不传递timestamp，让它每次都使用当前时间
    return generateStorageUrl(props.submission.cover_path)
  } catch {
    return null
  }
})
```

#### 浏览器缓存控制

如果需要更强的控制，可以在服务器端设置HTTP头：

```
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
Expires: 0
```

#### 性能考虑

虽然不缓存图片，但可以通过以下方式优化性能：

1. **使用CDN** - CDN会缓存图片，减少源服务器负载
2. **图片压缩** - 使用WebP格式和适当的分辨率
3. **懒加载** - 只加载可见的图片
4. **响应式图片** - 根据设备分辨率加载合适大小的图片

#### 代码示例

```vue
<template>
  <ResponsiveImage
    v-if="coverUrl"
    :src="coverUrl"
    :alt="submission.project_name"
    :width="400"
    :height="225"
    aspect-ratio="16 / 9"
    object-fit="cover"
    loading="lazy"
    :enable-web-p="true"
    :show-placeholder="true"
    placeholder-color="var(--surface-muted)"
    class="submission-card__image"
    @error="handleImageError"
  />
</template>

<script setup lang="ts">
const coverUrl = computed(() => {
  if (!props.submission.cover_path) return null
  try {
    // 每次都生成新的URL，包含时间戳
    return generateStorageUrl(props.submission.cover_path)
  } catch {
    return null
  }
})
</script>
```

### 数据缓存 vs 图片缓存

| 项目 | 数据（JSON） | 图片 |
|------|-------------|------|
| 缓存策略 | stale-while-revalidate | 不缓存 |
| 缓存时间 | 30秒 | 0秒 |
| 更新方式 | 后台自动更新 | 每次重新请求 |
| 查询参数 | 无 | 添加时间戳 |
| 原因 | 减少API调用 | 显示最新图片 |

---

## 总结

Vue Query 的缓存管理策略提供了：

- ✅ **智能缓存** - 自动管理缓存生命周期
- ✅ **灵活控制** - 精细化的请求触发策略
- ✅ **良好体验** - 立即显示缓存，后台更新数据
- ✅ **错误恢复** - 自动重试和错误处理
- ✅ **性能优化** - 减少不必要的网络请求
- ✅ **特殊处理** - 对图片等资源的差异化处理

通过合理配置和使用 Vue Query，可以实现高效的数据管理和优秀的用户体验。