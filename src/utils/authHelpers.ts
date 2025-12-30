/**
 * 认证辅助函数
 * 
 * 提供邮箱登录的辅助功能
 */

import { supabase } from '../lib/supabase'

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
      .maybeSingle()

    return !error && !!data
  } catch (error) {
    console.error('Error checking username:', error)
    return false
  }
}

/**
 * 通过用户名查找对应的邮箱地址
 */
export async function getUserEmailByUsername(username: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('email')
      .eq('username', username)
      .maybeSingle()

    if (error || !data) {
      return null
    }

    return data.email || null
  } catch (error) {
    console.error('Error getting email by username:', error)
    return null
  }
}

/**
 * 检查输入是否为邮箱格式
 */
export function isEmailFormat(input: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(input)
}
