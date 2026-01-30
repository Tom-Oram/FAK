import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { DeviceHop, InterfaceDetail } from '../types';

interface InterfacesSectionProps {
  hop: DeviceHop;
}

function InterfaceCard({ detail, label }: { detail: InterfaceDetail; label: string }) {
  const isUp = detail.status === 'up';
  const hasErrors = detail.errors_in > 0 || detail.errors_out > 0;
  const hasDiscards = detail.discards_in > 0 || detail.discards_out > 0;

  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isUp ? 'bg-success-500' : 'bg-danger-500'}`} />
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{label}</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-mono font-semibold text-slate-900 dark:text-white">{detail.name}</span>
          {detail.speed && (
            <span className="text-xs text-slate-500 dark:text-slate-400">{detail.speed}</span>
          )}
        </div>
        {detail.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{detail.description}</p>
        )}

        {/* Utilisation bars */}
        {detail.utilisation_in_pct !== null && (
          <div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
              <span>In</span>
              <span>{detail.utilisation_in_pct.toFixed(1)}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all"
                style={{ width: `${Math.min(detail.utilisation_in_pct, 100)}%` }}
              />
            </div>
          </div>
        )}
        {detail.utilisation_out_pct !== null && (
          <div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
              <span>Out</span>
              <span>{detail.utilisation_out_pct.toFixed(1)}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-success-500 rounded-full transition-all"
                style={{ width: `${Math.min(detail.utilisation_out_pct, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Error / discard counters */}
        {(hasErrors || hasDiscards) && (
          <div className="flex gap-2 mt-1">
            {detail.errors_in > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-danger-100 dark:bg-danger-900/40 text-danger-700 dark:text-danger-300">
                Err In: {detail.errors_in}
              </span>
            )}
            {detail.errors_out > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-danger-100 dark:bg-danger-900/40 text-danger-700 dark:text-danger-300">
                Err Out: {detail.errors_out}
              </span>
            )}
            {detail.discards_in > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-warning-100 dark:bg-warning-900/40 text-warning-700 dark:text-warning-300">
                Drop In: {detail.discards_in}
              </span>
            )}
            {detail.discards_out > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-warning-100 dark:bg-warning-900/40 text-warning-700 dark:text-warning-300">
                Drop Out: {detail.discards_out}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function InterfacesSection({ hop }: InterfacesSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!hop.ingress_detail && !hop.egress_detail) return null;

  return (
    <div className="border-b border-slate-200 dark:border-slate-700 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        <span className="text-sm font-semibold text-slate-900 dark:text-white">Interfaces</span>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-2 animate-fade-in">
          {hop.ingress_detail && (
            <InterfaceCard detail={hop.ingress_detail} label="Ingress" />
          )}
          {hop.egress_detail && (
            <InterfaceCard detail={hop.egress_detail} label="Egress" />
          )}
        </div>
      )}
    </div>
  );
}
