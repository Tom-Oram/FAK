// src/components/tools/IperfServer/index.tsx
import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { useIperfWebSocket } from './hooks/useIperfWebSocket'
import {
  ServerControls,
  ConfigPanel,
  LiveGraph,
  ConnectionLog,
  TestHistory,
} from './components'
import type { ServerConfig } from './types'
import { DEFAULT_CONFIG } from './types'

export default function IperfServer() {
  const {
    status,
    config: serverConfig,
    listenAddr,
    bandwidthData,
    connectionLog,
    lastError,
    isConnected,
    startServer,
    stopServer,
    clearBandwidthData,
  } = useIperfWebSocket()

  const [localConfig, setLocalConfig] = useState<ServerConfig>(DEFAULT_CONFIG)
  const [startError, setStartError] = useState<string | null>(null)

  const handleStart = async () => {
    setStartError(null)
    try {
      await startServer(localConfig)
    } catch (e) {
      setStartError((e as Error).message)
    }
  }

  const handleStop = async () => {
    try {
      await stopServer()
    } catch (e) {
      setStartError((e as Error).message)
    }
  }

  const displayError = startError || lastError

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">iPerf Server</h1>
        <p className="mt-1 text-slate-600">
          Run an iperf3 server for bandwidth testing with real-time monitoring
        </p>
      </div>

      {/* Error Banner */}
      {displayError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Error</p>
            <p className="text-sm text-red-700">{displayError}</p>
          </div>
        </div>
      )}

      {/* Server Controls */}
      <ServerControls
        status={status}
        listenAddr={listenAddr}
        isConnected={isConnected}
        onStart={handleStart}
        onStop={handleStop}
      />

      {/* Config Panel */}
      <ConfigPanel
        config={status === 'running' ? serverConfig : localConfig}
        onChange={setLocalConfig}
        disabled={status === 'running'}
      />

      {/* Live Monitoring */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LiveGraph data={bandwidthData} onClear={clearBandwidthData} />
        <ConnectionLog events={connectionLog} />
      </div>

      {/* Test History */}
      <TestHistory />
    </div>
  )
}
