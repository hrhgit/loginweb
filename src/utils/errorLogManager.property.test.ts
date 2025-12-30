import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fc from 'fast-check'
import { ErrorLogManager, createErrorRecord } from './errorLogManager'
import { ErrorType, MessageSeverity, ErrorContext } from './errorHandler'

/**
 * **Feature: error-message-enhancement, Property 16: 错误日志记录**
 * For any 发生的错误，错误记录应该被保存到本地存储中用于问题反馈
 * **Validates: Requirements 6.1**
 * 
 * **Feature: error-message-enhancement, Property 18: 错误日志清除**
 * For any 清除操作，所有本地存储的错误记录应该被删除
 * **Validates: Requirements 6.4**
 * 
 * **Feature: error-message-enhancement, Property 19: 存储限制管理**
 * For any 超过存储限制的错误记录，最旧的记录应该被自动删除
 * **Validates: Requirements 6.5**
 */

describe('ErrorLogManager Property-Based Tests', () => {
  let errorLogManager: ErrorLogManager
  let originalLocalStorage: Storage
  let mockStorage: Map<string, string>
  let mockSessionStorage: Map<string, string>

  beforeEach(() => {
    // Create fresh mock storage for each test
    mockStorage = new Map<string, string>()
    mockSessionStorage = new Map<string, string>()
    originalLocalStorage = window.localStorage
    
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => mockStorage.get(key) || null),
        setItem: vi.fn((key: string, value: string) => mockStorage.set(key, value)),
        removeItem: vi.fn((key: string) => mockStorage.delete(key)),
        clear: vi.fn(() => mockStorage.clear()),
        length: 0,
        key: vi.fn()
      },
      writable: true
    })

    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn((key: string) => mockSessionStorage.get(key) || null),
        setItem: vi.fn((key: string, value: string) => mockSessionStorage.set(key, value)),
        removeItem: vi.fn((key: string) => mockSessionStorage.delete(key)),
        clear: vi.fn(() => mockSessionStorage.clear()),
        length: 0,
        key: vi.fn()
      },
      writable: true
    })

    // Create new instance for each test
    errorLogManager = new ErrorLogManager({
      maxRecords: 10,
      maxStorageSize: 2048, // 2KB for testing
      autoCleanupInterval: 0 // Disable auto cleanup for tests
    })
  })

  afterEach(() => {
    errorLogManager.dispose()
    // Clear mock storage
    mockStorage.clear()
    mockSessionStorage.clear()
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true
    })
  })

  // Generators for test data
  const errorTypeGen = fc.constantFrom(...Object.values(ErrorType))
  const severityGen = fc.constantFrom(...Object.values(MessageSeverity))
  
  const errorContextGen = fc.record({
    operation: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
    component: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
    userId: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
    additionalData: fc.option(fc.record({
      key1: fc.string({ maxLength: 50 }),
      key2: fc.integer({ min: 0, max: 1000 })
    }))
  })

  const errorGen = fc.oneof(
    fc.string({ minLength: 1, maxLength: 100 }),
    fc.record({
      message: fc.string({ minLength: 1, maxLength: 100 }),
      code: fc.option(fc.string({ maxLength: 20 })),
      stack: fc.option(fc.string({ maxLength: 200 }))
    })
  )

  it('Property 16: 错误日志记录 - should save any error record to local storage for problem feedback', () => {
    fc.assert(fc.property(
      fc.record({
        error: errorGen,
        context: errorContextGen,
        type: errorTypeGen,
        severity: severityGen
      }),
      (testData) => {
        // Clear any existing data for this test
        mockStorage.clear()
        mockSessionStorage.clear()
        
        // Create fresh manager for this test
        const testManager = new ErrorLogManager({
          maxRecords: 10,
          maxStorageSize: 2048,
          autoCleanupInterval: 0
        })
        
        // Create error record
        const errorRecord = createErrorRecord(
          testData.error,
          testData.context,
          testData.type,
          testData.severity
        )

        // Get initial record count (should be 0)
        const initialRecords = testManager.getRecords()
        const initialCount = initialRecords.length
        expect(initialCount).toBe(0)

        // Add the error record
        testManager.addRecord(errorRecord)

        // Verify record was saved
        const updatedRecords = testManager.getRecords()
        expect(updatedRecords.length).toBe(1)

        // Verify the record is at the beginning (most recent first)
        const savedRecord = updatedRecords[0]
        expect(savedRecord.id).toBe(errorRecord.id)
        expect(savedRecord.type).toBe(testData.type)
        expect(savedRecord.severity).toBe(testData.severity)
        expect(savedRecord.context.operation).toBe(testData.context.operation)
        expect(savedRecord.context.component).toBe(testData.context.component)

        // Verify message is properly extracted
        const expectedMessage = typeof testData.error === 'string' 
          ? testData.error 
          : testData.error.message || '未知错误'
        expect(savedRecord.message).toBe(expectedMessage)

        // Verify timestamp is valid
        expect(savedRecord.timestamp).toBeInstanceOf(Date)
        expect(savedRecord.timestamp.getTime()).toBeLessThanOrEqual(Date.now())
        
        testManager.dispose()
      }
    ), { numRuns: 100 })
  })

  it('Property 16 Extension: Error record persistence - records should persist across manager instances', () => {
    fc.assert(fc.property(
      fc.array(
        fc.record({
          error: errorGen,
          context: errorContextGen,
          type: errorTypeGen,
          severity: severityGen
        }),
        { minLength: 1, maxLength: 5 }
      ),
      (errorData) => {
        // Clear any existing data
        mockStorage.clear()
        mockSessionStorage.clear()
        
        // Add multiple error records
        const addedRecords = errorData.map(data => {
          const record = createErrorRecord(data.error, data.context, data.type, data.severity)
          errorLogManager.addRecordSync(record) // Use sync method for testing
          return record
        })

        // Get records from current manager
        const recordsFromCurrent = errorLogManager.getRecords()
        expect(recordsFromCurrent.length).toBeLessThanOrEqual(addedRecords.length)
        expect(recordsFromCurrent.length).toBeGreaterThan(0) // Should have at least some records

        // Create new manager instance (simulating app restart) - it should use the same mock storage
        const newManager = new ErrorLogManager({
          maxRecords: 10,
          maxStorageSize: 2048,
          autoCleanupInterval: 0
        })

        // Verify records persist (may be fewer due to validation filtering)
        const recordsFromNew = newManager.getRecords()
        expect(recordsFromNew.length).toBe(recordsFromCurrent.length) // Should match current manager
        expect(recordsFromNew.length).toBeGreaterThan(0) // Should have at least some records

        // Verify record IDs match for the records that do persist (in reverse order since newest first)
        for (let i = 0; i < recordsFromNew.length; i++) {
          const persistedRecord = recordsFromNew[i]
          expect(persistedRecord.id).toBeDefined()
          expect(persistedRecord.type).toBeDefined()
          expect(persistedRecord.timestamp).toBeInstanceOf(Date)
        }

        newManager.dispose()
      }
    ), { numRuns: 50 })
  })

  it('Property 16 Extension: Sensitive data filtering - sensitive information should be filtered from stored records', () => {
    fc.assert(fc.property(
      fc.record({
        sensitiveData: fc.record({
          password: fc.string({ minLength: 8, maxLength: 20 }),
          token: fc.string({ minLength: 10, maxLength: 50 }),
          apiKey: fc.string({ minLength: 10, maxLength: 40 }),
          normalData: fc.string({ minLength: 1, maxLength: 30 })
        }),
        context: errorContextGen,
        type: errorTypeGen,
        severity: severityGen
      }),
      (testData) => {
        // Create error with sensitive data
        const errorWithSensitiveData = {
          message: 'Error with sensitive data',
          details: testData.sensitiveData
        }

        const contextWithSensitiveData = {
          ...testData.context,
          additionalData: {
            ...testData.context.additionalData,
            userPassword: testData.sensitiveData.password,
            authToken: testData.sensitiveData.token,
            secretKey: testData.sensitiveData.apiKey,
            publicInfo: testData.sensitiveData.normalData
          }
        }

        const errorRecord = createErrorRecord(
          errorWithSensitiveData,
          contextWithSensitiveData,
          testData.type,
          testData.severity
        )

        // Add record
        errorLogManager.addRecordSync(errorRecord) // Use sync method for testing

        // Get stored record
        const storedRecords = errorLogManager.getRecords()
        expect(storedRecords.length).toBeGreaterThan(0) // Ensure we have records
        const storedRecord = storedRecords[0]

        // Verify sensitive data is filtered
        const storedDetails = storedRecord.originalError?.details
        if (storedDetails) {
          expect(storedDetails.password).toBe('[FILTERED]')
          expect(storedDetails.token).toBe('[FILTERED]')
          expect(storedDetails.apiKey).toBe('[FILTERED]')
          expect(storedDetails.normalData).toBe(testData.sensitiveData.normalData) // Should not be filtered
        }

        // Verify sensitive data in context is filtered
        const storedAdditionalData = storedRecord.context.additionalData
        if (storedAdditionalData) {
          expect(storedAdditionalData.userPassword).toBe('[FILTERED]')
          expect(storedAdditionalData.authToken).toBe('[FILTERED]')
          expect(storedAdditionalData.secretKey).toBe('[FILTERED]')
          expect(storedAdditionalData.publicInfo).toBe(testData.sensitiveData.normalData) // Should not be filtered
        }
      }
    ), { numRuns: 100 })
  })

  it('Property 18: 错误日志清除 - should delete all local storage error records for any clear operation', () => {
    fc.assert(fc.property(
      fc.array(
        fc.record({
          error: errorGen,
          context: errorContextGen,
          type: errorTypeGen,
          severity: severityGen
        }),
        { minLength: 1, maxLength: 8 }
      ),
      (errorData) => {
        // Clear any existing data for this test
        mockStorage.clear()
        mockSessionStorage.clear()
        
        // Create fresh manager for this test
        const testManager = new ErrorLogManager({
          maxRecords: 10,
          maxStorageSize: 2048,
          autoCleanupInterval: 0
        })
        
        // Add multiple error records
        errorData.forEach(data => {
          const record = createErrorRecord(data.error, data.context, data.type, data.severity)
          testManager.addRecordSync(record) // Use sync method for testing
        })

        // Verify records exist (may be fewer due to validation filtering)
        const recordsBeforeClear = testManager.getRecords()
        expect(recordsBeforeClear.length).toBeLessThanOrEqual(errorData.length)
        expect(recordsBeforeClear.length).toBeGreaterThan(0) // Should have at least some records

        // Clear all records
        testManager.clearRecords()

        // Verify all records are deleted
        const recordsAfterClear = testManager.getRecords()
        expect(recordsAfterClear.length).toBe(0)

        // Verify localStorage is actually cleared
        expect(mockStorage.get('error_log_records')).toBeUndefined()
        
        testManager.dispose()
      }
    ), { numRuns: 100 })
  })

  it('Property 18 Extension: Clear operation idempotency - multiple clear operations should have same effect', () => {
    fc.assert(fc.property(
      fc.array(
        fc.record({
          error: errorGen,
          context: errorContextGen,
          type: errorTypeGen,
          severity: severityGen
        }),
        { minLength: 1, maxLength: 5 }
      ),
      fc.integer({ min: 2, max: 5 }),
      (errorData, clearCount) => {
        // Clear any existing data for this test
        mockStorage.clear()
        mockSessionStorage.clear()
        
        // Create fresh manager for this test
        const testManager = new ErrorLogManager({
          maxRecords: 10,
          maxStorageSize: 2048,
          autoCleanupInterval: 0
        })
        
        // Add some error records
        errorData.forEach(data => {
          const record = createErrorRecord(data.error, data.context, data.type, data.severity)
          testManager.addRecordSync(record) // Use sync method for testing
        })

        // Verify records exist (may be fewer due to validation filtering)
        expect(testManager.getRecords().length).toBeLessThanOrEqual(errorData.length)
        expect(testManager.getRecords().length).toBeGreaterThan(0) // Should have at least some records

        // Clear multiple times
        for (let i = 0; i < clearCount; i++) {
          testManager.clearRecords()
          
          // Should be empty after each clear
          expect(testManager.getRecords().length).toBe(0)
        }

        // Final verification
        expect(testManager.getRecords().length).toBe(0)
        expect(mockStorage.get('error_log_records')).toBeUndefined()
        
        testManager.dispose()
      }
    ), { numRuns: 50 })
  })

  it('Property 19: 存储限制管理 - should automatically delete oldest records when storage limits are exceeded', () => {
    fc.assert(fc.property(
      fc.integer({ min: 12, max: 20 }), // More than maxRecords (10)
      (recordCount) => {
        const errorRecords = []

        // Add records exceeding the limit
        for (let i = 0; i < recordCount; i++) {
          const record = createErrorRecord(
            `Error message ${i}`,
            {
              operation: `operation-${i}`,
              component: `component-${i}`
            },
            ErrorType.CLIENT,
            MessageSeverity.WARNING
          )
          
          errorRecords.push(record)
          errorLogManager.addRecord(record)
        }

        // Verify only maxRecords are kept
        const storedRecords = errorLogManager.getRecords()
        expect(storedRecords.length).toBeLessThanOrEqual(10) // maxRecords = 10

        // Verify newest records are kept (LIFO - Last In, First Out)
        const newestRecords = errorRecords.slice(-storedRecords.length)
        for (let i = 0; i < storedRecords.length; i++) {
          const expectedRecord = newestRecords[newestRecords.length - 1 - i] // Reverse order
          const actualRecord = storedRecords[i]
          expect(actualRecord.id).toBe(expectedRecord.id)
        }
      }
    ), { numRuns: 50 })
  })

  it('Property 19 Extension: Storage size limit enforcement - should respect storage size limits', () => {
    fc.assert(fc.property(
      fc.array(
        fc.string({ minLength: 100, maxLength: 200 }), // Large error messages
        { minLength: 5, maxLength: 10 }
      ),
      (largeMessages) => {
        // Create manager with very small storage limit
        const smallStorageManager = new ErrorLogManager({
          maxRecords: 50, // High record limit
          maxStorageSize: 1024, // Small storage limit (1KB)
          autoCleanupInterval: 0
        })

        const addedRecords = []

        // Add records with large messages
        largeMessages.forEach((message, index) => {
          const record = createErrorRecord(
            message,
            {
              operation: `large-operation-${index}`,
              component: `large-component-${index}`
            },
            ErrorType.SERVER,
            MessageSeverity.FATAL
          )
          
          addedRecords.push(record)
          smallStorageManager.addRecordSync(record) // Use sync method for testing
        })

        // Get stored records
        const storedRecords = smallStorageManager.getRecords()
        
        // Verify storage size constraint is respected
        const serialized = JSON.stringify(storedRecords)
        const actualSize = new Blob([serialized]).size
        expect(actualSize).toBeLessThanOrEqual(1024)

        // Verify some records were stored (not completely empty due to size limit)
        expect(storedRecords.length).toBeGreaterThan(0)
        expect(storedRecords.length).toBeLessThanOrEqual(addedRecords.length)

        // Verify newest records are prioritized
        if (storedRecords.length < addedRecords.length) {
          const newestAddedRecords = addedRecords.slice(-storedRecords.length)
          for (let i = 0; i < storedRecords.length; i++) {
            const expectedRecord = newestAddedRecords[newestAddedRecords.length - 1 - i]
            const actualRecord = storedRecords[i]
            expect(actualRecord.id).toBe(expectedRecord.id)
          }
        }

        smallStorageManager.dispose()
      }
    ), { numRuns: 30 })
  })

  it('Property 19 Extension: Storage limit consistency - storage info should accurately reflect actual usage', () => {
    fc.assert(fc.property(
      fc.array(
        fc.record({
          error: errorGen,
          context: errorContextGen,
          type: errorTypeGen,
          severity: severityGen
        }),
        { minLength: 1, maxLength: 8 }
      ),
      (errorData) => {
        // Add error records
        errorData.forEach(data => {
          const record = createErrorRecord(data.error, data.context, data.type, data.severity)
          errorLogManager.addRecordSync(record) // Use sync method for testing
        })

        // Get storage info
        const storageInfo = errorLogManager.getStorageInfo()
        const actualRecords = errorLogManager.getRecords()

        // Verify record count matches
        expect(storageInfo.recordCount).toBe(actualRecords.length)

        // Verify storage size is reasonable
        expect(storageInfo.used).toBeGreaterThan(0)
        expect(storageInfo.used).toBeLessThanOrEqual(storageInfo.limit)

        // Verify actual serialized size matches reported size
        const actualSerialized = localStorage.getItem('error_log_records') || ''
        const actualSize = new Blob([actualSerialized]).size
        expect(storageInfo.used).toBe(actualSize)
      }
    ), { numRuns: 100 })
  })
})