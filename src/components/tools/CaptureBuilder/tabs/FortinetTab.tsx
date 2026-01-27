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
          <h3 className="font-semibold text-slate-900 dark:text-white">Packet Sniffer</h3>
        </div>
        <div className="card-body space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Interface</label>
              <select
                value={options.interface}
                onChange={(e) => updateOption('interface', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg"
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
                  className="mt-2 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Packet Count</label>
              <input
                type="number"
                value={options.packetCount}
                onChange={(e) => updateOption('packetCount', e.target.value)}
                placeholder="0 = unlimited"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Verbosity Level</label>
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
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
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
            <span className="text-sm text-slate-700 dark:text-slate-300">Show absolute timestamp (a)</span>
          </label>

          <BpfFilterBuilder value={filter} onChange={setFilter} />
        </div>
      </div>

      {/* Debug Flow Section */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-white">Debug Flow (Policy Tracing)</h3>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.debugFlowEnabled}
              onChange={(e) => updateOption('debugFlowEnabled', e.target.checked)}
              className="rounded border-slate-300"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">Enable</span>
          </label>
        </div>
        {options.debugFlowEnabled && (
          <div className="card-body space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Address Filter</label>
              <input
                type="text"
                value={options.debugFlowAddress}
                onChange={(e) => updateOption('debugFlowAddress', e.target.value)}
                placeholder="10.0.0.1 (optional)"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg"
              />
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.debugFlowVerbose}
                onChange={(e) => updateOption('debugFlowVerbose', e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">Verbose output (100 packets vs 20)</span>
            </label>
          </div>
        )}
      </div>

      <CommandOutput steps={commands} />
    </div>
  );
}
