// src/components/layout/Dashboard.tsx
import { Link } from 'react-router-dom'
import {
  FileSearch,
  Globe,
  ShieldCheck,
  Route,
  Terminal,
  Gauge,
  ArrowRight,
  Zap,
  Regex,
} from 'lucide-react'
import SystemHealthBar from './SystemHealthBar'
import RecentActivity from './RecentActivity'

const tools = [
  {
    name: 'PCAP Analyzer',
    description: 'Analyze packet captures to identify network issues and security threats.',
    href: '/pcap-analyzer',
    icon: FileSearch,
    subtitle: 'pcap & pcapng • Pattern detection',
    color: 'from-blue-500 to-blue-600',
  },
  {
    name: 'DNS Lookup',
    description: 'Query DNS records from multiple resolvers with DNSSEC validation.',
    href: '/dns-lookup',
    icon: Globe,
    subtitle: '10 record types • 3 resolvers',
    color: 'from-green-500 to-green-600',
  },
  {
    name: 'SSL Checker',
    description: 'Validate certificates via Certificate Transparency logs.',
    href: '/ssl-checker',
    icon: ShieldCheck,
    subtitle: 'CT log query • Chain validation',
    color: 'from-purple-500 to-purple-600',
  },
  {
    name: 'Path Tracer',
    description: 'Layer 3 hop-by-hop path discovery with NetBox integration.',
    href: '/path-tracer',
    icon: Route,
    subtitle: 'RTT analysis • Device lookup',
    color: 'from-orange-500 to-orange-600',
  },
  {
    name: 'iPerf Server',
    description: 'Run bandwidth tests with real-time monitoring and history.',
    href: '/iperf-server',
    icon: Gauge,
    subtitle: 'Live graphs • WebSocket updates',
    color: 'from-cyan-500 to-cyan-600',
  },
  {
    name: 'Capture Builder',
    description: 'Generate capture commands for tcpdump, Fortinet, Palo Alto, and ASA.',
    href: '/capture-builder',
    icon: Terminal,
    subtitle: 'Multi-platform • Visual builder',
    color: 'from-pink-500 to-pink-600',
  },
  {
    name: 'Regex Builder',
    description: 'Build regular expressions by selecting patterns from sample text.',
    href: '/regex-builder',
    icon: Regex,
    subtitle: 'Pattern detection • Multi-language',
    color: 'from-violet-500 to-violet-600',
  },
]

export default function Dashboard() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* System Health Bar */}
      <SystemHealthBar />

      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 dark:from-slate-800 dark:to-slate-900 dark:border dark:border-primary-500/20 p-6 lg:p-8">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white flex items-center gap-3">
                First Aid Kit
                <span className="text-sm font-normal bg-white/20 px-2 py-0.5 rounded-full">v1.0</span>
              </h1>
              <p className="mt-2 text-primary-100 dark:text-slate-300 max-w-xl">
                Your first port of call for network incident diagnostics. Analyze captures, trace paths, test bandwidth, and more.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/pcap-analyzer"
                className="btn bg-white text-primary-700 hover:bg-primary-50 shadow-lg shadow-primary-900/20"
              >
                <FileSearch className="w-4 h-4 mr-2" />
                Analyze PCAP
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
              <Link
                to="/iperf-server"
                className="btn bg-white/10 text-white border border-white/20 hover:bg-white/20"
              >
                <Zap className="w-4 h-4 mr-2" />
                Bandwidth Test
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Tools + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tool Grid */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Tools</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tools.map((tool, index) => (
              <Link
                key={tool.name}
                to={tool.href}
                className="card card-hover group"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center shadow-lg transition-transform duration-200 group-hover:scale-110`}>
                      <tool.icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {tool.name}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                        {tool.description}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                        {tool.subtitle}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-1">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Activity</h2>
          <RecentActivity />
        </div>
      </div>
    </div>
  )
}
