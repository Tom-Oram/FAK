// src/components/tools/IperfServer/types.ts

export type ServerStatus = 'stopped' | 'running' | 'error'
export type Protocol = 'tcp' | 'udp'

export interface ServerConfig {
  port: number
  bindAddress: string
  protocol: Protocol
  oneOff: boolean
  idleTimeout: number
  allowlist: string[]
}

export const DEFAULT_CONFIG: ServerConfig = {
  port: 5201,
  bindAddress: '0.0.0.0',
  protocol: 'tcp',
  oneOff: false,
  idleTimeout: 300,
  allowlist: [],
}

export interface TestResult {
  id: string
  timestamp: string
  clientIp: string
  clientPort: number
  protocol: Protocol
  duration: number
  bytesTransferred: number
  avgBandwidth: number
  maxBandwidth: number
  minBandwidth: number
  retransmits?: number
  jitter?: number
  packetLoss?: number
  direction: 'upload' | 'download'
}

export interface BandwidthUpdate {
  timestamp: number
  intervalStart: number
  intervalEnd: number
  bytes: number
  bitsPerSecond: number
}

export interface ConnectionEvent {
  timestamp: string
  clientIp: string
  eventType: 'connected' | 'test_started' | 'test_complete' | 'error'
  details: string
}

export type WSMessageType =
  | 'server_status'
  | 'client_connected'
  | 'bandwidth_update'
  | 'test_complete'
  | 'error'

export interface WSMessage<T = unknown> {
  type: WSMessageType
  payload: T
}

export interface ServerStatusPayload {
  status: ServerStatus
  config: ServerConfig
  listenAddr?: string
  errorMsg?: string
}

export interface HistoryResponse {
  results: TestResult[]
  total: number
  limit: number
  offset: number
}
