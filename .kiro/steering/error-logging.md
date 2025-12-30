# Error Logging System Guidelines

## Overview

This document defines the standards and practices for implementing error logging and handling in the event management platform. The system provides comprehensive error tracking, user-friendly feedback, and debugging capabilities through a multi-layered architecture.

## Error Logging Architecture

### Core Components

#### 1. Error Handler API (`src/utils/errorHandler.ts`)
- Centralized error processing and classification
- Error categorization and severity levels
- Message localization and user-friendly formatting
- Performance optimized with caching and throttling
- In-memory error logging with fallback support

#### 2. Enhanced Error Handler (`src/store/enhancedErrorHandling.ts`)
- Store integration layer for Vue components
- Context-aware error handling
- Duplicate message suppression
- Pre-configured error handlers for different domains
- Integration with banner notification system

#### 3. Error Classification System
- Automatic error type detection (network, permission, validation, etc.)
- Severity assessment (fatal, warning, info, success)
- Retry capability determination
- Localized error messages with suggestions

### Error Categories and Types

```typescript
export const ErrorType = {
  NETWORK: 'network',
  PERMISSION: 'permission', 
  VALIDATION: 'validation',
  TIMEOUT: 'timeout',
  SERVER: 'server',
  CLIENT: 'client',
  UNKNOWN: 'unknown'
} as const

export const MessageSeverity = {
  FATAL: 'fatal',
  WARNING: 'warning', 
  INFO: 'info',
  SUCCESS: 'success'
} as const
```

### Error Data Structure

```typescript
interface ErrorRecord {
  id: string
  timestamp: Date
  type: ErrorType
  severity: MessageSeverity
  message: string
  originalError: any
  context: ErrorContext
  retryCount: number
  userAgent: string
}

interface ErrorContext {
  operation: string
  component: string
  userId?: string
  additionalData?: Record<string, any>
}
```

## Implementation Standards

### 1. Error Handling Patterns

#### Using Pre-configured Error Handlers (Recommended)
```typescript
// Import pre-configured handlers from enhancedErrorHandling.ts
import { 
  authErrorHandler,
  formErrorHandler,
  apiErrorHandler,
  teamErrorHandler,
  eventErrorHandler,
  profileErrorHandler
} from '../store/enhancedErrorHandling'

// Team operations
try {
  const result = await supabase.from('teams').insert(teamData)
  return result
} catch (error) {
  teamErrorHandler.handleError(error, { 
    operation: 'createTeam',
    additionalData: { teamData, eventId }
  })
  throw error
}

// Authentication operations
try {
  const { data, error } = await supabase.auth.signIn(credentials)
  if (error) throw error
  return data
} catch (error) {
  authErrorHandler.handleError(error, { 
    operation: 'signIn',
    additionalData: { email: credentials.email }
  })
  throw error
}
```

#### Direct Error Handler Usage
```typescript
// Using the core error handler API directly
import { errorHandler } from '../utils/errorHandler'

try {
  const result = await someOperation()
  return result
} catch (error) {
  const errorResponse = errorHandler.handleError(error, {
    operation: 'someOperation',
    component: 'componentName',
    additionalData: { contextData }
  })
  
  // Error is automatically logged and user message is displayed
  console.log('Error handled:', errorResponse.id)
  throw error
}
```

#### Creating Custom Error Handlers
```typescript
// Create domain-specific error handlers
import { createErrorHandler } from '../store/enhancedErrorHandling'

const submissionErrorHandler = createErrorHandler('submission', 'submission')

// Usage
try {
  await submitProject(projectData)
} catch (error) {
  submissionErrorHandler.handleError(error, {
    operation: 'submitProject',
    additionalData: { projectId, eventId }
  })
}
```

### 2. Error Classification and Localization

#### Automatic Error Classification
```typescript
// The ErrorClassifier automatically categorizes errors
const classifier = new ErrorClassifier()

// Network errors
if (error.message.includes('网络') || error.code === 'NETWORK_ERROR') {
  // Classified as ErrorType.NETWORK with retry capability
}

// Permission errors  
if (error.status === 401 || error.message.includes('权限')) {
  // Classified as ErrorType.PERMISSION, not retryable
}

// Validation errors
if (error.message.includes('validation') || error.message.includes('必填')) {
  // Classified as ErrorType.VALIDATION, not retryable
}
```

#### Localized Error Messages
```typescript
// MessageLocalizer provides user-friendly Chinese messages
const localizer = new MessageLocalizer()

const errorMessages = {
  [ErrorType.NETWORK]: '网络连接失败，请检查网络后重试',
  [ErrorType.PERMISSION]: '权限不足，请联系管理员',
  [ErrorType.VALIDATION]: '输入信息有误，请检查后重试',
  [ErrorType.TIMEOUT]: '操作超时，请稍后重试',
  [ErrorType.SERVER]: '服务器暂时不可用，请稍后重试',
  [ErrorType.CLIENT]: '页面出现错误，请刷新页面后重试',
  [ErrorType.UNKNOWN]: '操作失败，请稍后重试'
}

// Context-aware message customization
const contextualizeMessage = (message: string, context: ErrorContext) => {
  if (context.operation === 'login' && errorType === ErrorType.PERMISSION) {
    return '登录失败，请检查用户名和密码'
  }
  return message
}
```

### 3. Performance Optimizations

#### Error Logging Throttling
```typescript
// Prevent spam logging of identical errors
const LOG_THROTTLE_INTERVAL = 1000 // 1 second
const DUPLICATE_THRESHOLD = 5000 // 5 seconds

// Automatic throttling in ErrorHandlerAPI
private logErrorThrottled(error: any, context?: ErrorContext): void {
  const now = Date.now()
  const key = this.generateErrorKey(error, context)
  
  const lastLogTime = this.logThrottle.get(key)
  if (lastLogTime && (now - lastLogTime) < this.LOG_THROTTLE_INTERVAL) {
    return // Skip logging if within throttle interval
  }
  
  this.logThrottle.set(key, now)
  this.logError(error, context)
}
```

#### Classification Caching
```typescript
// Cache error classifications to improve performance
private classificationCache = new Map<string, ErrorClassification>()
private readonly CLASSIFICATION_CACHE_SIZE = 100

// LRU cache eviction
if (this.classificationCache.size >= this.CLASSIFICATION_CACHE_SIZE) {
  const firstKey = this.classificationCache.keys().next().value
  if (firstKey) {
    this.classificationCache.delete(firstKey)
  }
}
```

## Error Handling Best Practices

### 1. Error Prevention
- Input validation at component and API levels
- Type safety with TypeScript interfaces
- Defensive programming patterns
- Proper null/undefined checks

### 2. Error Recovery
- Graceful degradation for non-critical features
- Retry mechanisms for transient failures (built into error handlers)
- Fallback UI states
- User-guided recovery actions

### 3. Error Monitoring
- Automatic error classification and logging
- Performance impact assessment with throttling
- In-memory error log for debugging
- Context-aware error tracking

### 4. Privacy and Security
- Sanitize sensitive data from error logs
- User-friendly error messages (no technical details exposed)
- Secure error context handling
- Rate limiting for error reporting (built-in throttling)

## Development Workflow

### 1. Error Testing
```typescript
// Error simulation for testing
const simulateError = (type: ErrorType) => {
  switch (type) {
    case ErrorType.NETWORK:
      throw new Error('Simulated network failure')
    case ErrorType.PERMISSION:
      throw new Error('Permission denied')
    case ErrorType.VALIDATION:
      throw new Error('Validation failed')
  }
}

// Disable throttling for tests
errorHandler.setThrottlingEnabled(false)
errorHandler.setDuplicateSuppressionEnabled(false)
```

### 2. Error Log Analysis
```typescript
// Get error logs for debugging
const errorLogs = errorHandler.getErrorLog()

// Clear error logs
errorHandler.clearErrorLog()

// Filter errors by type
const networkErrors = errorLogs.filter(log => log.type === ErrorType.NETWORK)
```

### 3. Performance Considerations
- Built-in error logging throttling (1 second interval)
- Classification result caching (LRU cache, 100 entries)
- Duplicate message suppression (5 second threshold)
- In-memory log size limiting (50 entries max)

## Integration with Existing Systems

### Store Integration
```typescript
// appStore.ts integration (current implementation)
import { 
  enhancedErrorHandler, 
  handleSuccessWithBanner,
  authErrorHandler,
  apiErrorHandler,
  teamErrorHandler,
  eventErrorHandler
} from './enhancedErrorHandling'

// Initialize enhanced error handler with setBanner callback
enhancedErrorHandler.setBannerCallback(setBanner)

// In store actions
catch (error) {
  eventErrorHandler.handleError(error, { 
    operation: 'createEvent',
    additionalData: { eventData }
  })
  
  // Error is automatically logged and banner message is shown
  throw error
}
```

### Component Integration
```vue
<script setup lang="ts">
import { eventErrorHandler } from '@/store/enhancedErrorHandling'

const handleSubmit = async () => {
  try {
    await submitForm()
  } catch (error) {
    eventErrorHandler.handleError(error, {
      operation: 'submitForm',
      additionalData: { formData }
    })
  }
}
</script>
```

This error logging system ensures comprehensive error tracking while maintaining user experience and providing valuable debugging information for developers through a performance-optimized, multi-layered architecture.