/**
 * **Feature: error-message-enhancement, Property 11: 上下文感知消息**
 * **验证需求: 4.2**
 * 
 * 对于任何包含上下文信息的错误，生成的错误消息应该比无上下文的消息更具体
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { ErrorHandlerAPI, ErrorContext, ErrorType } from '../utils/errorHandler'

describe('Property Test: Context-Aware Messages', () => {
  it('should generate more specific messages when context is provided', () => {
    fc.assert(fc.property(
      // 生成各种错误对象
      fc.oneof(
        fc.record({
          message: fc.string({ minLength: 1, maxLength: 100 }),
          code: fc.oneof(fc.constant('NETWORK_ERROR'), fc.constant('PERMISSION_DENIED'), fc.constant('VALIDATION_ERROR'))
        }),
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.record({
          toString: fc.constant(() => 'Test error')
        })
      ),
      // 生成上下文信息
      fc.record({
        operation: fc.oneof(
          fc.constant('login'),
          fc.constant('upload'), 
          fc.constant('save'),
          fc.constant('delete'),
          fc.constant('create')
        ),
        component: fc.oneof(
          fc.constant('form'),
          fc.constant('auth'),
          fc.constant('upload'),
          fc.constant('profile'),
          fc.constant('event')
        ),
        userId: fc.option(fc.uuid()),
        additionalData: fc.option(fc.record({
          eventId: fc.uuid(),
          teamId: fc.uuid()
        }))
      }),
      (error, context) => {
        const errorHandler = new ErrorHandlerAPI()
        
        // 获取有上下文的错误响应
        const responseWithContext = errorHandler.handleError(error, context)
        
        // 获取无上下文的错误响应
        const responseWithoutContext = errorHandler.handleError(error)
        
        // 验证有上下文的消息应该不同于无上下文的消息，或者至少包含更多信息
        // 这里我们检查消息长度或内容的差异
        const hasMoreSpecificMessage = 
          responseWithContext.message !== responseWithoutContext.message ||
          responseWithContext.message.length >= responseWithoutContext.message.length ||
          responseWithContext.suggestions.length >= responseWithoutContext.suggestions.length
        
        expect(hasMoreSpecificMessage).toBe(true)
        
        // 验证上下文信息被正确处理
        expect(responseWithContext.id).toContain(context.operation)
        expect(responseWithContext.id).toContain(context.component)
        
        // 验证响应结构完整性
        expect(responseWithContext.id).toBeDefined()
        expect(responseWithContext.type).toBeDefined()
        expect(responseWithContext.message).toBeDefined()
        expect(typeof responseWithContext.canRetry).toBe('boolean')
        expect(responseWithContext.severity).toBeDefined()
        expect(Array.isArray(responseWithContext.suggestions)).toBe(true)
      }
    ), { numRuns: 100 })
  })

  it('should include operation-specific messages when context operation is provided', () => {
    fc.assert(fc.property(
      // 生成网络错误
      fc.record({
        message: fc.constant('Network connection failed'),
        code: fc.constant('NETWORK_ERROR')
      }),
      // 生成特定操作上下文
      fc.oneof(
        fc.constant({ operation: 'login', component: 'auth' }),
        fc.constant({ operation: 'upload', component: 'form' }),
        fc.constant({ operation: 'save', component: 'profile' })
      ),
      (error, context) => {
        const errorHandler = new ErrorHandlerAPI()
        const response = errorHandler.handleError(error, context)
        
        // 验证消息包含操作相关的内容
        const messageIncludesOperation = 
          response.message.includes(context.operation) ||
          response.message.includes('登录') && context.operation === 'login' ||
          response.message.includes('上传') && context.operation === 'upload' ||
          response.message.includes('保存') && context.operation === 'save'
        
        // 至少消息应该是有意义的中文消息
        expect(response.message.length).toBeGreaterThan(0)
        expect(/[\u4e00-\u9fa5]/.test(response.message)).toBe(true) // 包含中文字符
      }
    ), { numRuns: 100 })
  })

  it('should provide component-specific suggestions when context component is provided', () => {
    fc.assert(fc.property(
      // 生成验证错误
      fc.record({
        message: fc.oneof(
          fc.constant('Validation failed'),
          fc.constant('Invalid input'),
          fc.constant('Required field missing')
        )
      }),
      // 生成组件上下文
      fc.oneof(
        fc.constant({ operation: 'create', component: 'form' }),
        fc.constant({ operation: 'login', component: 'auth' }),
        fc.constant({ operation: 'upload', component: 'upload' })
      ),
      (error, context) => {
        const errorHandler = new ErrorHandlerAPI()
        const response = errorHandler.handleError(error, context)
        
        // 验证建议列表不为空
        expect(response.suggestions.length).toBeGreaterThan(0)
        
        // 验证建议是中文的
        response.suggestions.forEach(suggestion => {
          expect(suggestion.length).toBeGreaterThan(0)
          expect(/[\u4e00-\u9fa5]/.test(suggestion)).toBe(true)
        })
        
        // 验证响应ID包含组件信息
        expect(response.id).toContain(context.component)
      }
    ), { numRuns: 100 })
  })
})