import React from 'react';

interface IconProps {
  className?: string;
}

export function RouterIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v6M12 16v6M2 12h6M16 12h6" />
      <path d="M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24" />
    </svg>
  );
}

export function SwitchIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <line x1="6" y1="10" x2="6" y2="14" />
      <line x1="10" y1="10" x2="10" y2="14" />
      <line x1="14" y1="10" x2="14" y2="14" />
      <line x1="18" y1="10" x2="18" y2="14" />
    </svg>
  );
}

export function FirewallIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="9" />
      <line x1="15" y1="9" x2="15" y2="15" />
      <line x1="9" y1="15" x2="9" y2="21" />
    </svg>
  );
}

export function LoadBalancerIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="4" r="2" />
      <circle cx="6" cy="20" r="2" />
      <circle cx="18" cy="20" r="2" />
      <path d="M12 6v4M12 10l-6 8M12 10l6 8" />
    </svg>
  );
}

/** Map device vendor/type strings to icon components. */
const FIREWALL_VENDORS = new Set([
  'paloalto', 'paloalto_panos', 'cisco_asa', 'cisco_ftd',
  'juniper_srx', 'fortinet',
]);

export function getDeviceIcon(vendor: string, deviceType?: string): React.FC<IconProps> {
  if (FIREWALL_VENDORS.has(vendor) || deviceType === 'firewall') {
    return FirewallIcon;
  }
  if (deviceType === 'switch' || deviceType === 'l2_switch') {
    return SwitchIcon;
  }
  if (deviceType === 'load_balancer' || deviceType === 'loadbalancer') {
    return LoadBalancerIcon;
  }
  return RouterIcon;
}
