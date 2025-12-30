-- 创建函数来根据用户名获取邮箱地址
-- 这个函数通过 profiles 表的用户名查找对应的用户ID，然后获取邮箱

CREATE OR REPLACE FUNCTION get_user_email_by_username(username_param TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_email TEXT;
    user_uuid UUID;
BEGIN
    -- 首先从 profiles 表中根据用户名获取用户ID
    SELECT id INTO user_uuid
    FROM profiles
    WHERE username = username_param;
    
    -- 如果没找到用户，返回 NULL
    IF user_uuid IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- 从 auth.users 表中获取邮箱
    SELECT email INTO user_email
    FROM auth.users
    WHERE id = user_uuid;
    
    RETURN user_email;
END;
$$;

-- 授予执行权限给认证用户和匿名用户
GRANT EXECUTE ON FUNCTION get_user_email_by_username(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_email_by_username(TEXT) TO anon;

-- 保留原来的函数以防需要
CREATE OR REPLACE FUNCTION get_user_email_by_id(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_email TEXT;
BEGIN
    -- 从 auth.users 表中获取邮箱
    SELECT email INTO user_email
    FROM auth.users
    WHERE id = user_id;
    
    RETURN user_email;
END;
$$;

-- 授予执行权限给认证用户
GRANT EXECUTE ON FUNCTION get_user_email_by_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_email_by_id(UUID) TO anon;