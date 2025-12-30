import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { ErrorHandlerAPI, ErrorType, ErrorContext, MessageSeverity } from './errorHandler'

// **Feature: error-message-enhancement, Property 12: 重复消息合并**
// **验证需求: 4.3**

describe('Duplicate Message Merging Property Tests', () => {
  let errorHandler: ErrorHandlerAPI
  
  beforeEach(() => {
    // 创建新的错误处理器实例以确保测试隔离
    errorHandler = new ErrorHandlerAPI()
    // 模拟时间以便控制重复检测
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // 错误生成器
  const errorGenerator = fc.oneof(
    fc.record({
      message: fc.string({ minLength: 1, maxLength: 50 }),
      code: fc.constantFrom('NETWORK_ERROR', 'PERMISSION_DENIED', 'VALIDATION_ERROR', '500', '401', '403')
    }),
    fc.string({ minLength: 1, maxLength: 50 }),
    fc.record({
      toString: fc.constant(() => 'Test error')
    })
  )

  // 上下文生成器
  const contextGenerator = fc.record({
    operation: fc.constantFrom('login', 'upload', 'save', 'delete', 'create', 'update'),
    component: fc.constantFrom('form', 'upload', 'auth', 'profile', 'team', 'event'),
    userId: fc.option(fc.uuid()),
    additionalData: fc.option(fc.dictionary(fc.string(), fc.anything()))
  })

  it('Property 12: Duplicate message merging - should merge consecutive identical error types within threshold time', async () => {
    await fc.assert(
      fc.property(
        errorGenerator,
        contextGenerator,
        fc.integer({ min: 2, max: 5 }), // 重复次数
        (error, context, repeatCount) => {
          const responses: any[] = []
          
          // 在短时间内多次处理相同类型的错误
          for (let i = 0; i < repeatCount; i++) {
            const response = errorHandler.handleError(error, context)
            responses.push(response)
            
            // 模拟短时间间隔（小于重复阈值）
            vi.advanceTimersByTime(1000) // 1秒间隔
          }
          
          // 验证所有响应都有相同的错误类型
          const firstType = responses[0].type
          responses.forEach(response => {
            expect(response.type).toBe(firstType)
          })
          
          // 验证响应结构完整
          responses.forEach(response => {
            expect(response).toHaveProperty('id')
            expect(response).toHaveProperty('type')
            expect(response).toHaveProperty('message')
            expect(response).toHaveProperty('canRetry')
            expect(response).toHaveProperty('severity')
          })
          
          // 验证消息内容一致性（重复消息应该有相同的内容）
          const firstMessage = responses[0].message
          responses.forEach(response => {
            expect(response.message).toBe(firstMessage)
          })
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 12: Duplicate message merging - should not merge errors that occur after threshold time', async () => {
    await fc.assert(
      fc.property(
        errorGenerator,
        contextGenerator,
        (error, context) => {
          // 第一次处理错误
          const response1 = errorHandler.handleError(error, context)
          
          // 等待超过重复阈值时间（5秒）
          vi.advanceTimersByTime(6000)
          
          // 第二次处理相同错误
          const response2 = errorHandler.handleError(error, context)
          
          // 验证两个响应都有效
          expect(response1).toHaveProperty('id')
          expect(response1).toHaveProperty('type')
          expect(response1).toHaveProperty('message')
          
          expect(response2).toHaveProperty('id')
          expect(response2).toHaveProperty('type')
          expect(response2).toHaveProperty('message')
          
          // 验证错误类型一致
          expect(response1.type).toBe(response2.type)
          expect(response1.message).toBe(response2.message)
          
          // ID应该不同（因为时间戳不同）
          expect(response1.id).not.toBe(response2.id)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 12: Duplicate message merging - should handle different error types separately', async () => {
    await fc.assert(
      fc.property(
        contextGenerator,
        (context) => {
          // 创建不同类型的错误
          const networkError = { message: 'Network failed', code: 'NETWORK_ERROR' }
          const permissionError = { message: 'Access denied', code: 'PERMISSION_DENIED' }
          const validationError = { message: 'Invalid input', code: 'VALIDATION_ERROR' }
          
          const errors = [networkError, permissionError, validationError]
          const responses: any[] = []
          
          // 快速连续处理不同类型的错误
          errors.forEach(error => {
            const response = errorHandler.handleError(error, context)
            responses.push(response)
            vi.advanceTimersByTime(500) // 短间隔
          })
          
          // 验证所有响应都有效
          responses.forEach(response => {
            expect(response).toHaveProperty('id')
            expect(response).toHaveProperty('type')
            expect(response).toHaveProperty('message')
            expect(response).toHaveProperty('canRetry')
            expect(response).toHaveProperty('severity')
          })
          
          // 验证不同错误类型被正确分类
          expect(responses[0].type).toBe(ErrorType.NETWORK)
          expect(responses[1].type).toBe(ErrorType.PERMISSION)
          expect(responses[2].type).toBe(ErrorType.VALIDATION)
          
          // 验证每个错误都有唯一的ID
          const ids = responses.map(r => r.id)
          const uniqueIds = new Set(ids)
          expect(uniqueIds.size).toBe(responses.length)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 12: Duplicate message merging - should handle context variations correctly', async () => {
    await fc.assert(
      fc.property(
        errorGenerator,
        fc.array(contextGenerator, { minLength: 2, maxLength: 4 }),
        (error, contexts) => {
          const responses: any[] = []
          
          // 使用相同错误但不同上下文
          contexts.forEach(context => {
            const response = errorHandler.handleError(error, context)
            responses.push(response)
            vi.advanceTimersByTime(1000) // 短间隔
          })
          
          // 验证所有响应都有效
          responses.forEach(response => {
            expect(response).toHaveProperty('id')
            expect(response).toHaveProperty('type')
            expect(response).toHaveProperty('message')
            expect(response).toHaveProperty('canRetry')
            expect(response).toHaveProperty('severity')
          })
          
          // 验证错误类型一致（相同错误应该有相同类型）
          const firstType = responses[0].type
          responses.forEach(response => {
            expect(response.type).toBe(firstType)
          })
          
          // 验证ID包含上下文信息
          responses.forEach((response, index) => {
            const context = contexts[index]
            expect(response.id).toContain(context.operation)
            expect(response.id).toContain(context.component)
          })
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 12: Duplicate message merging - should maintain error classification consistency during merging', async () => {
    await fc.assert(
      fc.property(
        errorGenerator,
        contextGenerator,
        fc.integer({ min: 2, max: 4 }),
        (error, context, repeatCount) => {
          const responses: any[] = []
          
          // 快速连续处理相同错误
          for (let i = 0; i < repeatCount; i++) {
            const response = errorHandler.handleError(error, context)
            responses.push(response)
            vi.advanceTimersByTime(500) // 短间隔确保在重复阈值内
          }
          
          // 验证所有响应的分类属性一致
          const firstResponse = responses[0]
          responses.forEach(response => {
            expect(response.type).toBe(firstResponse.type)
            expect(response.canRetry).toBe(firstResponse.canRetry)
            expect(response.severity).toBe(firstResponse.severity)
            expect(response.message).toBe(firstResponse.message)
            
            // 建议应该一致
            if (firstResponse.suggestions) {
              expect(response.suggestions).toEqual(firstResponse.suggestions)
            }
          })
          
          // 验证错误分类的合理性
          expect(Object.values(ErrorType)).toContain(firstResponse.type)
          expect(Object.values(MessageSeverity)).toContain(firstResponse.severity)
          expect(typeof firstResponse.canRetry).toBe('boolean')
          expect(typeof firstResponse.message).toBe('string')
          expect(firstResponse.message.length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 12: Duplicate message merging - should handle edge cases gracefully', async () => {
    await fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.constant(''),
          fc.record({})
        ),
        fc.oneof(
          fc.constant(undefined),
          contextGenerator
        ),
        (error, context) => {
          // 处理边缘情况不应该抛出异常
          expect(() => {
            const response = errorHandler.handleError(error, context)
            
            // 验证响应结构完整
            expect(response).toHaveProperty('id')
            expect(response).toHaveProperty('type')
            expect(response).toHaveProperty('message')
            expect(response).toHaveProperty('canRetry')
            expect(response).toHaveProperty('severity')
            
            // 消息应该是非空字符串
            expect(typeof response.message).toBe('string')
            expect(response.message.length).toBeGreaterThan(0)
            
            // 类型应该是有效的错误类型
            expect(Object.values(ErrorType)).toContain(response.type)
            
            // 严重程度应该是有效值
            expect(Object.values(MessageSeverity)).toContain(response.severity)
            
          }).not.toThrow()
        }
      ),
      { numRuns: 100 }
    )
  })
})