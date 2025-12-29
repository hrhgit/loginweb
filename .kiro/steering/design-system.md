---
inclusion: always
---

# Design System Rules for Event Management Platform

This document defines the design system rules and guidelines for converting Figma designs to Vue 3 components in this event management platform.

## Project Context

- **Framework**: Vue 3 with Composition API and `<script setup>` syntax
- **Styling**: Custom CSS design system (no Tailwind/Bootstrap)
- **Language**: TypeScript for type safety
- **Architecture**: Component-based with centralized state management

## Design Token System

### Color Palette
Use CSS custom properties defined in `src/style.css`:

```css
/* Primary Colors */
--bg: #f7f3ec           /* Main background */
--surface: rgba(255, 255, 255, 0.86)     /* Card backgrounds */
--surface-strong: rgba(255, 255, 255, 0.94)  /* Modal backgrounds */
--surface-muted: rgba(255, 255, 255, 0.72)   /* Muted surfaces */

/* Text Colors */
--ink: #1f2421          /* Primary text */
--muted: #4f5b58        /* Secondary text */

/* Accent Colors */
--accent: #1f6f6d       /* Primary brand color */
--accent-2: #e07a5f     /* Secondary accent */
--accent-soft: rgba(31, 111, 109, 0.12)  /* Soft accent background */

/* Status Colors */
--danger: #b62d1c       /* Error/danger states */
--border: rgba(18, 33, 30, 0.12)  /* Standard borders */
```

### Typography Scale
- **Headings**: Use `Sora` font family with weights 500, 600, 700
- **Body Text**: Use `Work Sans` font family with weights 400, 500, 600
- **Font Sizes**: Use `clamp()` for responsive typography

### Spacing & Layout
- **Container Width**: `min(1120px, 92vw)` for main content areas
- **Border Radius**: 12px-30px range (smaller for inputs, larger for cards)
- **Shadows**: Use `--shadow` and `--shadow-sm` variables

## Component Patterns

### Button System
Replace Tailwind button classes with our button system:

```css
/* Base button */
.btn

/* Variants */
.btn--primary      /* Primary actions */
.btn--ghost        /* Secondary actions */
.btn--danger       /* Destructive actions */
.btn--flat         /* Minimal buttons */
.btn--icon         /* Icon-only buttons */

/* Sizes */
.btn--compact      /* Smaller buttons */
.btn--lg           /* Larger buttons */
.btn--xl           /* Extra large buttons */
.btn--full         /* Full width */
```

### Card Components
Use our card system instead of generic divs:

```css
.activity-card     /* Event/activity cards */
.detail-card       /* Information cards */
.team-card         /* Team display cards */
.flow-card         /* Process flow cards */
```

### Form Elements
Replace form inputs with our field system:

```css
.field             /* Field container */
.field--inline     /* Inline field layout */
.field--error      /* Error state */

/* Input styling is handled automatically within .field */
```

### Layout Components
Use our layout classes:

```css
.app-shell         /* Main app container */
.detail-grid       /* Two-column detail layout */
.activity-grid     /* Event grid layout */
.team-grid         /* Team grid layout */
```

## Component Conversion Guidelines

### 1. Structure Conversion
- Convert Figma components to Vue 3 `<script setup>` syntax
- Use TypeScript interfaces for props
- Implement proper event emission patterns

### 2. Styling Conversion
- **Replace Tailwind classes** with our CSS classes
- **Use CSS custom properties** instead of hardcoded colors
- **Maintain responsive behavior** using our grid systems
- **Preserve visual hierarchy** with our typography scale

### 3. Interactive Elements
- Use our button variants instead of custom button styling
- Implement hover states using our transition patterns
- Use our modal system for overlays
- Apply our form validation styling for error states

### 4. Icon Integration
- Use `lucide-vue-next` icons (already installed)
- Size icons consistently: 14px, 16px, 18px, 20px
- Apply proper color inheritance

### 5. State Management Integration
- Connect to `useAppStore()` for global state
- Use proper TypeScript types from `src/store/models.ts`
- Follow existing patterns for data fetching and updates

## Role-Based Styling

The platform includes role-based color coding:

```css
.role-tag--programmer  /* Blue theme */
.role-tag--planner     /* Orange theme */
.role-tag--artist      /* Green theme */
.role-tag--audio       /* Teal theme */
```

## Status Indicators

Use our status badge system:

```css
.pill-badge--draft     /* Draft status */
.pill-badge--published /* Published status */
.pill-badge--ended     /* Ended status */
.pill-badge--success   /* Success status */
```

## Responsive Design

- **Mobile-first approach** with breakpoints at 640px, 720px, 760px, 980px
- **Grid layouts collapse** to single column on mobile
- **Navigation adapts** to stacked layout on smaller screens
- **Typography scales** using `clamp()` functions

## Animation & Transitions

- Use consistent transition timing: `0.18s ease`
- Apply hover transforms: `translateY(-1px)` for lift effect
- Use our shimmer animation for loading states
- Respect `prefers-reduced-motion` for accessibility

## Accessibility Guidelines

- Maintain proper color contrast ratios
- Use semantic HTML elements
- Provide proper ARIA labels and roles
- Ensure keyboard navigation works
- Include focus indicators using our accent colors

## Code Connect Integration

When mapping Figma components to code:

1. **Component Location**: Place in appropriate subdirectory under `src/components/`
2. **Naming Convention**: Use PascalCase for component files (e.g., `EventCard.vue`)
3. **Props Interface**: Define TypeScript interfaces for all props
4. **Styling**: Use scoped styles only when necessary, prefer global classes
5. **Documentation**: Include JSDoc comments for complex components

## Example Conversion

**Figma Output (React/Tailwind):**
```jsx
<div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
  <h3 className="text-lg font-semibold text-gray-900">Event Title</h3>
  <p className="text-sm text-gray-600 mt-2">Event description</p>
  <button className="bg-blue-500 text-white px-4 py-2 rounded mt-4">
    Join Event
  </button>
</div>
```

**Vue Component (Our System):**
```vue
<template>
  <article class="activity-card">
    <h3 class="activity-card__title">{{ event.title }}</h3>
    <p class="activity-card__desc">{{ event.description }}</p>
    <button class="btn btn--primary" @click="joinEvent">
      加入活动
    </button>
  </article>
</template>

<script setup lang="ts">
interface Props {
  event: {
    title: string
    description: string
  }
}

defineProps<Props>()

const emit = defineEmits<{
  join: [eventId: string]
}>()

const joinEvent = () => {
  emit('join', props.event.id)
}
</script>
```

This approach ensures visual consistency while maintaining our established patterns and Chinese localization.