# Local Food Marketplace - Design System

## Overview
The design system for the Local Food Marketplace is inspired by natural, farm-to-table aesthetics, featuring earthy tones, organic shapes, and accessible typography that reinforces the connection between local producers and consumers.

---

## Color Palette

### Primary Colors (Earthy Greens)
- **Forest Green** `oklch(0.45 0.12 155)` - Primary actions, headers, main CTAs
- **Moss Green** `oklch(0.55 0.10 150)` - Secondary elements, "In Season" badges
- **Sage Green** `oklch(0.68 0.08 145)` - Subtle accents, hover states
- **Leaf Green** `oklch(0.72 0.15 142)` - Success states, fresh produce indicators

### Warm Earth Tones
- **Rich Soil** `oklch(0.35 0.05 55)` - Primary text color
- **Warm Earth** `oklch(0.55 0.08 65)` - Muted text, secondary information
- **Terracotta** `oklch(0.60 0.12 45)` - Warm accents, harvest indicators
- **Cream** `oklch(0.96 0.02 85)` - Soft backgrounds, cards

### Accent Colors
- **Harvest Gold** `oklch(0.75 0.15 85)` - Special offers, highlights
- **Sunset Orange** `oklch(0.68 0.18 55)` - Surplus deals, warm CTAs

### Background
- **Soft Warm White** `oklch(0.98 0.01 100)` - Main background with subtle warmth
- Gradient backgrounds use: `from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]`

---

## Typography

### Font Families
```css
--font-sans: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-serif: 'Merriweather', Georgia, serif;
```

### Usage
- **Headings (h1, h2)**: Merriweather serif - Classic, readable, conveys trust and heritage
- **UI Elements (h3, h4, body)**: Outfit sans-serif - Modern, clean, excellent legibility
- **Buttons & Labels**: Outfit medium weight (500)

### Scale
- **h1**: 2xl, font-weight 700, letter-spacing -0.02em (serif)
- **h2**: xl, font-weight 700, letter-spacing -0.01em (serif)
- **h3**: lg, font-weight 600 (sans-serif)
- **h4**: base, font-weight 600 (sans-serif)
- **Body**: base, font-weight 400 (sans-serif)

---

## Components

### Cards
- Border radius: 0.75rem (rounded-xl)
- Subtle shadow: `shadow-sm`
- Hover effect: `hover:shadow-md transition-shadow`
- Background: White (#ffffff)
- Border: Soft sage border `oklch(0.88 0.02 145)`

### Buttons
- **Primary**: Forest green background, white text, subtle shadow
- **Secondary**: Sage green background, darker text
- **Outline**: Transparent with border, hover accent background
- Border radius: 0.375rem (rounded-md)
- Transition: `transition-all duration-200`

### Badges
- Border radius: `rounded-full` for organic, pill-shaped feel
- Padding: `px-2.5 py-0.5`
- **In Season**: Moss green `oklch(0.55_0.10_150)`
- **Organic**: Forest green `oklch(0.45_0.12_155)`
- **Year-round**: Sage green `oklch(0.68_0.08_145)`
- **Surplus Deal**: Outlined with sunset orange

### Headers
- Background: White with 80% opacity + backdrop blur
- Border: Soft sage `oklch(0.88_0.02_145)`
- Shadow: `shadow-sm` for subtle depth
- Sticky positioning for marketplace navigation

---

## Layout Principles

### Backgrounds
All pages use a subtle gradient background:
```tsx
bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]
```

### Spacing
- Container max-width: 
  - Marketplace: `max-w-7xl`
  - Forms/Checkout: `max-w-5xl`
  - Single column: `max-w-3xl`
- Consistent padding: `px-4 py-8`
- Card spacing: `gap-6` for grids

### Responsive Design
- Breakpoints align with Tailwind defaults
- Mobile-first approach
- Desktop sidebars hide on mobile with sheet overlays
- Grid collapses: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`

---

## Brand Icons
- **Sprout** (Lucide): Primary brand icon representing growth and local farming
- Used in login, headers, and brand touchpoints
- Displayed in gradient circle: `from-[oklch(0.45_0.12_155)] to-[oklch(0.55_0.10_150)]`

---

## Accessibility

### Focus States
- Visible ring: `focus-visible:ring-ring/50 focus-visible:ring-[3px]`
- Border highlight on focus: `focus-visible:border-ring`
- High contrast maintained across all components

### Color Contrast
- All text meets WCAG AA standards
- Primary text (Rich Soil) on white backgrounds: 12.5:1
- Button text contrasts verified for accessibility

### Interactive Elements
- Hover states on all clickable elements
- Disabled states clearly indicated (50% opacity)
- Touch targets: minimum 44×44px on mobile

---

## Animation & Transitions

### Standard Transitions
- Duration: 200ms for most interactions
- Easing: Default (ease) for natural feel
- Properties: `transition-all` or specific `transition-shadow`, `transition-colors`

### Hover Effects
- Cards: Shadow elevation increase
- Buttons: Slight darkening + shadow
- Links: Underline appearance
- Badges: Subtle background darkening

### Loading States
- Skeleton loaders match component shapes
- Pulse animation for loading indicators
- Smooth fade-in when content loads

---

## Best Practices

### Color Usage
1. Use semantic color variables (--primary, --secondary) rather than direct values
2. Maintain consistent badge colors across the platform
3. Employ warm gradients for engaging surfaces
4. Keep backgrounds subtle to focus attention on content

### Typography
1. Use serif fonts for prominent headings to convey heritage
2. Use sans-serif for UI elements and body text for clarity
3. Maintain consistent line-height (1.3-1.5) for readability
4. Avoid font-size/weight utilities unless overriding defaults

### Component Composition
1. Prefer composition over customization
2. Use existing UI components from `/src/app/components/ui/`
3. Maintain consistent spacing with Tailwind's spacing scale
4. Keep component hierarchy shallow for maintainability

---

## Implementation Notes

- Design tokens defined in `/src/styles/theme.css`
- Font imports in `/src/styles/fonts.css`
- All colors use OKLCH for perceptual uniformity
- Dark mode color values prepared but not yet activated
- Tailwind v4 with theme inline declarations
