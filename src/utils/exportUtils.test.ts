/**
 * Tests for export utility functions
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  flattenFormResponse,
  extractAllColumns,
  sanitizeFilename,
  generateSubmissionFilename,
  generateExportFilename,
  ProgressTracker,
  processSubmissionsForDownload,
  getFileExtension,
  createExportError,
  isRetryableError
} from './exportUtils'

describe('Form Response Flattening', () => {
  it('should flatten simple form response', () => {
    const formResponse = {
      name: 'John Doe',
      age: 25,
      skills: ['JavaScript', 'Vue.js']
    }
    
    const result = flattenFormResponse(formResponse)
    
    expect(result).toEqual({
      name: 'John Doe',
      age: '25',
      skills: 'JavaScript, Vue.js'
    })
  })
  
  it('should flatten nested form response with dot notation', () => {
    const formResponse = {
      personal: {
        name: 'John Doe',
        contact: {
          email: 'john@example.com'
        }
      },
      preferences: ['option1', 'option2']
    }
    
    const result = flattenFormResponse(formResponse)
    
    expect(result).toEqual({
      'personal.name': 'John Doe',
      'personal.contact.email': 'john@example.com',
      preferences: 'option1, option2'
    })
  })
  
  it('should handle null and undefined values', () => {
    const formResponse = {
      name: 'John',
      empty: null,
      missing: undefined,
      zero: 0
    }
    
    const result = flattenFormResponse(formResponse)
    
    expect(result).toEqual({
      name: 'John',
      zero: '0'
    })
  })
})

describe('Column Extraction', () => {
  it('should extract all unique columns from registrations', () => {
    const registrations = [
      {
        id: '1',
        user_id: 'user1',
        event_id: 'event1',
        form_response: { name: 'John', skills: ['JS'] },
        status: 'confirmed',
        created_at: '2023-01-01T00:00:00Z'
      },
      {
        id: '2',
        user_id: 'user2',
        event_id: 'event1',
        form_response: { name: 'Jane', experience: '5 years' },
        status: 'confirmed',
        created_at: '2023-01-02T00:00:00Z'
      }
    ]
    
    const columns = extractAllColumns(registrations)
    
    expect(columns).toContain('用户ID')
    expect(columns).toContain('用户名')
    expect(columns).toContain('报名状态')
    expect(columns).toContain('报名时间')
    expect(columns).toContain('name')
    expect(columns).toContain('skills')
    expect(columns).toContain('experience')
  })
})

describe('Filename Sanitization', () => {
  it('should sanitize invalid filename characters', () => {
    const input = 'My<File>Name:With|Invalid?Characters*'
    const result = sanitizeFilename(input)
    expect(result).toBe('My_File_Name_With_Invalid_Characters_')
  })
  
  it('should handle empty or invalid input', () => {
    expect(sanitizeFilename('')).toBe('untitled')
    expect(sanitizeFilename(null as any)).toBe('untitled')
    expect(sanitizeFilename('   ')).toBe('untitled')
  })
  
  it('should limit filename length', () => {
    const longName = 'a'.repeat(250)
    const result = sanitizeFilename(longName)
    expect(result.length).toBeLessThanOrEqual(200)
  })
})

describe('Submission Filename Generation', () => {
  it('should generate properly formatted submission filename', () => {
    const result = generateSubmissionFilename(5, 'Team Alpha', 'My Project', '.zip')
    expect(result).toBe('005-Team_Alpha-My_Project.zip')
  })
  
  it('should handle missing extension dot', () => {
    const result = generateSubmissionFilename(1, 'Team', 'Project', 'pdf')
    expect(result).toBe('001-Team-Project.pdf')
  })
})

describe('Export Filename Generation', () => {
  it('should generate registration export filename', () => {
    const result = generateExportFilename('Game Jam 2023', 'registration')
    expect(result).toMatch(/^Game_Jam_2023_报名表_\d{4}-\d{2}-\d{2}\.xlsx$/)
  })
  
  it('should generate submission export filename', () => {
    const result = generateExportFilename('Game Jam 2023', 'submission')
    expect(result).toMatch(/^Game_Jam_2023_作品批量下载_\d{4}-\d{2}-\d{2}\.zip$/)
  })
})

describe('Progress Tracker', () => {
  let tracker: ProgressTracker
  
  beforeEach(() => {
    tracker = new ProgressTracker(10)
  })
  
  it('should initialize with correct values', () => {
    const status = tracker.getStatus()
    expect(status.current).toBe(0)
    expect(status.total).toBe(10)
    expect(status.completed).toBe(false)
    expect(status.errors).toEqual([])
  })
  
  it('should update progress correctly', () => {
    tracker.updateProgress(5, 'Processing...')
    
    const status = tracker.getStatus()
    expect(status.current).toBe(5)
    expect(status.currentOperation).toBe('Processing...')
    expect(status.completed).toBe(false)
    expect(tracker.getPercentage()).toBe(50)
  })
  
  it('should handle completion', () => {
    tracker.complete('Done!')
    
    const status = tracker.getStatus()
    expect(status.current).toBe(10)
    expect(status.completed).toBe(true)
    expect(status.currentOperation).toBe('Done!')
    expect(tracker.getPercentage()).toBe(100)
  })
  
  it('should track errors', () => {
    tracker.addError('Something went wrong')
    
    expect(tracker.hasErrors()).toBe(true)
    expect(tracker.getStatus().errors).toContain('Something went wrong')
  })
  
  it('should calculate summary correctly', () => {
    tracker.updateProgress(8, 'Almost done')
    tracker.addError('Error 1')
    tracker.addError('Error 2')
    
    const summary = tracker.getSummary()
    expect(summary.successful).toBe(6) // 8 - 2 errors
    expect(summary.failed).toBe(2)
    expect(summary.total).toBe(10)
  })
})

describe('Submission Processing', () => {
  it('should process submissions with chronological ordering', () => {
    const submissions = [
      {
        id: '2',
        project_name: 'Project B',
        team: { name: 'Team Beta' },
        submission_storage_path: 'path/to/file2.zip',
        created_at: '2023-01-02T00:00:00Z'
      },
      {
        id: '1',
        project_name: 'Project A',
        team: { name: 'Team Alpha' },
        submission_storage_path: 'path/to/file1.pdf',
        created_at: '2023-01-01T00:00:00Z'
      }
    ]
    
    const result = processSubmissionsForDownload(submissions)
    
    expect(result).toHaveLength(2)
    expect(result[0].submissionNumber).toBe(1)
    expect(result[0].projectName).toBe('Project A')
    expect(result[1].submissionNumber).toBe(2)
    expect(result[1].projectName).toBe('Project B')
  })
})

describe('File Extension Extraction', () => {
  it('should extract file extension correctly', () => {
    expect(getFileExtension('file.pdf')).toBe('.pdf')
    expect(getFileExtension('path/to/file.zip')).toBe('.zip')
    expect(getFileExtension('file.tar.gz')).toBe('.gz')
  })
  
  it('should handle files without extension', () => {
    expect(getFileExtension('filename')).toBe('')
    expect(getFileExtension('path/to/filename')).toBe('')
  })
  
  it('should handle invalid input', () => {
    expect(getFileExtension('')).toBe('')
    expect(getFileExtension(null as any)).toBe('')
  })
})

describe('Error Handling', () => {
  it('should create export error correctly', () => {
    const error = createExportError('network', 'Connection failed', { code: 500 }, true)
    
    expect(error.type).toBe('network')
    expect(error.message).toBe('Connection failed')
    expect(error.details).toEqual({ code: 500 })
    expect(error.retryable).toBe(true)
    expect(error.timestamp).toBeInstanceOf(Date)
  })
  
  it('should identify retryable errors', () => {
    expect(isRetryableError({ name: 'NetworkError' })).toBe(true)
    expect(isRetryableError({ status: 500 })).toBe(true)
    expect(isRetryableError({ status: 429 })).toBe(true)
    expect(isRetryableError({ message: 'timeout' })).toBe(true)
    expect(isRetryableError({ status: 404 })).toBe(false)
    expect(isRetryableError({ status: 400 })).toBe(false)
  })
})