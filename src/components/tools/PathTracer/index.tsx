import { useState, useCallback, useEffect } from 'react';
import {
  Route,
  Play,
  AlertCircle,
  CheckCircle,
  Clock,
  Globe,
  MapPin,
  Info,
  ChevronDown,
  ChevronRight,
  Activity,
} from 'lucide-react';
import type { ICMPHop, DeviceHop, DeviceCandidate, TraceResult, TraceRequestBody } from './types';
import { PathDiagram } from './diagram';

export default function PathTracer() {
  const [sourceIp, setSourceIp] = useState('');
  const [destinationIp, setDestinationIp] = useState('');
  const [traceResult, setTraceResult] = useState<TraceResult | null>(null);
  const [isTracing, setIsTracing] = useState(false);
  const [expandedHops, setExpandedHops] = useState<Set<number>>(new Set());
  const [netboxUrl, setNetboxUrl] = useState('');
  const [netboxToken, setNetboxToken] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // Device-based trace options
  const [traceMode, setTraceMode] = useState<'icmp' | 'device-based'>('icmp');
  const [startDevice, setStartDevice] = useState('');
  const [sourceContext, setSourceContext] = useState('');
  const [inventoryFile, setInventoryFile] = useState('');
  const [protocol, setProtocol] = useState('tcp');
  const [destinationPort, setDestinationPort] = useState('443');

  // Candidate selection state
  const [selectedCandidate, setSelectedCandidate] = useState<DeviceCandidate | null>(null);

  const toggleHop = useCallback((ttl: number) => {
    setExpandedHops(prev => {
      const next = new Set(prev);
      if (next.has(ttl)) {
        next.delete(ttl);
      } else {
        next.add(ttl);
      }
      return next;
    });
  }, []);

  const startTrace = useCallback(async () => {
    if (!sourceIp || !destinationIp) return;

    setIsTracing(true);
    setTraceResult({
      mode: traceMode,
      sourceIp,
      destinationIp,
      hops: [],
      startTime: new Date(),
      status: 'running',
    });

    try {
      // Choose API endpoint based on mode
      const endpoint = traceMode === 'device-based'
        ? '/pathtrace/api/traceroute/device-based'
        : '/pathtrace/api/traceroute';

      const requestBody: TraceRequestBody = {
        source: sourceIp,
        destination: destinationIp,
        netboxUrl: netboxUrl || undefined,
        netboxToken: netboxToken || undefined,
      };

      // Add device-based specific parameters
      if (traceMode === 'device-based') {
        if (startDevice) requestBody.startDevice = startDevice;
        if (sourceContext) requestBody.sourceContext = sourceContext;
        if (inventoryFile) requestBody.inventoryFile = inventoryFile;
        if (protocol) requestBody.protocol = protocol;
        if (destinationPort) requestBody.destinationPort = parseInt(destinationPort, 10);
      }

      // Call backend API
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API returned ${response.status}`);
      }

      const result = await response.json();

      if (result.status === 'needs_input' || result.status === 'ambiguous_hop') {
        setTraceResult({
          mode: result.mode || 'device-based',
          sourceIp: sourceIp,
          destinationIp: destinationIp,
          hops: result.hops || [],
          startTime: new Date(result.startTime),
          endTime: result.endTime ? new Date(result.endTime) : undefined,
          status: result.status,
          error_message: result.error_message,
          candidates: result.candidates || [],
          ambiguous_hop_sequence: result.ambiguous_hop_sequence,
          hop_count: result.hop_count,
          total_time_ms: result.total_time_ms,
          inventory_warnings: result.inventory_warnings,
        });
        setIsTracing(false);
        return;
      }

      setTraceResult({
        mode: result.mode || traceMode,
        sourceIp,
        destinationIp,
        hops: result.hops,
        startTime: new Date(result.startTime),
        endTime: new Date(result.endTime),
        status: result.status || 'complete',
        hop_count: result.hop_count,
        total_time_ms: result.total_time_ms,
        error_message: result.error_message,
        inventory_warnings: result.inventory_warnings,
      });
    } catch (error) {
      setTraceResult(prev => ({
        ...prev!,
        status: 'error',
        endTime: new Date(),
        error: error instanceof Error ? error.message : 'Trace failed',
      }));
    } finally {
      setIsTracing(false);
    }
  }, [sourceIp, destinationIp, netboxUrl, netboxToken, traceMode, startDevice, sourceContext, inventoryFile, protocol, destinationPort]);

  const handleSelectCandidate = useCallback((candidate: DeviceCandidate) => {
    if (traceResult?.status === 'needs_input') {
      // Source IP ambiguity - set start device and re-trace
      setStartDevice(candidate.hostname);
      setSelectedCandidate(candidate);
    }
  }, [traceResult]);

  const handleContinueTrace = useCallback(async (candidate: DeviceCandidate) => {
    if (!traceResult || traceResult.status !== 'ambiguous_hop') return;

    setIsTracing(true);

    try {
      const response = await fetch('/pathtrace/api/traceroute/device-based', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: sourceIp,
          destination: destinationIp,
          startDevice: candidate.hostname,
          sourceContext: sourceContext,
          inventoryFile: inventoryFile,
          netboxUrl: netboxUrl || undefined,
          netboxToken: netboxToken || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API returned ${response.status}`);
      }

      const data = await response.json();

      // Stitch the continuation onto the existing partial path
      setTraceResult((prev) => {
        if (!prev) return null;
        const existingHops = prev.hops as DeviceHop[];
        const continuationHops = (data.hops || []).map((hop: DeviceHop, i: number) => ({
          ...hop,
          sequence: existingHops.length + i + 1,
        }));
        return {
          ...prev,
          hops: [...existingHops, ...continuationHops],
          status: data.status,
          error_message: data.error_message,
          endTime: data.endTime ? new Date(data.endTime) : undefined,
          hop_count: existingHops.length + (data.hop_count || 0),
          total_time_ms: (prev.total_time_ms || 0) + (data.total_time_ms || 0),
          candidates: data.candidates,
          ambiguous_hop_sequence: data.ambiguous_hop_sequence,
          inventory_warnings: data.inventory_warnings,
        };
      });
    } catch (err) {
      setTraceResult((prev) =>
        prev
          ? { ...prev, status: 'error', error: err instanceof Error ? err.message : 'Trace failed' }
          : null
      );
    } finally {
      setIsTracing(false);
    }
  }, [traceResult, sourceIp, destinationIp, sourceContext, inventoryFile, netboxUrl, netboxToken]);

  useEffect(() => {
    if (selectedCandidate && !isTracing) {
      setSelectedCandidate(null);
      startTrace();
    }
  }, [selectedCandidate, isTracing, startTrace]);

  const getHopColor = (hop: ICMPHop | DeviceHop) => {
    // For ICMP hops, use RTT
    if ('rtt' in hop) {
      if (hop.rtt < 10) return 'text-success-600 dark:text-success-400';
      if (hop.rtt < 50) return 'text-warning-600 dark:text-warning-400';
      return 'text-danger-600 dark:text-danger-400';
    }
    // For device-based hops, use lookup time
    if ('lookup_time_ms' in hop) {
      if (hop.lookup_time_ms < 1000) return 'text-success-600 dark:text-success-400';
      if (hop.lookup_time_ms < 3000) return 'text-warning-600 dark:text-warning-400';
      return 'text-danger-600 dark:text-danger-400';
    }
    return 'text-slate-600 dark:text-slate-400';
  };

  const getHopKey = (hop: ICMPHop | DeviceHop): number => {
    return 'ttl' in hop ? hop.ttl : hop.sequence;
  };

  const isICMPHop = (hop: ICMPHop | DeviceHop): hop is ICMPHop => {
    return 'ttl' in hop;
  };

  const isDeviceHop = (hop: ICMPHop | DeviceHop): hop is DeviceHop => {
    return 'sequence' in hop;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Path Tracer</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Layer 3 hop-by-hop path discovery with NetBox device lookup
        </p>
      </div>

      {/* Settings Panel */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 dark:text-white">Configuration</h2>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
          >
            {showSettings ? 'Hide' : 'Show'} Advanced Settings
          </button>
        </div>
        <div className="card-body space-y-4">
          {/* Trace Mode Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Trace Mode
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="icmp"
                  checked={traceMode === 'icmp'}
                  onChange={(e) => setTraceMode(e.target.value as 'icmp')}
                  disabled={isTracing}
                  className="w-4 h-4 text-primary-600"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  ICMP Traceroute <span className="text-slate-500 dark:text-slate-400">(Fast, works anywhere)</span>
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="device-based"
                  checked={traceMode === 'device-based'}
                  onChange={(e) => setTraceMode(e.target.value as 'device-based')}
                  disabled={isTracing}
                  className="w-4 h-4 text-primary-600"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Device-Based <span className="text-slate-500 dark:text-slate-400">(Routing tables, VRF-aware)</span>
                </span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Source IP Address
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={sourceIp}
                  onChange={(e) => setSourceIp(e.target.value)}
                  placeholder="192.168.1.1"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  disabled={isTracing}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Destination IP Address
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={destinationIp}
                  onChange={(e) => setDestinationIp(e.target.value)}
                  placeholder="8.8.8.8"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  disabled={isTracing}
                />
              </div>
            </div>
          </div>

          {showSettings && (
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              {/* Device-Based Options */}
              {traceMode === 'device-based' && (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 p-4 bg-primary-50 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-800 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Start Device (Optional)
                    </label>
                    <input
                      type="text"
                      value={startDevice}
                      onChange={(e) => setStartDevice(e.target.value)}
                      placeholder="core-rtr-01"
                      className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                      disabled={isTracing}
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Override starting device</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Source VRF/Context (Optional)
                    </label>
                    <input
                      type="text"
                      value={sourceContext}
                      onChange={(e) => setSourceContext(e.target.value)}
                      placeholder="VRF_CORP"
                      className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                      disabled={isTracing}
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">VRF or virtual router name</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Inventory File (Optional)
                    </label>
                    <input
                      type="text"
                      value={inventoryFile}
                      onChange={(e) => setInventoryFile(e.target.value)}
                      placeholder="inventory.yaml"
                      className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                      disabled={isTracing}
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Path to inventory file</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Protocol (Optional)
                    </label>
                    <select
                      value={protocol}
                      onChange={(e) => setProtocol(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                      disabled={isTracing}
                    >
                      <option value="tcp">TCP</option>
                      <option value="udp">UDP</option>
                      <option value="icmp">ICMP</option>
                    </select>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">For firewall policy lookup</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Dest Port (Optional)
                    </label>
                    <input
                      type="text"
                      value={destinationPort}
                      onChange={(e) => setDestinationPort(e.target.value)}
                      placeholder="443"
                      className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                      disabled={isTracing}
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">For firewall policy lookup</p>
                  </div>
                </div>
              )}

              {/* NetBox Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    NetBox URL (Optional)
                  </label>
                  <input
                    type="text"
                    value={netboxUrl}
                    onChange={(e) => setNetboxUrl(e.target.value)}
                    placeholder="https://netbox.example.com"
                    className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    disabled={isTracing}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    NetBox API Token (Optional)
                  </label>
                  <input
                    type="password"
                    value={netboxToken}
                    onChange={(e) => setNetboxToken(e.target.value)}
                    placeholder="API token"
                    className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    disabled={isTracing}
                  />
                </div>
              </div>
            </div>
          )}

          <button
            onClick={startTrace}
            disabled={isTracing || !sourceIp || !destinationIp}
            className="btn-primary inline-flex items-center gap-2"
          >
            {isTracing ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                Tracing Path...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start Trace
              </>
            )}
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 bg-primary-50 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-800 rounded-lg">
        <Info className="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-primary-800 dark:text-primary-200">
          <p className="font-medium mb-1">Two Trace Modes Available</p>
          <p className="text-primary-700 dark:text-primary-300">
            <strong>ICMP Traceroute:</strong> Fast, works from any source. Uses ICMP packets with incrementing TTL.<br />
            <strong>Device-Based:</strong> SSH into network devices to query routing tables. Shows actual forwarding paths,
            works through firewalls, VRF-aware. Requires device inventory and credentials.
          </p>
        </div>
      </div>

      {/* Trace Results */}
      {traceResult && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Route className="w-5 h-5 text-primary-600" />
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white">Path Trace Results</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {traceResult.sourceIp} → {traceResult.destinationIp}
                </p>
              </div>
            </div>
            {traceResult.status === 'running' && (
              <span className="badge-info">Running</span>
            )}
            {traceResult.status === 'complete' && (
              <span className="badge-success">Complete</span>
            )}
            {traceResult.status === 'error' && (
              <span className="badge-danger">Error</span>
            )}
            {traceResult.status === 'needs_input' && (
              <span className="badge-warning">Needs Input</span>
            )}
            {traceResult.status === 'ambiguous_hop' && (
              <span className="badge-warning">Ambiguous Hop</span>
            )}
          </div>

          <div className="card-body">
            {traceResult.status === 'error' && (
              <div className="flex items-start gap-3 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg mb-4">
                <AlertCircle className="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-danger-900 dark:text-danger-200">Trace Failed</p>
                  <p className="text-sm text-danger-700 dark:text-danger-300 mt-1">{traceResult.error}</p>
                </div>
              </div>
            )}

            {traceResult.inventory_warnings && traceResult.inventory_warnings.length > 0 && (
              <div className="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg p-3 mb-4">
                <p className="text-sm font-medium text-warning-800 dark:text-warning-200 mb-2">
                  Inventory warnings:
                </p>
                <ul className="text-sm text-warning-700 dark:text-warning-300 space-y-1">
                  {traceResult.inventory_warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Candidate Selection - Source IP ambiguity */}
            {traceResult.status === 'needs_input' && traceResult.candidates && (
              <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                <div className="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg p-4 mb-4">
                  <p className="text-sm text-warning-800 dark:text-warning-200">
                    {traceResult.error_message}
                  </p>
                </div>
                {traceResult.candidates.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                      Select a starting device:
                    </p>
                    {traceResult.candidates.map((candidate) => (
                      <button
                        key={`${candidate.hostname}-${candidate.management_ip}`}
                        onClick={() => handleSelectCandidate(candidate)}
                        className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-left transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">
                              {candidate.hostname}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {candidate.management_ip}
                              {candidate.site && ` • ${candidate.site}`}
                            </p>
                          </div>
                          <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                            {candidate.vendor}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                      No matching devices found. Enter a starting device manually:
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={startDevice}
                        onChange={(e) => setStartDevice(e.target.value)}
                        placeholder="hostname"
                        aria-label="Starting device hostname"
                        className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                      <button
                        onClick={() => startTrace()}
                        disabled={!startDevice}
                        className="btn-primary"
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {traceResult.hops.length > 0 ? (
              traceResult.mode === 'device-based' ? (
                <PathDiagram
                  hops={traceResult.hops as DeviceHop[]}
                  totalPathMs={traceResult.total_time_ms || 0}
                />
              ) : (
              <div className="space-y-2">
                {traceResult.hops.map((hop) => {
                  const hopKey = getHopKey(hop);
                  const isExpanded = expandedHops.has(hopKey);

                  return (
                    <div
                      key={hopKey}
                      className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() => toggleHop(hopKey)}
                        className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )}

                        {/* Hop Number */}
                        <div className="flex items-center gap-2 min-w-[3rem]">
                          <span className="text-sm font-medium text-slate-900 dark:text-white">
                            {isICMPHop(hop) ? `Hop ${hop.ttl}` : `Hop ${hop.sequence}`}
                          </span>
                        </div>

                        {/* Hop Content */}
                        <div className="flex-1">
                          {isICMPHop(hop) ? (
                            /* ICMP Hop Display */
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-slate-900 dark:text-white">
                                {hop.timeout ? '*' : hop.ip}
                              </span>
                              {hop.hostname && (
                                <span className="text-sm text-slate-500 dark:text-slate-400">
                                  ({hop.hostname})
                                </span>
                              )}
                              {hop.device && (
                                <span className="badge-info">{hop.device.name}</span>
                              )}
                            </div>
                          ) : isDeviceHop(hop) ? (
                            /* Device-Based Hop Display */
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-slate-900 dark:text-white">
                                {hop.device.hostname}
                              </span>
                              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                                {hop.device.management_ip}
                              </span>
                              <span className="badge-primary">{hop.device.vendor}</span>
                              {hop.device.site && (
                                <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full">
                                  {hop.device.site}
                                </span>
                              )}
                              {hop.logical_context !== 'global' && hop.logical_context !== 'default' && (
                                <span className="badge-warning">{hop.logical_context}</span>
                              )}
                              {hop.route && (
                                <span className="badge-success">{hop.route.protocol.toUpperCase()}</span>
                              )}
                            </div>
                          ) : null}
                        </div>

                        {/* Timing */}
                        <div className={`flex items-center gap-1 ${getHopColor(hop)}`}>
                          <Activity className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            {isICMPHop(hop) && !hop.timeout && `${hop.rtt.toFixed(2)} ms`}
                            {isDeviceHop(hop) && `${hop.lookup_time_ms.toFixed(0)} ms`}
                            {isICMPHop(hop) && hop.timeout && 'timeout'}
                          </span>
                        </div>
                      </button>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                          <div className="grid grid-cols-2 gap-4 pt-4">
                            {isICMPHop(hop) && hop.device && (
                              /* ICMP NetBox Device Info */
                              <>
                                <div>
                                  <dt className="text-xs text-slate-500 dark:text-slate-400">Device Name</dt>
                                  <dd className="text-sm font-medium text-slate-900 dark:text-white mt-1">
                                    {hop.device.name}
                                  </dd>
                                </div>
                                {hop.device.site && (
                                  <div>
                                    <dt className="text-xs text-slate-500 dark:text-slate-400">Site</dt>
                                    <dd className="text-sm text-slate-900 dark:text-white mt-1">
                                      {hop.device.site}
                                    </dd>
                                  </div>
                                )}
                                {hop.device.role && (
                                  <div>
                                    <dt className="text-xs text-slate-500 dark:text-slate-400">Role</dt>
                                    <dd className="text-sm text-slate-900 dark:text-white mt-1">
                                      {hop.device.role}
                                    </dd>
                                  </div>
                                )}
                                {hop.device.platform && (
                                  <div>
                                    <dt className="text-xs text-slate-500 dark:text-slate-400">Platform</dt>
                                    <dd className="text-sm text-slate-900 dark:text-white mt-1">
                                      {hop.device.platform}
                                    </dd>
                                  </div>
                                )}
                              </>
                            )}
                            {isICMPHop(hop) && hop.asn && (
                              <div>
                                <dt className="text-xs text-slate-500 dark:text-slate-400">ASN</dt>
                                <dd className="text-sm text-slate-900 dark:text-white mt-1">{hop.asn}</dd>
                              </div>
                            )}
                            {isDeviceHop(hop) && (
                              /* Device-Based Hop Detailed Info */
                              <>
                                <div>
                                  <dt className="text-xs text-slate-500 dark:text-slate-400">Device Type</dt>
                                  <dd className="text-sm text-slate-900 dark:text-white mt-1">
                                    {hop.device.device_type}
                                  </dd>
                                </div>
                                {hop.egress_interface && (
                                  <div>
                                    <dt className="text-xs text-slate-500 dark:text-slate-400">Egress Interface</dt>
                                    <dd className="text-sm font-mono text-slate-900 dark:text-white mt-1">
                                      {hop.egress_interface}
                                    </dd>
                                  </div>
                                )}
                                {hop.route && (
                                  <>
                                    <div>
                                      <dt className="text-xs text-slate-500 dark:text-slate-400">Next Hop</dt>
                                      <dd className="text-sm font-mono text-slate-900 dark:text-white mt-1">
                                        {hop.route.next_hop}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-xs text-slate-500 dark:text-slate-400">Route Destination</dt>
                                      <dd className="text-sm font-mono text-slate-900 dark:text-white mt-1">
                                        {hop.route.destination}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-xs text-slate-500 dark:text-slate-400">Metric</dt>
                                      <dd className="text-sm text-slate-900 dark:text-white mt-1">
                                        {hop.route.metric}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-xs text-slate-500 dark:text-slate-400">Admin Distance</dt>
                                      <dd className="text-sm text-slate-900 dark:text-white mt-1">
                                        {hop.route.preference}
                                      </dd>
                                    </div>
                                  </>
                                )}
                                {hop.device.netbox && (
                                  <>
                                    <div>
                                      <dt className="text-xs text-slate-500 dark:text-slate-400">NetBox Name</dt>
                                      <dd className="text-sm text-slate-900 dark:text-white mt-1">
                                        {hop.device.netbox.name}
                                      </dd>
                                    </div>
                                    {hop.device.netbox.site && (
                                      <div>
                                        <dt className="text-xs text-slate-500 dark:text-slate-400">Site</dt>
                                        <dd className="text-sm text-slate-900 dark:text-white mt-1">
                                          {hop.device.netbox.site}
                                        </dd>
                                      </div>
                                    )}
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              )
            ) : traceResult.status === 'running' ? (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-3" />
                <p className="text-slate-600 dark:text-slate-400">Discovering path...</p>
              </div>
            ) : null}

            {/* Mid-path ambiguity - candidate selection */}
            {traceResult.status === 'ambiguous_hop' && traceResult.candidates && (
              <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                <div className="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg p-4 mb-4">
                  <p className="text-sm text-warning-800 dark:text-warning-200">
                    {traceResult.error_message}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                    Select the next hop device to continue tracing:
                  </p>
                  {traceResult.candidates.map((candidate) => (
                    <button
                      key={`${candidate.hostname}-${candidate.management_ip}`}
                      onClick={() => handleContinueTrace(candidate)}
                      disabled={isTracing}
                      className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-left transition-colors disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">
                            {candidate.hostname}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {candidate.management_ip}
                            {candidate.site && ` • ${candidate.site}`}
                          </p>
                        </div>
                        <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                          {candidate.vendor}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {traceResult.endTime && traceResult.status === 'complete' && (
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <CheckCircle className="w-4 h-4 text-success-600" />
                  <span>
                    Trace completed in{' '}
                    {((traceResult.endTime.getTime() - traceResult.startTime.getTime()) / 1000).toFixed(1)}s
                    {' '}with {traceResult.hops.length} hops
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
