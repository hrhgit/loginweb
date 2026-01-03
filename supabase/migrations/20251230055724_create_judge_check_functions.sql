-- 创建评委权限检查函数
CREATE OR REPLACE FUNCTION public.is_event_judge(p_event_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.event_judges 
        WHERE event_id = p_event_id 
        AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 创建活动管理员检查函数
CREATE OR REPLACE FUNCTION public.is_event_admin(p_event_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.events 
        WHERE id = p_event_id 
        AND created_by = p_user_id
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;;
