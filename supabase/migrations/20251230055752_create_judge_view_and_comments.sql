-- 创建评委数据视图（包含用户信息）
CREATE OR REPLACE VIEW public.event_judges_with_profiles AS
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

-- 添加注释说明
COMMENT ON TABLE public.event_judges IS '活动评委表：存储活动与评委用户的关联关系';
COMMENT ON COLUMN public.event_judges.event_id IS '活动ID，外键关联events表';
COMMENT ON COLUMN public.event_judges.user_id IS '评委用户ID，外键关联profiles表';
COMMENT ON COLUMN public.event_judges.created_at IS '邀请时间';
COMMENT ON COLUMN public.event_judges.updated_at IS '最后更新时间';

COMMENT ON FUNCTION public.is_event_judge(UUID, UUID) IS '检查指定用户是否为指定活动的评委';
COMMENT ON FUNCTION public.is_event_admin(UUID, UUID) IS '检查指定用户是否为指定活动的管理员';

COMMENT ON VIEW public.event_judges_with_profiles IS '评委信息视图：包含评委记录和用户基本信息';;
