import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { ErrorHandlerAPI, ErrorType, MessageSeverity, ErrorContext } from './errorHandler'

// **Feature: error-message-enhancement, Property 14: API响应格式标准化**
// **Validates: Requirements 4.5**

describe('ErrorHandlerAPI Property Tests', () => {
  const errorHandler = new ErrorHandlerAPI()

  it('Property 14: API response format standardization - should return standardized error response format for all error handling API calls', async () => {
    await fc.assert(
      fc.property(
        fc.record({
          error: fc.oneof(
            // 各种错误类型
            fc.record({
              message: fc.string({ minLength: 1, maxLength: 200 }),
              code: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
              stack: fc.option(fc.string({ maxLength: 500 }))
            }),
            fc.constantFrom(null, undefined),
            fc.string({ maxLength: 100 }),
            fc.integer(),
            fc.boolean()
          ),
          context: fc.option(
            fc.record({
              operation: fc.string({ minLength: 1, maxLength: 50 }),
              component: fc.string({ minLength: 1, maxLength: 50 }),
              userId: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
              additionalData: fc.option(fc.dictionary(
                fc.string({ minLength: 1, maxLength: 20 }),
                fc.oneof(fc.string(), fc.integer(), fc.boolean())
              ))
            })
          )
        }),
        ({ error, context }) => {
          // 调用错误处理API
          const response = errorHandler.handleError(error, context)
          
          // 验证响应格式的标准化结构
          expect(response).toHaveProperty('id')
          expect(response).toHaveProperty('type')
          expect(response).toHaveProperty('message')
          expect(response).toHaveProperty('canRetry')
          expect(response).toHaveProperty('severity')
          expect(response).toHaveProperty('suggestions')
          
          // 验证字段类型
          expect(typeof response.id).toBe('string')
          expect(response.id.length).toBeGreaterThan(0)
          
          expect(typeof response.type).toBe('string')
          expect(Object.values(ErrorType)).toContain(response.type)
          
          expect(typeof response.message).toBe('string')
          expect(response.message.length).toBeGreaterThan(0)
          
          expect(typeof response.canRetry).toBe('boolean')
          
          expect(typeof response.severity).toBe('string')
          expect(Object.values(MessageSeverity)).toContain(response.severity)
          
          expect(Array.isArray(response.suggestions)).toBe(true)
          if (response.suggestions) {
            response.suggestions.forEach(suggestion => {
              expect(typeof suggestion).toBe('string')
            })
          }
          
          // 验证ID格式的一致性
          const idParts = response.id.split('-')
          expect(idParts.length).toBeGreaterThanOrEqual(4) // type-operation-component-timestamp
          expect(idParts[0]).toBe(response.type)
          
          // 验证消息不为空
          expect(response.message.trim().length).toBeGreaterThan(0)
          
          // 验证重试逻辑的一致性
          if ([ErrorType.NETWORK, ErrorType.TIMEOUT, ErrorType.SERVER].includes(response.type as ErrorType)) {
            expect(response.canRetry).toBe(true)
          }
          
          if ([ErrorType.PERMISSION, ErrorType.VALIDATION, ErrorType.CLIENT].includes(response.type as ErrorType)) {
            expect(response.canRetry).toBe(false)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 14.1: API response consistency - multiple calls with same parameters should return consistent format', async () => {
    await fc.assert(
      fc.property(
        fc.record({
          message: fc.string({ minLength: 1, maxLength: 100 }),
          code: fc.option(fc.string({ minLength: 1, maxLength: 10 }))
        }),
        fc.option(
          fc.record({
            operation: fc.string({ minLength: 1, maxLength: 20 }),
            component: fc.string({ minLength: 1, maxLength: 20 })
          })
        ),
        (error, context) => {
          // 多次调用应该返回一致的格式
          const response1 = errorHandler.handleError(error, context)
          const response2 = errorHandler.handleError(error, context)
          
          // 验证响应结构一致性
          expect(Object.keys(response1).sort()).toEqual(Object.keys(response2).sort())
          
          // 验证字段类型一致性
          expect(typeof response1.id).toBe(typeof response2.id)
          expect(typeof response1.type).toBe(typeof response2.type)
          expect(typeof response1.message).toBe(typeof response2.message)
          expect(typeof response1.canRetry).toBe(typeof response2.canRetry)
          expect(typeof response1.severity).toBe(typeof response2.severity)
          expect(Array.isArray(response1.suggestions)).toBe(Array.isArray(response2.suggestions))
          
          // 验证核心分类逻辑一致性（ID会不同因为包含时间戳）
          expect(response1.type).toBe(response2.type)
          expect(response1.canRetry).toBe(response2.canRetry)
          expect(response1.severity).toBe(response2.severity)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 14.2: API response completeness - all required fields should always be present', async () => {
    await fc.assert(
      fc.property(
        fc.anything(), // 任何类型的错误输入
        fc.option(fc.record({
          operation: fc.option(fc.string({ maxLength: 50 })),
          component: fc.option(fc.string({ maxLength: 50 })),
          userId: fc.option(fc.string({ maxLength: 50 })),
          additionalData: fc.option(fc.anything())
        })),
        (error, context) => {
          const response = errorHandler.handleError(error, context)
          
          // 必需字段检查
          const requiredFields = ['id', 'type', 'message', 'canRetry', 'severity', 'suggestions']
          
          requiredFields.forEach(field => {
            expect(response).toHaveProperty(field)
            expect(response[field as keyof typeof response]).toBeDefined()
          })
          
          // 验证字段值的有效性
          expect(response.id).toBeTruthy()
          expect(response.type).toBeTruthy()
          expect(response.message).toBeTruthy()
          expect(typeof response.canRetry).toBe('boolean')
          expect(response.severity).toBeTruthy()
          expect(Array.isArray(response.suggestions)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 14.3: API response field validation - all fields should have valid values within expected ranges', async () => {
    await fc.assert(
      fc.property(
        fc.record({
          message: fc.string({ maxLength: 500 }),
          code: fc.option(fc.string({ maxLength: 50 }))
        }),
        fc.option(
          fc.record({
            operation: fc.string({ maxLength: 100 }),
            component: fc.string({ maxLength: 100 }),
            userId: fc.option(fc.string({ maxLength: 100 }))
          })
        ),
        (error, context) => {
          const response = errorHandler.handleError(error, context)
          
          // ID 格式验证
          expect(response.id).toMatch(/^[a-z]+-[a-zA-Z0-9_-]+-[a-zA-Z0-9_-]+-\d+$/)
          
          // 类型验证
          expect(Object.values(ErrorType)).toContain(response.type)
          
          // 消息长度验证
          expect(response.message.length).toBeGreaterThan(0)
          expect(response.message.length).toBeLessThan(1000) // 合理的消息长度上限
          
          // 严重程度验证
          expect(Object.values(MessageSeverity)).toContain(response.severity)
          
          // 建议数组验证
          expect(response.suggestions.length).toBeGreaterThanOrEqual(0)
          expect(response.suggestions.length).toBeLessThan(20) // 合理的建议数量上限
          
          // 建议内容验证
          response.suggestions.forEach(suggestion => {
            expect(typeof suggestion).toBe('string')
            expect(suggestion.length).toBeGreaterThan(0)
            expect(suggestion.length).toBeLessThan(200) // 合理的建议长度上限
          })
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 14.4: API response context integration - context information should be properly reflected in response', async () => {
    await fc.assert(
      fc.property(
        fc.record({
          message: fc.string({ minLength: 1, maxLength: 100 }),
          code: fc.option(fc.string({ minLength: 1, maxLength: 10 }))
        }),
        fc.record({
          operation: fc.constantFrom('login', 'upload', 'save', 'delete', 'create'),
          component: fc.constantFrom('form', 'modal', 'page', 'button', 'input'),
          userId: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
          additionalData: fc.option(fc.record({
            eventId: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
            teamId: fc.option(fc.string({ minLength: 1, maxLength: 20 }))
          }))
        }),
        (error, context) => {
          const response = errorHandler.handleError(error, context)
          
          // 验证上下文信息反映在ID中
          expect(response.id).toContain(context.operation)
          expect(response.id).toContain(context.component)
          
          // 验证响应格式保持标准化，即使有上下文
          expect(response).toHaveProperty('id')
          expect(response).toHaveProperty('type')
          expect(response).toHaveProperty('message')
          expect(response).toHaveProperty('canRetry')
          expect(response).toHaveProperty('severity')
          expect(response).toHaveProperty('suggestions')
          
          // 验证上下文不会破坏响应格式的一致性
          expect(typeof response.id).toBe('string')
          expect(Object.values(ErrorType)).toContain(response.type)
          expect(typeof response.message).toBe('string')
          expect(typeof response.canRetry).toBe('boolean')
          expect(Object.values(MessageSeverity)).toContain(response.severity)
          expect(Array.isArray(response.suggestions)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })
})