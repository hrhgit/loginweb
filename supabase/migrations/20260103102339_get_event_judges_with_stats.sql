-- 获取活动评委及其评分统计信息的专用函数
-- 优化性能，减少客户端查询次数

create or replace function public.get_event_judges_with_stats(event_uuid uuid)
returns table (
  judge_id uuid,
  judge_username text,
  judge_avatar_url text,
  judge_roles text[],
  invited_at timestamptz,
  updated_at timestamptz,
  -- 统计信息（为未来扩展预留）
  total_submissions bigint,
  scored_submissions bigint,
  avg_score numeric
)
language plpgsql
security invoker
set search_path = ''
stable
as $$
begin
  return query
  select 
    ej.user_id as judge_id,
    p.username as judge_username,
    p.avatar_url as judge_avatar_url,
    p.roles as judge_roles,
    ej.created_at as invited_at,
    ej.updated_at as updated_at,
    -- 获取该活动的总作品数
    coalesce(total_subs.total_count, 0) as total_submissions,
    -- 评分统计（预留字段，当前返回0）
    0::bigint as scored_submissions,
    0::numeric as avg_score
  from public.event_judges ej
  inner join public.profiles p on ej.user_id = p.id
  left join (
    select count(*) as total_count
    from public.submissions s
    where s.event_id = event_uuid
  ) total_subs on true
  where ej.event_id = event_uuid
  order by ej.created_at desc;
end;
$$;

-- 添加函数注释
comment on function public.get_event_judges_with_stats(uuid) is '获取指定活动的评委列表及统计信息，优化性能避免多次查询';;
