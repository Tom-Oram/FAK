// src/components/tools/IperfServer/components/ConfigPanel.tsx
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { ServerConfig, Protocol } from '../types'

interface ConfigPanelProps {
  config: ServerConfig
  onChange: (config: ServerConfig) => void
  disabled: boolean
}

export default function ConfigPanel({ config, onChange, disabled }: ConfigPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const updateConfig = (updates: Partial<ServerConfig>) => {
    onChange({ ...config, ...updates })
  }

  return (
    <div className="card">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Configuration</h3>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-slate-500" />
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-500" />
        )}
      </button>

      {isExpanded && (
        <div className="card-body border-t border-slate-100 dark:border-slate-800 space-y-4">
          {/* Port and Bind Address */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Port
              </label>
              <input
                type="number"
                value={config.port}
                onChange={(e) => updateConfig({ port: parseInt(e.target.value) || 5201 })}
                disabled={disabled}
                min={1}
                max={65535}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Bind Address
              </label>
              <input
                type="text"
                value={config.bindAddress}
                onChange={(e) => updateConfig({ bindAddress: e.target.value })}
                disabled={disabled}
                placeholder="0.0.0.0"
                className="input w-full"
              />
            </div>
          </div>

          {/* Protocol */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Protocol
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="protocol"
                  value="tcp"
                  checked={config.protocol === 'tcp'}
                  onChange={() => updateConfig({ protocol: 'tcp' as Protocol })}
                  disabled={disabled}
                  className="text-primary-600"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">TCP</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="protocol"
                  value="udp"
                  checked={config.protocol === 'udp'}
                  onChange={() => updateConfig({ protocol: 'udp' as Protocol })}
                  disabled={disabled}
                  className="text-primary-600"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">UDP</span>
              </label>
            </div>
          </div>

          {/* One-off and Idle Timeout */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.oneOff}
                  onChange={(e) => updateConfig({ oneOff: e.target.checked })}
                  disabled={disabled}
                  className="text-primary-600 rounded"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">One-off mode</span>
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 ml-6">
                Stop after single client test
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Idle Timeout (seconds)
              </label>
              <input
                type="number"
                value={config.idleTimeout}
                onChange={(e) =>
                  updateConfig({ idleTimeout: parseInt(e.target.value) || 0 })
                }
                disabled={disabled}
                min={0}
                className="input w-full"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">0 = no timeout</p>
            </div>
          </div>

          {/* Allowlist */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Allowed Clients (IP/CIDR)
            </label>
            <textarea
              value={config.allowlist.join('\n')}
              onChange={(e) =>
                updateConfig({
                  allowlist: e.target.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              disabled={disabled}
              placeholder={'Leave empty to allow all clients\n192.168.1.0/24\n10.0.0.5'}
              rows={3}
              className="input w-full font-mono text-sm"
            />
          </div>
        </div>
      )}
    </div>
  )
}
