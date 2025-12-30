import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { ErrorHandlerAPI, ErrorType, ErrorContext, MessageSeverity } from './errorHandler'

// **Feature: error-message-enhancement, Property 11: 上下文感知消息**
// **验证需求: 4.2**

describe('Context-Aware Messages Property Tests', () => {
  const errorHandler = new ErrorHandlerAPI()

  // 错误生成器
  const errorGenerator = fc.oneof(
    fc.record({
      message: fc.string({ minLength: 1, maxLength: 100 }),
      code: fc.constantFrom('NETWORK_ERROR', 'PERMISSION_DENIED', 'VALIDATION_ERROR', '500', '401', '403')
    }),
    fc.string({ minLength: 1, maxLength: 100 }),
    fc.record({
      toString: fc.constant(() => 'Error occurred')
    })
  )

  // 上下文生成器
  const contextGenerator = fc.record({
    operation: fc.constantFrom('login', 'upload', 'save', 'delete', 'create', 'update'),
    component: fc.constantFrom('form', 'upload', 'auth', 'profile', 'team', 'event'),
    userId: fc.option(fc.uuid()),
    additionalData: fc.option(fc.dictionary(fc.string(), fc.anything()))
  })

  it('Property 11: Context-aware messages - should generate more specific error messages when context information is provided', async () => {
    await fc.assert(
      fc.property(
        errorGenerator,
        contextGenerator,
        (error, context) => {
          // 处理有上下文的错误
          const responseWithContext = errorHandler.handleError(error, context)
          
          // 处理无上下文的错误
          const responseWithoutContext = errorHandler.handleError(error)
          
          // 验证响应基本结构
          expect(responseWithContext).toHaveProperty('id')
          expect(responseWithContext).toHaveProperty('type')
          expect(responseWithContext).toHaveProperty('message')
          expect(responseWithContext).toHaveProperty('canRetry')
          expect(responseWithContext).toHaveProperty('severity')
          
          expect(responseWithoutContext).toHaveProperty('id')
          expect(responseWithoutContext).toHaveProperty('type')
          expect(responseWithoutContext).toHaveProperty('message')
          expect(responseWithoutContext).toHaveProperty('canRetry')
          expect(responseWithoutContext).toHaveProperty('severity')
          
          // 验证上下文信息反映在错误ID中
          expect(responseWithContext.id).toContain(context.operation)
          expect(responseWithContext.id).toContain(context.component)
          
          // 验证消息类型一致性
          expect(responseWithContext.type).toBe(responseWithoutContext.type)
          expect(responseWithContext.canRetry).toBe(responseWithoutContext.canRetry)
          expect(responseWithContext.severity).toBe(responseWithoutContext.severity)
          
          // 验证有上下文的消息应该更具体（通过长度或内容差异）
          // 对于特定操作和组件组合，消息应该包含更多上下文信息
          if (context.operation === 'login' && (
            responseWithContext.type === ErrorType.NETWORK ||
            responseWithContext.type === ErrorType.PERMISSION ||
            responseWithContext.type === ErrorType.VALIDATION
          )) {
            // 登录相关错误应该包含登录特定的消息
            expect(responseWithContext.message).toMatch(/登录|用户名|密码/)
          }
          
          if (context.operation === 'upload' && (
            responseWithContext.type === ErrorType.NETWORK ||
            responseWithContext.type === ErrorType.VALIDATION ||
            responseWithContext.type === ErrorType.TIMEOUT
          )) {
            // 上传相关错误应该包含上传特定的消息
            expect(responseWithContext.message).toMatch(/上传|文件/)
          }
          
          if (context.operation === 'save' && (
            responseWithContext.type === ErrorType.NETWORK ||
            responseWithContext.type === ErrorType.VALIDATION
          )) {
            // 保存相关错误应该包含保存特定的消息
            expect(responseWithContext.message).toMatch(/保存/)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 11: Context-aware messages - should provide component-specific suggestions when context includes component information', async () => {
    await fc.assert(
      fc.property(
        errorGenerator,
        contextGenerator,
        (error, context) => {
          const response = errorHandler.handleError(error, context)
          
          // 验证建议存在
          expect(response.suggestions).toBeDefined()
          expect(Array.isArray(response.suggestions)).toBe(true)
          
          // 根据组件类型验证特定建议
          if (context.component === 'form' && response.suggestions) {
            // 表单组件应该包含表单相关建议
            const formRelatedSuggestions = response.suggestions.some(suggestion =>
              suggestion.includes('表单') || 
              suggestion.includes('填写') || 
              suggestion.includes('必填') ||
              suggestion.includes('字段')
            )
            expect(formRelatedSuggestions).toBe(true)
          }
          
          if (context.component === 'upload' && response.suggestions) {
            // 上传组件应该包含文件相关建议
            const uploadRelatedSuggestions = response.suggestions.some(suggestion =>
              suggestion.includes('文件') || 
              suggestion.includes('格式') || 
              suggestion.includes('大小') ||
              suggestion.includes('压缩')
            )
            expect(uploadRelatedSuggestions).toBe(true)
          }
          
          if (context.component === 'auth' && response.suggestions) {
            // 认证组件应该包含账户相关建议
            const authRelatedSuggestions = response.suggestions.some(suggestion =>
              suggestion.includes('账户') || 
              suggestion.includes('密码') || 
              suggestion.includes('登录') ||
              suggestion.includes('重置')
            )
            expect(authRelatedSuggestions).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 11: Context-aware messages - should maintain consistency for same error and context combinations', async () => {
    await fc.assert(
      fc.property(
        errorGenerator,
        contextGenerator,
        (error, context) => {
          // 多次处理相同错误和上下文应该返回一致的消息
          const response1 = errorHandler.handleError(error, context)
          const response2 = errorHandler.handleError(error, context)
          const response3 = errorHandler.handleError(error, context)
          
          // 验证消息内容一致性（ID会不同因为包含时间戳）
          expect(response1.type).toBe(response2.type)
          expect(response2.type).toBe(response3.type)
          
          expect(response1.message).toBe(response2.message)
          expect(response2.message).toBe(response3.message)
          
          expect(response1.canRetry).toBe(response2.canRetry)
          expect(response2.canRetry).toBe(response3.canRetry)
          
          expect(response1.severity).toBe(response2.severity)
          expect(response2.severity).toBe(response3.severity)
          
          // 建议应该一致
          expect(response1.suggestions).toEqual(response2.suggestions)
          expect(response2.suggestions).toEqual(response3.suggestions)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 11: Context-aware messages - should handle missing or incomplete context gracefully', async () => {
    await fc.assert(
      fc.property(
        errorGenerator,
        fc.oneof(
          fc.constant(undefined),
          fc.record({
            operation: fc.option(fc.string()),
            component: fc.option(fc.string()),
            userId: fc.option(fc.string()),
            additionalData: fc.option(fc.anything())
          })
        ),
        (error, context) => {
          // 处理错误不应该抛出异常，即使上下文不完整
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
            
            // ID应该包含默认值当上下文缺失时
            if (!context || !context.operation) {
              expect(response.id).toContain('unknown')
            }
            if (!context || !context.component) {
              expect(response.id).toContain('unknown')
            }
          }).not.toThrow()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 11: Context-aware messages - should generate unique IDs that include context information', async () => {
    await fc.assert(
      fc.property(
        errorGenerator,
        contextGenerator,
        (error, context) => {
          const response = errorHandler.handleError(error, context)
          
          // 验证ID格式：应该包含错误类型、操作、组件和时间戳
          const idParts = response.id.split('-')
          expect(idParts.length).toBeGreaterThanOrEqual(4)
          
          // 第一部分应该是错误类型
          expect(Object.values(ErrorType)).toContain(idParts[0] as ErrorType)
          
          // 应该包含操作信息（可能被清理过）
          expect(idParts[1]).toBeDefined()
          expect(idParts[1].length).toBeGreaterThan(0)
          
          // 应该包含组件信息（可能被清理过）
          expect(idParts[2]).toBeDefined()
          expect(idParts[2].length).toBeGreaterThan(0)
          
          // 最后部分应该是时间戳
          const timestamp = parseInt(idParts[idParts.length - 1])
          expect(timestamp).toBeGreaterThan(0)
          expect(timestamp).toBeLessThanOrEqual(Date.now())
        }
      ),
      { numRuns: 100 }
    )
  })
})