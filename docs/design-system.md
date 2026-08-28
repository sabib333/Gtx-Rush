# GTX Rush Design System v1.0

## Design Philosophy

> **High-energy competitive arcade + modern mobile app**

GTX Rush should feel fast, competitive, and premium — like a real gaming product, not a generic dashboard.

## Color System

### Surfaces (Layered Dark Theme)
| Token | Hex | Usage |
|-------|-----|-------|
| `surface.base` | `#0c1222` | Deepest background |
| `surface.raised` | `#131c2e` | Cards, panels |
| `surface.overlay` | `#1a2540` | Modals, dropdowns |
| `surface.border` | `#243049` | Subtle borders |
| `surface.hover` | `#1e2d48` | Hover states |

### Brand Accent — Electric Blue
| Token | Hex | Usage |
|-------|-----|-------|
| `accent.400` | `#5988ff` | Light accent |
| `accent.500` | `#3366ff` | Primary accent |
| `accent.600` | `#1a44f5` | Dark accent |

### Energy Accent — Electric Purple
| Token | Hex | Usage |
|-------|-----|-------|
| `energy.400` | `#b07aff` | XP, rewards |
| `energy.500` | `#9050ff` | Energy accent |

### Status Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `success.400` | `#4ade80` | Positive actions |
| `warning.400` | `#facc15` | Warnings, gold |
| `danger.400` | `#f87171` | Errors, deletion |

### Game Colors
| Game | Color | Hex |
|------|-------|-----|
| Reaction Rush | Red | `#ef4444` |
| Tap Rush | Green | `#22c55e` |
| Quiz Rush | Purple | `#a855f7` |

## Typography

### Font Stack
- **Display:** SF Pro Display, Inter, system-ui
- **Body:** SF Pro Text, Inter, system-ui
- **Score:** SF Pro Display, Inter, DIN Alternate, system-ui
- **Mono:** SF Mono, Fira Code, monospace

### Type Scale
| Token | Size | Weight | Use |
|-------|------|--------|-----|
| `display-xl` | 3rem | 900 | Hero moments |
| `display-lg` | 2.25rem | 800 | Game titles |
| `display` | 1.875rem | 800 | Page titles |
| `h1` | 1.5rem | 700 | Section headers |
| `h2` | 1.25rem | 700 | Card headers |
| `h3` | 1.125rem | 600 | Sub-headers |
| `body-lg` | 1rem | 400 | Main text |
| `body` | 0.9375rem | 400 | Default body |
| `body-sm` | 0.8125rem | 400 | Small text |
| `caption` | 0.75rem | 500 | Labels, captions |
| `caption-xs` | 0.6875rem | 500 | Tiny labels |
| `score-xl` | 3.5rem | 900 | Big scores |
| `score-lg` | 2.5rem | 900 | Result scores |
| `score` | 1.75rem | 800 | Inline scores |
| `score-sm` | 1.25rem | 700 | Small scores |

## Spacing

Consistent 4px base grid:
- `xs`: 4px
- `sm`: 8px
- `md`: 12px
- `lg`: 16px
- `xl`: 24px
- `2xl`: 32px
- `3xl`: 48px

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | 6px | Small elements |
| `md` | 10px | Buttons, inputs |
| `lg` | 14px | Cards |
| `xl` | 16px | Large cards |
| `2xl` | 20px | Modals |
| `3xl` | 24px | Bottom sheets |
| `pill` | 9999px | Tags, badges |

## Motion

| Token | Duration | Usage |
|-------|----------|-------|
| `fast` | 100ms | Button press, toggle |
| `normal` | 200ms | Hover, focus |
| `slow` | 350ms | Page transitions |
| `slower` | 500ms | Complex animations |

### Easing
- **ease-out-expo:** `cubic-bezier(0.19, 1, 0.22, 1)` — Smooth exits
- **ease-spring:** `cubic-bezier(0.34, 1.56, 0.64, 1)` — Bouncy enters

## Component Patterns

### Cards
- Rounded corners (2xl)
- Surface raised background
- Subtle border
- Interactive cards scale on press (0.98)
- Glow effect on focus/active

### Buttons
- Primary: Gradient brand with glow shadow
- Secondary: Surface background with border
- Ghost: Transparent with hover state
- Always active:scale-[0.97] on press

### Scores
- Use `font-score` for tabular numbers
- `text-shadow` glow effect for emphasis
- Animate on appear with `scoreCount` animation

### Navigation
- Bottom nav with 5 items max
- Active state: accent color + subtle background
- Glass morphism backdrop blur

## Accessibility

- All interactive elements have focus-visible states
- Minimum touch target: 44px
- Color is never the only indicator
- Supports `prefers-reduced-motion`
- Adequate contrast ratios (WCAG AA)

## Responsive

- Mobile-first: 320px+
- Max width container: 512px (max-w-lg)
- Safe area insets respected
- No horizontal overflow
