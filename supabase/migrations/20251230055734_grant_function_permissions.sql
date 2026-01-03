-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION public.is_event_judge(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_admin(UUID, UUID) TO authenticated;;
