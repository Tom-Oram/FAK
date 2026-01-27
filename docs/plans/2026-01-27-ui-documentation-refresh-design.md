# UI & Documentation Refresh Design

**Goal:** Transform First Aid Kit into a polished, production-ready application with modern visuals, smooth interactions, comprehensive documentation, and dark mode support.

**Scope:**
- Visual polish and micro-interactions throughout
- Rich dashboard with system health and activity tracking
- Dark mode with system preference detection
- Sidebar navigation redesign with missing tools
- Documentation restructure with logical file organization

---

## 1. Visual Foundation & Dark Mode

### Color System

CSS custom properties enable instant theme switching:

```css
:root {
  --bg-base: theme('colors.slate.50');
  --bg-surface: theme('colors.white');
  --bg-elevated: theme('colors.white');
  --text-primary: theme('colors.slate.900');
  --text-secondary: theme('colors.slate.600');
  --border-default: theme('colors.slate.200');
}

[data-theme="dark"] {
  --bg-base: theme('colors.slate.950');
  --bg-surface: theme('colors.slate.900');
  --bg-elevated: theme('colors.slate.800');
  --text-primary: theme('colors.slate.100');
  --text-secondary: theme('colors.slate.400');
  --border-default: theme('colors.slate.800');
}
```

### Theme Detection & Toggle

1. On load, check `prefers-color-scheme` media query
2. Apply matching theme (or localStorage override if exists)
3. Header toggle (sun/moon icon) with rotation animation
4. Persist preference to localStorage

### Surface Hierarchy (Dark Mode)

| Layer | Color | Use Case |
|-------|-------|----------|
| Base | slate-950 | Page background |
| Surface | slate-900 + slate-800 border | Cards, sidebar |
| Elevated | slate-800 + soft shadow | Modals, dropdowns |
| Glass | bg-white/5 backdrop-blur-sm | Active nav items |

### Micro-interactions

All interactive elements get consistent treatment:

- **Buttons**: 150ms `scale(1.02)` on hover, subtle shadow lift
- **Cards**: 200ms shadow expansion + border color shift on hover
- **Nav items**: Smooth background fade, left-border accent slide-in for active state
- **Focus states**: Ring with slight offset for accessibility
- **Click feedback**: Brief `scale(0.98)` on mousedown

---

## 2. Dashboard Layout

### Structure (Top to Bottom)

```
┌─────────────────────────────────────────────────────┐
│  System Health Bar (slim, always visible)           │
├─────────────────────────────────────────────────────┤
│  Hero Section (welcome + quick actions)             │
├───────────────────────────────┬─────────────────────┤
│  Tool Grid (2 cols)           │  Recent Activity    │
│                               │  Panel              │
│                               │                     │
└───────────────────────────────┴─────────────────────┘
```

On mobile, Recent Activity moves below Tool Grid.

### System Health Bar

Compact horizontal strip showing service status:

- **Backend API**: Green dot + "Connected" / Red dot + "Offline"
- **iPerf Server**: Badge showing Stopped/Running/Error
- **WebSocket**: Connection indicator with reconnecting animation

Each status is clickable (navigates to relevant tool). Collapses to dots-only on mobile.

### Hero Section

Gradient card replacing current header:

- **Light mode**: primary-600 to primary-700 gradient
- **Dark mode**: slate-800 to slate-900 with primary accent border
- Content: Title, tagline, two quick-action buttons
- Subtle animated background pattern (faint grid)

### Tool Grid + Activity Split

- **Large screens (lg+)**: 2/3 tool grid, 1/3 activity panel
- **Smaller screens**: Activity below grid

---

## 3. Tool Cards

### Visual Design

- **Icon**: 32px with gradient background circle, hue shifts on hover
- **Title + description**: Tighter typography, 2-line description max
- **Subtitle**: Single info line (e.g., "6 record types • 3 resolvers") instead of feature tags
- **Status badge**: For tools with live state (iPerf: "Running on :5201")

### Interaction States

| State | Effect |
|-------|--------|
| Hover | translateY(-2px), shadow expand, border → primary, icon scale(1.05) |
| Active/Click | scale(0.98) for tactile feedback |
| Focus | Ring with offset |

### Animation

Cards stagger-animate in on page load (50ms delay between each).

---

## 4. Recent Activity Panel

### Content

Scrollable card showing last 20 actions (localStorage):

- **Entry format**: Tool icon + description + relative timestamp
- **Examples**:
  - "PCAP analyzed: capture.pcap (1.2MB)" - 2 min ago
  - "DNS lookup: example.com" - 5 min ago
  - "iPerf test completed: 892 Mbps" - 1 hour ago

### Features

- "Clear history" link at bottom
- Empty state: "No recent activity. Try analyzing a PCAP!"
- New items slide in from right

---

## 5. Sidebar Navigation

### Visual Updates

- **Logo**: Refined cross icon with rounded corners, subtle inner shadow
- **Nav items**: 20px icons, regular weight (bold when active)
- **Active state**: Glass gradient (`from-primary-500/20 to-transparent`) + 3px left border slide-in
- **Hover state**: `bg-white/5` fade, icon shifts right 2px

### Collapsible Mode

- Toggle button at sidebar bottom (chevron icon)
- Full width: 256px, Collapsed: 64px
- Collapsed shows icons only with hover tooltips
- 200ms width transition
- Preference in localStorage

### Navigation Items

```
Dashboard          (LayoutDashboard)
────────────────────────────────────
PCAP Analyzer      (FileSearch)
DNS Lookup         (Globe)
SSL Checker        (ShieldCheck)
Path Tracer        (Route)
────────────────────────────────────
iPerf Server       (Gauge)
Filter Builder     (Filter)
```

Dividers (1px slate-700) separate analysis tools from utilities.

### Footer

Version + status indicator. In collapsed mode, shows just a green dot.

---

## 6. Documentation Structure

### Current State (Problematic)

```
README.md
DEPLOY.md
DOCKER-SETUP.md
FIX-DOCKER-PERMISSIONS.md
QUICK-START.md
INTEGRATION-COMPLETE.md
docs/plans/...
```

### New Structure

```
README.md                      # Concise overview (< 100 lines)
docs/
├── getting-started/
│   ├── quick-start.md         # 5-minute local setup
│   ├── installation.md        # All installation methods
│   └── configuration.md       # Environment variables
├── user-guide/
│   ├── pcap-analyzer.md
│   ├── dns-lookup.md
│   ├── ssl-checker.md
│   ├── path-tracer.md
│   ├── iperf-server.md
│   └── filter-builder.md
├── deployment/
│   ├── docker.md              # Docker Compose
│   ├── kubernetes.md          # K8s manifests
│   └── troubleshooting.md     # Common issues
├── integrations/
│   ├── netbox.md
│   └── scanopy.md
├── development/
│   ├── architecture.md        # System overview
│   └── contributing.md
└── plans/                     # Implementation plans
```

### README.md Content

- Project tagline + logo
- Feature bullets (6 tools)
- Single quick-start command block
- Screenshot or GIF
- Links to full documentation
- No deployment details (link to docs/deployment/)

---

## 7. Polish & Loading States

### Page Transitions

- Content fades out (100ms), fades in (150ms) with 10px upward slide
- Lightweight wrapper component, no heavy library

### Loading States

| Context | Treatment |
|---------|-----------|
| Tool pages | Skeleton loaders matching content shape |
| API calls | Inline spinner in button, button disabled |
| WebSocket | Pulsing dot + "Connecting..." |
| Large files | Progress bar + percentage + status text |

### Empty States

Centered layout per tool:
- Large muted icon
- Helpful text (e.g., "Drop a PCAP file here or click to browse")
- Subtle CTA button

### Toast Notifications

- Slide in from top-right, auto-dismiss 4s
- Color-coded: success/error/info
- Dismissible, stackable

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl/Cmd + U | Upload file |
| Ctrl/Cmd + D | Toggle dark mode |

---

## 8. Implementation Notes

### Dependencies to Add

- None required for core features
- Consider `framer-motion` if animations need more control (optional)

### Files to Modify

**Core styling:**
- `src/index.css` - CSS variables, dark mode classes
- `tailwind.config.js` - Extend with dark mode variant

**Layout:**
- `src/components/layout/Layout.tsx` - Sidebar redesign, theme toggle
- `src/components/layout/Dashboard.tsx` - Complete rewrite

**New components:**
- `src/components/ui/ThemeToggle.tsx`
- `src/components/ui/Toast.tsx`
- `src/components/ui/Skeleton.tsx`
- `src/components/layout/SystemHealthBar.tsx`
- `src/components/layout/RecentActivity.tsx`
- `src/hooks/useTheme.ts`
- `src/hooks/useRecentActivity.ts`

**Documentation:**
- Delete: DEPLOY.md, DOCKER-SETUP.md, FIX-DOCKER-PERMISSIONS.md, QUICK-START.md, INTEGRATION-COMPLETE.md
- Create: New structure under docs/
- Rewrite: README.md

### Migration Strategy

1. Add theme infrastructure first (CSS vars, hook, toggle)
2. Update base components (buttons, cards, badges)
3. Redesign sidebar
4. Build new dashboard
5. Add loading states and toasts
6. Restructure documentation
7. Final polish pass
