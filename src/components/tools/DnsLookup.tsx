import { useState, useCallback } from 'react';
import {
  Globe,
  Search,
  Clock,
  Server,
  AlertCircle,
  CheckCircle,
  Copy,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Info,
  AlertTriangle,
} from 'lucide-react';

// DNS Record Types
const DNS_RECORD_TYPES = [
  { value: 'A', label: 'A', description: 'IPv4 address' },
  { value: 'AAAA', label: 'AAAA', description: 'IPv6 address' },
  { value: 'CNAME', label: 'CNAME', description: 'Canonical name' },
  { value: 'MX', label: 'MX', description: 'Mail exchange' },
  { value: 'TXT', label: 'TXT', description: 'Text records' },
  { value: 'NS', label: 'NS', description: 'Name servers' },
  { value: 'SOA', label: 'SOA', description: 'Start of authority' },
  { value: 'PTR', label: 'PTR', description: 'Pointer (reverse)' },
  { value: 'SRV', label: 'SRV', description: 'Service locator' },
  { value: 'CAA', label: 'CAA', description: 'Certification authority' },
];

// Public DNS servers for lookup
const DNS_SERVERS = [
  { id: 'cloudflare', name: 'Cloudflare', ip: '1.1.1.1', dohUrl: 'https://cloudflare-dns.com/dns-query' },
  { id: 'google', name: 'Google', ip: '8.8.8.8', dohUrl: 'https://dns.google/resolve' },
  { id: 'quad9', name: 'Quad9', ip: '9.9.9.9', dohUrl: 'https://dns.quad9.net/dns-query' },
];

interface DnsRecord {
  name: string;
  type: string;
  ttl: number;
  data: string;
  priority?: number;
}

interface DnsResult {
  server: string;
  serverIp: string;
  queryTime: number;
  status: 'success' | 'error' | 'nxdomain';
  records: DnsRecord[];
  error?: string;
  dnssec?: boolean;
  recursionAvailable?: boolean;
  authoritative?: boolean;
}

interface LookupResult {
  domain: string;
  recordType: string;
  timestamp: Date;
  results: DnsResult[];
  warnings: string[];
  insights: string[];
}

export default function DnsLookup() {
  const [domain, setDomain] = useState('');
  const [recordType, setRecordType] = useState('A');
  const [selectedServers, setSelectedServers] = useState<string[]>(['cloudflare', 'google']);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set(['cloudflare', 'google']));
  const [recentLookups, setRecentLookups] = useState<string[]>([]);

  const performLookup = useCallback(async () => {
    if (!domain.trim()) {
      setError('Please enter a domain name');
      return;
    }

    // Basic domain validation
    const domainPattern = /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

    if (!domainPattern.test(cleanDomain) && !cleanDomain.includes('.')) {
      setError('Please enter a valid domain name (e.g., example.com)');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    const results: DnsResult[] = [];
    const warnings: string[] = [];
    const insights: string[] = [];

    // Query each selected DNS server using DNS-over-HTTPS
    for (const serverId of selectedServers) {
      const server = DNS_SERVERS.find((s) => s.id === serverId);
      if (!server) continue;

      const startTime = performance.now();

      try {
        let response: Response;
        let data: { Status: number; Answer?: Array<{ name: string; type: number; TTL: number; data: string }>; Authority?: Array<{ name: string; type: number; TTL: number; data: string }>; AD?: boolean; RA?: boolean; AA?: boolean };

        if (server.id === 'google') {
          // Google uses a different API format
          const url = `${server.dohUrl}?name=${encodeURIComponent(cleanDomain)}&type=${recordType}`;
          response = await fetch(url, {
            headers: { Accept: 'application/dns-json' },
          });
          data = await response.json();
        } else {
          // Cloudflare and Quad9 use standard DoH JSON format
          const url = `${server.dohUrl}?name=${encodeURIComponent(cleanDomain)}&type=${recordType}`;
          response = await fetch(url, {
            headers: { Accept: 'application/dns-json' },
          });
          data = await response.json();
        }

        const queryTime = Math.round(performance.now() - startTime);

        // Parse response
        if (data.Status === 0) {
          const records: DnsRecord[] = (data.Answer || []).map((answer) => ({
            name: answer.name,
            type: getRecordTypeName(answer.type),
            ttl: answer.TTL,
            data: answer.data,
            priority: answer.type === 15 ? parseInt(answer.data.split(' ')[0]) : undefined,
          }));

          results.push({
            server: server.name,
            serverIp: server.ip,
            queryTime,
            status: records.length > 0 ? 'success' : 'nxdomain',
            records,
            dnssec: data.AD,
            recursionAvailable: data.RA,
            authoritative: data.AA,
          });
        } else if (data.Status === 3) {
          results.push({
            server: server.name,
            serverIp: server.ip,
            queryTime,
            status: 'nxdomain',
            records: [],
            error: 'Domain does not exist (NXDOMAIN)',
          });
        } else {
          results.push({
            server: server.name,
            serverIp: server.ip,
            queryTime,
            status: 'error',
            records: [],
            error: `DNS error: RCODE ${data.Status}`,
          });
        }
      } catch (err) {
        const queryTime = Math.round(performance.now() - startTime);
        results.push({
          server: server.name,
          serverIp: server.ip,
          queryTime,
          status: 'error',
          records: [],
          error: err instanceof Error ? err.message : 'Failed to query DNS server',
        });
      }
    }

    // Analyze results for warnings and insights
    const successResults = results.filter((r) => r.status === 'success');

    if (successResults.length > 1) {
      // Check for consistency across DNS servers
      const recordSets = successResults.map((r) =>
        r.records.map((rec) => rec.data).sort().join(',')
      );
      const uniqueSets = new Set(recordSets);
      if (uniqueSets.size > 1) {
        warnings.push('DNS responses differ between servers - possible propagation in progress or split-horizon DNS');
      }

      // Check TTL consistency
      const ttls = successResults.flatMap((r) => r.records.map((rec) => rec.ttl));
      const minTtl = Math.min(...ttls);
      const maxTtl = Math.max(...ttls);
      if (maxTtl - minTtl > 300 && ttls.length > 0) {
        insights.push(`TTL varies between ${minTtl}s and ${maxTtl}s across servers`);
      }
    }

    // Check for DNSSEC
    const dnssecEnabled = results.some((r) => r.dnssec);
    if (dnssecEnabled) {
      insights.push('DNSSEC validation is enabled for this domain');
    }

    // Check response times
    const avgTime = results.reduce((sum, r) => sum + r.queryTime, 0) / results.length;
    if (avgTime > 500) {
      warnings.push(`High average DNS response time: ${Math.round(avgTime)}ms`);
    }

    // Add to recent lookups
    setRecentLookups((prev) => {
      const newLookups = [cleanDomain, ...prev.filter((d) => d !== cleanDomain)].slice(0, 5);
      return newLookups;
    });

    setResult({
      domain: cleanDomain,
      recordType,
      timestamp: new Date(),
      results,
      warnings,
      insights,
    });

    setIsLoading(false);
  }, [domain, recordType, selectedServers]);

  const toggleServer = useCallback((serverId: string) => {
    setSelectedServers((prev) => {
      if (prev.includes(serverId)) {
        if (prev.length === 1) return prev; // Keep at least one server
        return prev.filter((s) => s !== serverId);
      }
      return [...prev, serverId];
    });
  }, []);

  const toggleExpandServer = useCallback((serverId: string) => {
    setExpandedServers((prev) => {
      const next = new Set(prev);
      if (next.has(serverId)) {
        next.delete(serverId);
      } else {
        next.add(serverId);
      }
      return next;
    });
  }, []);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const getRecordTypeName = (typeNum: number): string => {
    const types: Record<number, string> = {
      1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 12: 'PTR',
      15: 'MX', 16: 'TXT', 28: 'AAAA', 33: 'SRV', 257: 'CAA',
    };
    return types[typeNum] || `TYPE${typeNum}`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">DNS Lookup</h1>
        <p className="mt-1 text-slate-600">
          Query DNS records from multiple public resolvers and compare results
        </p>
      </div>

      {/* Lookup Form */}
      <div className="card">
        <div className="card-body space-y-4">
          {/* Domain Input */}
          <div>
            <label htmlFor="domain" className="block text-sm font-medium text-slate-700 mb-1">
              Domain Name
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  id="domain"
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && performLookup()}
                  placeholder="example.com"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
              </div>
              <button
                onClick={performLookup}
                disabled={isLoading}
                className="btn-primary flex items-center gap-2"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Lookup
              </button>
            </div>
          </div>

          {/* Record Type Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Record Type
            </label>
            <div className="flex flex-wrap gap-2">
              {DNS_RECORD_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setRecordType(type.value)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                    recordType === type.value
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                  title={type.description}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* DNS Server Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              DNS Servers
            </label>
            <div className="flex flex-wrap gap-2">
              {DNS_SERVERS.map((server) => (
                <button
                  key={server.id}
                  onClick={() => toggleServer(server.id)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors flex items-center gap-2 ${
                    selectedServers.includes(server.id)
                      ? 'bg-primary-50 text-primary-700 border-primary-300'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Server className="w-3.5 h-3.5" />
                  {server.name}
                  <span className="text-xs opacity-70">{server.ip}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Lookups */}
          {recentLookups.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Recent Lookups
              </label>
              <div className="flex flex-wrap gap-2">
                {recentLookups.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDomain(d)}
                    className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition-colors"
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="card border-danger-200 bg-danger-50">
          <div className="card-body flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-danger-600 flex-shrink-0" />
            <p className="text-danger-800">{error}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {result.recordType} Records for {result.domain}
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Queried at {result.timestamp.toLocaleTimeString()}
                </p>
              </div>
              <button
                onClick={performLookup}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="card border-warning-200 bg-warning-50">
              <div className="card-body space-y-2">
                {result.warnings.map((warning, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-warning-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-warning-800">{warning}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Insights */}
          {result.insights.length > 0 && (
            <div className="card border-primary-200 bg-primary-50">
              <div className="card-body space-y-2">
                {result.insights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-primary-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-primary-800">{insight}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Server Results */}
          <div className="space-y-3">
            {result.results.map((serverResult) => (
              <div key={serverResult.server} className="card overflow-hidden">
                <button
                  onClick={() => toggleExpandServer(serverResult.server)}
                  className="w-full card-header flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {serverResult.status === 'success' ? (
                      <CheckCircle className="w-5 h-5 text-success-600" />
                    ) : serverResult.status === 'nxdomain' ? (
                      <AlertTriangle className="w-5 h-5 text-warning-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-danger-600" />
                    )}
                    <div className="text-left">
                      <span className="font-medium text-slate-900">{serverResult.server}</span>
                      <span className="text-slate-500 text-sm ml-2">({serverResult.serverIp})</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Clock className="w-4 h-4" />
                      {serverResult.queryTime}ms
                    </div>
                    <span className="text-sm text-slate-600">
                      {serverResult.records.length} record{serverResult.records.length !== 1 ? 's' : ''}
                    </span>
                    {expandedServers.has(serverResult.server) ? (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </button>

                {expandedServers.has(serverResult.server) && (
                  <div className="card-body border-t border-slate-200">
                    {serverResult.error ? (
                      <p className="text-danger-600 text-sm">{serverResult.error}</p>
                    ) : serverResult.records.length === 0 ? (
                      <p className="text-slate-500 text-sm">No records found</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              <th className="pb-2">Type</th>
                              <th className="pb-2">Name</th>
                              <th className="pb-2">Value</th>
                              <th className="pb-2">TTL</th>
                              <th className="pb-2"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {serverResult.records.map((record, i) => (
                              <tr key={i}>
                                <td className="py-2">
                                  <span className="badge-info">{record.type}</span>
                                </td>
                                <td className="py-2 text-sm font-mono text-slate-600">
                                  {record.name}
                                </td>
                                <td className="py-2 text-sm font-mono text-slate-900 max-w-md truncate">
                                  {record.priority !== undefined && (
                                    <span className="text-slate-500 mr-1">[{record.priority}]</span>
                                  )}
                                  {record.data}
                                </td>
                                <td className="py-2 text-sm text-slate-500">
                                  {record.ttl}s
                                </td>
                                <td className="py-2">
                                  <button
                                    onClick={() => copyToClipboard(record.data)}
                                    className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                                    title="Copy value"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Server metadata */}
                    <div className="flex gap-4 mt-3 pt-3 border-t border-slate-100">
                      {serverResult.dnssec && (
                        <span className="text-xs text-success-600 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          DNSSEC Validated
                        </span>
                      )}
                      {serverResult.authoritative && (
                        <span className="text-xs text-primary-600 flex items-center gap-1">
                          <Server className="w-3 h-3" />
                          Authoritative
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Help Section */}
      {!result && !isLoading && (
        <div className="card bg-slate-50 border-slate-200">
          <div className="card-body">
            <h3 className="font-semibold text-slate-900 mb-3">Quick Reference</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium text-slate-700 mb-2">Common Record Types</h4>
                <ul className="space-y-1 text-slate-600">
                  <li><strong>A</strong> - IPv4 address for the domain</li>
                  <li><strong>AAAA</strong> - IPv6 address for the domain</li>
                  <li><strong>CNAME</strong> - Alias to another domain</li>
                  <li><strong>MX</strong> - Mail server with priority</li>
                  <li><strong>TXT</strong> - Text records (SPF, DKIM, etc.)</li>
                  <li><strong>NS</strong> - Authoritative name servers</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-slate-700 mb-2">What to Look For</h4>
                <ul className="space-y-1 text-slate-600">
                  <li>Consistent responses across DNS servers</li>
                  <li>Reasonable TTL values (not too low)</li>
                  <li>DNSSEC validation when available</li>
                  <li>Multiple A/AAAA records for load balancing</li>
                  <li>Proper MX priority ordering</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
