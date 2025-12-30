import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { MessageLocalizer, ErrorType, ErrorContext } from './errorHandler'

// **Feature: error-message-enhancement, Property 1: 中文消息本地化**
// **Validates: Requirements 1.1, 1.2**

describe('MessageLocalizer Property Tests', () => {
  const localizer = new MessageLocalizer()

  it('Property 1: Chinese message localization - should display user-friendly Chinese messages instead of technical English errors', async () => {
    await fc.assert(
      fc.property(
        fc.oneof(
          // 英文技术错误生成器
          fc.record({
            message: fc.oneof(
              fc.constant('NetworkError: Failed to fetch'),
              fc.constant('TypeError: Cannot read property of undefined'),
              fc.constant('ReferenceError: variable is not defined'),
              fc.constant('SyntaxError: Unexpected token'),
              fc.constant('ValidationError: Required field missing'),
              fc.constant('PermissionError: Access denied'),
              fc.constant('TimeoutError: Request timed out'),
              fc.constant('ServerError: Internal server error'),
              fc.constant('Error: Something went wrong'),
              fc.constant('Exception: Database connection failed'),
              fc.constant('HTTP 404: Not found'),
              fc.constant('HTTP 500: Internal server error'),
              fc.constant('CORS error: Cross-origin request blocked')
            ),
            code: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
            stack: fc.option(fc.string({ maxLength: 500 }))
          }),
          // 包含技术术语的错误
          fc.record({
            message: fc.oneof(
              fc.constant('fetch() failed with status 404'),
              fc.constant('XMLHttpRequest error'),
              fc.constant('WebSocket connection failed'),
              fc.constant('JSON.parse() error'),
              fc.constant('localStorage quota exceeded'),
              fc.constant('IndexedDB transaction failed'),
              fc.constant('Service Worker registration failed')
            )
          }),
          // 原始字符串错误
          fc.oneof(
            fc.constant('Network request failed'),
            fc.constant('Permission denied'),
            fc.constant('Validation failed'),
            fc.constant('Request timeout'),
            fc.constant('Server unavailable'),
            fc.constant('Client error occurred')
          ),
          // null/undefined 错误
          fc.constantFrom(null, undefined, '')
        ),
        fc.option(fc.record({
          operation: fc.constantFrom('login', 'upload', 'save', 'delete', 'fetch'),
          component: fc.constantFrom('form', 'upload', 'auth', 'table', 'modal'),
          userId: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
          additionalData: fc.option(fc.record({
            field: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
            value: fc.option(fc.string({ maxLength: 100 }))
          }))
        })),
        (errorInput, context) => {
          const localizedMessage = localizer.localize(errorInput, context)
          
          // 验证返回的消息结构
          expect(localizedMessage).toHaveProperty('title')
          expect(localizedMessage).toHaveProperty('message')
          expect(localizedMessage).toHaveProperty('suggestions')
          expect(typeof localizedMessage.title).toBe('string')
          expect(typeof localizedMessage.message).toBe('string')
          expect(Array.isArray(localizedMessage.suggestions)).toBe(true)
          
          // 验证消息是中文的（包含中文字符）
          const chineseRegex = /[\u4e00-\u9fa5]/
          expect(chineseRegex.test(localizedMessage.title)).toBe(true)
          expect(chineseRegex.test(localizedMessage.message)).toBe(true)
          
          // 验证消息不包含技术术语
          const technicalTerms = [
            'Error:', 'Exception:', 'TypeError:', 'ReferenceError:', 'SyntaxError:',
            'NetworkError:', 'ValidationError:', 'PermissionError:', 'TimeoutError:',
            'ServerError:', 'HTTP', 'CORS', 'XMLHttpRequest', 'WebSocket',
            'JSON.parse', 'localStorage', 'IndexedDB', 'Service Worker',
            'fetch()', 'undefined', 'null', 'NaN', 'stack trace'
          ]
          
          for (const term of technicalTerms) {
            expect(localizedMessage.message).not.toContain(term)
            expect(localizedMessage.title).not.toContain(term)
          }
          
          // 验证消息是用户友好的（长度合理，不包含代码片段）
          expect(localizedMessage.message.length).toBeGreaterThan(0)
          expect(localizedMessage.message.length).toBeLessThan(200) // 用户友好的消息应该简洁
          
          // 验证不包含代码相关的符号
          const codeSymbols = ['{', '}', '[', ']', '()', '=>', '===', '!==', '&&', '||']
          for (const symbol of codeSymbols) {
            expect(localizedMessage.message).not.toContain(symbol)
          }
          
          // 验证建议也是中文的
          for (const suggestion of localizedMessage.suggestions) {
            expect(typeof suggestion).toBe('string')
            expect(suggestion.length).toBeGreaterThan(0)
            expect(chineseRegex.test(suggestion)).toBe(true)
          }
          
          // 验证标题符合预期的错误类型标题
          const expectedTitles = ['网络错误', '权限错误', '输入错误', '超时错误', '服务器错误', '客户端错误', '未知错误']
          expect(expectedTitles).toContain(localizedMessage.title)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 1.1: Technical term conversion - should convert technical terms to user-friendly Chinese descriptions', async () => {
    await fc.assert(
      fc.property(
        fc.record({
          message: fc.oneof(
            // 包含具体技术术语的错误消息
            fc.constant('fetch() returned 404 status'),
            fc.constant('XMLHttpRequest failed with CORS error'),
            fc.constant('JSON.parse() threw SyntaxError'),
            fc.constant('localStorage.setItem() quota exceeded'),
            fc.constant('WebSocket connection refused'),
            fc.constant('Service Worker registration failed'),
            fc.constant('IndexedDB transaction aborted'),
            fc.constant('Promise rejected with TypeError'),
            fc.constant('async/await function threw ReferenceError'),
            fc.constant('EventListener callback undefined')
          ),
          code: fc.option(fc.string())
        }),
        (errorInput) => {
          const localizedMessage = localizer.localize(errorInput)
          
          // 验证技术术语被转换为用户友好的描述
          const message = localizedMessage.message
          
          // 不应该包含原始的技术术语
          const technicalTermsToAvoid = [
            'fetch()', 'XMLHttpRequest', 'JSON.parse()', 'localStorage.setItem()',
            'WebSocket', 'Service Worker', 'IndexedDB', 'Promise', 'async/await',
            'EventListener', 'callback', 'TypeError', 'ReferenceError', 'SyntaxError',
            'CORS', 'quota exceeded', 'transaction aborted', 'undefined'
          ]
          
          for (const term of technicalTermsToAvoid) {
            expect(message).not.toContain(term)
          }
          
          // 应该包含用户友好的中文描述
          expect(/[\u4e00-\u9fa5]/.test(message)).toBe(true)
          
          // 消息应该是完整的句子，以中文标点结尾或不包含英文标点
          expect(message).not.toMatch(/[;{}()\[\]<>]/)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 1.2: Message consistency - same error type should produce consistent Chinese messages', async () => {
    await fc.assert(
      fc.property(
        fc.constantFrom(
          { message: 'NetworkError: Failed to fetch', type: 'network' },
          { message: 'PermissionError: Access denied', type: 'permission' },
          { message: 'ValidationError: Invalid input', type: 'validation' },
          { message: 'TimeoutError: Request timeout', type: 'timeout' },
          { message: 'ServerError: Internal error', type: 'server' },
          { message: 'ClientError: Script error', type: 'client' }
        ),
        (errorData) => {
          // 同一类型的错误应该产生一致的中文消息
          const message1 = localizer.localize({ message: errorData.message })
          const message2 = localizer.localize({ message: errorData.message })
          const message3 = localizer.localize({ message: errorData.message })
          
          // 标题应该一致
          expect(message1.title).toBe(message2.title)
          expect(message1.title).toBe(message3.title)
          
          // 消息内容应该一致
          expect(message1.message).toBe(message2.message)
          expect(message1.message).toBe(message3.message)
          
          // 建议应该一致
          expect(message1.suggestions).toEqual(message2.suggestions)
          expect(message1.suggestions).toEqual(message3.suggestions)
          
          // 所有消息都应该是中文的
          const chineseRegex = /[\u4e00-\u9fa5]/
          expect(chineseRegex.test(message1.title)).toBe(true)
          expect(chineseRegex.test(message1.message)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 1.3: Context preservation - localized messages should maintain error context information', async () => {
    await fc.assert(
      fc.property(
        fc.record({
          message: fc.string({ minLength: 1, maxLength: 100 }),
          code: fc.option(fc.string({ minLength: 1, maxLength: 20 }))
        }),
        fc.record({
          operation: fc.constantFrom('login', 'upload', 'save', 'delete'),
          component: fc.constantFrom('form', 'auth', 'upload', 'table'),
          userId: fc.option(fc.string({ minLength: 1, maxLength: 50 }))
        }),
        (errorInput, context) => {
          const withoutContext = localizer.localize(errorInput)
          const withContext = localizer.localize(errorInput, context)
          
          // 两个消息都应该是有效的中文消息
          const chineseRegex = /[\u4e00-\u9fa5]/
          expect(chineseRegex.test(withoutContext.message)).toBe(true)
          expect(chineseRegex.test(withContext.message)).toBe(true)
          
          // 有上下文的消息可能更具体，但不应该更短（除非是特殊情况）
          expect(withContext.message.length).toBeGreaterThan(0)
          expect(withoutContext.message.length).toBeGreaterThan(0)
          
          // 标题应该保持一致（错误类型不变）
          expect(withContext.title).toBe(withoutContext.title)
          
          // 建议可能会因上下文而不同，但都应该是有效的
          expect(Array.isArray(withContext.suggestions)).toBe(true)
          expect(Array.isArray(withoutContext.suggestions)).toBe(true)
          
          for (const suggestion of withContext.suggestions) {
            expect(typeof suggestion).toBe('string')
            expect(suggestion.length).toBeGreaterThan(0)
            expect(chineseRegex.test(suggestion)).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})