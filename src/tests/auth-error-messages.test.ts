/**
 * 认证错误消息测试
 * 
 * 测试认证错误的中文化处理是否正确
 */

import { describe, it, expect } from 'vitest'
import { getLocalizedAuthError, isNetworkError, isValidationError } from '../utils/authErrorMessages'

describe('认证错误消息中文化', () => {
  describe('getLocalizedAuthError', () => {
    it('应该正确处理登录凭据错误', () => {
      const testCases = [
        { error: { message: 'Invalid login credentials' }, expected: '用户名或密码错误，请重新输入' },
        { error: { message: 'Invalid credentials' }, expected: '用户名或密码错误，请重新输入' },
        { error: { message: 'Authentication failed' }, expected: '用户名或密码错误，请重新输入' },
        { error: { message: 'Wrong password' }, expected: '用户名或密码错误，请重新输入' }
      ]

      testCases.forEach(({ error, expected }) => {
        const result = getLocalizedAuthError(error)
        expect(result.message).toBe(expected)
        expect(result.suggestions).toContain('检查邮箱地址是否正确')
        expect(result.suggestions).toContain('确认密码是否正确')
      })
    })

    it('应该正确处理用户不存在错误', () => {
      const testCases = [
        { error: { message: 'User not found' }, expected: '该邮箱尚未注册，请先注册账号' },
        { error: { message: 'Account not found' }, expected: '该邮箱尚未注册，请先注册账号' },
        { error: { message: 'No user found' }, expected: '该邮箱尚未注册，请先注册账号' }
      ]

      testCases.forEach(({ error, expected }) => {
        const result = getLocalizedAuthError(error)
        expect(result.message).toBe(expected)
        expect(result.suggestions).toContain('点击注册创建新账号')
      })
    })

    it('应该正确处理用户已存在错误', () => {
      const testCases = [
        { error: { message: 'User already registered' }, expected: '该邮箱已被注册，请直接登录' },
        { error: { message: 'Email already exists' }, expected: '该邮箱已被注册，请直接登录' },
        { error: { message: 'Account already exists' }, expected: '该邮箱已被注册，请直接登录' }
      ]

      testCases.forEach(({ error, expected }) => {
        const result = getLocalizedAuthError(error)
        expect(result.message).toBe(expected)
        expect(result.suggestions).toContain('点击登录使用现有账号')
        expect(result.suggestions).toContain('尝试重置密码')
      })
    })

    it('应该正确处理密码强度错误', () => {
      const testCases = [
        { error: { message: 'Password should be at least 6 characters' }, expected: '密码强度不够，请设置更安全的密码' },
        { error: { message: 'Password too weak' }, expected: '密码强度不够，请设置更安全的密码' },
        { error: { message: 'Weak password' }, expected: '密码强度不够，请设置更安全的密码' }
      ]

      testCases.forEach(({ error, expected }) => {
        const result = getLocalizedAuthError(error)
        expect(result.message).toBe(expected)
        expect(result.suggestions).toContain('密码至少6个字符')
        expect(result.suggestions).toContain('包含字母和数字')
      })
    })

    it('应该正确处理邮箱格式错误', () => {
      const testCases = [
        { error: { message: 'Invalid email' }, expected: '邮箱格式不正确，请输入有效的邮箱地址' },
        { error: { message: 'Email format' }, expected: '邮箱格式不正确，请输入有效的邮箱地址' },
        { error: { message: 'Invalid email address' }, expected: '邮箱格式不正确，请输入有效的邮箱地址' }
      ]

      testCases.forEach(({ error, expected }) => {
        const result = getLocalizedAuthError(error)
        expect(result.message).toBe(expected)
        expect(result.suggestions).toContain('检查邮箱格式是否正确')
      })
    })

    it('应该正确处理邮箱未验证错误', () => {
      const testCases = [
        { error: { message: 'Email not confirmed' }, expected: '邮箱尚未验证，请查收验证邮件' },
        { error: { message: 'Email not verified' }, expected: '邮箱尚未验证，请查收验证邮件' },
        { error: { message: 'Please verify your email' }, expected: '邮箱尚未验证，请查收验证邮件' }
      ]

      testCases.forEach(({ error, expected }) => {
        const result = getLocalizedAuthError(error)
        expect(result.message).toBe(expected)
        expect(result.suggestions).toContain('检查邮箱收件箱')
        expect(result.suggestions).toContain('查看垃圾邮件文件夹')
      })
    })

    it('应该正确处理网络错误', () => {
      const testCases = [
        { error: { message: 'Network error' }, expected: '网络连接失败，请检查网络后重试' },
        { error: { message: 'Connection failed' }, expected: '网络连接失败，请检查网络后重试' },
        { error: { message: 'Failed to fetch' }, expected: '网络连接失败，请检查网络后重试' }
      ]

      testCases.forEach(({ error, expected }) => {
        const result = getLocalizedAuthError(error)
        expect(result.message).toBe(expected)
        expect(result.suggestions).toContain('检查网络连接')
      })
    })

    it('应该正确处理登录尝试过多错误', () => {
      const testCases = [
        { error: { message: 'Too many attempts' }, expected: '登录尝试次数过多，请稍后再试' },
        { error: { message: 'Rate limit' }, expected: '登录尝试次数过多，请稍后再试' },
        { error: { message: 'Login attempts exceeded' }, expected: '登录尝试次数过多，请稍后再试' }
      ]

      testCases.forEach(({ error, expected }) => {
        const result = getLocalizedAuthError(error)
        expect(result.message).toBe(expected)
        expect(result.suggestions).toContain('等待几分钟后重试')
      })
    })

    it('应该处理已经是中文的错误消息', () => {
      const chineseError = { message: '用户名或密码错误' }
      const result = getLocalizedAuthError(chineseError)
      expect(result.message).toBe('用户名或密码错误')
    })

    it('应该处理空错误或未知错误', () => {
      const testCases = [
        null,
        undefined,
        { message: '' },
        { message: 'Some unknown error that does not match any pattern' }
      ]

      testCases.forEach((error) => {
        const result = getLocalizedAuthError(error)
        expect(result.message).toBeTruthy()
        expect(result.suggestions).toBeDefined()
        expect(Array.isArray(result.suggestions)).toBe(true)
      })
    })

    it('应该处理字符串类型的错误', () => {
      const stringError = 'Invalid login credentials'
      const result = getLocalizedAuthError(stringError)
      expect(result.message).toBe('用户名或密码错误，请重新输入')
    })
  })

  describe('isNetworkError', () => {
    it('应该正确识别网络错误', () => {
      const networkErrors = [
        { message: 'Network error' },
        { message: 'Connection failed' },
        { message: 'Failed to fetch' },
        { message: 'NetworkError' },
        'network timeout'
      ]

      networkErrors.forEach((error) => {
        expect(isNetworkError(error)).toBe(true)
      })
    })

    it('应该正确识别非网络错误', () => {
      const nonNetworkErrors = [
        { message: 'Invalid credentials' },
        { message: 'User not found' },
        'validation error'
      ]

      nonNetworkErrors.forEach((error) => {
        expect(isNetworkError(error)).toBe(false)
      })
    })
  })

  describe('isValidationError', () => {
    it('应该正确识别验证错误', () => {
      const validationErrors = [
        { message: 'Invalid email' },
        { message: 'Password too weak' },
        { message: 'Required field' },
        'validation failed'
      ]

      validationErrors.forEach((error) => {
        expect(isValidationError(error)).toBe(true)
      })
    })

    it('应该正确识别非验证错误', () => {
      const nonValidationErrors = [
        { message: 'Network error' },
        { message: 'Server error' },
        'connection failed'
      ]

      nonValidationErrors.forEach((error) => {
        expect(isValidationError(error)).toBe(false)
      })
    })
  })
})