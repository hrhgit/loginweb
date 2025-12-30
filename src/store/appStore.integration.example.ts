/**
 * 错误消息反馈系统增强 - appStore.ts 集成示例
 * 
 * 这个文件展示了如何将增强的错误处理集成到现有的 appStore.ts 中
 * 
 * 主要改进：
 * 1. 替换现有的 setBanner 调用为增强的错误处理
 * 2. 实现上下文感知的错误消息生成
 * 3. 添加重复消息合并逻辑
 * 4. 提供更好的错误分类和本地化
 */

import { 
  enhancedErrorHandler, 
  handleErrorWithBanner, 
  handleSuccessWithBanner,
  authErrorHandler,
  formErrorHandler,
  apiErrorHandler,
  teamErrorHandler,
  eventErrorHandler,
  profileErrorHandler
} from './enhancedErrorHandling'

// 示例：如何在现有的 appStore 函数中集成增强错误处理

/**
 * 示例 1: 替换简单的 setBanner 调用
 * 
 * 原始代码：
 * setBanner('error', error.message)
 * 
 * 增强后：
 */
function exampleSimpleErrorHandling(error: any, setBanner: (type: 'info' | 'error', text: string) => void) {
  // 使用增强的错误处理，自动提供中文本地化和错误分类
  handleErrorWithBanner(error, setBanner, {
    operation: 'general',
    component: 'app'
  })
}

/**
 * 示例 2: 登录功能的错误处理
 * 
 * 原始代码：
 * if (error) authError.value = error.message
 * 
 * 增强后：
 */
function exampleAuthErrorHandling(error: any, setBanner: (type: 'info' | 'error', text: string) => void) {
  // 使用专门的认证错误处理器
  authErrorHandler.handleError(error, {
    userId: 'current-user-id', // 可选的额外上下文
    additionalData: {
      loginAttempt: true
    }
  })
  
  // 或者使用通用处理器但指定上下文
  handleErrorWithBanner(error, setBanner, {
    operation: 'login',
    component: 'auth'
  })
}

/**
 * 示例 3: 表单提交的错误处理
 */
function exampleFormErrorHandling(error: any, setBanner: (type: 'info' | 'error', text: string) => void) {
  // 表单错误通常需要更详细的验证信息
  formErrorHandler.handleError(error, {
    additionalData: {
      formType: 'registration',
      fieldCount: 5
    }
  })
}

/**
 * 示例 4: API 调用的错误处理
 */
function exampleApiErrorHandling(error: any, setBanner: (type: 'info' | 'error', text: string) => void) {
  // API错误可能需要重试功能
  handleErrorWithBanner(error, setBanner, {
    operation: 'fetch_events',
    component: 'api'
  }, {
    canRetry: true,
    onRetry: () => {
      console.log('Retrying API call...')
      // 重试逻辑
    }
  })
}

/**
 * 示例 5: 成功消息的处理
 */
function exampleSuccessHandling(setBanner: (type: 'info' | 'error', text: string) => void) {
  // 原始代码：setBanner('info', '操作成功')
  // 增强后：
  handleSuccessWithBanner('操作成功', setBanner, {
    operation: 'save',
    component: 'form'
  })
  
  // 或者使用专门的处理器
  formErrorHandler.handleSuccess('表单保存成功')
}

/**
 * 示例 6: 团队操作的错误处理
 */
function exampleTeamErrorHandling(error: any, setBanner: (type: 'info' | 'error', text: string) => void, teamId: string) {
  teamErrorHandler.handleError(error, {
    additionalData: {
      teamId: teamId,
      operation: 'join_team'
    }
  })
}

/**
 * 示例 7: 事件管理的错误处理
 */
function exampleEventErrorHandling(error: any, setBanner: (type: 'info' | 'error', text: string) => void, eventId: string) {
  eventErrorHandler.handleError(error, {
    additionalData: {
      eventId: eventId,
      userRole: 'admin'
    }
  })
}

/**
 * 示例 8: 个人资料更新的错误处理
 */
function exampleProfileErrorHandling(error: any, setBanner: (type: 'info' | 'error', text: string) => void) {
  profileErrorHandler.handleError(error, {
    additionalData: {
      updateType: 'avatar',
      fileSize: '2MB'
    }
  })
}

/**
 * 示例 9: 批量操作的错误处理
 */
function exampleBatchErrorHandling(errors: any[], setBanner: (type: 'info' | 'error', text: string) => void) {
  // 对于批量操作，我们可能想要合并相似的错误
  errors.forEach((error, index) => {
    handleErrorWithBanner(error, setBanner, {
      operation: 'batch_upload',
      component: 'file',
      additionalData: {
        batchIndex: index,
        totalItems: errors.length
      }
    })
  })
}

/**
 * 示例 10: 网络错误的特殊处理
 */
function exampleNetworkErrorHandling(error: any, setBanner: (type: 'info' | 'error', text: string) => void) {
  // 网络错误通常应该提供重试选项
  const errorResponse = handleErrorWithBanner(error, setBanner, {
    operation: 'network_request',
    component: 'api'
  }, {
    canRetry: true,
    onRetry: async () => {
      // 实现重试逻辑
      console.log('Retrying network request...')
      // await retryNetworkRequest()
    },
    suggestions: [
      '检查网络连接',
      '稍后重试',
      '联系技术支持'
    ]
  })
  
  // 可以根据错误响应做进一步处理
  if (errorResponse.canRetry) {
    console.log('This error can be retried')
  }
}

/**
 * 示例 11: 条件错误处理
 */
function exampleConditionalErrorHandling(error: any, setBanner: (type: 'info' | 'error', text: string) => void, userRole: string) {
  const context = {
    operation: 'access_resource',
    component: 'authorization',
    additionalData: {
      userRole: userRole
    }
  }
  
  // 根据用户角色提供不同的错误处理
  if (userRole === 'admin') {
    handleErrorWithBanner(error, setBanner, {
      ...context,
      operation: 'admin_access'
    })
  } else {
    handleErrorWithBanner(error, setBanner, context)
  }
}

/**
 * 示例 12: 初始化增强错误处理器
 */
function initializeEnhancedErrorHandling(setBanner: (type: 'info' | 'error', text: string) => void) {
  // 设置全局的 setBanner 回调
  enhancedErrorHandler.setBannerCallback(setBanner)
  
  // 现在可以直接使用各种错误处理器，无需每次传递 setBanner
  return {
    handleAuthError: (error: any) => authErrorHandler.handleError(error),
    handleFormError: (error: any) => formErrorHandler.handleError(error),
    handleApiError: (error: any) => apiErrorHandler.handleError(error),
    handleTeamError: (error: any) => teamErrorHandler.handleError(error),
    handleEventError: (error: any) => eventErrorHandler.handleError(error),
    handleProfileError: (error: any) => profileErrorHandler.handleError(error),
    
    handleAuthSuccess: (message: string) => authErrorHandler.handleSuccess(message),
    handleFormSuccess: (message: string) => formErrorHandler.handleSuccess(message),
    handleApiSuccess: (message: string) => apiErrorHandler.handleSuccess(message),
    handleTeamSuccess: (message: string) => teamErrorHandler.handleSuccess(message),
    handleEventSuccess: (message: string) => eventErrorHandler.handleSuccess(message),
    handleProfileSuccess: (message: string) => profileErrorHandler.handleSuccess(message)
  }
}

// 导出示例函数供参考
export {
  exampleSimpleErrorHandling,
  exampleAuthErrorHandling,
  exampleFormErrorHandling,
  exampleApiErrorHandling,
  exampleSuccessHandling,
  exampleTeamErrorHandling,
  exampleEventErrorHandling,
  exampleProfileErrorHandling,
  exampleBatchErrorHandling,
  exampleNetworkErrorHandling,
  exampleConditionalErrorHandling,
  initializeEnhancedErrorHandling
}