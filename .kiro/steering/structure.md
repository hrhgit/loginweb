# Project Structure

## Directory Organization

### Core Application Files
- `src/main.ts` - Application entry point, mounts Vue + Router
- `src/App.vue` - Root component with global layout and modals
- `src/router.ts` - Route definitions and navigation configuration
- `src/style.css` - Global styles and CSS custom properties
- `src/fonts.css` - Font definitions and typography styles

### State Management & Data Layer
- `src/store/appStore.ts` - Central store for all business logic and state
- `src/store/models.ts` - TypeScript type definitions for store
- `src/store/eventSchema.ts` - Event field definitions and default values
- `src/store/demoEvents.ts` - Demo data for development/testing
- `src/store/enhancedErrorHandling.ts` - Enhanced error handling with context awareness
- `src/lib/supabase.ts` - Supabase client initialization
- `src/lib/vueQuery.ts` - Vue Query configuration and query key factories
- `src/lib/vueQueryErrorHandling.ts` - Vue Query error handling integration

### Pages (Route Components)
- `src/pages/EventsPage.vue` - Public events listing with filtering
- `src/pages/MyEventsPage.vue` - Admin's created events (drafts visible here)
- `src/pages/EventDetailPage.vue` - Event details with tabs (intro/registration/team/submission)
- `src/pages/EventEditPage.vue` - Event creation and editing interface
- `src/pages/EventAdminPage.vue` - Event administration and management
- `src/pages/ProfilePage.vue` - User profile and account management
- `src/pages/TeamCreatePage.vue` - Team creation and editing
- `src/pages/TeamDetailPage.vue` - Team information display
- `src/pages/SubmissionPage.vue` - Project submission interface
- `src/pages/SubmissionDetailPage.vue` - Individual submission details
- `src/pages/JudgeWorkspacePage.vue` - Judge evaluation workspace
- `src/pages/VueQueryDemoPage.vue` - Vue Query demonstration and testing

- `src/pages/NotFoundPage.vue` - 404 error page

### Reusable Components

#### Layout Components
- `src/components/layout/AppHeader.vue` - Global navigation header
- `src/components/layout/AppFooter.vue` - Global footer

#### Feature Components
- `src/components/events/` - Event-related components (cards, lists, forms)
- `src/components/teams/` - Team management components
- `src/components/submissions/` - Submission display and management
- `src/components/judges/` - Judge evaluation interface components
- `src/components/admin/` - Administrative interface components
- `src/components/showcase/` - Public showcase and display components

#### UI Components
- `src/components/ui/` - Generic UI components (buttons, inputs, etc.)
- `src/components/feedback/GlobalBanner.vue` - Toast notifications and feedback
- `src/components/modals/` - Modal dialogs (auth, creation, cropping)
- `src/components/VirtualGrid.vue` - Performance-optimized virtual grid
- `src/components/EnhancedVirtualGrid.vue` - Enhanced virtual grid with features
- `src/components/ResponsiveImage.vue` - Responsive image component
- `src/components/MyTeamsTabContent.vue` - Team tab content component

### Composables (Vue 3 Composition Functions)
- `src/composables/useEvents.ts` - Event data management
- `src/composables/useEventsReady.ts` - Shared loading logic for event lists
- `src/composables/useEventsWithRegistrationCount.ts` - Events with registration counts
- `src/composables/useTeams.ts` - Team data management
- `src/composables/useSubmissions.ts` - Submission data management
- `src/composables/useJudges.ts` - Judge data management
- `src/composables/useJudgesOptimized.ts` - Optimized judge queries
- `src/composables/useUsers.ts` - User data management
- `src/composables/useRegistrationForm.ts` - Registration form logic
- `src/composables/useNotifications.ts` - Notification system
- `src/composables/useNotificationIntegration.ts` - Notification integration
- `src/composables/useAuthRefresh.ts` - Authentication refresh logic
- `src/composables/useCodeSplitting.ts` - Code splitting utilities
- `src/composables/useSafeQuery.ts` - Safe query wrapper

### Utilities & Helpers

#### Core Utilities
- `src/utils/eventDetails.ts` - Event description JSON serialization/parsing
- `src/utils/eventFormat.ts` - Display formatting (dates, status, etc.)
- `src/utils/roleTags.ts` - User role and tag utilities
- `src/utils/authHelpers.ts` - Authentication helper functions
- `src/utils/textUtils.ts` - Text processing utilities
- `src/utils/excelUtils.ts` - Excel file processing
- `src/utils/exportUtils.ts` - Data export utilities

#### Performance & Optimization
- `src/utils/performanceMonitor.ts` - Performance monitoring and metrics
- `src/utils/performanceConfig.ts` - Performance configuration
- `src/utils/cacheManager.ts` - Cache management system
- `src/utils/cacheMonitor.ts` - Cache monitoring and analytics
- `src/utils/memoryManager.ts` - Memory usage optimization
- `src/utils/networkManager.ts` - Network state management
- `src/utils/dataUsageOptimizer.ts` - Data usage optimization
- `src/utils/bandwidthAwareDelivery.ts` - Bandwidth-aware content delivery
- `src/utils/progressiveLoading.ts` - Progressive loading strategies
- `src/utils/instantLoadingOptimization.ts` - Instant loading optimizations
- `src/utils/loadingStateOptimization.ts` - Loading state optimizations

#### Error Handling & Reliability
- `src/utils/errorHandler.ts` - Core error handling system
- `src/utils/errorLogManager.ts` - Error logging management
- `src/utils/errorReporting.ts` - Error reporting utilities
- `src/utils/globalErrorHandler.ts` - Global error handling
- `src/utils/authErrorMessages.ts` - Authentication error messages
- `src/utils/gracefulDegradation.ts` - Graceful degradation strategies
- `src/utils/fallbackStrategy.ts` - Fallback strategies for failures

#### Data Management
- `src/utils/vueQueryCacheOptimizer.ts` - Vue Query cache optimization
- `src/utils/supabaseCacheIntegration.ts` - Supabase cache integration
- `src/utils/appStoreCacheIntegration.ts` - App store cache integration
- `src/utils/simpleStateCache.ts` - Simple state caching
- `src/utils/statePersistence.ts` - State persistence utilities
- `src/utils/dataCompressionUtils.ts` - Data compression utilities
- `src/utils/incrementalUpdates.ts` - Incremental update system
- `src/utils/updateBatcher.ts` - Update batching system
- `src/utils/realtimeUpdateIntegration.ts` - Real-time update integration

#### Offline & Network
- `src/utils/offlineManager.ts` - Offline functionality management
- `src/utils/offlineFormHandler.ts` - Offline form handling
- `src/utils/networkMemoryIntegration.ts` - Network and memory integration
- `src/utils/requestTimeout.ts` - Request timeout handling
- `src/utils/downloadUtils.ts` - Download utilities

#### Development & Debugging
- `src/utils/registrationFormDebug.ts` - Registration form debugging
- `src/utils/registrationFormFixes.ts` - Registration form fixes
- `src/utils/deploymentVerifier.ts` - Deployment verification
- `src/utils/backgroundProcessor.ts` - Background processing
- `src/utils/moduleLoader.ts` - Dynamic module loading
- `src/utils/moduleLoadingUtils.ts` - Module loading utilities
- `src/utils/codeSplitting.ts` - Code splitting utilities
- `src/utils/enhancedRouter.ts` - Enhanced routing utilities

#### Image & Media
- `src/utils/imageUrlGenerator.ts` - Image URL generation with cache busting
- `src/directives/vLazyLoad.ts` - Lazy loading directive
- `src/directives/vProgressiveImage.ts` - Progressive image loading directive

#### Form Processing
- `src/utils/formResponseParser.ts` - Form response parsing utilities

## Architecture Patterns

### Data Flow Architecture
1. **Pages** handle user interactions and route-specific logic
2. **Composables** manage data fetching with Vue Query integration
3. **Store** manages global state and business logic
4. **Utils** provide pure functions for data transformation and optimization
5. **Components** focus on reusable UI without direct database logic

### Vue Query Integration
- **Centralized Query Management**: All data fetching uses Vue Query for caching and synchronization
- **Query Key Factories**: Standardized query keys in `src/lib/vueQuery.ts`
- **Stale-While-Revalidate**: 30-second cache with background updates
- **Error Handling**: Integrated with enhanced error handling system
- **Performance Optimization**: Cache optimization and memory management

### Component Responsibility
- **Pages**: User interactions, route-specific logic, composable integration
- **Layout Components**: Global UI structure and navigation
- **Feature Components**: Domain-specific functionality (events, teams, submissions)
- **UI Components**: Reusable interface elements with props/events
- **Modals**: Overlay interfaces for specific actions
- **Composables**: Data management and business logic
- **Utils**: Pure functions and system utilities

### State Management Pattern
- **Global Store**: Single store using Vue's Composition API (`useAppStore()`)
- **Reactive State**: `ref()` and `computed()` for reactive data
- **Actions**: Methods handling async operations and side effects
- **Vue Query Integration**: Composables handle data fetching and caching
- **Error Handling**: Enhanced error handling with context awareness
- **Performance Monitoring**: Built-in performance tracking and optimization

### Caching Architecture
- **Multi-Layer Caching**: Vue Query + Browser + Application caches
- **Cache Invalidation**: Automatic invalidation on data mutations
- **Offline Support**: Offline-first approach with graceful degradation
- **Memory Management**: Automatic memory optimization and cleanup
- **Network Awareness**: Bandwidth-aware content delivery

### Performance Optimization
- **Virtual Scrolling**: Large list optimization with virtual grids
- **Code Splitting**: Dynamic imports and lazy loading
- **Progressive Loading**: Incremental content loading
- **Image Optimization**: Lazy loading and progressive images
- **Bundle Optimization**: Tree shaking and module optimization

### Error Handling System
- **Multi-Layer Error Handling**: Component → Composable → Store → Global
- **Context-Aware Errors**: Error classification with user-friendly messages
- **Retry Mechanisms**: Automatic retry for network errors
- **Error Logging**: Comprehensive error tracking and reporting
- **Graceful Degradation**: Fallback strategies for critical failures

### Styling Architecture
- **CSS Custom Properties**: Design token system in `:root`
- **Component-Based Styles**: Scoped styles with global utilities
- **Responsive Design**: Mobile-first with fluid typography
- **Design System**: Consistent spacing, colors, and typography
- **Performance**: Optimized CSS delivery and caching

### Development Patterns
- **TypeScript First**: Strong typing throughout the application
- **Composition API**: Vue 3 `<script setup>` syntax
- **Modular Architecture**: Feature-based organization
- **Testing Strategy**: Component and integration testing
- **Performance Monitoring**: Built-in metrics and optimization

## Key Features & Systems

### Vue Query Integration
- **Caching Strategy**: 30-second stale time with background revalidation
- **Query Keys**: Centralized factory pattern for consistent cache management
- **Error Handling**: Integrated with enhanced error handling system
- **Performance**: Optimized for large datasets with virtual scrolling

### Performance Optimization Systems
- **Virtual Grids**: Handle large lists efficiently with `VirtualGrid.vue` and `EnhancedVirtualGrid.vue`
- **Progressive Loading**: Incremental content loading for better perceived performance
- **Code Splitting**: Dynamic imports and lazy loading of components
- **Memory Management**: Automatic cleanup and optimization
- **Network Optimization**: Bandwidth-aware delivery and offline support

### Error Handling & Reliability
- **Enhanced Error Handling**: Context-aware error classification and user-friendly messages
- **Retry Mechanisms**: Automatic retry for transient failures
- **Offline Support**: Graceful degradation when network is unavailable
- **Error Logging**: Comprehensive error tracking for debugging
- **Fallback Strategies**: Multiple fallback options for critical functionality

### Real-time Features
- **Live Updates**: Real-time synchronization using Supabase subscriptions
- **Incremental Updates**: Efficient data synchronization
- **Network State Management**: Automatic handling of connection changes
- **Background Processing**: Non-blocking background operations

## Development Guidelines

### File Organization Principles
1. **Feature-Based Structure**: Group related files by feature/domain
2. **Separation of Concerns**: Clear boundaries between UI, logic, and data
3. **Reusability**: Maximize component and utility reuse
4. **Performance**: Optimize for bundle size and runtime performance
5. **Maintainability**: Clear naming and documentation

### Naming Conventions
- **Components**: PascalCase (e.g., `EventCard.vue`, `TeamDetailPage.vue`)
- **Composables**: camelCase with `use` prefix (e.g., `useEvents.ts`)
- **Utilities**: camelCase (e.g., `eventFormat.ts`, `cacheManager.ts`)
- **Types**: PascalCase interfaces (e.g., `Event`, `Team`, `Submission`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_FILE_SIZE`)

### Import Patterns
```typescript
// Vue and core libraries
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

// Store and composables
import { useAppStore } from '@/store/appStore'
import { useEvents } from '@/composables/useEvents'

// Components
import EventCard from '@/components/events/EventCard.vue'
import GlobalBanner from '@/components/feedback/GlobalBanner.vue'

// Utilities and types
import { formatDate } from '@/utils/eventFormat'
import type { Event } from '@/store/models'
```

### Performance Considerations
- **Bundle Size**: Use dynamic imports for large components
- **Memory Usage**: Implement proper cleanup in composables
- **Network Requests**: Leverage Vue Query caching and batching
- **Rendering**: Use virtual scrolling for large lists
- **Images**: Implement lazy loading and progressive enhancement

## Testing Strategy

### Component Testing
- **Unit Tests**: Individual component functionality
- **Integration Tests**: Component interaction with store/composables
- **Visual Tests**: Component rendering and styling
- **Accessibility Tests**: Screen reader and keyboard navigation

### Data Layer Testing
- **Composable Tests**: Data fetching and state management
- **Store Tests**: Business logic and state mutations
- **API Tests**: Supabase integration and error handling
- **Cache Tests**: Vue Query caching behavior

### Performance Testing
- **Load Testing**: Large dataset handling
- **Memory Testing**: Memory leak detection
- **Network Testing**: Offline and slow connection scenarios
- **Bundle Analysis**: Code splitting and optimization verification

## Deployment & Build

### Build Configuration
- **Vite Configuration**: Optimized for production builds
- **TypeScript**: Strict type checking enabled
- **Code Splitting**: Automatic chunk optimization
- **Asset Optimization**: Image and font optimization
- **Service Worker**: Offline functionality and caching

### Environment Management
- **Development**: Local Supabase with hot reload
- **Staging**: Production-like environment for testing
- **Production**: Optimized build with monitoring
- **Environment Variables**: Secure configuration management

### Monitoring & Analytics
- **Performance Monitoring**: Built-in performance tracking
- **Error Tracking**: Comprehensive error logging
- **User Analytics**: Usage patterns and optimization insights
- **Cache Analytics**: Cache hit rates and optimization opportunities