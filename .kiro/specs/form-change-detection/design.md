# Design Document

## Overview

This design implements form change detection and unsaved changes warnings for TeamCreatePage and SubmissionPage, following the existing pattern established in EventEditPage. The solution provides a consistent user experience across all form pages while preventing accidental data loss.

## Architecture

The implementation follows Vue 3 Composition API patterns and integrates with Vue Router's navigation guards. The architecture consists of:

1. **Form State Tracking**: Reactive state management to track form field changes
2. **Change Detection Logic**: Computed properties to determine if unsaved changes exist
3. **Navigation Guards**: Vue Router guards to intercept navigation attempts
4. **Browser Event Handling**: beforeunload event listeners for tab/window closing
5. **File Cleanup Logic**: Automatic cleanup of uploaded files when navigation is confirmed

## Components and Interfaces

### TeamCreatePage Enhancements

**New Reactive State:**
```typescript
const savedSnapshot = ref('')
const allowNavigation = ref(false)
```

**Change Detection:**
```typescript
const isDirty = computed(() => {
  if (!savedSnapshot.value) return false
  return savedSnapshot.value !== serializeFormState()
})
```

**Form Serialization:**
```typescript
const serializeFormState = () => JSON.stringify({
  teamName: teamName.value,
  leaderQq: leaderQq.value,
  teamIntro: teamIntro.value,
  teamNeeds: teamNeeds.value,
  teamExtra: teamExtra.value
})
```

### SubmissionPage Enhancements

**New Reactive State:**
```typescript
const savedSnapshot = ref('')
const allowNavigation = ref(false)
const isSubmitted = ref(false) // Already exists
```

**Enhanced Change Detection:**
```typescript
const hasChanges = computed(() => {
  return projectName.value.trim() !== '' || 
         intro.value.trim() !== '' || 
         coverFile.value !== null ||
         submissionFile.value !== null ||
         submissionLink.value.trim() !== '' ||
         videoLink.value.trim() !== ''
})

const isDirty = computed(() => {
  if (!savedSnapshot.value) return false
  return savedSnapshot.value !== serializeFormState()
})
```

**Form Serialization:**
```typescript
const serializeFormState = () => JSON.stringify({
  projectName: projectName.value,
  teamId: teamId.value,
  intro: intro.value,
  videoLink: videoLink.value,
  linkMode: linkMode.value,
  submissionLink: submissionLink.value,
  submissionPassword: submissionPassword.value,
  coverFileName: coverFile.value?.name || '',
  submissionFileName: submissionFile.value?.name || ''
})
```

## Data Models

### Form State Snapshot
```typescript
interface FormSnapshot {
  [key: string]: any
}
```

### Navigation Control
```typescript
interface NavigationState {
  allowNavigation: boolean
  isDirty: boolean
  savedSnapshot: string
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

**Property 1: Form Change Detection**
*For any* form with modified fields, the change detection system should correctly identify that changes have been made
**Validates: Requirements 1.1, 2.1, 2.2**

**Property 2: Navigation Guard Activation**
*For any* navigation attempt on a form with unsaved changes, the navigation guard should intercept and display a confirmation dialog
**Validates: Requirements 1.2, 2.3**

**Property 3: Navigation Confirmation Flow**
*For any* navigation confirmation dialog, accepting should allow navigation and canceling should preserve form state
**Validates: Requirements 1.3, 1.4, 2.5**

**Property 4: File Upload Change Tracking**
*For any* file upload operation, the change detection system should track the upload as a form modification
**Validates: Requirements 2.2**

**Property 5: File Cleanup on Navigation**
*For any* submission form with uploaded files, confirming navigation should clean up all uploaded files
**Validates: Requirements 2.4**

**Property 6: Successful Submission State Reset**
*For any* successful form submission, the system should clear the dirty state and allow unrestricted navigation
**Validates: Requirements 1.5, 2.6**

**Property 7: Browser Event Integration**
*For any* form with unsaved changes, browser beforeunload events should trigger the native warning dialog
**Validates: Requirements 3.2**

**Property 8: Form State Consistency**
*For any* form across different pages, the warning dialog behavior and text should be consistent
**Validates: Requirements 3.1**

**Property 9: Validation Error Persistence**
*For any* form with validation errors, the unsaved changes flag should persist until successful submission
**Validates: Requirements 3.3**

**Property 10: Clean Initial State**
*For any* form page load, the system should start with no unsaved changes flag set
**Validates: Requirements 3.4**

**Property 11: Extensible Change Detection**
*For any* new form fields added to existing forms, the change detection should automatically include them
**Validates: Requirements 4.2**

## Error Handling

### Navigation Errors
- Handle cases where navigation confirmation dialog fails to display
- Ensure navigation state is properly reset after failed navigation attempts
- Gracefully handle browser back/forward button interactions

### File Upload Errors
- Clean up partially uploaded files when navigation is confirmed
- Handle file cleanup failures gracefully without blocking navigation
- Ensure file references are properly cleared from component state

### State Synchronization Errors
- Handle cases where form state serialization fails
- Ensure isDirty computation remains accurate even with malformed data
- Provide fallback behavior when snapshot comparison fails

## Testing Strategy

### Unit Testing
- Test form state serialization with various input combinations
- Test isDirty computation with different form states
- Test navigation guard behavior with various scenarios
- Test file cleanup logic with different file states

### Property-Based Testing
- Use **fast-check** library for property-based testing in TypeScript/JavaScript
- Generate random form states to verify change detection accuracy
- Test navigation scenarios with randomly generated form data
- Verify file cleanup behavior with various file upload states

**Property-based test requirements:**
- Each property-based test MUST run a minimum of 100 iterations
- Each test MUST be tagged with comments referencing the design document property
- Test tags MUST use format: '**Feature: form-change-detection, Property {number}: {property_text}**'
- Each correctness property MUST be implemented by a SINGLE property-based test

### Integration Testing
- Test complete user workflows from form entry to submission
- Test navigation between different pages with unsaved changes
- Test browser refresh and tab closing scenarios
- Test file upload and cleanup integration

## Implementation Plan

### Phase 1: TeamCreatePage Implementation
1. Add form state tracking variables
2. Implement form serialization logic
3. Add change detection computed property
4. Implement navigation guards
5. Add browser event handlers
6. Update form submission to clear dirty state

### Phase 2: SubmissionPage Implementation
1. Enhance existing hasChanges logic with snapshot comparison
2. Add form serialization for all form fields
3. Implement navigation guards with file cleanup
4. Update file upload handlers to trigger change detection
5. Ensure successful submission clears all state

### Phase 3: Testing and Validation
1. Implement unit tests for all new functionality
2. Add property-based tests for correctness properties
3. Perform integration testing across all form pages
4. Validate consistent behavior with EventEditPage

### Phase 4: Code Review and Optimization
1. Review implementation for code consistency
2. Optimize performance of change detection logic
3. Ensure proper cleanup of event listeners
4. Document any deviations from the design

## Performance Considerations

### Change Detection Optimization
- Use efficient JSON serialization for form state comparison
- Implement debouncing for frequent form field updates
- Avoid unnecessary re-computation of isDirty property

### Memory Management
- Properly clean up event listeners on component unmount
- Clear file references and blob URLs when appropriate
- Ensure snapshot strings don't accumulate in memory

### File Upload Handling
- Implement efficient file cleanup without blocking UI
- Handle large file uploads gracefully in change detection
- Ensure uploaded files are properly tracked in form state

## Security Considerations

### Data Validation
- Ensure form serialization doesn't expose sensitive data
- Validate form state before comparison operations
- Handle malformed or malicious form data gracefully

### File Upload Security
- Validate file types and sizes before tracking in form state
- Ensure file cleanup doesn't expose file system paths
- Handle file upload errors without exposing internal details