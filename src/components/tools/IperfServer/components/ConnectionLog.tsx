// src/components/tools/IperfServer/components/ConnectionLog.tsx
import { useEffect, useRef } from 'react'
import { Wifi, CheckCircle, XCircle, Info } from 'lucide-react'
import type { ConnectionEvent } from '../types'

interface ConnectionLogProps {
  events: ConnectionEvent[]
}

export default function ConnectionLog({ events }: ConnectionLogProps) {
  const logRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [events])

  return (
    <div className="card">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Connection Log</h3>
      </div>

      <div ref={logRef} className="p-4 h-64 overflow-y-auto space-y-2">
        {events.length === 0 ? (
          <div className="text-center text-slate-500 dark:text-slate-400 py-8">
            No connections yet
          </div>
        ) : (
          events.map((event, i) => (
            <LogEntry key={i} event={event} />
          ))
        )}
      </div>
    </div>
  )
}

function LogEntry({ event }: { event: ConnectionEvent }) {
  const Icon = getEventIcon(event.eventType)
  const colorClass = getEventColor(event.eventType)

  const timestamp = new Date(event.timestamp).toLocaleTimeString()

  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${colorClass}`} />
      <span className="text-slate-500 dark:text-slate-400 flex-shrink-0">{timestamp}</span>
      {event.clientIp && (
        <span className="font-mono text-slate-700 dark:text-slate-300">{event.clientIp}</span>
      )}
      <span className="text-slate-600 dark:text-slate-400">{event.details}</span>
    </div>
  )
}

function getEventIcon(type: ConnectionEvent['eventType']) {
  switch (type) {
    case 'connected':
      return Wifi
    case 'test_complete':
      return CheckCircle
    case 'error':
      return XCircle
    default:
      return Info
  }
}

function getEventColor(type: ConnectionEvent['eventType']): string {
  switch (type) {
    case 'connected':
      return 'text-blue-500'
    case 'test_complete':
      return 'text-green-500'
    case 'error':
      return 'text-red-500'
    default:
      return 'text-slate-500'
  }
}
