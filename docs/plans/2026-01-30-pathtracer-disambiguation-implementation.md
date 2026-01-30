# PathTracer Phase 1: Ambiguous IP Resolution - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Handle ambiguous and duplicate IP addressing in PathTracer's device-based tracing mode by adding site-aware disambiguation, candidate selection UI, and trace continuation.

**Architecture:** Add `site` field to device model, change lookup methods to return candidate lists with longest-prefix-match, add disambiguation logic to orchestrator, update API response format, and add candidate selection UI to the frontend.

**Tech Stack:** Python (backend: models, discovery, orchestrator, API), React/TypeScript/Tailwind CSS (frontend)

---

## Task 1: Add `site` field and new types to models.py

**Files:**
- Modify: `pathtracer/models.py`

**Step 1: Add `site` field to NetworkDevice**

At line 47, add `site` to the `NetworkDevice` dataclass:

```python
@dataclass
class NetworkDevice:
    hostname: str
    management_ip: str
    vendor: str
    site: Optional[str] = None          # New field - from inventory or NetBox
    device_type: str = "unknown"
    credentials_ref: str = "default"
    logical_contexts: List[str] = field(default_factory=lambda: ["global"])
    subnets: List[str] = field(default_factory=list)
    default_context: str = "global"
    metadata: Dict = field(default_factory=dict)
```

Note: `site` goes after the three required positional fields but before other defaulted fields.

**Step 2: Add new PathStatus values**

Add to the `PathStatus` enum (after `MAX_HOPS_EXCEEDED`):

```python
class PathStatus(Enum):
    COMPLETE = "complete"
    INCOMPLETE = "incomplete"
    ERROR = "error"
    LOOP_DETECTED = "loop_detected"
    BLACKHOLED = "blackholed"
    MAX_HOPS_EXCEEDED = "max_hops_exceeded"
    NEEDS_INPUT = "needs_input"
    AMBIGUOUS_HOP = "ambiguous_hop"
```

**Step 3: Add ResolveResult dataclass**

Add after the `TracePath` class:

```python
@dataclass
class ResolveResult:
    """Result of resolving an IP to a device, with disambiguation status."""
    device: Optional[NetworkDevice]
    status: str  # resolved, resolved_by_site, not_found, ambiguous
    candidates: List[NetworkDevice] = field(default_factory=list)
```

**Step 4: Commit**

```bash
git add pathtracer/models.py
git commit -m "feat(pathtracer): add site field, ResolveResult, and new PathStatus values"
```

---

## Task 2: Update DeviceInventory lookup methods

**Files:**
- Modify: `pathtracer/discovery.py`

**Step 1: Update `add_device` to store all devices per subnet (not overwrite)**

The current `subnet_map` is `Dict[str, NetworkDevice]` which overwrites on duplicate subnets. Change to `Dict[str, List[NetworkDevice]]`:

```python
def __init__(self, inventory_file: str = None):
    self.devices: List[NetworkDevice] = []
    self.subnet_map: Dict[str, List[NetworkDevice]] = {}
    self._load_warnings: List[str] = []
    if inventory_file:
        self.load_from_file(inventory_file)
```

Update `add_device`:

```python
def add_device(self, device: NetworkDevice) -> None:
    # Detect duplicate management IPs
    for existing in self.devices:
        if existing.management_ip == device.management_ip and existing.hostname != device.hostname:
            warning = f"Duplicate management IP {device.management_ip}: {existing.hostname} and {device.hostname}"
            self._load_warnings.append(warning)
            logger.warning(warning)

    self.devices.append(device)

    for subnet in device.subnets:
        if subnet not in self.subnet_map:
            self.subnet_map[subnet] = []
        else:
            # Check for same-site overlap
            existing_devices = self.subnet_map[subnet]
            for existing in existing_devices:
                if existing.site and device.site and existing.site == device.site:
                    warning = f"Overlapping subnet {subnet} at site {device.site}: {existing.hostname} and {device.hostname}"
                    self._load_warnings.append(warning)
                    logger.warning(warning)
        self.subnet_map[subnet].append(device)
```

**Step 2: Update `load_from_file` to parse `site` field**

In the device creation loop inside `load_from_file`, add `site`:

```python
device = NetworkDevice(
    hostname=dev.get('hostname', ''),
    management_ip=dev.get('management_ip', ''),
    vendor=dev.get('vendor', ''),
    site=dev.get('site'),
    device_type=dev.get('device_type', 'unknown'),
    credentials_ref=dev.get('credentials_ref', 'default'),
    logical_contexts=dev.get('logical_contexts', ['global']),
    subnets=dev.get('subnets', []),
    default_context=dev.get('default_context', 'global'),
    metadata=dev.get('metadata', {}),
)
```

**Step 3: Change `find_device_by_ip` to return list**

```python
def find_device_by_ip(self, ip: str) -> List[NetworkDevice]:
    """Find all devices with this management IP."""
    return [d for d in self.devices if d.management_ip == ip]
```

**Step 4: Change `find_device_for_subnet` to return list with longest-prefix-match**

```python
def find_device_for_subnet(self, ip: str) -> List[NetworkDevice]:
    """Find all devices owning a subnet that contains this IP, using longest prefix match."""
    from pathtracer.utils.ip_utils import ip_in_network, get_prefix_length

    matches: List[tuple] = []  # (prefix_length, device)
    for subnet, devices in self.subnet_map.items():
        if ip_in_network(ip, subnet):
            prefix_len = get_prefix_length(subnet)
            for device in devices:
                matches.append((prefix_len, device))

    if not matches:
        return []

    # Find the longest prefix length
    longest = max(m[0] for m in matches)
    # Return only devices at the longest prefix length
    return [d for plen, d in matches if plen == longest]
```

**Step 5: Add `get_warnings` method**

```python
def get_warnings(self) -> List[str]:
    """Return any warnings generated during inventory loading."""
    return list(self._load_warnings)
```

**Step 6: Update `export_to_dict` to include `site`**

In the device dict construction inside `export_to_dict`, add `site`:

```python
{
    'hostname': d.hostname,
    'management_ip': d.management_ip,
    'vendor': d.vendor,
    'site': d.site,
    'device_type': d.device_type,
    # ... rest unchanged
}
```

**Step 7: Commit**

```bash
git add pathtracer/discovery.py
git commit -m "feat(pathtracer): multi-candidate lookups with longest-prefix-match and duplicate detection"
```

---

## Task 3: Update orchestrator disambiguation logic

**Files:**
- Modify: `pathtracer/orchestrator.py`

**Step 1: Add import for ResolveResult**

Add to the imports from models:

```python
from pathtracer.models import (
    NetworkDevice, RouteEntry, PathHop, TracePath,
    PathStatus, ConnectionConfig, CredentialSet,
    DeviceNotFoundError, RoutingLoopDetected, MaxHopsExceeded,
    ResolveResult,  # New
)
```

**Step 2: Add `_resolve_device` method**

Add after `_find_next_device`:

```python
def _resolve_device(self, ip: str, previous_hop: Optional[PathHop] = None) -> ResolveResult:
    """Resolve an IP to a device, with site-affinity disambiguation."""
    # Stage 1: Find candidates by management IP
    candidates = self.inventory.find_device_by_ip(ip)

    # Stage 2: Fall back to subnet match
    if not candidates:
        candidates = self.inventory.find_device_for_subnet(ip)

    # Stage 3: Evaluate
    if len(candidates) == 0:
        return ResolveResult(device=None, status="not_found", candidates=[])

    if len(candidates) == 1:
        return ResolveResult(device=candidates[0], status="resolved", candidates=candidates)

    # Stage 4: Disambiguate by site affinity
    if previous_hop and previous_hop.device.site:
        same_site = [c for c in candidates if c.site == previous_hop.device.site]
        if len(same_site) == 1:
            return ResolveResult(device=same_site[0], status="resolved_by_site", candidates=candidates)
        if len(same_site) > 1:
            return ResolveResult(device=None, status="ambiguous", candidates=same_site)
        # No devices at the same site - return all as ambiguous
        return ResolveResult(device=None, status="ambiguous", candidates=candidates)

    # No previous hop context (source IP case) - ambiguous
    return ResolveResult(device=None, status="ambiguous", candidates=candidates)
```

**Step 3: Update `trace_path` to use `_resolve_device` for starting device**

Replace the starting device lookup block (lines ~54-65) with:

```python
# Find starting device
if start_device:
    current_device = self.inventory.find_device_by_hostname(start_device)
    if not current_device:
        raise DeviceNotFoundError(
            f"Start device '{start_device}' not found in inventory"
        )
else:
    result = self._resolve_device(source_ip)
    if result.status == "not_found":
        path.status = PathStatus.NEEDS_INPUT
        path.error_message = "Source IP not found in inventory. Please specify a starting device."
        path.metadata['candidates'] = []
        path.total_time_ms = (time.time() - start_time) * 1000
        return path
    elif result.status == "ambiguous":
        path.status = PathStatus.NEEDS_INPUT
        path.error_message = f"Source IP {source_ip} matches multiple devices. Please select a starting device."
        path.metadata['candidates'] = [
            {'hostname': c.hostname, 'management_ip': c.management_ip, 'site': c.site, 'vendor': c.vendor}
            for c in result.candidates
        ]
        path.total_time_ms = (time.time() - start_time) * 1000
        return path
    else:
        current_device = result.device
```

**Step 4: Update the main loop's next-device lookup to use `_resolve_device`**

Replace the `_find_next_device` call in the main loop (around lines 145-150) with:

```python
# Find next hop device
previous_hop = path.hops[-1] if path.hops else None
resolve_result = self._resolve_device(route.next_hop, previous_hop=previous_hop)

if resolve_result.status == "not_found":
    path.status = PathStatus.INCOMPLETE
    path.error_message = f"Next hop device not found for {route.next_hop}"
    logger.warning(path.error_message)
    break
elif resolve_result.status == "ambiguous":
    path.status = PathStatus.AMBIGUOUS_HOP
    path.error_message = f"Next hop {route.next_hop} matches multiple devices. Please select one to continue."
    path.metadata['ambiguous_hop_sequence'] = hop_sequence + 1
    path.metadata['candidates'] = [
        {'hostname': c.hostname, 'management_ip': c.management_ip, 'site': c.site, 'vendor': c.vendor}
        for c in resolve_result.candidates
    ]
    logger.warning(path.error_message)
    break
else:
    next_device = resolve_result.device
    if resolve_result.status == "resolved_by_site":
        logger.info(f"Resolved {route.next_hop} to {next_device.hostname} via site affinity ({next_device.site})")
```

**Step 5: Remove old `_find_next_device` method**

Delete the `_find_next_device` method entirely since `_resolve_device` replaces it.

**Step 6: Commit**

```bash
git add pathtracer/orchestrator.py
git commit -m "feat(pathtracer): add site-aware disambiguation to orchestrator"
```

---

## Task 4: Update API endpoint

**Files:**
- Modify: `api/traceroute.py`

**Step 1: Update the `perform_device_trace` response to include candidates and warnings**

In the `perform_device_trace` function, after calling `tracer.trace_path()`, update the response construction to include:

```python
# Build response
response = {
    'source_ip': trace_path.source_ip,
    'destination_ip': trace_path.destination_ip,
    'status': trace_path.status.value,
    'hops': hops_data,
    'hop_count': trace_path.hop_count(),
    'total_time_ms': trace_path.total_time_ms,
    'error_message': trace_path.error_message,
    'candidates': trace_path.metadata.get('candidates', []),
    'ambiguous_hop_sequence': trace_path.metadata.get('ambiguous_hop_sequence'),
    'inventory_warnings': inventory.get_warnings(),
}
```

**Step 2: Update the device-based API endpoint response**

In the `POST /api/traceroute/device-based` endpoint handler, pass through the new fields:

```python
result = perform_device_trace(
    source_ip=source,
    destination_ip=destination,
    inventory_file=inventory_file,
    start_device=start_device,
    source_context=source_context,
    netbox_url=netbox_url,
    netbox_token=netbox_token
)

return jsonify({
    'mode': 'device-based',
    **result,
    'startTime': start_time.isoformat(),
    'endTime': datetime.utcnow().isoformat(),
})
```

Ensure the response includes `candidates`, `ambiguous_hop_sequence`, and `inventory_warnings` when present.

**Step 3: Update the `perform_device_trace` to pass `site` in device data**

In the hop_data construction loop, add `site` to the device dict:

```python
hop_data = {
    'sequence': hop.sequence,
    'device': {
        'hostname': hop.device.hostname,
        'management_ip': hop.device.management_ip,
        'vendor': hop.device.vendor,
        'device_type': hop.device.device_type,
        'site': hop.device.site,
    },
    # ... rest unchanged
}
```

**Step 4: Commit**

```bash
git add api/traceroute.py
git commit -m "feat(pathtracer): update API to return candidates and warnings"
```

---

## Task 5: Update frontend types

**Files:**
- Modify: `src/components/tools/PathTracer.tsx`

**Step 1: Add `site` to DeviceHop device interface**

Update the `DeviceHop` interface (around line 29):

```typescript
interface DeviceHop {
  sequence: number;
  device: {
    hostname: string;
    management_ip: string;
    vendor: string;
    device_type: string;
    site?: string;
    netbox?: NetBoxDevice;
  };
  egress_interface?: string;
  logical_context: string;
  lookup_time_ms: number;
  route?: {
    destination: string;
    next_hop: string;
    next_hop_type: string;
    protocol: string;
    metric: number;
    preference: number;
  };
}
```

**Step 2: Add DeviceCandidate interface**

Add after the existing interfaces:

```typescript
interface DeviceCandidate {
  hostname: string;
  management_ip: string;
  site?: string;
  vendor: string;
}
```

**Step 3: Update TraceResult interface**

Add new fields to `TraceResult`:

```typescript
interface TraceResult {
  mode: 'icmp' | 'device-based';
  sourceIp: string;
  destinationIp: string;
  hops: ICMPHop[] | DeviceHop[];
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'complete' | 'error' | 'needs_input' | 'ambiguous_hop' | string;
  error?: string;
  hop_count?: number;
  total_time_ms?: number;
  error_message?: string;
  candidates?: DeviceCandidate[];
  ambiguous_hop_sequence?: number;
  inventory_warnings?: string[];
}
```

**Step 4: Commit**

```bash
git add src/components/tools/PathTracer.tsx
git commit -m "feat(pathtracer): add disambiguation types to frontend"
```

---

## Task 6: Add candidate selection UI for source IP

**Files:**
- Modify: `src/components/tools/PathTracer.tsx`

**Step 1: Update `startTrace` to handle `needs_input` status**

In the `startTrace` function, after processing the API response, handle the new status:

```typescript
const data = await response.json();

if (data.status === 'needs_input' || data.status === 'ambiguous_hop') {
  setTraceResult({
    mode: data.mode || 'device-based',
    sourceIp: sourceIp,
    destinationIp: destinationIp,
    hops: data.hops || [],
    startTime: new Date(data.startTime),
    endTime: data.endTime ? new Date(data.endTime) : undefined,
    status: data.status,
    error_message: data.error_message,
    candidates: data.candidates || [],
    ambiguous_hop_sequence: data.ambiguous_hop_sequence,
    hop_count: data.hop_count,
    total_time_ms: data.total_time_ms,
    inventory_warnings: data.inventory_warnings,
  });
  setIsTracing(false);
  return;
}
```

**Step 2: Add candidate selection handler**

Add after the existing handlers:

```typescript
const handleSelectCandidate = useCallback((candidate: DeviceCandidate) => {
  if (traceResult?.status === 'needs_input') {
    // Source IP ambiguity - set start device and re-trace
    setStartDevice(candidate.hostname);
    // Auto-trigger trace with the selected device
    // We'll set a flag that triggers trace on next render
    setSelectedCandidate(candidate);
  }
}, [traceResult]);
```

Add new state variable:

```typescript
const [selectedCandidate, setSelectedCandidate] = useState<DeviceCandidate | null>(null);
```

Add an effect to auto-retry when a candidate is selected:

```typescript
useEffect(() => {
  if (selectedCandidate && !isTracing) {
    setSelectedCandidate(null);
    startTrace();
  }
}, [selectedCandidate, startDevice]);
```

**Step 3: Add candidate selection UI**

Add after the error display section (around line 440), before the hops list:

```tsx
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
            key={`${candidate.hostname}-${candidate.site}`}
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
```

**Step 4: Commit**

```bash
git add src/components/tools/PathTracer.tsx
git commit -m "feat(pathtracer): add source IP candidate selection UI"
```

---

## Task 7: Add mid-path ambiguity UI and trace continuation

**Files:**
- Modify: `src/components/tools/PathTracer.tsx`

**Step 1: Add continuation handler**

```typescript
const handleContinueTrace = useCallback(async (candidate: DeviceCandidate) => {
  if (!traceResult || traceResult.status !== 'ambiguous_hop') return;

  setIsTracing(true);

  try {
    const response = await fetch('/api/traceroute/device-based', {
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
      throw new Error(`Trace failed: ${response.status}`);
    }

    const data = await response.json();

    // Stitch the continuation onto the existing partial path
    const existingHops = traceResult.hops as DeviceHop[];
    const continuationHops = (data.hops || []).map((hop: DeviceHop, i: number) => ({
      ...hop,
      sequence: existingHops.length + i + 1,
    }));

    setTraceResult({
      ...traceResult,
      hops: [...existingHops, ...continuationHops],
      status: data.status,
      error_message: data.error_message,
      endTime: data.endTime ? new Date(data.endTime) : undefined,
      hop_count: existingHops.length + (data.hop_count || 0),
      total_time_ms: (traceResult.total_time_ms || 0) + (data.total_time_ms || 0),
      candidates: data.candidates,
      ambiguous_hop_sequence: data.ambiguous_hop_sequence,
    });
  } catch (err) {
    setTraceResult((prev) =>
      prev
        ? { ...prev, status: 'error', error: String(err) }
        : null
    );
  } finally {
    setIsTracing(false);
  }
}, [traceResult, sourceIp, destinationIp, sourceContext, inventoryFile, netboxUrl, netboxToken]);
```

**Step 2: Add mid-path ambiguity UI**

Add after the hops list, before the completion summary:

```tsx
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
          key={`${candidate.hostname}-${candidate.site}`}
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
```

**Step 3: Add site badge to device-based hop display**

In the existing hop display for device-based hops (the collapsed view, around line 490), add site badge after the vendor badge:

```tsx
{hop.device.site && (
  <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full">
    {hop.device.site}
  </span>
)}
```

**Step 4: Show inventory warnings**

Add after the info banner section (around line 406), if warnings exist:

```tsx
{traceResult?.inventory_warnings && traceResult.inventory_warnings.length > 0 && (
  <div className="card">
    <div className="card-body">
      <div className="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg p-3">
        <p className="text-sm font-medium text-warning-800 dark:text-warning-200 mb-2">
          Inventory warnings:
        </p>
        <ul className="text-sm text-warning-700 dark:text-warning-300 space-y-1">
          {traceResult.inventory_warnings.map((warning, i) => (
            <li key={i}>{warning}</li>
          ))}
        </ul>
      </div>
    </div>
  </div>
)}
```

**Step 5: Commit**

```bash
git add src/components/tools/PathTracer.tsx
git commit -m "feat(pathtracer): add mid-path ambiguity UI and trace continuation"
```

---

## Task 8: Build verification and integration test

**Step 1: Verify frontend builds**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

**Step 2: Verify backend imports**

```bash
cd pathtracer && python -c "
from models import NetworkDevice, PathStatus, ResolveResult
from discovery import DeviceInventory

# Test site field
d = NetworkDevice(hostname='test', management_ip='10.0.0.1', vendor='cisco_ios', site='dc-east')
assert d.site == 'dc-east'

# Test new PathStatus values
assert PathStatus.NEEDS_INPUT.value == 'needs_input'
assert PathStatus.AMBIGUOUS_HOP.value == 'ambiguous_hop'

# Test ResolveResult
r = ResolveResult(device=d, status='resolved', candidates=[d])
assert r.device.hostname == 'test'

# Test multi-candidate subnet_map
inv = DeviceInventory()
d1 = NetworkDevice(hostname='spine-east', management_ip='10.255.0.1', vendor='arista_eos', site='dc-east', subnets=['10.255.0.0/24'])
d2 = NetworkDevice(hostname='spine-west', management_ip='10.255.0.1', vendor='arista_eos', site='dc-west', subnets=['10.255.0.0/24'])
inv.add_device(d1)
inv.add_device(d2)

# find_device_by_ip should return both
results = inv.find_device_by_ip('10.255.0.1')
assert len(results) == 2

# find_device_for_subnet should return both
results = inv.find_device_for_subnet('10.255.0.5')
assert len(results) == 2

# Warnings should be generated
assert len(inv.get_warnings()) > 0

print('All backend tests passed')
"
```

**Step 3: Commit if any fixes needed**

```bash
git add -A
git commit -m "fix(pathtracer): fixes from integration testing"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add site field, ResolveResult, new PathStatus values | models.py |
| 2 | Multi-candidate lookups, longest-prefix-match, duplicate detection | discovery.py |
| 3 | Site-aware disambiguation in orchestrator | orchestrator.py |
| 4 | API response with candidates and warnings | api/traceroute.py |
| 5 | Frontend types for disambiguation | PathTracer.tsx |
| 6 | Source IP candidate selection UI | PathTracer.tsx |
| 7 | Mid-path ambiguity UI and trace continuation | PathTracer.tsx |
| 8 | Build verification and integration test | All files |
