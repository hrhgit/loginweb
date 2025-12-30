-- 测试评委邀请功能数据库结构
-- Test script for judge invitation database structure

-- 1. 验证表是否存在
SELECT 
    table_name, 
    table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'event_judges';

-- 2. 验证表结构
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'event_judges'
ORDER BY ordinal_position;

-- 3. 验证索引
SELECT 
    indexname, 
    indexdef
FROM pg_indexes 
WHERE tablename = 'event_judges' 
AND schemaname = 'public';

-- 4. 验证约束
SELECT 
    constraint_name, 
    constraint_type
FROM information_schema.table_constraints 
WHERE table_schema = 'public' 
AND table_name = 'event_judges';

-- 5. 验证 RLS 策略
SELECT 
    policyname, 
    cmd, 
    permissive, 
    roles
FROM pg_policies 
WHERE tablename = 'event_judges' 
AND schemaname = 'public';

-- 6. 验证函数是否存在
SELECT 
    routine_name, 
    routine_type, 
    data_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('is_event_judge', 'is_event_admin', 'handle_event_judges_updated_at');

-- 7. 验证视图是否存在
SELECT 
    table_name, 
    view_definition
FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name = 'event_judges_with_profiles';

-- 8. 验证枚举类型
SELECT 
    t.typname, 
    e.enumlabel
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid 
WHERE t.typname = 'join_request_status'
ORDER BY e.enumsortorder;