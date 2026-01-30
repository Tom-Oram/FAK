import { ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { useState } from 'react';
import { DeviceHop } from '../types';

interface TimingSectionProps {
  hop: DeviceHop;
  cumulativeMs: number;
  totalPathMs: number;
}

export default function TimingSection({ hop, cumulativeMs, totalPathMs }: TimingSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  const proportion = totalPathMs > 0 ? (hop.lookup_time_ms / totalPathMs) * 100 : 0;

  return (
    <div className="border-b border-slate-200 dark:border-slate-700 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        <Clock className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-semibold text-slate-900 dark:text-white">Timing</span>
        <span className="ml-auto text-xs font-mono text-slate-500 dark:text-slate-400">
          {hop.lookup_time_ms.toFixed(0)} ms
        </span>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-3 animate-fade-in">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Hop Latency</dt>
              <dd className="text-sm font-mono text-slate-900 dark:text-white">{hop.lookup_time_ms.toFixed(1)} ms</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Cumulative</dt>
              <dd className="text-sm font-mono text-slate-900 dark:text-white">{cumulativeMs.toFixed(1)} ms</dd>
            </div>
          </div>

          {/* Proportion bar */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1">
              <span>Share of total path time</span>
              <span>{proportion.toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all"
                style={{ width: `${Math.min(proportion, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
