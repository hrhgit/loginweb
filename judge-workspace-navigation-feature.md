# 评委工作台作品详情跳转功能

## 功能概述
为评委工作台的作品卡片添加了跳转到作品详情页面的功能，让评委可以方便地查看作品的完整信息。

## 实现的功能

### 1. 作品卡片点击跳转
- **单击作品卡片**: 直接跳转到作品详情页面
- **双击作品卡片**: 跳转到作品详情页面（与单击相同）
- **点击作品标题**: 跳转到作品详情页面

### 2. 路由跳转
- **目标路由**: `/events/:eventId/submissions/:submissionId`
- **路由名称**: `submission-detail`
- **参数传递**: 
  - `eventId`: 当前活动ID
  - `submissionId`: 作品ID

### 3. 用户体验优化
- **视觉提示**: 鼠标悬停时显示"点击查看详情"提示
- **平滑过渡**: 提示文字有淡入淡出动画效果
- **保持选择**: 跳转不会影响已选择的作品状态

## 技术实现

### 代码修改

#### 1. 导入 Vue Router
```typescript
import { useRouter } from 'vue-router'
```

#### 2. 初始化路由实例
```typescript
const router = useRouter()
```

#### 3. 实现跳转方法
```typescript
const handleSubmissionClick = (submission: SubmissionWithTeam) => {
  router.push({
    name: 'submission-detail',
    params: {
      eventId: props.eventId,
      submissionId: submission.id
    }
  })
}

const handleSubmissionDoubleClick = (submission: SubmissionWithTeam) => {
  handleSubmissionClick(submission)
}

const handleSubmissionTitleClick = (submission: SubmissionWithTeam) => {
  handleSubmissionClick(submission)
}
```

#### 4. 绑定事件处理器
```vue
<SubmissionCard 
  :submission="submission"
  @click="handleSubmissionClick(submission)"
  @double-click="handleSubmissionDoubleClick(submission)"
  @title-click="handleSubmissionTitleClick(submission)"
>
  <template #actions>
    <span class="submission-hint">点击查看详情</span>
  </template>
</SubmissionCard>
```

#### 5. 添加样式
```css
.submission-hint {
  font-size: 0.75rem;
  color: var(--muted);
  opacity: 0;
  transition: opacity 0.18s ease;
}

.submission-item:hover .submission-hint {
  opacity: 1;
}
```

## 用户交互流程

### 评委工作台操作流程
1. **进入评委工作台**: 评委登录后进入活动的评委工作台
2. **浏览作品列表**: 查看分页显示的作品卡片
3. **选择查看作品**: 
   - 鼠标悬停在作品卡片上，显示"点击查看详情"提示
   - 点击作品卡片任意位置或标题
4. **跳转到详情页**: 自动跳转到作品详情页面
5. **查看完整信息**: 在详情页查看作品的完整信息、文件、视频等
6. **返回工作台**: 通过浏览器后退或导航返回评委工作台

### 与现有功能的兼容性
- **批量选择**: 复选框功能不受影响，仍可正常选择作品
- **批量下载**: 已选择的作品状态保持不变
- **分页功能**: 跳转后返回时保持当前页面状态

## 技术特性

### 路由管理
- **使用 Vue Router**: 标准的 Vue.js 路由跳转
- **参数传递**: 正确传递活动ID和作品ID
- **路由守卫**: 利用现有的权限检查机制

### 用户体验
- **即时反馈**: 点击后立即跳转，无延迟
- **视觉提示**: 悬停时显示操作提示
- **一致性**: 与其他页面的导航体验保持一致

### 性能优化
- **缓存利用**: 利用 Vue Query 的缓存机制
- **预加载**: 作品详情页面的数据可能已被缓存
- **轻量实现**: 最小化的代码修改，不影响现有性能

## 测试建议

### 功能测试
1. **基本跳转**: 验证点击作品卡片能正确跳转
2. **参数传递**: 确认跳转后URL参数正确
3. **权限检查**: 验证只有评委能访问详情页
4. **返回导航**: 测试浏览器后退功能

### 用户体验测试
1. **响应速度**: 测试跳转的响应时间
2. **视觉反馈**: 验证悬停提示的显示效果
3. **移动端**: 测试移动设备上的触摸操作
4. **无障碍**: 确保键盘导航和屏幕阅读器支持

### 兼容性测试
1. **批量操作**: 确认不影响现有的批量选择功能
2. **分页状态**: 验证跳转后返回时的状态保持
3. **缓存行为**: 测试数据缓存的正确性

## 后续优化建议

### 功能增强
1. **右键菜单**: 添加右键菜单选项（新标签页打开）
2. **键盘快捷键**: 支持键盘导航和快捷键
3. **预览模式**: 添加快速预览功能，无需完整跳转
4. **批量查看**: 支持批量打开多个作品详情

### 性能优化
1. **预加载**: 鼠标悬停时预加载作品详情数据
2. **虚拟滚动**: 大量作品时的性能优化
3. **图片懒加载**: 优化作品封面的加载策略

### 用户体验
1. **面包屑导航**: 在详情页显示导航路径
2. **快速返回**: 添加快速返回工作台的按钮
3. **作品导航**: 在详情页支持上一个/下一个作品导航

评委现在可以方便地从工作台跳转到作品详情页面，提升了评审工作的效率和体验。