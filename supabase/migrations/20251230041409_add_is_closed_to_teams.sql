-- 添加 is_closed 字段到 teams 表
ALTER TABLE public.teams 
ADD COLUMN is_closed boolean NOT NULL DEFAULT false;

-- 添加注释
COMMENT ON COLUMN public.teams.is_closed IS '队伍是否已关闭招募（满员或手动关闭）';;
