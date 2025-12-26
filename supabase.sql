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
end $$;

-- ============================================================
-- 1.1 Storage (Avatars)
-- ============================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatar Public View" on storage.objects;
drop policy if exists "Avatar Upload Own" on storage.objects;
drop policy if exists "Avatar Update Own" on storage.objects;
drop policy if exists "Avatar Delete Own" on storage.objects;

create policy "Avatar Public View"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "Avatar Upload Own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Avatar Update Own"
on storage.objects for update
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Avatar Delete Own"
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
alter table public.profiles add column if not exists roles text[] default '{}'::text[];
alter table public.profiles alter column roles set default '{}'::text[];
update public.profiles set roles = '{}'::text[] where roles is null;

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
  name text not null,
  event_id uuid not null references public.events(id) on delete cascade,
  leader_id uuid not null default auth.uid() references public.profiles(id) -- 默认当前用户为队长
);

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

-- 唯一约束：防止重复报名
create unique index if not exists registrations_unique on public.registrations(user_id, event_id);

-- ============================================================
-- 3. 安全策略 (RLS Policy) - 先清理，后重建
-- ============================================================

-- 开启 RLS
alter table public.profiles enable row level security;
alter table public.user_contacts enable row level security;
alter table public.events enable row level security;
alter table public.registrations enable row level security;
alter table public.teams enable row level security;

-- ------------------------------------------------------------
-- 3.0 Profiles 表策略
-- ------------------------------------------------------------

drop policy if exists "查看个人资料" on public.profiles;
drop policy if exists "更新个人资料" on public.profiles;
drop policy if exists "profiles_select_all" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;

-- 公开名片：允许所有登录用户读取（用于队伍列表、活动页面显示头像昵称）
create policy "profiles_select_all"
on public.profiles for select
to authenticated
using (true);

-- 仅允许修改自己的资料
create policy "profiles_update_self"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

grant select, update on public.profiles to authenticated;

-- ------------------------------------------------------------
-- 3.0.1 User Contacts 表策略 (私密信息：phone/qq)
-- ------------------------------------------------------------

drop policy if exists "contacts_select_self" on public.user_contacts;
drop policy if exists "contacts_insert_self" on public.user_contacts;
drop policy if exists "contacts_update_self" on public.user_contacts;

-- 只有自己能查
create policy "contacts_select_self"
on public.user_contacts for select
to authenticated
using (user_id = auth.uid());

-- 只有自己能写（用于首次 upsert）
create policy "contacts_insert_self"
on public.user_contacts for insert
to authenticated
with check (user_id = auth.uid());

-- 只有自己能改
create policy "contacts_update_self"
on public.user_contacts for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

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

-- 策略：查看 (分级可见：所有人看已发布，作者看自己的草稿)
create policy "所有人可见活动"
on public.events for select
to anon, authenticated
using (
  status in ('published', 'ended') 
  OR 
  (auth.uid() = created_by)
);

-- 策略：发布 (必须是管理员，且必须署名为自己)
create policy "管理员发布活动"
on public.events for insert
to authenticated
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and created_by = auth.uid()
);

-- 策略：编辑 (必须是管理员，只能改自己的，且内容锁定由触发器负责)
create policy "管理员编辑活动"
on public.events for update
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and created_by = auth.uid()
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and created_by = auth.uid()
);

-- 策略：删除 (必须是管理员，只能删自己的，且禁止删已发布)
create policy "管理员删除活动"
on public.events for delete
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and created_by = auth.uid()
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
  user_id = auth.uid()
  or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- 报名 (只能给自己报)
create policy "用户提交报名"
on public.registrations for insert
to authenticated
with check (user_id = auth.uid());

-- 取消/删除
create policy "取消报名(个人或管理员)"
on public.registrations for delete
to authenticated
using (
  user_id = auth.uid()
  or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- 更新（个人可改自己报名表单）
create policy "更新报名(个人)"
on public.registrations for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select, insert, update, delete on public.registrations to authenticated;

-- ------------------------------------------------------------
-- 3.3 Teams 表策略
-- ------------------------------------------------------------
drop policy if exists "查看队伍列表" on public.teams;
drop policy if exists "创建队伍" on public.teams;

-- 查看
create policy "查看队伍列表" on public.teams for select using (true);

-- 创建 (允许登录用户创建)
create policy "创建队伍" on public.teams for insert to authenticated with check (true);

grant select, insert, update, delete on public.teams to authenticated;


-- ============================================================
-- 4. 触发器与自动化逻辑 (Triggers)
-- ============================================================

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
create trigger check_registration_open_trigger
  before insert on public.registrations
  for each row
  execute procedure public.check_registration_open();
