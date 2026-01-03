-- 删除现有函数并重新创建
drop function if exists public.is_event_judge(uuid, uuid);

-- 检查用户是否为指定活动的评委
-- 用于权限检查和界面显示

create or replace function public.is_event_judge(event_uuid uuid, user_uuid uuid default auth.uid())
returns boolean
language sql
security invoker
set search_path = ''
stable
as $$
  select exists(
    select 1 
    from public.event_judges ej
    where ej.event_id = event_uuid 
      and ej.user_id = user_uuid
  );
$$;

-- 添加函数注释
comment on function public.is_event_judge(uuid, uuid) is '检查指定用户是否为指定活动的评委，默认检查当前登录用户';;
