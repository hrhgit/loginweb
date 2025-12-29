/**
 * Tests for enhanced batch download functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  validateFileSelection,
  generateSignedDownloadUrl,
  BATCH_DOWNLOAD_LIMITS,
  triggerBrowserDownload,
  delay
} from './downloadUtils'

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn()
      }))
    }
  }
}))

describe('Enhanced Batch Download System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('validateFileSelection', () => {
    it('should reject empty selection', () => {
      const result = validateFileSelection(0)
      expect(result.valid).toBe(false)
      expect(result.message).toBe('请选择要下载的文件')
    })

    it('should reject selection over limit', () => {
      const result = validateFileSelection(BATCH_DOWNLOAD_LIMITS.maxSelectionCount + 1)
      expect(result.valid).toBe(false)
      expect(result.message).toContain('最多只能选择')
    })

    it('should warn for large selections', () => {
      const result = validateFileSelection(BATCH_DOWNLOAD_LIMITS.warningThreshold + 1)
      expect(result.valid).toBe(true)
      expect(result.warning).toContain('预计需要较长时间')
    })

    it('should accept valid selections', () => {
      const result = validateFileSelection(10)
      expect(result.valid).toBe(true)
      expect(result.warning).toBeUndefined()
    })
  })

  describe('triggerBrowserDownload', () => {
    it('should create and click download link', () => {
      // Mock DOM methods
      const mockLink = {
        href: '',
        download: '',
        style: { display: '' },
        click: vi.fn()
      }
      const createElement = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any)
      const appendChild = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any)
      const removeChild = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any)

      triggerBrowserDownload('https://example.com/file.zip', 'test-file.zip')

      expect(createElement).toHaveBeenCalledWith('a')
      expect(mockLink.href).toBe('https://example.com/file.zip')
      expect(mockLink.download).toBe('test-file.zip')
      expect(mockLink.click).toHaveBeenCalled()
      expect(appendChild).toHaveBeenCalledWith(mockLink)
      expect(removeChild).toHaveBeenCalledWith(mockLink)
    })
  })

  describe('delay', () => {
    it('should resolve after specified time', async () => {
      const start = Date.now()
      await delay(100)
      const elapsed = Date.now() - start
      expect(elapsed).toBeGreaterThanOrEqual(90) // Allow some tolerance
    })
  })

  describe('generateSignedDownloadUrl', () => {
    it('should generate signed URL with custom filename', async () => {
      const { supabase } = await import('../lib/supabase')
      const mockCreateSignedUrl = vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://example.com/signed-url' },
        error: null
      })
      
      supabase.storage.from = vi.fn(() => ({
        createSignedUrl: mockCreateSignedUrl
      })) as any

      const result = await generateSignedDownloadUrl('path/to/file.zip', 'custom-name.zip')

      expect(supabase.storage.from).toHaveBeenCalledWith('submission-files')
      expect(mockCreateSignedUrl).toHaveBeenCalledWith('path/to/file.zip', 3600, {
        download: 'custom-name.zip'
      })
      expect(result).toBe('https://example.com/signed-url')
    })

    it('should handle storage errors', async () => {
      const { supabase } = await import('../lib/supabase')
      const mockCreateSignedUrl = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Storage error' }
      })
      
      supabase.storage.from = vi.fn(() => ({
        createSignedUrl: mockCreateSignedUrl
      })) as any

      try {
        await generateSignedDownloadUrl('path/to/file.zip', 'custom-name.zip')
        expect.fail('Should have thrown an error')
      } catch (error: any) {
        expect(error.message).toBe('生成下载链接失败: Storage error')
        expect(error.type).toBe('storage')
      }
    })
  })

  describe('BATCH_DOWNLOAD_LIMITS', () => {
    it('should have correct limit values', () => {
      expect(BATCH_DOWNLOAD_LIMITS.maxSelectionCount).toBe(50)
      expect(BATCH_DOWNLOAD_LIMITS.warningThreshold).toBe(30)
      expect(BATCH_DOWNLOAD_LIMITS.recommendedBatchSize).toBe(20)
    })
  })
})