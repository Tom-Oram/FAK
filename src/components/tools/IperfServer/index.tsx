// src/components/tools/IperfServer/index.tsx
import { useState, Component, ErrorInfo, ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
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

// Error boundary to catch rendering errors
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class IperfErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('IperfServer error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-7xl mx-auto p-6">
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-red-800 dark:text-red-300">Component Error</p>
                <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                  {this.state.error?.message || 'An unexpected error occurred'}
                </p>
                <button
                  onClick={() => this.setState({ hasError: false, error: null })}
                  className="mt-3 flex items-center gap-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function IperfServerContent() {
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
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Run an iperf3 server for bandwidth testing with real-time monitoring
        </p>
      </div>

      {/* Error Banner */}
      {displayError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800 dark:text-red-300">Error</p>
            <p className="text-sm text-red-700 dark:text-red-400">{displayError}</p>
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

export default function IperfServer() {
  return (
    <IperfErrorBoundary>
      <IperfServerContent />
    </IperfErrorBoundary>
  )
}
