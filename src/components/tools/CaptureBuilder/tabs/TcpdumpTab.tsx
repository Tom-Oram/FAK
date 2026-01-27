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
