-- 修复用户名查找邮箱函数的安全问题
CREATE OR REPLACE FUNCTION get_user_email_by_username(username_param TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_email TEXT;
BEGIN
    -- 直接从 profiles 表中根据用户名获取邮箱
    SELECT email INTO user_email
    FROM profiles
    WHERE username = username_param;
    
    RETURN user_email;
END;
$$;;
