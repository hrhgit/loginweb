# Project Structure

## Directory Organization

### Core Application Files
- `src/main.ts` - Application entry point, mounts Vue + Router
- `src/App.vue` - Root component with global layout and modals
- `src/router.ts` - Route definitions and navigation configuration
- `src/style.css` - Global styles and CSS custom properties

### State Management
- `src/store/appStore.ts` - Central store for all business logic and state
- `src/store/models.ts` - TypeScript type definitions for store
- `src/store/eventSchema.ts` - Event field definitions and default values
- `src/store/demoEvents.ts` - Demo data for development/testing
- `src/lib/supabase.ts` - Supabase client initialization

### Pages (Route Components)
- `src/pages/EventsPage.vue` - Public events listing
- `src/pages/MyEventsPage.vue` - Admin's created events (drafts visible here)
- `src/pages/EventDetailPage.vue` - Event details with tabs (intro/registration/team/submission)
- `src/pages/EventEditPage.vue` - Event creation and editing interface
- `src/pages/ProfilePage.vue` - User profile and account management
- `src/pages/TeamCreatePage.vue` - Team creation and editing
- `src/pages/TeamDetailPage.vue` - Team information display
- `src/pages/SubmissionPage.vue` - Project submission interface

### Reusable Components

#### Layout Components
- `src/components/layout/AppHeader.vue` - Global navigation header
- `src/components/layout/AppFooter.vue` - Global footer

#### UI Components
- `src/components/events/EventCard.vue` - Reusable event card component
- `src/components/feedback/GlobalBanner.vue` - Toast notifications
- `src/components/modals/AuthModal.vue` - Login/registration modal
- `src/components/modals/CreateEventModal.vue` - Event creation modal
- `src/components/modals/AvatarCropperModal.vue` - Image cropping modal

### Utilities
- `src/composables/useEventsReady.ts` - Shared loading logic for event lists
- `src/utils/eventDetails.ts` - Event description JSON serialization/parsing
- `src/utils/eventFormat.ts` - Display formatting (dates, status, etc.)
- `src/utils/roleTags.ts` - User role and tag utilities

## Architecture Patterns

### Data Flow
1. **Pages** handle user interactions and call store actions
2. **Store** manages business logic, API calls, and global state
3. **Utils** provide pure functions for formatting and data transformation
4. **Components** focus on reusable UI without direct database logic

### Component Responsibility
- **Pages**: User interactions, route-specific logic, store integration
- **Layout Components**: Global UI structure and navigation
- **UI Components**: Reusable interface elements with props/events
- **Modals**: Overlay interfaces for specific actions
- **Utils/Composables**: Shared logic and data processing

### State Management Pattern
- Single global store using Vue's Composition API
- Reactive state with `ref()` and `computed()`
- Actions as methods that handle async operations and side effects
- Store exposed globally via `useAppStore()` composable

### Styling Architecture
- CSS custom properties (variables) in `:root` for theming
- BEM-like naming convention for CSS classes
- Component-scoped styles when needed
- Global utility classes for common patterns