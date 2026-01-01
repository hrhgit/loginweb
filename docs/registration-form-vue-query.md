# 报名表数据管理 - Vue Query 实现

## 概述

本文档描述了如何使用 Vue Query 管理活动报名表数据，替代原有的直接 Supabase 调用方式，实现智能缓存和更好的用户体验。

## 核心功能

### 1. 报名表数据获取

使用 `useRegistrationForm` composable 获取用户在特定活动的报名表数据：

```typescript
import { useRegistrationForm } from '@/composables/useRegistrationForm'

// 在组件中使用
const eventId = computed(() => route.params.id as string)
const userId = computed(() => store.user?.id || '')

const formQuery = useRegistrationForm(eventId.value, userId.value)

// 访问数据
const formData = computed(() => formQuery.data.value || {})
const isLoading = computed(() => formQuery.isLoading.value)
const error = computed(() => formQuery.error.value)
```

### 2. 报名人数统计

使用 `useRegistrationCount` composable 获取活动的报名人数：

```typescript
import { useRegistrationCount } from '@/composables/useRegistrationForm'

const countQuery = useRegistrationCount(eventId.value)

// 访问数据
const registrationCount = computed(() => countQuery.data.value || 0)
const isCountLoading = computed(() => countQuery.isLoading.value)
```

### 3. 更新报名表数据

使用 `useUpdateRegistrationForm` mutation 更新报名表：

```typescript
import { useUpdateRegistrationForm } from '@/composables/useRegistrationForm'

const updateMutation = useUpdateRegistrationForm()

// 更新数据
const updateForm = async () => {
  try {
    await updateMutation.mutateAsync({
      registrationId: 'reg-123',
      formResponse: {
        question1: 'answer1',
        question2: ['option1', 'option2']
      }
    })
    // 成功后会自动显示成功消息并刷新缓存
  } catch (error) {
    // 错误处理已集成到 mutation 中
  }
}
```

### 4. 组合使用

使用 `useRegistrationData` 组合函数同时获取表单数据和人数统计：

```typescript
import { useRegistrationData } from '@/composables/useRegistrationForm'

const registrationData = useRegistrationData(eventId.value, userId.value)

// 访问所有数据
const {
  formData,
  formLoading,
  formError,
  refetchForm,
  registrationCount,
  countLoading,
  countError,
  refetchCount,
  isLoading,
  error,
  refetchAll
} = registrationData
```

## 缓存策略

### 自动缓存管理

- **缓存时间**: 30秒 (staleTime)
- **垃圾回收**: 15分钟 (gcTime)
- **重新获取**: 仅在网络重连时自动重新获取
- **重试策略**: 仅网络错误重试，最多3次

### 缓存失效

以下操作会自动清除相关缓存：

1. **更新报名表**: 清除所有报名相关缓存
2. **用户报名/取消报名**: 清除报名人数缓存
3. **手动刷新**: 调用 `refetch()` 方法

## 错误处理

### 自动错误处理

所有错误都会通过项目的错误处理系统自动处理：

- **网络错误**: 自动重试并显示网络相关错误消息
- **权限错误**: 显示权限不足消息
- **验证错误**: 显示表单验证错误消息

### 手动错误处理

```typescript
// 检查错误状态
if (formQuery.error.value) {
  console.error('获取报名表失败:', formQuery.error.value.message)
}

// 重试操作
const retry = () => {
  formQuery.refetch()
}
```

## 性能优化

### 1. 智能缓存

- 相同的 eventId + userId 组合会共享缓存
- 避免重复的网络请求
- 自动内存管理和清理

### 2. 按需加载

- 只有在 eventId 和 userId 都存在时才发起请求
- 支持条件性启用/禁用查询

### 3. 批量操作

- 支持同时获取表单数据和人数统计
- 统一的加载和错误状态管理

## 迁移指南

### 从旧的实现迁移

**旧的实现**:
```typescript
// 旧方式 - 直接调用 Supabase
const loadRegistrationFormResponse = async () => {
  formLoading.value = true
  const { data, error } = await supabase
    .from('registrations')
    .select('form_response')
    .eq('id', registrationId)
    .maybeSingle()
  
  if (error) {
    formSaveError.value = error.message
  } else {
    applyFormResponse(data?.form_response ?? {})
  }
  formLoading.value = false
}
```

**新的实现**:
```typescript
// 新方式 - 使用 Vue Query
const registrationData = useRegistrationData(eventId.value, userId.value)

// 监听数据变化
watch(
  () => registrationData.formData.value,
  (formData) => {
    if (formData) {
      applyFormResponse(formData)
    }
  },
  { immediate: true }
)
```

### 主要改进

1. **自动缓存管理**: 无需手动管理加载状态
2. **错误处理集成**: 统一的错误处理和用户反馈
3. **性能优化**: 智能缓存和重复请求去除
4. **类型安全**: 完整的 TypeScript 类型支持
5. **测试友好**: 易于模拟和测试

## 最佳实践

### 1. 使用组合函数

优先使用 `useRegistrationData` 而不是单独的 hooks：

```typescript
// ✅ 推荐
const registrationData = useRegistrationData(eventId.value, userId.value)

// ❌ 不推荐（除非只需要其中一个）
const formQuery = useRegistrationForm(eventId.value, userId.value)
const countQuery = useRegistrationCount(eventId.value)
```

### 2. 响应式参数

确保传入的参数是响应式的：

```typescript
// ✅ 正确
const eventId = computed(() => route.params.id as string)
const registrationData = useRegistrationData(eventId.value, userId.value)

// ❌ 错误 - 参数不会响应变化
const registrationData = useRegistrationData(route.params.id, store.user?.id)
```

### 3. 条件性启用

在必要时使用条件性启用：

```typescript
const registrationData = useRegistrationData(
  eventId.value, 
  userId.value,
  // 只有在用户已登录且已报名时才获取表单数据
  computed(() => Boolean(userId.value && isRegistered.value))
)
```

### 4. 错误边界

在模板中正确处理加载和错误状态：

```vue
<template>
  <div v-if="registrationData.isLoading.value">
    加载中...
  </div>
  <div v-else-if="registrationData.error.value">
    加载失败: {{ registrationData.error.value.message }}
    <button @click="registrationData.refetchAll()">重试</button>
  </div>
  <div v-else>
    <!-- 正常内容 -->
  </div>
</template>
```

## 调试和监控

### 开发环境

在浏览器控制台中可以访问调试工具：

```javascript
// 查看缓存状态
window.__VUE_QUERY_DEBUG__.getCacheStats()

// 查看内存使用
window.__VUE_QUERY_DEBUG__.getMemoryStats()

// 清除所有缓存
window.__VUE_QUERY_DEBUG__.clearCache()
```

### 网络请求监控

在浏览器开发者工具的 Network 标签中可以观察到：

- 缓存命中时不会发起新的网络请求
- 数据过期时会自动发起后台更新请求
- 网络错误时的自动重试行为

这个实现完全符合项目的缓存管理规范，提供了更好的用户体验和开发体验。