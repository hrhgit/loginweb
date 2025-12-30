# Error Logging System Guidelines

## Overview

This document defines the standards and practices for implementing error logging and handling in the event management platform. The system should provide comprehensive error tracking, user-friendly feedback, and debugging capabilities.

## Error Logging Architecture

### Core Components

#### 1. Error Store (`src/store/errorStore.ts`)
- Centralized error state management
- Error categorization and severity levels
- Automatic error persistence to Supabase
- Error deduplication and aggregation

#### 2. Error Logger Service (`src/utils/errorLogger.ts`)
- Structured error logging with context
- Integration with Supabase for persistence
- Client-side error capture and formatting
- Performance impact monitoring

#### 3. Error Boundary Component (`src/components/ErrorBoundary.vue`)
- Vue error boundary implementation
- Graceful error recovery
- User-friendly error display
- Automatic error reporting

### Error Categories

```typescript
enum ErrorCategory {
  AUTHENTICATION = 'auth',
  DATABASE = 'database', 
  NETWORK = 'network',
  VALIDATION = 'validation',
  PERMISSION = 'permission',
  SYSTEM = 'system',
  USER_ACTION = 'user_action'
}

enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium', 
  HIGH = 'high',
  CRITICAL = 'critical'
}
```

### Error Data Structure

```typescript
interface ErrorLog {
  id: string
  timestamp: string
  category: ErrorCategory
  severity: ErrorSeverity
  message: string
  stack?: string
  context: {
    userId?: string
    route: string
    userAgent: string
    action?: string
    eventId?: string
    teamId?: string
  }
  resolved: boolean
  resolution?: string
}
```

## Implementation Standards

### 1. Error Capture Patterns

#### Async Operations
```typescript
// Store action pattern
async createEvent(eventData: EventData) {
  try {
    const result = await supabase.from('events').insert(eventData)
    if (result.error) throw result.error
    return result.data
  } catch (error) {
    this.logError({
      category: ErrorCategory.DATABASE,
      severity: ErrorSeverity.HIGH,
      message: 'Failed to create event',
      context: { action: 'createEvent', eventData }
    })
    throw error
  }
}
```

#### Component Error Handling
```vue
<script setup lang="ts">
import { useErrorLogger } from '@/composables/useErrorLogger'

const { logError, handleAsyncError } = useErrorLogger()

const submitForm = handleAsyncError(async () => {
  // Form submission logic
}, {
  category: ErrorCategory.USER_ACTION,
  context: { action: 'submitEventForm' }
})
</script>
```

### 2. User Feedback Integration

#### Error Display Components
- `ErrorAlert.vue` - Inline error messages
- `ErrorModal.vue` - Critical error dialogs  
- `ErrorToast.vue` - Non-blocking error notifications

#### Error Message Localization
```typescript
const errorMessages = {
  'auth/invalid-credentials': '用户名或密码错误',
  'database/connection-failed': '数据库连接失败，请稍后重试',
  'network/timeout': '网络请求超时，请检查网络连接',
  'validation/required-field': '请填写必填字段'
}
```

### 3. Database Schema

#### Error Logs Table
```sql
CREATE TABLE error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  context JSONB,
  user_id UUID REFERENCES auth.users(id),
  route TEXT,
  user_agent TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id)
);
```

#### RLS Policies
```sql
-- Users can only see their own errors
CREATE POLICY "Users can view own errors" ON error_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all errors
CREATE POLICY "Admins can view all errors" ON error_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

## Error Handling Best Practices

### 1. Error Prevention
- Input validation at component and API levels
- Type safety with TypeScript interfaces
- Defensive programming patterns
- Proper null/undefined checks

### 2. Error Recovery
- Graceful degradation for non-critical features
- Retry mechanisms for transient failures
- Fallback UI states
- User-guided recovery actions

### 3. Error Monitoring
- Real-time error tracking dashboard
- Error trend analysis
- Performance impact assessment
- Automated alerting for critical errors

### 4. Privacy and Security
- Sanitize sensitive data from error logs
- Secure error log access with RLS
- GDPR compliance for error data retention
- Rate limiting for error reporting

## Development Workflow

### 1. Error Testing
```typescript
// Error simulation for testing
const simulateError = (type: ErrorCategory) => {
  switch (type) {
    case ErrorCategory.NETWORK:
      throw new Error('Simulated network failure')
    case ErrorCategory.DATABASE:
      throw new Error('Simulated database error')
  }
}
```

### 2. Error Log Analysis
- Use Supabase dashboard for error monitoring
- Implement error aggregation queries
- Create error resolution workflows
- Track error resolution metrics

### 3. Performance Considerations
- Batch error logging to reduce API calls
- Implement client-side error queuing
- Use debouncing for rapid error sequences
- Monitor error logging performance impact

## Integration with Existing Systems

### Store Integration
```typescript
// Add to appStore.ts
const errorStore = useErrorStore()

// In store actions
catch (error) {
  errorStore.logError({
    category: ErrorCategory.DATABASE,
    severity: ErrorSeverity.HIGH,
    message: error.message,
    context: { action: 'currentAction' }
  })
  
  // Show user notification
  this.showBanner({
    type: 'error',
    message: '操作失败，请稍后重试'
  })
}
```

### Router Integration
```typescript
// Global error handling in router
router.onError((error) => {
  errorStore.logError({
    category: ErrorCategory.SYSTEM,
    severity: ErrorSeverity.MEDIUM,
    message: error.message,
    context: { route: router.currentRoute.value.path }
  })
})
```

This error logging system ensures comprehensive error tracking while maintaining user experience and providing valuable debugging information for developers.