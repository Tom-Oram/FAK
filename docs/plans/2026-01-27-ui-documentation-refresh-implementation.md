# UI & Documentation Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform First Aid Kit into a polished, production-ready app with dark mode, smooth interactions, rich dashboard, and organized documentation.

**Architecture:** CSS custom properties for theming with Tailwind dark mode. React context for theme state. localStorage for persistence (theme preference, recent activity, sidebar state). No new dependencies required.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vite, React Router, Lucide Icons, localStorage

---

## Phase 1: Theme Infrastructure

### Task 1: Add dark mode to Tailwind config

**Files:**
- Modify: `tailwind.config.js`

**Step 1: Update tailwind.config.js to enable class-based dark mode**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
```

**Step 2: Verify config is valid**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 3: Commit**

```bash
git add tailwind.config.js
git commit -m "feat(ui): enable dark mode in Tailwind config"
```

---

### Task 2: Create useTheme hook

**Files:**
- Create: `src/hooks/useTheme.ts`

**Step 1: Create the hooks directory and useTheme.ts**

```typescript
// src/hooks/useTheme.ts
import { useState, useEffect, useCallback } from 'react'

type Theme = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'fak-theme'

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }
  return 'system'
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    const stored = getStoredTheme()
    return stored === 'system' ? getSystemTheme() : stored
  })

  const applyTheme = useCallback((resolved: ResolvedTheme) => {
    const root = document.documentElement
    if (resolved === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    setResolvedTheme(resolved)
  }, [])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem(STORAGE_KEY, newTheme)
    const resolved = newTheme === 'system' ? getSystemTheme() : newTheme
    applyTheme(resolved)
  }, [applyTheme])

  // Initialize and listen for system changes
  useEffect(() => {
    const resolved = theme === 'system' ? getSystemTheme() : theme
    applyTheme(resolved)

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = (e: MediaQueryListEvent) => {
        applyTheme(e.matches ? 'dark' : 'light')
      }
      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    }
  }, [theme, applyTheme])

  const toggleTheme = useCallback(() => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark'
    setTheme(next)
  }, [resolvedTheme, setTheme])

  return {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
    isDark: resolvedTheme === 'dark',
  }
}
```

**Step 2: Create hooks barrel export**

```typescript
// src/hooks/index.ts
export { useTheme } from './useTheme'
```

**Step 3: Verify TypeScript compiles**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/hooks/
git commit -m "feat(ui): add useTheme hook with system preference support"
```

---

### Task 3: Create ThemeToggle component

**Files:**
- Create: `src/components/ui/ThemeToggle.tsx`
- Create: `src/components/ui/index.ts`

**Step 1: Create ThemeToggle.tsx**

```tsx
// src/components/ui/ThemeToggle.tsx
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../../hooks'

export default function ThemeToggle() {
  const { toggleTheme, isDark } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <Sun
        className={`w-5 h-5 transition-all duration-300 ${
          isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
        } absolute inset-0 m-auto`}
      />
      <Moon
        className={`w-5 h-5 transition-all duration-300 ${
          isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
        }`}
      />
    </button>
  )
}
```

**Step 2: Create ui barrel export**

```typescript
// src/components/ui/index.ts
export { default as ThemeToggle } from './ThemeToggle'
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/ui/
git commit -m "feat(ui): add ThemeToggle component with animation"
```

---

### Task 4: Update global styles for dark mode

**Files:**
- Modify: `src/index.css`

**Step 1: Update index.css with dark mode variants**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    @apply antialiased;
  }

  body {
    @apply bg-slate-50 text-slate-900 font-sans;
    @apply dark:bg-slate-950 dark:text-slate-100;
  }
}

@layer components {
  .btn {
    @apply inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed;
    @apply active:scale-[0.98];
  }

  .btn-primary {
    @apply btn bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500;
    @apply hover:shadow-lg hover:shadow-primary-500/25;
  }

  .btn-secondary {
    @apply btn bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-primary-500;
    @apply dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700;
  }

  .btn-danger {
    @apply btn bg-danger-600 text-white hover:bg-danger-700 focus:ring-danger-500;
  }

  .card {
    @apply bg-white rounded-xl shadow-sm border border-slate-200;
    @apply dark:bg-slate-900 dark:border-slate-800;
    @apply transition-all duration-200;
  }

  .card-hover {
    @apply hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5;
    @apply dark:hover:border-slate-700 dark:hover:shadow-slate-900/50;
  }

  .card-header {
    @apply px-6 py-4 border-b border-slate-200 dark:border-slate-800;
  }

  .card-body {
    @apply px-6 py-4;
  }

  .badge {
    @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium;
  }

  .badge-critical {
    @apply badge bg-danger-100 text-danger-800 dark:bg-danger-900/50 dark:text-danger-300;
  }

  .badge-warning {
    @apply badge bg-warning-100 text-warning-800 dark:bg-warning-900/50 dark:text-warning-300;
  }

  .badge-info {
    @apply badge bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-300;
  }

  .badge-success {
    @apply badge bg-success-100 text-success-800 dark:bg-success-900/50 dark:text-success-300;
  }

  .input {
    @apply px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900;
    @apply focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500;
    @apply dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100;
    @apply placeholder:text-slate-400 dark:placeholder:text-slate-500;
  }
}

@layer utilities {
  .scrollbar-thin {
    scrollbar-width: thin;
  }

  .scrollbar-thin::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .scrollbar-thin::-webkit-scrollbar-track {
    @apply bg-slate-100 rounded dark:bg-slate-800;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb {
    @apply bg-slate-300 rounded hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500;
  }

  .glass {
    @apply bg-white/80 backdrop-blur-sm dark:bg-slate-900/80;
  }
}

/* Custom animations */
@keyframes pulse-slow {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.animate-pulse-slow {
  animation: pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fade-in 0.2s ease-out;
}

@keyframes slide-in-right {
  from {
    opacity: 0;
    transform: translateX(16px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.animate-slide-in-right {
  animation: slide-in-right 0.2s ease-out;
}

/* Drop zone styling */
.drop-zone {
  @apply border-2 border-dashed border-slate-300 rounded-xl transition-all duration-200;
  @apply dark:border-slate-700;
}

.drop-zone:hover,
.drop-zone.drag-over {
  @apply border-primary-500 bg-primary-50 dark:bg-primary-950/50;
}

.drop-zone.drag-over {
  @apply scale-[1.02];
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat(ui): add dark mode styles and animations"
```

---

## Phase 2: Sidebar Redesign

### Task 5: Update Layout with collapsible sidebar and theme toggle

**Files:**
- Modify: `src/components/layout/Layout.tsx`

**Step 1: Rewrite Layout.tsx with new sidebar**

```tsx
// src/components/layout/Layout.tsx
import { Outlet, NavLink } from 'react-router-dom'
import {
  FileSearch,
  Globe,
  ShieldCheck,
  Route,
  Gauge,
  Terminal,
  LayoutDashboard,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { ThemeToggle } from '../ui'

const SIDEBAR_STORAGE_KEY = 'fak-sidebar-collapsed'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { type: 'divider' as const },
  { name: 'PCAP Analyzer', href: '/pcap-analyzer', icon: FileSearch },
  { name: 'DNS Lookup', href: '/dns-lookup', icon: Globe },
  { name: 'SSL Checker', href: '/ssl-checker', icon: ShieldCheck },
  { name: 'Path Tracer', href: '/path-tracer', icon: Route },
  { type: 'divider' as const },
  { name: 'iPerf Server', href: '/iperf-server', icon: Gauge },
  { name: 'Capture Builder', href: '/capture-builder', icon: Terminal },
]

type NavItem = typeof navigation[number]

function isNavLink(item: NavItem): item is { name: string; href: string; icon: typeof LayoutDashboard } {
  return 'href' in item
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
  })

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed))
  }, [collapsed])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full bg-slate-900 transform transition-all duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'lg:w-16' : 'lg:w-64'} w-64`}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b border-slate-700">
          <div className={`flex items-center gap-3 ${collapsed ? 'lg:justify-center lg:w-full' : ''}`}>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/25">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor">
                <rect x="10" y="4" width="4" height="16" rx="1" />
                <rect x="4" y="10" width="16" height="4" rx="1" />
              </svg>
            </div>
            {!collapsed && (
              <div className="lg:block hidden">
                <h1 className="text-white font-semibold text-lg leading-tight">First Aid Kit</h1>
                <p className="text-slate-400 text-xs">Network Diagnostics</p>
              </div>
            )}
            <div className="lg:hidden">
              <h1 className="text-white font-semibold text-lg leading-tight">First Aid Kit</h1>
              <p className="text-slate-400 text-xs">Network Diagnostics</p>
            </div>
          </div>
          <button
            className="lg:hidden p-2 text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-3 space-y-1">
          {navigation.map((item, index) => {
            if (!isNavLink(item)) {
              return (
                <div
                  key={`divider-${index}`}
                  className="my-2 border-t border-slate-700/50"
                />
              )
            }
            return (
              <NavLink
                key={item.name}
                to={item.href}
                title={collapsed ? item.name : undefined}
                className={({ isActive }) =>
                  `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    collapsed ? 'lg:justify-center' : ''
                  } ${
                    isActive
                      ? 'bg-gradient-to-r from-primary-500/20 to-transparent text-white border-l-[3px] border-primary-500 -ml-[3px] pl-[15px]'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <item.icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${
                  collapsed ? '' : 'group-hover:translate-x-0.5'
                }`} />
                {!collapsed && <span className="hidden lg:inline">{item.name}</span>}
                <span className="lg:hidden">{item.name}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* Collapse toggle - desktop only */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex absolute bottom-16 left-0 right-0 mx-3 items-center justify-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span className="text-sm">Collapse</span>
            </>
          )}
        </button>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700">
          <div className={`text-xs text-slate-500 ${collapsed ? 'text-center' : 'text-center'}`}>
            {collapsed ? (
              <div className="w-2 h-2 bg-success-500 rounded-full mx-auto animate-pulse" />
            ) : (
              <>
                <p>First Aid Kit v1.0.0</p>
                <p className="mt-1 flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 bg-success-500 rounded-full animate-pulse" />
                  System Ready
                </p>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className={`transition-all duration-200 ${collapsed ? 'lg:pl-16' : 'lg:pl-64'}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 flex items-center px-4 lg:px-6">
          <button
            className="lg:hidden p-2 -ml-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex-1 flex items-center justify-between">
            <div className="lg:hidden flex items-center gap-2 ml-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
                  <rect x="10" y="4" width="4" height="16" rx="1" />
                  <rect x="4" y="10" width="16" height="4" rx="1" />
                </svg>
              </div>
              <span className="font-semibold text-slate-900 dark:text-white">FAK</span>
            </div>

            <div className="hidden lg:flex items-center gap-2 text-sm">
              <span className="text-slate-500 dark:text-slate-400">Quick Actions:</span>
              <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-xs font-mono">
                Ctrl+U
              </kbd>
              <span className="text-slate-400">Upload file</span>
              <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-xs font-mono ml-2">
                Ctrl+D
              </kbd>
              <span className="text-slate-400">Toggle theme</span>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

**Step 2: Update layout barrel export**

```typescript
// src/components/layout/index.ts
export { default as Layout } from './Layout'
export { default as Dashboard } from './Dashboard'
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/layout/Layout.tsx src/components/layout/index.ts
git commit -m "feat(ui): redesign sidebar with collapse, theme toggle, and dark mode"
```

---

## Phase 3: Dashboard Redesign

### Task 6: Create useRecentActivity hook

**Files:**
- Create: `src/hooks/useRecentActivity.ts`
- Modify: `src/hooks/index.ts`

**Step 1: Create useRecentActivity.ts**

```typescript
// src/hooks/useRecentActivity.ts
import { useState, useCallback, useEffect } from 'react'

export interface ActivityItem {
  id: string
  type: 'pcap' | 'dns' | 'ssl' | 'path' | 'iperf' | 'capture'
  description: string
  detail?: string
  timestamp: number
}

const STORAGE_KEY = 'fak-recent-activity'
const MAX_ITEMS = 20

function loadActivity(): ActivityItem[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function useRecentActivity() {
  const [activity, setActivity] = useState<ActivityItem[]>(loadActivity)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activity))
  }, [activity])

  const addActivity = useCallback((item: Omit<ActivityItem, 'id' | 'timestamp'>) => {
    const newItem: ActivityItem = {
      ...item,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    }
    setActivity(prev => [newItem, ...prev].slice(0, MAX_ITEMS))
  }, [])

  const clearActivity = useCallback(() => {
    setActivity([])
  }, [])

  return {
    activity,
    addActivity,
    clearActivity,
  }
}

export function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`
  return `${Math.floor(seconds / 86400)} days ago`
}
```

**Step 2: Update hooks barrel export**

```typescript
// src/hooks/index.ts
export { useTheme } from './useTheme'
export { useRecentActivity, formatRelativeTime } from './useRecentActivity'
export type { ActivityItem } from './useRecentActivity'
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/hooks/
git commit -m "feat(ui): add useRecentActivity hook for activity tracking"
```

---

### Task 7: Create SystemHealthBar component

**Files:**
- Create: `src/components/layout/SystemHealthBar.tsx`

**Step 1: Create SystemHealthBar.tsx**

```tsx
// src/components/layout/SystemHealthBar.tsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Server, Wifi, Activity } from 'lucide-react'

interface ServiceStatus {
  name: string
  status: 'online' | 'offline' | 'connecting'
  detail?: string
  href?: string
}

export default function SystemHealthBar() {
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'Backend API', status: 'connecting' },
    { name: 'iPerf Server', status: 'connecting', href: '/iperf-server' },
  ])

  useEffect(() => {
    // Check backend API
    const checkBackend = async () => {
      try {
        const res = await fetch('http://localhost:8080/health', {
          method: 'GET',
          signal: AbortSignal.timeout(3000)
        })
        if (res.ok) {
          setServices(prev => prev.map(s =>
            s.name === 'Backend API' ? { ...s, status: 'online' } : s
          ))
        } else {
          setServices(prev => prev.map(s =>
            s.name === 'Backend API' ? { ...s, status: 'offline' } : s
          ))
        }
      } catch {
        setServices(prev => prev.map(s =>
          s.name === 'Backend API' ? { ...s, status: 'offline' } : s
        ))
      }
    }

    // Check iPerf status
    const checkIperf = async () => {
      try {
        const res = await fetch('http://localhost:8080/api/status', {
          signal: AbortSignal.timeout(3000)
        })
        if (res.ok) {
          const data = await res.json()
          setServices(prev => prev.map(s =>
            s.name === 'iPerf Server'
              ? { ...s, status: 'online', detail: data.status === 'running' ? `Running on :${data.config?.port || 5201}` : 'Stopped' }
              : s
          ))
        }
      } catch {
        setServices(prev => prev.map(s =>
          s.name === 'iPerf Server' ? { ...s, status: 'offline', detail: 'Unavailable' } : s
        ))
      }
    }

    checkBackend()
    checkIperf()

    const interval = setInterval(() => {
      checkBackend()
      checkIperf()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const getIcon = (name: string) => {
    switch (name) {
      case 'Backend API': return Server
      case 'iPerf Server': return Activity
      default: return Wifi
    }
  }

  const getStatusColor = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'online': return 'bg-success-500'
      case 'offline': return 'bg-danger-500'
      case 'connecting': return 'bg-warning-500 animate-pulse'
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-slate-100 dark:bg-slate-900 rounded-lg">
      {services.map(service => {
        const Icon = getIcon(service.name)
        const content = (
          <div className="flex items-center gap-2 text-sm">
            <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span className="text-slate-700 dark:text-slate-300 font-medium">{service.name}</span>
            <span className={`w-2 h-2 rounded-full ${getStatusColor(service.status)}`} />
            {service.detail && (
              <span className="text-slate-500 dark:text-slate-400 text-xs">{service.detail}</span>
            )}
          </div>
        )

        if (service.href) {
          return (
            <Link
              key={service.name}
              to={service.href}
              className="hover:bg-slate-200 dark:hover:bg-slate-800 px-2 py-1 -mx-2 -my-1 rounded transition-colors"
            >
              {content}
            </Link>
          )
        }

        return <div key={service.name}>{content}</div>
      })}
    </div>
  )
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/layout/SystemHealthBar.tsx
git commit -m "feat(ui): add SystemHealthBar component for service status"
```

---

### Task 8: Create RecentActivity component

**Files:**
- Create: `src/components/layout/RecentActivity.tsx`

**Step 1: Create RecentActivity.tsx**

```tsx
// src/components/layout/RecentActivity.tsx
import { FileSearch, Globe, ShieldCheck, Route, Gauge, Terminal, Trash2 } from 'lucide-react'
import { useRecentActivity, formatRelativeTime } from '../../hooks'
import type { ActivityItem } from '../../hooks'

const iconMap = {
  pcap: FileSearch,
  dns: Globe,
  ssl: ShieldCheck,
  path: Route,
  iperf: Gauge,
  capture: Terminal,
}

const colorMap = {
  pcap: 'text-blue-500 bg-blue-100 dark:bg-blue-900/50',
  dns: 'text-green-500 bg-green-100 dark:bg-green-900/50',
  ssl: 'text-purple-500 bg-purple-100 dark:bg-purple-900/50',
  path: 'text-orange-500 bg-orange-100 dark:bg-orange-900/50',
  iperf: 'text-cyan-500 bg-cyan-100 dark:bg-cyan-900/50',
  capture: 'text-pink-500 bg-pink-100 dark:bg-pink-900/50',
}

export default function RecentActivity() {
  const { activity, clearActivity } = useRecentActivity()

  if (activity.length === 0) {
    return (
      <div className="card h-full">
        <div className="card-header flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-white">Recent Activity</h3>
        </div>
        <div className="card-body flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
            <FileSearch className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-sm">No recent activity</p>
          <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Try analyzing a PCAP file!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card h-full flex flex-col">
      <div className="card-header flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 dark:text-white">Recent Activity</h3>
        <button
          onClick={clearActivity}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded transition-colors"
          title="Clear history"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {activity.map((item, index) => (
            <ActivityRow key={item.id} item={item} isNew={index === 0} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ActivityRow({ item, isNew }: { item: ActivityItem; isNew: boolean }) {
  const Icon = iconMap[item.type]
  const colors = colorMap[item.type]

  return (
    <div className={`px-4 py-3 flex items-start gap-3 ${isNew ? 'animate-slide-in-right' : ''}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colors}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-900 dark:text-white truncate">{item.description}</p>
        {item.detail && (
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.detail}</p>
        )}
      </div>
      <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">
        {formatRelativeTime(item.timestamp)}
      </span>
    </div>
  )
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/layout/RecentActivity.tsx
git commit -m "feat(ui): add RecentActivity component with history tracking"
```

---

### Task 9: Rewrite Dashboard component

**Files:**
- Modify: `src/components/layout/Dashboard.tsx`

**Step 1: Rewrite Dashboard.tsx with new design**

```tsx
// src/components/layout/Dashboard.tsx
import { Link } from 'react-router-dom'
import {
  FileSearch,
  Globe,
  ShieldCheck,
  Route,
  Gauge,
  Terminal,
  ArrowRight,
  Zap,
} from 'lucide-react'
import SystemHealthBar from './SystemHealthBar'
import RecentActivity from './RecentActivity'

const tools = [
  {
    name: 'PCAP Analyzer',
    description: 'Analyze packet captures to identify network issues and security threats.',
    href: '/pcap-analyzer',
    icon: FileSearch,
    subtitle: 'pcap & pcapng • Pattern detection',
    color: 'from-blue-500 to-blue-600',
  },
  {
    name: 'DNS Lookup',
    description: 'Query DNS records from multiple resolvers with DNSSEC validation.',
    href: '/dns-lookup',
    icon: Globe,
    subtitle: '10 record types • 3 resolvers',
    color: 'from-green-500 to-green-600',
  },
  {
    name: 'SSL Checker',
    description: 'Validate certificates via Certificate Transparency logs.',
    href: '/ssl-checker',
    icon: ShieldCheck,
    subtitle: 'CT log query • Chain validation',
    color: 'from-purple-500 to-purple-600',
  },
  {
    name: 'Path Tracer',
    description: 'Layer 3 hop-by-hop path discovery with NetBox integration.',
    href: '/path-tracer',
    icon: Route,
    subtitle: 'RTT analysis • Device lookup',
    color: 'from-orange-500 to-orange-600',
  },
  {
    name: 'iPerf Server',
    description: 'Run bandwidth tests with real-time monitoring and history.',
    href: '/iperf-server',
    icon: Gauge,
    subtitle: 'Live graphs • WebSocket updates',
    color: 'from-cyan-500 to-cyan-600',
  },
  {
    name: 'Capture Builder',
    description: 'Generate capture commands for tcpdump, Fortinet, Palo Alto, and ASA.',
    href: '/capture-builder',
    icon: Terminal,
    subtitle: 'Multi-platform • Visual builder',
    color: 'from-pink-500 to-pink-600',
  },
]

export default function Dashboard() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* System Health Bar */}
      <SystemHealthBar />

      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 dark:from-slate-800 dark:to-slate-900 dark:border dark:border-primary-500/20 p-6 lg:p-8">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white flex items-center gap-3">
                First Aid Kit
                <span className="text-sm font-normal bg-white/20 px-2 py-0.5 rounded-full">v1.0</span>
              </h1>
              <p className="mt-2 text-primary-100 dark:text-slate-300 max-w-xl">
                Your first port of call for network incident diagnostics. Analyze captures, trace paths, test bandwidth, and more.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/pcap-analyzer"
                className="btn bg-white text-primary-700 hover:bg-primary-50 shadow-lg shadow-primary-900/20"
              >
                <FileSearch className="w-4 h-4 mr-2" />
                Analyze PCAP
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
              <Link
                to="/iperf-server"
                className="btn bg-white/10 text-white border border-white/20 hover:bg-white/20"
              >
                <Zap className="w-4 h-4 mr-2" />
                Bandwidth Test
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Tools + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tool Grid */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Tools</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tools.map((tool, index) => (
              <Link
                key={tool.name}
                to={tool.href}
                className="card card-hover group"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center shadow-lg transition-transform duration-200 group-hover:scale-110`}>
                      <tool.icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {tool.name}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                        {tool.description}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                        {tool.subtitle}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-1">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Activity</h2>
          <RecentActivity />
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Update layout index to export new components**

```typescript
// src/components/layout/index.ts
export { default as Layout } from './Layout'
export { default as Dashboard } from './Dashboard'
export { default as SystemHealthBar } from './SystemHealthBar'
export { default as RecentActivity } from './RecentActivity'
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/layout/
git commit -m "feat(ui): redesign Dashboard with health bar, hero section, and activity feed"
```

---

## Phase 4: Add Capture Builder Route

### Task 10: Add Capture Builder placeholder and route

**Files:**
- Create: `src/components/tools/CaptureBuilder.tsx`
- Modify: `src/components/tools/index.ts`
- Modify: `src/App.tsx`

**Step 1: Create CaptureBuilder placeholder**

```tsx
// src/components/tools/CaptureBuilder.tsx
import { Terminal, AlertCircle } from 'lucide-react'

export default function CaptureBuilder() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Capture Builder</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Generate packet capture commands for multiple platforms
        </p>
      </div>

      <div className="card">
        <div className="card-body flex flex-col items-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center mb-4 shadow-lg">
            <Terminal className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            Coming Soon
          </h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-md">
            The Capture Builder tool is available on the <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-sm">feature/capture-builder</code> branch and will be merged soon.
          </p>
          <div className="mt-6 flex items-center gap-2 text-sm text-warning-600 dark:text-warning-400">
            <AlertCircle className="w-4 h-4" />
            <span>Feature in development</span>
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Update tools barrel export**

```typescript
// src/components/tools/index.ts
export { default as PcapAnalyzer } from './PcapAnalyzer'
export { default as DnsLookup } from './DnsLookup'
export { default as SslChecker } from './SslChecker'
export { default as PathTracer } from './PathTracer'
export { default as IperfServer } from './IperfServer'
export { default as CaptureBuilder } from './CaptureBuilder'
```

**Step 3: Update App.tsx with new route**

```tsx
// src/App.tsx
import { Routes, Route } from 'react-router-dom'
import { Layout, Dashboard } from './components/layout'
import {
  PcapAnalyzer,
  DnsLookup,
  SslChecker,
  PathTracer,
  IperfServer,
  CaptureBuilder,
} from './components/tools'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="pcap-analyzer" element={<PcapAnalyzer />} />
        <Route path="dns-lookup" element={<DnsLookup />} />
        <Route path="ssl-checker" element={<SslChecker />} />
        <Route path="path-tracer" element={<PathTracer />} />
        <Route path="iperf-server" element={<IperfServer />} />
        <Route path="capture-builder" element={<CaptureBuilder />} />
      </Route>
    </Routes>
  )
}

export default App
```

**Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/components/tools/CaptureBuilder.tsx src/components/tools/index.ts src/App.tsx
git commit -m "feat(ui): add Capture Builder placeholder and route"
```

---

## Phase 5: Documentation Restructure

### Task 11: Create documentation directory structure

**Files:**
- Create: `docs/getting-started/quick-start.md`
- Create: `docs/getting-started/installation.md`
- Create: `docs/getting-started/configuration.md`
- Create: `docs/user-guide/pcap-analyzer.md`
- Create: `docs/user-guide/dns-lookup.md`
- Create: `docs/user-guide/ssl-checker.md`
- Create: `docs/user-guide/path-tracer.md`
- Create: `docs/user-guide/iperf-server.md`
- Create: `docs/user-guide/capture-builder.md`
- Create: `docs/deployment/docker.md`
- Create: `docs/deployment/kubernetes.md`
- Create: `docs/deployment/troubleshooting.md`
- Create: `docs/integrations/netbox.md`
- Create: `docs/integrations/scanopy.md`
- Create: `docs/development/architecture.md`
- Create: `docs/development/contributing.md`

**Step 1: Create directory structure**

```bash
mkdir -p docs/getting-started docs/user-guide docs/deployment docs/integrations docs/development
```

**Step 2: Create docs/getting-started/quick-start.md**

```markdown
# Quick Start

Get First Aid Kit running in under 5 minutes.

## Prerequisites

- Node.js 18+ (for frontend development)
- Docker & Docker Compose (for full stack deployment)

## Option 1: Full Stack (Recommended)

Deploy the complete application with all backends:

```bash
# Clone and start
git clone <repository-url>
cd fak
docker compose up -d

# Access the app
open http://localhost:8081
```

## Option 2: Frontend Only

For frontend development or when backends aren't needed:

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Access the app
open http://localhost:5173
```

## Next Steps

- [Installation Guide](./installation.md) - Detailed setup options
- [Configuration](./configuration.md) - Environment variables and options
- [User Guide](../user-guide/pcap-analyzer.md) - Learn to use each tool
```

**Step 3: Create docs/getting-started/installation.md**

```markdown
# Installation

## System Requirements

- **Node.js**: 18.0 or higher
- **Docker**: 20.10 or higher (for containerized deployment)
- **Memory**: 512MB minimum, 1GB recommended
- **Browser**: Modern browser with ES2020+ support

## Installation Methods

### Docker Compose (Recommended)

Full stack deployment with all services:

```bash
git clone <repository-url>
cd fak
cp .env.example .env
docker compose up -d
```

Services started:
- Frontend: http://localhost:8081
- Backend API: http://localhost:5000
- iPerf Backend: http://localhost:8082

### Development Setup

For local development with hot reloading:

```bash
# Frontend
npm install
npm run dev

# Backend (in separate terminal)
cd backend
go run ./cmd/server
```

### Production Build

Build static files for deployment:

```bash
npm run build
# Output in dist/ directory
```

### Kubernetes

See [Kubernetes Deployment](../deployment/kubernetes.md) for cluster deployment.

## Verification

After installation, verify all services:

1. Open http://localhost:8081 (or :5173 for dev)
2. Check System Health bar shows "Backend API: Online"
3. Navigate to iPerf Server tool
4. Verify status shows "Stopped" (not "Offline")
```

**Step 4: Create docs/getting-started/configuration.md**

```markdown
# Configuration

## Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

### Frontend Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8080` | Backend API base URL |
| `VITE_WS_URL` | `ws://localhost:8080/ws` | WebSocket endpoint |

### Backend Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port |
| `DATA_DIR` | `./data` | SQLite database directory |
| `IPERF_PORT_MIN` | `5201` | Minimum iPerf port |
| `IPERF_PORT_MAX` | `5205` | Maximum iPerf port |

### Integration Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NETBOX_URL` | - | NetBox instance URL |
| `NETBOX_TOKEN` | - | NetBox API token |
| `SCANOPY_URL` | - | Scanopy server URL |

## Feature Flags

Currently no feature flags are implemented. All features are enabled by default.

## Theming

Theme preference is stored in browser localStorage:
- Key: `fak-theme`
- Values: `light`, `dark`, `system`

To reset theme, clear localStorage or use the toggle in the header.
```

**Step 5: Create placeholder user guide docs**

Create `docs/user-guide/pcap-analyzer.md`:
```markdown
# PCAP Analyzer

Analyze packet captures to identify network issues, security threats, and performance problems.

## Features

- **File Support**: pcap and pcapng formats
- **Protocol Detection**: Ethernet, IPv4, IPv6, TCP, UDP, ICMP, ARP
- **Application Analysis**: DNS, HTTP, TLS/SSL
- **Security Checks**: Weak ciphers, cleartext credentials, suspicious patterns

## Usage

1. Navigate to PCAP Analyzer from the sidebar
2. Drag and drop a .pcap or .pcapng file (or click to browse)
3. Wait for analysis to complete
4. Review findings organized by severity

## Keyboard Shortcuts

- `Ctrl+U`: Upload file

## Limitations

- Maximum file size: 100MB
- Processing happens in-browser (large files may be slow)
```

Create `docs/user-guide/dns-lookup.md`:
```markdown
# DNS Lookup

Query DNS records from multiple public resolvers with DNSSEC validation.

## Features

- **Record Types**: A, AAAA, CNAME, MX, TXT, NS, SOA, PTR, SRV, CAA
- **Resolvers**: Google (8.8.8.8), Cloudflare (1.1.1.1), Quad9 (9.9.9.9)
- **DNSSEC**: Validation status for each query
- **Comparison**: Side-by-side resolver results

## Usage

1. Navigate to DNS Lookup from the sidebar
2. Enter a domain name
3. Select record type(s) to query
4. Click "Lookup" or press Enter
5. Compare results across resolvers
```

Create `docs/user-guide/ssl-checker.md`:
```markdown
# SSL Checker

Validate SSL certificates using Certificate Transparency logs.

## Features

- **CT Log Query**: Searches crt.sh for certificate history
- **Chain Validation**: Shows complete certificate chain
- **Expiry Alerts**: Highlights expiring certificates
- **SAN List**: Shows all Subject Alternative Names

## Usage

1. Navigate to SSL Checker from the sidebar
2. Enter a domain name
3. Click "Check" to query CT logs
4. Review certificate details and history
```

Create `docs/user-guide/path-tracer.md`:
```markdown
# Path Tracer

Layer 3 hop-by-hop path discovery with infrastructure integration.

## Features

- **Traceroute**: ICMP TTL-based path discovery
- **RTT Analysis**: Color-coded latency indicators
- **NetBox Integration**: Device information lookup
- **Scanopy Integration**: Discovered topology data

## Requirements

- Backend API must be running
- For NetBox: Configure `NETBOX_URL` and `NETBOX_TOKEN`
- For Scanopy: Configure `SCANOPY_URL`

## Usage

1. Navigate to Path Tracer from the sidebar
2. Enter a destination IP or hostname
3. Click "Trace" to start path discovery
4. Review hops with device information
```

Create `docs/user-guide/iperf-server.md`:
```markdown
# iPerf Server

Run an iperf3 server for bandwidth testing with real-time monitoring.

## Features

- **Live Graphs**: Real-time bandwidth visualization
- **WebSocket Updates**: Instant test progress
- **Test History**: Stored results with filtering
- **Export**: CSV and JSON export options

## Requirements

- Backend with iperf3 installed
- Ports 5201-5205 available (configurable)

## Usage

1. Navigate to iPerf Server from the sidebar
2. Configure port and protocol settings
3. Click "Start Server"
4. Run iperf3 client from another machine:
   ```bash
   iperf3 -c <server-ip> -p 5201
   ```
5. Monitor results in real-time

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| Port | 5201 | Server listen port |
| Protocol | TCP | TCP or UDP |
| One-off | Off | Exit after single test |
| Idle Timeout | 300s | Auto-stop after idle |
```

Create `docs/user-guide/capture-builder.md`:
```markdown
# Capture Builder

Generate packet capture commands for multiple platforms.

## Supported Platforms

- **tcpdump**: Linux/macOS command-line
- **Fortinet**: FortiGate firewall
- **Palo Alto**: PAN-OS firewall
- **Cisco ASA**: Adaptive Security Appliance

## Features

- **Visual Builder**: Point-and-click filter creation
- **Syntax Help**: Platform-specific cheat sheets
- **Command Preview**: Copy-ready commands

## Usage

1. Navigate to Capture Builder from the sidebar
2. Select target platform
3. Build filters using the visual interface
4. Copy generated command
```

**Step 6: Create deployment docs**

Create `docs/deployment/docker.md`:
```markdown
# Docker Deployment

## Quick Start

```bash
docker compose up -d
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| frontend | 8081 | Nginx serving React app |
| backend | 5000 | Python API (traceroute) |
| iperf-backend | 8082 | Go API (iPerf server) |

## Configuration

### Environment Variables

Create `.env` file:
```bash
NETBOX_URL=https://netbox.example.com
NETBOX_TOKEN=your-token-here
```

### Volumes

- `iperf-data`: Persistent storage for iPerf test history

## Building Images

```bash
# Build all
docker compose build

# Build specific service
docker compose build frontend
```

## Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f iperf-backend
```
```

Create `docs/deployment/kubernetes.md`:
```markdown
# Kubernetes Deployment

## Prerequisites

- Kubernetes cluster (1.19+)
- kubectl configured
- Container registry access

## Deployment

```bash
# Build and push images
docker build -t your-registry/fak-frontend:latest .
docker push your-registry/fak-frontend:latest

# Deploy
kubectl apply -k k8s/
```

## Manifests

| File | Description |
|------|-------------|
| `deployment.yaml` | 2 replicas with resource limits |
| `service.yaml` | ClusterIP service on port 80 |
| `ingress.yaml` | Ingress with TLS support |
| `kustomization.yaml` | Kustomize configuration |

## Customization

### Change Ingress Host

Edit `k8s/ingress.yaml`:
```yaml
spec:
  rules:
  - host: fak.your-domain.com
```

### Enable TLS

Uncomment TLS section in `ingress.yaml` and configure cert-manager.

## Port Forwarding (Testing)

```bash
kubectl port-forward svc/first-aid-kit 8080:80
```
```

Create `docs/deployment/troubleshooting.md`:
```markdown
# Troubleshooting

## Common Issues

### Docker Permission Errors

If you see permission denied errors:

```bash
# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### Port Already in Use

If port 5201 is busy (system iperf3 service):

```bash
# Check what's using the port
sudo lsof -i :5201

# Stop system service
sudo systemctl stop iperf3
```

### Backend Not Connecting

1. Check backend is running: `docker compose ps`
2. Check logs: `docker compose logs backend`
3. Verify ports aren't blocked by firewall

### WebSocket Connection Failed

- Verify backend URL in environment
- Check browser console for CORS errors
- Ensure WebSocket port is accessible

## Health Checks

### Backend API
```bash
curl http://localhost:8080/health
```

### iPerf Status
```bash
curl http://localhost:8080/api/status
```
```

**Step 7: Create integration docs**

Create `docs/integrations/netbox.md`:
```markdown
# NetBox Integration

First Aid Kit integrates with NetBox for IP address and device documentation.

## Configuration

Set environment variables:
```bash
NETBOX_URL=https://netbox.example.com
NETBOX_TOKEN=your-api-token
```

## Features

### Path Tracer

When tracing paths, each hop's IP is looked up in NetBox:
- Device name and role
- Site information
- Interface details

## API Token

Create a NetBox API token:
1. Log into NetBox
2. Navigate to Admin → API Tokens
3. Create token with read permissions for:
   - IPAM (IP addresses)
   - DCIM (devices, interfaces)
```

Create `docs/integrations/scanopy.md`:
```markdown
# Scanopy Integration

First Aid Kit integrates with Scanopy for automatic network topology discovery.

## Configuration

```bash
SCANOPY_URL=http://scanopy:60072
```

## Features

### Path Tracer

Enriches traceroute hops with discovered device information:
- Automatically detected devices
- Service discovery results
- Network topology context

## Deployment

Scanopy can be deployed alongside First Aid Kit:

```yaml
# docker-compose.yml
services:
  scanopy:
    image: scanopy/scanopy:latest
    ports:
      - "60072:60072"
```

See [Scanopy Documentation](https://scanopy.net) for full setup.
```

**Step 8: Create development docs**

Create `docs/development/architecture.md`:
```markdown
# Architecture

## Overview

First Aid Kit is a multi-service application:

```
┌─────────────────────────────────────────────────────────┐
│                      Browser                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │              React Frontend                      │   │
│  │  - PCAP parsing (in-browser)                    │   │
│  │  - DNS over HTTPS                               │   │
│  │  - WebSocket client                             │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    Nginx (Proxy)                         │
│  - Static file serving                                   │
│  - API proxy (/api/* → backend)                         │
│  - WebSocket proxy (/iperf/* → iperf-backend)          │
└─────────────────────────────────────────────────────────┘
           │                              │
           ▼                              ▼
┌─────────────────────┐    ┌─────────────────────────────┐
│   Python Backend    │    │       Go Backend            │
│   (Flask)           │    │       (Chi router)          │
│   - Traceroute      │    │   - iPerf3 management       │
│   - NetBox client   │    │   - WebSocket hub           │
│   - Scanopy client  │    │   - SQLite persistence      │
└─────────────────────┘    └─────────────────────────────┘
```

## Frontend Structure

```
src/
├── components/
│   ├── layout/      # Layout, Dashboard, SystemHealthBar
│   ├── tools/       # Tool-specific components
│   └── ui/          # Reusable UI components
├── features/
│   └── pcap/        # PCAP parsing engine
└── hooks/           # Custom React hooks
```

## Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Python Backend**: Flask, Scapy, NetBox client
- **Go Backend**: Chi router, gorilla/websocket, go-sqlite3
- **Infrastructure**: Docker, Nginx, SQLite
```

Create `docs/development/contributing.md`:
```markdown
# Contributing

## Development Setup

```bash
# Clone repository
git clone <repository-url>
cd fak

# Install frontend dependencies
npm install

# Start development server
npm run dev
```

## Code Style

- **TypeScript**: Strict mode enabled
- **React**: Functional components with hooks
- **CSS**: Tailwind utility classes
- **Commits**: Conventional commits (feat:, fix:, docs:)

## Pull Request Process

1. Create feature branch from `main`
2. Make changes with tests
3. Run `npm run build` to verify
4. Submit PR with description

## Testing

```bash
# Type checking
npm run build

# Linting (if configured)
npm run lint
```
```

**Step 9: Commit documentation structure**

```bash
git add docs/
git commit -m "docs: restructure documentation into organized folders"
```

---

### Task 12: Rewrite README.md

**Files:**
- Modify: `README.md`

**Step 1: Rewrite README.md**

```markdown
# First Aid Kit

> Network diagnostics toolkit for incident response and troubleshooting

![First Aid Kit Dashboard](docs/assets/dashboard-preview.png)

## Features

- **PCAP Analyzer** - Parse and analyze packet captures in-browser
- **DNS Lookup** - Query DNS records from multiple resolvers with DNSSEC
- **SSL Checker** - Validate certificates via Certificate Transparency
- **Path Tracer** - Layer 3 traceroute with NetBox/Scanopy integration
- **iPerf Server** - Bandwidth testing with real-time monitoring
- **Capture Builder** - Generate capture commands for multiple platforms

## Quick Start

```bash
# Clone and start with Docker
git clone <repository-url>
cd fak
docker compose up -d

# Open http://localhost:8081
```

For development setup, see [Installation Guide](docs/getting-started/installation.md).

## Documentation

- [Quick Start](docs/getting-started/quick-start.md)
- [User Guide](docs/user-guide/)
- [Deployment](docs/deployment/)
- [Integrations](docs/integrations/)

## Tech Stack

React • TypeScript • Tailwind CSS • Go • Python • Docker

## License

MIT
```

**Step 2: Delete old documentation files**

```bash
rm -f DEPLOY.md DOCKER-SETUP.md FIX-DOCKER-PERMISSIONS.md QUICK-START.md INTEGRATION-COMPLETE.md
```

**Step 3: Commit**

```bash
git add README.md
git add -u  # Stage deletions
git commit -m "docs: simplify README and remove scattered docs"
```

---

## Phase 6: Final Polish

### Task 13: Add keyboard shortcut for theme toggle

**Files:**
- Modify: `src/components/layout/Layout.tsx`

**Step 1: Add keyboard listener to Layout.tsx**

Add this effect inside the Layout component, after the other hooks:

```tsx
// Add import at top
import { useTheme } from '../../hooks'

// Inside Layout component, add:
const { toggleTheme } = useTheme()

useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl/Cmd + D for theme toggle
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault()
      toggleTheme()
    }
  }

  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [toggleTheme])
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/layout/Layout.tsx
git commit -m "feat(ui): add Ctrl+D keyboard shortcut for theme toggle"
```

---

### Task 14: Visual testing and final adjustments

**Step 1: Start development server**

```bash
npm run dev
```

**Step 2: Manual verification checklist**

- [ ] Dashboard loads with health bar
- [ ] Dark mode toggle works (click and Ctrl+D)
- [ ] System preference is respected on fresh load
- [ ] Sidebar collapses on desktop
- [ ] All 6 tools appear in sidebar
- [ ] Tool cards have hover effects
- [ ] Recent activity shows empty state
- [ ] Mobile sidebar works

**Step 3: Final commit if adjustments needed**

```bash
git add -A
git commit -m "fix(ui): polish adjustments from testing"
```

---

## Summary

**Phase 1: Theme Infrastructure (Tasks 1-4)**
- Tailwind dark mode config
- useTheme hook with system preference
- ThemeToggle component
- Dark mode CSS styles

**Phase 2: Sidebar Redesign (Task 5)**
- Collapsible sidebar
- New navigation items (6 tools)
- Glass effect active states
- Theme toggle in header

**Phase 3: Dashboard Redesign (Tasks 6-9)**
- useRecentActivity hook
- SystemHealthBar component
- RecentActivity component
- New Dashboard layout

**Phase 4: Capture Builder Route (Task 10)**
- Placeholder component
- Route configuration

**Phase 5: Documentation (Tasks 11-12)**
- New directory structure
- User guides for all tools
- Deployment documentation
- Simplified README

**Phase 6: Final Polish (Tasks 13-14)**
- Keyboard shortcuts
- Visual testing
