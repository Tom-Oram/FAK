# Visual Refresh Design

**Goal:** Transform the UI from a standard blue Tailwind aesthetic to a rich violet-purple palette with polished animations, purple-tinted surfaces, glow effects, and route transitions — inspired by Stripe/Raycast.

**Constraints:**
- No new dependencies (pure CSS/Tailwind animations)
- Keep all component structure, layout geometry, and functionality unchanged
- Maintain full dark/light mode support
- Keep Inter + JetBrains Mono fonts, Lucide icons

---

## 1. Color System

### Primary Palette (Blue → Violet-Purple)

| Shade | Old (Blue) | New (Purple) | Usage |
|-------|-----------|--------------|-------|
| 50 | `#eff6ff` | `#faf5ff` | Light backgrounds, hover tints |
| 100 | `#dbeafe` | `#f3e8ff` | Badge backgrounds, subtle fills |
| 200 | `#bfdbfe` | `#e9d5ff` | Light borders, secondary fills |
| 300 | `#93c5fd` | `#d8b4fe` | Inactive states |
| 400 | `#60a5fa` | `#c084fc` | Secondary text accents |
| 500 | `#3b82f6` | `#a855f7` | Signature accent |
| 600 | `#2563eb` | `#9333ea` | Primary buttons, active states |
| 700 | `#1d4ed8` | `#7e22ce` | Hover/pressed buttons |
| 800 | `#1e40af` | `#6b21a8` | Dark accent areas |
| 900 | `#1e3a8a` | `#581c87` | Deep surfaces |
| 950 | `#172554` | `#3b0764` | Darkest surfaces |

### Semantic Colors (Unchanged)

Danger (red), Warning (amber), and Success (green) palettes stay as-is.

### Tool Accent Colors (Re-Harmonized)

Each tool keeps a distinct identity, but colors shift to harmonize with purple:

| Tool | Old Gradient | New Gradient |
|------|-------------|--------------|
| PCAP Analyzer | blue-500 → blue-600 | violet-500 → indigo-600 |
| DNS Lookup | green-500 → green-600 | emerald-500 → teal-600 |
| SSL Checker | purple-500 → purple-600 | fuchsia-500 → purple-600 |
| Path Tracer | orange-500 → orange-600 | amber-500 → rose-600 |
| iPerf Server | cyan-500 → cyan-600 | teal-400 → cyan-600 |
| Capture Builder | pink-500 → pink-600 | pink-500 → fuchsia-600 |

---

## 2. Surface Treatment & Depth

### Dark Mode Surfaces (Purple-Tinted)

Three-tier depth using purple-tinted darks instead of plain slate:

| Level | Color | Usage |
|-------|-------|-------|
| Base | `#0a0118` | Page background (`bg-slate-950` replacement) |
| Surface 1 | `#140b24` | Cards, panels (`bg-slate-900` replacement) |
| Surface 2 | `#1e1433` | Modals, dropdowns, elevated elements |

Defined as CSS custom properties and Tailwind theme extension.

### Light Mode Surfaces

- Page background: `purple-50/50` or `#faf8ff` (very subtle purple tint)
- Cards: white with purple-tinted shadows (`shadow-purple-500/5`)
- No purple backgrounds on light cards — keep them white and airy

### Borders

- Dark mode: `border-purple-500/10` (soft purple edge) instead of `border-slate-700/800`
- Light mode: `border-purple-200/50` instead of `border-slate-200`

### Sidebar

- Background: `#1a0b2e` (deep purple-black) instead of `bg-slate-900`
- Border: `border-purple-500/10` instead of `border-slate-700`
- Active item gradient: `from-purple-500/20 to-transparent`
- Dividers: `border-purple-500/10`

### Header Glassmorphism (Upgraded)

- Blur: `backdrop-blur-xl` (from `backdrop-blur-sm`)
- Dark: `bg-[#0a0118]/80` with subtle bottom border glow
- Light: `bg-white/80` with `border-b border-purple-200/30`

---

## 3. Glow Effects

### Button Glow (Hover)

Primary buttons gain a purple glow on hover:
```css
.btn-primary:hover {
  box-shadow: 0 0 20px rgba(168, 85, 247, 0.3), 0 4px 12px rgba(168, 85, 247, 0.15);
}
```

### Card Glow (Hover)

Interactive cards get a faint purple border-glow on hover:
```css
.card-hover:hover {
  border-color: rgba(168, 85, 247, 0.2);
  box-shadow: 0 0 30px rgba(168, 85, 247, 0.08);
}
```

### Focus Ring Glow

Replace hard focus rings with a soft glow:
```css
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.5), 0 0 12px rgba(168, 85, 247, 0.2);
}
```

---

## 4. Animations

All CSS/Tailwind — no new dependencies.

### Page Entrance (Upgraded)

Replace current `fade-in` with smoother entrance:
```css
@keyframes page-enter {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
.animate-page-enter {
  animation: page-enter 0.3s ease-out forwards;
}
```

### Route Transitions

Wrapper component around `<Outlet>` that toggles CSS classes on route change:
- Exit: opacity → 0, translateY(4px), 150ms
- Enter: opacity 0 → 1, translateY(-4px) → 0, 200ms
- Uses `key={location.pathname}` on wrapper to trigger re-mount animation

### Staggered List Entrance

For lists (trace hops, activity items, test results):
```css
@keyframes stagger-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.stagger-item {
  opacity: 0;
  animation: stagger-in 0.3s ease-out forwards;
}
/* Applied via inline style: animation-delay: calc(index * 50ms) */
```

### Card Hover (Spring Easing)

```css
.card-hover {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
              box-shadow 0.2s ease,
              border-color 0.2s ease;
}
```

The `cubic-bezier(0.34, 1.56, 0.64, 1)` gives a slight overshoot — feels alive.

### Button Click Ripple

Quick glow pulse on click:
```css
@keyframes glow-pulse {
  0% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.4); }
  100% { box-shadow: 0 0 0 12px rgba(168, 85, 247, 0); }
}
```

### Skeleton Shimmer (Loading)

Purple-tinted loading placeholder:
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton {
  background: linear-gradient(90deg, #140b24 25%, #2a1a44 50%, #140b24 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}
```

### Status Ring Pulse

Concentric rings expanding from status indicator:
```css
@keyframes ring-pulse {
  0% { transform: scale(1); opacity: 0.6; }
  100% { transform: scale(2.5); opacity: 0; }
}
```

---

## 5. Favicon & Logo

### Logo (Sidebar)

The inline SVG cross/plus icon stays — it's the "First Aid" identity. The gradient shifts from `from-primary-500 to-primary-700` which automatically becomes purple through the palette change. Shadow shifts to `shadow-primary-500/25` (purple glow).

### Favicon

Create `public/favicon.svg` — an SVG favicon with the purple-gradient cross:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#a855f7"/>
      <stop offset="100%" stop-color="#7e22ce"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="8" fill="#1a0b2e"/>
  <rect x="13" y="6" width="6" height="20" rx="1.5" fill="url(#g)"/>
  <rect x="6" y="13" width="20" height="6" rx="1.5" fill="url(#g)"/>
</svg>
```

Add `<link rel="icon" type="image/svg+xml" href="/favicon.svg">` to `index.html`.

---

## 6. Files Changed

| File | Change |
|------|--------|
| `tailwind.config.js` | Replace primary palette, add surface colors, update tool accents |
| `src/index.css` | New keyframes, updated base classes, surface CSS properties, glow utilities |
| `src/components/layout/Layout.tsx` | Purple sidebar, upgraded glassmorphism, route transition wrapper |
| `src/components/layout/Dashboard.tsx` | Purple hero gradient, updated tool card gradients, staggered entrance |
| `src/components/layout/RecentActivity.tsx` | Staggered list entrance |
| `src/components/layout/SystemHealthBar.tsx` | Ring-pulse status indicator |
| `src/components/ui/ThemeToggle.tsx` | Updated colors |
| `index.html` | Favicon link |
| `public/favicon.svg` | New file — purple cross favicon |
| All tool pages | Updated via primary palette change (automatic through Tailwind) |

## 7. What's NOT Changing

- Component structure and logic
- Layout geometry (sidebar width, header height, grid)
- Functionality
- Fonts (Inter + JetBrains Mono)
- Icon library (Lucide)
- Dark/light mode toggle behavior
- Semantic color palettes (danger, warning, success)
