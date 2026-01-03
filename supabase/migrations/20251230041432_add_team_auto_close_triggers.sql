-- 创建队伍自动关闭/开放的触发器函数
CREATE OR REPLACE FUNCTION public.update_team_closed_status()
RETURNS trigger AS $$
DECLARE
  max_size int;
  member_count int;
  target_team_id uuid;
BEGIN
  -- 确定要检查的队伍ID
  IF TG_OP = 'DELETE' THEN
    target_team_id := OLD.team_id;
  ELSE
    target_team_id := NEW.team_id;
  END IF;

  -- 获取活动的队伍人数限制
  SELECT e.team_max_size
    INTO max_size
  FROM public.teams t
  JOIN public.events e ON e.id = t.event_id
  WHERE t.id = target_team_id;

  -- 如果没有限制或限制为0，确保队伍是开放的
  IF max_size IS NULL OR max_size = 0 THEN
    UPDATE public.teams 
    SET is_closed = false, updated_at = now() 
    WHERE id = target_team_id AND is_closed = true;
    
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  -- 计算当前队伍人数
  SELECT count(*) INTO member_count 
  FROM public.team_members 
  WHERE team_id = target_team_id;

  -- 根据人数更新队伍状态
  IF member_count >= max_size THEN
    -- 人数达到上限，关闭队伍
    UPDATE public.teams 
    SET is_closed = true, updated_at = now() 
    WHERE id = target_team_id AND is_closed = false;
  ELSE
    -- 人数未满，开放队伍（如果之前是关闭的）
    UPDATE public.teams 
    SET is_closed = false, updated_at = now() 
    WHERE id = target_team_id AND is_closed = true;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- 删除旧的触发器（如果存在）
DROP TRIGGER IF EXISTS lock_team_if_full_trigger ON public.team_members;
DROP TRIGGER IF EXISTS team_member_change_trigger ON public.team_members;

-- 创建新的触发器：成员加入时检查
CREATE TRIGGER team_member_insert_trigger
  AFTER INSERT ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_team_closed_status();

-- 创建新的触发器：成员离开时检查
CREATE TRIGGER team_member_delete_trigger
  AFTER DELETE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_team_closed_status();;
