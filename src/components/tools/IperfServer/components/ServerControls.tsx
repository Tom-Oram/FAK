// src/components/tools/IperfServer/components/ServerControls.tsx
import { Play, Square, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import type { ServerStatus } from '../types'

interface ServerControlsProps {
  status: ServerStatus
  listenAddr: string
  isConnected: boolean
  onStart: () => void
  onStop: () => void
}

export default function ServerControls({
  status,
  listenAddr,
  isConnected,
  onStart,
  onStop,
}: ServerControlsProps) {
  const [copied, setCopied] = useState(false)

  const clientCommand = listenAddr
    ? `iperf3 -c ${listenAddr.split(':')[0]} -p ${listenAddr.split(':')[1]}`
    : ''

  const copyCommand = () => {
    navigator.clipboard.writeText(clientCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="card">
      <div className="card-body space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-900">Server Control</h3>
            <StatusBadge status={status} isConnected={isConnected} />
          </div>

          {status === 'running' ? (
            <button onClick={onStop} className="btn-danger flex items-center gap-2">
              <Square className="w-4 h-4" />
              Stop Server
            </button>
          ) : (
            <button
              onClick={onStart}
              disabled={!isConnected}
              className="btn-primary flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Start Server
            </button>
          )}
        </div>

        {status === 'running' && listenAddr && (
          <div className="p-4 bg-slate-50 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Listening on:</span>
              <span className="font-mono text-primary-600">{listenAddr}</span>
            </div>

            <div className="pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Client command:</span>
                <button
                  onClick={copyCommand}
                  className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <code className="block mt-1 p-2 bg-slate-800 text-green-400 rounded text-sm font-mono">
                {clientCommand}
              </code>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({
  status,
  isConnected,
}: {
  status: ServerStatus
  isConnected: boolean
}) {
  if (!isConnected) {
    return (
      <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
        Connecting...
      </span>
    )
  }

  switch (status) {
    case 'running':
      return (
        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full flex items-center gap-1">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Running
        </span>
      )
    case 'error':
      return (
        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
          Error
        </span>
      )
    default:
      return (
        <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-full">
          Stopped
        </span>
      )
  }
}
