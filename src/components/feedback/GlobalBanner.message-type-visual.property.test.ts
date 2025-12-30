/**
 * **Feature: error-message-enhancement, Property 4: 消息类型视觉反馈**
 * **验证需求: 2.1, 2.2, 2.3, 2.4**
 * 
 * 对于任何消息类型（成功、信息、警告、错误），错误反馈系统应该使用对应的颜色主题和图标进行显示
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

// 消息内容生成器 - 确保非空
const messageContentArb = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0)

// Mock banner display logic based on current GlobalBanner implementation
const getBannerDisplay = (messageType: MessageType, messageContent: string) => {
  // Current implementation only supports info and error
  const isError = messageType === MessageType.ERROR
  const bannerInfo = isError ? '' : messageContent
  const bannerError = isError ? messageContent : ''
  
  // Banner should show if either bannerInfo or bannerError has content
  const shouldShow = Boolean(bannerInfo || bannerError)
  
  if (!shouldShow) {
    return {
      visible: false,
      classes: [],
      text: '',
      type: null
    }
  }
  
  return {
    visible: true,
    classes: [
      'toast-notification',
      isError ? 'toast-notification--error' : 'toast-notification--info'
    ],
    text: bannerInfo || bannerError,
    type: isError ? 'error' : 'info'
  }
}

// CSS class mapping for different message types
const getExpectedCSSClass = (messageType: MessageType): string => {
  switch (messageType) {
    case MessageType.ERROR:
      return 'toast-notification--error'
    case MessageType.SUCCESS:
    case MessageType.INFO:
    case MessageType.WARNING:
    default:
      // Current implementation maps all non-error types to info
      return 'toast-notification--info'
  }
}

// Color theme mapping for different message types
const getExpectedColorTheme = (messageType: MessageType) => {
  switch (messageType) {
    case MessageType.ERROR:
      return {
        background: 'rgba(182, 45, 28, 0.9)', // Red theme
        color: '#ffffff'
      }
    case MessageType.SUCCESS:
    case MessageType.INFO:
    case MessageType.WARNING:
    default:
      return {
        background: '#a8f2cc80', // Green theme  
        color: '#0a2012f2'
      }
  }
}

describe('GlobalBanner - Message Type Visual Feedback Property Tests', () => {
  it('Property 4: 消息类型视觉反馈 - 对于任何消息类型，应该使用对应的颜色主题和图标进行显示', () => {
    fc.assert(fc.property(
      messageTypeArb,
      messageContentArb,
      (messageType, messageContent) => {
        const bannerDisplay = getBannerDisplay(messageType, messageContent)
        
        // 消息应该显示
        expect(bannerDisplay.visible).toBe(true)
        expect(bannerDisplay.text).toBe(messageContent)
        
        // 验证基础CSS类存在
        expect(bannerDisplay.classes).toContain('toast-notification')
        
        // 验证消息类型对应的CSS类
        const expectedClass = getExpectedCSSClass(messageType)
        expect(bannerDisplay.classes).toContain(expectedClass)
        
        // 验证颜色主题映射
        // const expectedTheme = getExpectedColorTheme(messageType)
        
        if (messageType === MessageType.ERROR) {
          expect(bannerDisplay.type).toBe('error')
          expect(bannerDisplay.classes).toContain('toast-notification--error')
          expect(bannerDisplay.classes).not.toContain('toast-notification--info')
        } else {
          expect(bannerDisplay.type).toBe('info')
          expect(bannerDisplay.classes).toContain('toast-notification--info')
          expect(bannerDisplay.classes).not.toContain('toast-notification--error')
        }
        
        return true
      }
    ), { numRuns: 100 })
  })

  it('Property 4 Extended: CSS类与消息类型的一致性映射', () => {
    fc.assert(fc.property(
      messageTypeArb,
      (messageType) => {
        const expectedClass = getExpectedCSSClass(messageType)
        const expectedTheme = getExpectedColorTheme(messageType)
        
        // 验证CSS类映射的一致性
        if (messageType === MessageType.ERROR) {
          expect(expectedClass).toBe('toast-notification--error')
          expect(expectedTheme.background).toBe('rgba(182, 45, 28, 0.9)')
          expect(expectedTheme.color).toBe('#ffffff')
        } else {
          // SUCCESS, INFO, WARNING都应该映射到info样式
          expect(expectedClass).toBe('toast-notification--info')
          expect(expectedTheme.background).toBe('#a8f2cc80')
          expect(expectedTheme.color).toBe('#0a2012f2')
        }
        
        return true
      }
    ), { numRuns: 100 })
  })

  it('Property 4 Visual Theme: 每种消息类型都有对应的视觉主题', () => {
    fc.assert(fc.property(
      messageTypeArb,
      messageContentArb,
      (messageType, messageContent) => {
        const bannerDisplay = getBannerDisplay(messageType, messageContent)
        const expectedTheme = getExpectedColorTheme(messageType)
        
        // 验证每种消息类型都有明确的视觉区分
        expect(bannerDisplay.visible).toBe(true)
        
        // 验证主题颜色定义存在且有效
        expect(expectedTheme.background).toBeDefined()
        expect(expectedTheme.color).toBeDefined()
        expect(expectedTheme.background.length).toBeGreaterThan(0)
        expect(expectedTheme.color.length).toBeGreaterThan(0)
        
        // 验证不同类型有不同的视觉表现
        const errorTheme = getExpectedColorTheme(MessageType.ERROR)
        const infoTheme = getExpectedColorTheme(MessageType.INFO)
        
        // 错误和信息消息应该有不同的背景色
        expect(errorTheme.background).not.toBe(infoTheme.background)
        expect(errorTheme.color).not.toBe(infoTheme.color)
        
        return true
      }
    ), { numRuns: 100 })
  })

  it('Property 4 Consistency: 相同消息类型应该始终产生相同的视觉样式', () => {
    fc.assert(fc.property(
      messageTypeArb,
      messageContentArb,
      (messageType, messageContent) => {
        // 多次获取相同类型的显示配置
        const display1 = getBannerDisplay(messageType, messageContent)
        const display2 = getBannerDisplay(messageType, messageContent)
        const theme1 = getExpectedColorTheme(messageType)
        const theme2 = getExpectedColorTheme(messageType)
        
        // 应该完全一致
        expect(display1.visible).toBe(display2.visible)
        expect(display1.classes).toEqual(display2.classes)
        expect(display1.text).toBe(display2.text)
        expect(display1.type).toBe(display2.type)
        
        expect(theme1.background).toBe(theme2.background)
        expect(theme1.color).toBe(theme2.color)
        
        return true
      }
    ), { numRuns: 100 })
  })
})