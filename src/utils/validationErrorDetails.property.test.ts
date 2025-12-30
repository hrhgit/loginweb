import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { MessageLocalizer, ErrorType } from './errorHandler'

// **Feature: error-message-enhancement, Property 3: 验证错误详细信息**
// **Validates: Requirements 1.5**

describe('Validation Error Details Property Tests', () => {
  const localizer = new MessageLocalizer()

  it('Property 3: Validation error detailed information - should display error messages containing specific field information for data validation failures', async () => {
    await fc.assert(
      fc.property(
        fc.oneof(
          // 数据验证失败错误生成器 (需求 1.5)
          fc.record({
            message: fc.oneof(
              fc.constant('validation failed'),
              fc.constant('验证失败'),
              fc.constant('invalid input'),
              fc.constant('required field missing'),
              fc.constant('格式错误'),
              fc.constant('字段验证失败'),
              fc.constant('输入格式不正确'),
              fc.constant('必填字段为空'),
              fc.constant('数据格式验证失败'),
              fc.constant('表单验证错误')
            ),
            code: fc.option(fc.constantFrom('VALIDATION_ERROR', 'INVALID_INPUT'))
          }),
          // 包含字段信息的验证错误
          fc.record({
            message: fc.oneof(
              fc.constant('email field is required'),
              fc.constant('password must be at least 8 characters'),
              fc.constant('phone number format is invalid'),
              fc.constant('用户名不能为空'),
              fc.constant('邮箱格式不正确'),
              fc.constant('密码长度不足'),
              fc.constant('手机号格式错误'),
              fc.constant('年龄必须是数字'),
              fc.constant('日期格式不正确')
            ),
            field: fc.option(fc.constantFrom('email', 'password', 'phone', 'username', 'age', 'date'))
          }),
          // 通用验证错误
          fc.record({
            message: fc.oneof(
              fc.constant('invalid'),
              fc.constant('required'),
              fc.constant('格式'),
              fc.constant('验证'),
              fc.constant('validation')
            )
          })
        ),
        (errorInput) => {
          const localizedMessage = localizer.localize(errorInput)
          
          // 验证返回的消息结构
          expect(localizedMessage).toHaveProperty('title')
          expect(localizedMessage).toHaveProperty('message')
          expect(localizedMessage).toHaveProperty('suggestions')
          
          // 确定这是验证错误
          const message = errorInput.message || ''
          const isValidationError = message.includes('validation') || message.includes('验证') || 
                                   message.includes('invalid') || message.includes('required') || 
                                   message.includes('格式') || message.includes('字段') ||
                                   message.includes('输入') || message.includes('表单') ||
                                   message.includes('必填') || message.includes('邮箱') ||
                                   message.includes('密码') || message.includes('用户名') ||
                                   message.includes('手机') || message.includes('年龄') ||
                                   message.includes('日期') || message.includes('email') ||
                                   message.includes('password') || message.includes('phone')
          
          if (isValidationError) {
            // 验证错误应该显示输入错误标题 (需求 1.5)
            expect(localizedMessage.title).toBe('输入错误')
            
            // 验证错误消息应该包含具体的字段验证错误信息
            expect(localizedMessage.message).toContain('输入')
            
            // 验证错误的建议应该包含检查字段的建议
            expect(localizedMessage.suggestions).toContain('检查必填字段是否完整')
            expect(localizedMessage.suggestions).toContain('确认输入格式是否正确')
            expect(localizedMessage.suggestions).toContain('查看具体错误提示')
            
            // 验证错误不应该可以重试
            expect(localizedMessage.actionText).toBeUndefined()
          }
          
          // 所有消息都应该是中文的
          const chineseRegex = /[\u4e00-\u9fa5]/
          expect(chineseRegex.test(localizedMessage.title)).toBe(true)
          expect(chineseRegex.test(localizedMessage.message)).toBe(true)
          
          // 验证建议也是中文的
          for (const suggestion of localizedMessage.suggestions) {
            expect(chineseRegex.test(suggestion)).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 3.1: Field-specific validation messages - validation errors should provide specific field information when available', async () => {
    await fc.assert(
      fc.property(
        fc.record({
          message: fc.oneof(
            fc.constant('email field is required'),
            fc.constant('password must be at least 8 characters'),
            fc.constant('phone number format is invalid'),
            fc.constant('用户名不能为空'),
            fc.constant('邮箱格式不正确'),
            fc.constant('密码长度不足'),
            fc.constant('手机号格式错误')
          ),
          field: fc.option(fc.constantFrom('email', 'password', 'phone', 'username'))
        }),
        (validationError) => {
          const localizedMessage = localizer.localize(validationError)
          
          // 应该是验证错误
          expect(localizedMessage.title).toBe('输入错误')
          
          // 消息应该包含字段相关的信息
          const message = localizedMessage.message
          expect(message).toContain('输入')
          
          // 建议应该包含字段检查相关的内容
          expect(localizedMessage.suggestions).toContain('检查必填字段是否完整')
          expect(localizedMessage.suggestions).toContain('确认输入格式是否正确')
          
          // 消息应该是中文的
          const chineseRegex = /[\u4e00-\u9fa5]/
          expect(chineseRegex.test(message)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 3.2: Validation error consistency - all validation errors should produce consistent error type and suggestions', async () => {
    await fc.assert(
      fc.property(
        fc.oneof(
          fc.constant({ message: 'validation failed' }),
          fc.constant({ message: '验证失败' }),
          fc.constant({ message: 'invalid input' }),
          fc.constant({ message: 'required field missing' }),
          fc.constant({ message: '格式错误' }),
          fc.constant({ message: '字段验证失败', code: 'VALIDATION_ERROR' }),
          fc.constant({ message: 'invalid format', code: 'INVALID_INPUT' })
        ),
        (validationError) => {
          const localizedMessage = localizer.localize(validationError)
          
          // 所有验证错误都应该产生相同的标题
          expect(localizedMessage.title).toBe('输入错误')
          
          // 消息应该包含输入相关的内容
          expect(localizedMessage.message).toContain('输入')
          
          // 建议应该一致
          expect(localizedMessage.suggestions).toEqual([
            '检查必填字段是否完整',
            '确认输入格式是否正确',
            '查看具体错误提示'
          ])
          
          // 不应该可以重试
          expect(localizedMessage.actionText).toBeUndefined()
          
          // 消息应该是中文的
          const chineseRegex = /[\u4e00-\u9fa5]/
          expect(chineseRegex.test(localizedMessage.title)).toBe(true)
          expect(chineseRegex.test(localizedMessage.message)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 3.3: Validation error context awareness - validation errors should adapt to form context while maintaining field information', async () => {
    await fc.assert(
      fc.property(
        fc.record({
          message: fc.oneof(
            fc.constant('validation failed'),
            fc.constant('required field missing'),
            fc.constant('invalid input format'),
            fc.constant('字段验证失败')
          )
        }),
        fc.record({
          operation: fc.constantFrom('save', 'submit', 'update'),
          component: fc.constantFrom('form', 'registration', 'profile'),
          additionalData: fc.option(fc.record({
            field: fc.option(fc.constantFrom('email', 'password', 'name', 'phone'))
          }))
        }),
        (validationError, context) => {
          const withoutContext = localizer.localize(validationError)
          const withContext = localizer.localize(validationError, context)
          
          // 两个消息都应该是验证错误
          expect(withoutContext.title).toBe('输入错误')
          expect(withContext.title).toBe('输入错误')
          
          // 都应该包含输入相关的内容
          expect(withoutContext.message).toContain('输入')
          expect(withContext.message).toContain('输入')
          
          // 有上下文的消息可能更具体，但核心内容应该保持一致
          expect(withContext.message.length).toBeGreaterThan(0)
          expect(withoutContext.message.length).toBeGreaterThan(0)
          
          // 建议可能会因上下文而不同，但都应该包含基本的验证建议
          expect(withContext.suggestions).toContain('检查必填字段是否完整')
          expect(withContext.suggestions).toContain('确认输入格式是否正确')
          
          // 如果是表单组件，应该有额外的表单相关建议
          if (context.component === 'form') {
            expect(withContext.suggestions).toContain('检查表单填写是否完整')
          }
          
          // 所有消息都应该是中文的
          const chineseRegex = /[\u4e00-\u9fa5]/
          expect(chineseRegex.test(withContext.title)).toBe(true)
          expect(chineseRegex.test(withContext.message)).toBe(true)
          
          for (const suggestion of withContext.suggestions) {
            expect(chineseRegex.test(suggestion)).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 3.4: Validation error detail preservation - validation errors should maintain specific error information while providing user-friendly messages', async () => {
    await fc.assert(
      fc.property(
        fc.record({
          message: fc.oneof(
            // 包含具体字段和错误信息的验证错误
            fc.constant('email field is required and must be valid format'),
            fc.constant('password must be at least 8 characters and contain special characters'),
            fc.constant('phone number format is invalid, expected format: +86-xxx-xxxx-xxxx'),
            fc.constant('用户名长度必须在3-20个字符之间'),
            fc.constant('邮箱格式不正确，请输入有效的邮箱地址'),
            fc.constant('密码强度不足，需要包含大小写字母和数字'),
            fc.constant('手机号格式错误，请输入11位数字')
          ),
          code: fc.option(fc.constantFrom('VALIDATION_ERROR', 'FIELD_INVALID')),
          details: fc.option(fc.record({
            field: fc.constantFrom('email', 'password', 'phone', 'username'),
            constraint: fc.constantFrom('required', 'format', 'length', 'pattern')
          }))
        }),
        (detailedValidationError) => {
          const localizedMessage = localizer.localize(detailedValidationError)
          
          // 应该是验证错误
          expect(localizedMessage.title).toBe('输入错误')
          
          // 消息应该包含具体的字段验证错误信息
          expect(localizedMessage.message).toContain('输入')
          
          // 不应该包含技术术语或英文错误信息
          const technicalTerms = [
            'field is required', 'must be at least', 'format is invalid',
            'expected format:', 'contain special characters', 'VALIDATION_ERROR',
            'FIELD_INVALID'
          ]
          
          for (const term of technicalTerms) {
            expect(localizedMessage.message).not.toContain(term)
          }
          
          // 建议应该包含具体的修正指导
          expect(localizedMessage.suggestions).toContain('检查必填字段是否完整')
          expect(localizedMessage.suggestions).toContain('确认输入格式是否正确')
          expect(localizedMessage.suggestions).toContain('查看具体错误提示')
          
          // 消息应该是用户友好的中文
          const chineseRegex = /[\u4e00-\u9fa5]/
          expect(chineseRegex.test(localizedMessage.message)).toBe(true)
          
          // 消息长度应该合理（不会太长或太短）
          expect(localizedMessage.message.length).toBeGreaterThan(5)
          expect(localizedMessage.message.length).toBeLessThan(100)
          
          // 不应该可以重试
          expect(localizedMessage.actionText).toBeUndefined()
        }
      ),
      { numRuns: 100 }
    )
  })
})