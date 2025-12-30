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

### Spacing Scale
Use consistent spacing values throughout the application:

```css
/* Spacing Variables */
--space-xs: 4px     /* Micro spacing */
--space-sm: 8px     /* Small spacing */
--space-md: 12px    /* Medium spacing */
--space-lg: 16px    /* Large spacing */
--space-xl: 20px    /* Extra large spacing */
--space-2xl: 24px   /* 2X large spacing */
--space-3xl: 32px   /* 3X large spacing */
--space-4xl: 40px   /* 4X large spacing */
--space-5xl: 48px   /* 5X large spacing */
--space-6xl: 64px   /* 6X large spacing */

/* Component Spacing */
--component-padding: var(--space-lg)
--section-gap: var(--space-3xl)
--card-padding: var(--space-2xl)
--form-gap: var(--space-md)
```

### Typography System
Comprehensive font size and line height specifications:

```css
/* Font Size Scale */
--text-xs: clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)    /* 12-14px */
--text-sm: clamp(0.875rem, 0.8rem + 0.375vw, 1rem)      /* 14-16px */
--text-base: clamp(1rem, 0.9rem + 0.5vw, 1.125rem)      /* 16-18px */
--text-lg: clamp(1.125rem, 1rem + 0.625vw, 1.25rem)     /* 18-20px */
--text-xl: clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem)      /* 20-24px */
--text-2xl: clamp(1.5rem, 1.3rem + 1vw, 1.875rem)       /* 24-30px */
--text-3xl: clamp(1.875rem, 1.6rem + 1.375vw, 2.25rem)  /* 30-36px */
--text-4xl: clamp(2.25rem, 1.9rem + 1.75vw, 3rem)       /* 36-48px */

/* Line Heights */
--leading-tight: 1.25
--leading-snug: 1.375
--leading-normal: 1.5
--leading-relaxed: 1.625
--leading-loose: 2

/* Font Weights */
--font-normal: 400
--font-medium: 500
--font-semibold: 600
--font-bold: 700
```

### Border Radius Scale
Consistent border radius values:

```css
/* Border Radius Scale */
--radius-xs: 4px
--radius-sm: 6px
--radius-md: 8px
--radius-lg: 12px
--radius-xl: 16px
--radius-2xl: 20px
--radius-3xl: 24px
--radius-full: 9999px

/* Component Specific */
--btn-radius: var(--radius-lg)
--card-radius: var(--radius-xl)
--input-radius: var(--radius-md)
--modal-radius: var(--radius-2xl)
```

### Shadow System
Layered shadow system for depth:

```css
/* Shadow Scale */
--shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.05)
--shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)
--shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25)

/* Component Shadows */
--card-shadow: var(--shadow-sm)
--modal-shadow: var(--shadow-xl)
--dropdown-shadow: var(--shadow-lg)
--button-shadow: var(--shadow-xs)
```

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

### Transition System
Use consistent timing and easing functions:

```css
/* Transition Durations */
--duration-fast: 0.15s
--duration-normal: 0.18s
--duration-slow: 0.3s
--duration-slower: 0.5s

/* Easing Functions */
--ease-out: cubic-bezier(0.4, 0, 0.2, 1)
--ease-in: cubic-bezier(0.4, 0, 1, 1)
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55)

/* Common Transitions */
--transition-colors: color var(--duration-normal) var(--ease-out), 
                     background-color var(--duration-normal) var(--ease-out),
                     border-color var(--duration-normal) var(--ease-out);
--transition-transform: transform var(--duration-normal) var(--ease-out);
--transition-opacity: opacity var(--duration-normal) var(--ease-out);
--transition-all: all var(--duration-normal) var(--ease-out);
```

### Hover Effects
Standard hover interactions:

```css
/* Button Hover */
.btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
  transition: var(--transition-transform), var(--transition-colors);
}

/* Card Hover */
.activity-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  transition: var(--transition-transform);
}

/* Link Hover */
.link:hover {
  color: var(--accent);
  transition: var(--transition-colors);
}
```

### Loading Animations
```css
/* Shimmer Effect */
@keyframes shimmer {
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
}

.loading-shimmer {
  background: linear-gradient(90deg, 
    var(--surface) 0%, 
    var(--surface-strong) 50%, 
    var(--surface) 100%);
  background-size: 200px 100%;
  animation: shimmer 1.5s infinite;
}

/* Pulse Effect */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.loading-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
```

### Accessibility Considerations
```css
/* Respect reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Accessibility Guidelines

### Focus Management
```css
/* Focus Indicators */
.focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* Skip Links */
.skip-link {
  position: absolute;
  top: -40px;
  left: 6px;
  background: var(--accent);
  color: white;
  padding: 8px;
  text-decoration: none;
  border-radius: var(--radius-md);
  z-index: 1000;
}

.skip-link:focus {
  top: 6px;
}
```

### Color Contrast
- Maintain WCAG AA compliance (4.5:1 ratio for normal text)
- Use semantic HTML elements for proper screen reader support
- Provide proper ARIA labels and roles
- Ensure keyboard navigation works for all interactive elements

### Screen Reader Support
```css
/* Visually Hidden but Available to Screen Readers */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

## Utility Classes

### Display Utilities
```css
.hidden { display: none; }
.block { display: block; }
.inline { display: inline; }
.inline-block { display: inline-block; }
.flex { display: flex; }
.inline-flex { display: inline-flex; }
.grid { display: grid; }
.inline-grid { display: inline-grid; }
```

### Flexbox Utilities
```css
.flex-row { flex-direction: row; }
.flex-col { flex-direction: column; }
.flex-wrap { flex-wrap: wrap; }
.flex-nowrap { flex-wrap: nowrap; }

.justify-start { justify-content: flex-start; }
.justify-center { justify-content: center; }
.justify-end { justify-content: flex-end; }
.justify-between { justify-content: space-between; }
.justify-around { justify-content: space-around; }

.items-start { align-items: flex-start; }
.items-center { align-items: center; }
.items-end { align-items: flex-end; }
.items-stretch { align-items: stretch; }

.flex-1 { flex: 1 1 0%; }
.flex-auto { flex: 1 1 auto; }
.flex-none { flex: none; }
```

### Spacing Utilities
```css
/* Margin */
.m-0 { margin: 0; }
.m-xs { margin: var(--space-xs); }
.m-sm { margin: var(--space-sm); }
.m-md { margin: var(--space-md); }
.m-lg { margin: var(--space-lg); }
.m-xl { margin: var(--space-xl); }

/* Padding */
.p-0 { padding: 0; }
.p-xs { padding: var(--space-xs); }
.p-sm { padding: var(--space-sm); }
.p-md { padding: var(--space-md); }
.p-lg { padding: var(--space-lg); }
.p-xl { padding: var(--space-xl); }

/* Gap */
.gap-xs { gap: var(--space-xs); }
.gap-sm { gap: var(--space-sm); }
.gap-md { gap: var(--space-md); }
.gap-lg { gap: var(--space-lg); }
.gap-xl { gap: var(--space-xl); }
```

### Text Utilities
```css
.text-left { text-align: left; }
.text-center { text-align: center; }
.text-right { text-align: right; }

.text-xs { font-size: var(--text-xs); }
.text-sm { font-size: var(--text-sm); }
.text-base { font-size: var(--text-base); }
.text-lg { font-size: var(--text-lg); }
.text-xl { font-size: var(--text-xl); }

.font-normal { font-weight: var(--font-normal); }
.font-medium { font-weight: var(--font-medium); }
.font-semibold { font-weight: var(--font-semibold); }
.font-bold { font-weight: var(--font-bold); }

.leading-tight { line-height: var(--leading-tight); }
.leading-normal { line-height: var(--leading-normal); }
.leading-relaxed { line-height: var(--leading-relaxed); }
```

## Form Styling Standards

### Input Field System
```css
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  margin-bottom: var(--form-gap);
}

.field__label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--ink);
}

.field__input {
  padding: var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--input-radius);
  font-size: var(--text-base);
  background: var(--surface);
  transition: var(--transition-colors);
}

.field__input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.field--error .field__input {
  border-color: var(--danger);
}

.field__error {
  font-size: var(--text-sm);
  color: var(--danger);
}

.field__help {
  font-size: var(--text-sm);
  color: var(--muted);
}
```

### Checkbox and Radio Styling
```css
.checkbox, .radio {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  cursor: pointer;
}

.checkbox__input, .radio__input {
  width: 16px;
  height: 16px;
  accent-color: var(--accent);
}

.checkbox__label, .radio__label {
  font-size: var(--text-sm);
  cursor: pointer;
}
```

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