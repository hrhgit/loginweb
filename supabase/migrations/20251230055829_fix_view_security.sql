-- 修复视图安全问题
DROP VIEW IF EXISTS public.event_judges_with_profiles;

CREATE VIEW public.event_judges_with_profiles AS
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
JOIN public.profiles p ON ej.user_id = p.id;

-- 授予视图查看权限
GRANT SELECT ON public.event_judges_with_profiles TO authenticated;

COMMENT ON VIEW public.event_judges_with_profiles IS '评委信息视图：包含评委记录和用户基本信息';;
