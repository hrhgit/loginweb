-- 创建获取活动报名总人数的函数
CREATE OR REPLACE FUNCTION get_event_registration_count(event_uuid uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::integer
  FROM registrations
  WHERE event_id = event_uuid
    AND status = 'registered';
$$;

-- 为 events 表添加虚拟列（通过视图实现）
CREATE OR REPLACE VIEW events_with_registration_count AS
SELECT 
  e.*,
  get_event_registration_count(e.id) as registration_count
FROM events e;

-- 创建一个更高效的函数，用于批量获取多个活动的报名人数
CREATE OR REPLACE FUNCTION get_events_with_registration_counts()
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  title text,
  description text,
  start_time timestamptz,
  end_time timestamptz,
  location text,
  status event_status,
  created_by uuid,
  team_max_size integer,
  submission_start_time timestamptz,
  submission_end_time timestamptz,
  registration_start_time timestamptz,
  registration_end_time timestamptz,
  template_type text,
  page_config jsonb,
  registration_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    e.*,
    COALESCE(r.registration_count, 0) as registration_count
  FROM events e
  LEFT JOIN (
    SELECT 
      event_id,
      COUNT(*) as registration_count
    FROM registrations
    WHERE status = 'registered'
    GROUP BY event_id
  ) r ON e.id = r.event_id;
$$;

-- 为函数添加注释
COMMENT ON FUNCTION get_event_registration_count(uuid) IS '获取指定活动的报名总人数';
COMMENT ON VIEW events_with_registration_count IS '包含报名人数的活动视图';
COMMENT ON FUNCTION get_events_with_registration_counts() IS '批量获取所有活动及其报名人数，性能更优';;
