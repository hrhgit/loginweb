import { describe, it, expect } from 'vitest'
import { truncateText, truncateTeamIntro, truncateSeekerIntro } from './textUtils'

describe('textUtils', () => {
  describe('truncateText', () => {
    it('should return empty string for null/undefined input', () => {
      expect(truncateText(null, 10)).toBe('')
      expect(truncateText(undefined, 10)).toBe('')
    })

    it('should return original text if within limit', () => {
      const text = '这是一个短文本'
      expect(truncateText(text, 20)).toBe(text)
    })

    it('should truncate text and add ellipsis if exceeds limit', () => {
      const text = '这是一个很长的文本内容，需要被截断处理'
      const result = truncateText(text, 10)
      expect(result).toBe('这是一个很长的文本内...')
      expect(result.length).toBe(13) // 10 + 3 (ellipsis)
    })

    it('should use custom suffix', () => {
      const text = '这是一个很长的文本'
      const result = truncateText(text, 5, '...')
      expect(result).toBe('这是一个很...')
    })

    it('should trim whitespace', () => {
      const text = '  这是文本  '
      expect(truncateText(text, 20)).toBe('这是文本')
    })
  })

  describe('truncateTeamIntro', () => {
    it('should truncate team intro to 50 characters', () => {
      const longIntro = '我们是一个充满激情的游戏开发团队，专注于创造有趣且富有创意的游戏体验。我们的团队成员来自不同的背景，包括程序员、美术师、策划师等。'
      const result = truncateTeamIntro(longIntro)
      expect(result.length).toBeLessThanOrEqual(53) // 50 + 3 (ellipsis)
      expect(result).toContain('...')
    })

    it('should return original text if within 50 characters', () => {
      const shortIntro = '我们是一个游戏开发团队'
      expect(truncateTeamIntro(shortIntro)).toBe(shortIntro)
    })
  })

  describe('truncateSeekerIntro', () => {
    it('should truncate seeker intro to 100 characters', () => {
      const longIntro = '大家好，我是一名资深的游戏程序员，有着丰富的Unity和Unreal Engine开发经验。我热爱游戏开发，特别是在游戏机制设计和性能优化方面有着深入的研究。我希望能够找到志同道合的队友，一起创造出令人惊艳的游戏作品。'
      const result = truncateSeekerIntro(longIntro)
      expect(result.length).toBeLessThanOrEqual(103) // 100 + 3 (ellipsis)
      expect(result).toContain('...')
    })

    it('should return original text if within 100 characters', () => {
      const shortIntro = '我是一名程序员，希望找到队友一起开发游戏'
      expect(truncateSeekerIntro(shortIntro)).toBe(shortIntro)
    })
  })
})