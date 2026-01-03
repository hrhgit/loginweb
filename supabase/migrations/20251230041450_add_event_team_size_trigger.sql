-- 处理活动人数限制变更的触发器函数
CREATE OR REPLACE FUNCTION public.update_all_teams_closed_status_for_event()
RETURNS trigger AS $$
DECLARE
  team_record RECORD;
BEGIN
  -- 只在 team_max_size 发生变化时才处理
  IF OLD.team_max_size IS DISTINCT FROM NEW.team_max_size THEN
    -- 遍历该活动的所有队伍
    FOR team_record IN 
      SELECT t.id, 
             COUNT(tm.user_id) as member_count
      FROM public.teams t
      LEFT JOIN public.team_members tm ON tm.team_id = t.id
      WHERE t.event_id = NEW.id
      GROUP BY t.id
    LOOP
      -- 根据新的人数限制更新队伍状态
      IF NEW.team_max_size IS NULL OR NEW.team_max_size = 0 THEN
        -- 无限制，所有队伍都开放
        UPDATE public.teams 
        SET is_closed = false, updated_at = now() 
        WHERE id = team_record.id AND is_closed = true;
      ELSIF team_record.member_count >= NEW.team_max_size THEN
        -- 人数达到新限制，关闭队伍
        UPDATE public.teams 
        SET is_closed = true, updated_at = now() 
        WHERE id = team_record.id AND is_closed = false;
      ELSE
        -- 人数未满新限制，开放队伍
        UPDATE public.teams 
        SET is_closed = false, updated_at = now() 
        WHERE id = team_record.id AND is_closed = true;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- 创建触发器：活动人数限制变更时更新所有队伍状态
DROP TRIGGER IF EXISTS event_team_size_change_trigger ON public.events;
CREATE TRIGGER event_team_size_change_trigger
  AFTER UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_all_teams_closed_status_for_event();;
