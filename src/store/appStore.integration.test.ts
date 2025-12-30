/**
 * 错误消息反馈系统增强 - Store集成测试
 * 
 * 测试增强错误处理与现有store系统的集成
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  enhancedErrorHandler, 
  handleErrorWithBanner, 
  handleSuccessWithBanner,
  authErrorHandler,
  formErrorHandler,
  apiErrorHandler
} from './enhancedErrorHandling'

describe('Enhanced Error Handling Integration', () => {
  let mockSetBanner: any

  beforeEach(() => {
    mockSetBanner = vi.fn()
  })

  it('should integrate with existing setBanner function', () => {
    const error = new Error('Test error')
    
    handleErrorWithBanner(error, mockSetBanner, {
      operation: 'test',
      component: 'integration'
    })
    
    expect(mockSetBanner).toHaveBeenCalled()
    expect(mockSetBanner).toHaveBeenCalledWith('error', expect.any(String))
    
    const [type, message] = mockSetBanner.mock.calls[0]
    expect(type).toBe('error')
    expect(message).toContain('操作失败') // 应该是中文本地化消息
  })

  it('should handle success messages with context', () => {
    handleSuccessWithBanner('操作成功', mockSetBanner, {
      operation: 'save',
      component: 'form'
    })
    
    expect(mockSetBanner).toHaveBeenCalledWith('info', '保存成功')
  })

  it('should provide specialized error handlers', () => {
    // 设置全局回调
    enhancedErrorHandler.setBannerCallback(mockSetBanner)
    
    // 测试认证错误处理器
    const authError = { message: 'Authentication failed', code: 'AUTH_ERROR' }
    authErrorHandler.handleError(authError)
    
    expect(mockSetBanner).toHaveBeenCalled()
    
    // 测试表单错误处理器
    mockSetBanner.mockClear()
    const formError = { message: 'Validation failed', code: 'VALIDATION_ERROR' }
    formErrorHandler.handleError(formError)
    
    expect(mockSetBanner).toHaveBeenCalled()
    
    // 测试API错误处理器
    mockSetBanner.mockClear()
    const apiError = { message: 'Network failed', code: 'NETWORK_ERROR' }
    apiErrorHandler.handleError(apiError)
    
    expect(mockSetBanner).toHaveBeenCalled()
  })

  it('should suppress duplicate messages', () => {
    const error = { message: 'Duplicate error', code: 'TEST_ERROR' }
    const context = { operation: 'test', component: 'duplicate' }
    
    // 第一次调用应该显示消息
    handleErrorWithBanner(error, mockSetBanner, context)
    expect(mockSetBanner).toHaveBeenCalledTimes(1)
    
    // 立即再次调用相同错误应该被抑制
    handleErrorWithBanner(error, mockSetBanner, context)
    expect(mockSetBanner).toHaveBeenCalledTimes(1) // 仍然只有一次调用
  })

  it('should handle different error types appropriately', () => {
    // 网络错误
    const networkError = { message: 'Network connection failed', code: 'NETWORK_ERROR' }
    handleErrorWithBanner(networkError, mockSetBanner, {
      operation: 'fetch',
      component: 'api'
    })
    
    expect(mockSetBanner).toHaveBeenCalledWith('error', '网络连接失败，请检查网络后重试')
    
    // 权限错误
    mockSetBanner.mockClear()
    const permissionError = { message: 'Permission denied', code: 'PERMISSION_DENIED' }
    handleErrorWithBanner(permissionError, mockSetBanner, {
      operation: 'access',
      component: 'auth'
    })
    
    expect(mockSetBanner).toHaveBeenCalledWith('error', '权限不足，请联系管理员')
    
    // 验证错误
    mockSetBanner.mockClear()
    const validationError = { message: 'Validation failed', code: 'VALIDATION_ERROR' }
    handleErrorWithBanner(validationError, mockSetBanner, {
      operation: 'submit',
      component: 'form'
    })
    
    expect(mockSetBanner).toHaveBeenCalledWith('error', expect.stringContaining('输入'))
  })

  it('should provide contextual success messages', () => {
    enhancedErrorHandler.setBannerCallback(mockSetBanner)
    
    // 登录成功
    authErrorHandler.handleSuccess('Success')
    expect(mockSetBanner).toHaveBeenCalledWith('info', '登录成功')
    
    // 保存成功
    mockSetBanner.mockClear()
    formErrorHandler.handleSuccess('Success')
    expect(mockSetBanner).toHaveBeenCalledWith('info', '保存成功')
    
    // API成功
    mockSetBanner.mockClear()
    apiErrorHandler.handleSuccess('Success')
    expect(mockSetBanner).toHaveBeenCalledWith('info', 'Success') // API没有特定的成功消息映射
  })

  it('should handle complex error objects safely', () => {
    const complexError = {
      message: 'Complex error',
      code: 'COMPLEX_ERROR',
      details: {
        nested: {
          deep: 'value'
        }
      },
      stack: 'Error stack trace...'
    }
    
    expect(() => {
      handleErrorWithBanner(complexError, mockSetBanner, {
        operation: 'complex',
        component: 'test'
      })
    }).not.toThrow()
    
    expect(mockSetBanner).toHaveBeenCalled()
  })

  it('should handle null and undefined errors gracefully', () => {
    // null错误
    expect(() => {
      handleErrorWithBanner(null, mockSetBanner, {
        operation: 'null_test',
        component: 'test'
      })
    }).not.toThrow()
    
    expect(mockSetBanner).toHaveBeenCalled()
    
    // undefined错误
    mockSetBanner.mockClear()
    expect(() => {
      handleErrorWithBanner(undefined, mockSetBanner, {
        operation: 'undefined_test',
        component: 'test'
      })
    }).not.toThrow()
    
    expect(mockSetBanner).toHaveBeenCalled()
  })

  it('should create contextual handlers correctly', () => {
    const contextualHandler = enhancedErrorHandler.createContextualHandler({
      operation: 'contextual_test',
      component: 'test_component'
    })
    
    enhancedErrorHandler.setBannerCallback(mockSetBanner)
    
    const error = { message: 'Contextual error' }
    contextualHandler(error)
    
    expect(mockSetBanner).toHaveBeenCalled()
  })

  it('should handle batch operations correctly', () => {
    const errors = [
      { message: 'Error 1', code: 'ERROR_1' },
      { message: 'Error 2', code: 'ERROR_2' },
      { message: 'Error 3', code: 'ERROR_3' }
    ]
    
    errors.forEach((error, index) => {
      handleErrorWithBanner(error, mockSetBanner, {
        operation: 'batch',
        component: 'test',
        additionalData: {
          batchIndex: index
        }
      })
    })
    
    expect(mockSetBanner).toHaveBeenCalledTimes(3)
  })
})