import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { ErrorClassifier, ErrorType, MessageSeverity } from './errorHandler'

// **Feature: error-message-enhancement, Property 10: 错误分类准确性**
// **Validates: Requirements 4.1**

describe('ErrorClassifier Property Tests', () => {
  const classifier = new ErrorClassifier()

  it('Property 10: Error classification accuracy - should correctly classify all error types and return appropriate handling strategies', async () => {
    await fc.assert(
      fc.property(
        fc.oneof(
          // 网络错误生成器
          fc.record({
            message: fc.oneof(
              fc.constant('网络连接失败'),
              fc.constant('fetch failed'),
              fc.constant('NetworkError'),
              fc.constant('Failed to fetch')
            ),
            code: fc.option(fc.constantFrom('NETWORK_ERROR'))
          }),
          // 权限错误生成器
          fc.record({
            message: fc.oneof(
              fc.constant('permission denied'),
              fc.constant('权限不足'),
              fc.constant('unauthorized'),
              fc.constant('forbidden')
            ),
            code: fc.option(fc.constantFrom('42501', 'PERMISSION_DENIED'))
          }),
          // 验证错误生成器
          fc.record({
            message: fc.oneof(
              fc.constant('validation failed'),
              fc.constant('验证失败'),
              fc.constant('invalid input'),
              fc.constant('required field missing'),
              fc.constant('格式错误')
            ),
            code: fc.option(fc.constant('VALIDATION_ERROR'))
          }),
          // 超时错误生成器
          fc.record({
            message: fc.oneof(
              fc.constant('timeout'),
              fc.constant('超时'),
              fc.constant('连接超时'),
              fc.constant('timed out')
            ),
            code: fc.option(fc.constant('TIMEOUT'))
          }),
          // 服务器错误生成器
          fc.record({
            message: fc.oneof(
              fc.constant('server error'),
              fc.constant('服务器错误'),
              fc.constant('internal server error'),
              fc.constant('service unavailable')
            ),
            code: fc.option(fc.constantFrom('500', '503'))
          }),
          // 客户端错误生成器
          fc.record({
            message: fc.oneof(
              fc.constant('ReferenceError: undefined is not defined'),
              fc.constant('TypeError: Cannot read property'),
              fc.constant('SyntaxError: Unexpected token'),
              fc.constant('客户端错误')
            ),
            code: fc.option(fc.constant('CLIENT_ERROR'))
          }),
          // 未知错误生成器
          fc.record({
            message: fc.oneof(
              fc.constant('unknown error'),
              fc.constant('未知错误'),
              fc.constant('something went wrong')
            ),
            code: fc.option(fc.constant('UNKNOWN'))
          }),
          // null/undefined 错误
          fc.constantFrom(null, undefined, ''),
          // 复杂错误对象
          fc.record({
            message: fc.string({ minLength: 1, maxLength: 100 }),
            code: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
            stack: fc.option(fc.string({ maxLength: 500 })),
            name: fc.option(fc.string({ minLength: 1, maxLength: 50 }))
          })
        ),
        (errorInput) => {
          // 测试错误分类
          const classification = classifier.classifyError(errorInput)
          
          // 验证分类结果的基本结构
          expect(classification).toHaveProperty('type')
          expect(classification).toHaveProperty('category')
          expect(classification).toHaveProperty('isRetryable')
          expect(classification).toHaveProperty('severity')
          expect(classification).toHaveProperty('originalError')
          
          // 验证错误类型是有效的枚举值
          expect(Object.values(ErrorType)).toContain(classification.type)
          
          // 验证严重程度是有效的枚举值
          expect(Object.values(MessageSeverity)).toContain(classification.severity)
          expect(Object.values(MessageSeverity)).toContain(classification.category)
          
          // 验证原始错误被保留
          expect(classification.originalError).toBe(errorInput)
          
          // 验证 isRetryable 是布尔值
          expect(typeof classification.isRetryable).toBe('boolean')
          
          // 测试 isRetryable 方法的一致性
          const isRetryableResult = classifier.isRetryable(errorInput)
          expect(isRetryableResult).toBe(classification.isRetryable)
          
          // 测试 getSeverity 方法的一致性
          const severityResult = classifier.getSeverity(errorInput)
          expect(severityResult).toBe(classification.severity)
          
          // 验证特定错误类型的分类逻辑
          if (errorInput && typeof errorInput === 'object' && 'message' in errorInput) {
            const message = errorInput.message || ''
            
            // 网络错误应该被正确分类 (但不包含超时相关的词)
            if ((message.includes('网络') || message.includes('fetch') || message.includes('NetworkError') || message.includes('Failed to fetch')) &&
                !message.includes('timeout') && !message.includes('超时') && !message.includes('timed out')) {
              expect(classification.type).toBe(ErrorType.NETWORK)
              expect(classification.isRetryable).toBe(true)
            }
            
            // 权限错误应该被正确分类
            if (message.includes('permission') || message.includes('权限') || 
                message.includes('unauthorized') || message.includes('forbidden')) {
              expect(classification.type).toBe(ErrorType.PERMISSION)
              expect(classification.isRetryable).toBe(false)
              expect(classification.severity).toBe(MessageSeverity.FATAL)
            }
            
            // 验证错误应该被正确分类
            if (message.includes('validation') || message.includes('验证') || 
                message.includes('invalid') || message.includes('required') || message.includes('格式')) {
              expect(classification.type).toBe(ErrorType.VALIDATION)
              expect(classification.isRetryable).toBe(false)
            }
            
            // 超时错误应该被正确分类 (优先级高于网络错误)
            if (message.includes('timeout') || message.includes('超时') || message.includes('timed out')) {
              expect(classification.type).toBe(ErrorType.TIMEOUT)
              expect(classification.isRetryable).toBe(true)
            }
            
            // 服务器错误应该被正确分类
            if (message.includes('server') || message.includes('服务器') || 
                message.includes('internal server error') || message.includes('service unavailable')) {
              expect(classification.type).toBe(ErrorType.SERVER)
              expect(classification.isRetryable).toBe(true)
              expect(classification.severity).toBe(MessageSeverity.FATAL)
            }
            
            // 客户端错误应该被正确分类
            if (message.includes('ReferenceError') || message.includes('TypeError') || 
                message.includes('SyntaxError') || message.includes('客户端')) {
              expect(classification.type).toBe(ErrorType.CLIENT)
              expect(classification.isRetryable).toBe(false)
              expect(classification.severity).toBe(MessageSeverity.FATAL)
            }
          }
          
          // null/undefined 错误应该被分类为 UNKNOWN
          if (!errorInput || errorInput === '') {
            expect(classification.type).toBe(ErrorType.UNKNOWN)
            expect(classification.isRetryable).toBe(false)
          }
          
          // 验证重试逻辑的一致性：网络、超时、服务器错误应该可重试
          if ([ErrorType.NETWORK, ErrorType.TIMEOUT, ErrorType.SERVER].includes(classification.type)) {
            expect(classification.isRetryable).toBe(true)
          }
          
          // 验证严重程度逻辑：权限、服务器、客户端错误应该是致命的
          if ([ErrorType.PERMISSION, ErrorType.SERVER, ErrorType.CLIENT].includes(classification.type)) {
            expect(classification.severity).toBe(MessageSeverity.FATAL)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 10.1: Error classification consistency - multiple calls with same input should return identical results', async () => {
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
        (errorInput) => {
          // 多次调用应该返回相同的结果
          const classification1 = classifier.classifyError(errorInput)
          const classification2 = classifier.classifyError(errorInput)
          const classification3 = classifier.classifyError(errorInput)
          
          expect(classification1.type).toBe(classification2.type)
          expect(classification1.type).toBe(classification3.type)
          
          expect(classification1.isRetryable).toBe(classification2.isRetryable)
          expect(classification1.isRetryable).toBe(classification3.isRetryable)
          
          expect(classification1.severity).toBe(classification2.severity)
          expect(classification1.severity).toBe(classification3.severity)
          
          expect(classification1.category).toBe(classification2.category)
          expect(classification1.category).toBe(classification3.category)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 10.2: Error classification completeness - all inputs should be classifiable', async () => {
    await fc.assert(
      fc.property(
        fc.anything(),
        (errorInput) => {
          // 任何输入都应该能够被分类，不应该抛出异常
          expect(() => {
            const classification = classifier.classifyError(errorInput)
            
            // 分类结果应该总是有效的
            expect(classification).toBeDefined()
            expect(classification.type).toBeDefined()
            expect(classification.severity).toBeDefined()
            expect(classification.category).toBeDefined()
            expect(typeof classification.isRetryable).toBe('boolean')
            
          }).not.toThrow()
        }
      ),
      { numRuns: 100 }
    )
  })
})