import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { MessageLocalizer, ErrorType } from './errorHandler'

// **Feature: error-message-enhancement, Property 2: 特定错误类型处理**
// **Validates: Requirements 1.3, 1.4**

describe('Specific Error Types Property Tests', () => {
  const localizer = new MessageLocalizer()

  it('Property 2: Specific error type handling - should display predefined standard Chinese error messages for network and permission errors', async () => {
    await fc.assert(
      fc.property(
        fc.oneof(
          // 网络错误生成器 (需求 1.3)
          fc.record({
            message: fc.oneof(
              fc.constant('网络连接失败'),
              fc.constant('网络不可达'),
              fc.constant('连接超时'),
              fc.constant('fetch failed'),
              fc.constant('NetworkError'),
              fc.constant('Failed to fetch'),
              fc.constant('Connection refused'),
              fc.constant('DNS resolution failed'),
              fc.constant('No internet connection')
            ),
            code: fc.option(fc.constantFrom('NETWORK_ERROR', 'CONNECTION_FAILED'))
          }),
          // 权限错误生成器 (需求 1.4)
          fc.record({
            message: fc.oneof(
              fc.constant('权限不足'),
              fc.constant('访问被拒绝'),
              fc.constant('未授权访问'),
              fc.constant('permission denied'),
              fc.constant('unauthorized'),
              fc.constant('forbidden'),
              fc.constant('access denied'),
              fc.constant('insufficient privileges'),
              fc.constant('authentication required')
            ),
            code: fc.option(fc.constantFrom('42501', 'PERMISSION_DENIED', '401', '403'))
          })
        ),
        (errorInput) => {
          const localizedMessage = localizer.localize(errorInput)
          
          // 验证返回的消息结构
          expect(localizedMessage).toHaveProperty('title')
          expect(localizedMessage).toHaveProperty('message')
          expect(localizedMessage).toHaveProperty('suggestions')
          
          // 确定错误类型
          const message = errorInput.message || ''
          const isNetworkError = message.includes('网络') || message.includes('连接') || 
                                message.includes('fetch') || message.includes('NetworkError') || 
                                message.includes('Failed to fetch') || message.includes('Connection') ||
                                message.includes('DNS') || message.includes('internet')
          
          const isPermissionError = message.includes('权限') || message.includes('permission') || 
                                   message.includes('unauthorized') || message.includes('forbidden') ||
                                   message.includes('access denied') || message.includes('privileges') ||
                                   message.includes('authentication')
          
          if (isNetworkError && !message.includes('timeout') && !message.includes('超时')) {
            // 网络错误应该显示标准的中文错误消息 (需求 1.3)
            expect(localizedMessage.title).toBe('网络错误')
            expect(localizedMessage.message).toBe('网络连接失败，请检查网络后重试')
            
            // 验证网络错误的建议
            expect(localizedMessage.suggestions).toContain('检查网络连接是否正常')
            expect(localizedMessage.suggestions).toContain('尝试刷新页面')
            expect(localizedMessage.suggestions).toContain('稍后再试')
            
            // 网络错误应该可以重试
            expect(localizedMessage.actionText).toBe('重试')
          }
          
          if (isPermissionError) {
            // 权限错误应该显示标准的中文错误消息 (需求 1.4)
            expect(localizedMessage.title).toBe('权限错误')
            expect(localizedMessage.message).toBe('权限不足，请联系管理员')
            
            // 验证权限错误的建议
            expect(localizedMessage.suggestions).toContain('联系管理员获取权限')
            expect(localizedMessage.suggestions).toContain('确认账户状态是否正常')
            expect(localizedMessage.suggestions).toContain('重新登录后再试')
            
            // 权限错误不应该可以重试
            expect(localizedMessage.actionText).toBeUndefined()
          }
          
          // 所有消息都应该是中文的
          const chineseRegex = /[\u4e00-\u9fa5]/
          expect(chineseRegex.test(localizedMessage.title)).toBe(true)
          expect(chineseRegex.test(localizedMessage.message)).toBe(true)
          
          // 验证建议也是中文的
          for (const suggestion of localizedMessage.suggestions) {
            expect(chineseRegex.test(suggestion)).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 2.1: Network error standardization - all network errors should produce the same standard message', async () => {
    await fc.assert(
      fc.property(
        fc.oneof(
          fc.constant({ message: '网络连接失败' }),
          fc.constant({ message: 'fetch failed' }),
          fc.constant({ message: 'NetworkError: Connection lost' }),
          fc.constant({ message: 'Failed to fetch resource' }),
          fc.constant({ message: 'Connection refused by server' }),
          fc.constant({ message: 'DNS resolution failed' }),
          fc.constant({ message: 'No internet connection available' }),
          fc.constant({ message: '网络不可达', code: 'NETWORK_ERROR' }),
          fc.constant({ message: 'Connection error', code: 'CONNECTION_FAILED' })
        ),
        (networkError) => {
          const localizedMessage = localizer.localize(networkError)
          
          // 所有网络错误都应该产生相同的标准消息 (需求 1.3)
          expect(localizedMessage.title).toBe('网络错误')
          expect(localizedMessage.message).toBe('网络连接失败，请检查网络后重试')
          
          // 建议应该一致
          expect(localizedMessage.suggestions).toEqual([
            '检查网络连接是否正常',
            '尝试刷新页面',
            '稍后再试'
          ])
          
          // 应该可以重试
          expect(localizedMessage.actionText).toBe('重试')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 2.2: Permission error standardization - all permission errors should produce the same standard message', async () => {
    await fc.assert(
      fc.property(
        fc.oneof(
          fc.constant({ message: '权限不足' }),
          fc.constant({ message: 'permission denied' }),
          fc.constant({ message: 'unauthorized access' }),
          fc.constant({ message: 'forbidden operation' }),
          fc.constant({ message: 'access denied by server' }),
          fc.constant({ message: 'insufficient privileges' }),
          fc.constant({ message: 'authentication required' }),
          fc.constant({ message: '访问被拒绝', code: '42501' }),
          fc.constant({ message: 'Unauthorized', code: 'PERMISSION_DENIED' }),
          fc.constant({ message: 'Forbidden', code: '403' })
        ),
        (permissionError) => {
          const localizedMessage = localizer.localize(permissionError)
          
          // 所有权限错误都应该产生相同的标准消息 (需求 1.4)
          expect(localizedMessage.title).toBe('权限错误')
          expect(localizedMessage.message).toBe('权限不足，请联系管理员')
          
          // 建议应该一致
          expect(localizedMessage.suggestions).toEqual([
            '联系管理员获取权限',
            '确认账户状态是否正常',
            '重新登录后再试'
          ])
          
          // 不应该可以重试
          expect(localizedMessage.actionText).toBeUndefined()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 2.3: Error type distinction - network and permission errors should be clearly distinguished', async () => {
    await fc.assert(
      fc.property(
        fc.record({
          networkError: fc.record({
            message: fc.constantFrom(
              '网络连接失败', 'fetch failed', 'NetworkError', 'Failed to fetch'
            )
          }),
          permissionError: fc.record({
            message: fc.constantFrom(
              '权限不足', 'permission denied', 'unauthorized', 'forbidden'
            )
          })
        }),
        ({ networkError, permissionError }) => {
          const networkMessage = localizer.localize(networkError)
          const permissionMessage = localizer.localize(permissionError)
          
          // 网络错误和权限错误应该有不同的标题
          expect(networkMessage.title).toBe('网络错误')
          expect(permissionMessage.title).toBe('权限错误')
          expect(networkMessage.title).not.toBe(permissionMessage.title)
          
          // 应该有不同的消息内容
          expect(networkMessage.message).toBe('网络连接失败，请检查网络后重试')
          expect(permissionMessage.message).toBe('权限不足，请联系管理员')
          expect(networkMessage.message).not.toBe(permissionMessage.message)
          
          // 应该有不同的建议
          expect(networkMessage.suggestions).not.toEqual(permissionMessage.suggestions)
          
          // 重试能力应该不同
          expect(networkMessage.actionText).toBe('重试')
          expect(permissionMessage.actionText).toBeUndefined()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 2.4: Context-aware specific error handling - specific errors should adapt to context while maintaining standard messages', async () => {
    await fc.assert(
      fc.property(
        fc.oneof(
          fc.constant({ message: 'NetworkError', type: 'network' }),
          fc.constant({ message: 'permission denied', type: 'permission' })
        ),
        fc.record({
          operation: fc.constantFrom('login', 'upload', 'save'),
          component: fc.constantFrom('form', 'auth', 'upload')
        }),
        (errorData, context) => {
          const error = { message: errorData.message }
          const localizedMessage = localizer.localize(error, context)
          
          if (errorData.type === 'network') {
            // 网络错误的核心消息应该保持标准，但可能根据上下文调整
            expect(localizedMessage.title).toBe('网络错误')
            
            // 根据操作类型，消息可能会更具体
            if (context.operation === 'login') {
              expect(localizedMessage.message).toContain('登录')
              expect(localizedMessage.message).toContain('网络')
            } else if (context.operation === 'upload') {
              expect(localizedMessage.message).toContain('上传')
              expect(localizedMessage.message).toContain('网络')
            } else {
              // 默认情况下应该是标准消息
              expect(localizedMessage.message).toContain('网络')
            }
          }
          
          if (errorData.type === 'permission') {
            // 权限错误的核心消息应该保持标准
            expect(localizedMessage.title).toBe('权限错误')
            
            // 根据操作类型，消息可能会更具体
            if (context.operation === 'login') {
              expect(localizedMessage.message).toContain('登录')
            } else {
              // 默认情况下应该包含权限相关内容
              expect(localizedMessage.message).toContain('权限')
            }
          }
          
          // 所有消息都应该是中文的
          const chineseRegex = /[\u4e00-\u9fa5]/
          expect(chineseRegex.test(localizedMessage.title)).toBe(true)
          expect(chineseRegex.test(localizedMessage.message)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })
})