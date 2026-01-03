# 评委工作台智能返回导航功能

## 功能概述
实现了从评委工作台跳转到作品详情页面后，能够智能返回到评委工作台的功能，而不是默认的作品展示页面。

## 实现的功能

### 1. 智能返回导航
- **从评委工作台跳转**: 作品详情页面的返回按钮会返回到评委工作台
- **从作品展示页跳转**: 作品详情页面的返回按钮会返回到作品展示页面
- **动态按钮文本**: 根据来源显示不同的返回按钮文本
- **智能面包屑**: 面包屑导航显示正确的路径层级

### 2. 用户体验优化
- **上下文感知**: 系统记住用户的来源页面
- **一致性导航**: 保持用户的导航预期
- **清晰标识**: 按钮和面包屑清楚显示返回目标

## 技术实现

### 代码修改

#### 1. JudgeWorkspace 组件 - 添加来源标识
```typescript
const handleSubmissionClick = (submission: SubmissionWithTeam) => {
  router.push({
    name: 'submission-detail',
    params: {
      eventId: props.eventId,
      submissionId: submission.id
    },
    query: {
      from: 'judge-workspace' // 标识来源为评委工作台
    }
  })
}
```

#### 2. SubmissionDetailPage - 智能返回逻辑
```typescript
const handleBack = () => {
  const from = route.query.from as string
  
  if (from === 'judge-workspace') {
    // 从评委工作台来的，返回评委工作台
    router.push({
      name: 'judge-workspace',
      params: {
        eventId: eventId.value
      }
    })
  } else {
    // 默认返回作品展示页面
    router.push(`/events/${eventId.value}/showcase`)
  }
}
```

#### 3. 动态文本显示
```typescript
const backButtonText = computed(() => {
  const from = route.query.from as string
  return from === 'judge-workspace' ? '返回评委工作台' : '返回列表'
})

const breadcrumbText = computed(() => {
  const from = route.query.from as string
  return from === 'judge-workspace' ? '评委工作台' : '作品展示'
})
```

#### 4. 模板更新
```vue
<button 
  class="btn btn--ghost btn--icon-text" 
  @click="handleBack"
  :aria-label="backButtonText"
>
  <ArrowLeft :size="18" />
  <span>{{ backButtonText }}</span>
</button>

<div class="breadcrumb">
  <span class="breadcrumb-item">{{ eventTitle }}</span>
  <ChevronRight :size="14" class="breadcrumb-separator" />
  <span class="breadcrumb-item">{{ breadcrumbText }}</span>
  <ChevronRight :size="14" class="breadcrumb-separator" />
  <span class="breadcrumb-item active">{{ submission.project_name }}</span>
</div>
```

## 用户交互流程

### 从评委工作台的导航流程
1. **评委工作台**: 用户在评委工作台浏览作品
2. **点击作品**: 点击作品卡片跳转到详情页
3. **查看详情**: 在作品详情页面查看完整信息
4. **智能返回**: 
   - 返回按钮显示"返回评委工作台"
   - 面包屑显示：活动名称 > 评委工作台 > 作品名称
   - 点击返回按钮直接回到评委工作台

### 从作品展示页的导航流程
1. **作品展示页**: 用户在公开的作品展示页浏览
2. **点击作品**: 点击作品卡片跳转到详情页
3. **查看详情**: 在作品详情页面查看完整信息
4. **常规返回**: 
   - 返回按钮显示"返回列表"
   - 面包屑显示：活动名称 > 作品名称
   - 点击返回按钮回到作品展示页

## 技术特性

### 路由参数管理
- **查询参数**: 使用 `?from=judge-workspace` 标识来源
- **参数传递**: 通过 Vue Router 的 query 参数传递
- **状态保持**: 参数在页面刷新后仍然有效

### 智能判断逻辑
- **来源检测**: 检查 `route.query.from` 参数
- **默认行为**: 未指定来源时使用默认返回逻辑
- **扩展性**: 可以轻松添加更多来源页面

### 用户体验
- **上下文感知**: 系统理解用户的导航上下文
- **预期一致**: 返回行为符合用户预期
- **视觉反馈**: 按钮文本和面包屑提供清晰指示

## 扩展性设计

### 支持更多来源页面
可以轻松扩展支持更多来源页面：

```typescript
const handleBack = () => {
  const from = route.query.from as string
  
  switch (from) {
    case 'judge-workspace':
      router.push({ name: 'judge-workspace', params: { eventId: eventId.value } })
      break
    case 'admin-panel':
      router.push({ name: 'event-admin', params: { id: eventId.value } })
      break
    case 'my-submissions':
      router.push({ name: 'me-created' })
      break
    default:
      router.push(`/events/${eventId.value}/showcase`)
  }
}
```

### 动态文本配置
```typescript
const navigationConfig = {
  'judge-workspace': {
    buttonText: '返回评委工作台',
    breadcrumbText: '评委工作台'
  },
  'admin-panel': {
    buttonText: '返回管理面板',
    breadcrumbText: '活动管理'
  },
  'my-submissions': {
    buttonText: '返回我的作品',
    breadcrumbText: '我的作品'
  }
}
```

## 测试建议

### 功能测试
1. **评委工作台路径**: 测试从评委工作台跳转和返回
2. **作品展示路径**: 测试从作品展示页跳转和返回
3. **直接访问**: 测试直接访问作品详情页的默认行为
4. **参数保持**: 测试页面刷新后参数是否保持

### 用户体验测试
1. **按钮文本**: 验证不同来源下按钮文本的正确性
2. **面包屑导航**: 验证面包屑路径的准确性
3. **导航一致性**: 确保导航行为符合用户预期
4. **无障碍性**: 测试屏幕阅读器和键盘导航

### 边界情况测试
1. **无效来源**: 测试无效的 from 参数
2. **缺失参数**: 测试缺少 from 参数的情况
3. **权限检查**: 确保返回目标页面的权限检查
4. **错误处理**: 测试返回失败时的处理

## 后续优化建议

### 功能增强
1. **历史记录**: 支持多层级的返回历史
2. **状态保持**: 返回时保持原页面的滚动位置和筛选状态
3. **快捷键**: 支持键盘快捷键快速返回
4. **右键菜单**: 添加右键菜单的返回选项

### 性能优化
1. **预加载**: 预加载可能的返回目标页面
2. **缓存策略**: 优化返回页面的数据缓存
3. **路由守卫**: 添加路由守卫优化导航性能

### 用户体验
1. **动画过渡**: 添加页面切换的过渡动画
2. **加载状态**: 显示返回过程的加载状态
3. **确认对话框**: 在有未保存更改时显示确认对话框

这个智能返回导航功能大大提升了评委工作台的用户体验，让评委能够更高效地在作品详情和工作台之间导航。