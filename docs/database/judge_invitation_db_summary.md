# 评委邀请功能数据库实施总结

## 已完成的数据库结构

### 1. 枚举类型
- 添加了 `join_request_status` 枚举类型：`('pending', 'approved', 'rejected', 'cancelled')`

### 2. 主表结构
创建了 `public.event_judges` 表，包含以下字段：
- `id` (UUID): 主键，自动生成
- `event_id` (UUID): 活动ID，外键关联 `events.id`，级联删除
- `user_id` (UUID): 用户ID，外键关联 `profiles.id`，级联删除  
- `created_at` (TIMESTAMPTZ): 创建时间，默认当前时间
- `updated_at` (TIMESTAMPTZ): 更新时间，默认当前时间
- 唯一约束：`(event_id, user_id)` 确保同一用户在同一活动中只能被邀请一次

### 3. 索引优化
创建了以下索引以优化查询性能：
- `idx_event_judges_event_id`: 按活动ID查询
- `idx_event_judges_user_id`: 按用户ID查询  
- `idx_event_judges_created_at`: 按创建时间排序

### 4. 行级安全策略 (RLS)
实现了完整的权限控制：

#### 查看权限 (`评委记录查看`)
- 活动创建者可以查看该活动的所有评委
- 评委本人可以查看自己的评委记录

#### 插入权限 (`评委记录插入`)
- 只有活动创建者可以邀请评委

#### 删除权限 (`评委记录删除`)
- 只有活动创建者可以移除评委

### 5. 触发器和函数
- `handle_event_judges_updated_at()`: 自动更新 `updated_at` 时间戳
- `is_event_judge(event_id, user_id)`: 检查用户是否为指定活动的评委
- `is_event_admin(event_id, user_id)`: 检查用户是否为指定活动的管理员

### 6. 数据视图
创建了 `event_judges_with_profiles` 视图，包含：
- 评委记录的所有字段
- 关联的用户信息（用户名、头像、角色）
- 启用了安全屏障以确保 RLS 策略生效

### 7. 权限授予
- 为 `authenticated` 角色授予了表和函数的适当权限
- 确保所有操作都需要用户认证

## 安全特性

1. **数据完整性**: 通过外键约束确保数据一致性
2. **级联删除**: 当活动或用户被删除时，相关评委记录自动清理
3. **唯一性约束**: 防止重复邀请同一用户为评委
4. **行级安全**: 确保用户只能访问有权限的数据
5. **函数安全**: 权限检查函数使用 `SECURITY DEFINER` 确保安全执行

## 符合需求

该数据库结构完全符合设计文档中的要求：
- ✅ 需求 5.1: 权限验证一致性
- ✅ 需求 5.4: 用户删除时自动撤销评委权限  
- ✅ 需求 5.5: 活动删除时自动清理评委权限记录

## 下一步

数据库结构已就绪，可以开始实施：
- 核心数据模型和类型定义
- 状态管理扩展
- 评委邀请核心功能