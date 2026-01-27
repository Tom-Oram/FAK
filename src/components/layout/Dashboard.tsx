import { Link } from 'react-router-dom'
import {
  FileSearch,
  Network,
  Shield,
  ArrowRight,
  Route,
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
]

export default function Dashboard() {
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">
            First Aid Kit
          </h1>
          <p className="mt-1 text-slate-600">
            Your first port of call for network incident diagnostics
          </p>
        </div>
        <Link
          to="/pcap-analyzer"
          className="btn-primary inline-flex items-center gap-2"
        >
          <FileSearch className="w-4 h-4" />
          Start PCAP Analysis
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Tools Grid */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Available Tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool) => (
            <Link
              key={tool.name}
              to={tool.href}
              className="card overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary-200"
            >
              <ToolCard tool={tool} />
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Start Guide */}
      <div className="card bg-gradient-to-br from-primary-600 to-primary-700 text-white">
        <div className="card-body">
          <h2 className="text-xl font-semibold mb-2">Quick Start Guide</h2>
          <p className="text-primary-100 mb-4">
            New to First Aid Kit? Here's how to get started with your incident analysis:
          </p>
          <ol className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs font-medium">
                1
              </span>
              <span>Navigate to the PCAP Analyzer tool from the sidebar</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs font-medium">
                2
              </span>
              <span>Upload your .pcap or .pcapng file using drag-and-drop or file browser</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs font-medium">
                3
              </span>
              <span>Review the automated analysis for issues and recommended next steps</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs font-medium">
                4
              </span>
              <span>Export findings or dive deeper into specific protocol details</span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  )
}

function ToolCard({ tool }: { tool: typeof tools[0] }) {
  return (
    <>
      <div className="p-4 border-b border-slate-100">
        <div className="p-2 bg-primary-50 rounded-lg w-fit">
          <tool.icon className="w-6 h-6 text-primary-600" />
        </div>
        <h3 className="mt-3 text-lg font-semibold text-slate-900">{tool.name}</h3>
        <p className="mt-1 text-sm text-slate-600">{tool.description}</p>
      </div>
      <div className="p-4 bg-slate-50">
        <div className="flex flex-wrap gap-2">
          {tool.features.map((feature) => (
            <span
              key={feature}
              className="text-xs bg-white px-2 py-1 rounded border border-slate-200 text-slate-600"
            >
              {feature}
            </span>
          ))}
        </div>
      </div>
    </>
  )
}
