import { useState } from 'react';
import { Terminal, Shield, Flame, Server } from 'lucide-react';
import { TcpdumpTab, FortinetTab, PaloAltoTab, CiscoAsaTab } from './tabs';
import { CheatSheet } from './components';
import { CaptureTab } from './types';

interface TabConfig {
  id: CaptureTab;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const TABS: TabConfig[] = [
  {
    id: 'tcpdump',
    label: 'tcpdump',
    icon: <Terminal className="w-4 h-4" />,
    description: 'Linux packet capture',
  },
  {
    id: 'fortinet',
    label: 'Fortinet',
    icon: <Shield className="w-4 h-4" />,
    description: 'FortiGate sniffer & debug',
  },
  {
    id: 'paloalto',
    label: 'Palo Alto',
    icon: <Flame className="w-4 h-4" />,
    description: 'PAN-OS packet capture',
  },
  {
    id: 'cisco-asa',
    label: 'Cisco ASA',
    icon: <Server className="w-4 h-4" />,
    description: 'ASA capture commands',
  },
];

export default function CaptureBuilder() {
  const [activeTab, setActiveTab] = useState<CaptureTab>('tcpdump');

  const renderTab = () => {
    switch (activeTab) {
      case 'tcpdump':
        return <TcpdumpTab />;
      case 'fortinet':
        return <FortinetTab />;
      case 'paloalto':
        return <PaloAltoTab />;
      case 'cisco-asa':
        return <CiscoAsaTab />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Capture Builder</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Generate packet capture commands for different platforms
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-200 dark:border-slate-700 mb-6">
        <nav className="flex gap-1 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                }
              `}
              title={tab.description}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Cheat Sheet */}
      <div className="mb-6">
        <CheatSheet activeTab={activeTab} />
      </div>

      {/* Tab Content */}
      <div className="card">
        <div className="card-body">{renderTab()}</div>
      </div>
    </div>
  );
}
