# Igloo Server Frontend Theme Reference

## Overview
The Igloo Server frontend is a React TypeScript application featuring a dark, futuristic theme optimized for a remote signing and key management interface. The design emphasizes clarity, security, and professional aesthetics with a blue-centric color palette on a dark background.

## Core Design Philosophy

### Visual Identity
- **Dark-First Design**: Permanently dark mode with no light theme option
- **Blue-Centric Palette**: Primary interactions and highlights use blue tones
- **Glassmorphism Elements**: Semi-transparent backgrounds with backdrop blur effects
- **Monospace Typography**: Technical, terminal-like aesthetic using Share Tech Mono font
- **Gradient Backgrounds**: Subtle gradients from gray-950 to blue-950 for depth

### Design Principles
1. **Clarity**: High contrast text on dark backgrounds for readability
2. **Hierarchy**: Clear visual hierarchy through color intensity and opacity
3. **Consistency**: Uniform spacing, border radius, and component patterns
4. **Responsiveness**: Mobile-first approach with breakpoint-specific layouts
5. **Accessibility**: Sufficient color contrast and focus indicators

## Color System

### Primary Palette

#### Background Colors
- **Base Background**: `bg-gray-900` (#111827) - Main application background
- **Page Background**: Gradient from `gray-950` to `blue-950`
- **Card Backgrounds**: `bg-gray-800/50` - Semi-transparent overlays
- **Modal Backgrounds**: `bg-gray-900` with `bg-black/80` backdrop

#### Blue Scale (Primary Actions)
```css
blue-100: #dbeafe  /* Light blue for hover states */
blue-200: #bfdbfe  /* Active tab text */
blue-300: #93c5fd  /* Primary text, headings */
blue-400: #60a5fa  /* Links, secondary actions */
blue-600: #2563eb  /* Primary buttons */
blue-700: #1d4ed8  /* Button hover states */
blue-900: #1e3a8a  /* Borders, dividers */
```

#### Status Colors
- **Success**: Green tones (`green-500`, `green-900/30`)
- **Error**: Red tones (`red-500`, `red-900/30`)
- **Warning**: Yellow tones (`yellow-500`, `yellow-900/30`)
- **Info**: Blue tones (`blue-500`, `blue-900/30`)
- **Idle**: Gray tones (`gray-500`)

#### Special Purpose
- **Purple**: `purple-900` (#581c87) - Recovery/special features
- **Cyan**: Used in gradient effects with blue

### CSS Variables (HSL Format)
```css
--background: 222 84% 4.9%;
--foreground: 210 40% 98%;
--primary: 210 40% 98%;
--primary-foreground: 222.2 84% 4.9%;
--muted: 217.2 32.6% 17.5%;
--muted-foreground: 215 20.2% 65.1%;
--border: 217.2 32.6% 17.5%;
--destructive: 0 62.8% 30.6%;
--ring: 217.2 32.6% 17.5%;
--radius: 0.5rem;
```

## Typography

### Font Stack
```css
font-mono: 'Share Tech Mono', monospace
font-sans: System UI fallback stack
```

### Text Hierarchy
- **H1**: `text-4xl font-bold` - Main application title
- **H2**: `text-xl font-semibold text-blue-300` - Section headers
- **H3**: `text-2xl font-semibold` - Card titles
- **Body**: `text-sm` - Default content
- **Small**: `text-xs` - Labels, metadata

### Text Colors
- **Primary Text**: `text-blue-300` - Headers, important content
- **Secondary Text**: `text-blue-400` - Links, interactive elements
- **Body Text**: `text-blue-100` - General content
- **Muted Text**: `text-gray-400` - Secondary information

## Component Patterns

### Layout Components

#### PageLayout
- **Purpose**: Main container for all pages
- **Styling**: 
  - Full-height gradient background
  - Responsive padding: `p-4 sm:p-8`
  - Centered content with configurable max-width
  - Default constraint: `max-w-3xl`

#### ContentCard
- **Purpose**: Primary content container
- **Styling**:
  - Semi-transparent background: `bg-gray-900/40`
  - Rounded corners: `rounded-lg`
  - Responsive padding: `p-4 sm:p-6`
  - Drop shadow: `shadow-lg`

#### AppHeader
- **Purpose**: Application header with branding
- **Features**:
  - Responsive layout (mobile vs desktop)
  - Gradient text effect for title
  - Logo integration
  - User authentication display

### Interactive Components

#### Buttons
**Variants**:
- **Default**: Solid background with hover state
- **Ghost**: Transparent with hover background
- **Destructive**: Red-toned for dangerous actions
- **Link**: Text-only with underline

**Styling Pattern**:
```css
/* Primary Button */
bg-blue-600 hover:bg-blue-700 text-blue-100

/* Ghost Button */
text-blue-400 hover:text-blue-300 hover:bg-blue-900/30
```

#### Inputs
- **Border**: `border-blue-900/30`
- **Background**: Transparent or `bg-gray-800/50`
- **Text**: `text-blue-300`
- **Focus**: Ring with `ring-blue-500`
- **Placeholder**: `text-muted-foreground`

#### Badges
**Variants with ring inset pattern**:
```css
default: bg-gray-500/20 text-gray-400 ring-gray-500/30
error: bg-red-500/20 text-red-400 ring-red-500/30
success: bg-green-500/20 text-green-400 ring-green-500/30
warning: bg-yellow-500/20 text-yellow-400 ring-yellow-500/30
info: bg-blue-500/20 text-blue-400 ring-blue-500/30
```

#### Tabs
- **TabsList**: `bg-gray-800/50`
- **TabsTrigger**: 
  - Default: `text-blue-400`
  - Active: `bg-blue-900/60 text-blue-200`

### Feedback Components

#### Alerts
- **Structure**: Icon + Title + Message
- **Color coding by variant**
- **Semi-transparent backgrounds with matching borders**

#### StatusIndicator
- **Colored dot**: 8px diameter
- **Label**: Optional text in `text-gray-400`
- **Container**: `bg-gray-900/70 rounded`

#### Modals
- **Backdrop**: `bg-black/80 backdrop-blur-sm`
- **Container**: `bg-gray-900 rounded-lg shadow-xl`
- **Header**: Border-bottom with `border-gray-800`

## Spacing System

### Base Units
- **xs**: 0.5rem (8px)
- **sm**: 0.75rem (12px)
- **md**: 1rem (16px)
- **lg**: 1.5rem (24px)
- **xl**: 2rem (32px)

### Common Patterns
- **Card Padding**: `p-4` (mobile) to `p-6` (desktop)
- **Section Spacing**: `mb-6` to `mb-8`
- **Inline Gaps**: `gap-2` (8px) standard
- **Button Padding**: `px-4 py-2` default

## Border & Effects

### Border Styles
- **Color**: `border-blue-900/30` (30% opacity)
- **Width**: Default 1px
- **Radius**: 
  - Small: `rounded` (0.25rem)
  - Medium: `rounded-md` (0.375rem)
  - Large: `rounded-lg` (0.5rem)

### Shadow Effects
- **Cards**: `shadow-lg`
- **Modals**: `shadow-xl`
- **Buttons**: Transition effects on hover

### Transitions
- **Default**: `transition-colors` (150ms)
- **Hover States**: Color and background changes
- **Focus States**: Ring indicators

## Responsive Design

### Breakpoints
```css
sm: 640px   /* Tablet */
md: 768px   /* Small desktop */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large */
```

### Mobile-First Patterns
- **Hidden on Mobile**: `hidden sm:flex`
- **Full Width Mobile**: `max-w-none sm:max-w-3xl`
- **Responsive Padding**: `p-4 sm:p-6`
- **Stacked to Grid**: `flex flex-col sm:grid`

## Animation Patterns

### Accordion (Collapsible)
```css
accordion-down: height 0 to content-height (200ms ease-out)
accordion-up: height content-height to 0 (200ms ease-out)
```

### State Transitions
- **Hover**: Immediate color change
- **Active**: Scale or background change
- **Focus**: Ring appearance with offset

## Special Components

### Event Log
- **Monospace font** for technical data
- **Color-coded** by event type
- **Scrollable** container with max-height
- **Auto-scroll** to bottom on new events

### Peer List
- **Status indicators** (connected/disconnected)
- **Compact layout** with consistent spacing
- **Hover effects** for interactive elements

### Configuration Forms
- **Sectioned layout** with clear boundaries
- **Validation states** with color feedback
- **Help text** in muted colors
- **Progressive disclosure** for advanced options

## Implementation Guidelines

### Creating New Components

1. **Start with Base Classes**:
   ```tsx
   className="bg-gray-800/50 border border-blue-900/30 rounded-lg p-4"
   ```

2. **Add Interactive States**:
   ```tsx
   className="hover:bg-blue-900/30 focus:ring-2 focus:ring-blue-500"
   ```

3. **Include Responsive Modifiers**:
   ```tsx
   className="p-4 sm:p-6 max-w-none sm:max-w-3xl"
   ```

4. **Use Utility Classes**:
   ```tsx
   import { cn } from "../../lib/utils"
   className={cn("base-classes", conditionalClass && "additional-class")}
   ```

### Theme Consistency Checklist
- [ ] Uses monospace font for technical content
- [ ] Dark backgrounds with blue accent colors
- [ ] Semi-transparent overlays where appropriate
- [ ] Consistent border colors and radius
- [ ] Proper text hierarchy and contrast
- [ ] Responsive padding and layout
- [ ] Hover and focus states defined
- [ ] Status colors follow convention
- [ ] Animations are smooth and purposeful

### Custom Utility Classes

```css
/* Igloo-specific utility classes (defined in frontend/styles.css) */
@layer components {
  .igloo-card {
    @apply bg-gray-800/50 border border-blue-900/30 rounded-lg;
  }
  .igloo-button {
    @apply bg-blue-600 hover:bg-blue-700 text-blue-100;
  }
  .igloo-button-ghost {
    @apply text-blue-400 hover:text-blue-300 hover:bg-blue-900/30;
  }
  .igloo-text-primary {
    @apply text-blue-300;
  }
  .igloo-text-secondary {
    @apply text-blue-400;
  }
}
```

## Example Component Structure

```tsx
// New form component following theme guidelines
<PageLayout maxWidth="max-w-3xl">
  <AppHeader subtitle="Your subtitle here" />
  
  <ContentCard title="Section Title">
    <div className="space-y-4">
      {/* Form fields */}
      <div>
        <label className="text-sm text-blue-300 mb-1 block">
          Field Label
        </label>
        <Input 
          className="bg-gray-800/50 border-blue-900/30"
          placeholder="Enter value..."
        />
      </div>
      
      {/* Status feedback */}
      <Alert variant="info">
        Information message here
      </Alert>
      
      {/* Action buttons */}
      <div className="flex gap-2 justify-end">
        <Button variant="ghost">Cancel</Button>
        <Button className="bg-blue-600 hover:bg-blue-700">
          Submit
        </Button>
      </div>
    </div>
  </ContentCard>
</PageLayout>
```

## Accessibility Considerations

### Color Contrast
- Minimum WCAG AA compliance
- Text on dark backgrounds: min 4.5:1 ratio
- Interactive elements: clear focus indicators

### Keyboard Navigation
- All interactive elements keyboard accessible
- Visible focus rings
- Logical tab order
- Escape key closes modals

### Screen Reader Support
- Semantic HTML structure
- ARIA labels where needed
- Status messages announced
- Form validation feedback

## Performance Optimizations

### CSS Strategies
- Tailwind JIT compilation
- Purged unused styles in production
- Minimal custom CSS
- Efficient selector usage

### Component Patterns
- Lazy loading for heavy components
- Memoization for expensive renders
- Virtual scrolling for long lists
- Debounced input handlers

This theme reference should be used as the definitive guide when creating new frontend pages or components to ensure consistency across the Igloo Server interface.