/**
 * Download management utilities for batch file downloads
 * Handles sequential downloads, progress tracking, and error handling
 */

import type { SubmissionFileInfo, ExportError, ExportProgress } from './exportUtils'
import { 
  createExportError, 
  isRetryableError, 
  retryWithBackoff, 
  processSubmissionsForDownload,
  generateSubmissionFilename,
  ProgressTracker
} from './exportUtils'
import { supabase } from '../lib/supabase'

// ============================================================
// Download Management Types
// ============================================================

export interface DownloadOptions {
  batchSize?: number
  delayBetweenBatches?: number
  maxRetries?: number
  retryDelay?: number
}

export interface DownloadResult {
  success: boolean
  filename: string
  error?: ExportError
  downloadUrl?: string
}

export interface BatchDownloadSummary {
  total: number
  successful: number
  failed: number
  errors: ExportError[]
  duration: number
}

// ============================================================
// Supabase Storage Integration
// ============================================================

/**
 * Generates a signed URL for file download with custom filename
 */
export const generateSignedDownloadUrl = async (
  storagePath: string,
  customFilename: string,
  bucketName = 'submission-files',
  expiresIn = 3600
): Promise<string> => {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(storagePath, expiresIn, {
        download: customFilename
      })
    
    if (error) {
      throw createExportError(
        'storage',
        `生成下载链接失败: ${error.message}`,
        error,
        true
      )
    }
    
    if (!data?.signedUrl) {
      throw createExportError(
        'storage',
        '未能获取有效的下载链接',
        null,
        true
      )
    }
    
    return data.signedUrl
  } catch (error) {
    if (error && typeof error === 'object' && 'type' in error) {
      // Re-throw ExportError as-is
      throw error
    }
    
    throw createExportError(
      'storage',
      `存储服务错误: ${error instanceof Error ? error.message : '未知错误'}`,
      error,
      true
    )
  }
}

// ============================================================
// Browser Download Utilities
// ============================================================

/**
 * Triggers a browser download using a URL and custom filename
 */
export const triggerBrowserDownload = (url: string, filename: string): void => {
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.display = 'none'
    
    // Add to DOM, click, and remove
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    throw createExportError(
      'processing',
      `触发下载失败: ${error instanceof Error ? error.message : '未知错误'}`,
      error,
      false
    )
  }
}

/**
 * Creates a delay promise for controlling download pace
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================================
// Batch Download Management
// ============================================================

/**
 * Downloads multiple files sequentially with progress tracking
 */
export const downloadFilesSequentially = async (
  files: SubmissionFileInfo[],
  generateDownloadUrl: (file: SubmissionFileInfo) => Promise<string>,
  generateFilename: (file: SubmissionFileInfo) => string,
  progressTracker: ProgressTracker,
  options: DownloadOptions = {}
): Promise<BatchDownloadSummary> => {
  const {
    batchSize = 1,
    delayBetweenBatches = 500,
    maxRetries = 3,
    retryDelay = 1000
  } = options
  
  const startTime = Date.now()
  const results: DownloadResult[] = []
  const errors: ExportError[] = []
  
  // Process files in batches
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize)
    
    // Process batch (sequential within batch for now)
    for (const file of batch) {
      const globalIndex = i + batch.indexOf(file)
      const filename = generateFilename(file)
      
      progressTracker.updateProgress(
        globalIndex + 1,
        `下载文件 ${globalIndex + 1}/${files.length}: ${filename}`
      )
      
      try {
        // Generate download URL with retry logic
        const downloadUrl = await retryWithBackoff(
          () => generateDownloadUrl(file),
          maxRetries,
          retryDelay
        )
        
        // Trigger browser download
        triggerBrowserDownload(downloadUrl, filename)
        
        results.push({
          success: true,
          filename,
          downloadUrl
        })
        
      } catch (error) {
        const exportError = createExportError(
          'network',
          `下载文件失败: ${filename}`,
          error,
          isRetryableError(error)
        )
        
        errors.push(exportError)
        progressTracker.addError(exportError.message)
        
        results.push({
          success: false,
          filename,
          error: exportError
        })
      }
    }
    
    // Delay between batches (except for the last batch)
    if (i + batchSize < files.length) {
      await delay(delayBetweenBatches)
    }
  }
  
  // Complete progress tracking
  progressTracker.complete('批量下载完成')
  
  const duration = Date.now() - startTime
  const successful = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  
  return {
    total: files.length,
    successful,
    failed,
    errors,
    duration
  }
}

// ============================================================
// Download Validation and Limits
// ============================================================

export interface SelectionValidation {
  valid: boolean
  message?: string
  warning?: string
}

export const BATCH_DOWNLOAD_LIMITS = {
  maxSelectionCount: 50,
  warningThreshold: 30,
  recommendedBatchSize: 20
} as const

/**
 * Validates file selection for batch download
 */
export const validateFileSelection = (selectedCount: number): SelectionValidation => {
  if (selectedCount === 0) {
    return { 
      valid: false, 
      message: '请选择要下载的文件' 
    }
  }
  
  if (selectedCount > BATCH_DOWNLOAD_LIMITS.maxSelectionCount) {
    return { 
      valid: false, 
      message: `最多只能选择${BATCH_DOWNLOAD_LIMITS.maxSelectionCount}个文件进行批量下载` 
    }
  }
  
  if (selectedCount > BATCH_DOWNLOAD_LIMITS.warningThreshold) {
    return { 
      valid: true, 
      warning: `选择了${selectedCount}个文件，预计需要较长时间下载，建议分批处理` 
    }
  }
  
  return { valid: true }
}

/**
 * Estimates download time based on file count and average file size
 */
export const estimateDownloadTime = (
  fileCount: number,
  averageFileSizeMB = 10,
  connectionSpeedMbps = 50
): number => {
  // Base time per file (includes processing overhead)
  const baseTimePerFile = 2 // seconds
  
  // Download time based on file size and connection speed
  const downloadTimePerFile = (averageFileSizeMB * 8) / connectionSpeedMbps // Convert MB to Mbits
  
  // Total time with some buffer
  const totalTime = fileCount * (baseTimePerFile + downloadTimePerFile)
  
  return Math.ceil(totalTime)
}

// ============================================================
// Download Status Tracking
// ============================================================

export interface DownloadTracker {
  id: string
  filename: string
  status: 'pending' | 'downloading' | 'completed' | 'failed'
  sentAt?: Date
  estimatedCompletionAt?: Date
  error?: string
}

/**
 * Creates a download tracker for monitoring individual file downloads
 */
export const createDownloadTracker = (
  files: SubmissionFileInfo[],
  generateFilename: (file: SubmissionFileInfo) => string
): DownloadTracker[] => {
  return files.map(file => ({
    id: file.id,
    filename: generateFilename(file),
    status: 'pending' as const
  }))
}

/**
 * Updates download tracker status
 */
export const updateDownloadStatus = (
  trackers: DownloadTracker[],
  fileId: string,
  status: DownloadTracker['status'],
  error?: string
): DownloadTracker[] => {
  return trackers.map(tracker => {
    if (tracker.id === fileId) {
      const updated: DownloadTracker = {
        ...tracker,
        status
      }
      
      if (status === 'downloading') {
        updated.sentAt = new Date()
        // Estimate completion time (2-5 seconds per file)
        updated.estimatedCompletionAt = new Date(Date.now() + 3000)
      }
      
      if (status === 'failed' && error) {
        updated.error = error
      }
      
      return updated
    }
    return tracker
  })
}

/**
 * Enhanced batch download function that replaces ZIP-based downloads
 * with sequential browser downloads using custom filenames
 */
export const downloadSubmissionsBatch = async (
  submissions: any[],
  progressCallback?: (progress: ExportProgress) => void,
  options: DownloadOptions = {}
): Promise<BatchDownloadSummary> => {
  // Validate selection
  const validation = validateFileSelection(submissions.length)
  if (!validation.valid) {
    throw createExportError(
      'validation',
      validation.message || '选择验证失败',
      null,
      false
    )
  }
  
  // Process submissions for download (assigns chronological ordering)
  const processedFiles = processSubmissionsForDownload(submissions)
  
  // Create progress tracker
  const progressTracker = new ProgressTracker(processedFiles.length, progressCallback)
  
  // Create filename generator function
  const generateFilename = (file: SubmissionFileInfo): string => {
    return generateSubmissionFilename(
      file.submissionNumber,
      file.teamName,
      file.projectName,
      file.fileExtension
    )
  }
  
  // Create download URL generator function
  const generateDownloadUrl = async (file: SubmissionFileInfo): Promise<string> => {
    const customFilename = generateFilename(file)
    return generateSignedDownloadUrl(file.storagePath, customFilename)
  }
  
  // Execute batch download
  return downloadFilesSequentially(
    processedFiles,
    generateDownloadUrl,
    generateFilename,
    progressTracker,
    options
  )
}

// ============================================================
// Download Summary and Reporting
// ============================================================

/**
 * Generates a user-friendly summary of batch download results
 */
export const generateDownloadSummary = (summary: BatchDownloadSummary): string => {
  const { successful, failed, duration } = summary
  
  const durationMinutes = Math.ceil(duration / 60000)
  const durationText = durationMinutes > 1 ? `${durationMinutes}分钟` : '不到1分钟'
  
  let summaryText = `批量下载完成，耗时${durationText}。`
  
  if (failed === 0) {
    summaryText += `成功下载${successful}个文件。`
  } else {
    summaryText += `成功下载${successful}个文件，${failed}个文件下载失败。`
  }
  
  return summaryText
}

/**
 * Generates detailed error report for failed downloads
 */
export const generateErrorReport = (errors: ExportError[]): string => {
  if (errors.length === 0) {
    return '没有错误。'
  }
  
  const errorsByType = errors.reduce((acc, error) => {
    if (!acc[error.type]) {
      acc[error.type] = []
    }
    acc[error.type].push(error.message)
    return acc
  }, {} as Record<string, string[]>)
  
  let report = `发现${errors.length}个错误：\n\n`
  
  Object.entries(errorsByType).forEach(([type, messages]) => {
    const typeLabel = {
      network: '网络错误',
      storage: '存储错误',
      validation: '验证错误',
      processing: '处理错误',
      unknown: '未知错误'
    }[type as ExportError['type']] || '其他错误'
    
    report += `${typeLabel} (${messages.length}个):\n`
    messages.forEach(message => {
      report += `- ${message}\n`
    })
    report += '\n'
  })
  
  return report.trim()
}

// ============================================================
// Pagination and Selection Management
// ============================================================

export interface PaginationOptions {
  page: number
  pageSize: number
  total: number
}

/**
 * Paginates a list of files for UI display
 */
export const paginateFiles = <T>(
  files: T[],
  options: PaginationOptions
): {
  items: T[]
  totalPages: number
  hasNext: boolean
  hasPrevious: boolean
} => {
  const { page, pageSize, total } = options
  const totalPages = Math.ceil(total / pageSize)
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize
  
  return {
    items: files.slice(startIndex, endIndex),
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1
  }
}

/**
 * Manages file selection state with pagination
 */
export class SelectionManager {
  private selectedIds = new Set<string>()
  private maxSelection: number
  
  constructor(maxSelection = BATCH_DOWNLOAD_LIMITS.maxSelectionCount) {
    this.maxSelection = maxSelection
  }
  
  /**
   * Toggles selection for a file
   */
  toggle(fileId: string): boolean {
    if (this.selectedIds.has(fileId)) {
      this.selectedIds.delete(fileId)
      return false
    } else if (this.selectedIds.size < this.maxSelection) {
      this.selectedIds.add(fileId)
      return true
    }
    return false
  }
  
  /**
   * Selects multiple files (up to the limit)
   */
  selectMultiple(fileIds: string[]): number {
    let added = 0
    for (const id of fileIds) {
      if (this.selectedIds.size >= this.maxSelection) break
      if (!this.selectedIds.has(id)) {
        this.selectedIds.add(id)
        added++
      }
    }
    return added
  }
  
  /**
   * Clears all selections
   */
  clear(): void {
    this.selectedIds.clear()
  }
  
  /**
   * Gets selected file IDs
   */
  getSelected(): string[] {
    return Array.from(this.selectedIds)
  }
  
  /**
   * Gets selection count
   */
  getCount(): number {
    return this.selectedIds.size
  }
  
  /**
   * Checks if a file is selected
   */
  isSelected(fileId: string): boolean {
    return this.selectedIds.has(fileId)
  }
  
  /**
   * Checks if selection is at maximum
   */
  isAtMaximum(): boolean {
    return this.selectedIds.size >= this.maxSelection
  }
  
  /**
   * Gets remaining selection capacity
   */
  getRemainingCapacity(): number {
    return this.maxSelection - this.selectedIds.size
  }
}