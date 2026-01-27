// src/components/tools/IperfServer/components/LiveGraph.tsx
import { Trash2 } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { BandwidthUpdate } from '../types'

interface LiveGraphProps {
  data: BandwidthUpdate[]
  onClear: () => void
}

export default function LiveGraph({ data, onClear }: LiveGraphProps) {
  const chartData = data.map((d, i) => ({
    time: i,
    bandwidth: d.bitsPerSecond,
    label: formatBandwidth(d.bitsPerSecond),
  }))

  // Calculate Y-axis domain
  const maxBandwidth = Math.max(...data.map((d) => d.bitsPerSecond), 1e6)
  const yMax = roundUpNice(maxBandwidth)

  return (
    <div className="card">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Live Bandwidth</h3>
        <button
          onClick={onClear}
          className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
        >
          <Trash2 className="w-4 h-4" />
          Clear
        </button>
      </div>

      <div className="p-4">
        {data.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-500">
            Waiting for data...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={256}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickLine={{ stroke: '#94a3b8' }}
                axisLine={{ stroke: '#94a3b8' }}
                label={{
                  value: 'Time (s)',
                  position: 'insideBottom',
                  offset: -5,
                  fontSize: 12,
                  fill: '#64748b',
                }}
              />
              <YAxis
                domain={[0, yMax]}
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickLine={{ stroke: '#94a3b8' }}
                axisLine={{ stroke: '#94a3b8' }}
                tickFormatter={(v) => formatBandwidthShort(v)}
                label={{
                  value: 'Bandwidth',
                  angle: -90,
                  position: 'insideLeft',
                  fontSize: 12,
                  fill: '#64748b',
                }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-white border border-slate-200 rounded shadow-lg p-2">
                        <p className="text-sm font-medium text-slate-900">
                          {formatBandwidth(payload[0].value as number)}
                        </p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Line
                type="monotone"
                dataKey="bandwidth"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

function formatBandwidth(bps: number): string {
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(2)} Gbps`
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(2)} Mbps`
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(2)} Kbps`
  return `${bps.toFixed(0)} bps`
}

function formatBandwidthShort(bps: number): string {
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(0)}G`
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(0)}M`
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(0)}K`
  return `${bps.toFixed(0)}`
}

function roundUpNice(n: number): number {
  const order = Math.pow(10, Math.floor(Math.log10(n)))
  const normalized = n / order
  if (normalized <= 1) return order
  if (normalized <= 2) return 2 * order
  if (normalized <= 5) return 5 * order
  return 10 * order
}
