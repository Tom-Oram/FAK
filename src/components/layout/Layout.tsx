import { Outlet, NavLink } from 'react-router-dom'
import {
  FileSearch,
  Network,
  Shield,
  Gauge,
  Menu,
  X,
  Route,
} from 'lucide-react'
import { useState } from 'react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: Gauge },
  { name: 'PCAP Analyzer', href: '/pcap-analyzer', icon: FileSearch },
  { name: 'DNS Lookup', href: '/dns-lookup', icon: Network },
  { name: 'SSL Checker', href: '/ssl-checker', icon: Shield },
  { name: 'Path Tracer', href: '/path-tracer', icon: Route },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-slate-900 transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor">
                <rect x="10" y="4" width="4" height="16" rx="1" />
                <rect x="4" y="10" width="16" height="4" rx="1" />
              </svg>
            </div>
            <div>
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

        <nav className="p-4 space-y-1">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700">
          <div className="text-xs text-slate-500 text-center">
            <p>First Aid Kit v1.0.0</p>
            <p className="mt-1">Critical Incident Response Tools</p>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 flex items-center px-4 lg:px-6">
          <button
            className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex-1 flex items-center justify-between">
            <div className="lg:hidden flex items-center gap-2 ml-2">
              <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
                  <rect x="10" y="4" width="4" height="16" rx="1" />
                  <rect x="4" y="10" width="16" height="4" rx="1" />
                </svg>
              </div>
              <span className="font-semibold text-slate-900">FAK</span>
            </div>

            <div className="hidden lg:flex items-center gap-2 text-sm">
              <span className="text-slate-500">Quick Actions:</span>
              <kbd className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-mono">
                Ctrl+U
              </kbd>
              <span className="text-slate-400">Upload file</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-success-50 text-success-700 rounded-full text-sm">
                <div className="w-2 h-2 bg-success-500 rounded-full animate-pulse" />
                <span className="hidden sm:inline">System Ready</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
