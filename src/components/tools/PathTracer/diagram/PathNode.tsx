// src/components/tools/PathTracer/diagram/PathNode.tsx
import { Shield } from 'lucide-react';
import { DeviceHop } from '../types';
import { getDeviceIcon, isFirewallDevice } from './icons';

interface PathNodeProps {
  hop: DeviceHop;
  isSelected: boolean;
  onClick: () => void;
}

export default function PathNode({ hop, isSelected, onClick }: PathNodeProps) {
  const DeviceIcon = getDeviceIcon(hop.device.vendor, hop.device.device_type);

  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all
        ${isSelected
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30 shadow-sm ring-1 ring-primary-200 dark:ring-primary-800'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600'
        }
      `}
    >
      {/* Device icon with optional firewall overlay */}
      <div className="relative flex-shrink-0">
        <DeviceIcon className={`w-8 h-8 ${isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-slate-500 dark:text-slate-400'}`} />
        {isFirewallDevice(hop.device.vendor, hop.device.device_type) && (
          <Shield className="absolute -top-1 -right-1 w-3.5 h-3.5 text-warning-500" />
        )}
      </div>

      {/* Device info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">
            {hop.device.hostname}
          </span>
          {hop.device.site && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              {hop.device.site}
            </span>
          )}
          {hop.logical_context && hop.logical_context !== 'global' && hop.logical_context !== 'default' && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
              {hop.logical_context}
            </span>
          )}
        </div>
        <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
          {hop.device.management_ip}
        </span>
      </div>

      {/* Hop number */}
      <span className="flex-shrink-0 text-xs font-mono text-slate-400 dark:text-slate-500">
        #{hop.sequence}
      </span>
    </button>
  );
}
