/**
 * Integration test for the complete batch download workflow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { downloadSubmissionsBatch } from './downloadUtils'
import type { ExportProgress } from './exportUtils'

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

// Mock DOM methods
Object.defineProperty(document, 'createElement', {
  value: vi.fn(() => ({
    href: '',
    download: '',
    style: { display: '' },
    click: vi.fn()
  })),
  writable: true
})

Object.defineProperty(document.body, 'appendChild', {
  value: vi.fn(),
  writable: true
})

Object.defineProperty(document.body, 'removeChild', {
  value: vi.fn(),
  writable: true
})

describe('Batch Download Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should complete full batch download workflow', async () => {
    // Mock successful Supabase responses
    const { supabase } = await import('../lib/supabase')
    const mockCreateSignedUrl = vi.fn()
      .mockResolvedValueOnce({
        data: { signedUrl: 'https://example.com/file1.zip' },
        error: null
      })
      .mockResolvedValueOnce({
        data: { signedUrl: 'https://example.com/file2.zip' },
        error: null
      })
    
    supabase.storage.from = vi.fn(() => ({
      createSignedUrl: mockCreateSignedUrl
    })) as any

    // Mock submissions data
    const mockSubmissions = [
      {
        id: '1',
        project_name: 'Test Project 1',
        team: { name: 'Team Alpha' },
        submission_storage_path: 'path/to/file1.zip',
        created_at: '2024-01-01T10:00:00Z'
      },
      {
        id: '2',
        project_name: 'Test Project 2',
        team: { name: 'Team Beta' },
        submission_storage_path: 'path/to/file2.zip',
        created_at: '2024-01-01T11:00:00Z'
      }
    ]

    // Track progress updates
    const progressUpdates: ExportProgress[] = []
    const onProgress = (progress: ExportProgress) => {
      progressUpdates.push({ ...progress })
    }

    // Execute batch download
    const result = await downloadSubmissionsBatch(
      mockSubmissions,
      onProgress,
      {
        batchSize: 1,
        delayBetweenBatches: 10, // Short delay for testing
        maxRetries: 1
      }
    )

    // Verify results
    expect(result.total).toBe(2)
    expect(result.successful).toBe(2)
    expect(result.failed).toBe(0)
    expect(result.errors).toHaveLength(0)

    // Verify progress tracking
    expect(progressUpdates.length).toBeGreaterThan(0)
    expect(progressUpdates[progressUpdates.length - 1].completed).toBe(true)

    // Verify Supabase calls
    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(2)
    expect(mockCreateSignedUrl).toHaveBeenCalledWith('path/to/file1.zip', 3600, {
      download: '001-Team_Alpha-Test_Project_1.zip'
    })
    expect(mockCreateSignedUrl).toHaveBeenCalledWith('path/to/file2.zip', 3600, {
      download: '002-Team_Beta-Test_Project_2.zip'
    })

    // Verify DOM interactions
    expect(document.createElement).toHaveBeenCalledTimes(2)
    expect(document.body.appendChild).toHaveBeenCalledTimes(2)
    expect(document.body.removeChild).toHaveBeenCalledTimes(2)
  })

  it('should handle partial failures gracefully', async () => {
    // Mock mixed success/failure responses
    const { supabase } = await import('../lib/supabase')
    const mockCreateSignedUrl = vi.fn()
      .mockResolvedValueOnce({
        data: { signedUrl: 'https://example.com/file1.zip' },
        error: null
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'File not found' }
      })
    
    supabase.storage.from = vi.fn(() => ({
      createSignedUrl: mockCreateSignedUrl
    })) as any

    const mockSubmissions = [
      {
        id: '1',
        project_name: 'Working Project',
        team: { name: 'Team Alpha' },
        submission_storage_path: 'path/to/working.zip',
        created_at: '2024-01-01T10:00:00Z'
      },
      {
        id: '2',
        project_name: 'Broken Project',
        team: { name: 'Team Beta' },
        submission_storage_path: 'path/to/missing.zip',
        created_at: '2024-01-01T11:00:00Z'
      }
    ]

    const result = await downloadSubmissionsBatch(
      mockSubmissions,
      undefined,
      { batchSize: 1, delayBetweenBatches: 10 }
    )

    // Verify partial success
    expect(result.total).toBe(2)
    expect(result.successful).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('下载文件失败')
  })

  it('should respect selection limits', async () => {
    // Create submissions exceeding the limit
    const tooManySubmissions = Array.from({ length: 51 }, (_, i) => ({
      id: `${i + 1}`,
      project_name: `Project ${i + 1}`,
      team: { name: `Team ${i + 1}` },
      submission_storage_path: `path/to/file${i + 1}.zip`,
      created_at: `2024-01-01T${String(10 + i).padStart(2, '0')}:00:00Z`
    }))

    // Should throw validation error
    await expect(downloadSubmissionsBatch(tooManySubmissions))
      .rejects.toThrow('最多只能选择50个文件')
  })
})