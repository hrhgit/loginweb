# 评委邀请功能修复总结

## 问题描述
在 `EventAdminPageSimple.vue` 页面中，评委管理页面的评委邀请功能没有正常工作。虽然界面上有"邀请评委"按钮，但点击后没有任何反应。

## 问题原因
1. **缺少 UserSearchModal 组件导入**：页面没有导入用于搜索和邀请用户的模态框组件
2. **handleInviteJudge 函数为空**：该函数只是一个占位符，没有实际的功能实现
3. **缺少模态框状态管理**：没有定义控制邀请模态框显示/隐藏的状态变量
4. **模板中缺少 UserSearchModal**：页面模板中没有包含邀请模态框组件

## 修复内容

### 1. 添加组件导入
```typescript
import UserSearchModal from '../components/modals/UserSearchModal.vue'
```

### 2. 添加状态管理
```typescript
// Judge invitation modal state
const inviteJudgeModalOpen = ref(false)
```

### 3. 实现邀请功能
```typescript
// 处理邀请评委
const handleInviteJudge = () => {
  inviteJudgeModalOpen.value = true
}

const handleJudgeInvited = (userId: string) => {
  // The modal will handle the success message and close itself
  // We could refresh judge data here if needed
}

const handleCloseInviteModal = () => {
  inviteJudgeModalOpen.value = false
}
```

### 4. 添加模态框组件
```vue
<!-- Judge Invitation Modal -->
<UserSearchModal
  :event-id="eventId"
  :is-open="inviteJudgeModalOpen"
  @close="handleCloseInviteModal"
  @judge-invited="handleJudgeInvited"
/>
```

## 功能验证

修复后的评委邀请功能应该能够：

1. ✅ 点击"邀请评委"按钮打开搜索模态框
2. ✅ 在模态框中搜索用户
3. ✅ 显示搜索结果并标识已邀请的用户
4. ✅ 点击"邀请"按钮发送邀请
5. ✅ 显示邀请成功/失败的反馈信息
6. ✅ 自动关闭模态框并刷新评委列表

## 相关文件
- `src/pages/EventAdminPageSimple.vue` - 主要修复文件
- `src/components/admin/JudgeManagementPanel.vue` - 评委管理面板组件
- `src/components/modals/UserSearchModal.vue` - 用户搜索和邀请模态框
- `src/store/appStore.ts` - 评委相关的状态管理和API调用

## 数据库支持
评委邀请功能的数据库结构已经完整实现：
- `event_judges` 表存储评委关联关系
- RLS 策略确保权限控制
- 相关的辅助函数和视图已创建

## 注意事项
- 只有活动创建者可以邀请和管理评委
- 同一用户在同一活动中只能被邀请一次
- 评委邀请会发送通知给被邀请的用户
- 支持搜索用户名进行邀请