## 数据库结构 (Supabase / PostgreSQL)

**1. 枚举类型 (Enums)**
- `event_status`: 'draft' (草稿), 'published' (已发布), 'ended' (已结束)
- `registration_status`: 'registered' (已注册) - 注意：云端只有这一个值
- `user_role`: 'programmer' (程序员), 'planner' (策划), 'artist' (美术), 'audio' (音频)
- `join_request_status`: 'pending' (待处理), 'approved' (已批准), 'rejected' (已拒绝), 'cancelled' (已取消)
- `submission_link_mode`: 'link' (外部链接), 'file' (文件上传)

**2. 表结构**

> 说明：`profiles` 作为“公开名片”（给已登录用户展示昵称/头像/职能），`user_contacts` 作为“私密档案”（电话/QQ 仅本人可读写）。

### `profiles` (用户资料表)
- `id` (uuid, PK): 关联 auth.users.id
- `username` (text): 用户昵称 (最少3个字符)
- `email` (text): 用户邮箱 (从 auth.users 同步，支持用户名登录)
- `avatar_url` (text): 头像地址
- `roles` (user_role[]): 职能标签数组（可多选：programmer / planner / artist / audio）
- `updated_at` (timestamptz): 更新时间

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
- `name` (text): 队伍名称 (2-30个字符)
- `event_id` (uuid, FK): 关联 events.id
- `leader_id` (uuid, FK): 关联 profiles.id (队长)
- `created_at` (timestamptz): 创建时间
- `updated_at` (timestamptz): 更新时间
- `intro` (text): 队伍简介
- `extra` (text): 额外信息
- `leader_qq` (text): 队长QQ
- `needs` (text[]): 需要的职能标签 (最多6个)

### `registrations` (报名记录表)
- `id` (uuid, PK): 主键
- `user_id` (uuid, FK): 关联 profiles.id
- `event_id` (uuid, FK): 关联 events.id
- `team_id` (uuid, FK, Optional): 关联 teams.id (如果是个人报名则为 NULL)
- `form_response` (jsonb): 报名表单填写结果
- `status` (enum: registration_status): 报名状态 (目前只有 'registered')
- `created_at` (timestamptz): 创建时间
- **Unique Constraint**: `(user_id, event_id)` (防止重复报名)

### `team_seekers` (求组队卡片)
- `id` (uuid, PK): 主键
- `event_id` (uuid, FK): 关联 events.id
- `user_id` (uuid, FK): 关联 profiles.id
- `intro` (text): 个人简介
- `qq` (text): QQ 号
- `roles` (text[]): 个人职能（可多选：programmer / planner / artist / audio），可为空
- `created_at` (timestamptz): 创建时间
- `updated_at` (timestamptz): 更新时间
- **Unique Constraint**: `(event_id, user_id)` (每个用户在同一活动只能发布一张求组队卡片)

### `team_members` (队伍成员表)
- `id` (uuid, PK): 主键
- `team_id` (uuid, FK): 关联 teams.id
- `user_id` (uuid, FK): 关联 profiles.id
- `joined_at` (timestamptz): 加入时间
- **Unique Constraint**: `(team_id, user_id)` (防止重复加入)

### `team_join_requests` (入队申请表)
- `id` (uuid, PK): 主键
- `team_id` (uuid, FK): 关联 teams.id
- `user_id` (uuid, FK): 关联 profiles.id
- `status` (enum: join_request_status): 申请状态
- `message` (text): 申请留言
- `created_at` (timestamptz): 创建时间
- `updated_at` (timestamptz): 更新时间
- **Unique Constraint**: `(team_id, user_id)` (防止重复申请)

### `team_invites` (队伍邀请表)
- `id` (uuid, PK): 主键
- `team_id` (uuid, FK): 关联 teams.id
- `user_id` (uuid, FK): 关联 profiles.id (被邀请人)
- `invited_by` (uuid, FK): 关联 profiles.id (邀请人)
- `message` (text): 邀请留言
- `status` (text): 邀请状态 ('pending', 'accepted', 'declined')
- `created_at` (timestamptz): 创建时间
- `updated_at` (timestamptz): 更新时间
- **Unique Constraint**: `(team_id, user_id)` (防止重复邀请)

### `submissions` (作品提交)
- `id` (uuid, PK): 主键
- `event_id` (uuid, FK): 关联 events.id
- `team_id` (uuid, FK): 关联 teams.id
- `submitted_by` (uuid, FK): 关联 profiles.id（提交人，通常为队长）
- `project_name` (text): 作品名
- `intro` (text): 作品简介
- `cover_path` (text): 封面存储路径（如 storage 路径）
- `video_link` (text, nullable): 视频链接
- `link_mode` (text): 'link' | 'file'
- `submission_url` (text, nullable): 外部作品链接（当 link_mode='link'）
- `submission_storage_path` (text, nullable): 文件存储路径（当 link_mode='file'）
- `submission_password` (text, nullable): 网盘提取码或访问密码
- `created_at` (timestamptz): 创建时间
- `updated_at` (timestamptz): 更新时间
- **Unique Constraint**: `(event_id, team_id)`（同一队伍每个活动仅一条提交记录，可通过更新覆盖）
- **Check Constraint**: `link_mode='link'` 时 `submission_url` 必填；`link_mode='file'` 时 `submission_storage_path` 必填
- **Index**: `event_id`, `team_id`, `submitted_by`

**RLS 规则建议**
- `insert/update/delete`: 仅允许 `auth.uid()` 为 `teams.leader_id` 的用户操作，且 `submissions.team_id` 必须属于该队长
- `select`: 可按需求开放给队长/队员/活动创建者查看

## 云端数据库实际情况总结

✅ **已确认与云端一致的表**: profiles, user_contacts, events, teams, registrations, submissions, team_members, team_join_requests, team_seekers, team_invites

⚠️ **安全建议**: 云端数据库有9个函数存在安全警告，建议修复 search_path 设置。详见: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable