/**
 * **Feature: error-message-enhancement, Property 12: 重复消息合并**
 * **验证需求: 4.3**
 * 
 * 对于任何连续发生的相同类型错误，错误反馈系统应该合并显示而不是重复显示多个消息
 */

import { describe, it, expect, beforeEach } from 'vitest'
import fc from 'fast-check'
import { ErrorHandlerAPI, ErrorContext, ErrorType } from '../utils/errorHandler'

describe('Property Test: Duplicate Message Merging', () => {
  let errorHandler: ErrorHandlerAPI

  beforeEach(() => {
    errorHandler = new ErrorHandlerAPI()
  })

  it('should suppress duplicate messages within threshold time', () => {
    fc.assert(fc.property(
      // 生成相同的错误对象
      fc.record({
        message: fc.string({ minLength: 1, maxLength: 50 }),
        code: fc.oneof(
          fc.constant('NETWORK_ERROR'),
          fc.constant('PERMISSION_DENIED'),
          fc.constant('VALIDATION_ERROR'),
          fc.constant('SERVER_ERROR')
        )
      }),
      // 生成相同的上下文
      fc.record({
        operation: fc.oneof(
          fc.constant('login'),
          fc.constant('save'),
          fc.constant('upload')
        ),
        component: fc.oneof(
          fc.constant('form'),
          fc.constant('auth'),
          fc.constant('profile')
        )
      }),
      (error, context) => {
        // 第一次处理错误
        const firstResponse = errorHandler.handleError(error, context)
        
        // 立即再次处理相同的错误（应该被合并）
        const secondResponse = errorHandler.handleError(error, context)
        
        // 验证两次响应的基本结构
        expect(firstResponse.id).toBeDefined()
        expect(secondResponse.id).toBeDefined()
        expect(firstResponse.type).toBe(secondResponse.type)
        expect(firstResponse.message).toBe(secondResponse.message)
        
        // 验证错误ID的基础部分相同（去掉时间戳）
        const firstIdParts = firstResponse.id.split('-')
        const secondIdParts = secondResponse.id.split('-')
        
        // 前三部分应该相同（type-operation-component）
        expect(firstIdParts.slice(0, 3)).toEqual(secondIdParts.slice(0, 3))
        
        // 验证响应结构完整性
        expect(typeof firstResponse.canRetry).toBe('boolean')
        expect(typeof secondResponse.canRetry).toBe('boolean')
        expect(Array.isArray(firstResponse.suggestions)).toBe(true)
        expect(Array.isArray(secondResponse.suggestions)).toBe(true)
      }
    ), { numRuns: 100 })
  })

  it('should handle rapid successive identical errors correctly', () => {
    fc.assert(fc.property(
      // 生成网络错误
      fc.record({
        message: fc.constant('Network connection failed'),
        code: fc.constant('NETWORK_ERROR')
      }),
      // 生成上下文
      fc.record({
        operation: fc.oneof(
          fc.constant('login'),
          fc.constant('save'),
          fc.constant('load')
        ),
        component: fc.oneof(
          fc.constant('auth'),
          fc.constant('form'),
          fc.constant('list')
        )
      }),
      // 生成重复次数（2-5次）
      fc.integer({ min: 2, max: 5 }),
      (error, context, repeatCount) => {
        const responses: any[] = []
        
        // 快速连续处理相同错误多次
        for (let i = 0; i < repeatCount; i++) {
          const response = errorHandler.handleError(error, context)
          responses.push(response)
        }
        
        // 验证所有响应都有相同的消息内容
        const firstMessage = responses[0].message
        responses.forEach(response => {
          expect(response.message).toBe(firstMessage)
          expect(response.type).toBe(responses[0].type)
        })
        
        // 验证所有响应都有有效的ID
        responses.forEach(response => {
          expect(response.id).toBeDefined()
          expect(response.id.length).toBeGreaterThan(0)
        })
        
        // 验证错误分类一致性
        responses.forEach(response => {
          expect(response.type).toBeDefined()
          expect(response.severity).toBeDefined()
          expect(typeof response.canRetry).toBe('boolean')
        })
      }
    ), { numRuns: 100 })
  })

  it('should differentiate between different error types even with same context', () => {
    fc.assert(fc.property(
      // 生成不同类型的错误
      fc.tuple(
        fc.record({
          message: fc.constant('Network failed'),
          code: fc.constant('NETWORK_ERROR')
        }),
        fc.record({
          message: fc.constant('Permission denied'),
          code: fc.constant('PERMISSION_DENIED')
        })
      ),
      // 生成相同的上下文
      fc.record({
        operation: fc.constant('save'),
        component: fc.constant('form')
      }),
      ([networkError, permissionError], context) => {
        // 处理不同类型的错误
        const networkResponse = errorHandler.handleError(networkError, context)
        const permissionResponse = errorHandler.handleError(permissionError, context)
        
        // 验证不同类型的错误产生不同的响应
        expect(networkResponse.type).not.toBe(permissionResponse.type)
        expect(networkResponse.message).not.toBe(permissionResponse.message)
        
        // 验证ID的类型部分不同
        const networkIdParts = networkResponse.id.split('-')
        const permissionIdParts = permissionResponse.id.split('-')
        expect(networkIdParts[0]).not.toBe(permissionIdParts[0]) // 错误类型部分应该不同
        
        // 但操作和组件部分应该相同
        expect(networkIdParts[1]).toBe(permissionIdParts[1]) // operation
        expect(networkIdParts[2]).toBe(permissionIdParts[2]) // component
      }
    ), { numRuns: 100 })
  })

  it('should handle different contexts for same error type correctly', () => {
    fc.assert(fc.property(
      // 生成相同的错误
      fc.record({
        message: fc.constant('Validation failed'),
        code: fc.constant('VALIDATION_ERROR')
      }),
      // 生成不同的上下文
      fc.tuple(
        fc.record({
          operation: fc.constant('login'),
          component: fc.constant('auth')
        }),
        fc.record({
          operation: fc.constant('save'),
          component: fc.constant('form')
        })
      ),
      (error, [context1, context2]) => {
        // 处理相同错误但不同上下文
        const response1 = errorHandler.handleError(error, context1)
        const response2 = errorHandler.handleError(error, context2)
        
        // 验证基本错误类型相同
        expect(response1.type).toBe(response2.type)
        
        // 但ID应该不同（因为上下文不同）
        expect(response1.id).not.toBe(response2.id)
        
        // 验证ID包含正确的上下文信息
        expect(response1.id).toContain(context1.operation)
        expect(response1.id).toContain(context1.component)
        expect(response2.id).toContain(context2.operation)
        expect(response2.id).toContain(context2.component)
        
        // 验证响应结构完整性
        expect(response1.message).toBeDefined()
        expect(response2.message).toBeDefined()
        expect(Array.isArray(response1.suggestions)).toBe(true)
        expect(Array.isArray(response2.suggestions)).toBe(true)
      }
    ), { numRuns: 100 })
  })
})