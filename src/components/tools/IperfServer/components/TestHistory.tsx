// src/components/tools/IperfServer/components/TestHistory.tsx
import { useState, useEffect, useMemo } from 'react'
import { Download, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import type { TestResult, HistoryResponse } from '../types'

// Auto-detect API URL based on environment
function getApiUrl(): string {
  if (typeof window === 'undefined') {
    return '/iperf' // SSR fallback
  }

  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }

  const protocol = window.location.protocol
  const host = window.location.host
  const port = window.location.port

  // Development mode (Vite dev server) - connect directly to backend
  const devPorts = ['5173', '5174', '5175', '5176', '3000']
  if (devPorts.includes(port)) {
    return 'http://localhost:8080'
  }

  // Production or Docker mode - use nginx proxy paths
  return `${protocol}//${host}/iperf`
}

export default function TestHistory() {
  const [results, setResults] = useState<TestResult[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [clientFilter, setClientFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Compute API URL at render time to ensure window is available
  const apiUrl = useMemo(() => getApiUrl(), [])

  const fetchHistory = async () => {
    setFetchError(null)
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: (page * pageSize).toString(),
      })
      if (clientFilter) {
        params.set('clientIp', clientFilter)
      }

      const response = await fetch(`${apiUrl}/api/history?${params}`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data: HistoryResponse = await response.json()
      setResults(data.results || [])
      setTotal(data.total ?? 0)
    } catch (e) {
      console.error('Failed to fetch history:', e)
      setFetchError((e as Error).message)
      setResults([])
      setTotal(0)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchHistory()
  }, [page, pageSize, clientFilter, apiUrl])

  const exportCSV = () => {
    window.open(`${apiUrl}/api/history/export?format=csv`, '_blank')
  }

  const exportJSON = () => {
    window.open(`${apiUrl}/api/history/export?format=json`, '_blank')
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="card">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Test History</h3>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="btn-secondary text-sm flex items-center gap-1">
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button onClick={exportJSON} className="btn-secondary text-sm flex items-center gap-1">
            <Download className="w-4 h-4" />
            JSON
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={clientFilter}
            onChange={(e) => {
              setClientFilter(e.target.value)
              setPage(0)
            }}
            placeholder="Filter by client IP..."
            className="input pl-9 w-full"
          />
        </div>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(parseInt(e.target.value))
            setPage(0)
          }}
          className="input"
        >
          <option value={25}>25 per page</option>
          <option value={50}>50 per page</option>
          <option value={100}>100 per page</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-700 dark:text-slate-300">Time</th>
              <th className="px-4 py-3 text-left font-medium text-slate-700 dark:text-slate-300">Client</th>
              <th className="px-4 py-3 text-left font-medium text-slate-700 dark:text-slate-300">Protocol</th>
              <th className="px-4 py-3 text-left font-medium text-slate-700 dark:text-slate-300">Duration</th>
              <th className="px-4 py-3 text-left font-medium text-slate-700 dark:text-slate-300">Avg</th>
              <th className="px-4 py-3 text-left font-medium text-slate-700 dark:text-slate-300">Peak</th>
              <th className="px-4 py-3 text-left font-medium text-slate-700 dark:text-slate-300">Direction</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                  Loading...
                </td>
              </tr>
            ) : results.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                  No test results yet
                </td>
              </tr>
            ) : (
              results.map((result) => (
                <tr key={result.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {new Date(result.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">{result.clientIp}</td>
                  <td className="px-4 py-3 uppercase text-slate-600 dark:text-slate-400">{result.protocol}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{result.duration.toFixed(1)}s</td>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                    {formatBandwidth(result.avgBandwidth)}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {formatBandwidth(result.maxBandwidth)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        result.direction === 'upload'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
                          : 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                      }`}
                    >
                      {result.direction}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="btn-secondary p-2 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="btn-secondary p-2 disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function formatBandwidth(bps: number): string {
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(2)} Gbps`
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(2)} Mbps`
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(2)} Kbps`
  return `${bps.toFixed(0)} bps`
}
