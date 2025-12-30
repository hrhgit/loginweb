/**
 * **Feature: error-message-enhancement, Property 13: 错误日志记录**
 * **验证需求: 4.4**
 * 
 * 对于任何错误，详细的技术错误信息应该被记录到控制台用于调试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import fc from 'fast-check'
import { ErrorHandlerAPI, ErrorContext, ErrorType } from '../utils/errorHandler'

describe('Property Test: Error Logging', () => {
  let errorHandler: ErrorHandlerAPI
  let consoleSpy: any

  beforeEach(() => {
    errorHandler = new ErrorHandlerAPI()
    // 监听 console.error 调用
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('should log detailed error information to console for any error', () => {
    fc.assert(fc.property(
      // 生成各种类型的错误对象
      fc.oneof(
        // 标准错误对象
        fc.record({
          message: fc.string({ minLength: 1, maxLength: 100 }),
          code: fc.oneof(
            fc.constant('NETWORK_ERROR'),
            fc.constant('PERMISSION_DENIED'),
            fc.constant('VALIDATION_ERROR'),
            fc.constant('SERVER_ERROR'),
            fc.constant('TIMEOUT')
          ),
          stack: fc.option(fc.string({ minLength: 10, maxLength: 200 }))
        }),
        // 字符串错误
        fc.string({ minLength: 1, maxLength: 100 }),
        // 复杂错误对象
        fc.record({
          name: fc.constant('CustomError'),
          message: fc.string({ minLength: 1, maxLength: 100 }),
          details: fc.record({
            userId: fc.uuid(),
            timestamp: fc.date().map(d => d.toISOString())
          })
        }),
        // 空值错误
        fc.constant(null),
        fc.constant(undefined)
      ),
      // 生成上下文信息
      fc.option(fc.record({
        operation: fc.oneof(
          fc.constant('login'),
          fc.constant('save'),
          fc.constant('upload'),
          fc.constant('delete'),
          fc.constant('fetch')
        ),
        component: fc.oneof(
          fc.constant('auth'),
          fc.constant('form'),
          fc.constant('api'),
          fc.constant('storage'),
          fc.constant('ui')
        ),
        userId: fc.option(fc.uuid()),
        additionalData: fc.option(fc.record({
          eventId: fc.uuid(),
          sessionId: fc.string({ minLength: 10, maxLength: 20 })
        }))
      })),
      (error, context) => {
        // 清除之前的调用记录
        consoleSpy.mockClear()
        
        // 处理错误
        const response = errorHandler.handleError(error, context)
        
        // 验证 console.error 被调用
        expect(consoleSpy).toHaveBeenCalled()
        expect(consoleSpy).toHaveBeenCalledTimes(1)
        
        // 获取日志调用的参数
        const logCall = consoleSpy.mock.calls[0]
        expect(logCall).toBeDefined()
        expect(logCall.length).toBeGreaterThan(0)
        
        // 验证日志消息包含预期的信息
        const logMessage = logCall[0]
        expect(logMessage).toContain('Error handled by ErrorHandlerAPI')
        
        // 验证日志数据包含错误信息
        const logData = logCall[1]
        expect(logData).toBeDefined()
        expect(typeof logData).toBe('object')
        
        // 验证日志数据结构
        expect(logData).toHaveProperty('error')
        expect(logData).toHaveProperty('timestamp')
        expect(logData).toHaveProperty('userAgent')
        
        // 如果有上下文，验证上下文被记录
        if (context) {
          expect(logData).toHaveProperty('context')
          expect(logData.context).toEqual(context)
        }
        
        // 验证时间戳格式
        expect(logData.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
        
        // 验证用户代理信息存在
        expect(typeof logData.userAgent).toBe('string')
        expect(logData.userAgent.length).toBeGreaterThan(0)
        
        // 验证响应结构完整性
        expect(response.id).toBeDefined()
        expect(response.type).toBeDefined()
        expect(response.message).toBeDefined()
        expect(typeof response.canRetry).toBe('boolean')
        expect(response.severity).toBeDefined()
        expect(Array.isArray(response.suggestions)).toBe(true)
      }
    ), { numRuns: 100 })
  })

  it('should log classification information when available', () => {
    fc.assert(fc.property(
      // 生成可分类的错误
      fc.record({
        message: fc.oneof(
          fc.constant('Network connection failed'),
          fc.constant('Permission denied'),
          fc.constant('Validation failed'),
          fc.constant('Server error occurred')
        ),
        code: fc.oneof(
          fc.constant('NETWORK_ERROR'),
          fc.constant('PERMISSION_DENIED'),
          fc.constant('VALIDATION_ERROR'),
          fc.constant('SERVER_ERROR')
        )
      }),
      // 生成上下文
      fc.record({
        operation: fc.oneof(
          fc.constant('api_call'),
          fc.constant('user_action'),
          fc.constant('background_task')
        ),
        component: fc.oneof(
          fc.constant('network'),
          fc.constant('auth'),
          fc.constant('validation')
        )
      }),
      (error, context) => {
        consoleSpy.mockClear()
        
        const response = errorHandler.handleError(error, context)
        
        // 验证日志被记录
        expect(consoleSpy).toHaveBeenCalled()
        
        const logData = consoleSpy.mock.calls[0][1]
        
        // 验证分类信息被记录
        expect(logData).toHaveProperty('classification')
        expect(logData.classification).toBeDefined()
        expect(typeof logData.classification).toBe('object')
        
        // 验证分类信息结构
        expect(logData.classification).toHaveProperty('type')
        expect(logData.classification).toHaveProperty('category')
        expect(logData.classification).toHaveProperty('isRetryable')
        expect(logData.classification).toHaveProperty('severity')
        expect(logData.classification).toHaveProperty('originalError')
        
        // 验证分类类型是有效的
        const validTypes = ['network', 'permission', 'validation', 'timeout', 'server', 'client', 'unknown']
        expect(validTypes).toContain(logData.classification.type)
        
        // 验证严重程度是有效的
        const validSeverities = ['fatal', 'warning', 'info', 'success']
        expect(validSeverities).toContain(logData.classification.severity)
        
        // 验证可重试标志是布尔值
        expect(typeof logData.classification.isRetryable).toBe('boolean')
      }
    ), { numRuns: 100 })
  })

  it('should handle logging of complex error objects safely', () => {
    fc.assert(fc.property(
      // 生成复杂的错误对象
      fc.oneof(
        // 循环引用对象（模拟）
        fc.record({
          message: fc.string({ minLength: 1, maxLength: 50 }),
          nested: fc.record({
            deep: fc.record({
              value: fc.string({ minLength: 1, maxLength: 20 })
            })
          })
        }),
        // 包含函数的对象
        fc.record({
          message: fc.string({ minLength: 1, maxLength: 50 }),
          toString: fc.constant(() => 'Custom toString'),
          valueOf: fc.constant(() => 42)
        }),
        // 大型对象
        fc.record({
          message: fc.string({ minLength: 1, maxLength: 50 }),
          data: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 5, maxLength: 20 }),
          metadata: fc.record({
            timestamp: fc.date().map(d => d.toISOString()),
            source: fc.string({ minLength: 5, maxLength: 15 }),
            level: fc.integer({ min: 1, max: 5 })
          })
        })
      ),
      (error) => {
        consoleSpy.mockClear()
        
        // 这应该不会抛出异常，即使错误对象很复杂
        expect(() => {
          errorHandler.handleError(error)
        }).not.toThrow()
        
        // 验证日志仍然被记录
        expect(consoleSpy).toHaveBeenCalled()
        
        const logData = consoleSpy.mock.calls[0][1]
        
        // 验证基本结构仍然存在
        expect(logData).toHaveProperty('error')
        expect(logData).toHaveProperty('timestamp')
        expect(logData).toHaveProperty('userAgent')
        
        // 验证错误对象被安全地记录（不会导致序列化错误）
        expect(logData.error).toBeDefined()
      }
    ), { numRuns: 100 })
  })

  it('should log unique timestamps for concurrent errors', () => {
    fc.assert(fc.property(
      // 生成多个错误
      fc.array(
        fc.record({
          message: fc.string({ minLength: 1, maxLength: 50 }),
          code: fc.oneof(
            fc.constant('ERROR_1'),
            fc.constant('ERROR_2'),
            fc.constant('ERROR_3')
          )
        }),
        { minLength: 2, maxLength: 5 }
      ),
      (errors) => {
        consoleSpy.mockClear()
        
        // 快速连续处理多个错误
        const responses = errors.map(error => errorHandler.handleError(error))
        
        // 验证每个错误都被记录
        expect(consoleSpy).toHaveBeenCalledTimes(errors.length)
        
        // 收集所有时间戳
        const timestamps = consoleSpy.mock.calls.map(call => call[1].timestamp)
        
        // 验证所有时间戳都是有效的ISO字符串
        timestamps.forEach(timestamp => {
          expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
          expect(new Date(timestamp).getTime()).toBeGreaterThan(0)
        })
        
        // 验证时间戳是递增的（或至少不递减）
        for (let i = 1; i < timestamps.length; i++) {
          const prevTime = new Date(timestamps[i - 1]).getTime()
          const currTime = new Date(timestamps[i]).getTime()
          expect(currTime).toBeGreaterThanOrEqual(prevTime)
        }
        
        // 验证所有响应都有效
        responses.forEach(response => {
          expect(response.id).toBeDefined()
          expect(response.message).toBeDefined()
          expect(typeof response.canRetry).toBe('boolean')
        })
      }
    ), { numRuns: 100 })
  })
})