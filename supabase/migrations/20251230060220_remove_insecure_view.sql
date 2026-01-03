-- 删除不安全的视图
DROP VIEW IF EXISTS public.event_judges_with_profiles;

-- 创建安全的函数来替代视图
CREATE OR REPLACE FUNCTION public.get_event_judges_with_profiles(p_event_id UUID)
RETURNS TABLE (
    id UUID,
    event_id UUID,
    user_id UUID,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    username TEXT,
    avatar_url TEXT,
    roles user_role[]
) AS $$
BEGIN
    -- 检查权限：只有活动创建者或评委本人可以查看
    IF NOT (
        auth.uid() IN (
            SELECT created_by 
            FROM public.events 
            WHERE events.id = p_event_id
        )
        OR
        auth.uid() IN (
            SELECT ej.user_id 
            FROM public.event_judges ej 
            WHERE ej.event_id = p_event_id
        )
    ) THEN
        RETURN;
    END IF;

    -- 返回结果
    RETURN QUERY
    SELECT 
        ej.id,
        ej.event_id,
        ej.user_id,
        ej.created_at,
        ej.updated_at,
        p.username,
        p.avatar_url,
        p.roles
    FROM public.event_judges ej
    JOIN public.profiles p ON ej.user_id = p.id
    WHERE ej.event_id = p_event_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION public.get_event_judges_with_profiles(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_event_judges_with_profiles(UUID) IS '安全获取活动评委列表及用户信息，包含权限检查';;
