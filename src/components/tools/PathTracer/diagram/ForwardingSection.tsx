import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { DeviceHop } from '../types';

interface ForwardingSectionProps {
  hop: DeviceHop;
}

const PROTOCOL_COLORS: Record<string, string> = {
  bgp: 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-300',
  ospf: 'bg-success-100 text-success-800 dark:bg-success-900/40 dark:text-success-300',
  static: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
  connected: 'bg-warning-100 text-warning-800 dark:bg-warning-900/40 dark:text-warning-300',
};

export default function ForwardingSection({ hop }: ForwardingSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!hop.route) return null;

  const route = hop.route;
  const protocolColor = PROTOCOL_COLORS[route.protocol.toLowerCase()] ||
    'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300';

  return (
    <div className="border-b border-slate-200 dark:border-slate-700 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        <span className="text-sm font-semibold text-slate-900 dark:text-white">Forwarding</span>
        <span className={`ml-auto inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${protocolColor}`}>
          {route.protocol.toUpperCase()}
        </span>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 animate-fade-in">
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Destination</dt>
                <dd className="text-sm font-mono text-slate-900 dark:text-white">{route.destination}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Next Hop</dt>
                <dd className="text-sm font-mono text-slate-900 dark:text-white">{route.next_hop}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Metric</dt>
                <dd className="text-sm text-slate-900 dark:text-white">{route.metric}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Admin Distance</dt>
                <dd className="text-sm text-slate-900 dark:text-white">{route.preference}</dd>
              </div>
            </div>
          </div>
          {hop.egress_interface && (
            <div className="mt-2">
              <dt className="text-xs text-slate-500 dark:text-slate-400">Egress Interface</dt>
              <dd className="text-sm font-mono text-slate-900 dark:text-white">{hop.egress_interface}</dd>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
