# 活动发布规则与权限逻辑

本文档说明当前项目中“活动发布”的前端行为与后端权限策略。

## 角色与权限来源
- 管理员权限仅从 `app_metadata.role` 判断。
- 当 `app_metadata.role === 'admin'` 时视为管理员。
- 不使用 `user_metadata` 判定权限。

## 状态定义
- `draft`：草稿，仅用于编辑与预览。
- `published`：已发布，所有用户可见并可报名。
- `ended`：已结束，仍可展示（目前前端没有设置入口，可在后端更新）。

## 发布流程
1) 管理员创建活动，状态默认为 `draft`。
2) 进入编辑页完善内容。
3) 点击“发布活动”将状态更新为 `published`。

前端创建活动时会校验：开始时间不得晚于结束时间。

## 可见性规则（前端）
- `/events` 活动列表只展示 `status != 'draft'` 的活动。
- `/events/mine` 仅管理员可见，且只展示 `created_by = 当前用户` 的活动。
- 普通用户没有“我发起的活动”入口，也不会看到草稿。

## 编辑与删除规则（前端）
- 仅管理员可进入编辑页。
- 只能编辑/删除自己创建的活动（按 `created_by` 判断）。
- 只有 `draft` 可以删除。

## 报名规则（前端）
- 仅 `published` / `ended` 的活动允许报名。
- 草稿活动不可报名。

## 数据库 / RLS 规则（supabase.sql）
- `events` 表 insert：
  - 仅 `authenticated`。
  - 必须 `app_metadata.role = 'admin'`。
  - 必须 `created_by = auth.uid()`（列默认值为 `auth.uid()`）。
- `events` 表 update/delete：
  - 仅管理员可操作。
- `events` 表 select：
  - 当前策略对所有用户开放（`using (true)`）。
- `registrations` 表 insert：
  - `user_id = auth.uid()`（只能给自己报名）。

## 说明与建议
- 草稿不可见是“前端逻辑”，数据库 `select` 当前允许读到全部活动。
- 若需要彻底保护草稿，建议在 `events` 的 select policy 中加上：
  - 非管理员只能看到 `published/ended`，
  - 管理员只能看到 `published/ended` 或自己创建的草稿。
