# Technology Stack

## Frontend Framework
- **Vue 3** with Composition API and `<script setup>` syntax
- **TypeScript** for type safety and better development experience
- **Vite** as the build tool and development server
- **Vue Router 4** for client-side routing

## Backend & Database
- **Supabase** as Backend-as-a-Service (BaaS)
  - PostgreSQL database with Row Level Security (RLS)
  - Built-in authentication system
  - Real-time subscriptions
  - File storage capabilities

## Key Dependencies
- `@supabase/supabase-js` - Supabase client library
- `vue-router` - Routing management
- `lucide-vue-next` - Icon library
- `vue-advanced-cropper` - Image cropping functionality
- `tus-js-client` - File upload handling
- `xlsx` - Excel file processing

## Development Setup

### Environment Configuration
Create a `.env` file in the project root:
```env
VITE_SUPABASE_URL="YOUR_SUPABASE_URL"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
```

### Common Commands
```bash
# Install dependencies
npm install

# Start development server (usually runs on http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## TypeScript Configuration
- Target: ES2022 with strict mode enabled
- Module resolution: bundler mode for Vite compatibility
- Includes unused locals/parameters checking
- Uses Vite client types

## Build System
- **Vite** with Vue plugin for fast development and optimized builds
- Hot Module Replacement (HMR) for instant updates during development
- TypeScript compilation integrated into build process
- Production builds output to `dist/` directory