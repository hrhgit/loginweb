/**
 * 认证辅助函数测试
 * 
 * 测试用户名/邮箱登录相关的辅助函数
 */

import { describe, it, expect } from 'vitest'
import { isEmailFormat, validateUsername } from '../utils/authHelpers'

describe('认证辅助函数', () => {
  describe('isEmailFormat', () => {
    it('应该正确识别邮箱格式', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'user123@test-domain.com'
      ]

      validEmails.forEach(email => {
        expect(isEmailFormat(email)).toBe(true)
      })
    })

    it('应该正确识别非邮箱格式', () => {
      const invalidEmails = [
        'username',
        'user123',
        '用户名',
        'test@',
        '@example.com',
        'test.example.com',
        'test@.com',
        'test@com',
        ''
      ]

      invalidEmails.forEach(input => {
        expect(isEmailFormat(input)).toBe(false)
      })
    })
  })

  describe('validateUsername', () => {
    it('应该接受有效的用户名', () => {
      const validUsernames = [
        '张三',
        'user123',
        '用户名123',
        'test_user',
        '李四_2024',
        'ab',
        '测试用户名1234567890'
      ]

      validUsernames.forEach(username => {
        const result = validateUsername(username)
        expect(result.isValid).toBe(true)
        expect(result.message).toBeUndefined()
      })
    })

    it('应该拒绝无效的用户名', () => {
      const testCases = [
        { username: '', expectedMessage: '用户名不能为空' },
        { username: '   ', expectedMessage: '用户名不能为空' },
        { username: 'a', expectedMessage: '用户名至少需要2个字符' },
        { username: '这是一个非常长的用户名超过了二十个字符的限制', expectedMessage: '用户名不能超过20个字符' },
        { username: 'user@name', expectedMessage: '用户名只能包含中文、字母、数字和下划线' },
        { username: 'user-name', expectedMessage: '用户名只能包含中文、字母、数字和下划线' },
        { username: 'user name', expectedMessage: '用户名只能包含中文、字母、数字和下划线' },
        { username: 'user.name', expectedMessage: '用户名只能包含中文、字母、数字和下划线' }
      ]

      testCases.forEach(({ username, expectedMessage }) => {
        const result = validateUsername(username)
        expect(result.isValid).toBe(false)
        expect(result.message).toBe(expectedMessage)
      })
    })

    it('应该正确处理边界情况', () => {
      // 最短有效用户名（2个字符）
      const shortValid = validateUsername('ab')
      expect(shortValid.isValid).toBe(true)

      // 最长有效用户名（20个字符）
      const longValid = validateUsername('12345678901234567890')
      expect(longValid.isValid).toBe(true)

      // 超过长度限制
      const tooLong = validateUsername('123456789012345678901')
      expect(tooLong.isValid).toBe(false)
      expect(tooLong.message).toBe('用户名不能超过20个字符')
    })

    it('应该正确处理中文字符', () => {
      const chineseUsernames = [
        '张三',
        '李四王五',
        '测试用户',
        '用户123',
        '张三_李四'
      ]

      chineseUsernames.forEach(username => {
        const result = validateUsername(username)
        expect(result.isValid).toBe(true)
      })
    })

    it('应该正确处理下划线', () => {
      const underscoreUsernames = [
        'user_name',
        '_user',
        'user_',
        'user_123',
        '用户_名称'
      ]

      underscoreUsernames.forEach(username => {
        const result = validateUsername(username)
        expect(result.isValid).toBe(true)
      })
    })
  })
})