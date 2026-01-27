import { useState, useCallback, useRef } from 'react';
import {
  Upload,
  FileSearch,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Network,
  Shield,
  Activity,
  Download,
  RefreshCw,
  X,
  FileText,
  Layers,
  Globe,
  Lock,
} from 'lucide-react';
import type { AnalysisResult, Finding, FindingSeverity } from '../../features/pcap';
import { PcapAnalyzer as Analyzer } from '../../features/pcap';

const severityConfig: Record<FindingSeverity, { icon: typeof AlertCircle; color: string; bg: string; border: string }> = {
  critical: { icon: AlertCircle, color: 'text-danger-600', bg: 'bg-danger-50', border: 'border-danger-200' },
  warning: { icon: AlertTriangle, color: 'text-warning-600', bg: 'bg-warning-50', border: 'border-warning-200' },
  info: { icon: Info, color: 'text-primary-600', bg: 'bg-primary-50', border: 'border-primary-200' },
  success: { icon: CheckCircle, color: 'text-success-600', bg: 'bg-success-50', border: 'border-success-200' },
};

const categoryIcons: Record<string, typeof Network> = {
  TCP: Network,
  DNS: Globe,
  TLS: Lock,
  HTTP: FileText,
  Security: Shield,
  Network: Network,
  Performance: Activity,
  Summary: CheckCircle,
};

export default function PcapAnalyzer() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'findings' | 'connections' | 'protocols' | 'dns' | 'tls'>('findings');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.pcap') && !file.name.endsWith('.pcapng')) {
      setError('Please upload a .pcap or .pcapng file');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const analyzer = new Analyzer();
      const analysisResult = await analyzer.analyze(file);
      setResult(analysisResult);
      // Auto-expand critical findings
      const criticalIds = new Set(
        analysisResult.findings
          .filter((f) => f.severity === 'critical')
          .map((f) => f.id)
      );
      setExpandedFindings(criticalIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze file');
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const toggleFinding = useCallback((id: string) => {
    setExpandedFindings((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const exportFindings = useCallback(() => {
    if (!result) return;

    const report = {
      fileName: result.fileName,
      analysisDate: new Date().toISOString(),
      summary: {
        totalPackets: result.totalPackets,
        totalBytes: result.totalBytes,
        duration: result.captureDuration,
        criticalFindings: result.findings.filter((f) => f.severity === 'critical').length,
        warningFindings: result.findings.filter((f) => f.severity === 'warning').length,
      },
      findings: result.findings.map((f) => ({
        severity: f.severity,
        category: f.category,
        title: f.title,
        description: f.description,
        recommendations: f.recommendations,
      })),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.fileName}-analysis.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">PCAP Analyzer</h1>
          <p className="mt-1 text-slate-600">
            Upload a packet capture file to identify issues and get actionable recommendations
          </p>
        </div>
        {result && (
          <div className="flex items-center gap-2">
            <button onClick={exportFindings} className="btn-secondary flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export Report
            </button>
            <button onClick={reset} className="btn-secondary flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              New Analysis
            </button>
          </div>
        )}
      </div>

      {/* Upload Area */}
      {!result && (
        <div
          className={`drop-zone p-8 lg:p-12 text-center transition-all duration-200 ${
            isDragging ? 'drag-over' : ''
          } ${isAnalyzing ? 'opacity-50 pointer-events-none' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pcap,.pcapng"
            onChange={handleFileInput}
            className="hidden"
            id="file-input"
          />

          <div className="flex flex-col items-center gap-4">
            {isAnalyzing ? (
              <>
                <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
                  <FileSearch className="w-8 h-8 text-primary-600 animate-pulse" />
                </div>
                <div>
                  <p className="text-lg font-medium text-slate-900 dark:text-white">Analyzing capture file...</p>
                  <p className="text-slate-500 mt-1">Parsing packets and detecting patterns</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                  <Upload className="w-8 h-8 text-slate-400" />
                </div>
                <div>
                  <p className="text-lg font-medium text-slate-900 dark:text-white">
                    Drop your PCAP file here, or{' '}
                    <label
                      htmlFor="file-input"
                      className="text-primary-600 hover:text-primary-700 cursor-pointer underline"
                    >
                      browse
                    </label>
                  </p>
                  <p className="text-slate-500 mt-1">Supports .pcap and .pcapng formats</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                    Client-side analysis
                  </span>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                    Files never leave your browser
                  </span>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                    Instant results
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="card border-danger-200 bg-danger-50">
          <div className="card-body flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-danger-800">Analysis Failed</p>
              <p className="text-danger-700 text-sm mt-1">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-danger-600 hover:text-danger-800">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              icon={FileText}
              label="File"
              value={result.fileName}
              subValue={`${result.fileFormat.toUpperCase()} • ${formatBytes(result.fileSize)}`}
            />
            <SummaryCard
              icon={Layers}
              label="Packets"
              value={result.totalPackets.toLocaleString()}
              subValue={formatBytes(result.totalBytes)}
            />
            <SummaryCard
              icon={Clock}
              label="Duration"
              value={result.captureDuration ? formatDuration(result.captureDuration) : 'N/A'}
              subValue={result.captureStartTime?.toLocaleTimeString() || ''}
            />
            <SummaryCard
              icon={AlertTriangle}
              label="Issues Found"
              value={result.findings.filter((f) => f.severity !== 'success' && f.severity !== 'info').length.toString()}
              subValue={`${result.findings.filter((f) => f.severity === 'critical').length} critical`}
              highlight={result.findings.some((f) => f.severity === 'critical')}
            />
          </div>

          {/* Tabs */}
          <div className="border-b border-slate-200">
            <nav className="-mb-px flex space-x-8 overflow-x-auto">
              {[
                { id: 'findings', label: 'Findings', count: result.findings.length },
                { id: 'connections', label: 'Connections', count: result.connections.length },
                { id: 'protocols', label: 'Protocols', count: result.protocolBreakdown.length },
                { id: 'dns', label: 'DNS', count: result.dnsQueries.length },
                { id: 'tls', label: 'TLS', count: result.tlsConnections.length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                      activeTab === tab.id ? 'bg-primary-100 text-primary-600' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="space-y-4">
            {activeTab === 'findings' && (
              <FindingsPanel
                findings={result.findings}
                expandedFindings={expandedFindings}
                toggleFinding={toggleFinding}
              />
            )}

            {activeTab === 'connections' && (
              <ConnectionsPanel connections={result.connections} formatBytes={formatBytes} />
            )}

            {activeTab === 'protocols' && (
              <ProtocolsPanel breakdown={result.protocolBreakdown} formatBytes={formatBytes} />
            )}

            {activeTab === 'dns' && <DNSPanel queries={result.dnsQueries} />}

            {activeTab === 'tls' && <TLSPanel connections={result.tlsConnections} />}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  subValue,
  highlight,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  subValue: string;
  highlight?: boolean;
}) {
  return (
    <div className={`card p-4 ${highlight ? 'border-danger-200 bg-danger-50' : ''}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${highlight ? 'bg-danger-100' : 'bg-slate-100'}`}>
          <Icon className={`w-5 h-5 ${highlight ? 'text-danger-600' : 'text-slate-600'}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-500">{label}</p>
          <p className={`text-lg font-semibold truncate ${highlight ? 'text-danger-900' : 'text-slate-900'}`}>
            {value}
          </p>
          <p className="text-xs text-slate-500 truncate">{subValue}</p>
        </div>
      </div>
    </div>
  );
}

function FindingsPanel({
  findings,
  expandedFindings,
  toggleFinding,
}: {
  findings: Finding[];
  expandedFindings: Set<string>;
  toggleFinding: (id: string) => void;
}) {
  const groupedFindings = findings.reduce((acc, finding) => {
    const severity = finding.severity;
    if (!acc[severity]) acc[severity] = [];
    acc[severity].push(finding);
    return acc;
  }, {} as Record<FindingSeverity, Finding[]>);

  const severityOrder: FindingSeverity[] = ['critical', 'warning', 'info', 'success'];

  return (
    <div className="space-y-4">
      {severityOrder.map((severity) => {
        const severityFindings = groupedFindings[severity];
        if (!severityFindings || severityFindings.length === 0) return null;

        const config = severityConfig[severity];

        return (
          <div key={severity}>
            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
              {severity} ({severityFindings.length})
            </h3>
            <div className="space-y-3">
              {severityFindings.map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  config={config}
                  isExpanded={expandedFindings.has(finding.id)}
                  onToggle={() => toggleFinding(finding.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FindingCard({
  finding,
  config,
  isExpanded,
  onToggle,
}: {
  finding: Finding;
  config: typeof severityConfig.critical;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const Icon = config.icon;
  const CategoryIcon = categoryIcons[finding.category] || Network;

  return (
    <div className={`card ${config.border} ${config.bg} overflow-hidden`}>
      <button
        onClick={onToggle}
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-black/5 transition-colors"
      >
        <Icon className={`w-5 h-5 ${config.color} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
              <CategoryIcon className="w-3 h-3" />
              {finding.category}
            </span>
          </div>
          <h4 className="font-semibold text-slate-900 mt-1">{finding.title}</h4>
          <p className="text-sm text-slate-600 mt-1 line-clamp-2">{finding.description}</p>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-200/50">
          {finding.details.length > 0 && (
            <div className="mt-4">
              <h5 className="text-sm font-medium text-slate-700 mb-2">Details</h5>
              <ul className="space-y-1">
                {finding.details.map((detail, i) => (
                  <li key={i} className="text-sm text-slate-600 font-mono">
                    {detail}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {finding.recommendations.length > 0 && (
            <div className="mt-4">
              <h5 className="text-sm font-medium text-slate-700 mb-2">Recommended Next Steps</h5>
              <ol className="space-y-2">
                {finding.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-medium">
                      {i + 1}
                    </span>
                    {rec}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {finding.affectedPackets && finding.affectedPackets.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-slate-500">
                Affected packets: {finding.affectedPackets.length > 10
                  ? `${finding.affectedPackets.slice(0, 10).join(', ')}... and ${finding.affectedPackets.length - 10} more`
                  : finding.affectedPackets.join(', ')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConnectionsPanel({
  connections,
  formatBytes,
}: {
  connections: AnalysisResult['connections'];
  formatBytes: (bytes: number) => string;
}) {
  const sortedConnections = [...connections].sort((a, b) => b.byteCount - a.byteCount);

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Source
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Destination
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Protocol
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Packets
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Bytes
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                State
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sortedConnections.slice(0, 50).map((conn, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-mono text-slate-900 dark:text-white">
                  {conn.srcIp}:{conn.srcPort}
                </td>
                <td className="px-4 py-3 text-sm font-mono text-slate-900 dark:text-white">
                  {conn.destIp}:{conn.destPort}
                </td>
                <td className="px-4 py-3">
                  <span className="badge-info">{conn.protocol}</span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{conn.packetCount}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{formatBytes(conn.byteCount)}</td>
                <td className="px-4 py-3">
                  {conn.state && (
                    <span
                      className={`badge ${
                        conn.state === 'ESTABLISHED'
                          ? 'badge-success'
                          : conn.state === 'RESET'
                          ? 'badge-critical'
                          : 'badge-info'
                      }`}
                    >
                      {conn.state}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {connections.length > 50 && (
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-sm text-slate-500">
          Showing 50 of {connections.length} connections
        </div>
      )}
    </div>
  );
}

function ProtocolsPanel({
  breakdown,
  formatBytes,
}: {
  breakdown: AnalysisResult['protocolBreakdown'];
  formatBytes: (bytes: number) => string;
}) {
  const maxPackets = Math.max(...breakdown.map((p) => p.packetCount));

  return (
    <div className="card">
      <div className="card-body space-y-4">
        {breakdown.map((protocol) => (
          <div key={protocol.protocol}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-slate-900 dark:text-white">{protocol.protocol}</span>
              <span className="text-sm text-slate-500">
                {protocol.packetCount.toLocaleString()} packets ({protocol.percentage.toFixed(1)}%)
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-500"
                  style={{ width: `${(protocol.packetCount / maxPackets) * 100}%` }}
                />
              </div>
              <span className="text-xs text-slate-500 w-20 text-right">
                {formatBytes(protocol.byteCount)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DNSPanel({ queries }: { queries: AnalysisResult['dnsQueries'] }) {
  if (queries.length === 0) {
    return (
      <div className="card p-8 text-center">
        <Globe className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-600">No DNS queries found in this capture</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Domain
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Query Count
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Record Types
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {queries.slice(0, 50).map((query, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-mono text-slate-900 dark:text-white">{query.domain}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{query.count}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {query.types.map((type) => (
                      <span key={type} className="badge-info">
                        {type}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TLSPanel({ connections }: { connections: AnalysisResult['tlsConnections'] }) {
  if (connections.length === 0) {
    return (
      <div className="card p-8 text-center">
        <Lock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-600">No TLS handshakes found in this capture</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Client
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Server
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                SNI
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Version
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {connections.slice(0, 50).map((conn, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-mono text-slate-900 dark:text-white">{conn.clientIp}</td>
                <td className="px-4 py-3 text-sm font-mono text-slate-900 dark:text-white">{conn.serverIp}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{conn.sni || '-'}</td>
                <td className="px-4 py-3">
                  {conn.version && (
                    <span
                      className={`badge ${
                        conn.version.includes('1.3') || conn.version.includes('1.2')
                          ? 'badge-success'
                          : 'badge-warning'
                      }`}
                    >
                      {conn.version}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
