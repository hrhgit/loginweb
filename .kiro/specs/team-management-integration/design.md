# Design Document

## Overview

本设计文档描述了将个人中心的"我的队伍"功能整合到活动详情页面组队大厅的实现方案。通过在现有的"找队伍"和"找队友"页签后添加"我的队伍"页签，为用户提供更集中的队伍管理体验，同时保持个人中心的完整功能。

## Architecture

### 组件架构
- **EventDetailPage.vue**: 主要的活动详情页面，包含组队大厅功能
- **MyTeamsTab**: 新增的我的队伍页签组件（可复用）
- **TeamCard**: 队伍信息展示卡片组件
- **TeamActionButtons**: 队伍操作按钮组件

### 数据流架构
- **Store层**: 扩展现有的appStore，添加活动特定的队伍过滤方法
- **组件层**: 通过computed属性获取过滤后的队伍数据
- **UI层**: 响应式显示队伍信息和操作界面

## Components and Interfaces

### 1. TeamLobbyTab类型扩展
```typescript
type TeamLobbyTab = 'teams' | 'seekers' | 'myteams'
```

### 2. MyTeamsTab组件接口
```typescript
interface MyTeamsTabProps {
  eventId: string
  isDemo: boolean
}

interface MyTeamEntry {
  teamId: string
  teamName: string
  role: 'leader' | 'member'
  memberCount: number
  status: 'active' | 'pending'
}

interface MyTeamRequest {
  id: string
  teamId: string
  teamName: string
  status: 'pending' | 'approved' | 'rejected'
  message: string | null
  createdAt: string
}

interface MyTeamInvite {
  id: string
  teamId: string
  teamName: string
  invitedByName: string | null
  status: 'pending' | 'accepted' | 'rejected'
  message: string | null
  createdAt: string
}
```

### 3. Store方法扩展
```typescript
interface AppStore {
  // 新增方法
  getMyTeamsForEvent(eventId: string): MyTeamEntry[]
  getMyTeamRequestsForEvent(eventId: string): MyTeamRequest[]
  getMyTeamInvitesForEvent(eventId: string): MyTeamInvite[]
  
  // 现有方法保持不变
  getTeamsForEvent(eventId: string): Team[]
  loadTeams(eventId: string): Promise<void>
}
```

## Data Models

### MyTeamEntry数据模型
```typescript
interface MyTeamEntry {
  teamId: string          // 队伍ID
  teamName: string        // 队伍名称
  role: 'leader' | 'member' // 用户在队伍中的角色
  memberCount: number     // 队伍成员数量
  status: 'active' | 'pending' // 队伍状态
  eventId: string         // 关联的活动ID
  createdAt: string       // 创建时间
}
```

### 队伍操作状态模型
```typescript
interface TeamActionState {
  cancelRequestBusyId: string | null
  acceptInviteBusyId: string | null
  leaveTeamBusyId: string | null
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

在分析所有可测试的属性后，我发现了一些可以合并的冗余属性：
- 属性1.1和3.1都涉及页签显示，可以合并为一个综合的页签渲染属性
- 属性1.4和3.2都涉及空状态显示，可以合并为一个空状态处理属性
- 属性2.1和2.2都涉及角色显示，可以合并为一个角色权限显示属性
- 属性4.3和4.4都涉及数据同步，可以合并为一个数据同步属性

Property 1: 我的队伍页签正确渲染
*For any* 登录用户访问活动详情页面的组队大厅，"我的队伍"页签应该出现在"找队伍"和"找队友"页签之后，且仅对登录用户可见
**Validates: Requirements 1.1, 1.3**

Property 2: 活动特定队伍数据过滤
*For any* 用户查看"我的队伍"页签，显示的队伍数据应该仅包含与当前活动相关的队伍信息
**Validates: Requirements 1.2, 3.1, 3.3**

Property 3: 空状态正确处理
*For any* 用户在没有相关队伍数据时查看"我的队伍"页签，应该显示适当的空状态提示和引导信息
**Validates: Requirements 1.4, 3.2**

Property 4: 用户角色权限正确显示
*For any* 用户在队伍中的角色（队长或队员），应该显示对应的标识和相应的操作权限
**Validates: Requirements 2.1, 2.2**

Property 5: 队伍状态实时更新
*For any* 队伍相关数据变化（申请、邀请、成员变更），所有相关的UI组件应该实时反映最新状态
**Validates: Requirements 2.3, 2.4, 2.5, 5.2**

Property 6: 加载和错误状态处理
*For any* 队伍数据加载过程，应该正确显示加载状态指示器，并在失败时提供错误信息和重试选项
**Validates: Requirements 3.4, 3.5**

Property 7: 功能一致性保持
*For any* 队伍管理操作，在活动详情页面和个人中心页面应该提供一致的功能和行为
**Validates: Requirements 1.5, 4.1, 4.5**

Property 8: 跨页面数据同步
*For any* 队伍操作在任一页面执行，所有打开的相关页面应该同步更新显示内容
**Validates: Requirements 4.3, 4.4**

Property 9: 导航功能正确性
*For any* 用户在个人中心点击特定队伍，应该正确导航到对应活动的详情页面
**Validates: Requirements 4.2**

## Error Handling

### 数据加载错误
- 网络请求失败时显示重试按钮
- 权限不足时显示相应提示
- 数据格式错误时进行容错处理

### 用户操作错误
- 重复操作防护（防止多次点击）
- 操作权限验证
- 操作结果反馈

### 状态同步错误
- 页面间数据不一致时的修复机制
- 实时更新失败时的降级处理

## Testing Strategy

### 单元测试方法
- 测试组件渲染逻辑
- 测试数据过滤方法
- 测试用户交互处理
- 测试错误边界情况

### 属性测试方法
本设计将使用 **Vitest** 作为属性测试框架，配合 **fast-check** 进行属性生成。每个属性测试将运行最少100次迭代以确保充分的随机性覆盖。

每个属性测试必须包含以下格式的注释标签：
```typescript
// **Feature: team-management-integration, Property {number}: {property_text}**
```

### 集成测试方法
- 测试页面间的数据同步
- 测试完整的用户工作流
- 测试与后端API的集成
