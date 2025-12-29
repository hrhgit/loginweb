# Design Document

## Overview

This design enhances the event administration system by improving the export functionality for registration forms and submission downloads. The system will provide dynamic Excel column generation based on form_response data, improved file naming conventions, and better error handling with progress feedback.

## Architecture

The enhancement follows the existing Vue 3 + Composition API architecture with centralized state management through the app store. The design maintains the current component structure while adding new utility functions for data processing and export operations.

### Key Components
- **EventAdminPage.vue**: Enhanced with improved export logic and UI feedback
- **Export Utilities**: New utility functions for data processing and file operations
- **Progress Management**: Enhanced progress tracking and error handling
- **Data Processing Pipeline**: Structured approach to form data flattening and Excel generation

## Components and Interfaces

### Enhanced EventAdminPage Component

```typescript
interface RegistrationExportData {
  userId: string
  username: string
  status: string
  registrationTime: string
  [dynamicColumn: string]: string | number | boolean
}

interface ExportPreview {
  totalRegistrations: number
  detectedColumns: string[]
  sampleData: RegistrationExportData[]
  hasComplexData: boolean
}

interface SubmissionFileInfo {
  id: string
  projectName: string
  teamName: string
  submissionNumber: number
  storagePath: string
  fileExtension: string
  createdAt: string
}

interface ExportProgress {
  current: number
  total: number
  currentOperation: string
  errors: string[]
  completed: boolean
}
```

### Export Utility Functions

```typescript
interface FormResponseFlattener {
  flattenFormResponse(formResponse: Record<string, any>): Record<string, string>
  extractAllColumns(registrations: any[]): string[]
  generateColumnHeaders(columns: string[]): string[]
}

interface FileNamingService {
  sanitizeFilename(name: string): string
  generateSubmissionFilename(submission: SubmissionFileInfo): string
  generateExportFilename(eventTitle: string, type: 'registration' | 'submission'): string
}

interface ProgressTracker {
  updateProgress(current: number, total: number, operation: string): void
  addError(error: string): void
  reset(): void
  getStatus(): ExportProgress
}
```

## Data Models

### Enhanced Registration Data Structure

```typescript
type FlattenedRegistration = {
  // Standard columns
  用户ID: string
  用户名: string
  报名状态: string
  报名时间: string
  
  // Dynamic columns from form_response
  [questionKey: string]: string | number | boolean
}
```

### Form Response Processing

The form_response JSONB field contains dynamic question-answer pairs. The flattening process will:

1. Extract all unique keys from all form_response objects
2. Create column headers based on question text or keys
3. Flatten nested objects using dot notation
4. Handle arrays by joining values with commas
5. Ensure consistent data types across rows

### Submission File Processing

```typescript
type ProcessedSubmission = {
  id: string
  submissionNumber: number  // Based on created_at ordering
  teamName: string
  projectName: string
  storagePath: string
  fileExtension: string
  sanitizedFilename: string
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Dynamic Column Completeness
*For any* set of registration records with form_response data, the generated Excel columns should include all unique question keys found across all records, ensuring no form data is lost during export.
**Validates: Requirements 1.1, 1.3**

### Property 2: Form Response Flattening Preservation
*For any* form_response object containing nested structures, the flattening process should preserve all original data and create descriptive column headers for nested fields.
**Validates: Requirements 1.2**

### Property 3: Standard Column Inclusion
*For any* registration export, the generated Excel should always include the standard columns for user ID, username, registration status, and timestamp regardless of form_response content.
**Validates: Requirements 1.4**

### Property 4: Registration Export Filename Format
*For any* event title and date, the generated Excel filename should follow the exact format "{event_title}_报名表_{date}.xlsx".
**Validates: Requirements 1.5**

### Property 5: Submission Filename Format
*For any* submission with team name, project name, and extension, the generated filename should follow the format "{submission_number}-{team_name}-{project_name}.{extension}".
**Validates: Requirements 2.1**

### Property 6: Submission Chronological Ordering
*For any* set of submissions, when ordered by created_at timestamp in ascending order, the assigned submission numbers should preserve this chronological sequence.
**Validates: Requirements 2.2**

### Property 7: Filename Character Sanitization
*For any* string containing invalid filename characters, the sanitization process should replace all invalid characters with underscores while preserving valid characters.
**Validates: Requirements 2.3**

### Property 8: Submission Number Padding
*For any* submission count, the generated submission numbers should be padded with leading zeros to ensure consistent string sorting.
**Validates: Requirements 2.4**

### Property 9: Archive Filename Format
*For any* event title and date, the generated ZIP archive filename should follow the format "{event_title}_作品批量下载_{date}.zip".
**Validates: Requirements 2.5**

### Property 10: Progress Tracking Monotonicity
*For any* export operation with multiple steps, the progress percentage should increase monotonically and never exceed 100%.
**Validates: Requirements 3.2**

### Property 11: Batch Operation Error Isolation
*For any* batch download operation where some files fail, the system should continue processing all remaining files and maintain a complete error log.
**Validates: Requirements 3.3**

### Property 12: Operation Summary Completeness
*For any* completed export operation, the summary should include counts of successful and failed operations that sum to the total attempted operations.
**Validates: Requirements 3.4**

### Property 13: Retry Mechanism Activation
*For any* network or storage error during export operations, the system should activate retry mechanisms for the failed operations.
**Validates: Requirements 3.5**

### Property 14: Preview Data Structure
*For any* registration dataset, the preview should display detected form questions and sample data that accurately represents the export structure.
**Validates: Requirements 4.1, 4.2**

### Property 15: Preview Count Accuracy
*For any* registration dataset, the preview should display counts of unique questions and registrations that match the actual data.
**Validates: Requirements 4.4**

### Property 16: Preview Size Limitation
*For any* registration dataset, the preview should never display more than 10 registrations regardless of the total dataset size.
**Validates: Requirements 4.5**

## Error Handling

### Registration Export Errors
- **Empty Dataset**: Display appropriate message when no registrations exist
- **Malformed form_response**: Handle invalid JSON gracefully with error logging
- **Excel Generation Failure**: Provide specific error messages for file creation issues
- **Large Dataset Handling**: Implement chunking for very large registration sets

### File Download Errors
- **Storage Access Failures**: Retry mechanism with exponential backoff
- **Individual File Failures**: Continue batch operation and log specific failures
- **Network Timeouts**: Implement timeout handling with user notification
- **Insufficient Storage**: Handle client-side storage limitations

### Progress and User Feedback
- **Real-time Progress Updates**: Update UI with current operation status
- **Error Aggregation**: Collect and display all errors at operation completion
- **Cancellation Support**: Allow users to cancel long-running operations
- **Success Confirmation**: Clear indication of successful completion with summary

## Testing Strategy

### Unit Testing Approach
- **Data Flattening Logic**: Test form_response flattening with various data structures
- **Filename Sanitization**: Test edge cases with special characters and length limits
- **Column Generation**: Verify dynamic column creation with different form structures
- **Error Handling**: Test error scenarios and recovery mechanisms

### Property-Based Testing Approach
- **Form Data Processing**: Generate random form_response structures to test flattening
- **Filename Generation**: Test filename sanitization with random character combinations
- **Submission Ordering**: Verify ordering consistency with random timestamp sequences
- **Progress Tracking**: Test progress calculation accuracy with various operation counts

The testing strategy will use Vitest as the testing framework with fast-check for property-based testing. Each property-based test will run a minimum of 100 iterations to ensure comprehensive coverage of edge cases.

### Integration Testing
- **End-to-End Export Flow**: Test complete export process from data loading to file generation
- **Supabase Integration**: Verify data retrieval and storage operations
- **File System Operations**: Test file creation, naming, and download functionality
- **UI Interaction**: Test user interface responsiveness during export operations

## Implementation Notes

### Performance Considerations
- **Lazy Loading**: Load registration data in chunks for large datasets
- **Memory Management**: Stream large file operations to avoid memory issues
- **Background Processing**: Use Web Workers for intensive data processing operations
- **Caching**: Cache processed column structures for repeated exports

### Browser Compatibility
- **File Download**: Use file-saver library's `saveAs()` function for cross-browser compatibility with ZIP archives
- **Excel Generation**: Use XLSX library's `writeFile()` method to trigger direct browser downloads
- **Single File Downloads**: Leverage Supabase's `createSignedUrl()` with custom filenames for browser-native downloads
- **Progress Tracking**: Ensure progress indicators work across different browsers
- **Error Handling**: Provide consistent error messages across browser environments

### Download Implementation Strategy
The system uses browser-native download functionality optimized for large files:

1. **Excel Export**: `XLSX.writeFile()` triggers immediate browser download (minimal memory usage)
2. **Batch File Downloads (Large Files)**:
   - Generate signed URLs for each file with custom filenames using `supabase.storage.createSignedUrl()`
   - Trigger individual browser downloads sequentially or in small batches
   - Use custom filename format: `{submission_number}-{team_name}-{project_name}.{extension}`
   - Provide progress tracking and error handling for each file
3. **Small Batch ZIP Downloads (Optional)**:
   - For small files (< 100MB total), offer ZIP option using in-memory JSZip
   - Display estimated total size and warn users about memory usage
4. **Individual Files**: Generate signed URLs with Supabase storage for direct browser download

### Download Implementation Strategy
The system uses browser-native download functionality for all batch operations:

1. **Excel Export**: `XLSX.writeFile()` triggers immediate browser download
2. **Batch File Downloads**: 
   - Generate signed URLs for each file with custom filenames using `supabase.storage.createSignedUrl()`
   - Trigger individual browser downloads sequentially
   - Use custom filename format: `{submission_number}-{team_name}-{project_name}.{extension}`
   - Provide progress tracking and error handling for each file
3. **Individual Files**: Generate signed URLs with Supabase storage for direct browser download

### Sequential Download Implementation

**Controlled Batch Download Process**:
```typescript
const downloadAllFiles = async (submissions: Submission[], options = { batchSize: 1, delay: 500 }) => {
  const batches = chunk(submissions, options.batchSize)
  
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex]
    
    // Process batch (sequential or small concurrent)
    for (let i = 0; i < batch.length; i++) {
      const submission = batch[i]
      const globalIndex = batchIndex * options.batchSize + i
      const customFileName = generateSubmissionFilename(submission, globalIndex + 1)
      
      const { data } = await supabase.storage
        .from('submission-files')
        .createSignedUrl(submission.storagePath, 3600, {
          download: customFileName
        })
      
      // Trigger browser download
      const link = document.createElement('a')
      link.href = data.signedUrl
      link.download = customFileName
      link.click()
      
      // Update progress
      updateProgress(globalIndex + 1, submissions.length)
    }
    
    // Delay between batches to prevent overwhelming browser
    if (batchIndex < batches.length - 1) {
      await delay(options.delay)
    }
  }
}
```

**Concurrency Control Options**:
- **Sequential (Default)**: Download one file at a time with 500ms delays
- **Small Batches**: Download 2-3 files simultaneously to balance speed and stability
- **User Configurable**: Allow administrators to choose batch size and delay timing
- **Pause/Resume**: Provide controls to pause and resume large batch downloads

**Browser Compatibility Considerations**:
- Respect browser connection limits (typically 6-8 concurrent connections per domain)
- Prevent download manager overflow with hundreds of simultaneous downloads
- Add user warnings for very large batch sizes (>50 files)
- Implement download queue management for better user experience

### Download Status Tracking Limitations

**Browser Security Constraints**:
- Web pages cannot access browser download manager status
- No direct way to detect when individual downloads complete
- Cross-origin restrictions prevent monitoring download progress
- Privacy protection prevents exposing download states to web applications

**Workaround Strategies**:

#### 1. Time-Based Estimation
```typescript
const downloadWithEstimation = async (submission: Submission, index: number) => {
  // Estimate download time based on file size
  const estimatedTime = Math.max(
    Math.ceil(submission.fileSize / averageConnectionSpeed) * 1000,
    2000 // Minimum 2 seconds
  )
  
  // Trigger download
  const { data } = await supabase.storage
    .from('submission-files')
    .createSignedUrl(submission.storagePath, 3600, {
      download: generateSubmissionFilename(submission, index)
    })
  
  triggerBrowserDownload(data.signedUrl, fileName)
  
  // Update UI with estimated completion
  updateDownloadStatus(submission.id, 'downloading', estimatedTime)
  
  // Wait for estimated time
  await delay(estimatedTime)
  
  // Mark as processed (not necessarily completed)
  updateDownloadStatus(submission.id, 'processed')
}
```

#### 2. User Feedback Integration
```typescript
interface DownloadTracker {
  id: string
  fileName: string
  status: 'pending' | 'sent-to-browser' | 'estimated-complete' | 'failed'
  sentAt?: Date
  estimatedCompletionAt?: Date
  error?: string
}

const trackDownloadProgress = (submissions: Submission[]) => {
  // Show real-time status for each file:
  // ⏳ Pending
  // 📥 Sent to browser
  // ✅ Estimated complete
  // ❌ Failed to generate download link
}
```

#### 3. Smart Batch Management
- **Adaptive Delays**: Longer delays for larger files
- **Progress Indicators**: Show "X of Y files sent to browser"
- **Completion Guidance**: Instruct users to check download folder
- **Error Recovery**: Retry failed download link generation
- **Pause/Resume**: Allow users to control batch download pace

**User Selection Limits and Safeguards**:
- **Maximum Selection**: Limit batch downloads to 50 files maximum
- **Selection Counter**: Display "X of 50 selected" in UI
- **Warning Messages**: Alert users when approaching or reaching limit
- **Batch Suggestions**: Recommend splitting large selections into multiple batches
- **Performance Warnings**: Inform users about expected download time for large batches

```typescript
interface BatchDownloadLimits {
  maxSelectionCount: 50
  warningThreshold: 30
  recommendedBatchSize: 20
}

const validateSelection = (selectedCount: number): ValidationResult => {
  if (selectedCount === 0) {
    return { valid: false, message: '请选择要下载的文件' }
  }
  
  if (selectedCount > 50) {
    return { valid: false, message: '最多只能选择50个文件进行批量下载' }
  }
  
  if (selectedCount > 30) {
    return { 
      valid: true, 
      warning: `选择了${selectedCount}个文件，预计需要较长时间下载，建议分批处理` 
    }
  }
  
  return { valid: true }
}
```

**UI Enhancements for Selection Management**:
- Disable "Select All" when total files > 50
- Show selection counter: "已选择 15/50 个文件"
- Provide "Select First 50" option for large datasets
- Add "Clear Selection" button for easy reset
- Display estimated total download time based on selection

### Security Considerations
- **Data Sanitization**: Ensure exported data doesn't contain malicious content
- **File Access Control**: Verify user permissions before allowing exports
- **Storage Security**: Maintain secure access to Supabase storage
- **Input Validation**: Validate all user inputs and form data before processing