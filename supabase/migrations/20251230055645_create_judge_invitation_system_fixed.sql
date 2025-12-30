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
GRANT SELECT, INSERT, DELETE ON public.event_judges TO authenticated;;
