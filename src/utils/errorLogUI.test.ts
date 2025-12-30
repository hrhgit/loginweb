/**
 * 错误日志用户界面集成测试
 * 
 * 验证错误日志界面的基本功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { errorLogManager } from './errorLogManager'
import { createErrorRecord } from './errorLogManager'
import { ErrorType, MessageSeverity } from './errorHandler'

describe('Error Log UI Integration Tests', () => {
  beforeEach(() => {
    // 清理错误日志
    errorLogManager.clearRecords()
  })

  afterEach(() => {
    // 清理错误日志
    errorLogManager.clearRecords()
  })

  it('should be able to add and retrieve error records for UI display', () => {
    // 创建测试错误记录
    const testError = new Error('测试网络错误')
    const testContext = {
      operation: 'login',
      component: 'auth'
    }

    const errorRecord = createErrorRecord(
      testError,
      testContext,
      ErrorType.NETWORK,
      MessageSeverity.WARNING
    )

    // 添加错误记录
    errorLogManager.addRecordSync(errorRecord)

    // 获取错误记录
    const records = errorLogManager.getRecords()

    // 验证记录存在
    expect(records).toHaveLength(1)
    expect(records[0].message).toBe('测试网络错误')
    expect(records[0].type).toBe(ErrorType.NETWORK)
    expect(records[0].context.operation).toBe('login')
    expect(records[0].context.component).toBe('auth')
  })

  it('should be able to generate feedback report for UI display', () => {
    // 添加多个错误记录
    const errors = [
      { message: '网络连接失败', type: ErrorType.NETWORK },
      { message: '权限不足', type: ErrorType.PERMISSION },
      { message: '验证失败', type: ErrorType.VALIDATION }
    ]

    errors.forEach(error => {
      const errorRecord = createErrorRecord(
        new Error(error.message),
        { operation: 'test', component: 'test' },
        error.type,
        MessageSeverity.WARNING
      )
      errorLogManager.addRecordSync(errorRecord)
    })

    // 生成反馈报告
    const report = errorLogManager.generateFeedbackReport()

    // 验证报告内容
    expect(report.errors).toHaveLength(3)
    expect(report.summary).toContain('网络错误: 1')
    expect(report.summary).toContain('权限错误: 1')
    expect(report.summary).toContain('验证错误: 1')
    expect(report.environment.userAgent).toBeDefined()
    expect(report.environment.sessionId).toBeDefined()
  })

  it('should be able to clear all error records', () => {
    // 添加一些错误记录
    const errorRecord = createErrorRecord(
      new Error('测试错误'),
      { operation: 'test', component: 'test' },
      ErrorType.UNKNOWN,
      MessageSeverity.WARNING
    )

    errorLogManager.addRecordSync(errorRecord)
    expect(errorLogManager.getRecords()).toHaveLength(1)

    // 清除所有记录
    errorLogManager.clearRecords()
    expect(errorLogManager.getRecords()).toHaveLength(0)
  })

  it('should provide storage information for UI display', () => {
    // 添加一些错误记录
    const errorRecord = createErrorRecord(
      new Error('测试错误'),
      { operation: 'test', component: 'test' },
      ErrorType.UNKNOWN,
      MessageSeverity.WARNING
    )

    errorLogManager.addRecordSync(errorRecord)

    // 获取存储信息
    const storageInfo = errorLogManager.getStorageInfo()

    // 验证存储信息
    expect(storageInfo.recordCount).toBe(1)
    expect(storageInfo.used).toBeGreaterThan(0)
    expect(storageInfo.limit).toBeGreaterThan(0)
    expect(storageInfo.used).toBeLessThanOrEqual(storageInfo.limit)
  })

  it('should handle empty error log gracefully', () => {
    // 确保错误日志为空
    errorLogManager.clearRecords()

    // 获取错误记录
    const records = errorLogManager.getRecords()
    expect(records).toHaveLength(0)

    // 生成反馈报告
    const report = errorLogManager.generateFeedbackReport()
    expect(report.summary).toBe('暂无错误记录')
    expect(report.errors).toHaveLength(0)

    // 获取存储信息
    const storageInfo = errorLogManager.getStorageInfo()
    expect(storageInfo.recordCount).toBe(0)
    expect(storageInfo.used).toBe(0)
  })
})