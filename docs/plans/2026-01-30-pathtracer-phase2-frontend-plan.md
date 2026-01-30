# PathTracer Phase 2 Frontend: Visual Path Diagram — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a vertical swimlane diagram that visualises device-based path traces with rich hop detail panels showing forwarding, interface health, firewall policy, and NAT information.

**Architecture:** Two-column layout — left column shows a scrollable vertical path of connected node cards, right column shows a sticky detail panel for the selected hop. Components live in `src/components/tools/PathTracer/diagram/`. The existing `PathTracer.tsx` is refactored from a single 943-line file into a folder-based component (`PathTracer/index.tsx`) that renders `<PathDiagram>` for device-based results.

**Tech Stack:** React 18, TypeScript 5, Tailwind CSS 3, Lucide React icons. No new dependencies.

**Design Reference:** `docs/plans/2026-01-30-pathtracer-disambiguation-and-diagram-design.md` lines 191–420.

---

## Context for the Implementer

### Existing Codebase

- **`src/components/tools/PathTracer.tsx`** — Current single-file PathTracer component (943 lines). Contains Phase 1 disambiguation UI, ICMP and device-based trace modes, expandable hop rows.
- **`src/components/tools/index.ts`** — Barrel export: `export { default as PathTracer } from './PathTracer'`. Must still work after refactor.
- **`src/index.css`** — Tailwind component classes: `.card`, `.card-header`, `.card-body`, `.badge-*`, `.btn-*`, `.animate-fade-in`, `.animate-slide-in-right`.
- **`tailwind.config.js`** — Custom colors: `primary` (blue), `danger` (red), `warning` (amber), `success` (green). Fonts: Inter, JetBrains Mono. Dark mode: `class`.
- **`api/traceroute.py`** — Backend `_serialize_hop()` returns enrichment fields: `ingress_interface`, `egress_interface`, `ingress_detail`, `egress_detail`, `policy_result`, `nat_result`, `resolve_status`.

### Key Patterns

- Components use Tailwind utility classes, not CSS modules.
- Dark mode via `dark:` prefix classes.
- Icons from `lucide-react` (e.g., `<Server />`, `<Shield />`, `<ChevronDown />`).
- Folder-based components follow the `CaptureBuilder/` pattern: `index.tsx` + subfolders.
- No test framework is set up for the frontend — tasks are manual visual verification via `npm run dev`.

### API Response Shape (device-based hop)

```json
{
  "sequence": 1,
  "device": {
    "hostname": "core-rtr-01",
    "management_ip": "10.0.0.1",
    "vendor": "cisco_ios",
    "device_type": "router",
    "site": "DC-East"
  },
  "ingress_interface": "GigabitEthernet0/0",
  "egress_interface": "GigabitEthernet0/1",
  "logical_context": "VRF_CORP",
  "lookup_time_ms": 342.5,
  "resolve_status": "resolved",
  "route": {
    "destination": "10.20.0.0/16",
    "next_hop": "10.0.0.2",
    "next_hop_type": "ip",
    "protocol": "bgp",
    "metric": 0,
    "preference": 20
  },
  "ingress_detail": {
    "name": "GigabitEthernet0/0",
    "description": "Uplink to dist-sw-01",
    "status": "up",
    "speed": "10G",
    "utilisation_in_pct": 45.2,
    "utilisation_out_pct": 32.1,
    "errors_in": 0,
    "errors_out": 0,
    "discards_in": 0,
    "discards_out": 0
  },
  "egress_detail": { "...same shape..." },
  "policy_result": {
    "rule_name": "Allow-Web",
    "rule_position": 15,
    "action": "permit",
    "source_zone": "trust",
    "dest_zone": "untrust",
    "source_addresses": ["10.0.0.0/8"],
    "dest_addresses": ["any"],
    "services": ["tcp/443"],
    "logging": true
  },
  "nat_result": {
    "snat": {
      "original_ip": "10.1.1.100",
      "original_port": "54321",
      "translated_ip": "203.0.113.5",
      "translated_port": "54321",
      "nat_rule_name": "Internet-SNAT"
    },
    "dnat": null
  }
}
```

---

## Task 1: Extract TypeScript Types

**Goal:** Create a shared types file with all the interfaces the diagram components need, including the new Phase 2 enrichment fields.

**Files:**
- Create: `src/components/tools/PathTracer/types.ts`

**Step 1: Create the types file**

```typescript
// src/components/tools/PathTracer/types.ts

export interface NetBoxDevice {
  name: string;
  site?: string;
  role?: string;
  platform?: string;
  status?: string;
}

export interface InterfaceDetail {
  name: string;
  description: string;
  status: string;
  speed: string;
  utilisation_in_pct: number | null;
  utilisation_out_pct: number | null;
  errors_in: number;
  errors_out: number;
  discards_in: number;
  discards_out: number;
}

export interface PolicyResult {
  rule_name: string;
  rule_position: number;
  action: string;
  source_zone: string;
  dest_zone: string;
  source_addresses: string[];
  dest_addresses: string[];
  services: string[];
  logging: boolean;
  raw_output?: string;
}

export interface NatTranslation {
  original_ip: string;
  original_port: string | null;
  translated_ip: string;
  translated_port: string | null;
  nat_rule_name: string;
}

export interface NatResult {
  snat: NatTranslation | null;
  dnat: NatTranslation | null;
}

export interface RouteInfo {
  destination: string;
  next_hop: string;
  next_hop_type: string;
  protocol: string;
  metric: number;
  preference: number;
}

export interface DeviceInfo {
  hostname: string;
  management_ip: string;
  vendor: string;
  device_type: string;
  site?: string;
  netbox?: NetBoxDevice;
}

export interface DeviceHop {
  sequence: number;
  device: DeviceInfo;
  ingress_interface?: string;
  egress_interface?: string;
  logical_context: string;
  lookup_time_ms: number;
  resolve_status?: string;
  route?: RouteInfo;
  ingress_detail?: InterfaceDetail | null;
  egress_detail?: InterfaceDetail | null;
  policy_result?: PolicyResult | null;
  nat_result?: NatResult | null;
}

export interface ICMPHop {
  ttl: number;
  ip: string;
  hostname?: string;
  rtt: number;
  device?: NetBoxDevice;
  asn?: string;
  timeout?: boolean;
}

export interface DeviceCandidate {
  hostname: string;
  management_ip: string;
  site?: string;
  vendor: string;
}

export interface TraceResult {
  mode: 'icmp' | 'device-based';
  sourceIp: string;
  destinationIp: string;
  hops: ICMPHop[] | DeviceHop[];
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'complete' | 'error' | 'needs_input' | 'ambiguous_hop' | string;
  error?: string;
  hop_count?: number;
  total_time_ms?: number;
  error_message?: string;
  candidates?: DeviceCandidate[];
  ambiguous_hop_sequence?: number;
  inventory_warnings?: string[];
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && npx tsc --noEmit src/components/tools/PathTracer/types.ts`

Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/tools/PathTracer/types.ts
git commit -m "feat(pathtracer): extract shared TypeScript types for diagram components"
```

---

## Task 2: Device Type Icons

**Goal:** Create SVG icon components for router, switch, firewall, and load balancer device types.

**Files:**
- Create: `src/components/tools/PathTracer/diagram/icons.tsx`

**Step 1: Create the icons file**

Each icon is a simple React component accepting `className` prop. Use distinct silhouettes:
- **Router:** Circular shape with arrows radiating outward (classic router icon)
- **Switch:** Rectangular shape with parallel horizontal lines (ports)
- **Firewall:** Shield shape with flame/wall pattern
- **Load Balancer:** Horizontal bars (like a balance scale) — or a server with branching arrows

```typescript
// src/components/tools/PathTracer/diagram/icons.tsx
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
```

**Step 2: Verify TypeScript compiles**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && npx tsc --noEmit`

Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/tools/PathTracer/diagram/icons.tsx
git commit -m "feat(pathtracer): add device type SVG icons for path diagram"
```

---

## Task 3: PathNode Component

**Goal:** Create the node card component for the left column — shows device icon, hostname, site badge, VRF indicator, and selection highlight.

**Files:**
- Create: `src/components/tools/PathTracer/diagram/PathNode.tsx`

**Dependencies:** Task 1 (types), Task 2 (icons)

**Step 1: Create the component**

```typescript
// src/components/tools/PathTracer/diagram/PathNode.tsx
import { Shield } from 'lucide-react';
import { DeviceHop } from '../types';
import { getDeviceIcon } from './icons';

interface PathNodeProps {
  hop: DeviceHop;
  isSelected: boolean;
  onClick: () => void;
}

const FIREWALL_VENDORS = new Set([
  'paloalto', 'paloalto_panos', 'cisco_asa', 'cisco_ftd',
  'juniper_srx', 'fortinet',
]);

function isFirewall(hop: DeviceHop): boolean {
  return FIREWALL_VENDORS.has(hop.device.vendor) || hop.device.device_type === 'firewall';
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
        {isFirewall(hop) && (
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
```

**Step 2: Verify TypeScript compiles**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && npx tsc --noEmit`

Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/tools/PathTracer/diagram/PathNode.tsx
git commit -m "feat(pathtracer): add PathNode card component for diagram left column"
```

---

## Task 4: PathConnector Component

**Goal:** Create the vertical connector line between path nodes — with color coding, interface labels, and NAT badges.

**Files:**
- Create: `src/components/tools/PathTracer/diagram/PathConnector.tsx`

**Dependencies:** Task 1 (types)

**Step 1: Create the component**

The connector sits between two consecutive nodes. It takes the "from" hop (for egress) and "to" hop (for ingress). Color is derived from the "from" hop's data.

```typescript
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
```

**Step 2: Verify TypeScript compiles**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && npx tsc --noEmit`

Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/tools/PathTracer/diagram/PathConnector.tsx
git commit -m "feat(pathtracer): add PathConnector with color coding, NAT badges, interface labels"
```

---

## Task 5: Detail Panel Sections — DeviceSection and ForwardingSection

**Goal:** Build the first two detail panel sections: device info and forwarding/route info.

**Files:**
- Create: `src/components/tools/PathTracer/diagram/DeviceSection.tsx`
- Create: `src/components/tools/PathTracer/diagram/ForwardingSection.tsx`

**Dependencies:** Task 1 (types), Task 2 (icons)

**Step 1: Create DeviceSection**

```typescript
// src/components/tools/PathTracer/diagram/DeviceSection.tsx
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Create ForwardingSection**

```typescript
// src/components/tools/PathTracer/diagram/ForwardingSection.tsx
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
```

**Step 3: Verify TypeScript compiles**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && npx tsc --noEmit`

Expected: No errors.

**Step 4: Commit**

```bash
git add src/components/tools/PathTracer/diagram/DeviceSection.tsx src/components/tools/PathTracer/diagram/ForwardingSection.tsx
git commit -m "feat(pathtracer): add DeviceSection and ForwardingSection detail panels"
```

---

## Task 6: InterfacesSection Component

**Goal:** Display ingress/egress interface details with utilisation bars and error counters.

**Files:**
- Create: `src/components/tools/PathTracer/diagram/InterfacesSection.tsx`

**Dependencies:** Task 1 (types)

**Step 1: Create the component**

```typescript
// src/components/tools/PathTracer/diagram/InterfacesSection.tsx
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
```

**Step 2: Verify TypeScript compiles**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && npx tsc --noEmit`

Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/tools/PathTracer/diagram/InterfacesSection.tsx
git commit -m "feat(pathtracer): add InterfacesSection with utilisation bars and error counters"
```

---

## Task 7: NatBlock Component

**Goal:** Display SNAT/DNAT transformations as two-column cards showing original → translated.

**Files:**
- Create: `src/components/tools/PathTracer/diagram/NatBlock.tsx`

**Dependencies:** Task 1 (types)

**Step 1: Create the component**

```typescript
// src/components/tools/PathTracer/diagram/NatBlock.tsx
import { ArrowRight } from 'lucide-react';
import { NatTranslation } from '../types';

interface NatBlockProps {
  translation: NatTranslation;
  label: string; // "Source NAT" or "Destination NAT"
}

export default function NatBlock({ translation, label }: NatBlockProps) {
  const originalPort = translation.original_port;
  const translatedPort = translation.translated_port;

  const ipChanged = translation.original_ip !== translation.translated_ip;
  const portChanged = originalPort !== translatedPort && translatedPort !== null;

  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{label}</span>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">
          ({translation.nat_rule_name})
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Original */}
        <div className="flex-1 text-right">
          <span className={`text-sm font-mono ${ipChanged ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>
            {translation.original_ip}
          </span>
          {originalPort && (
            <span className={`text-xs font-mono ${portChanged ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>
              :{originalPort}
            </span>
          )}
        </div>

        {/* Arrow */}
        <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />

        {/* Translated */}
        <div className="flex-1">
          <span className={`text-sm font-mono font-semibold ${ipChanged ? 'text-primary-600 dark:text-primary-400' : 'text-slate-700 dark:text-slate-300'}`}>
            {translation.translated_ip}
          </span>
          {translatedPort && (
            <span className={`text-xs font-mono font-semibold ${portChanged ? 'text-primary-600 dark:text-primary-400' : 'text-slate-700 dark:text-slate-300'}`}>
              :{translatedPort}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && npx tsc --noEmit`

Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/tools/PathTracer/diagram/NatBlock.tsx
git commit -m "feat(pathtracer): add NatBlock component for SNAT/DNAT display"
```

---

## Task 8: SecuritySection Component

**Goal:** Display firewall policy match result and NAT transformations. Only renders for firewall hops.

**Files:**
- Create: `src/components/tools/PathTracer/diagram/SecuritySection.tsx`

**Dependencies:** Task 1 (types), Task 7 (NatBlock)

**Step 1: Create the component**

```typescript
// src/components/tools/PathTracer/diagram/SecuritySection.tsx
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
```

**Step 2: Verify TypeScript compiles**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && npx tsc --noEmit`

Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/tools/PathTracer/diagram/SecuritySection.tsx
git commit -m "feat(pathtracer): add SecuritySection with policy result and NAT blocks"
```

---

## Task 9: TimingSection Component

**Goal:** Show hop lookup latency, cumulative latency, and proportional timing bar.

**Files:**
- Create: `src/components/tools/PathTracer/diagram/TimingSection.tsx`

**Dependencies:** Task 1 (types)

**Step 1: Create the component**

```typescript
// src/components/tools/PathTracer/diagram/TimingSection.tsx
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
```

**Step 2: Verify TypeScript compiles**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && npx tsc --noEmit`

Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/tools/PathTracer/diagram/TimingSection.tsx
git commit -m "feat(pathtracer): add TimingSection with latency bar and cumulative timing"
```

---

## Task 10: HopDetailPanel Component

**Goal:** Container that shows all detail sections for the selected hop, with conditional rendering based on available data.

**Files:**
- Create: `src/components/tools/PathTracer/diagram/HopDetailPanel.tsx`

**Dependencies:** Tasks 5, 6, 8, 9

**Step 1: Create the component**

```typescript
// src/components/tools/PathTracer/diagram/HopDetailPanel.tsx
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
```

**Step 2: Verify TypeScript compiles**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && npx tsc --noEmit`

Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/tools/PathTracer/diagram/HopDetailPanel.tsx
git commit -m "feat(pathtracer): add HopDetailPanel container with conditional sections"
```

---

## Task 11: PathDiagram Component

**Goal:** Main diagram layout — two-column with scrollable left path and sticky right detail panel. Manages selectedHopIndex state.

**Files:**
- Create: `src/components/tools/PathTracer/diagram/PathDiagram.tsx`
- Create: `src/components/tools/PathTracer/diagram/index.ts` (barrel export)

**Dependencies:** Tasks 3, 4, 10

**Step 1: Create PathDiagram**

```typescript
// src/components/tools/PathTracer/diagram/PathDiagram.tsx
import { useState, useMemo } from 'react';
import { DeviceHop } from '../types';
import PathNode from './PathNode';
import PathConnector from './PathConnector';
import HopDetailPanel from './HopDetailPanel';

interface PathDiagramProps {
  hops: DeviceHop[];
  totalPathMs: number;
}

export default function PathDiagram({ hops, totalPathMs }: PathDiagramProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectedHop = hops[selectedIndex];

  // Pre-compute cumulative latencies
  const cumulativeMs = useMemo(() => {
    const result: number[] = [];
    let sum = 0;
    for (const hop of hops) {
      sum += hop.lookup_time_ms;
      result.push(sum);
    }
    return result;
  }, [hops]);

  if (hops.length === 0) return null;

  return (
    <div className="flex gap-6">
      {/* Left column: Path view */}
      <div className="w-[340px] flex-shrink-0 space-y-0">
        {hops.map((hop, index) => (
          <div key={hop.sequence}>
            <PathNode
              hop={hop}
              isSelected={index === selectedIndex}
              onClick={() => setSelectedIndex(index)}
            />
            {index < hops.length - 1 && (
              <PathConnector fromHop={hop} toHop={hops[index + 1]} />
            )}
          </div>
        ))}
      </div>

      {/* Right column: Detail panel */}
      <div className="flex-1 min-w-0">
        <div className="sticky top-4">
          {selectedHop && (
            <HopDetailPanel
              key={selectedHop.sequence}
              hop={selectedHop}
              cumulativeMs={cumulativeMs[selectedIndex]}
              totalPathMs={totalPathMs}
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create barrel export**

```typescript
// src/components/tools/PathTracer/diagram/index.ts
export { default as PathDiagram } from './PathDiagram';
```

**Step 3: Verify TypeScript compiles**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && npx tsc --noEmit`

Expected: No errors.

**Step 4: Commit**

```bash
git add src/components/tools/PathTracer/diagram/PathDiagram.tsx src/components/tools/PathTracer/diagram/index.ts
git commit -m "feat(pathtracer): add PathDiagram two-column layout with hop selection"
```

---

## Task 12: Refactor PathTracer into Folder-Based Component

**Goal:** Move `PathTracer.tsx` to `PathTracer/index.tsx`, update it to use shared types, and integrate the diagram. Add protocol/port form fields.

**Files:**
- Move: `src/components/tools/PathTracer.tsx` → `src/components/tools/PathTracer/index.tsx`
- Modify: `src/components/tools/PathTracer/index.tsx` (use shared types, integrate PathDiagram, add protocol/port fields)
- Verify: `src/components/tools/index.ts` still resolves correctly (barrel export uses `./PathTracer` which resolves to `./PathTracer/index.tsx`)

**Dependencies:** Task 1 (types), Task 11 (PathDiagram)

**Step 1: Move the file**

```bash
mkdir -p src/components/tools/PathTracer
# If the types.ts and diagram/ from earlier tasks are already there,
# just move the main component file
mv src/components/tools/PathTracer.tsx src/components/tools/PathTracer/index.tsx
```

**Important:** The barrel export in `src/components/tools/index.ts` has `export { default as PathTracer } from './PathTracer'`. After the move, this resolves to `./PathTracer/index.tsx` — no change needed.

**Step 2: Update imports and integrate diagram**

Apply these changes to `src/components/tools/PathTracer/index.tsx`:

**2a. Replace inline type definitions with imports from `./types`**

At the top of the file, remove all inline interface definitions (`ICMPHop`, `DeviceHop`, `NetBoxDevice`, `DeviceCandidate`, `TraceResult`) and replace with:

```typescript
import type { ICMPHop, DeviceHop, DeviceCandidate, TraceResult } from './types';
import { PathDiagram } from './diagram';
```

**2b. Add protocol and port state**

After the existing state declarations (around line 100), add:

```typescript
const [protocol, setProtocol] = useState('tcp');
const [destinationPort, setDestinationPort] = useState('443');
```

**2c. Send protocol/port in API request**

In the `startTrace` function, inside the `if (traceMode === 'device-based')` block, add:

```typescript
if (protocol) requestBody.protocol = protocol;
if (destinationPort) requestBody.destinationPort = parseInt(destinationPort, 10);
```

**2d. Add protocol/port form fields**

Inside the device-based options grid (`bg-blue-50` section), add two more fields:

```typescript
<div>
  <label className="block text-sm font-medium text-slate-700 mb-1">
    Protocol (Optional)
  </label>
  <select
    value={protocol}
    onChange={(e) => setProtocol(e.target.value)}
    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
    disabled={isTracing}
  >
    <option value="tcp">TCP</option>
    <option value="udp">UDP</option>
    <option value="icmp">ICMP</option>
  </select>
  <p className="text-xs text-slate-500 mt-1">For firewall policy lookup</p>
</div>
<div>
  <label className="block text-sm font-medium text-slate-700 mb-1">
    Dest Port (Optional)
  </label>
  <input
    type="text"
    value={destinationPort}
    onChange={(e) => setDestinationPort(e.target.value)}
    placeholder="443"
    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
    disabled={isTracing}
  />
  <p className="text-xs text-slate-500 mt-1">For firewall policy lookup</p>
</div>
```

Change the grid from `md:grid-cols-3` to `md:grid-cols-3 lg:grid-cols-5` to accommodate 5 fields (or use two rows of 3).

**2e. Integrate PathDiagram for device-based results**

Find the section that renders hops (the `{traceResult.hops.length > 0 ? (` block around line 635). Wrap the existing expandable-row rendering in an ICMP-mode check, and add diagram rendering for device-based mode:

```typescript
{traceResult.hops.length > 0 ? (
  traceResult.mode === 'device-based' ? (
    <PathDiagram
      hops={traceResult.hops as DeviceHop[]}
      totalPathMs={traceResult.total_time_ms || 0}
    />
  ) : (
    <div className="space-y-2">
      {/* ...existing ICMP expandable rows unchanged... */}
    </div>
  )
) : traceResult.status === 'running' ? (
  /* ...existing spinner... */
) : null}
```

**Step 3: Verify it compiles and the dev server starts**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && npx tsc --noEmit`

Expected: No errors.

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && npx vite build`

Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/components/tools/PathTracer/index.tsx
# Delete the backup file if it exists
rm -f src/components/tools/PathTracer.tsx.backup
git add -u
git commit -m "feat(pathtracer): refactor to folder component, integrate PathDiagram, add protocol/port fields"
```

---

## Task 13: Visual Polish and Dark Mode Pass

**Goal:** Verify all diagram components render correctly in light and dark mode. Fix any visual issues.

**Files:**
- Modify: Various files in `src/components/tools/PathTracer/diagram/` as needed.

**Dependencies:** Task 12

**Step 1: Start dev server and verify**

Run: `cd /home/torammar/src/github.com/Tom-Oram/fak && npm run dev`

Manual verification checklist:

1. Navigate to Path Tracer tool
2. Select "Device-Based" trace mode
3. Verify protocol/port fields appear in advanced settings
4. If no backend is available, temporarily add mock data to verify rendering:

In `PathTracer/index.tsx`, add a temporary mock trace result function (for dev testing only) that creates a `TraceResult` with several `DeviceHop` objects including:
- A router hop with route info and egress_detail
- A firewall hop with policy_result, nat_result (SNAT), ingress_detail, egress_detail
- A switch hop with just basic info
- Verify: Left column shows nodes connected by lines
- Verify: Clicking a node updates the detail panel
- Verify: Firewall node shows shield overlay
- Verify: NAT badge shows on connector
- Verify: Security section shows policy and NAT blocks
- Verify: Interface utilisation bars render
- Verify: Timing section shows proportional bar
- Verify: Dark mode toggle — all components readable

**Step 2: Fix any issues found and commit**

```bash
git add -u
git commit -m "fix(pathtracer): visual polish and dark mode fixes for path diagram"
```

---

## Summary

| Task | Component | Depends On |
|------|-----------|------------|
| 1 | TypeScript types (`types.ts`) | — |
| 2 | Device icons (`icons.tsx`) | — |
| 3 | PathNode | 1, 2 |
| 4 | PathConnector | 1 |
| 5 | DeviceSection + ForwardingSection | 1, 2 |
| 6 | InterfacesSection | 1 |
| 7 | NatBlock | 1 |
| 8 | SecuritySection | 1, 7 |
| 9 | TimingSection | 1 |
| 10 | HopDetailPanel | 5, 6, 8, 9 |
| 11 | PathDiagram + barrel export | 3, 4, 10 |
| 12 | Refactor PathTracer + integrate | 1, 11 |
| 13 | Visual polish + dark mode | 12 |

Tasks 1–2 can run in parallel. Tasks 3–9 can run in parallel (all depend only on 1 and/or 2). Tasks 10–13 are sequential.
