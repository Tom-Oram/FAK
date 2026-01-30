import { ChevronDown, ChevronRight, Shield } from 'lucide-react';
import { useState } from 'react';
import { DeviceHop } from '../types';
import NatBlock from './NatBlock';

interface SecuritySectionProps {
  hop: DeviceHop;
}

export default function SecuritySection({ hop }: SecuritySectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!hop.policy_result && !hop.nat_result) return null;

  const policy = hop.policy_result;
  const nat = hop.nat_result;

  const actionColor = policy?.action === 'permit'
    ? 'bg-success-100 text-success-800 dark:bg-success-900/40 dark:text-success-300'
    : 'bg-danger-100 text-danger-800 dark:bg-danger-900/40 dark:text-danger-300';

  return (
    <div className="border-b border-slate-200 dark:border-slate-700 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        <Shield className="w-4 h-4 text-warning-500" />
        <span className="text-sm font-semibold text-slate-900 dark:text-white">Security</span>
        {policy && (
          <span className={`ml-auto inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${actionColor}`}>
            {policy.action.toUpperCase()}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-3 animate-fade-in">
          {/* Policy result */}
          {policy && (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">{policy.rule_name}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">Position #{policy.rule_position}</span>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Source Zone</dt>
                  <dd className="text-sm text-slate-900 dark:text-white">{policy.source_zone}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Dest Zone</dt>
                  <dd className="text-sm text-slate-900 dark:text-white">{policy.dest_zone}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Source</dt>
                  <dd className="text-sm font-mono text-slate-900 dark:text-white">{policy.source_addresses.join(', ')}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Destination</dt>
                  <dd className="text-sm font-mono text-slate-900 dark:text-white">{policy.dest_addresses.join(', ')}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Services</dt>
                  <dd className="text-sm font-mono text-slate-900 dark:text-white">{policy.services.join(', ')}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Logging</dt>
                  <dd className="text-sm text-slate-900 dark:text-white">{policy.logging ? 'Enabled' : 'Disabled'}</dd>
                </div>
              </div>
            </div>
          )}

          {/* NAT transformations */}
          {nat?.snat && <NatBlock translation={nat.snat} label="Source NAT" />}
          {nat?.dnat && <NatBlock translation={nat.dnat} label="Destination NAT" />}
        </div>
      )}
    </div>
  );
}
