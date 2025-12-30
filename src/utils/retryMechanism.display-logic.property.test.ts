import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { ErrorClassifier, ErrorType, RetryMechanism, ErrorHandlerAPI } from './errorHandler'

// **Feature: error-message-enhancement, Property 6: 重试按钮显示逻辑**
// **Validates: Requirements 3.1, 3.4**

describe('Retry Button Display Logic Property Tests', () => {
  const classifier = new ErrorClassifier()
  const errorHandler = new ErrorHandlerAPI()

  it('Property 6: Retry button display logic - should show retry button if and only if error is retryable', async () => {
    await fc.assert(
      fc.property(
        fc.oneof(
          // 可重试错误生成器 (网络、超时、服务器错误)
          fc.record({
            message: fc.oneof(
              fc.constant('网络连接失败'),
              fc.constant('fetch failed'),
              fc.constant('NetworkError'),
              fc.constant('timeout'),
              fc.constant('超时'),
              fc.constant('server error'),
              fc.constant('服务器错误'),
              fc.constant('internal server error'),
              fc.constant('service unavailable')
            ),
            code: fc.option(fc.constantFrom('NETWORK_ERROR', 'TIMEOUT', '500', '503'))
          }),
          // 不可重试错误生成器 (权限、验证、客户端错误)
          fc.record({
            message: fc.oneof(
              fc.constant('permission denied'),
              fc.constant('权限不足'),
              fc.constant('unauthorized'),
              fc.constant('forbidden'),
              fc.constant('validation failed'),
              fc.constant('验证失败'),
              fc.constant('invalid input'),
              fc.constant('ReferenceError: undefined is not defined'),
              fc.constant('TypeError: Cannot read property'),
              fc.constant('客户端错误')
            ),
            code: fc.option(fc.constantFrom('42501', 'PERMISSION_DENIED', 'VALIDATION_ERROR', 'CLIENT_ERROR'))
          }),
          // 未知错误
          fc.record({
            message: fc.oneof(
              fc.constant('unknown error'),
              fc.constant('未知错误'),
              fc.constant('something went wrong')
            )
          }),
          // null/undefined 错误
          fc.constantFrom(null, undefined, '')
        ),
        fc.record({
          operation: fc.string({ minLength: 1, maxLength: 50 }),
          component: fc.string({ minLength: 1, maxLength: 50 }),
          userId: fc.option(fc.string({ minLength: 1, maxLength: 36 })),
          additionalData: fc.option(fc.dictionary(fc.string(), fc.anything()))
        }),
        (errorInput, context) => {
          // 处理错误并获取响应
          const errorResponse = errorHandler.handleError(errorInput, context)
          
          // 验证错误响应的基本结构
          expect(errorResponse).toHaveProperty('id')
          expect(errorResponse).toHaveProperty('type')
          expect(errorResponse).toHaveProperty('message')
          expect(errorResponse).toHaveProperty('canRetry')
          expect(errorResponse).toHaveProperty('severity')
          
          // 验证 canRetry 是布尔值
          expect(typeof errorResponse.canRetry).toBe('boolean')
          
          // 获取错误分类以验证一致性
          const classification = classifier.classifyError(errorInput)
          
          // 核心属性：重试按钮显示逻辑
          // canRetry 应该与错误分类器的 isRetryable 结果一致
          expect(errorResponse.canRetry).toBe(classification.isRetryable)
          
          // 验证特定错误类型的重试逻辑
          if (classification.type === ErrorType.NETWORK || 
              classification.type === ErrorType.TIMEOUT || 
              classification.type === ErrorType.SERVER) {
            // 网络、超时、服务器错误应该可重试
            expect(errorResponse.canRetry).toBe(true)
          }
          
          if (classification.type === ErrorType.PERMISSION || 
              classification.type === ErrorType.VALIDATION || 
              classification.type === ErrorType.CLIENT) {
            // 权限、验证、客户端错误应该不可重试
            expect(errorResponse.canRetry).toBe(false)
          }
          
          if (classification.type === ErrorType.UNKNOWN) {
            // 未知错误通常不可重试
            expect(errorResponse.canRetry).toBe(false)
          }
          
          // 验证错误ID的生成
          expect(errorResponse.id).toMatch(/^[a-z]+-[a-zA-Z0-9_-]+-[a-zA-Z0-9_-]+-\d+$/)
          
          // 验证错误类型一致性
          expect(errorResponse.type).toBe(classification.type)
          
          // 验证严重程度一致性
          expect(errorResponse.severity).toBe(classification.severity)
          
          // 验证消息不为空
          expect(errorResponse.message).toBeTruthy()
          expect(typeof errorResponse.message).toBe('string')
          expect(errorResponse.message.length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 6.1: Retry button consistency - same error should always have same retry capability', async () => {
    await fc.assert(
      fc.property(
        fc.oneof(
          fc.record({
            message: fc.string({ minLength: 1, maxLength: 100 }),
            code: fc.option(fc.string({ minLength: 1, maxLength: 20 }))
          }),
          fc.constantFrom(null, undefined),
          fc.string({ maxLength: 200 })
        ),
        fc.record({
          operation: fc.string({ minLength: 1, maxLength: 50 }),
          component: fc.string({ minLength: 1, maxLength: 50 })
        }),
        (errorInput, context) => {
          // 多次处理相同错误应该返回相同的重试能力
          const response1 = errorHandler.handleError(errorInput, context)
          const response2 = errorHandler.handleError(errorInput, context)
          const response3 = errorHandler.handleError(errorInput, context)
          
          expect(response1.canRetry).toBe(response2.canRetry)
          expect(response1.canRetry).toBe(response3.canRetry)
          
          expect(response1.type).toBe(response2.type)
          expect(response1.type).toBe(response3.type)
          
          expect(response1.severity).toBe(response2.severity)
          expect(response1.severity).toBe(response3.severity)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 6.2: Retry button display completeness - all errors should have defined retry capability', async () => {
    await fc.assert(
      fc.property(
        fc.anything(),
        fc.record({
          operation: fc.string({ minLength: 1, maxLength: 50 }),
          component: fc.string({ minLength: 1, maxLength: 50 })
        }),
        (errorInput, context) => {
          // 任何错误都应该有明确定义的重试能力，不应该抛出异常
          expect(() => {
            const response = errorHandler.handleError(errorInput, context)
            
            // canRetry 应该总是被定义为布尔值
            expect(typeof response.canRetry).toBe('boolean')
            expect(response.canRetry === true || response.canRetry === false).toBe(true)
            
          }).not.toThrow()
        }
      ),
      { numRuns: 100 }
    )
  })
})