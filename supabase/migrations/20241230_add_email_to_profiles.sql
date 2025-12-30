-- 为 profiles 表添加邮箱列，支持用户名登录功能
-- 这样我们就可以在 profiles 表中存储邮箱，方便用户名到邮箱的转换

-- 1. 添加邮箱列到 profiles 表
ALTER TABLE profiles 
ADD COLUMN email TEXT;

-- 2. 为现有用户同步邮箱数据
-- 从 auth.users 表同步邮箱到 profiles 表
UPDATE profiles 
SET email = auth_users.email
FROM auth.users AS auth_users
WHERE profiles.id = auth_users.id
AND profiles.email IS NULL;

-- 3. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- 4. 创建或更新触发器函数，确保新用户注册时自动同步邮箱
CREATE OR REPLACE FUNCTION sync_user_email_to_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- 当 profiles 记录被插入时，自动从 auth.users 同步邮箱
    IF NEW.email IS NULL THEN
        SELECT email INTO NEW.email
        FROM auth.users
        WHERE id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 创建触发器（如果不存在）
DROP TRIGGER IF EXISTS trigger_sync_user_email ON profiles;
CREATE TRIGGER trigger_sync_user_email
    BEFORE INSERT OR UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_email_to_profile();

-- 6. 更新用户名查找邮箱的函数，现在可以直接从 profiles 表查询
CREATE OR REPLACE FUNCTION get_user_email_by_username(username_param TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
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
$$;

-- 7. 授予执行权限
GRANT EXECUTE ON FUNCTION get_user_email_by_username(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_email_by_username(TEXT) TO anon;

-- 8. 创建一个函数来确保邮箱数据同步（可选，用于数据修复）
CREATE OR REPLACE FUNCTION sync_all_user_emails()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    updated_count INTEGER := 0;
BEGIN
    -- 同步所有缺失邮箱的用户记录
    UPDATE profiles 
    SET email = auth_users.email
    FROM auth.users AS auth_users
    WHERE profiles.id = auth_users.id
    AND (profiles.email IS NULL OR profiles.email = '');
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    RETURN updated_count;
END;
$$;

-- 9. 授予同步函数的执行权限（仅给认证用户，用于管理）
GRANT EXECUTE ON FUNCTION sync_all_user_emails() TO authenticated;

-- 10. 执行一次完整同步
SELECT sync_all_user_emails();