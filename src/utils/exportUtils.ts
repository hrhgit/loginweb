/**
 * Utility functions for admin export enhancement
 * Handles form response flattening, filename sanitization, and progress tracking
 */

// ============================================================
// Form Response Flattening Utilities
// ============================================================

export interface FlattenedRegistration {
  // Standard columns
  用户ID: string
  用户名: string
  报名状态: string
  报名时间: string
  
  // Dynamic columns from form_response
  [questionKey: string]: string | number | boolean
}

export interface RegistrationData {
  id: string
  user_id: string
  event_id: string
  form_response: Record<string, any>
  status: string
  created_at: string
  profile?: {
    username: string | null
  }
}

/**
 * Flattens a single form_response object into key-value pairs
 * Handles nested objects using dot notation and arrays by joining with commas
 */
export const flattenFormResponse = (formResponse: Record<string, any>): Record<string, string> => {
  const flattened: Record<string, string> = {}
  
  const flatten = (obj: any, prefix = ''): void => {
    if (obj === null || obj === undefined) {
      return
    }
    
    if (Array.isArray(obj)) {
      // Join array values with commas
      flattened[prefix] = obj.map(item => 
        typeof item === 'object' ? JSON.stringify(item) : String(item)
      ).join(', ')
      return
    }
    
    if (typeof obj === 'object') {
      // Handle nested objects with dot notation
      Object.keys(obj).forEach(key => {
        const newKey = prefix ? `${prefix}.${key}` : key
        flatten(obj[key], newKey)
      })
      return
    }
    
    // Primitive values
    flattened[prefix] = String(obj)
  }
  
  flatten(formResponse)
  return flattened
}

/**
 * Extracts all unique column keys from a collection of registration records
 */
export const extractAllColumns = (registrations: RegistrationData[]): string[] => {
  const columnSet = new Set<string>()
  
  // Add standard columns
  columnSet.add('用户ID')
  columnSet.add('用户名')
  columnSet.add('报名状态')
  columnSet.add('报名时间')
  
  // Extract dynamic columns from form_response data
  registrations.forEach(registration => {
    if (registration.form_response && typeof registration.form_response === 'object') {
      const flattened = flattenFormResponse(registration.form_response)
      Object.keys(flattened).forEach(key => columnSet.add(key))
    }
  })
  
  return Array.from(columnSet)
}

/**
 * Generates descriptive column headers from form response keys
 */
export const generateColumnHeaders = (columns: string[]): string[] => {
  return columns.map(column => {
    // Standard columns are already in Chinese
    if (['用户ID', '用户名', '报名状态', '报名时间'].includes(column)) {
      return column
    }
    
    // For form response keys, use the key as-is but clean it up
    return column
      .replace(/\./g, ' - ') // Replace dots with dashes for readability
      .trim()
  })
}

/**
 * Converts registration data to flattened format for Excel export
 */
export const convertToFlattenedRegistrations = (registrations: RegistrationData[]): FlattenedRegistration[] => {
  return registrations.map(registration => {
    const flattened: FlattenedRegistration = {
      用户ID: registration.user_id,
      用户名: registration.profile?.username || '未知用户',
      报名状态: registration.status === 'registered' ? '已报名' : '未报名',
      报名时间: new Date(registration.created_at).toLocaleString('zh-CN')
    }
    
    // Add flattened form response data
    if (registration.form_response && typeof registration.form_response === 'object') {
      const formData = flattenFormResponse(registration.form_response)
      Object.assign(flattened, formData)
    }
    
    return flattened
  })
}

// ============================================================
// Filename Sanitization and Naming Utilities
// ============================================================

/**
 * Sanitizes a filename by replacing invalid characters with underscores
 * Handles Windows, macOS, and Linux filename restrictions
 */
export const sanitizeFilename = (name: string): string => {
  if (!name || typeof name !== 'string') {
    return 'untitled'
  }
  
  // Replace invalid filename characters with underscores
  // Invalid chars: < > : " | ? * \ / and control characters
  const sanitized = name
    .replace(/[<>:"|?*\\/]/g, '_')
    .replace(/[\x00-\x1f\x80-\x9f]/g, '_') // Control characters
    .replace(/^\.+/, '_') // Leading dots
    .replace(/\.+$/, '_') // Trailing dots
    .replace(/\s+/g, '_') // Multiple spaces to single underscore
    .replace(/_+/g, '_') // Multiple underscores to single
    .trim()
  
  // Ensure filename is not empty and not too long
  if (!sanitized || sanitized === '_') {
    return 'untitled'
  }
  
  // Limit length to 200 characters (leaving room for extensions and numbers)
  return sanitized.length > 200 ? sanitized.substring(0, 200) : sanitized
}

/**
 * Generates a filename for submission downloads
 */
export const generateSubmissionFilename = (
  submissionNumber: number,
  teamName: string,
  projectName: string,
  fileExtension: string
): string => {
  const paddedNumber = String(submissionNumber).padStart(3, '0')
  const sanitizedTeamName = sanitizeFilename(teamName)
  const sanitizedProjectName = sanitizeFilename(projectName)
  
  // Ensure extension starts with dot
  const ext = fileExtension.startsWith('.') ? fileExtension : `.${fileExtension}`
  
  return `${paddedNumber}-${sanitizedTeamName}-${sanitizedProjectName}${ext}`
}

/**
 * Generates export filename for Excel files
 */
export const generateExportFilename = (eventTitle: string, type: 'registration' | 'submission'): string => {
  const sanitizedTitle = sanitizeFilename(eventTitle)
  const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
  
  const suffix = type === 'registration' ? '报名表' : '作品批量下载'
  const extension = type === 'registration' ? '.xlsx' : '.zip'
  
  return `${sanitizedTitle}_${suffix}_${date}${extension}`
}

// ============================================================
// Progress Tracking and Error Handling Utilities
// ============================================================

export interface ExportProgress {
  current: number
  total: number
  currentOperation: string
  errors: string[]
  completed: boolean
  startTime: Date
  estimatedTimeRemaining?: number
}

export interface ProgressUpdateCallback {
  (progress: ExportProgress): void
}

export class ProgressTracker {
  private progress: ExportProgress
  private callback?: ProgressUpdateCallback
  
  constructor(total: number, callback?: ProgressUpdateCallback) {
    this.progress = {
      current: 0,
      total,
      currentOperation: '准备中...',
      errors: [],
      completed: false,
      startTime: new Date()
    }
    this.callback = callback
  }
  
  /**
   * Updates the current progress
   */
  updateProgress(current: number, operation: string): void {
    this.progress.current = Math.min(current, this.progress.total)
    this.progress.currentOperation = operation
    this.progress.completed = this.progress.current >= this.progress.total
    
    // Calculate estimated time remaining
    if (this.progress.current > 0) {
      const elapsed = Date.now() - this.progress.startTime.getTime()
      const rate = this.progress.current / elapsed
      const remaining = (this.progress.total - this.progress.current) / rate
      this.progress.estimatedTimeRemaining = Math.round(remaining / 1000) // Convert to seconds
    }
    
    if (this.callback) {
      this.callback({ ...this.progress })
    }
  }
  
  /**
   * Adds an error to the error log
   */
  addError(error: string): void {
    this.progress.errors.push(error)
    if (this.callback) {
      this.callback({ ...this.progress })
    }
  }
  
  /**
   * Increments progress by 1 and updates operation
   */
  increment(operation: string): void {
    this.updateProgress(this.progress.current + 1, operation)
  }
  
  /**
   * Marks the operation as completed
   */
  complete(finalOperation = '完成'): void {
    this.progress.current = this.progress.total
    this.progress.currentOperation = finalOperation
    this.progress.completed = true
    this.progress.estimatedTimeRemaining = 0
    
    if (this.callback) {
      this.callback({ ...this.progress })
    }
  }
  
  /**
   * Resets the progress tracker
   */
  reset(newTotal?: number): void {
    this.progress = {
      current: 0,
      total: newTotal ?? this.progress.total,
      currentOperation: '准备中...',
      errors: [],
      completed: false,
      startTime: new Date()
    }
    
    if (this.callback) {
      this.callback({ ...this.progress })
    }
  }
  
  /**
   * Gets the current progress status
   */
  getStatus(): ExportProgress {
    return { ...this.progress }
  }
  
  /**
   * Gets the completion percentage (0-100)
   */
  getPercentage(): number {
    if (this.progress.total === 0) return 100
    return Math.round((this.progress.current / this.progress.total) * 100)
  }
  
  /**
   * Checks if there are any errors
   */
  hasErrors(): boolean {
    return this.progress.errors.length > 0
  }
  
  /**
   * Gets a summary of the operation
   */
  getSummary(): { successful: number; failed: number; total: number } {
    return {
      successful: this.progress.current - this.progress.errors.length,
      failed: this.progress.errors.length,
      total: this.progress.total
    }
  }
}

// ============================================================
// Submission Processing Utilities
// ============================================================

export interface SubmissionFileInfo {
  id: string
  projectName: string
  teamName: string
  submissionNumber: number
  storagePath: string
  fileExtension: string
  createdAt: string
}

/**
 * Processes submissions and assigns chronological ordering numbers
 */
export const processSubmissionsForDownload = (submissions: any[]): SubmissionFileInfo[] => {
  // Sort by created_at timestamp in ascending order
  const sorted = [...submissions].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  
  return sorted.map((submission, index) => ({
    id: submission.id,
    projectName: submission.project_name || '未命名项目',
    teamName: submission.teams?.name || '未知团队',
    submissionNumber: index + 1,
    storagePath: submission.submission_storage_path || '',
    fileExtension: getFileExtension(submission.submission_storage_path || ''),
    createdAt: submission.created_at
  }))
}

/**
 * Extracts file extension from a file path
 */
export const getFileExtension = (filePath: string): string => {
  if (!filePath || typeof filePath !== 'string') {
    return ''
  }
  
  const lastDot = filePath.lastIndexOf('.')
  if (lastDot === -1 || lastDot === filePath.length - 1) {
    return ''
  }
  
  return filePath.substring(lastDot) // Include the dot
}

// ============================================================
// Error Handling Utilities
// ============================================================

export interface ExportError {
  type: 'network' | 'storage' | 'validation' | 'processing' | 'unknown'
  message: string
  details?: any
  timestamp: Date
  retryable: boolean
}

/**
 * Creates a standardized error object
 */
export const createExportError = (
  type: ExportError['type'],
  message: string,
  details?: any,
  retryable = false
): ExportError => ({
  type,
  message,
  details,
  timestamp: new Date(),
  retryable
})

/**
 * Determines if an error is retryable based on its characteristics
 */
export const isRetryableError = (error: any): boolean => {
  if (!error) return false
  
  // Network errors are usually retryable
  if (error.name === 'NetworkError' || error.code === 'NETWORK_ERROR') {
    return true
  }
  
  // Timeout errors are retryable
  if (error.name === 'TimeoutError' || error.message?.includes('timeout') || error.message?.includes('超时')) {
    return true
  }
  
  // Rate limiting errors are retryable
  if (error.status === 429 || error.message?.includes('rate limit')) {
    return true
  }
  
  // Server errors (5xx) are retryable
  if (error.status >= 500 && error.status < 600) {
    return true
  }
  
  return false
}

/**
 * Implements exponential backoff retry logic
 */
export const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> => {
  let lastError: any
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      
      // Don't retry if it's not a retryable error
      if (!isRetryableError(error)) {
        throw error
      }
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        throw error
      }
      
      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError
}
