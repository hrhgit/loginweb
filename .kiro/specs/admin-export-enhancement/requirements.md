# Requirements Document

## Introduction

This feature enhances the event administration system by improving the export functionality for registration forms and submission downloads. The system will provide better data organization, dynamic column generation based on form fields, and improved file naming conventions for downloads.

## Glossary

- **Event_Admin_System**: The administrative interface for managing events and their associated data
- **Form_Response**: JSONB data structure containing user responses to registration form questions
- **Registration_Export**: Excel file generation functionality for registration data
- **Submission_Download**: File download functionality for submitted project files
- **Dynamic_Columns**: Excel columns generated based on actual form questions in registration responses

## Requirements

### Requirement 1

**User Story:** As an event administrator, I want to export registration data with dynamic columns based on form questions, so that I can analyze all registration responses in a structured format.

#### Acceptance Criteria

1. WHEN an administrator exports registration data THEN the system SHALL generate Excel columns dynamically based on all unique form questions found in form_response data
2. WHEN form_response contains nested question-answer pairs THEN the system SHALL flatten them into separate columns with descriptive headers
3. WHEN multiple registrations have different form questions THEN the system SHALL include all unique questions as columns and fill missing values with empty cells
4. WHEN exporting registration data THEN the system SHALL include standard columns for user information, registration status, and timestamp
5. WHEN the Excel file is generated THEN the system SHALL use a filename format of "{event_title}_报名表_{date}.xlsx"

### Requirement 2

**User Story:** As an event administrator, I want to download submission files with consistent naming based on submission order, so that I can easily organize and review submitted projects.

#### Acceptance Criteria

1. WHEN downloading submission files THEN the system SHALL name files using the format "{submission_number}-{team_name}-{project_name}.{extension}"
2. WHEN determining submission numbers THEN the system SHALL order submissions by their created_at timestamp in ascending order
3. WHEN team names or project names contain invalid filename characters THEN the system SHALL sanitize them by replacing invalid characters with underscores
4. WHEN submission numbers are generated THEN the system SHALL pad them with leading zeros to maintain consistent sorting (e.g., 001, 002, 010)
5. WHEN creating the download archive THEN the system SHALL use a filename format of "{event_title}_作品批量下载_{date}.zip"

### Requirement 3

**User Story:** As an event administrator, I want improved error handling and progress feedback during export operations, so that I can understand the status and troubleshoot any issues.

#### Acceptance Criteria

1. WHEN export operations encounter errors THEN the system SHALL provide specific error messages indicating the cause and affected items
2. WHEN processing large datasets THEN the system SHALL display progress indicators showing current operation and completion percentage
3. WHEN individual file downloads fail during batch operations THEN the system SHALL continue processing remaining files and log failed items
4. WHEN export operations complete THEN the system SHALL display a summary of successful and failed operations
5. WHEN network or storage errors occur THEN the system SHALL provide retry mechanisms for failed operations

### Requirement 4

**User Story:** As an event administrator, I want to preview registration data structure before export, so that I can understand what information will be included in the Excel file.

#### Acceptance Criteria

1. WHEN viewing the registration export section THEN the system SHALL display a preview showing detected form questions and sample data
2. WHEN form_response data contains complex structures THEN the system SHALL show how they will be flattened in the preview
3. WHEN no registration data exists THEN the system SHALL display an appropriate message indicating no data is available for export
4. WHEN form questions are detected THEN the system SHALL show the total count of unique questions and registrations
5. WHEN the preview is displayed THEN the system SHALL limit the preview to the first 5 registrations to avoid performance issues
