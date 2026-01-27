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
