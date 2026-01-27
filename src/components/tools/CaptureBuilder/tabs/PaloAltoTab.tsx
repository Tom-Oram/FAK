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
