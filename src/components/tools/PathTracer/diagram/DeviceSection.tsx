import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { DeviceHop } from '../types';
import { getDeviceIcon } from './icons';

interface DeviceSectionProps {
  hop: DeviceHop;
}

export default function DeviceSection({ hop }: DeviceSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const DeviceIcon = getDeviceIcon(hop.device.vendor, hop.device.device_type);

  return (
    <div className="border-b border-slate-200 dark:border-slate-700 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        <span className="text-sm font-semibold text-slate-900 dark:text-white">Device</span>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 animate-fade-in">
          <div className="flex items-start gap-4">
            <DeviceIcon className="w-12 h-12 text-slate-400 dark:text-slate-500 flex-shrink-0" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 flex-1">
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Hostname</dt>
                <dd className="text-sm font-semibold text-slate-900 dark:text-white">{hop.device.hostname}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Management IP</dt>
                <dd className="text-sm font-mono text-slate-900 dark:text-white">{hop.device.management_ip}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Vendor</dt>
                <dd className="text-sm text-slate-900 dark:text-white">{hop.device.vendor}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Device Type</dt>
                <dd className="text-sm text-slate-900 dark:text-white">{hop.device.device_type || '—'}</dd>
              </div>
              {hop.device.site && (
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Site</dt>
                  <dd className="text-sm text-slate-900 dark:text-white">{hop.device.site}</dd>
                </div>
              )}
              {hop.logical_context && hop.logical_context !== 'global' && hop.logical_context !== 'default' && (
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">VRF / Context</dt>
                  <dd className="text-sm text-slate-900 dark:text-white">{hop.logical_context}</dd>
                </div>
              )}
              {hop.device.netbox?.role && (
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Role</dt>
                  <dd className="text-sm text-slate-900 dark:text-white">{hop.device.netbox.role}</dd>
                </div>
              )}
              {hop.device.netbox?.platform && (
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Platform</dt>
                  <dd className="text-sm text-slate-900 dark:text-white">{hop.device.netbox.platform}</dd>
                </div>
              )}
              {hop.device.netbox?.status && (
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Status</dt>
                  <dd className="text-sm text-slate-900 dark:text-white">{hop.device.netbox.status}</dd>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
