// src/components/layout/SystemHealthBar.tsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Server, Wifi, Activity } from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

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
    const abortController = new AbortController()

    // Check both services and update state in a single operation to avoid race conditions
    const checkServices = async () => {
      let backendStatus: 'online' | 'offline' = 'offline'
      let iperfStatus: 'online' | 'offline' = 'offline'
      let iperfDetail: string | undefined = 'Unavailable'

      // Check backend API
      try {
        const res = await fetch(`${API_BASE_URL}/health`, {
          method: 'GET',
          signal: abortController.signal
        })
        if (res.ok) {
          backendStatus = 'online'
        }
      } catch {
        // Keep offline status
      }

      // Check iPerf status
      try {
        const res = await fetch(`${API_BASE_URL}/api/status`, {
          signal: abortController.signal
        })
        if (res.ok) {
          try {
            const data = await res.json()
            iperfStatus = 'online'
            iperfDetail = data.status === 'running' ? `Running on :${data.config?.port || 5201}` : 'Stopped'
          } catch {
            // JSON parse error - keep offline status
          }
        }
      } catch {
        // Keep offline status
      }

      // Single state update to avoid race conditions
      if (!abortController.signal.aborted) {
        setServices(prev => prev.map(s => {
          if (s.name === 'Backend API') {
            return { ...s, status: backendStatus }
          }
          if (s.name === 'iPerf Server') {
            return { ...s, status: iperfStatus, detail: iperfDetail }
          }
          return s
        }))
      }
    }

    checkServices()

    const interval = setInterval(checkServices, 30000)

    return () => {
      abortController.abort()
      clearInterval(interval)
    }
  }, [])

  const getIcon = (name: string) => {
    switch (name) {
      case 'Backend API': return Server
      case 'iPerf Server': return Activity
      default: return Wifi
    }
  }

  const getStatusColor = (status: ServiceStatus['status']): string => {
    switch (status) {
      case 'online': return 'bg-success-500'
      case 'offline': return 'bg-danger-500'
      case 'connecting': return 'bg-warning-500 animate-pulse'
      default: return 'bg-slate-500'
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
