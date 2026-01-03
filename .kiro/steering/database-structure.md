# 数据库结构文档

## 项目概述

本文档详细描述了活动管理平台的 Supabase PostgreSQL 数据库结构。该数据库支持 Game Jam 等创意活动的完整生命周期管理，包括用户管理、活动创建、团队组建、作品提交等核心功能。

## 数据库基本信息

- **数据库类型**: PostgreSQL 17.6.1
- **项目ID**: whnetfkhvuhcavvojjxa
- **项目名称**: hrhgit's Project
- **区域**: ap-southeast-1 (新加坡)
- **状态**: ACTIVE_HEALTHY

## 核心表结构

### 1. 用户相关表

#### profiles (用户档案表)
用户基本信息和角色管理的核心表。

```sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  updated_at timestamptz,
  username text CHECK (char_length(username) >= 1 AND char_length(username) <= 10),
  avatar_url text,
  roles user_role[] DEFAULT '{}'::user_role[]
);
```

**字段说明**:
- `id`: 用户唯一标识，关联 auth.users
- `username`: 用户名，1-10个字符
- `avatar_url`: 头像URL
- `roles`: 用户角色数组，支持: programmer, planner, artist, audio

**数据统计**: 1012 条记录
**RLS策略**: 已启用

#### user_contacts (用户联系方式表)
存储用户的联系信息。

```sql
CREATE TABLE user_contacts (
  user_id uuid PRIMARY KEY REFERENCES profiles(id),
  phone text,
  qq text,
  updated_at timestamptz DEFAULT now()
);
```

**字段说明**:
- `user_id`: 关联用户ID
- `phone`: 手机号码
- `qq`: QQ号码

**数据统计**: 1012 条记录

### 2. 活动相关表

#### events (活动表)
活动管理的核心表，支持草稿、发布、结束等状态。

```sql
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  title text NOT NULL,
  description text DEFAULT '{"summary": "", "details": {"registrationForm": []}}'::text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  location text,
  status event_status DEFAULT 'draft'::event_status,
  created_by uuid REFERENCES profiles(id) DEFAULT auth.uid(),
  team_max_size integer DEFAULT 0,
  submission_start_time timestamptz,
  submission_end_time timestamptz,
  registration_start_time timestamptz,
  registration_end_time timestamptz,
  template_type text DEFAULT 'default'::text,
  page_config jsonb DEFAULT '{}'::jsonb
);
```

**枚举类型**:
- `event_status`: draft, published, ended

**字段说明**:
- `description`: JSON格式的活动描述和报名表单配置
- `team_max_size`: 团队最大人数限制
- `page_config`: 页面配置信息

**数据统计**: 1 条记录

#### registrations (报名记录表)
用户活动报名信息。

```sql
CREATE TABLE registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES profiles(id),
  event_id uuid REFERENCES events(id),
  team_id uuid REFERENCES teams(id),
  form_response jsonb DEFAULT '{}'::jsonb,
  status registration_status
);
```

**枚举类型**:
- `registration_status`: registered

**字段说明**:
- `form_response`: JSON格式的报名表单响应数据
- `team_id`: 关联的团队ID（可为空）

**数据统计**: 1001 条记录

#### event_judges (活动评委表)
管理活动评委关系。

```sql
CREATE TABLE event_judges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id), -- 活动ID，外键关联events表
  user_id uuid REFERENCES profiles(id), -- 评委用户ID，外键关联profiles表
  created_at timestamptz DEFAULT now(), -- 邀请时间
  updated_at timestamptz DEFAULT now()  -- 最后更新时间
);
```

**数据统计**: 1 条记录

### 3. 团队相关表

#### teams (团队表)
团队基本信息和招募状态管理。

```sql
CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  event_id uuid REFERENCES events(id),
  leader_id uuid REFERENCES profiles(id),
  name text CHECK (char_length(name) >= 2 AND char_length(name) <= 30),
  intro text,
  extra text,
  leader_qq text NOT NULL,
  needs text[] DEFAULT '{}'::text[] CHECK (array_length(needs, 1) <= 6),
  is_closed boolean DEFAULT false -- 队伍是否已关闭招募（满员或手动关闭）
);
```

**字段说明**:
- `name`: 团队名称，2-30个字符
- `needs`: 招募需求数组，最多6个
- `is_closed`: 招募关闭状态

**数据统计**: 1001 条记录

#### team_members (团队成员表)
团队成员关系管理。

```sql
CREATE TABLE team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  joined_at timestamptz DEFAULT now(),
  team_id uuid REFERENCES teams(id),
  user_id uuid REFERENCES profiles(id)
);
```

**数据统计**: 1001 条记录

#### team_join_requests (加入申请表)
团队加入申请管理。

```sql
CREATE TABLE team_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  team_id uuid REFERENCES teams(id),
  user_id uuid REFERENCES profiles(id),
  status join_request_status DEFAULT 'pending'::join_request_status,
  message text
);
```

**枚举类型**:
- `join_request_status`: pending, approved, rejected, cancelled

**数据统计**: 1 条记录

#### team_seekers (寻队记录表)
用户寻找团队的记录。

```sql
CREATE TABLE team_seekers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id),
  user_id uuid REFERENCES profiles(id),
  intro text,
  qq text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  roles text[] DEFAULT '{}'::text[]
);
```

**数据统计**: 1 条记录

#### team_invites (团队邀请表)
团队邀请用户加入的记录。

```sql
CREATE TABLE team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id),
  user_id uuid REFERENCES profiles(id),
  invited_by uuid REFERENCES profiles(id),
  message text,
  status text DEFAULT 'pending'::text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**数据统计**: 0 条记录

### 4. 作品提交表

#### submissions (作品提交表)
团队作品提交和管理。

```sql
CREATE TABLE submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id),
  team_id uuid REFERENCES teams(id),
  submitted_by uuid REFERENCES profiles(id),
  project_name text NOT NULL,
  intro text NOT NULL,
  cover_path text NOT NULL,
  video_link text,
  link_mode submission_link_mode,
  submission_url text,
  submission_storage_path text,
  submission_password text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**枚举类型**:
- `submission_link_mode`: link, file

**字段说明**:
- `link_mode`: 提交方式（链接或文件）
- `cover_path`: 作品封面路径
- `submission_storage_path`: 文件存储路径

**数据统计**: 1001 条记录

## 数据库函数

### 用户相关函数

#### get_username_by_id(user_uuid)
根据用户ID获取用户名，带安全检查。

#### is_event_judge(event_uuid, user_uuid)
检查用户是否为指定活动的评委。

### 活动相关函数

#### get_event_registration_count(event_uuid)
获取活动的报名人数统计。

#### get_event_judges_with_stats(event_uuid)
获取活动评委列表及统计信息。

#### get_event_judges_simple(event_uuid)
获取活动评委的简单列表。

### 团队相关触发器

#### auto_close_team_on_max_size()
当团队达到最大人数时自动关闭招募。

#### check_team_size_on_event_update()
活动最大团队人数更新时检查现有团队。

## 枚举类型定义

```sql
-- 用户角色
CREATE TYPE user_role AS ENUM ('programmer', 'planner', 'artist', 'audio');

-- 活动状态
CREATE TYPE event_status AS ENUM ('draft', 'published', 'ended');

-- 报名状态
CREATE TYPE registration_status AS ENUM ('registered');

-- 加入申请状态
CREATE TYPE join_request_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- 作品提交方式
CREATE TYPE submission_link_mode AS ENUM ('link', 'file');
```

## 已安装扩展

### 核心扩展
- **pgcrypto**: 加密函数支持
- **uuid-ossp**: UUID生成
- **pg_stat_statements**: SQL统计
- **supabase_vault**: Supabase保险库
- **pg_graphql**: GraphQL支持
- **pg_cron**: 定时任务调度

### 可用扩展
- **postgis**: 地理信息系统支持
- **vector**: 向量数据类型
- **pg_net**: 异步HTTP请求
- **pgjwt**: JWT令牌处理
- **pg_trgm**: 文本相似度搜索

## 数据库迁移历史

### 最新迁移记录
1. `20260103102410_drop_and_recreate_is_event_judge` - 重建评委检查函数
2. `20260103102349_get_event_judges_simple` - 简单评委列表函数
3. `20260103102339_get_event_judges_with_stats` - 评委统计函数
4. `20260102035315_add_event_registration_count_function` - 报名统计函数
5. `20251230114116_fix_username_function_security` - 用户名函数安全修复

### 关键功能迁移
- **团队自动关闭**: `add_is_closed_to_teams`, `add_team_auto_close_triggers`
- **评委系统**: `create_judge_invitation_system_fixed` 系列
- **安全加固**: `fix_username_function_security`, `fix_view_security`

## 行级安全策略 (RLS)

所有表都启用了 RLS 策略，确保数据访问的安全性：

### 安全原则
1. **用户数据隔离**: 用户只能访问自己的数据
2. **活动权限控制**: 活动创建者拥有管理权限
3. **团队成员权限**: 团队成员可以查看团队信息
4. **公开数据访问**: 已发布的活动信息对所有用户可见

### 关键约束
- 用户名长度: 1-10个字符
- 团队名称长度: 2-30个字符
- 团队招募需求: 最多6个
- 表单响应: JSON格式存储

## 性能优化建议

### 索引策略
1. **外键索引**: 所有外键字段都应有索引
2. **查询优化**: 常用查询字段建立复合索引
3. **时间字段**: created_at, updated_at 字段索引

### 缓存策略
根据项目的缓存管理规范：
- **结构化数据**: 30秒缓存时间
- **图片资源**: 不缓存，添加时间戳
- **静态配置**: 长期缓存

### 查询优化
1. 使用 `select` 指定字段，避免 `select *`
2. 合理使用 `limit` 和 `offset` 进行分页
3. 复杂查询考虑使用数据库函数

## 数据一致性保证

### 外键约束
- 所有关联关系都有外键约束
- 级联删除策略确保数据一致性
- 孤儿数据自动清理

### 触发器机制
- 团队人数自动管理
- 时间戳自动更新
- 状态变更自动处理

## 备份和恢复

### 自动备份
- Supabase 提供自动备份功能
- 支持时间点恢复
- 跨区域备份保护

### 数据迁移
- 使用 Supabase CLI 进行本地同步
- 支持分支开发和合并
- 版本控制集成

## 监控和维护

### 性能监控
- 使用 `pg_stat_statements` 监控慢查询
- 定期检查索引使用情况
- 监控连接数和资源使用

### 安全审计
- 定期检查 RLS 策略
- 监控异常访问模式
- 更新安全配置

## 开发最佳实践

### 数据访问
1. 使用 Supabase 客户端库
2. 遵循 RLS 策略设计
3. 合理使用实时订阅

### 架构设计
1. 保持表结构简洁
2. 合理使用 JSON 字段
3. 避免过度规范化

### 测试策略
1. 单元测试覆盖数据库函数
2. 集成测试验证 RLS 策略
3. 性能测试确保查询效率

这个数据库结构支持完整的活动管理平台功能，从用户注册到活动创建、团队组建、作品提交的全流程管理，同时保证了数据安全性和系统性能。