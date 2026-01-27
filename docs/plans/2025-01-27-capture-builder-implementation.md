# Capture Builder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a tcpdump/vendor packet capture syntax builder with visual filter construction, multi-step command output, and cheat sheet.

**Architecture:** Tabbed React component with shared sub-components (BpfFilterBuilder, CommandOutput, CheatSheet). Each vendor tab manages its own state and generates platform-specific commands using the shared output component.

**Tech Stack:** React, TypeScript, Tailwind CSS, lucide-react icons

---

## Task 1: Create types and constants

**Files:**
- Create: `src/components/tools/CaptureBuilder/types.ts`
- Create: `src/components/tools/CaptureBuilder/constants.ts`

**Step 1: Create types.ts**

```typescript
// BPF Filter types
export type FilterConditionType = 'protocol' | 'host' | 'port' | 'net' | 'portrange';
export type FilterDirection = 'src' | 'dst' | 'src or dst';
export type FilterOperator = 'and' | 'or';

export interface FilterCondition {
  id: string;
  enabled: boolean;
  not: boolean;
  type: FilterConditionType;
  protocol?: string;
  host?: string;
  port?: number;
  portEnd?: number;
  net?: string;
  direction?: FilterDirection;
}

export interface BpfFilterState {
  conditions: FilterCondition[];
  operators: FilterOperator[];
  rawMode: boolean;
  rawFilter: string;
  isValid: boolean;
  parseError?: string;
}

// Command output types
export interface CommandStep {
  step: number;
  title: string;
  command: string;
  explanation: string;
  flags?: { flag: string; description: string }[];
}

// Validation types
export type ValidationSeverity = 'error' | 'warning';

export interface ValidationMessage {
  field: string;
  message: string;
  severity: ValidationSeverity;
}

// Tcpdump types
export type TcpdumpVerbosity = '' | '-v' | '-vv' | '-vvv';
export type TcpdumpHexOutput = '' | '-x' | '-X' | '-xx' | '-XX';
export type TcpdumpTimestamp = '' | '-t' | '-tt' | '-ttt' | '-tttt' | '-ttttt';

export interface TcpdumpOptions {
  interface: string;
  customInterface: string;
  packetCount: string;
  snaplen: string;
  noResolveHosts: boolean;
  noResolvePorts: boolean;
  verbosity: TcpdumpVerbosity;
  hexOutput: TcpdumpHexOutput;
  lineBuffered: boolean;
  printWhileWriting: boolean;
  timestamp: TcpdumpTimestamp;
  writeFile: string;
  readFile: string;
  rotateSize: string;
  rotateSeconds: string;
  rotateCount: string;
}

// Fortinet types
export type FortinetVerbosity = '1' | '2' | '3' | '4' | '5' | '6';

export interface FortinetOptions {
  interface: string;
  customInterface: string;
  verbosity: FortinetVerbosity;
  packetCount: string;
  absoluteTimestamp: boolean;
  debugFlowEnabled: boolean;
  debugFlowFunction: string;
  debugFlowAddress: string;
  debugFlowVerbose: boolean;
}

// Palo Alto types
export interface PaloAltoOptions {
  filterName: string;
  sourceIp: string;
  sourceZone: string;
  destIp: string;
  destZone: string;
  sourcePort: string;
  destPort: string;
  protocol: string;
  nonIpFilter: boolean;
  ethertype: string;
  stageReceive: boolean;
  stageTransmit: boolean;
  stageDrop: boolean;
  stageFirewall: boolean;
  packetCount: string;
  byteCount: string;
  fileName: string;
  includeCounters: boolean;
  includeSessions: boolean;
  showGuiSteps: boolean;
}

// Cisco ASA types
export type AsaCaptureType = 'raw-data' | 'asp-drop' | 'isakmp' | 'webvpn';
export type AsaDirection = 'both' | 'ingress' | 'egress';

export interface CiscoAsaOptions {
  captureName: string;
  interface: string;
  customInterface: string;
  captureType: AsaCaptureType;
  direction: AsaDirection;
  accessList: string;
  sourceIp: string;
  sourceMask: string;
  destIp: string;
  destMask: string;
  protocol: string;
  port: string;
  portOperator: string;
  bufferSize: string;
  packetLength: string;
  circularBuffer: boolean;
  packetCount: string;
  includeShowCapture: boolean;
  includeShowConn: boolean;
  includePacketTracer: boolean;
  packetTracerProtocol: string;
  packetTracerSourceIp: string;
  packetTracerSourcePort: string;
  packetTracerDestIp: string;
  packetTracerDestPort: string;
}

// Tab type
export type CaptureTab = 'tcpdump' | 'fortinet' | 'paloalto' | 'cisco-asa';
```

**Step 2: Create constants.ts**

```typescript
import { TcpdumpOptions, FortinetOptions, PaloAltoOptions, CiscoAsaOptions } from './types';

// Common interfaces
export const COMMON_INTERFACES = [
  { value: 'any', label: 'any (all interfaces)' },
  { value: 'eth0', label: 'eth0' },
  { value: 'eth1', label: 'eth1' },
  { value: 'ens192', label: 'ens192' },
  { value: 'lo', label: 'lo (loopback)' },
];

export const FORTINET_INTERFACES = [
  { value: 'any', label: 'any (all interfaces)' },
  { value: 'port1', label: 'port1' },
  { value: 'port2', label: 'port2' },
  { value: 'wan1', label: 'wan1' },
  { value: 'wan2', label: 'wan2' },
  { value: 'internal', label: 'internal' },
  { value: 'dmz', label: 'dmz' },
];

export const ASA_INTERFACES = [
  { value: 'inside', label: 'inside' },
  { value: 'outside', label: 'outside' },
  { value: 'dmz', label: 'dmz' },
  { value: 'management', label: 'management' },
];

export const PROTOCOLS = [
  { value: '', label: 'Any' },
  { value: 'tcp', label: 'TCP' },
  { value: 'udp', label: 'UDP' },
  { value: 'icmp', label: 'ICMP' },
  { value: 'arp', label: 'ARP' },
  { value: 'ip', label: 'IP' },
];

export const PALOALTO_PROTOCOLS = [
  { value: '', label: 'Any' },
  { value: '6', label: 'TCP (6)' },
  { value: '17', label: 'UDP (17)' },
  { value: '1', label: 'ICMP (1)' },
  { value: '47', label: 'GRE (47)' },
  { value: '50', label: 'ESP (50)' },
];

// Default values
export const DEFAULT_TCPDUMP_OPTIONS: TcpdumpOptions = {
  interface: 'any',
  customInterface: '',
  packetCount: '',
  snaplen: '',
  noResolveHosts: false,
  noResolvePorts: false,
  verbosity: '',
  hexOutput: '',
  lineBuffered: false,
  printWhileWriting: false,
  timestamp: '',
  writeFile: '',
  readFile: '',
  rotateSize: '',
  rotateSeconds: '',
  rotateCount: '',
};

export const DEFAULT_FORTINET_OPTIONS: FortinetOptions = {
  interface: 'any',
  customInterface: '',
  verbosity: '4',
  packetCount: '0',
  absoluteTimestamp: true,
  debugFlowEnabled: false,
  debugFlowFunction: 'all',
  debugFlowAddress: '',
  debugFlowVerbose: true,
};

export const DEFAULT_PALOALTO_OPTIONS: PaloAltoOptions = {
  filterName: 'capture1',
  sourceIp: '',
  sourceZone: '',
  destIp: '',
  destZone: '',
  sourcePort: '',
  destPort: '',
  protocol: '',
  nonIpFilter: false,
  ethertype: '',
  stageReceive: true,
  stageTransmit: true,
  stageDrop: true,
  stageFirewall: false,
  packetCount: '50',
  byteCount: '',
  fileName: 'capture.pcap',
  includeCounters: false,
  includeSessions: false,
  showGuiSteps: false,
};

export const DEFAULT_CISCOASA_OPTIONS: CiscoAsaOptions = {
  captureName: 'capture1',
  interface: 'inside',
  customInterface: '',
  captureType: 'raw-data',
  direction: 'both',
  accessList: '',
  sourceIp: '',
  sourceMask: '',
  destIp: '',
  destMask: '',
  protocol: '',
  port: '',
  portOperator: 'eq',
  bufferSize: '',
  packetLength: '',
  circularBuffer: false,
  packetCount: '',
  includeShowCapture: true,
  includeShowConn: false,
  includePacketTracer: false,
  packetTracerProtocol: 'tcp',
  packetTracerSourceIp: '',
  packetTracerSourcePort: '',
  packetTracerDestIp: '',
  packetTracerDestPort: '',
};

// Validation warnings
export const WARNINGS = {
  noPacketLimit: 'No packet limit set - capture may run indefinitely',
  captureOnAny: "Capturing on 'any' may impact device performance",
  noFilter: 'No filter specified - capturing all traffic',
  largeBuffer: 'Buffer size over 32MB may impact memory on older devices',
  fullSnaplen: 'Snaplen 0 captures full packets - large file sizes expected',
};
```

**Step 3: Run build to verify**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/tools/CaptureBuilder/
git commit -m "feat(capture-builder): add types and constants"
```

---

## Task 2: Create ValidationFeedback component

**Files:**
- Create: `src/components/tools/CaptureBuilder/components/ValidationFeedback.tsx`

**Step 1: Create ValidationFeedback.tsx**

```typescript
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { ValidationMessage } from '../types';

interface ValidationFeedbackProps {
  messages: ValidationMessage[];
}

export default function ValidationFeedback({ messages }: ValidationFeedbackProps) {
  if (messages.length === 0) return null;

  const errors = messages.filter((m) => m.severity === 'error');
  const warnings = messages.filter((m) => m.severity === 'warning');

  return (
    <div className="space-y-2">
      {errors.map((msg, i) => (
        <div
          key={`error-${i}`}
          className="flex items-start gap-2 p-2 bg-danger-50 border border-danger-200 rounded-lg"
        >
          <AlertCircle className="w-4 h-4 text-danger-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-danger-800">{msg.message}</p>
        </div>
      ))}
      {warnings.map((msg, i) => (
        <div
          key={`warning-${i}`}
          className="flex items-start gap-2 p-2 bg-warning-50 border border-warning-200 rounded-lg"
        >
          <AlertTriangle className="w-4 h-4 text-warning-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-warning-800">{msg.message}</p>
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/tools/CaptureBuilder/components/
git commit -m "feat(capture-builder): add ValidationFeedback component"
```

---

## Task 3: Create CommandOutput component

**Files:**
- Create: `src/components/tools/CaptureBuilder/components/CommandOutput.tsx`

**Step 1: Create CommandOutput.tsx**

```typescript
import { useState, useCallback } from 'react';
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { CommandStep } from '../types';

interface CommandOutputProps {
  steps: CommandStep[];
  title?: string;
}

export default function CommandOutput({ steps, title = 'Generated Commands' }: CommandOutputProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [showFlags, setShowFlags] = useState<Set<number>>(new Set());

  const copyToClipboard = useCallback(async (text: string, index: number | 'all') => {
    await navigator.clipboard.writeText(text);
    if (index === 'all') {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } else {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  }, []);

  const toggleFlags = useCallback((index: number) => {
    setShowFlags((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const getAllCommands = useCallback(() => {
    return steps
      .map((step) => `# Step ${step.step}: ${step.title}\n${step.command}`)
      .join('\n\n');
  }, [steps]);

  if (steps.length === 0) {
    return (
      <div className="card">
        <div className="card-body text-center text-slate-500">
          Configure options above to generate commands
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <button
          onClick={() => copyToClipboard(getAllCommands(), 'all')}
          className="btn-secondary text-sm flex items-center gap-2"
        >
          {copiedAll ? (
            <>
              <Check className="w-4 h-4" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy All
            </>
          )}
        </button>
      </div>
      <div className="card-body space-y-4">
        {steps.map((step, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">
                Step {step.step}: {step.title}
              </span>
              <button
                onClick={() => copyToClipboard(step.command, index)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                title="Copy command"
              >
                {copiedIndex === index ? (
                  <Check className="w-4 h-4 text-success-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <div className="bg-slate-900 rounded-lg p-3 font-mono text-sm text-slate-100 overflow-x-auto">
              {step.command}
            </div>
            <p className="text-xs text-slate-500">{step.explanation}</p>
            {step.flags && step.flags.length > 0 && (
              <div>
                <button
                  onClick={() => toggleFlags(index)}
                  className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                >
                  {showFlags.has(index) ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                  Show what each flag does
                </button>
                {showFlags.has(index) && (
                  <div className="mt-2 p-2 bg-slate-50 rounded text-xs space-y-1">
                    {step.flags.map((flag, i) => (
                      <div key={i} className="flex gap-2">
                        <code className="font-mono text-primary-600">{flag.flag}</code>
                        <span className="text-slate-600">→ {flag.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/tools/CaptureBuilder/components/CommandOutput.tsx
git commit -m "feat(capture-builder): add CommandOutput component"
```

---

## Task 4: Create BpfFilterBuilder component

**Files:**
- Create: `src/components/tools/CaptureBuilder/components/BpfFilterBuilder.tsx`

**Step 1: Create BpfFilterBuilder.tsx**

```typescript
import { useState, useCallback, useEffect } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import {
  FilterCondition,
  FilterConditionType,
  FilterDirection,
  FilterOperator,
  BpfFilterState,
} from '../types';
import { PROTOCOLS } from '../constants';

interface BpfFilterBuilderProps {
  value: BpfFilterState;
  onChange: (state: BpfFilterState) => void;
}

const CONDITION_TYPES: { value: FilterConditionType; label: string }[] = [
  { value: 'protocol', label: 'Protocol' },
  { value: 'host', label: 'Host' },
  { value: 'port', label: 'Port' },
  { value: 'net', label: 'Network' },
  { value: 'portrange', label: 'Port Range' },
];

const DIRECTIONS: { value: FilterDirection; label: string }[] = [
  { value: 'src or dst', label: 'src or dst' },
  { value: 'src', label: 'src' },
  { value: 'dst', label: 'dst' },
];

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function buildFilterString(conditions: FilterCondition[], operators: FilterOperator[]): string {
  const enabledConditions = conditions.filter((c) => c.enabled);
  if (enabledConditions.length === 0) return '';

  const parts: string[] = [];

  enabledConditions.forEach((condition, index) => {
    let part = '';

    if (condition.not) part += 'not ';

    switch (condition.type) {
      case 'protocol':
        if (condition.protocol) part += condition.protocol;
        break;
      case 'host':
        if (condition.host) {
          if (condition.direction && condition.direction !== 'src or dst') {
            part += `${condition.direction} host ${condition.host}`;
          } else {
            part += `host ${condition.host}`;
          }
        }
        break;
      case 'port':
        if (condition.port) {
          if (condition.direction && condition.direction !== 'src or dst') {
            part += `${condition.direction} port ${condition.port}`;
          } else {
            part += `port ${condition.port}`;
          }
        }
        break;
      case 'net':
        if (condition.net) {
          if (condition.direction && condition.direction !== 'src or dst') {
            part += `${condition.direction} net ${condition.net}`;
          } else {
            part += `net ${condition.net}`;
          }
        }
        break;
      case 'portrange':
        if (condition.port && condition.portEnd) {
          if (condition.direction && condition.direction !== 'src or dst') {
            part += `${condition.direction} portrange ${condition.port}-${condition.portEnd}`;
          } else {
            part += `portrange ${condition.port}-${condition.portEnd}`;
          }
        }
        break;
    }

    if (part && part !== 'not ') {
      if (index > 0 && parts.length > 0) {
        const opIndex = Math.min(index - 1, operators.length - 1);
        parts.push(operators[opIndex] || 'and');
      }
      parts.push(part.trim());
    }
  });

  return parts.join(' ');
}

export default function BpfFilterBuilder({ value, onChange }: BpfFilterBuilderProps) {
  const [localRaw, setLocalRaw] = useState(value.rawFilter);

  useEffect(() => {
    if (!value.rawMode) {
      const generated = buildFilterString(value.conditions, value.operators);
      setLocalRaw(generated);
    }
  }, [value.conditions, value.operators, value.rawMode]);

  const addCondition = useCallback(() => {
    const newCondition: FilterCondition = {
      id: generateId(),
      enabled: true,
      not: false,
      type: 'host',
      direction: 'src or dst',
    };
    const newOperators = value.conditions.length > 0 ? [...value.operators, 'and' as FilterOperator] : value.operators;
    onChange({
      ...value,
      conditions: [...value.conditions, newCondition],
      operators: newOperators,
    });
  }, [value, onChange]);

  const updateCondition = useCallback(
    (id: string, updates: Partial<FilterCondition>) => {
      onChange({
        ...value,
        conditions: value.conditions.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      });
    },
    [value, onChange]
  );

  const removeCondition = useCallback(
    (id: string) => {
      const index = value.conditions.findIndex((c) => c.id === id);
      const newConditions = value.conditions.filter((c) => c.id !== id);
      const newOperators = [...value.operators];
      if (index > 0) {
        newOperators.splice(index - 1, 1);
      } else if (newOperators.length > 0) {
        newOperators.splice(0, 1);
      }
      onChange({
        ...value,
        conditions: newConditions,
        operators: newOperators,
      });
    },
    [value, onChange]
  );

  const updateOperator = useCallback(
    (index: number, operator: FilterOperator) => {
      const newOperators = [...value.operators];
      newOperators[index] = operator;
      onChange({ ...value, operators: newOperators });
    },
    [value, onChange]
  );

  const toggleRawMode = useCallback(() => {
    if (!value.rawMode) {
      const generated = buildFilterString(value.conditions, value.operators);
      onChange({ ...value, rawMode: true, rawFilter: generated });
      setLocalRaw(generated);
    } else {
      onChange({ ...value, rawMode: false });
    }
  }, [value, onChange]);

  const handleRawChange = useCallback(
    (raw: string) => {
      setLocalRaw(raw);
      onChange({ ...value, rawFilter: raw, isValid: true });
    },
    [value, onChange]
  );

  const filterString = value.rawMode ? localRaw : buildFilterString(value.conditions, value.operators);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-700">BPF Filter</label>
        <button
          onClick={toggleRawMode}
          className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
        >
          {value.rawMode ? (
            <>
              <ToggleRight className="w-4 h-4" />
              Switch to Visual
            </>
          ) : (
            <>
              <ToggleLeft className="w-4 h-4" />
              Switch to Raw
            </>
          )}
        </button>
      </div>

      {value.rawMode ? (
        <div>
          <textarea
            value={localRaw}
            onChange={(e) => handleRawChange(e.target.value)}
            placeholder="e.g., tcp port 443 and host 192.168.1.1"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            rows={2}
          />
          {!value.isValid && value.parseError && (
            <p className="mt-1 text-xs text-danger-600">{value.parseError}</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {value.conditions.map((condition, index) => (
            <div key={condition.id}>
              {index > 0 && (
                <div className="flex justify-center my-2">
                  <select
                    value={value.operators[index - 1] || 'and'}
                    onChange={(e) => updateOperator(index - 1, e.target.value as FilterOperator)}
                    className="px-2 py-1 text-xs border border-slate-300 rounded bg-slate-50 font-medium"
                  >
                    <option value="and">AND</option>
                    <option value="or">OR</option>
                  </select>
                </div>
              )}
              <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={condition.enabled}
                  onChange={(e) => updateCondition(condition.id, { enabled: e.target.checked })}
                  className="rounded border-slate-300"
                />
                <select
                  value={condition.not ? 'not' : ''}
                  onChange={(e) => updateCondition(condition.id, { not: e.target.value === 'not' })}
                  className="px-2 py-1 text-sm border border-slate-300 rounded"
                >
                  <option value="">—</option>
                  <option value="not">NOT</option>
                </select>
                <select
                  value={condition.type}
                  onChange={(e) =>
                    updateCondition(condition.id, { type: e.target.value as FilterConditionType })
                  }
                  className="px-2 py-1 text-sm border border-slate-300 rounded"
                >
                  {CONDITION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>

                {condition.type === 'protocol' && (
                  <select
                    value={condition.protocol || ''}
                    onChange={(e) => updateCondition(condition.id, { protocol: e.target.value })}
                    className="px-2 py-1 text-sm border border-slate-300 rounded flex-1"
                  >
                    <option value="">Select...</option>
                    {PROTOCOLS.filter((p) => p.value).map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                )}

                {(condition.type === 'host' || condition.type === 'net') && (
                  <>
                    <select
                      value={condition.direction || 'src or dst'}
                      onChange={(e) =>
                        updateCondition(condition.id, { direction: e.target.value as FilterDirection })
                      }
                      className="px-2 py-1 text-sm border border-slate-300 rounded"
                    >
                      {DIRECTIONS.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={condition.type === 'host' ? condition.host || '' : condition.net || ''}
                      onChange={(e) =>
                        updateCondition(condition.id, {
                          [condition.type === 'host' ? 'host' : 'net']: e.target.value,
                        })
                      }
                      placeholder={condition.type === 'host' ? '192.168.1.1' : '192.168.1.0/24'}
                      className="px-2 py-1 text-sm border border-slate-300 rounded flex-1"
                    />
                  </>
                )}

                {condition.type === 'port' && (
                  <>
                    <select
                      value={condition.direction || 'src or dst'}
                      onChange={(e) =>
                        updateCondition(condition.id, { direction: e.target.value as FilterDirection })
                      }
                      className="px-2 py-1 text-sm border border-slate-300 rounded"
                    >
                      {DIRECTIONS.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={condition.port || ''}
                      onChange={(e) =>
                        updateCondition(condition.id, { port: parseInt(e.target.value) || undefined })
                      }
                      placeholder="443"
                      className="px-2 py-1 text-sm border border-slate-300 rounded w-24"
                    />
                  </>
                )}

                {condition.type === 'portrange' && (
                  <>
                    <select
                      value={condition.direction || 'src or dst'}
                      onChange={(e) =>
                        updateCondition(condition.id, { direction: e.target.value as FilterDirection })
                      }
                      className="px-2 py-1 text-sm border border-slate-300 rounded"
                    >
                      {DIRECTIONS.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={condition.port || ''}
                      onChange={(e) =>
                        updateCondition(condition.id, { port: parseInt(e.target.value) || undefined })
                      }
                      placeholder="80"
                      className="px-2 py-1 text-sm border border-slate-300 rounded w-20"
                    />
                    <span className="text-slate-500">-</span>
                    <input
                      type="number"
                      value={condition.portEnd || ''}
                      onChange={(e) =>
                        updateCondition(condition.id, { portEnd: parseInt(e.target.value) || undefined })
                      }
                      placeholder="443"
                      className="px-2 py-1 text-sm border border-slate-300 rounded w-20"
                    />
                  </>
                )}

                <button
                  onClick={() => removeCondition(condition.id)}
                  className="p-1 text-slate-400 hover:text-danger-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={addCondition}
            className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
          >
            <Plus className="w-4 h-4" />
            Add Condition
          </button>
        </div>
      )}

      {filterString && (
        <div className="p-2 bg-slate-100 rounded font-mono text-sm text-slate-700">
          Filter: <span className="text-primary-600">{filterString}</span>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/tools/CaptureBuilder/components/BpfFilterBuilder.tsx
git commit -m "feat(capture-builder): add BpfFilterBuilder component"
```

---

## Task 5: Create CheatSheet component

**Files:**
- Create: `src/components/tools/CaptureBuilder/components/CheatSheet.tsx`

**Step 1: Create CheatSheet.tsx**

```typescript
import { useState } from 'react';
import { ChevronDown, ChevronRight, BookOpen } from 'lucide-react';
import { CaptureTab } from '../types';

interface CheatSheetProps {
  activeTab: CaptureTab;
  onUseFilter?: (filter: string) => void;
}

interface CheatSheetItem {
  label: string;
  syntax: string;
  description: string;
}

const TCPDUMP_FILTERS: CheatSheetItem[] = [
  { label: 'Capture HTTP', syntax: 'tcp port 80', description: 'All HTTP traffic' },
  { label: 'Capture HTTPS', syntax: 'tcp port 443', description: 'All HTTPS traffic' },
  { label: 'Capture DNS', syntax: 'udp port 53', description: 'DNS queries and responses' },
  { label: 'Specific host', syntax: 'host 192.168.1.1', description: 'Traffic to/from host' },
  { label: 'Source only', syntax: 'src host 192.168.1.1', description: 'Traffic from host' },
  { label: 'Destination only', syntax: 'dst host 192.168.1.1', description: 'Traffic to host' },
  { label: 'Subnet', syntax: 'net 192.168.1.0/24', description: 'Traffic to/from subnet' },
  { label: 'Port range', syntax: 'portrange 80-443', description: 'Ports 80 through 443' },
  { label: 'ICMP only', syntax: 'icmp', description: 'Ping and ICMP messages' },
  { label: 'SYN packets', syntax: 'tcp[tcpflags] & tcp-syn != 0', description: 'TCP SYN flags' },
  { label: 'Exclude SSH', syntax: 'not port 22', description: 'Everything except SSH' },
  { label: 'VLAN tagged', syntax: 'vlan', description: 'VLAN tagged traffic' },
];

const TCPDUMP_FLAGS: CheatSheetItem[] = [
  { label: '-i any', syntax: '-i any', description: 'Capture on all interfaces' },
  { label: '-nn', syntax: '-nn', description: "Don't resolve hostnames or ports" },
  { label: '-vvv', syntax: '-vvv', description: 'Maximum verbosity' },
  { label: '-w file.pcap', syntax: '-w file.pcap', description: 'Write to file' },
  { label: '-c 100', syntax: '-c 100', description: 'Capture 100 packets then stop' },
  { label: '-s 0', syntax: '-s 0', description: 'Capture full packets' },
  { label: '-tttt', syntax: '-tttt', description: 'Human-readable timestamps' },
  { label: '-X', syntax: '-X', description: 'Show hex and ASCII' },
];

const FORTINET_TIPS: CheatSheetItem[] = [
  { label: 'Basic capture', syntax: "diag sniffer packet any 'host 1.1.1.1' 4", description: 'Capture with interface names' },
  { label: 'Verbose 6', syntax: '6', description: 'Include ethernet header' },
  { label: 'Filter syntax', syntax: "'tcp and port 443'", description: 'Use single quotes for filter' },
  { label: 'Count packets', syntax: '100', description: 'Stop after 100 packets' },
  { label: 'Debug flow', syntax: 'diag debug flow', description: 'Trace packet through policies' },
];

const PALOALTO_TIPS: CheatSheetItem[] = [
  { label: 'Set filter', syntax: 'debug dataplane packet-diag set filter match source 10.0.0.1', description: 'Configure capture filter' },
  { label: 'All stages', syntax: 'receive transmit drop firewall', description: 'Capture at all points' },
  { label: 'View counters', syntax: 'show counter global filter packet-filter yes', description: 'See packet filter matches' },
  { label: 'Clear filter', syntax: 'debug dataplane packet-diag clear filter-marked-session all', description: 'Reset capture' },
];

const ASA_TIPS: CheatSheetItem[] = [
  { label: 'Basic capture', syntax: 'capture cap1 interface inside match ip host 10.0.0.1 any', description: 'Inline match filter' },
  { label: 'Circular buffer', syntax: 'circular-buffer', description: 'Overwrite when full' },
  { label: 'ASP drops', syntax: 'capture asp-drop type asp-drop', description: 'Capture dropped packets' },
  { label: 'Export PCAP', syntax: 'copy /pcap capture:cap1 tftp://1.1.1.1/', description: 'Copy capture to TFTP' },
  { label: 'Show capture', syntax: 'show capture cap1', description: 'View capture contents' },
];

export default function CheatSheet({ activeTab, onUseFilter }: CheatSheetProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getContent = () => {
    switch (activeTab) {
      case 'tcpdump':
        return { filters: TCPDUMP_FILTERS, tips: TCPDUMP_FLAGS, title: 'tcpdump' };
      case 'fortinet':
        return { filters: [], tips: FORTINET_TIPS, title: 'Fortinet' };
      case 'paloalto':
        return { filters: [], tips: PALOALTO_TIPS, title: 'Palo Alto' };
      case 'cisco-asa':
        return { filters: [], tips: ASA_TIPS, title: 'Cisco ASA' };
    }
  };

  const content = getContent();

  return (
    <div className="card">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full card-header flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary-600" />
          <span className="font-semibold text-slate-900">Cheat Sheet - {content.title}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {isOpen && (
        <div className="card-body border-t border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {content.filters.length > 0 && (
              <div>
                <h4 className="font-medium text-slate-700 mb-3">Common Filters</h4>
                <div className="space-y-2">
                  {content.filters.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 bg-slate-50 rounded text-sm"
                    >
                      <div>
                        <code className="font-mono text-primary-600">{item.syntax}</code>
                        <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                      </div>
                      {onUseFilter && (
                        <button
                          onClick={() => onUseFilter(item.syntax)}
                          className="text-xs text-primary-600 hover:text-primary-700 px-2 py-1 bg-white rounded border border-slate-200"
                        >
                          Use
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="font-medium text-slate-700 mb-3">
                {activeTab === 'tcpdump' ? 'Common Flags' : 'Quick Reference'}
              </h4>
              <div className="space-y-2">
                {content.tips.map((item, i) => (
                  <div key={i} className="p-2 bg-slate-50 rounded text-sm">
                    <code className="font-mono text-primary-600">{item.syntax}</code>
                    <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/tools/CaptureBuilder/components/CheatSheet.tsx
git commit -m "feat(capture-builder): add CheatSheet component"
```

---

## Task 6: Create components index

**Files:**
- Create: `src/components/tools/CaptureBuilder/components/index.ts`

**Step 1: Create index.ts**

```typescript
export { default as BpfFilterBuilder } from './BpfFilterBuilder';
export { default as CommandOutput } from './CommandOutput';
export { default as CheatSheet } from './CheatSheet';
export { default as ValidationFeedback } from './ValidationFeedback';
```

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/tools/CaptureBuilder/components/index.ts
git commit -m "feat(capture-builder): add components index"
```

---

## Task 7: Create TcpdumpTab component

**Files:**
- Create: `src/components/tools/CaptureBuilder/tabs/TcpdumpTab.tsx`

**Step 1: Create TcpdumpTab.tsx**

```typescript
import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { BpfFilterBuilder, CommandOutput, ValidationFeedback } from '../components';
import {
  TcpdumpOptions,
  BpfFilterState,
  CommandStep,
  ValidationMessage,
} from '../types';
import { COMMON_INTERFACES, DEFAULT_TCPDUMP_OPTIONS, WARNINGS } from '../constants';

interface CollapsibleSectionProps {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({ title, summary, defaultOpen = true, children }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-slate-200 rounded-lg">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
          <span className="font-medium text-slate-900">{title}</span>
        </div>
        {!isOpen && summary && <span className="text-sm text-slate-500">{summary}</span>}
      </button>
      {isOpen && <div className="px-4 pb-4 space-y-4">{children}</div>}
    </div>
  );
}

export default function TcpdumpTab() {
  const [options, setOptions] = useState<TcpdumpOptions>(DEFAULT_TCPDUMP_OPTIONS);
  const [filter, setFilter] = useState<BpfFilterState>({
    conditions: [],
    operators: [],
    rawMode: false,
    rawFilter: '',
    isValid: true,
  });

  const updateOption = useCallback(<K extends keyof TcpdumpOptions>(key: K, value: TcpdumpOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  }, []);

  const interfaceValue = options.interface === 'custom' ? options.customInterface : options.interface;

  const filterString = useMemo(() => {
    if (filter.rawMode) return filter.rawFilter;
    const enabledConditions = filter.conditions.filter((c) => c.enabled);
    if (enabledConditions.length === 0) return '';
    // Build from visual
    const parts: string[] = [];
    enabledConditions.forEach((condition, index) => {
      let part = '';
      if (condition.not) part += 'not ';
      switch (condition.type) {
        case 'protocol':
          if (condition.protocol) part += condition.protocol;
          break;
        case 'host':
          if (condition.host) {
            if (condition.direction && condition.direction !== 'src or dst') {
              part += `${condition.direction} host ${condition.host}`;
            } else {
              part += `host ${condition.host}`;
            }
          }
          break;
        case 'port':
          if (condition.port) {
            if (condition.direction && condition.direction !== 'src or dst') {
              part += `${condition.direction} port ${condition.port}`;
            } else {
              part += `port ${condition.port}`;
            }
          }
          break;
        case 'net':
          if (condition.net) {
            if (condition.direction && condition.direction !== 'src or dst') {
              part += `${condition.direction} net ${condition.net}`;
            } else {
              part += `net ${condition.net}`;
            }
          }
          break;
        case 'portrange':
          if (condition.port && condition.portEnd) {
            if (condition.direction && condition.direction !== 'src or dst') {
              part += `${condition.direction} portrange ${condition.port}-${condition.portEnd}`;
            } else {
              part += `portrange ${condition.port}-${condition.portEnd}`;
            }
          }
          break;
      }
      if (part && part !== 'not ') {
        if (index > 0 && parts.length > 0) {
          const opIndex = Math.min(index - 1, filter.operators.length - 1);
          parts.push(filter.operators[opIndex] || 'and');
        }
        parts.push(part.trim());
      }
    });
    return parts.join(' ');
  }, [filter]);

  const validation = useMemo((): ValidationMessage[] => {
    const messages: ValidationMessage[] = [];

    if (!options.packetCount && !options.writeFile) {
      messages.push({ field: 'packetCount', message: WARNINGS.noPacketLimit, severity: 'warning' });
    }
    if (interfaceValue === 'any') {
      messages.push({ field: 'interface', message: WARNINGS.captureOnAny, severity: 'warning' });
    }
    if (!filterString) {
      messages.push({ field: 'filter', message: WARNINGS.noFilter, severity: 'warning' });
    }
    if (options.snaplen === '0') {
      messages.push({ field: 'snaplen', message: WARNINGS.fullSnaplen, severity: 'warning' });
    }

    return messages;
  }, [options, interfaceValue, filterString]);

  const commands = useMemo((): CommandStep[] => {
    const parts: string[] = ['tcpdump'];
    const flags: { flag: string; description: string }[] = [];

    // Interface
    parts.push(`-i ${interfaceValue}`);
    flags.push({ flag: `-i ${interfaceValue}`, description: `Capture on interface ${interfaceValue}` });

    // Name resolution
    if (options.noResolveHosts && options.noResolvePorts) {
      parts.push('-nn');
      flags.push({ flag: '-nn', description: "Don't resolve hostnames or port names" });
    } else if (options.noResolveHosts) {
      parts.push('-n');
      flags.push({ flag: '-n', description: "Don't resolve hostnames" });
    }

    // Verbosity
    if (options.verbosity) {
      parts.push(options.verbosity);
      flags.push({ flag: options.verbosity, description: `Verbosity level ${options.verbosity.length}` });
    }

    // Hex output
    if (options.hexOutput) {
      parts.push(options.hexOutput);
      const hexDesc: Record<string, string> = {
        '-x': 'Print hex (without ethernet header)',
        '-X': 'Print hex and ASCII',
        '-xx': 'Print hex (with ethernet header)',
        '-XX': 'Print hex and ASCII (with ethernet header)',
      };
      flags.push({ flag: options.hexOutput, description: hexDesc[options.hexOutput] });
    }

    // Timestamp
    if (options.timestamp) {
      parts.push(options.timestamp);
      const tsDesc: Record<string, string> = {
        '-t': "Don't print timestamp",
        '-tt': 'Print Unix timestamp',
        '-ttt': 'Print delta time',
        '-tttt': 'Print date and time',
        '-ttttt': 'Print delta since first packet',
      };
      flags.push({ flag: options.timestamp, description: tsDesc[options.timestamp] });
    }

    // Line buffered
    if (options.lineBuffered) {
      parts.push('-l');
      flags.push({ flag: '-l', description: 'Line-buffered output' });
    }

    // Print while writing
    if (options.printWhileWriting && options.writeFile) {
      parts.push('-U');
      flags.push({ flag: '-U', description: 'Write packets immediately to file' });
    }

    // Snaplen
    if (options.snaplen) {
      parts.push(`-s ${options.snaplen}`);
      flags.push({ flag: `-s ${options.snaplen}`, description: options.snaplen === '0' ? 'Capture full packets' : `Capture first ${options.snaplen} bytes` });
    }

    // Packet count
    if (options.packetCount) {
      parts.push(`-c ${options.packetCount}`);
      flags.push({ flag: `-c ${options.packetCount}`, description: `Stop after ${options.packetCount} packets` });
    }

    // Write file
    if (options.writeFile) {
      parts.push(`-w ${options.writeFile}`);
      flags.push({ flag: `-w ${options.writeFile}`, description: `Write to file ${options.writeFile}` });

      // File rotation
      if (options.rotateSize) {
        parts.push(`-C ${options.rotateSize}`);
        flags.push({ flag: `-C ${options.rotateSize}`, description: `Rotate file every ${options.rotateSize}MB` });
      }
      if (options.rotateSeconds) {
        parts.push(`-G ${options.rotateSeconds}`);
        flags.push({ flag: `-G ${options.rotateSeconds}`, description: `Rotate file every ${options.rotateSeconds} seconds` });
      }
      if (options.rotateCount) {
        parts.push(`-W ${options.rotateCount}`);
        flags.push({ flag: `-W ${options.rotateCount}`, description: `Keep ${options.rotateCount} rotated files` });
      }
    }

    // Read file
    if (options.readFile) {
      parts.push(`-r ${options.readFile}`);
      flags.push({ flag: `-r ${options.readFile}`, description: `Read from file ${options.readFile}` });
    }

    // Filter
    if (filterString) {
      parts.push(`'${filterString}'`);
      flags.push({ flag: `'${filterString}'`, description: 'BPF filter expression' });
    }

    const steps: CommandStep[] = [
      {
        step: 1,
        title: 'Start capture',
        command: parts.join(' '),
        explanation: options.writeFile
          ? `Capture packets and write to ${options.writeFile}`
          : 'Capture packets and display to terminal',
        flags,
      },
      {
        step: 2,
        title: 'Stop capture',
        command: 'Ctrl+C',
        explanation: 'Press Ctrl+C to stop the capture',
      },
    ];

    return steps;
  }, [options, interfaceValue, filterString]);

  return (
    <div className="space-y-4">
      <ValidationFeedback messages={validation} />

      <CollapsibleSection
        title="Interface & Basic Options"
        summary={`${interfaceValue}${options.packetCount ? `, ${options.packetCount} packets` : ''}`}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Interface</label>
            <select
              value={options.interface}
              onChange={(e) => updateOption('interface', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            >
              {COMMON_INTERFACES.map((iface) => (
                <option key={iface.value} value={iface.value}>
                  {iface.label}
                </option>
              ))}
              <option value="custom">Custom...</option>
            </select>
            {options.interface === 'custom' && (
              <input
                type="text"
                value={options.customInterface}
                onChange={(e) => updateOption('customInterface', e.target.value)}
                placeholder="Enter interface name"
                className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Packet Count (-c)</label>
            <input
              type="number"
              value={options.packetCount}
              onChange={(e) => updateOption('packetCount', e.target.value)}
              placeholder="Unlimited"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Snaplen (-s)</label>
            <input
              type="number"
              value={options.snaplen}
              onChange={(e) => updateOption('snaplen', e.target.value)}
              placeholder="262144 (default)"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
            <p className="text-xs text-slate-500 mt-1">0 = capture full packets</p>
          </div>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.noResolveHosts}
                onChange={(e) => updateOption('noResolveHosts', e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">Don't resolve hostnames (-n)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.noResolvePorts}
                onChange={(e) => updateOption('noResolvePorts', e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">Don't resolve ports (-nn)</span>
            </label>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Verbosity & Display"
        summary={[options.verbosity, options.hexOutput].filter(Boolean).join(', ') || 'Default'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Verbosity</label>
            <div className="flex flex-wrap gap-2">
              {(['', '-v', '-vv', '-vvv'] as const).map((v) => (
                <button
                  key={v || 'normal'}
                  onClick={() => updateOption('verbosity', v)}
                  className={`px-3 py-1.5 text-sm rounded-lg border ${
                    options.verbosity === v
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {v || 'Normal'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Hex Output</label>
            <div className="flex flex-wrap gap-2">
              {(['', '-x', '-X', '-xx', '-XX'] as const).map((h) => (
                <button
                  key={h || 'none'}
                  onClick={() => updateOption('hexOutput', h)}
                  className={`px-3 py-1.5 text-sm rounded-lg border ${
                    options.hexOutput === h
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {h || 'None'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.lineBuffered}
                onChange={(e) => updateOption('lineBuffered', e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">Line buffered (-l)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.printWhileWriting}
                onChange={(e) => updateOption('printWhileWriting', e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">Print while writing (-U)</span>
            </label>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Timestamp Format"
        summary={options.timestamp || 'Default'}
      >
        <div className="flex flex-wrap gap-2">
          {([
            { value: '', label: 'Default' },
            { value: '-t', label: '-t (none)' },
            { value: '-tt', label: '-tt (unix)' },
            { value: '-ttt', label: '-ttt (delta)' },
            { value: '-tttt', label: '-tttt (date+time)' },
            { value: '-ttttt', label: '-ttttt (delta from first)' },
          ] as const).map((ts) => (
            <button
              key={ts.value || 'default'}
              onClick={() => updateOption('timestamp', ts.value)}
              className={`px-3 py-1.5 text-sm rounded-lg border ${
                options.timestamp === ts.value
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {ts.label}
            </button>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Output & File Options"
        summary={options.writeFile || options.readFile || 'Not configured'}
        defaultOpen={false}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Write to file (-w)</label>
            <input
              type="text"
              value={options.writeFile}
              onChange={(e) => updateOption('writeFile', e.target.value)}
              placeholder="capture.pcap"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Read from file (-r)</label>
            <input
              type="text"
              value={options.readFile}
              onChange={(e) => updateOption('readFile', e.target.value)}
              placeholder="existing.pcap"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
        </div>
        {options.writeFile && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <h4 className="text-sm font-medium text-slate-700 mb-3">File Rotation</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Size MB (-C)</label>
                <input
                  type="number"
                  value={options.rotateSize}
                  onChange={(e) => updateOption('rotateSize', e.target.value)}
                  placeholder="100"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Seconds (-G)</label>
                <input
                  type="number"
                  value={options.rotateSeconds}
                  onChange={(e) => updateOption('rotateSeconds', e.target.value)}
                  placeholder="3600"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">File count (-W)</label>
                <input
                  type="number"
                  value={options.rotateCount}
                  onChange={(e) => updateOption('rotateCount', e.target.value)}
                  placeholder="10"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="BPF Filter" summary={filterString || 'No filter'}>
        <BpfFilterBuilder value={filter} onChange={setFilter} />
      </CollapsibleSection>

      <CommandOutput steps={commands} />
    </div>
  );
}
```

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/tools/CaptureBuilder/tabs/TcpdumpTab.tsx
git commit -m "feat(capture-builder): add TcpdumpTab component"
```

---

## Task 8: Create FortinetTab component

**Files:**
- Create: `src/components/tools/CaptureBuilder/tabs/FortinetTab.tsx`

**Step 1: Create FortinetTab.tsx**

```typescript
import { useState, useMemo, useCallback } from 'react';
import { BpfFilterBuilder, CommandOutput, ValidationFeedback } from '../components';
import {
  FortinetOptions,
  BpfFilterState,
  CommandStep,
  ValidationMessage,
} from '../types';
import { FORTINET_INTERFACES, DEFAULT_FORTINET_OPTIONS, WARNINGS } from '../constants';

export default function FortinetTab() {
  const [options, setOptions] = useState<FortinetOptions>(DEFAULT_FORTINET_OPTIONS);
  const [filter, setFilter] = useState<BpfFilterState>({
    conditions: [],
    operators: [],
    rawMode: false,
    rawFilter: '',
    isValid: true,
  });

  const updateOption = useCallback(<K extends keyof FortinetOptions>(key: K, value: FortinetOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  }, []);

  const interfaceValue = options.interface === 'custom' ? options.customInterface : options.interface;

  const filterString = useMemo(() => {
    if (filter.rawMode) return filter.rawFilter;
    const enabledConditions = filter.conditions.filter((c) => c.enabled);
    if (enabledConditions.length === 0) return '';
    const parts: string[] = [];
    enabledConditions.forEach((condition, index) => {
      let part = '';
      if (condition.not) part += 'not ';
      switch (condition.type) {
        case 'protocol':
          if (condition.protocol) part += condition.protocol;
          break;
        case 'host':
          if (condition.host) {
            if (condition.direction && condition.direction !== 'src or dst') {
              part += `${condition.direction} host ${condition.host}`;
            } else {
              part += `host ${condition.host}`;
            }
          }
          break;
        case 'port':
          if (condition.port) {
            if (condition.direction && condition.direction !== 'src or dst') {
              part += `${condition.direction} port ${condition.port}`;
            } else {
              part += `port ${condition.port}`;
            }
          }
          break;
        case 'net':
          if (condition.net) {
            if (condition.direction && condition.direction !== 'src or dst') {
              part += `${condition.direction} net ${condition.net}`;
            } else {
              part += `net ${condition.net}`;
            }
          }
          break;
        case 'portrange':
          if (condition.port && condition.portEnd) {
            if (condition.direction && condition.direction !== 'src or dst') {
              part += `${condition.direction} portrange ${condition.port}-${condition.portEnd}`;
            } else {
              part += `portrange ${condition.port}-${condition.portEnd}`;
            }
          }
          break;
      }
      if (part && part !== 'not ') {
        if (index > 0 && parts.length > 0) {
          const opIndex = Math.min(index - 1, filter.operators.length - 1);
          parts.push(filter.operators[opIndex] || 'and');
        }
        parts.push(part.trim());
      }
    });
    return parts.join(' ');
  }, [filter]);

  const validation = useMemo((): ValidationMessage[] => {
    const messages: ValidationMessage[] = [];

    if (options.packetCount === '0') {
      messages.push({ field: 'packetCount', message: WARNINGS.noPacketLimit, severity: 'warning' });
    }
    if (interfaceValue === 'any') {
      messages.push({ field: 'interface', message: WARNINGS.captureOnAny, severity: 'warning' });
    }
    if (!filterString) {
      messages.push({ field: 'filter', message: WARNINGS.noFilter, severity: 'warning' });
    }

    return messages;
  }, [options, interfaceValue, filterString]);

  const commands = useMemo((): CommandStep[] => {
    const steps: CommandStep[] = [];
    let stepNum = 1;

    // Main sniffer command
    const filterPart = filterString ? `'${filterString}'` : 'none';
    const timestampFlag = options.absoluteTimestamp ? 'a' : '';

    const snifferCmd = `diagnose sniffer packet ${interfaceValue} ${filterPart} ${options.verbosity} ${options.packetCount} ${timestampFlag}`.trim();

    steps.push({
      step: stepNum++,
      title: 'Start packet capture',
      command: snifferCmd,
      explanation: `Capture packets on ${interfaceValue} with verbosity ${options.verbosity}`,
      flags: [
        { flag: interfaceValue, description: 'Interface to capture on' },
        { flag: filterPart, description: 'BPF filter (none = all traffic)' },
        { flag: options.verbosity, description: `Verbosity 1-6 (${options.verbosity} selected)` },
        { flag: options.packetCount, description: options.packetCount === '0' ? 'Unlimited packets' : `Stop after ${options.packetCount} packets` },
        ...(timestampFlag ? [{ flag: 'a', description: 'Show absolute timestamp' }] : []),
      ],
    });

    // Debug flow commands if enabled
    if (options.debugFlowEnabled) {
      steps.push({
        step: stepNum++,
        title: 'Enable debug output',
        command: 'diagnose debug enable',
        explanation: 'Enable debug console output',
      });

      if (options.debugFlowAddress) {
        steps.push({
          step: stepNum++,
          title: 'Set flow filter',
          command: `diagnose debug flow filter addr ${options.debugFlowAddress}`,
          explanation: `Filter debug flow to address ${options.debugFlowAddress}`,
        });
      }

      const traceCmd = options.debugFlowVerbose
        ? 'diagnose debug flow trace start 100'
        : 'diagnose debug flow trace start 20';

      steps.push({
        step: stepNum++,
        title: 'Start flow trace',
        command: traceCmd,
        explanation: 'Start tracing packet flow through FortiGate',
      });
    }

    // Stop commands
    steps.push({
      step: stepNum++,
      title: 'Stop capture',
      command: 'Ctrl+C (or wait for packet count)',
      explanation: 'Press Ctrl+C to stop the capture',
    });

    if (options.debugFlowEnabled) {
      steps.push({
        step: stepNum++,
        title: 'Disable debug',
        command: 'diagnose debug disable',
        explanation: 'Disable debug output',
      });
    }

    return steps;
  }, [options, interfaceValue, filterString]);

  return (
    <div className="space-y-6">
      <ValidationFeedback messages={validation} />

      {/* Packet Sniffer Section */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-slate-900">Packet Sniffer</h3>
        </div>
        <div className="card-body space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Interface</label>
              <select
                value={options.interface}
                onChange={(e) => updateOption('interface', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                {FORTINET_INTERFACES.map((iface) => (
                  <option key={iface.value} value={iface.value}>
                    {iface.label}
                  </option>
                ))}
                <option value="custom">Custom...</option>
              </select>
              {options.interface === 'custom' && (
                <input
                  type="text"
                  value={options.customInterface}
                  onChange={(e) => updateOption('customInterface', e.target.value)}
                  placeholder="Enter interface name"
                  className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Packet Count</label>
              <input
                type="number"
                value={options.packetCount}
                onChange={(e) => updateOption('packetCount', e.target.value)}
                placeholder="0 = unlimited"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Verbosity Level</label>
            <div className="flex flex-wrap gap-2">
              {(['1', '2', '3', '4', '5', '6'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => updateOption('verbosity', v)}
                  className={`px-3 py-1.5 text-sm rounded-lg border ${
                    options.verbosity === v
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              1=headers, 2=+data, 3=+hex, 4=+interface, 5=+timestamp, 6=+ether header
            </p>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.absoluteTimestamp}
              onChange={(e) => updateOption('absoluteTimestamp', e.target.checked)}
              className="rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">Show absolute timestamp (a)</span>
          </label>

          <BpfFilterBuilder value={filter} onChange={setFilter} />
        </div>
      </div>

      {/* Debug Flow Section */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Debug Flow (Policy Tracing)</h3>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.debugFlowEnabled}
              onChange={(e) => updateOption('debugFlowEnabled', e.target.checked)}
              className="rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">Enable</span>
          </label>
        </div>
        {options.debugFlowEnabled && (
          <div className="card-body space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Address Filter</label>
              <input
                type="text"
                value={options.debugFlowAddress}
                onChange={(e) => updateOption('debugFlowAddress', e.target.value)}
                placeholder="10.0.0.1 (optional)"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.debugFlowVerbose}
                onChange={(e) => updateOption('debugFlowVerbose', e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">Verbose output (100 packets vs 20)</span>
            </label>
          </div>
        )}
      </div>

      <CommandOutput steps={commands} />
    </div>
  );
}
```

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/tools/CaptureBuilder/tabs/FortinetTab.tsx
git commit -m "feat(capture-builder): add FortinetTab component"
```

---

## Task 9: Create PaloAltoTab component

**Files:**
- Create: `src/components/tools/CaptureBuilder/tabs/PaloAltoTab.tsx`

**Step 1: Create PaloAltoTab.tsx**

```typescript
import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CommandOutput, ValidationFeedback } from '../components';
import {
  PaloAltoOptions,
  CommandStep,
  ValidationMessage,
} from '../types';
import { PALOALTO_PROTOCOLS, DEFAULT_PALOALTO_OPTIONS, WARNINGS } from '../constants';

export default function PaloAltoTab() {
  const [options, setOptions] = useState<PaloAltoOptions>(DEFAULT_PALOALTO_OPTIONS);
  const [showGuiSteps, setShowGuiSteps] = useState(false);

  const updateOption = useCallback(<K extends keyof PaloAltoOptions>(key: K, value: PaloAltoOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  }, []);

  const validation = useMemo((): ValidationMessage[] => {
    const messages: ValidationMessage[] = [];

    if (!options.filterName) {
      messages.push({ field: 'filterName', message: 'Filter name is required', severity: 'error' });
    }
    if (!options.sourceIp && !options.destIp) {
      messages.push({ field: 'filter', message: WARNINGS.noFilter, severity: 'warning' });
    }

    return messages;
  }, [options]);

  const hasErrors = validation.some((v) => v.severity === 'error');

  const commands = useMemo((): CommandStep[] => {
    if (hasErrors) return [];

    const steps: CommandStep[] = [];
    let stepNum = 1;

    // Build filter command
    const filterParts: string[] = ['debug dataplane packet-diag set filter match'];
    if (options.sourceIp) filterParts.push(`source ${options.sourceIp}`);
    if (options.destIp) filterParts.push(`destination ${options.destIp}`);
    if (options.sourcePort) filterParts.push(`source-port ${options.sourcePort}`);
    if (options.destPort) filterParts.push(`destination-port ${options.destPort}`);
    if (options.protocol) filterParts.push(`protocol ${options.protocol}`);

    if (filterParts.length > 1) {
      steps.push({
        step: stepNum++,
        title: 'Set capture filter',
        command: filterParts.join(' '),
        explanation: 'Configure the packet filter criteria',
      });
    }

    // Build capture stages
    const stages: string[] = [];
    if (options.stageReceive) stages.push('receive');
    if (options.stageTransmit) stages.push('transmit');
    if (options.stageDrop) stages.push('drop');
    if (options.stageFirewall) stages.push('firewall');

    const captureCmd = `debug dataplane packet-diag set capture stage ${stages.join(' ')} file ${options.fileName}`;
    steps.push({
      step: stepNum++,
      title: 'Configure capture',
      command: captureCmd,
      explanation: `Set capture stages and output file (${options.fileName})`,
    });

    // Start capture
    steps.push({
      step: stepNum++,
      title: 'Start capture',
      command: 'debug dataplane packet-diag set capture on',
      explanation: 'Begin capturing packets',
    });

    // Stop capture
    steps.push({
      step: stepNum++,
      title: 'Stop capture',
      command: 'debug dataplane packet-diag set capture off',
      explanation: 'Stop capturing packets',
    });

    // View/export capture
    steps.push({
      step: stepNum++,
      title: 'View capture',
      command: `debug dataplane packet-diag show capture-file ${options.fileName}`,
      explanation: 'Display captured packets',
    });

    // Optional commands
    if (options.includeCounters) {
      steps.push({
        step: stepNum++,
        title: 'Check counters',
        command: 'show counter global filter packet-filter yes',
        explanation: 'View packet filter match counters',
      });
    }

    if (options.includeSessions) {
      const sessionParts: string[] = ['show session all filter'];
      if (options.sourceIp) sessionParts.push(`source ${options.sourceIp}`);
      if (options.destIp) sessionParts.push(`destination ${options.destIp}`);

      steps.push({
        step: stepNum++,
        title: 'View sessions',
        command: sessionParts.join(' '),
        explanation: 'Display matching sessions',
      });
    }

    // Clear filter
    steps.push({
      step: stepNum++,
      title: 'Clear filter (cleanup)',
      command: 'debug dataplane packet-diag clear filter-marked-session all',
      explanation: 'Reset capture filter when done',
    });

    return steps;
  }, [options, hasErrors]);

  const guiSteps = [
    { step: 1, text: 'Navigate to Monitor > Packet Capture' },
    { step: 2, text: 'Click "Add" to create a new capture' },
    { step: 3, text: `Enter filter name: ${options.filterName || '<name>'}` },
    { step: 4, text: `Configure filter: ${options.sourceIp ? `Source IP: ${options.sourceIp}` : ''} ${options.destIp ? `Dest IP: ${options.destIp}` : ''}`.trim() || 'Set source/destination criteria' },
    { step: 5, text: `Select stages: ${[options.stageReceive && 'Receive', options.stageTransmit && 'Transmit', options.stageDrop && 'Drop', options.stageFirewall && 'Firewall'].filter(Boolean).join(', ') || 'Select capture points'}` },
    { step: 6, text: 'Click "Start" to begin capture' },
    { step: 7, text: 'Click "Stop" when done, then "Export" to download PCAP' },
  ];

  return (
    <div className="space-y-6">
      <ValidationFeedback messages={validation} />

      {/* Capture Filter Section */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-slate-900">Capture Filter</h3>
        </div>
        <div className="card-body space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Filter Name *</label>
            <input
              type="text"
              value={options.filterName}
              onChange={(e) => updateOption('filterName', e.target.value)}
              placeholder="capture1"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Source IP</label>
              <input
                type="text"
                value={options.sourceIp}
                onChange={(e) => updateOption('sourceIp', e.target.value)}
                placeholder="10.0.0.1"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Destination IP</label>
              <input
                type="text"
                value={options.destIp}
                onChange={(e) => updateOption('destIp', e.target.value)}
                placeholder="10.0.0.2"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Source Port</label>
              <input
                type="number"
                value={options.sourcePort}
                onChange={(e) => updateOption('sourcePort', e.target.value)}
                placeholder="Any"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Destination Port</label>
              <input
                type="number"
                value={options.destPort}
                onChange={(e) => updateOption('destPort', e.target.value)}
                placeholder="443"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Protocol</label>
              <select
                value={options.protocol}
                onChange={(e) => updateOption('protocol', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                {PALOALTO_PROTOCOLS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">File Name</label>
              <input
                type="text"
                value={options.fileName}
                onChange={(e) => updateOption('fileName', e.target.value)}
                placeholder="capture.pcap"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Capture Stages */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-slate-900">Capture Stages</h3>
        </div>
        <div className="card-body">
          <div className="flex flex-wrap gap-4">
            {[
              { key: 'stageReceive', label: 'Receive' },
              { key: 'stageTransmit', label: 'Transmit' },
              { key: 'stageDrop', label: 'Drop' },
              { key: 'stageFirewall', label: 'Firewall' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={options[key as keyof PaloAltoOptions] as boolean}
                  onChange={(e) => updateOption(key as keyof PaloAltoOptions, e.target.checked as never)}
                  className="rounded border-slate-300"
                />
                <span className="text-sm text-slate-700">{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Troubleshooting Commands */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-slate-900">Include Additional Commands</h3>
        </div>
        <div className="card-body">
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.includeCounters}
                onChange={(e) => updateOption('includeCounters', e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">Show counter global filter</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.includeSessions}
                onChange={(e) => updateOption('includeSessions', e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">Show session all filter</span>
            </label>
          </div>
        </div>
      </div>

      {/* GUI Steps */}
      <div className="card">
        <button
          onClick={() => setShowGuiSteps(!showGuiSteps)}
          className="w-full card-header flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <h3 className="font-semibold text-slate-900">GUI Steps</h3>
          {showGuiSteps ? (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-400" />
          )}
        </button>
        {showGuiSteps && (
          <div className="card-body border-t border-slate-200">
            <ol className="space-y-2">
              {guiSteps.map((step) => (
                <li key={step.step} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-sm font-medium">
                    {step.step}
                  </span>
                  <span className="text-sm text-slate-700">{step.text}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <CommandOutput steps={commands} />
    </div>
  );
}
```

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/tools/CaptureBuilder/tabs/PaloAltoTab.tsx
git commit -m "feat(capture-builder): add PaloAltoTab component"
```

---

## Task 10: Create CiscoAsaTab component

**Files:**
- Create: `src/components/tools/CaptureBuilder/tabs/CiscoAsaTab.tsx`

**Step 1: Create CiscoAsaTab.tsx**

```typescript
import { useState, useMemo, useCallback } from 'react';
import { CommandOutput, ValidationFeedback } from '../components';
import {
  CiscoAsaOptions,
  CommandStep,
  ValidationMessage,
} from '../types';
import { ASA_INTERFACES, PROTOCOLS, DEFAULT_CISCOASA_OPTIONS, WARNINGS } from '../constants';

export default function CiscoAsaTab() {
  const [options, setOptions] = useState<CiscoAsaOptions>(DEFAULT_CISCOASA_OPTIONS);

  const updateOption = useCallback(<K extends keyof CiscoAsaOptions>(key: K, value: CiscoAsaOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  }, []);

  const interfaceValue = options.interface === 'custom' ? options.customInterface : options.interface;

  const validation = useMemo((): ValidationMessage[] => {
    const messages: ValidationMessage[] = [];

    if (!options.captureName) {
      messages.push({ field: 'captureName', message: 'Capture name is required', severity: 'error' });
    }
    if (!interfaceValue) {
      messages.push({ field: 'interface', message: 'Interface is required', severity: 'error' });
    }
    if (!options.accessList && !options.sourceIp && !options.destIp) {
      messages.push({ field: 'filter', message: WARNINGS.noFilter, severity: 'warning' });
    }
    if (options.bufferSize && parseInt(options.bufferSize) > 33554432) {
      messages.push({ field: 'bufferSize', message: WARNINGS.largeBuffer, severity: 'warning' });
    }

    return messages;
  }, [options, interfaceValue]);

  const hasErrors = validation.some((v) => v.severity === 'error');

  const commands = useMemo((): CommandStep[] => {
    if (hasErrors) return [];

    const steps: CommandStep[] = [];
    let stepNum = 1;

    // Build capture command
    const captureParts: string[] = [`capture ${options.captureName}`];

    // Capture type
    if (options.captureType !== 'raw-data') {
      captureParts.push(`type ${options.captureType}`);
    }

    // Interface
    captureParts.push(`interface ${interfaceValue}`);

    // Access list or inline match
    if (options.accessList) {
      captureParts.push(`access-list ${options.accessList}`);
    } else if (options.sourceIp || options.destIp) {
      const matchParts: string[] = ['match'];
      matchParts.push(options.protocol || 'ip');

      if (options.sourceIp) {
        matchParts.push(`host ${options.sourceIp}`);
      } else {
        matchParts.push('any');
      }

      if (options.destIp) {
        matchParts.push(`host ${options.destIp}`);
      } else {
        matchParts.push('any');
      }

      if (options.port && options.protocol && ['tcp', 'udp'].includes(options.protocol)) {
        matchParts.push(`${options.portOperator} ${options.port}`);
      }

      captureParts.push(matchParts.join(' '));
    }

    // Buffer and limits
    if (options.bufferSize) {
      captureParts.push(`buffer ${options.bufferSize}`);
    }
    if (options.packetLength) {
      captureParts.push(`packet-length ${options.packetLength}`);
    }
    if (options.circularBuffer) {
      captureParts.push('circular-buffer');
    }

    steps.push({
      step: stepNum++,
      title: 'Create capture',
      command: captureParts.join(' '),
      explanation: `Start capturing on ${interfaceValue}`,
    });

    // Show capture
    if (options.includeShowCapture) {
      steps.push({
        step: stepNum++,
        title: 'View capture',
        command: `show capture ${options.captureName}`,
        explanation: 'Display captured packets',
      });
    }

    // Show conn
    if (options.includeShowConn) {
      const connParts: string[] = ['show conn'];
      if (options.sourceIp) connParts.push(`address ${options.sourceIp}`);

      steps.push({
        step: stepNum++,
        title: 'View connections',
        command: connParts.join(' '),
        explanation: 'Display connection table',
      });
    }

    // Packet tracer
    if (options.includePacketTracer && options.packetTracerSourceIp && options.packetTracerDestIp) {
      const ptParts = [
        'packet-tracer input',
        interfaceValue,
        options.packetTracerProtocol,
        options.packetTracerSourceIp,
        options.packetTracerSourcePort || '12345',
        options.packetTracerDestIp,
        options.packetTracerDestPort || '443',
      ];

      steps.push({
        step: stepNum++,
        title: 'Trace packet',
        command: ptParts.join(' '),
        explanation: 'Simulate packet through ASA',
      });
    }

    // Export
    steps.push({
      step: stepNum++,
      title: 'Export capture',
      command: `copy /pcap capture:${options.captureName} tftp://SERVER_IP/${options.captureName}.pcap`,
      explanation: 'Copy capture to TFTP server (replace SERVER_IP)',
    });

    // Cleanup
    steps.push({
      step: stepNum++,
      title: 'Remove capture (cleanup)',
      command: `no capture ${options.captureName}`,
      explanation: 'Delete capture when done',
    });

    return steps;
  }, [options, interfaceValue, hasErrors]);

  return (
    <div className="space-y-6">
      <ValidationFeedback messages={validation} />

      {/* Capture Settings */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-slate-900">Capture Settings</h3>
        </div>
        <div className="card-body space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Capture Name *</label>
              <input
                type="text"
                value={options.captureName}
                onChange={(e) => updateOption('captureName', e.target.value)}
                placeholder="capture1"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Interface *</label>
              <select
                value={options.interface}
                onChange={(e) => updateOption('interface', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                {ASA_INTERFACES.map((iface) => (
                  <option key={iface.value} value={iface.value}>
                    {iface.label}
                  </option>
                ))}
                <option value="custom">Custom...</option>
              </select>
              {options.interface === 'custom' && (
                <input
                  type="text"
                  value={options.customInterface}
                  onChange={(e) => updateOption('customInterface', e.target.value)}
                  placeholder="Enter interface name"
                  className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Capture Type</label>
              <select
                value={options.captureType}
                onChange={(e) => updateOption('captureType', e.target.value as CiscoAsaOptions['captureType'])}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="raw-data">raw-data (default)</option>
                <option value="asp-drop">asp-drop (dropped packets)</option>
                <option value="isakmp">isakmp (VPN)</option>
                <option value="webvpn">webvpn</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Direction</label>
              <select
                value={options.direction}
                onChange={(e) => updateOption('direction', e.target.value as CiscoAsaOptions['direction'])}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="both">Both</option>
                <option value="ingress">Ingress only</option>
                <option value="egress">Egress only</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Options */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-slate-900">Filter Options</h3>
        </div>
        <div className="card-body space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Access List (if pre-defined)</label>
            <input
              type="text"
              value={options.accessList}
              onChange={(e) => updateOption('accessList', e.target.value)}
              placeholder="ACL-CAPTURE"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
            <p className="text-xs text-slate-500 mt-1">Leave blank to use inline match below</p>
          </div>

          {!options.accessList && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Protocol</label>
                <select
                  value={options.protocol}
                  onChange={(e) => updateOption('protocol', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  {PROTOCOLS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Port</label>
                <div className="flex gap-2">
                  <select
                    value={options.portOperator}
                    onChange={(e) => updateOption('portOperator', e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="eq">eq</option>
                    <option value="gt">gt</option>
                    <option value="lt">lt</option>
                    <option value="neq">neq</option>
                  </select>
                  <input
                    type="number"
                    value={options.port}
                    onChange={(e) => updateOption('port', e.target.value)}
                    placeholder="443"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Source IP</label>
                <input
                  type="text"
                  value={options.sourceIp}
                  onChange={(e) => updateOption('sourceIp', e.target.value)}
                  placeholder="10.0.0.1"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Destination IP</label>
                <input
                  type="text"
                  value={options.destIp}
                  onChange={(e) => updateOption('destIp', e.target.value)}
                  placeholder="10.0.0.2"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Capture Limits */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-slate-900">Capture Limits</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Buffer Size (bytes)</label>
              <input
                type="number"
                value={options.bufferSize}
                onChange={(e) => updateOption('bufferSize', e.target.value)}
                placeholder="512000"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Packet Length</label>
              <input
                type="number"
                value={options.packetLength}
                onChange={(e) => updateOption('packetLength', e.target.value)}
                placeholder="1518"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={options.circularBuffer}
                  onChange={(e) => updateOption('circularBuffer', e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span className="text-sm text-slate-700">Circular buffer</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Troubleshooting Commands */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-slate-900">Include Additional Commands</h3>
        </div>
        <div className="card-body space-y-4">
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.includeShowCapture}
                onChange={(e) => updateOption('includeShowCapture', e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">show capture</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.includeShowConn}
                onChange={(e) => updateOption('includeShowConn', e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">show conn</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.includePacketTracer}
                onChange={(e) => updateOption('includePacketTracer', e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">packet-tracer</span>
            </label>
          </div>

          {options.includePacketTracer && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Protocol</label>
                <select
                  value={options.packetTracerProtocol}
                  onChange={(e) => updateOption('packetTracerProtocol', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="tcp">TCP</option>
                  <option value="udp">UDP</option>
                  <option value="icmp">ICMP</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Source IP</label>
                <input
                  type="text"
                  value={options.packetTracerSourceIp}
                  onChange={(e) => updateOption('packetTracerSourceIp', e.target.value)}
                  placeholder="10.0.0.1"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Source Port</label>
                <input
                  type="number"
                  value={options.packetTracerSourcePort}
                  onChange={(e) => updateOption('packetTracerSourcePort', e.target.value)}
                  placeholder="12345"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Destination IP</label>
                <input
                  type="text"
                  value={options.packetTracerDestIp}
                  onChange={(e) => updateOption('packetTracerDestIp', e.target.value)}
                  placeholder="10.0.0.2"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Destination Port</label>
                <input
                  type="number"
                  value={options.packetTracerDestPort}
                  onChange={(e) => updateOption('packetTracerDestPort', e.target.value)}
                  placeholder="443"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <CommandOutput steps={commands} />
    </div>
  );
}
```

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/tools/CaptureBuilder/tabs/CiscoAsaTab.tsx
git commit -m "feat(capture-builder): add CiscoAsaTab component"
```

---

## Task 11: Create tabs index

**Files:**
- Create: `src/components/tools/CaptureBuilder/tabs/index.ts`

**Step 1: Create index.ts**

```typescript
export { default as TcpdumpTab } from './TcpdumpTab';
export { default as FortinetTab } from './FortinetTab';
export { default as PaloAltoTab } from './PaloAltoTab';
export { default as CiscoAsaTab } from './CiscoAsaTab';
```

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/tools/CaptureBuilder/tabs/index.ts
git commit -m "feat(capture-builder): add tabs index"
```

---

## Task 12: Create main CaptureBuilder component

**Files:**
- Create: `src/components/tools/CaptureBuilder/index.tsx`

**Step 1: Create index.tsx**

```typescript
import { useState, useCallback } from 'react';
import { Terminal, Shield, Server, Database } from 'lucide-react';
import { TcpdumpTab, FortinetTab, PaloAltoTab, CiscoAsaTab } from './tabs';
import { CheatSheet } from './components';
import { CaptureTab } from './types';

const TABS: { id: CaptureTab; label: string; icon: typeof Terminal }[] = [
  { id: 'tcpdump', label: 'Linux tcpdump', icon: Terminal },
  { id: 'fortinet', label: 'Fortinet', icon: Shield },
  { id: 'paloalto', label: 'Palo Alto', icon: Server },
  { id: 'cisco-asa', label: 'Cisco ASA', icon: Database },
];

export default function CaptureBuilder() {
  const [activeTab, setActiveTab] = useState<CaptureTab>('tcpdump');

  const handleUseFilter = useCallback((filter: string) => {
    // This would need to be wired up to the current tab's filter state
    console.log('Use filter:', filter);
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Capture Builder</h1>
        <p className="mt-1 text-slate-600">
          Generate packet capture commands for tcpdump and network devices
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-4" aria-label="Tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Cheat Sheet */}
      <CheatSheet activeTab={activeTab} onUseFilter={handleUseFilter} />

      {/* Tab Content */}
      <div>
        {activeTab === 'tcpdump' && <TcpdumpTab />}
        {activeTab === 'fortinet' && <FortinetTab />}
        {activeTab === 'paloalto' && <PaloAltoTab />}
        {activeTab === 'cisco-asa' && <CiscoAsaTab />}
      </div>
    </div>
  );
}
```

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/tools/CaptureBuilder/index.tsx
git commit -m "feat(capture-builder): add main CaptureBuilder component"
```

---

## Task 13: Integrate into app

**Files:**
- Modify: `src/components/tools/index.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Dashboard.tsx`

**Step 1: Update tools index**

Add to `src/components/tools/index.ts`:

```typescript
export { default as PcapAnalyzer } from './PcapAnalyzer'
export { default as DnsLookup } from './DnsLookup'
export { default as SslChecker } from './SslChecker'
export { default as PathTracer } from './PathTracer'
export { default as CaptureBuilder } from './CaptureBuilder'
```

**Step 2: Update App.tsx**

```typescript
import { Routes, Route } from 'react-router-dom'
import { Layout, Dashboard } from './components/layout'
import {
  PcapAnalyzer,
  DnsLookup,
  SslChecker,
  PathTracer,
  CaptureBuilder,
} from './components/tools'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="pcap-analyzer" element={<PcapAnalyzer />} />
        <Route path="dns-lookup" element={<DnsLookup />} />
        <Route path="ssl-checker" element={<SslChecker />} />
        <Route path="path-tracer" element={<PathTracer />} />
        <Route path="capture-builder" element={<CaptureBuilder />} />
      </Route>
    </Routes>
  )
}

export default App
```

**Step 3: Update Dashboard.tsx**

Add new tool to tools array:

```typescript
import { Link } from 'react-router-dom'
import {
  FileSearch,
  Network,
  Shield,
  ArrowRight,
  Route,
  Terminal,
} from 'lucide-react'

const tools = [
  {
    name: 'PCAP Analyzer',
    description: 'Analyze packet captures to identify network issues, security threats, and performance problems.',
    href: '/pcap-analyzer',
    icon: FileSearch,
    features: ['pcap & pcapng support', 'Pattern detection', 'Protocol analysis', 'Actionable insights'],
  },
  {
    name: 'DNS Lookup',
    description: 'Query DNS records from multiple public resolvers, compare results, and detect propagation issues.',
    href: '/dns-lookup',
    icon: Network,
    features: ['All record types', 'Multi-resolver query', 'DNSSEC status', 'Response comparison'],
  },
  {
    name: 'SSL/TLS Checker',
    description: 'Validate SSL certificates, check expiration dates, and verify issuer chains via Certificate Transparency.',
    href: '/ssl-checker',
    icon: Shield,
    features: ['Certificate details', 'Expiry alerts', 'CT log query', 'Security checks'],
  },
  {
    name: 'Path Tracer',
    description: 'Perform layer 3 hop-by-hop path discovery with NetBox device lookup integration and RTT analysis.',
    href: '/path-tracer',
    icon: Route,
    features: ['L3 traceroute', 'NetBox integration', 'RTT metrics', 'Device lookup'],
  },
  {
    name: 'Capture Builder',
    description: 'Generate packet capture commands for tcpdump, Fortinet, Palo Alto, and Cisco ASA devices.',
    href: '/capture-builder',
    icon: Terminal,
    features: ['Multi-platform', 'Visual filter builder', 'Command workflows', 'Cheat sheet'],
  },
]
```

**Step 4: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/components/tools/index.ts src/App.tsx src/components/layout/Dashboard.tsx
git commit -m "feat(capture-builder): integrate into app routing and dashboard"
```

---

## Task 14: Final verification

**Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 2: Start dev server and test**

Run: `npm run dev`
Expected: App starts, navigate to /capture-builder, all tabs work

**Step 3: Final commit**

```bash
git add -A
git status
# If any remaining changes:
git commit -m "feat(capture-builder): complete implementation"
```

---

## Summary

**Total Tasks:** 14
**Files Created:** 13 new files
**Files Modified:** 3 existing files

**Implementation Order:**
1. Types and constants (foundation)
2. Shared components (ValidationFeedback, CommandOutput, BpfFilterBuilder, CheatSheet)
3. Platform tabs (Tcpdump, Fortinet, PaloAlto, CiscoAsa)
4. Main component and app integration
