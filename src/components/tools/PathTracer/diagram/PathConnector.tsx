// src/components/tools/PathTracer/diagram/PathConnector.tsx
import { DeviceHop } from '../types';

interface PathConnectorProps {
  fromHop: DeviceHop;
  toHop: DeviceHop;
}

function getConnectorColor(hop: DeviceHop): string {
  // Red: policy deny, blackhole, or error
  if (hop.policy_result?.action === 'deny' || hop.policy_result?.action === 'drop') {
    return 'border-danger-500';
  }
  if (hop.route?.next_hop_type === 'null' || hop.route?.next_hop_type === 'reject') {
    return 'border-danger-500';
  }

  // Amber: high lookup latency (> 2000ms)
  if (hop.lookup_time_ms > 2000) {
    return 'border-warning-500';
  }

  // Green: normal
  return 'border-success-500';
}

function getConnectorStyle(hop: DeviceHop): string {
  // Dashed if hop was resolved by site affinity or user selection
  if (hop.resolve_status === 'resolved_by_site' || hop.resolve_status === 'user_selected') {
    return 'border-dashed';
  }
  return 'border-solid';
}

function getNatBadge(hop: DeviceHop): string | null {
  if (!hop.nat_result) return null;
  const hasSnat = hop.nat_result.snat !== null;
  const hasDnat = hop.nat_result.dnat !== null;
  if (hasSnat && hasDnat) return 'SD';
  if (hasSnat) return 'S';
  if (hasDnat) return 'D';
  return null;
}

export default function PathConnector({ fromHop, toHop }: PathConnectorProps) {
  const colorClass = getConnectorColor(fromHop);
  const styleClass = getConnectorStyle(toHop);
  const natBadge = getNatBadge(fromHop);

  return (
    <div className="flex items-stretch ml-[19px] py-0.5">
      {/* Vertical line */}
      <div className="relative flex flex-col items-center" style={{ width: '2px' }}>
        <div className={`flex-1 border-l-2 ${colorClass} ${styleClass}`} />

        {/* NAT badge positioned at midpoint */}
        {natBadge && (
          <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 z-10">
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-warning-100 dark:bg-warning-900/50 text-warning-700 dark:text-warning-300 border border-warning-300 dark:border-warning-700 whitespace-nowrap">
              {natBadge}
            </span>
          </div>
        )}
      </div>

      {/* Interface labels */}
      <div className="flex flex-col justify-between ml-3 py-1 min-h-[2.5rem]">
        {fromHop.egress_interface && (
          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 leading-tight">
            {fromHop.egress_interface} ↓
          </span>
        )}
        {toHop.ingress_interface && (
          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 leading-tight">
            ↓ {toHop.ingress_interface}
          </span>
        )}
      </div>
    </div>
  );
}
