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
import { useTheme } from '../../hooks'

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
  const { toggleTheme } = useTheme()

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed))
  }, [collapsed])

  // Keyboard shortcut for theme toggle (Ctrl/Cmd + D)
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
