// src/components/tools/CaptureBuilder.tsx
import { Terminal, AlertCircle } from 'lucide-react'

export default function CaptureBuilder() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Capture Builder</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Generate packet capture commands for multiple platforms
        </p>
      </div>

      <div className="card">
        <div className="card-body flex flex-col items-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center mb-4 shadow-lg">
            <Terminal className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            Coming Soon
          </h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-md">
            The Capture Builder tool is available on the <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-sm">feature/capture-builder</code> branch and will be merged soon.
          </p>
          <div className="mt-6 flex items-center gap-2 text-sm text-warning-600 dark:text-warning-400">
            <AlertCircle className="w-4 h-4" />
            <span>Feature in development</span>
          </div>
        </div>
      </div>
    </div>
  )
}
