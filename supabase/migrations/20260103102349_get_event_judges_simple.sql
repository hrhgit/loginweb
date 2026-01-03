-- 简单快速获取活动评委列表
-- 不包含复杂统计，性能最优

create or replace function public.get_event_judges_simple(event_uuid uuid)
returns table (
  judge_id uuid,
  judge_username text,
  judge_avatar_url text,
  judge_roles text[],
  invited_at timestamptz
)
language sql
security invoker
set search_path = ''
stable
as $$
  select 
    ej.user_id as judge_id,
    p.username as judge_username,
    p.avatar_url as judge_avatar_url,
    p.roles as judge_roles,
    ej.created_at as invited_at
  from public.event_judges ej
  inner join public.profiles p on ej.user_id = p.id
  where ej.event_id = event_uuid
  order by ej.created_at desc;
$$;

-- 添加函数注释
comment on function public.get_event_judges_simple(uuid) is '快速获取指定活动的评委列表，不包含统计信息，性能最优';;
