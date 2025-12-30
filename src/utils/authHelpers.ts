/**
 * 认证辅助函数
 * 
 * 提供用户名/邮箱登录的辅助功能
 */

import { supabase } from '../lib/supabase'

/**
 * 检查输入是否为邮箱格式
 */
export function isEmailFormat(input: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(input)
}

/**
 * 根据用户名查找对应的邮箱地址
 * 现在直接从 profiles 表查询，因为我们已经添加了 email 列
 */
export async function findEmailByUsername(username: string): Promise<string | null> {
  try {
    console.log('Looking up email for username:', username)
    
    // 直接从 profiles 表查询用户名对应的邮箱
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('email')
      .eq('username', username)
      .single()

    if (error) {
      console.log('Profile lookup error:', error)
      return null
    }

    if (!profile || !profile.email) {
      console.log('No profile found or no email:', profile)
      return null
    }

    console.log('Found email for username:', profile.email)
    return profile.email
  } catch (error) {
    console.error('Error finding email by username:', error)
    return null
  }
}

/**
 * 处理用户名或邮箱登录
 * 如果输入是用户名，先转换为邮箱再登录
 */
export async function signInWithEmailOrUsername(
  emailOrUsername: string,
  password: string
): Promise<{ data: any; error: any }> {
  let email = emailOrUsername.trim()

  console.log('Login attempt with:', emailOrUsername)
  console.log('Is email format:', isEmailFormat(emailOrUsername))

  // 如果不是邮箱格式，尝试通过用户名查找邮箱
  if (!isEmailFormat(emailOrUsername)) {
    console.log('Attempting to find email for username:', emailOrUsername)
    
    const foundEmail = await findEmailByUsername(emailOrUsername)
    console.log('Found email:', foundEmail)
    
    if (!foundEmail) {
      return {
        data: null,
        error: {
          message: 'User not found',
          status: 400,
          code: 'user_not_found'
        }
      }
    }
    email = foundEmail
  }

  console.log('Final email for login:', email)

  // 使用邮箱进行登录
  const result = await supabase.auth.signInWithPassword({
    email,
    password
  })

  console.log('Login result:', { 
    success: !result.error, 
    error: result.error?.message 
  })

  return result
}

/**
 * 验证用户名格式
 */
export function validateUsername(username: string): { isValid: boolean; message?: string } {
  if (!username || username.trim().length === 0) {
    return { isValid: false, message: '用户名不能为空' }
  }

  const trimmed = username.trim()

  if (trimmed.length < 2) {
    return { isValid: false, message: '用户名至少需要2个字符' }
  }

  if (trimmed.length > 20) {
    return { isValid: false, message: '用户名不能超过20个字符' }
  }

  // 允许中文、英文字母、数字、下划线
  const usernameRegex = /^[\u4e00-\u9fa5a-zA-Z0-9_]+$/
  if (!usernameRegex.test(trimmed)) {
    return { isValid: false, message: '用户名只能包含中文、字母、数字和下划线' }
  }

  return { isValid: true }
}

/**
 * 检查用户名是否已存在
 */
export async function checkUsernameExists(username: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single()

    return !error && !!data
  } catch (error) {
    console.error('Error checking username:', error)
    return false
  }
}