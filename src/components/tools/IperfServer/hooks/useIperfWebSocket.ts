// src/components/tools/IperfServer/hooks/useIperfWebSocket.ts
import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  ServerStatus,
  ServerConfig,
  BandwidthUpdate,
  ConnectionEvent,
  TestResult,
  WSMessage,
  ServerStatusPayload,
} from '../types'

// Auto-detect URLs based on environment
function getApiUrls() {
  // Environment variables take precedence
  if (import.meta.env.VITE_WS_URL && import.meta.env.VITE_API_URL) {
    return {
      wsUrl: import.meta.env.VITE_WS_URL,
      apiUrl: import.meta.env.VITE_API_URL,
    }
  }

  // In production (via nginx proxy), use relative paths
  const protocol = window.location.protocol
  const host = window.location.host
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:'
  const port = window.location.port

  // Development mode (Vite dev server) - connect directly to backend
  const devPorts = ['5173', '5174', '5175', '5176', '3000']
  if (devPorts.includes(port)) {
    return {
      wsUrl: 'ws://localhost:8080/ws',
      apiUrl: 'http://localhost:8080',
    }
  }

  // Production or Docker mode - use nginx proxy paths
  return {
    wsUrl: `${wsProtocol}//${host}/iperf/ws`,
    apiUrl: `${protocol}//${host}/iperf`,
  }
}

const { wsUrl: WS_URL, apiUrl: API_URL } = getApiUrls()

interface UseIperfWebSocketReturn {
  status: ServerStatus
  config: ServerConfig
  listenAddr: string
  bandwidthData: BandwidthUpdate[]
  connectionLog: ConnectionEvent[]
  lastError: string | null
  isConnected: boolean
  startServer: (config: ServerConfig) => Promise<void>
  stopServer: () => Promise<void>
  clearBandwidthData: () => void
}

export function useIperfWebSocket(): UseIperfWebSocketReturn {
  const [status, setStatus] = useState<ServerStatus>('stopped')
  const [config, setConfig] = useState<ServerConfig>({
    port: 5201,
    bindAddress: '0.0.0.0',
    protocol: 'tcp',
    oneOff: false,
    idleTimeout: 300,
    allowlist: [],
  })
  const [listenAddr, setListenAddr] = useState('')
  const [bandwidthData, setBandwidthData] = useState<BandwidthUpdate[]>([])
  const [connectionLog, setConnectionLog] = useState<ConnectionEvent[]>([])
  const [lastError, setLastError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number>()

  const handleMessage = useCallback((message: WSMessage) => {
    switch (message.type) {
      case 'server_status': {
        const payload = message.payload as ServerStatusPayload
        setStatus(payload.status)
        setConfig(payload.config)
        if (payload.listenAddr) {
          setListenAddr(payload.listenAddr)
        }
        if (payload.errorMsg) {
          setLastError(payload.errorMsg)
        }
        break
      }

      case 'client_connected': {
        const event = message.payload as ConnectionEvent
        setConnectionLog((prev) => [
          ...prev.slice(-499), // Keep last 500
          { ...event, eventType: 'connected' },
        ])
        break
      }

      case 'bandwidth_update': {
        const update = message.payload as BandwidthUpdate
        setBandwidthData((prev) => {
          const newData = [...prev, update]
          // Keep last 60 seconds of data (assuming 1 update per second)
          return newData.slice(-60)
        })
        break
      }

      case 'test_complete': {
        const result = message.payload as TestResult
        setConnectionLog((prev) => [
          ...prev.slice(-499),
          {
            timestamp: result.timestamp,
            clientIp: result.clientIp,
            eventType: 'test_complete',
            details: `${formatBandwidth(result.avgBandwidth)} avg`,
          },
        ])
        break
      }

      case 'error': {
        const payload = message.payload as { message: string }
        setLastError(payload.message)
        setConnectionLog((prev) => [
          ...prev.slice(-499),
          {
            timestamp: new Date().toISOString(),
            clientIp: '',
            eventType: 'error',
            details: payload.message,
          },
        ])
        break
      }
    }
  }, [])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(WS_URL)

    ws.onopen = () => {
      setIsConnected(true)
      setLastError(null)
    }

    ws.onclose = () => {
      setIsConnected(false)
      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = window.setTimeout(connect, 3000)
    }

    ws.onerror = () => {
      setLastError('WebSocket connection error')
    }

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data)
        handleMessage(message)
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e)
      }
    }

    wsRef.current = ws
  }, [handleMessage])

  useEffect(() => {
    connect()

    // Fetch initial status
    fetch(`${API_URL}/api/status`)
      .then((res) => res.json())
      .then((data: ServerStatusPayload) => {
        setStatus(data.status)
        setConfig(data.config)
        if (data.listenAddr) setListenAddr(data.listenAddr)
      })
      .catch((e) => setLastError(`Failed to fetch status: ${e.message}`))

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      wsRef.current?.close()
    }
  }, [connect])

  const startServer = useCallback(async (newConfig: ServerConfig) => {
    const response = await fetch(`${API_URL}/api/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(text)
    }
  }, [])

  const stopServer = useCallback(async () => {
    const response = await fetch(`${API_URL}/api/stop`, {
      method: 'POST',
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(text)
    }
  }, [])

  const clearBandwidthData = useCallback(() => {
    setBandwidthData([])
  }, [])

  return {
    status,
    config,
    listenAddr,
    bandwidthData,
    connectionLog,
    lastError,
    isConnected,
    startServer,
    stopServer,
    clearBandwidthData,
  }
}

function formatBandwidth(bps: number): string {
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(2)} Gbps`
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(2)} Mbps`
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(2)} Kbps`
  return `${bps.toFixed(0)} bps`
}
