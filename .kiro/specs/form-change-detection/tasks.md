# Implementation Plan

- [x] 1. Implement form change detection for TeamCreatePage




  - Add reactive state variables for tracking form changes and navigation control
  - Implement form state serialization function to capture all form field values
  - Add computed property for change detection using snapshot comparison
  - _Requirements: 1.1, 1.5_

- [x] 1.1 Add form state tracking variables to TeamCreatePage


  - Add `savedSnapshot` ref for storing serialized form state
  - Add `allowNavigation` ref for controlling navigation flow
  - Initialize variables in component setup
  - _Requirements: 1.1_

- [ ]* 1.2 Write property test for team form change detection
  - **Property 1: Form Change Detection**
  - **Validates: Requirements 1.1**

- [x] 1.3 Implement form serialization for team creation form


  - Create `serializeFormState` function that captures all form fields
  - Include teamName, leaderQq, teamIntro, teamNeeds, and teamExtra
  - Ensure consistent JSON serialization format
  - _Requirements: 1.1_

- [x] 1.4 Add change detection computed property to TeamCreatePage


  - Implement `isDirty` computed property using snapshot comparison
  - Compare current form state with saved snapshot
  - Handle edge cases for empty or invalid snapshots
  - _Requirements: 1.1_

- [ ]* 1.5 Write property test for team navigation guard behavior
  - **Property 2: Navigation Guard Activation**
  - **Validates: Requirements 1.2**

- [x] 2. Implement navigation guards for TeamCreatePage





  - Add Vue Router navigation guard using onBeforeRouteLeave
  - Implement browser beforeunload event handler
  - Add confirmation dialog with consistent messaging
  - _Requirements: 1.2, 1.3, 1.4_

- [x] 2.1 Add Vue Router navigation guard to TeamCreatePage


  - Import and use `onBeforeRouteLeave` from vue-router
  - Check `isDirty` and `allowNavigation` state before allowing navigation
  - Display confirmation dialog when unsaved changes exist
  - _Requirements: 1.2, 1.3, 1.4_

- [x] 2.2 Add browser event handler for TeamCreatePage

  - Implement `handleBeforeUnload` function for browser tab/window closing
  - Add event listener in onMounted lifecycle hook
  - Remove event listener in onBeforeUnmount lifecycle hook
  - _Requirements: 3.2_

- [ ]* 2.3 Write property test for navigation confirmation flow
  - **Property 3: Navigation Confirmation Flow**
  - **Validates: Requirements 1.3, 1.4**

- [x] 3. Update team form submission handling




  - Modify submit function to clear dirty state on successful submission
  - Set allowNavigation flag to true after successful team creation/update
  - Initialize saved snapshot after form data is loaded for editing
  - _Requirements: 1.5_

- [x] 3.1 Update team form submit function


  - Set `allowNavigation.value = true` after successful API call
  - Clear dirty state by updating saved snapshot
  - Ensure navigation proceeds without warnings after submission
  - _Requirements: 1.5_

- [x] 3.2 Add snapshot initialization for team editing


  - Call `syncSavedSnapshot()` after loading existing team data
  - Ensure edit mode starts with clean state
  - Handle cases where team data loading fails
  - _Requirements: 3.4_

- [ ]* 3.3 Write property test for successful submission cleanup
  - **Property 6: Successful Submission State Reset**
  - **Validates: Requirements 1.5**


- [x] 4. Checkpoint - Ensure TeamCreatePage tests pass






  - Ensure all tests pass, ask the user if questions arise.


- [x] 5. Enhance form change detection for SubmissionPage




  - Improve existing hasChanges logic with snapshot-based comparison
  - Add form serialization for all submission form fields
  - Integrate file upload state into change detection
  - _Requirements: 2.1, 2.2_

- [x] 5.1 Add form state tracking variables to SubmissionPage


  - Add `savedSnapshot` ref for storing serialized form state
  - Add `allowNavigation` ref for controlling navigation flow
  - Modify existing `isSubmitted` ref usage for navigation control
  - _Requirements: 2.1_

- [x] 5.2 Implement form serialization for submission form


  - Create `serializeFormState` function for all submission fields
  - Include projectName, teamId, intro, videoLink, linkMode, submissionLink, submissionPassword
  - Include file names for coverFile and submissionFile
  - _Requirements: 2.1, 2.2_

- [x] 5.3 Enhance change detection with snapshot comparison


  - Modify existing `hasChanges` computed to use `isDirty` pattern
  - Implement `isDirty` computed property using snapshot comparison
  - Maintain backward compatibility with existing change detection
  - _Requirements: 2.1, 2.2_

- [ ]* 5.4 Write property test for submission form change detection
  - **Property 1: Form Change Detection**
  - **Validates: Requirements 2.1**

- [ ]* 5.5 Write property test for file upload change tracking
  - **Property 4: File Upload Change Tracking**
  - **Validates: Requirements 2.2**

- [x] 6. Implement navigation guards for SubmissionPage





  - Enhance existing onBeforeRouteLeave with snapshot-based change detection
  - Update file cleanup logic to work with new change detection
  - Add browser beforeunload event handler
  - _Requirements: 2.3, 2.4, 2.5_

- [x] 6.1 Enhance existing navigation guard in SubmissionPage


  - Modify existing `onBeforeRouteLeave` to use `isDirty` computed property
  - Maintain existing file cleanup logic for uploaded files
  - Ensure consistent confirmation dialog messaging
  - _Requirements: 2.3, 2.4, 2.5_

- [x] 6.2 Add browser event handler for SubmissionPage


  - Implement `handleBeforeUnload` function for browser events
  - Add event listener management in lifecycle hooks
  - Ensure compatibility with existing file upload handling
  - _Requirements: 3.2_

- [ ]* 6.3 Write property test for file cleanup on navigation
  - **Property 5: File Cleanup on Navigation**
  - **Validates: Requirements 2.4**


- [x] 7. Update submission form handling




  - Modify submit function to clear dirty state on successful submission
  - Initialize saved snapshot when form loads
  - Ensure file upload handlers trigger change detection
  - _Requirements: 2.6_

- [x] 7.1 Update submission form submit function


  - Set `allowNavigation.value = true` after successful submission
  - Update `isSubmitted.value = true` to work with new navigation logic
  - Clear dirty state by updating saved snapshot
  - _Requirements: 2.6_

- [x] 7.2 Add snapshot initialization for submission form


  - Call `syncSavedSnapshot()` after component mounts and data loads
  - Ensure form starts with clean state
  - Handle team options loading and selection
  - _Requirements: 3.4_

- [x] 7.3 Update file upload handlers to trigger change detection


  - Modify `pickCover` and `pickSubmissionFile` functions
  - Update saved snapshot after successful file uploads
  - Ensure file removal also triggers change detection
  - _Requirements: 2.2_

- [ ]* 7.4 Write property test for submission state reset
  - **Property 6: Successful Submission State Reset**
  - **Validates: Requirements 2.6**


- [x] 8. Checkpoint - Ensure SubmissionPage tests pass




  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement consistency and validation features





  - Ensure consistent dialog messaging across all forms
  - Add validation error handling that preserves dirty state
  - Test browser event integration across all forms
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 9.1 Standardize confirmation dialog messages


  - Create consistent warning text across TeamCreatePage and SubmissionPage
  - Match existing EventEditPage dialog messaging
  - Ensure Chinese localization is consistent
  - _Requirements: 3.1_

- [x] 9.2 Add validation error handling


  - Ensure form validation errors don't clear dirty state
  - Maintain unsaved changes flag during validation failures
  - Test integration with existing validation logic
  - _Requirements: 3.3_

- [ ]* 9.3 Write property test for form consistency
  - **Property 8: Form State Consistency**
  - **Validates: Requirements 3.1**

- [ ]* 9.4 Write property test for browser event integration
  - **Property 7: Browser Event Integration**
  - **Validates: Requirements 3.2**

- [ ]* 9.5 Write property test for validation error persistence
  - **Property 9: Validation Error Persistence**
  - **Validates: Requirements 3.3**

- [ ]* 9.6 Write property test for clean initial state
  - **Property 10: Clean Initial State**
  - **Validates: Requirements 3.4**

- [x] 10. Testing and validation





  - Run comprehensive tests across all form pages
  - Verify consistent behavior with EventEditPage
  - Test edge cases and error scenarios
  - _Requirements: All_

- [x] 10.1 Create integration tests for form workflows


  - Test complete user workflows from form entry to submission
  - Test navigation between different pages with unsaved changes
  - Test browser refresh and tab closing scenarios
  - _Requirements: All_

- [ ]* 10.2 Write property test for extensible change detection
  - **Property 11: Extensible Change Detection**
  - **Validates: Requirements 4.2**

- [x] 10.3 Perform cross-browser testing


  - Test beforeunload behavior in different browsers
  - Verify file upload and cleanup works consistently
  - Test navigation guard behavior across browsers
  - _Requirements: 3.2, 2.4_

- [x] 11. Final checkpoint - Complete system validation





  - Ensure all tests pass, ask the user if questions arise.