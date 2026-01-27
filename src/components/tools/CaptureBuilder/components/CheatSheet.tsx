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
        className="w-full card-header flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary-600" />
          <span className="font-semibold text-slate-900 dark:text-white">Cheat Sheet - {content.title}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {isOpen && (
        <div className="card-body border-t border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {content.filters.length > 0 && (
              <div>
                <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-3">Common Filters</h4>
                <div className="space-y-2">
                  {content.filters.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded text-sm"
                    >
                      <div>
                        <code className="font-mono text-primary-600 dark:text-primary-400">{item.syntax}</code>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.description}</p>
                      </div>
                      {onUseFilter && (
                        <button
                          onClick={() => onUseFilter(item.syntax)}
                          className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 px-2 py-1 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600"
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
              <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-3">
                {activeTab === 'tcpdump' ? 'Common Flags' : 'Quick Reference'}
              </h4>
              <div className="space-y-2">
                {content.tips.map((item, i) => (
                  <div key={i} className="p-2 bg-slate-50 dark:bg-slate-800 rounded text-sm">
                    <code className="font-mono text-primary-600 dark:text-primary-400">{item.syntax}</code>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.description}</p>
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
