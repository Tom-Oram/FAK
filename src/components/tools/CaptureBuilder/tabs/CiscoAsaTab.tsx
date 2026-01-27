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
          <h3 className="font-semibold text-slate-900 dark:text-white">Capture Settings</h3>
        </div>
        <div className="card-body space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Capture Name *</label>
              <input
                type="text"
                value={options.captureName}
                onChange={(e) => updateOption('captureName', e.target.value)}
                placeholder="capture1"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Interface *</label>
              <select
                value={options.interface}
                onChange={(e) => updateOption('interface', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg"
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
                  className="mt-2 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Capture Type</label>
              <select
                value={options.captureType}
                onChange={(e) => updateOption('captureType', e.target.value as CiscoAsaOptions['captureType'])}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg"
              >
                <option value="raw-data">raw-data (default)</option>
                <option value="asp-drop">asp-drop (dropped packets)</option>
                <option value="isakmp">isakmp (VPN)</option>
                <option value="webvpn">webvpn</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Direction</label>
              <select
                value={options.direction}
                onChange={(e) => updateOption('direction', e.target.value as CiscoAsaOptions['direction'])}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg"
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
          <h3 className="font-semibold text-slate-900 dark:text-white">Filter Options</h3>
        </div>
        <div className="card-body space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Access List (if pre-defined)</label>
            <input
              type="text"
              value={options.accessList}
              onChange={(e) => updateOption('accessList', e.target.value)}
              placeholder="ACL-CAPTURE"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Leave blank to use inline match below</p>
          </div>

          {!options.accessList && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Protocol</label>
                <select
                  value={options.protocol}
                  onChange={(e) => updateOption('protocol', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg"
                >
                  {PROTOCOLS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Port</label>
                <div className="flex gap-2">
                  <select
                    value={options.portOperator}
                    onChange={(e) => updateOption('portOperator', e.target.value)}
                    className="px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg"
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
                    className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Source IP</label>
                <input
                  type="text"
                  value={options.sourceIp}
                  onChange={(e) => updateOption('sourceIp', e.target.value)}
                  placeholder="10.0.0.1"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Destination IP</label>
                <input
                  type="text"
                  value={options.destIp}
                  onChange={(e) => updateOption('destIp', e.target.value)}
                  placeholder="10.0.0.2"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Capture Limits */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-slate-900 dark:text-white">Capture Limits</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Buffer Size (bytes)</label>
              <input
                type="number"
                value={options.bufferSize}
                onChange={(e) => updateOption('bufferSize', e.target.value)}
                placeholder="512000"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Packet Length</label>
              <input
                type="number"
                value={options.packetLength}
                onChange={(e) => updateOption('packetLength', e.target.value)}
                placeholder="1518"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg"
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
                <span className="text-sm text-slate-700 dark:text-slate-300">Circular buffer</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Troubleshooting Commands */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-slate-900 dark:text-white">Include Additional Commands</h3>
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
              <span className="text-sm text-slate-700 dark:text-slate-300">show capture</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.includeShowConn}
                onChange={(e) => updateOption('includeShowConn', e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">show conn</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.includePacketTracer}
                onChange={(e) => updateOption('includePacketTracer', e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">packet-tracer</span>
            </label>
          </div>

          {options.includePacketTracer && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Protocol</label>
                <select
                  value={options.packetTracerProtocol}
                  onChange={(e) => updateOption('packetTracerProtocol', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg"
                >
                  <option value="tcp">TCP</option>
                  <option value="udp">UDP</option>
                  <option value="icmp">ICMP</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Source IP</label>
                <input
                  type="text"
                  value={options.packetTracerSourceIp}
                  onChange={(e) => updateOption('packetTracerSourceIp', e.target.value)}
                  placeholder="10.0.0.1"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Source Port</label>
                <input
                  type="number"
                  value={options.packetTracerSourcePort}
                  onChange={(e) => updateOption('packetTracerSourcePort', e.target.value)}
                  placeholder="12345"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Destination IP</label>
                <input
                  type="text"
                  value={options.packetTracerDestIp}
                  onChange={(e) => updateOption('packetTracerDestIp', e.target.value)}
                  placeholder="10.0.0.2"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Destination Port</label>
                <input
                  type="number"
                  value={options.packetTracerDestPort}
                  onChange={(e) => updateOption('packetTracerDestPort', e.target.value)}
                  placeholder="443"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg"
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
