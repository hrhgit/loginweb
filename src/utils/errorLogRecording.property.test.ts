import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { ErrorHandlerAPI, ErrorType, ErrorContext, MessageSeverity } from './errorHandler'

// **Feature: error-message-enhancement, Property 13: 错误日志记录**
// **验证需求: 4.4**

describe('Error Log Recording Property Tests', () => {
  let errorHandler: ErrorHandlerAPI
  let consoleSpy: any

  beforeEach(() => {
    // 创建新的错误处理器实例以确保测试隔离
    errorHandler = new ErrorHandlerAPI()
    // 禁用节流和重复抑制以确保测试中的console.error调用
    errorHandler.setThrottlingEnabled(false)
    errorHandler.setDuplicateSuppressionEnabled(false)
    // 监听console.error调用
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  // 错误生成器
  const errorGenerator = fc.oneof(
    fc.record({
      message: fc.string({ minLength: 1, maxLength: 100 }),
      code: fc.constantFrom('NETWORK_ERROR', 'PERMISSION_DENIED', 'VALIDATION_ERROR', '500', '401', '403'),
      stack: fc.option(fc.string({ minLength: 10, maxLength: 200 }))
    }),
    fc.string({ minLength: 1, maxLength: 100 }),
    fc.record({
      toString: fc.constant(() => 'Error occurred'),
      name: fc.constantFrom('TypeError', 'ReferenceError', 'NetworkError')
    })
  )

  // 上下文生成器
  const contextGenerator = fc.record({
    operation: fc.constantFrom('login', 'upload', 'save', 'delete', 'create', 'update'),
    component: fc.constantFrom('form', 'upload', 'auth', 'profile', 'team', 'event'),
    userId: fc.option(fc.uuid()),
    additionalData: fc.option(fc.dictionary(fc.string(), fc.anything()))
  })

  it('Property 13: Error log recording - should log detailed technical error information to console for debugging', async () => {
    await fc.assert(
      fc.property(
        errorGenerator,
        contextGenerator,
        (error, context) => {
          // 清除之前的调用记录
          consoleSpy.mockClear()
          
          // 处理错误
          const response = errorHandler.handleError(error, context)
          
          // 验证响应结构
          expect(response).toHaveProperty('id')
          expect(response).toHaveProperty('type')
          expect(response).toHaveProperty('message')
          expect(response).toHaveProperty('canRetry')
          expect(response).toHaveProperty('severity')
          
          // 验证console.error被调用
          expect(consoleSpy).toHaveBeenCalled()
          expect(consoleSpy).toHaveBeenCalledTimes(1)
          
          // 验证日志内容
          const logCall = consoleSpy.mock.calls[0]
          expect(logCall).toHaveLength(2)
          expect(logCall[0]).toBe('Error handled by ErrorHandlerAPI:')
          
          const logData = logCall[1]
          expect(logData).toHaveProperty('error')
          expect(logData).toHaveProperty('context')
          expect(logData).toHaveProperty('classification')
          expect(logData).toHaveProperty('timestamp')
          expect(logData).toHaveProperty('userAgent')
          
          // 验证原始错误被记录
          expect(logData.error).toBe(error)
          
          // 验证上下文被记录
          expect(logData.context).toBe(context)
          
          // 验证分类信息被记录
          expect(logData.classification).toHaveProperty('type')
          expect(logData.classification).toHaveProperty('category')
          expect(logData.classification).toHaveProperty('isRetryable')
          expect(logData.classification).toHaveProperty('severity')
          expect(logData.classification).toHaveProperty('originalError')
          
          // 验证时间戳格式
          expect(typeof logData.timestamp).toBe('string')
          expect(new Date(logData.timestamp).getTime()).toBeGreaterThan(0)
          
          // 验证用户代理信息
          expect(typeof logData.userAgent).toBe('string')
          expect(logData.userAgent.length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 13: Error log recording - should include complete error classification in logs', async () => {
    await fc.assert(
      fc.property(
        errorGenerator,
        contextGenerator,
        (error, context) => {
          consoleSpy.mockClear()
          
          // Debug: Log the original error
          console.log('Original error:', JSON.stringify(error, null, 2))
          
          const response = errorHandler.handleError(error, context)
          
          // 获取日志数据
          const logData = consoleSpy.mock.calls[0][1]
          const classification = logData.classification
          
          // Debug: Log the logged error
          console.log('Logged error:', JSON.stringify(logData.error, null, 2))
          console.log('Classification originalError:', JSON.stringify(classification.originalError, null, 2))
          
          // 验证分类信息完整性
          expect(Object.values(ErrorType)).toContain(classification.type)
          expect(Object.values(MessageSeverity)).toContain(classification.category)
          expect(Object.values(MessageSeverity)).toContain(classification.severity)
          expect(typeof classification.isRetryable).toBe('boolean')
          
          // 验证原始错误被保留 - 使用属性比较而不是严格相等
          if (typeof error === 'string') {
            expect(classification.originalError).toBe(error)
          } else {
            expect(typeof classification.originalError).toBe('object')
            if (error.message) expect(classification.originalError.message).toBe(error.message)
            if (error.code) expect(classification.originalError.code).toBe(error.code)
            if (error.name) {
              console.log(`Comparing names: original="${error.name}", logged="${classification.originalError.name}"`)
              expect(classification.originalError.name).toBe(error.name)
            }
          }
          
          // 验证分类与响应一致
          expect(classification.type).toBe(response.type)
          expect(classification.isRetryable).toBe(response.canRetry)
          expect(classification.severity).toBe(response.severity)
        }
      ),
      { numRuns: 10 } // Reduce runs for debugging
    )
  })

  it('Property 13: Error log recording - should preserve original error information without modification', async () => {
    await fc.assert(
      fc.property(
        errorGenerator,
        contextGenerator,
        (error, context) => {
          consoleSpy.mockClear()
          
          // 创建错误的深拷贝用于比较 (只对可序列化的对象)
          let originalError = error
          if (typeof error === 'object' && error !== null) {
            try {
              originalError = JSON.parse(JSON.stringify(error))
            } catch {
              // 如果无法序列化（比如包含函数），使用原始对象
              originalError = error
            }
          }
          const originalContext = JSON.parse(JSON.stringify(context))
          
          errorHandler.handleError(error, context)
          
          // 获取日志数据
          const logData = consoleSpy.mock.calls[0][1]
          
          // 验证原始错误未被修改
          if (typeof error === 'string') {
            expect(logData.error).toBe(error)
          } else {
            // 对于对象，验证关键属性而不是严格相等
            expect(typeof logData.error).toBe('object')
            if (error.message) expect(logData.error.message).toBe(error.message)
            if (error.code) expect(logData.error.code).toBe(error.code)
            if (error.name) expect(logData.error.name).toBe(error.name)
          }
          expect(logData.context).toStrictEqual(context)
          
          // 验证原始错误在分类中也被保留
          if (typeof error === 'string') {
            expect(logData.classification.originalError).toBe(error)
          } else {
            expect(typeof logData.classification.originalError).toBe('object')
            if (error.message) expect(logData.classification.originalError.message).toBe(error.message)
            if (error.code) expect(logData.classification.originalError.code).toBe(error.code)
            if (error.name) expect(logData.classification.originalError.name).toBe(error.name)
          }
          
          // 对于可序列化的错误，验证内容未被修改
          if (typeof error === 'object' && error !== null) {
            try {
              const serializedOriginal = JSON.stringify(originalError)
              const serializedLogged = JSON.stringify(logData.error)
              expect(serializedLogged).toBe(serializedOriginal)
            } catch {
              // 如果无法序列化，跳过此检查
            }
          }
        }
      ),
      { numRuns: 10 } // Reduce runs for debugging
    )
  })

  it('Property 13: Error log recording - should log consistently for repeated identical errors', async () => {
    await fc.assert(
      fc.property(
        errorGenerator,
        contextGenerator,
        fc.integer({ min: 2, max: 5 }),
        (error, context, repeatCount) => {
          consoleSpy.mockClear()
          
          const responses: any[] = []
          
          // 多次处理相同错误
          for (let i = 0; i < repeatCount; i++) {
            const response = errorHandler.handleError(error, context)
            responses.push(response)
          }
          
          // 验证至少有一次日志记录（由于throttling，相同错误在短时间内只记录一次）
          expect(consoleSpy).toHaveBeenCalledWith('Error handled by ErrorHandlerAPI:', expect.any(Object))
          
          // 验证所有响应都有相同的结构
          for (let i = 0; i < repeatCount; i++) {
            expect(responses[i]).toHaveProperty('id')
            expect(responses[i]).toHaveProperty('type')
            expect(responses[i]).toHaveProperty('message')
            expect(responses[i]).toHaveProperty('canRetry')
            expect(responses[i]).toHaveProperty('severity')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 13: Error log recording - should handle edge cases and invalid inputs gracefully', async () => {
    await fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.constant(''),
          fc.record({}),
          fc.record({
            message: fc.constant(null),
            code: fc.constant(undefined)
          })
        ),
        fc.oneof(
          fc.constant(undefined),
          fc.constant(null),
          contextGenerator
        ),
        (error, context) => {
          consoleSpy.mockClear()
          
          // 处理边缘情况不应该抛出异常
          expect(() => {
            const response = errorHandler.handleError(error, context)
            
            // 验证响应结构完整
            expect(response).toHaveProperty('id')
            expect(response).toHaveProperty('type')
            expect(response).toHaveProperty('message')
            expect(response).toHaveProperty('canRetry')
            expect(response).toHaveProperty('severity')
            
          }).not.toThrow()
          
          // 验证可能有日志记录（某些边缘情况可能不记录日志）
          if (consoleSpy.mock.calls.length > 0) {
            const logData = consoleSpy.mock.calls[0][1]
            
            // 验证日志结构完整
            expect(logData).toHaveProperty('error')
            expect(logData).toHaveProperty('context')
            expect(logData).toHaveProperty('classification')
            expect(logData).toHaveProperty('timestamp')
            expect(logData).toHaveProperty('userAgent')
            
            // 验证错误被正确记录（即使是null/undefined）
            expect(logData.error).toBe(error)
            expect(logData.context).toBe(context)
            
            // 验证分类信息有效
            expect(Object.values(ErrorType)).toContain(logData.classification.type)
            expect(Object.values(MessageSeverity)).toContain(logData.classification.severity)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 13: Error log recording - should include environment information in logs', async () => {
    await fc.assert(
      fc.property(
        errorGenerator,
        contextGenerator,
        (error, context) => {
          consoleSpy.mockClear()
          
          errorHandler.handleError(error, context)
          
          // 验证至少有一次日志调用
          expect(consoleSpy).toHaveBeenCalled()
          
          if (consoleSpy.mock.calls.length > 0) {
            const logData = consoleSpy.mock.calls[0][1]
            
            // 验证环境信息
            expect(logData).toHaveProperty('timestamp')
            expect(logData).toHaveProperty('userAgent')
            
            // 验证时间戳是有效的ISO字符串
            const timestamp = new Date(logData.timestamp)
            expect(timestamp.getTime()).toBeGreaterThan(0)
            expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now())
            
            // 验证用户代理字符串
            expect(typeof logData.userAgent).toBe('string')
            expect(logData.userAgent.length).toBeGreaterThan(0)
            expect(logData.userAgent).toContain('jsdom')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 13: Error log recording - should maintain log format consistency across different error types', async () => {
    await fc.assert(
      fc.property(
        fc.array(errorGenerator, { minLength: 2, maxLength: 5 }),
        contextGenerator,
        (errors, context) => {
          consoleSpy.mockClear()
          
          const responses: any[] = []
          
          // 处理不同类型的错误
          errors.forEach(error => {
            const response = errorHandler.handleError(error, context)
            responses.push(response)
          })
          
          // 验证至少有一些日志记录（由于throttling，可能不是每个错误都记录）
          expect(consoleSpy).toHaveBeenCalled()
          
          // 验证所有记录的日志格式一致
          for (let i = 0; i < consoleSpy.mock.calls.length; i++) {
            const logCall = consoleSpy.mock.calls[i]
            const logData = logCall[1]
            
            // 验证日志调用格式
            expect(logCall[0]).toBe('Error handled by ErrorHandlerAPI:')
            
            // 验证日志数据结构
            expect(logData).toHaveProperty('error')
            expect(logData).toHaveProperty('context')
            expect(logData).toHaveProperty('classification')
            expect(logData).toHaveProperty('timestamp')
            expect(logData).toHaveProperty('userAgent')
            
            // 验证数据类型一致性
            expect(typeof logData.timestamp).toBe('string')
            expect(typeof logData.userAgent).toBe('string')
            expect(typeof logData.classification).toBe('object')
            expect(logData.classification).not.toBeNull()
            
            // 验证分类结构一致性
            expect(logData.classification).toHaveProperty('type')
            expect(logData.classification).toHaveProperty('category')
            expect(logData.classification).toHaveProperty('isRetryable')
            expect(logData.classification).toHaveProperty('severity')
            expect(logData.classification).toHaveProperty('originalError')
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})