/**
 * **Feature: error-message-enhancement, Property 15: 错误建议提供**
 * **验证需求: 5.1, 5.2, 5.3, 5.4, 5.5**
 * 
 * 对于任何特定类型的错误（表单验证、文件上传、权限、网络、超时），错误消息应该包含相应的解决建议
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { ErrorType, MessageLocalizer } from '../../utils/errorHandler'

// 错误类型生成器
const errorTypeArb = fc.constantFrom(
  ErrorType.VALIDATION,
  ErrorType.NETWORK,
  ErrorType.PERMISSION,
  ErrorType.TIMEOUT,
  ErrorType.SERVER,
  ErrorType.CLIENT,
  ErrorType.UNKNOWN
)

// 错误上下文生成器
const errorContextArb = fc.record({
  operation: fc.constantFrom('login', 'upload', 'save', 'delete', 'create', 'update'),
  component: fc.constantFrom('form', 'upload', 'auth', 'profile', 'team'),
  userId: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
  additionalData: fc.option(fc.record({
    fileName: fc.option(fc.string()),
    fileSize: fc.option(fc.integer({ min: 0, max: 100000000 })),
    fieldName: fc.option(fc.string())
  }))
})

// 模拟错误对象生成器 (currently unused but may be needed for future tests)
// const errorObjectArb = fc.record({
//   message: fc.string({ minLength: 1, maxLength: 200 }),
//   code: fc.option(fc.constantFrom('NETWORK_ERROR', '401', '403', '404', '500', '503', 'VALIDATION_ERROR', 'TIMEOUT')),
//   type: fc.option(errorTypeArb)
// })

// 获取错误建议的逻辑
const getErrorSuggestions = (errorType: ErrorType, context?: any): string[] => {
  const localizer = new MessageLocalizer()
  const suggestions = localizer.getErrorSuggestions(errorType)
  
  // 根据上下文添加特定建议
  const contextualSuggestions: string[] = []
  
  if (context?.operation === 'upload' && errorType === ErrorType.VALIDATION) {
    contextualSuggestions.push('检查文件格式和大小')
    contextualSuggestions.push('尝试压缩文件后上传')
  }
  
  if (context?.operation === 'login' && errorType === ErrorType.PERMISSION) {
    contextualSuggestions.push('确认账户信息正确')
    contextualSuggestions.push('尝试重置密码')
  }
  
  if (context?.component === 'form' && errorType === ErrorType.VALIDATION) {
    contextualSuggestions.push('检查表单填写是否完整')
    contextualSuggestions.push('确认必填字段已填写')
  }
  
  return [...contextualSuggestions, ...suggestions]
}

// 验证建议内容的相关性
const isSuggestionRelevant = (suggestion: string, errorType: ErrorType): boolean => {
  const lowerSuggestion = suggestion.toLowerCase()
  
  switch (errorType) {
    case ErrorType.NETWORK:
      return lowerSuggestion.includes('网络') || 
             lowerSuggestion.includes('连接') || 
             lowerSuggestion.includes('刷新') ||
             lowerSuggestion.includes('重试')
             
    case ErrorType.PERMISSION:
      return lowerSuggestion.includes('权限') || 
             lowerSuggestion.includes('管理员') || 
             lowerSuggestion.includes('登录') ||
             lowerSuggestion.includes('账户')
             
    case ErrorType.VALIDATION:
      return lowerSuggestion.includes('字段') || 
             lowerSuggestion.includes('格式') || 
             lowerSuggestion.includes('填写') ||
             lowerSuggestion.includes('输入') ||
             lowerSuggestion.includes('检查')
             
    case ErrorType.TIMEOUT:
      return lowerSuggestion.includes('超时') || 
             lowerSuggestion.includes('网络') || 
             lowerSuggestion.includes('重试') ||
             lowerSuggestion.includes('稍后')
             
    case ErrorType.SERVER:
      return lowerSuggestion.includes('服务器') || 
             lowerSuggestion.includes('重试') || 
             lowerSuggestion.includes('稍后') ||
             lowerSuggestion.includes('支持')
             
    case ErrorType.CLIENT:
      return lowerSuggestion.includes('刷新') || 
             lowerSuggestion.includes('浏览器') || 
             lowerSuggestion.includes('缓存') ||
             lowerSuggestion.includes('页面')
             
    default:
      return true // 对于未知错误，任何建议都可能有用
  }
}

// 获取特定错误类型的预期建议关键词
const getExpectedSuggestionKeywords = (errorType: ErrorType): string[] => {
  switch (errorType) {
    case ErrorType.VALIDATION:
      return ['字段', '格式', '检查', '输入', '必填']
    case ErrorType.NETWORK:
      return ['网络', '连接', '刷新', '重试']
    case ErrorType.PERMISSION:
      return ['权限', '管理员', '登录', '联系']
    case ErrorType.TIMEOUT:
      return ['超时', '重试', '稍后', '网络']
    case ErrorType.SERVER:
      return ['服务器', '重试', '稍后', '支持']
    case ErrorType.CLIENT:
      return ['刷新', '浏览器', '缓存', '页面']
    default:
      return ['重试', '支持', '刷新']
  }
}

describe('GlobalBanner - Error Suggestions Property Tests', () => {
  it('Property 15: 错误建议提供 - 对于任何特定类型的错误，错误消息应该包含相应的解决建议', () => {
    fc.assert(fc.property(
      errorTypeArb,
      errorContextArb,
      (errorType, context) => {
        const suggestions = getErrorSuggestions(errorType, context)
        
        // 应该提供建议
        expect(suggestions).toBeDefined()
        expect(Array.isArray(suggestions)).toBe(true)
        expect(suggestions.length).toBeGreaterThan(0)
        
        // 每个建议都应该是非空字符串
        suggestions.forEach(suggestion => {
          expect(typeof suggestion).toBe('string')
          expect(suggestion.trim().length).toBeGreaterThan(0)
        })
        
        // 建议应该与错误类型相关
        const relevantSuggestions = suggestions.filter(suggestion => 
          isSuggestionRelevant(suggestion, errorType)
        )
        expect(relevantSuggestions.length).toBeGreaterThan(0)
        
        return true
      }
    ), { numRuns: 100 })
  })

  it('Property 15 Keyword Coverage: 每种错误类型的建议都包含预期的关键词', () => {
    fc.assert(fc.property(
      errorTypeArb,
      (errorType) => {
        const suggestions = getErrorSuggestions(errorType)
        const expectedKeywords = getExpectedSuggestionKeywords(errorType)
        
        // 将所有建议合并为一个字符串进行关键词检查
        const allSuggestions = suggestions.join(' ')
        
        // 至少应该包含一个预期的关键词
        const hasExpectedKeyword = expectedKeywords.some(keyword => 
          allSuggestions.includes(keyword)
        )
        
        expect(hasExpectedKeyword).toBe(true)
        
        return true
      }
    ), { numRuns: 100 })
  })

  it('Property 15 Context Sensitivity: 上下文信息应该影响建议的具体内容', () => {
    fc.assert(fc.property(
      fc.constantFrom(ErrorType.VALIDATION, ErrorType.PERMISSION), // 选择对上下文敏感的错误类型
      errorContextArb,
      (errorType, context) => {
        const suggestionsWithContext = getErrorSuggestions(errorType, context)
        const suggestionsWithoutContext = getErrorSuggestions(errorType, undefined)
        
        // 有上下文的建议应该不少于无上下文的建议
        expect(suggestionsWithContext.length).toBeGreaterThanOrEqual(suggestionsWithoutContext.length)
        
        // 对于特定的操作和组件组合，应该有特定的建议
        if (context.operation === 'upload' && errorType === ErrorType.VALIDATION) {
          const hasUploadSpecificSuggestion = suggestionsWithContext.some(s => 
            s.includes('文件') || s.includes('格式') || s.includes('大小')
          )
          expect(hasUploadSpecificSuggestion).toBe(true)
        }
        
        if (context.operation === 'login' && errorType === ErrorType.PERMISSION) {
          const hasLoginSpecificSuggestion = suggestionsWithContext.some(s => 
            s.includes('账户') || s.includes('密码') || s.includes('用户名')
          )
          expect(hasLoginSpecificSuggestion).toBe(true)
        }
        
        return true
      }
    ), { numRuns: 100 })
  })

  it('Property 15 Suggestion Quality: 建议应该是可操作的和有用的', () => {
    fc.assert(fc.property(
      errorTypeArb,
      errorContextArb,
      (errorType, context) => {
        const suggestions = getErrorSuggestions(errorType, context)
        
        suggestions.forEach(suggestion => {
          // 建议应该包含动作词汇或指示性词汇
          const hasActionWord = /检查|确认|尝试|联系|刷新|重试|稍后|清除|查看|使用|获取|提供|重新|登录/.test(suggestion)
          expect(hasActionWord).toBe(true)
          
          // 建议不应该太短或太长
          expect(suggestion.length).toBeGreaterThanOrEqual(4)
          expect(suggestion.length).toBeLessThanOrEqual(50)
          
          // 建议应该是中文
          const hasChinese = /[\u4e00-\u9fa5]/.test(suggestion)
          expect(hasChinese).toBe(true)
        })
        
        return true
      }
    ), { numRuns: 100 })
  })

  it('Property 15 Uniqueness: 同一错误类型的建议不应该重复', () => {
    fc.assert(fc.property(
      errorTypeArb,
      errorContextArb,
      (errorType, context) => {
        const suggestions = getErrorSuggestions(errorType, context)
        
        // 检查是否有重复的建议
        const uniqueSuggestions = [...new Set(suggestions)]
        expect(uniqueSuggestions.length).toBe(suggestions.length)
        
        return true
      }
    ), { numRuns: 100 })
  })

  it('Property 15 Consistency: 相同错误类型和上下文应该产生相同的建议', () => {
    fc.assert(fc.property(
      errorTypeArb,
      errorContextArb,
      (errorType, context) => {
        const suggestions1 = getErrorSuggestions(errorType, context)
        const suggestions2 = getErrorSuggestions(errorType, context)
        
        // 应该完全一致
        expect(suggestions1).toEqual(suggestions2)
        
        return true
      }
    ), { numRuns: 100 })
  })

  it('Property 15 Coverage: 所有定义的错误类型都应该有建议', () => {
    fc.assert(fc.property(
      fc.constant(true), // 这个测试不需要随机输入
      () => {
        // 测试所有错误类型都有建议
        const allErrorTypes = [
          ErrorType.VALIDATION,
          ErrorType.NETWORK,
          ErrorType.PERMISSION,
          ErrorType.TIMEOUT,
          ErrorType.SERVER,
          ErrorType.CLIENT,
          ErrorType.UNKNOWN
        ]
        
        allErrorTypes.forEach(errorType => {
          const suggestions = getErrorSuggestions(errorType)
          expect(suggestions.length).toBeGreaterThan(0)
          
          // 每种错误类型至少应该有2个建议
          expect(suggestions.length).toBeGreaterThanOrEqual(2)
        })
        
        return true
      }
    ), { numRuns: 100 })
  })
})