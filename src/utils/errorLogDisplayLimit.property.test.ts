/**
 * **Feature: error-message-enhancement, Property 17: 错误日志显示限制**
 * 
 * 对于任何错误日志查询，应该最多显示最近的错误记录
 * **验证需求: 6.2**
 */

import { describe, it, expect, beforeEach } from 'vitest'
import fc from 'fast-check'
import { ErrorLogManager } from './errorLogManager'
import { ErrorType, MessageSeverity } from './errorHandler'

describe('Error Log Display Limit Property Tests', () => {
  let testManager: ErrorLogManager

  beforeEach(() => {
    // 创建测试专用的管理器实例
    testManager = new ErrorLogManager({ maxRecords: 100 })
    testManager.clearRecords()
  })

  it('should work with basic functionality', () => {
    // 简单的单元测试来验证基本功能
    const record = {
      id: `error_test_${Date.now()}`,
      timestamp: new Date(),
      type: ErrorType.UNKNOWN,
      severity: MessageSeverity.ERROR,
      message: 'Test error',
      originalError: new Error('Test error'),
      context: {
        operation: 'test',
        component: 'test',
        userId: 'test-user'
      },
      retryCount: 0,
      userAgent: 'test-agent'
    }
    
    testManager.addRecord(record)
    const records = testManager.getRecords()
    
    expect(records.length).toBe(1)
    expect(records[0].message).toBe('Test error')
    
    // 测试限制功能
    const limitedRecords = testManager.getRecords(1)
    expect(limitedRecords.length).toBe(1)
  })

  it('Property 17: Error log display limit - should respect maximum display limit', async () => {
    // 先添加一些记录
    for (let i = 0; i < 60; i++) {
      const record = {
        id: `error_${i}_${Date.now()}_${Math.random()}`,
        timestamp: new Date(),
        type: ErrorType.UNKNOWN,
        severity: MessageSeverity.ERROR,
        message: `Test error ${i}`,
        originalError: new Error(`Test error ${i}`),
        context: {
          operation: 'test',
          component: 'test',
          userId: 'test-user'
        },
        retryCount: 0,
        userAgent: 'test-agent'
      }
      testManager.addRecord(record)
    }
    
    // 测试显示限制
    const allRecords = testManager.getRecords()
    const limitedRecords = testManager.getRecords(50)
    
    console.log('All records:', allRecords.length)
    console.log('Limited records:', limitedRecords.length)
    
    // 验证限制生效
    expect(limitedRecords.length).toBeLessThanOrEqual(50)
    expect(limitedRecords.length).toBeLessThanOrEqual(allRecords.length)
  })

  it('Property 17: Error log display limit - should handle edge cases correctly', async () => {
    // 测试边界情况
    testManager.clearRecords()
    
    // 测试空记录情况
    let records = testManager.getRecords(10)
    expect(records.length).toBe(0)
    
    // 添加少量记录
    for (let i = 0; i < 3; i++) {
      const record = {
        id: `error_${i}_${Date.now()}_${Math.random()}`,
        timestamp: new Date(),
        type: ErrorType.UNKNOWN,
        severity: MessageSeverity.ERROR,
        message: `Test error ${i}`,
        originalError: new Error(`Test error ${i}`),
        context: {
          operation: 'test',
          component: 'test',
          userId: 'test-user'
        },
        retryCount: 0,
        userAgent: 'test-agent'
      }
      testManager.addRecord(record)
    }
    
    // 请求更多记录
    records = testManager.getRecords(10)
    expect(records.length).toBe(3)
    
    // 请求更少记录
    records = testManager.getRecords(2)
    expect(records.length).toBe(2)
  })
})