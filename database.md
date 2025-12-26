## 数据库结构 (Supabase / PostgreSQL)

**1. 枚举类型 (Enums)**
- `event_status`: 'draft' (草稿), 'published' (已发布), 'ended' (已结束)
- `registration_status`: 'pending' (待定), 'confirmed' (已确认), 'cancelled' (已取消)

**2. 表结构**

> 说明：`profiles` 作为“公开名片”（给已登录用户展示昵称/头像/职能），`user_contacts` 作为“私密档案”（电话/QQ 仅本人可读写）。

### `profiles` (用户资料表)
- `id` (uuid, PK): 关联 auth.users.id
- `username` (text): 用户昵称
- `avatar_url` (text): 头像地址
- `roles` (text[]): 职能标签（可多选：programmer / planner / artist / audio）
- `is_admin` (boolean): 管理员标记 (注：虽然保留了字段，但目前主要使用 app_metadata 判断权限)

### `user_contacts` (私密联系方式表)
- `user_id` (uuid, PK): 关联 profiles.id
- `phone` (text): 电话号码（仅自己可读写）
- `qq` (text): QQ 号码（仅自己可读写）
- `updated_at` (timestamptz): 更新时间

### `events` (活动表)
- `id` (uuid, PK): 主键
- `title` (text): 活动标题
- `description` (text): 详情（JSON：summary + details，details 内含 registrationForm）
- `start_time` (timestamptz): 开始时间
- `end_time` (timestamptz): 结束时间
- `registration_start_time` (timestamptz): 报名开始时间
- `registration_end_time` (timestamptz): 报名结束时间
- `is_registration_open` (boolean, 虚拟列): 报名是否开放
- `submission_start_time` (timestamptz): 提交开始时间
- `submission_end_time` (timestamptz): 提交结束时间
- `is_submission_open` (boolean, 虚拟列): 提交是否开放
- `location` (text): 地点
- `team_max_size` (int): 队伍最大人数 (每队最多人数，0 表示不限)
- `status` (enum: event_status): 活动状态
- `created_by` (uuid, FK): 关联 profiles.id (发布者)

### `teams` (队伍表)
- `id` (uuid, PK): 主键
- `name` (text): 队伍名称
- `event_id` (uuid, FK): 关联 events.id
- `leader_id` (uuid, FK): 关联 profiles.id (队长)

### `registrations` (报名记录表)
- `id` (uuid, PK): 主键
- `user_id` (uuid, FK): 关联 profiles.id
- `event_id` (uuid, FK): 关联 events.id
- `team_id` (uuid, FK, Optional): 关联 teams.id (如果是个人报名则为 NULL)
- `form_response` (jsonb): 报名表单填写结果
- `status` (enum: registration_status): 报名状态
- **Unique Constraint**: `(user_id, event_id)` (防止重复报名)
