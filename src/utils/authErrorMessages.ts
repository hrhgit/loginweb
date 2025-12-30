/**
 * 认证错误消息中文化处理
 * 
 * 为常见的认证错误提供用户友好的中文错误消息
 */

export interface AuthErrorMapping {
  pattern: string | RegExp
  message: string
  suggestions?: string[]
}

/**
 * 常见认证错误的中文映射
 */
export const AUTH_ERROR_MAPPINGS: AuthErrorMapping[] = [
  // 登录错误
  {
    pattern: /Invalid login credentials|Invalid credentials|Authentication failed|Wrong password|Incorrect password/i,
    message: '用户名或密码错误，请重新输入',
    suggestions: ['检查邮箱地址是否正确', '确认密码是否正确', '尝试重置密码']
  },
  
  // 用户不存在
  {
    pattern: /User not found|Account not found|No user found|user_not_found/i,
    message: '用户不存在，请检查邮箱或用户名是否正确',
    suggestions: ['检查邮箱地址或用户名是否正确', '点击注册创建新账号']
  },
  
  // 用户已存在/邮箱已注册
  {
    pattern: /User already registered|Email already exists|Account already exists|already been registered/i,
    message: '该邮箱已被注册，请直接登录',
    suggestions: ['点击登录使用现有账号', '尝试重置密码', '使用其他邮箱注册']
  },
  
  // 密码强度不够
  {
    pattern: /Password should be at least|Password too weak|Weak password|Password must be/i,
    message: '密码强度不够，请设置更安全的密码',
    suggestions: ['密码至少6个字符', '包含字母和数字', '避免使用常见密码']
  },
  
  // 邮箱格式错误
  {
    pattern: /Invalid email|Email format|Invalid email address/i,
    message: '邮箱格式不正确，请输入有效的邮箱地址',
    suggestions: ['检查邮箱格式是否正确', '确保包含@符号和域名']
  },
  
  // 邮箱未验证
  {
    pattern: /Email not confirmed|Email not verified|Please verify your email/i,
    message: '邮箱尚未验证，请查收验证邮件',
    suggestions: ['检查邮箱收件箱', '查看垃圾邮件文件夹', '重新发送验证邮件']
  },
  
  // 账号被锁定
  {
    pattern: /Account locked|Account disabled|Account suspended/i,
    message: '账号已被锁定，请联系管理员',
    suggestions: ['联系客服解锁账号', '检查账号状态']
  },
  
  // 登录尝试过多
  {
    pattern: /Too many attempts|Rate limit|Login attempts exceeded/i,
    message: '登录尝试次数过多，请稍后再试',
    suggestions: ['等待几分钟后重试', '检查网络连接', '联系技术支持']
  },
  
  // 会话过期
  {
    pattern: /Session expired|Token expired|Authentication expired/i,
    message: '登录已过期，请重新登录',
    suggestions: ['点击重新登录', '清除浏览器缓存']
  },
  
  // 网络连接错误
  {
    pattern: /Network error|Connection failed|Failed to fetch|NetworkError/i,
    message: '网络连接失败，请检查网络后重试',
    suggestions: ['检查网络连接', '刷新页面重试', '稍后再试']
  },
  
  // 服务器错误
  {
    pattern: /Server error|Internal server error|Service unavailable|500|503/i,
    message: '服务器暂时不可用，请稍后重试',
    suggestions: ['稍后重试', '联系技术支持']
  },
  
  // 用户名格式错误
  {
    pattern: /Invalid username|Username format|Username required/i,
    message: '用户名格式不正确，请重新输入',
    suggestions: ['用户名长度2-20个字符', '只能包含中文、字母、数字和下划线']
  },
  
  // 用户名已存在
  {
    pattern: /Username already exists|Username taken|用户名已被使用/i,
    message: '该用户名已被使用，请选择其他用户名',
    suggestions: ['尝试其他用户名', '在用户名后添加数字']
  },
  
  // 注册失败
  {
    pattern: /Signup failed|Registration failed|Failed to create account/i,
    message: '注册失败，请稍后重试',
    suggestions: ['检查网络连接', '确认信息填写正确', '联系技术支持']
  }
]

/**
 * 根据错误消息获取中文化的错误信息
 */
export function getLocalizedAuthError(error: any): { message: string; suggestions?: string[] } {
  if (!error) {
    return { message: '未知错误，请稍后重试' }
  }

  // 获取错误消息
  const errorMessage = typeof error === 'string' 
    ? error 
    : error.message || error.error_description || error.msg || String(error)

  // 查找匹配的错误映射
  for (const mapping of AUTH_ERROR_MAPPINGS) {
    const pattern = mapping.pattern
    const isMatch = typeof pattern === 'string' 
      ? errorMessage.includes(pattern)
      : pattern.test(errorMessage)
    
    if (isMatch) {
      return {
        message: mapping.message,
        suggestions: mapping.suggestions
      }
    }
  }

  // 如果没有找到匹配的映射，检查是否已经是中文消息
  if (/[\u4e00-\u9fa5]/.test(errorMessage) && errorMessage.length < 100) {
    return { message: errorMessage }
  }

  // 默认错误消息
  return { 
    message: '操作失败，请稍后重试',
    suggestions: ['检查网络连接', '刷新页面重试', '联系技术支持']
  }
}

/**
 * 检查是否为网络相关错误
 */
export function isNetworkError(error: any): boolean {
  if (!error) return false
  
  const message = typeof error === 'string' 
    ? error 
    : error.message || error.error_description || String(error)
    
  return /network|connection|fetch|timeout|offline/i.test(message)
}

/**
 * 检查是否为验证相关错误
 */
export function isValidationError(error: any): boolean {
  if (!error) return false
  
  const message = typeof error === 'string' 
    ? error 
    : error.message || error.error_description || String(error)
    
  return /validation|invalid|format|required|weak|strength/i.test(message)
}