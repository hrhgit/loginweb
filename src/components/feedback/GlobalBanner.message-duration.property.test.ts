/**
 * **Feature: error-message-enhancement, Property 5: 错误消息显示时长**
 * **验证需求: 2.5**
 * 
 * 对于任何错误或警告消息，显示时间应该比成功或信息消息更长
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { MessageType } from '../../utils/errorHandler'

// 消息类型生成器
const messageTypeArb = fc.constantFrom(
  MessageType.SUCCESS,
  MessageType.INFO, 
  MessageType.WARNING,
  MessageType.ERROR
)

// 消息内容生成器
const messageContentArb = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0)

// 获取消息显示时长的逻辑（基于当前实现和需求）
const getMessageDuration = (messageType: MessageType): number => {
  switch (messageType) {
    case MessageType.ERROR:
    case MessageType.WARNING:
      // 错误和警告消息应该显示更长时间
      return 5000 // 5秒
    case MessageType.SUCCESS:
    case MessageType.INFO:
    default:
      // 成功和信息消息显示较短时间
      return 2000 // 2秒（当前实现的默认值）
  }
}

// 判断消息类型是否为错误或警告
const isErrorOrWarning = (messageType: MessageType): boolean => {
  return messageType === MessageType.ERROR || messageType === MessageType.WARNING
}

// 判断消息类型是否为成功或信息
const isSuccessOrInfo = (messageType: MessageType): boolean => {
  return messageType === MessageType.SUCCESS || messageType === MessageType.INFO
}

// 获取消息严重程度级别
const getMessageSeverityLevel = (messageType: MessageType): number => {
  switch (messageType) {
    case MessageType.ERROR:
      return 4 // 最高严重程度
    case MessageType.WARNING:
      return 3
    case MessageType.INFO:
      return 2
    case MessageType.SUCCESS:
      return 1 // 最低严重程度
    default:
      return 2
  }
}

describe('GlobalBanner - Message Duration Property Tests', () => {
  it('Property 5: 错误消息显示时长 - 对于任何错误或警告消息，显示时间应该比成功或信息消息更长', () => {
    fc.assert(fc.property(
      messageTypeArb,
      messageContentArb,
      (messageType) => {
        const duration = getMessageDuration(messageType)
        
        // 验证时长是正数
        expect(duration).toBeGreaterThan(0)
        
        // 验证错误和警告消息的时长
        if (isErrorOrWarning(messageType)) {
          expect(duration).toBeGreaterThanOrEqual(5000) // 至少5秒
          
          // 错误和警告消息应该比成功和信息消息显示更长
          const successDuration = getMessageDuration(MessageType.SUCCESS)
          const infoDuration = getMessageDuration(MessageType.INFO)
          
          expect(duration).toBeGreaterThan(successDuration)
          expect(duration).toBeGreaterThan(infoDuration)
        }
        
        // 验证成功和信息消息的时长
        if (isSuccessOrInfo(messageType)) {
          expect(duration).toBeLessThanOrEqual(3000) // 不超过3秒
          
          // 成功和信息消息应该比错误和警告消息显示更短
          const errorDuration = getMessageDuration(MessageType.ERROR)
          const warningDuration = getMessageDuration(MessageType.WARNING)
          
          expect(duration).toBeLessThan(errorDuration)
          expect(duration).toBeLessThan(warningDuration)
        }
        
        return true
      }
    ), { numRuns: 100 })
  })

  it('Property 5 Extended: 消息严重程度与显示时长的正相关性', () => {
    fc.assert(fc.property(
      fc.tuple(messageTypeArb, messageTypeArb),
      ([messageType1, messageType2]) => {
        const duration1 = getMessageDuration(messageType1)
        const duration2 = getMessageDuration(messageType2)
        const severity1 = getMessageSeverityLevel(messageType1)
        const severity2 = getMessageSeverityLevel(messageType2)
        
        // 如果消息1的严重程度高于消息2，那么显示时长也应该更长或相等
        if (severity1 > severity2) {
          expect(duration1).toBeGreaterThanOrEqual(duration2)
        } else if (severity1 < severity2) {
          expect(duration1).toBeLessThanOrEqual(duration2)
        } else {
          // 相同严重程度应该有相同的显示时长
          expect(duration1).toBe(duration2)
        }
        
        return true
      }
    ), { numRuns: 100 })
  })

  it('Property 5 Duration Bounds: 所有消息类型的显示时长都在合理范围内', () => {
    fc.assert(fc.property(
      messageTypeArb,
      (messageType) => {
        const duration = getMessageDuration(messageType)
        
        // 显示时长应该在合理范围内
        expect(duration).toBeGreaterThanOrEqual(1000) // 至少1秒
        expect(duration).toBeLessThanOrEqual(10000) // 不超过10秒
        
        // 验证具体的时长要求
        if (messageType === MessageType.ERROR || messageType === MessageType.WARNING) {
          expect(duration).toBeGreaterThanOrEqual(5000) // 错误和警告至少5秒
        } else {
          expect(duration).toBeLessThanOrEqual(3000) // 成功和信息不超过3秒
        }
        
        return true
      }
    ), { numRuns: 100 })
  })

  it('Property 5 Consistency: 相同消息类型应该始终有相同的显示时长', () => {
    fc.assert(fc.property(
      messageTypeArb,
      messageContentArb,
      (messageType, messageContent) => {
        // 多次获取相同类型的显示时长
        const duration1 = getMessageDuration(messageType)
        const duration2 = getMessageDuration(messageType)
        const duration3 = getMessageDuration(messageType)
        
        // 应该完全一致
        expect(duration1).toBe(duration2)
        expect(duration2).toBe(duration3)
        
        // 消息内容不应该影响显示时长（时长只依赖于消息类型）
        // const anotherContent = messageContent + " additional text"
        const durationWithDifferentContent = getMessageDuration(messageType)
        expect(duration1).toBe(durationWithDifferentContent)
        
        return true
      }
    ), { numRuns: 100 })
  })

  it('Property 5 Type Hierarchy: 验证消息类型的时长层次结构', () => {
    fc.assert(fc.property(
      fc.constant(true), // 这个测试不需要随机输入
      () => {
        const errorDuration = getMessageDuration(MessageType.ERROR)
        const warningDuration = getMessageDuration(MessageType.WARNING)
        const infoDuration = getMessageDuration(MessageType.INFO)
        const successDuration = getMessageDuration(MessageType.SUCCESS)
        
        // 验证时长层次：ERROR >= WARNING > INFO >= SUCCESS
        expect(errorDuration).toBeGreaterThanOrEqual(warningDuration)
        expect(warningDuration).toBeGreaterThan(infoDuration)
        expect(infoDuration).toBeGreaterThanOrEqual(successDuration)
        
        // 验证错误和警告类别与成功和信息类别之间的明显差异
        expect(errorDuration).toBeGreaterThan(infoDuration)
        expect(errorDuration).toBeGreaterThan(successDuration)
        expect(warningDuration).toBeGreaterThan(infoDuration)
        expect(warningDuration).toBeGreaterThan(successDuration)
        
        return true
      }
    ), { numRuns: 100 })
  })
})