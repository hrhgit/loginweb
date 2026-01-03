-- 创建自动更新时间戳的触发器
CREATE OR REPLACE FUNCTION public.handle_event_judges_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS event_judges_updated_at_trigger ON public.event_judges;
CREATE TRIGGER event_judges_updated_at_trigger
    BEFORE UPDATE ON public.event_judges
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_event_judges_updated_at();;
