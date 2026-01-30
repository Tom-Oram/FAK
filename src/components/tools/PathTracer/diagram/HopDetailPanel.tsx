import { DeviceHop } from '../types';
import DeviceSection from './DeviceSection';
import ForwardingSection from './ForwardingSection';
import InterfacesSection from './InterfacesSection';
import SecuritySection from './SecuritySection';
import TimingSection from './TimingSection';

interface HopDetailPanelProps {
  hop: DeviceHop;
  cumulativeMs: number;
  totalPathMs: number;
}

export default function HopDetailPanel({ hop, cumulativeMs, totalPathMs }: HopDetailPanelProps) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden animate-slide-in-right">
      {/* Panel header */}
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Hop {hop.sequence} — {hop.device.hostname}
        </h3>
      </div>

      {/* Sections — each renders only when data exists */}
      <DeviceSection hop={hop} />
      <ForwardingSection hop={hop} />
      <InterfacesSection hop={hop} />
      <SecuritySection hop={hop} />
      <TimingSection hop={hop} cumulativeMs={cumulativeMs} totalPathMs={totalPathMs} />
    </div>
  );
}
