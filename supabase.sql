-- ============================================================
-- 1. 基础环境设置 (扩展与枚举)
-- ============================================================
create extension if not exists pgcrypto;

do $$
begin
  -- 创建活动状态枚举
  if not exists (select 1 from pg_type where typname = 'event_status') then
    create type event_status as enum ('draft', 'published', 'ended');
  end if;

  -- 创建报名状态枚举
  if not exists (select 1 from pg_type where typname = 'registration_status') then
    create type registration_status as enum ('pending', 'confirmed', 'cancelled');
  end if;

  -- 创建提交方式枚举
  if not exists (select 1 from pg_type where typname = 'submission_link_mode') then
    create type public.submission_link_mode as enum ('link', 'file');
  end if;
end $$;

-- ============================================================
-- 1.1 Storage (Avatars)
-- ============================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "头像公开读取" on storage.objects;
drop policy if exists "头像仅自己上传" on storage.objects;
drop policy if exists "头像仅自己更新" on storage.objects;
drop policy if exists "头像仅自己删除" on storage.objects;

create policy "头像公开读取"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "头像仅自己上传"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "头像仅自己更新"
on storage.objects for update
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "头像仅自己删除"
on storage.objects for delete
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- 2. 表结构定义与更新 (Tables)
-- ============================================================

-- 2.1 用户资料表 Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  avatar_url text,
  roles text[] not null default '{}'::text[],
  is_admin boolean not null default false
);

-- 清理：隐私字段不放在 profiles 中（避免公开读策略泄露）
alter table public.profiles drop column if exists phone;
alter table public.profiles drop column if exists qq;
-- 兼容旧表：roles 可能是 user_role[]（枚举数组）或 text[]，统一补齐默认值/空值
do $$
declare
  roles_udt text;
begin
  select udt_name
    into roles_udt
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and column_name = 'roles';

  if roles_udt is null then
    alter table public.profiles add column roles text[] not null default '{}'::text[];
  elsif roles_udt = '_user_role' then
    alter table public.profiles alter column roles set default '{}'::user_role[];
    update public.profiles set roles = '{}'::user_role[] where roles is null;
  else
    alter table public.profiles alter column roles set default '{}'::text[];
    update public.profiles set roles = '{}'::text[] where roles is null;
  end if;
end $$;

-- 2.1.1 私密信息表 User Contacts（phone/qq）
create table if not exists public.user_contacts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  phone text,
  qq text,
  updated_at timestamptz default now()
);

-- 老用户补丁：确保都有一行占位
insert into public.user_contacts (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

-- 2.2 活动表 Events
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles(id), -- 自动填入当前用户
  
  title text not null,
  description text default '{"summary": "", "details": {"registrationForm": []}}', -- 默认 JSON 结构
  start_time timestamptz,
  end_time timestamptz,
  registration_start_time timestamptz,
  registration_end_time timestamptz,
  submission_start_time timestamptz,
  submission_end_time timestamptz,
  location text,
  team_max_size int default 0,
  
  status event_status not null default 'draft', -- 默认为草稿
  
  -- [新增需求整合] CMS 模板字段
  template_type text default 'default',
  page_config jsonb default '{}'::jsonb
);

-- 补丁：确保现有表也有新字段 (如果表已存在)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'events'
      and column_name = 'max_participants'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'events'
      and column_name = 'team_max_size'
  ) then
    execute 'alter table public.events rename column max_participants to team_max_size';
  end if;
end $$;

alter table public.events add column if not exists team_max_size int;
alter table public.events add column if not exists registration_start_time timestamptz;
alter table public.events add column if not exists registration_end_time timestamptz;
alter table public.events add column if not exists submission_start_time timestamptz;
alter table public.events add column if not exists submission_end_time timestamptz;
alter table public.events drop column if exists is_submission_enabled;
alter table public.events add column if not exists template_type text default 'default';
alter table public.events add column if not exists page_config jsonb default '{}'::jsonb;
alter table public.events alter column team_max_size set default 0;
update public.events set team_max_size = 0 where team_max_size is null;

-- 补丁：确保默认值正确 (强制应用)
alter table public.events alter column created_by set default auth.uid();
alter table public.events alter column status set default 'draft';

-- 2.3 队伍表 Teams
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  name text not null,
  event_id uuid not null references public.events(id) on delete cascade,
  leader_id uuid not null default auth.uid() references public.profiles(id), -- 默认当前用户为队长
  intro text,
  extra text,
  leader_qq text,
  needs text[] default '{}'::text[],
  is_closed boolean not null default false,
  constraint needs_array_length_check check (array_length(needs, 1) <= 6)
);
alter table public.teams add column if not exists updated_at timestamptz default now();
alter table public.teams add column if not exists intro text;
alter table public.teams add column if not exists extra text;
alter table public.teams add column if not exists leader_qq text;
alter table public.teams add column if not exists needs text[] default '{}'::text[];
alter table public.teams add column if not exists is_closed boolean not null default false;

-- 2.3.1 入队申请 Team Join Requests
create table if not exists public.team_join_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status join_request_status not null default 'pending',
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now(),
  unique (team_id, user_id)
);

create index if not exists idx_team_join_requests_team on public.team_join_requests(team_id);
create index if not exists idx_team_join_requests_user on public.team_join_requests(user_id);

-- 2.3.2 兼容旧数据：如果队伍人数已满则标记为已完成
do $$
declare
  rec record;
  member_count int;
  max_size int;
begin
  for rec in
    select t.id, t.event_id
    from public.teams t
  loop
    select team_max_size into max_size from public.events where id = rec.event_id;
    if max_size is null or max_size = 0 then
      continue;
    end if;
    select count(*) into member_count from public.team_members where team_id = rec.id;
    if member_count >= max_size then
      update public.teams set is_closed = true, updated_at = now() where id = rec.id;
    end if;
  end loop;
end $$;

-- 2.4 报名表 Registrations
create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  
  form_response jsonb default '{}'::jsonb,
  status registration_status not null default 'confirmed' -- 默认为已确认(根据之前对话修正)
);

-- 补丁：确保字段存在
alter table public.registrations add column if not exists form_response jsonb default '{}'::jsonb;

-- 唯一约束：防止重复报名（避免重复索引）
do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'registrations'
      and constraint_type = 'UNIQUE'
      and constraint_name = 'registrations_user_id_event_id_key'
  ) then
    alter table public.registrations
      add constraint registrations_user_id_event_id_key unique (user_id, event_id);
  end if;
end $$;

drop index if exists registrations_unique;

-- 2.5 作品提交 Submissions
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  -- 注意：这里改为 restrict，意味着必须先删提交才能删队伍
  team_id uuid not null references public.teams(id) on delete restrict,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  project_name text not null,
  intro text not null,
  cover_path text not null,
  video_link text,
  link_mode public.submission_link_mode not null,
  submission_url text,
  submission_storage_path text,
  submission_password text, -- 已确认非敏感数据
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 约束：一个队伍在一个活动中只能提交一次
  constraint submissions_team_event_unique unique (event_id, team_id),

  -- 约束：确保 link 和 file 模式下的字段填写逻辑正确
  constraint submissions_link_mode_check check (
    (link_mode = 'link' and submission_url is not null and submission_storage_path is null)
    or (link_mode = 'file' and submission_storage_path is not null)
  )
);

create index if not exists submissions_event_id_idx on public.submissions (event_id);
create index if not exists submissions_team_id_idx on public.submissions (team_id);
create index if not exists submissions_submitted_by_idx on public.submissions (submitted_by);

-- ============================================================
-- 3. 安全策略 (RLS Policy) - 先清理，后重建
-- ============================================================

-- 开启 RLS
alter table public.profiles enable row level security;
alter table public.user_contacts enable row level security;
alter table public.events enable row level security;
alter table public.registrations enable row level security;
alter table public.teams enable row level security;
alter table public.submissions enable row level security;

-- ------------------------------------------------------------
-- 3.0 Profiles 表策略
-- ------------------------------------------------------------

drop policy if exists "查看个人资料" on public.profiles;
drop policy if exists "更新个人资料" on public.profiles;
drop policy if exists "个人资料公开读取" on public.profiles;
drop policy if exists "个人资料仅自己修改" on public.profiles;

-- 公开名片：允许所有登录用户读取（用于队伍列表、活动页面显示头像昵称）
create policy "个人资料公开读取"
on public.profiles for select
to authenticated
using (true);

-- 仅允许修改自己的资料
create policy "个人资料仅自己修改"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

grant select, update on public.profiles to authenticated;

-- ------------------------------------------------------------
-- 3.0.1 User Contacts 表策略 (私密信息：phone/qq)
-- ------------------------------------------------------------

drop policy if exists "私密信息仅自己读取" on public.user_contacts;
drop policy if exists "私密信息仅自己插入" on public.user_contacts;
drop policy if exists "私密信息仅自己更新" on public.user_contacts;

-- 只有自己能查
create policy "私密信息仅自己读取"
on public.user_contacts for select
to authenticated
using (user_id = (select auth.uid()));

-- 只有自己能写（用于首次 upsert）
create policy "私密信息仅自己插入"
on public.user_contacts for insert
to authenticated
with check (user_id = (select auth.uid()));

-- 只有自己能改
create policy "私密信息仅自己更新"
on public.user_contacts for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

grant select, insert, update on public.user_contacts to authenticated;

-- ------------------------------------------------------------
-- 3.1 Events 表策略 (最复杂的部分)
-- ------------------------------------------------------------

-- 清理旧策略 (包含所有可能出现的旧名字)
drop policy if exists events_select_public on public.events;
drop policy if exists "所有人可见活动" on public.events;
drop policy if exists "活动查看规则_分级" on public.events;
drop policy if exists "管理员发布活动" on public.events;
drop policy if exists "管理员编辑活动" on public.events;
drop policy if exists "管理员删除活动" on public.events;
-- 清理旧英文策略（再次保证干净）
drop policy if exists "Events Public View" on public.events;
drop policy if exists "Events Insert Admin" on public.events;
drop policy if exists "Events Update Admin" on public.events;
drop policy if exists "Events Delete Admin" on public.events;

-- 策略：查看 (分级可见：所有人看已发布，作者看自己的草稿)
create policy "所有人可见活动"
on public.events for select
to anon, authenticated
using (
  status in ('published', 'ended') 
  OR 
  ((select auth.uid()) = created_by)
);

-- 策略：发布 (必须是管理员，且必须署名为自己)
create policy "管理员发布活动"
on public.events for insert
to authenticated
with check (
  ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  and created_by = (select auth.uid())
);

-- 策略：编辑 (必须是管理员，只能改自己的，且内容锁定由触发器负责)
create policy "管理员编辑活动"
on public.events for update
to authenticated
using (
  ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  and created_by = (select auth.uid())
)
with check (
  ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  and created_by = (select auth.uid())
);

-- 策略：删除 (必须是管理员，只能删自己的，且禁止删已发布)
create policy "管理员删除活动"
on public.events for delete
to authenticated
using (
  ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  and created_by = (select auth.uid())
  and status != 'published' -- [新增需求] 只有非发布状态才能删
);

-- 授权
grant select on public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated;

-- ------------------------------------------------------------
-- 3.2 Registrations 表策略
-- ------------------------------------------------------------
drop policy if exists "查看报名(个人或管理员)" on public.registrations;
drop policy if exists "用户提交报名" on public.registrations;
drop policy if exists "取消报名(个人或管理员)" on public.registrations;
drop policy if exists "更新报名(个人)" on public.registrations;

-- 查看
create policy "查看报名(个人或管理员)"
on public.registrations for select
to authenticated
using (
  user_id = (select auth.uid())
  or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
);

-- 报名 (只能给自己报)
create policy "用户提交报名"
on public.registrations for insert
to authenticated
with check (user_id = (select auth.uid()));

-- 取消/删除
create policy "取消报名(个人或管理员)"
on public.registrations for delete
to authenticated
using (
  user_id = (select auth.uid())
  or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
);

-- 更新（个人可改自己报名表单）
create policy "更新报名(个人)"
on public.registrations for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.registrations to authenticated;

-- ------------------------------------------------------------
-- 3.2.1 Team Join Requests 表策略
-- ------------------------------------------------------------
drop policy if exists "入队申请查看" on public.team_join_requests;
drop policy if exists "入队申请提交" on public.team_join_requests;
drop policy if exists "入队申请处理" on public.team_join_requests;
drop policy if exists "入队申请删除" on public.team_join_requests;

-- 查看：本人或队长可看
create policy "入队申请查看"
on public.team_join_requests for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.teams
    where id = team_join_requests.team_id
      and leader_id = (select auth.uid())
  )
);

-- 提交：只能为自己提交
create policy "入队申请提交"
on public.team_join_requests for insert
to authenticated
with check (user_id = (select auth.uid()));

-- 更新：仅队长可处理
create policy "入队申请处理"
on public.team_join_requests for update
to authenticated
using (
  exists (
    select 1
    from public.teams
    where id = team_join_requests.team_id
      and leader_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.teams
    where id = team_join_requests.team_id
      and leader_id = (select auth.uid())
  )
);

-- 删除：申请人可取消
create policy "入队申请删除"
on public.team_join_requests for delete
to authenticated
using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.team_join_requests to authenticated;

-- ------------------------------------------------------------
-- 3.3 Teams 表策略
-- ------------------------------------------------------------
drop policy if exists "查看队伍列表" on public.teams;
drop policy if exists "创建队伍" on public.teams;
drop policy if exists "Teams Insert Published Only" on public.teams;
drop policy if exists "Teams Update Leader" on public.teams;
drop policy if exists "Teams Delete Leader" on public.teams;
drop policy if exists "创建队伍(已发布活动)" on public.teams;
drop policy if exists "更新队伍(队长)" on public.teams;
drop policy if exists "删除队伍(队长)" on public.teams;

-- 查看
create policy "查看队伍列表" on public.teams for select using (true);

-- 创建 (仅限活动已发布且队长为本人)
create policy "创建队伍(已发布活动)"
on public.teams for insert
to authenticated
with check (
  leader_id = (select auth.uid())
  and exists (
    select 1
    from public.events
    where id = teams.event_id
      and status = 'published'
  )
);

-- 更新 (仅队长可改)
create policy "更新队伍(队长)"
on public.teams for update
to authenticated
using (leader_id = (select auth.uid()))
with check (leader_id = (select auth.uid()));

-- 删除 (仅队长可删)
create policy "删除队伍(队长)"
on public.teams for delete
to authenticated
using (leader_id = (select auth.uid()));

grant select, insert, update, delete on public.teams to authenticated;

-- ------------------------------------------------------------
-- 3.4 Submissions 表策略
-- ------------------------------------------------------------
drop policy if exists "Submissions Public View" on public.submissions;
drop policy if exists "Submissions Insert Leader" on public.submissions;
drop policy if exists "Submissions Update Leader" on public.submissions;
drop policy if exists "Submissions Delete Leader" on public.submissions;
drop policy if exists "允许任何人查看提交" on public.submissions;
drop policy if exists "仅允许队长新建提交" on public.submissions;
drop policy if exists "仅允许队长更新提交" on public.submissions;
drop policy if exists "仅允许队长删除提交" on public.submissions;

-- 【查询策略】：允许任何人（包括未登录用户）查看提交
create policy "允许任何人查看提交"
on public.submissions for select
using ( true );

-- 【插入策略】：仅允许队长提交，且必须对应正确的活动
create policy "仅允许队长新建提交"
on public.submissions for insert
with check (
  submitted_by = auth.uid()
  and exists (
    select 1 from public.teams t
    where t.id = submissions.team_id
      and t.leader_id = auth.uid()
      and t.event_id = submissions.event_id
  )
);

-- 【更新策略】：仅允许队长修改自己队伍的提交
create policy "仅允许队长更新提交"
on public.submissions for update
using (
  exists (
    select 1 from public.teams t
    where t.id = submissions.team_id
      and t.leader_id = auth.uid()
  )
)
with check (
  submitted_by = auth.uid()
  and exists (
    select 1 from public.teams t
    where t.id = submissions.team_id
      and t.leader_id = auth.uid()
      and t.event_id = submissions.event_id
  )
);

-- 【删除策略】：仅允许队长删除自己队伍的提交
create policy "仅允许队长删除提交"
on public.submissions for delete
using (
  exists (
    select 1 from public.teams t
    where t.id = submissions.team_id
      and t.leader_id = auth.uid()
  )
);

grant select on public.submissions to anon, authenticated;
grant insert, update, delete on public.submissions to authenticated;


-- ============================================================
-- 4. 触发器与自动化逻辑 (Triggers)
-- ============================================================
-- 队伍满员自动标记完成
create or replace function public.lock_team_if_full()
returns trigger
language plpgsql
as $$
declare
  max_size int;
  member_count int;
begin
  select e.team_max_size
    into max_size
  from public.teams t
  join public.events e on e.id = t.event_id
  where t.id = new.team_id;

  if max_size is null or max_size = 0 then
    return new;
  end if;

  select count(*) into member_count from public.team_members where team_id = new.team_id;

  if member_count >= max_size then
    update public.teams set is_closed = true, updated_at = now() where id = new.team_id;
  end if;
  return new;
end;
$$;

drop trigger if exists lock_team_if_full_trigger on public.team_members;
create trigger lock_team_if_full_trigger
  after insert on public.team_members
  for each row
  execute procedure public.lock_team_if_full();

-- 自动更新时间触发器
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists handle_updated_at on public.submissions;
create trigger handle_updated_at
  before update on public.submissions
  for each row
  execute procedure public.handle_updated_at();

-- ------------------------------------------------------------
-- 4.1 用户注册自动同步 (Auth -> Profiles)
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;

  insert into public.user_contacts (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 8. 求组队卡片 (Team Seekers)
-- ============================================================

create table if not exists public.team_seekers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  intro text,
  qq text,
  roles text[] default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz default now(),
  unique (event_id, user_id)
);

create index if not exists idx_team_seekers_event_id on public.team_seekers(event_id);

alter table public.team_seekers enable row level security;

-- 兼容旧表：补充/迁移职能字段为数组
alter table public.team_seekers add column if not exists roles text[] default '{}'::text[];
do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'team_seekers' and column_name = 'role') then
    update public.team_seekers
      set roles = array_remove(array[role], null)
      where (roles is null or array_length(roles, 1) = 0) and role is not null;
    alter table public.team_seekers drop column role;
  end if;
end $$;

-- 先清理旧英文策略
drop policy if exists "Team Seekers Public View" on public.team_seekers;
drop policy if exists "Team Seekers Insert Own" on public.team_seekers;
drop policy if exists "Team Seekers Update Own" on public.team_seekers;
drop policy if exists "Team Seekers Delete Own" on public.team_seekers;

drop policy if exists "求组队公开读取" on public.team_seekers;
create policy "求组队公开读取"
on public.team_seekers
for select
to anon, authenticated
using (true);

drop policy if exists "求组队发布" on public.team_seekers;
create policy "求组队发布"
on public.team_seekers
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.registrations
    where event_id = team_seekers.event_id
      and user_id = (select auth.uid())
  )
);

drop policy if exists "求组队更新" on public.team_seekers;
create policy "求组队更新"
on public.team_seekers
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "求组队删除" on public.team_seekers;
create policy "求组队删除"
on public.team_seekers
for delete
to authenticated
using (user_id = (select auth.uid()));

grant select on public.team_seekers to anon, authenticated;
grant insert, update, delete on public.team_seekers to authenticated;

-- ============================================================
-- 9. 队伍邀请 (Team Invites)
-- ============================================================
create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid references public.profiles(id) on delete set null,
  message text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz default now(),
  unique (team_id, user_id)
);

create index if not exists idx_team_invites_user on public.team_invites(user_id);
create index if not exists idx_team_invites_team on public.team_invites(team_id);

alter table public.team_invites enable row level security;

-- 清理旧英文策略
drop policy if exists "Team Invites Select Own" on public.team_invites;
drop policy if exists "Team Invites Insert Leader" on public.team_invites;
drop policy if exists "Team Invites Update Invitee" on public.team_invites;
drop policy if exists "Team Invites Delete Invitee" on public.team_invites;
drop policy if exists "Team Invites Delete Leader" on public.team_invites;
drop policy if exists "Team Invites Delete" on public.team_invites;
drop policy if exists "队伍邀请查看" on public.team_invites;
create policy "队伍邀请查看"
on public.team_invites
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.teams
    where id = team_invites.team_id
      and leader_id = (select auth.uid())
  )
);

drop policy if exists "队伍邀请创建" on public.team_invites;
create policy "队伍邀请创建"
on public.team_invites
for insert
to authenticated
with check (
  invited_by = (select auth.uid())
  and user_id <> (select auth.uid())
  and exists (
    select 1
    from public.teams
    where id = team_invites.team_id
      and leader_id = (select auth.uid())
  )
);

drop policy if exists "队伍邀请更新" on public.team_invites;
create policy "队伍邀请更新"
on public.team_invites
for update
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.teams
    where id = team_invites.team_id
      and leader_id = (select auth.uid())
  )
)
with check (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.teams
    where id = team_invites.team_id
      and leader_id = (select auth.uid())
  )
);

drop policy if exists "队伍邀请删除" on public.team_invites;
create policy "队伍邀请删除"
on public.team_invites
for delete
to authenticated
using (
  user_id = (select auth.uid())
  or (
    invited_by = (select auth.uid())
    and exists (
      select 1
      from public.teams
      where id = team_invites.team_id
        and leader_id = (select auth.uid())
    )
  )
);

grant select, insert, update, delete on public.team_invites to authenticated;

-- ============================================================
-- 9.1 队伍成员 (Team Members)
-- ============================================================
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create index if not exists idx_team_members_team on public.team_members(team_id);
create index if not exists idx_team_members_user on public.team_members(user_id);

alter table public.team_members enable row level security;

drop policy if exists "Members Public View" on public.team_members;
drop policy if exists "Members Manage" on public.team_members;
drop policy if exists "队伍成员查看" on public.team_members;
create policy "队伍成员查看"
on public.team_members
for select
to anon, authenticated
using (true);

drop policy if exists "队伍成员加入" on public.team_members;
create policy "队伍成员加入"
on public.team_members
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (
    exists (
      select 1
      from public.team_invites
      where team_id = team_members.team_id
        and user_id = (select auth.uid())
        and status = 'pending'
    )
    or exists (
      select 1
      from public.team_join_requests
      where team_id = team_members.team_id
        and user_id = (select auth.uid())
        and status = 'approved'
    )
  )
);

drop policy if exists "队伍成员删除" on public.team_members;
create policy "队伍成员删除"
on public.team_members
for delete
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.teams
    where id = team_members.team_id
      and leader_id = (select auth.uid())
  )
);

grant select, insert, delete on public.team_members to anon, authenticated;

-- ------------------------------------------------------------
-- 4.2 [已取消] 发布活动内容锁定
--     允许已发布活动继续编辑，因此移除相关触发器
-- ------------------------------------------------------------
drop trigger if exists check_event_immutable_trigger on public.events;
drop function if exists public.check_event_immutable();

-- ------------------------------------------------------------
-- 4.3 报名/提交窗口（虚拟列）与报名校验
-- ------------------------------------------------------------

-- (可选) 索引：便于按状态与截止时间筛选
drop index if exists idx_events_times;
create index if not exists idx_events_times
on public.events (status, registration_end_time, submission_end_time);

-- 虚拟列 A：是否可报名 (is_registration_open)
create or replace function public.is_registration_open(event_row public.events)
returns boolean as $$
begin
  return (
    event_row.status = 'published'
    and now() >= coalesce(event_row.registration_start_time, '-infinity'::timestamptz)
    and now() <= coalesce(event_row.registration_end_time, event_row.end_time, 'infinity'::timestamptz)
  );
end;
$$ language plpgsql stable;

-- 虚拟列 B：是否可提交 (is_submission_open)
create or replace function public.is_submission_open(event_row public.events)
returns boolean as $$
begin
  return (
    event_row.status = 'published'
    and now() >= coalesce(event_row.submission_start_time, '-infinity'::timestamptz)
    and now() <= coalesce(event_row.submission_end_time, event_row.end_time, 'infinity'::timestamptz)
  );
end;
$$ language plpgsql stable;

-- 允许 API 角色读取虚拟列（否则 select 时会报 permission denied for function）
grant execute on function public.is_registration_open(public.events) to anon, authenticated;
grant execute on function public.is_submission_open(public.events) to anon, authenticated;

-- 触发器：防止过期报名（insert registrations 时校验报名窗口）
create or replace function public.check_registration_open()
returns trigger as $$
declare
  event_record record;
begin
  select status, end_time, registration_start_time, registration_end_time
  into event_record
  from public.events
  where id = new.event_id;

  if event_record.status != 'published' then
    raise exception '无法报名：该活动未发布或已结束';
  end if;

  if event_record.registration_start_time is not null and now() < event_record.registration_start_time then
     raise exception '无法报名：报名尚未开始';
  end if;

  if event_record.registration_end_time is not null and now() > event_record.registration_end_time then
     raise exception '无法报名：报名已截止';
  end if;

  if event_record.registration_end_time is null and event_record.end_time is not null and now() > event_record.end_time then
     raise exception '无法报名：活动已结束';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists check_registration_open_trigger on public.registrations;
do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'check_registration_open_trigger'
      and tgrelid = 'public.registrations'::regclass
  ) then
    create trigger check_registration_open_trigger
      before insert on public.registrations
      for each row
      execute procedure public.check_registration_open();
  end if;
end $$;

-- ==========================================
-- 5. Storage Buckets Setup (存储桶设置)
-- ==========================================

-- A) 创建封面图存储桶 (public-assets)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'public-assets',
  'public-assets',
  true,
  5242880, -- 5MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- B) 创建作品文件存储桶 (submission-files)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submission-files',
  'submission-files',
  true,      -- 公开访问
  52428800,  -- 50MB
  -- 仅限压缩包
  array[
    'application/zip', 
    'application/x-zip-compressed', 
    'application/x-rar-compressed', 
    'application/vnd.rar', 
    'application/x-7z-compressed',
    'application/x-tar',
    'application/gzip'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- ==========================================
-- 6. Storage Policies (存储权限策略)
-- ==========================================

-- [已删除] alter table storage.objects enable row level security; 
-- 原因：Storage 表默认已开启 RLS，手动执行会报权限错误。

-- 先清理旧策略，防止重复创建报错 (可选，但推荐)
drop policy if exists "封面图_所有人可见" on storage.objects;
drop policy if exists "封面图_登录用户上传" on storage.objects;
drop policy if exists "作品文件_所有人下载" on storage.objects;
drop policy if exists "作品文件_登录用户上传" on storage.objects;

-- 策略 A: public-assets (封面图)
create policy "封面图_所有人可见"
on storage.objects for select
using ( bucket_id = 'public-assets' );

create policy "封面图_登录用户上传"
on storage.objects for insert
with check (
  bucket_id = 'public-assets' 
  and auth.role() = 'authenticated'
);

-- 策略 B: submission-files (作品文件)

-- 1. 允许所有人下载 (SELECT)
create policy "作品文件_所有人下载"
on storage.objects for select
using ( bucket_id = 'submission-files' );

-- 2. 仅允许登录用户上传 (INSERT)
create policy "作品文件_登录用户上传"
on storage.objects for insert
with check (
  bucket_id = 'submission-files' 
  and auth.role() = 'authenticated'
);

create policy "封面_允许用户删除自己文件"
on storage.objects for delete
using (
  bucket_id = 'public-assets' 
  and auth.uid() = owner
);

create policy "封面_允许用户修改自己文件"
on storage.objects for update
using (
  bucket_id = 'public-assets' 
  and auth.uid() = owner
);


create policy "作品_允许用户删除自己文件"
on storage.objects for delete
using (
  bucket_id = 'submission-files' 
  and auth.uid() = owner
);

create policy "作品_允许用户修改自己文件"
on storage.objects for update
using (
  bucket_id = 'submission-files' 
  and auth.uid() = owner
);