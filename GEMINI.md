# LoginWeb Project Context

## Project Overview
**LoginWeb** is a comprehensive event management platform tailored for **Game Jams** and creative sprints. It allows administrators to create, manage, and publish events, while users can register, form teams, and submit projects.

**Key Technologies:**
*   **Frontend:** Vue 3 (Composition API, `<script setup>`), Vite, TypeScript, Vue Router.
*   **Backend/BaaS:** Supabase (PostgreSQL Database, Authentication, Storage).
*   **Styling:** Custom CSS System (Variables + BEM naming), `lucide-vue-next` for icons.
*   **State Management:** Custom centralized Store pattern (`src/store/appStore.ts`).

## Core Architecture

### 1. Frontend Structure
The application follows a modular structure:
*   **Pages (`src/pages/`)**: Route-level components (e.g., `EventsPage`, `EventDetailPage`, `EventEditPage`, `ProfilePage`).
*   **Components (`src/components/`)**: Reusable UI elements categorized by function:
    *   `layout/`: Global headers (`AppHeader`) and footers.
    *   `events/`: Event-specific UI like `EventCard`.
    *   `modals/`: Global overlays for Auth (`AuthModal`) and Creation (`CreateEventModal`).
    *   `feedback/`: Notifications (`GlobalBanner`).
*   **Store (`src/store/`)**: A "Pinia-like" single-source-of-truth using `reactive` state.
    *   `appStore.ts`: Contains ALL business logic, auth state, and API calls.
    *   `models.ts`: TypeScript interfaces for `Event`, `Profile`, `DisplayEvent`.
    *   `eventSchema.ts`: DB field definitions.

### 2. Data Flow & Logic
*   **Centralized Logic:** `appStore.ts` handles API interactions (Supabase), permission checks (Admin vs User), and global UI state (Loading/Banners). Components call store actions.
*   **Event Description Protocol:** The `description` field in the database is a rich JSON object serialized via `src/utils/eventDetails.ts`. It stores the event intro, registration steps, form configuration (questions/options), and team lobby data.
*   **Authentication:** Managed via Supabase Auth. User profiles are synced to a `profiles` public table.

## Key Features
1.  **Event Lifecycle:**
    *   **Draft:** Only visible to creators/admins. Editable.
    *   **Published:** Visible to all. Open for registration.
    *   **Ended:** Archived state.
2.  **Registration System:**
    *   Dynamic Registration Forms: Admins configure custom questions (text/select/multi) in the Event Edit page.
    *   Responses are stored as JSONB in the `registrations` table.
3.  **User Profile:**
    *   Public profile (`profiles` table): Username, Avatar, Roles (Programmer, Artist, etc.).
    *   Private contacts (`user_contacts` table): Phone, QQ (only visible to self).

## Development Conventions

### Build & Run
*   **Development:** `npm run dev` (Starts Vite server at `http://localhost:5173`)
*   **Production Build:** `npm run build` (Outputs to `dist/`)
*   **Preview:** `npm run preview`

### Styling
*   **No Frameworks:** Avoid Tailwind or Bootstrap. Use the project's **Custom CSS System**.
*   **Variables:** Defined in `src/style.css` (e.g., `--bg`, `--surface`, `--accent`, `--ink`, `--muted`).
*   **Icons:** Use `lucide-vue-next`.
    *   *Import pattern:* `import { IconName } from 'lucide-vue-next'`
    *   *Usage:* `<IconName :size="16" />`
*   **Classes:**
    *   Layout: `.app-shell`, `.activity-grid`, `.detail-grid`.
    *   Buttons: `.btn`, `.btn--primary`, `.btn--ghost`, `.btn--icon-text`.
    *   Forms: `.field`, `.input`, `.label`.

### Database Schema (Supabase)
*   `events`: Main event data. `description` is JSON. `status` is enum (`draft`, `published`, `ended`).
*   `profiles`: Public user info.
*   `registrations`: Links users to events. Contains `form_response` JSONB.
*   `teams`: (Planned/Partial) Team management within events.

## Important Constraints
1.  **Icon Usage:** Always prefer `lucide-vue-next` for UI icons. Ensure consistent sizing (`:size="16"` for text-aligned, `18-20` for standalone/buttons).
2.  **Store Mutations:** Modify state via `appStore.ts` actions, not directly in components if possible.
3.  **Type Safety:** Strict TypeScript adherence. Use types from `src/store/models.ts`.
