-- ============================================================
-- 邀请评委功能数据库迁移脚本
-- Judge Invitation System Database Migration
-- ============================================================

-- 创建评委表 (Event Judges Table)
CREATE TABLE IF NOT EXISTS public.event_judges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 确保同一用户在同一活动中只能被邀请一次
    CONSTRAINT event_judges_unique UNIQUE(event_id, user_id)
);

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_event_judges_event_id ON public.event_judges(event_id);
CREATE INDEX IF NOT EXISTS idx_event_judges_user_id ON public.event_judges(user_id);
CREATE INDEX IF NOT EXISTS idx_event_judges_created_at ON public.event_judges(created_at);

-- 启用行级安全策略
ALTER TABLE public.event_judges ENABLE ROW LEVEL SECURITY;

-- 清理可能存在的旧策略
DROP POLICY IF EXISTS "评委记录查看" ON public.event_judges;
DROP POLICY IF EXISTS "评委记录插入" ON public.event_judges;
DROP POLICY IF EXISTS "评委记录删除" ON public.event_judges;

-- 创建 RLS 安全策略

-- 1. 查看权限：活动创建者和评委本人可以查看
CREATE POLICY "评委记录查看"
ON public.event_judges FOR SELECT
TO authenticated
USING (
    -- 活动创建者可以查看该活动的所有评委
    auth.uid() IN (
        SELECT created_by 
        FROM public.events 
        WHERE id = event_judges.event_id
    )
    OR
    -- 评委本人可以查看自己的评委记录
    user_id = auth.uid()
);

-- 2. 插入权限：只有活动创建者可以邀请评委
CREATE POLICY "评委记录插入"
ON public.event_judges FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() IN (
        SELECT created_by 
        FROM public.events 
        WHERE id = event_judges.event_id
    )
);

-- 3. 删除权限：只有活动创建者可以移除评委
CREATE POLICY "评委记录删除"
ON public.event_judges FOR DELETE
TO authenticated
USING (
    auth.uid() IN (
        SELECT created_by 
        FROM public.events 
        WHERE id = event_judges.event_id
    )
);

-- 授予权限
GRANT SELECT, INSERT, DELETE ON public.event_judges TO authenticated;

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
    EXECUTE PROCEDURE public.handle_event_judges_updated_at();

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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION public.is_event_judge(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_judge(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_admin(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_admin(UUID) TO authenticated;

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

-- 为视图设置 RLS 策略
ALTER VIEW public.event_judges_with_profiles SET (security_barrier = true);

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

COMMENT ON VIEW public.event_judges_with_profiles IS '评委信息视图：包含评委记录和用户基本信息';