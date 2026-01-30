// PathTracer shared types
// All interfaces used by PathTracer and its diagram components.

export interface NetBoxDevice {
  name: string;
  site?: string;
  role?: string;
  platform?: string;
  status?: string;
}

export interface InterfaceDetail {
  name: string;
  description: string;
  status: string;
  speed: string;
  utilisation_in_pct: number | null;
  utilisation_out_pct: number | null;
  errors_in: number;
  errors_out: number;
  discards_in: number;
  discards_out: number;
}

export interface PolicyResult {
  rule_name: string;
  rule_position: number;
  action: string;
  source_zone: string;
  dest_zone: string;
  source_addresses: string[];
  dest_addresses: string[];
  services: string[];
  logging: boolean;
  raw_output?: string;
}

export interface NatTranslation {
  original_ip: string;
  original_port: string | null;
  translated_ip: string;
  translated_port: string | null;
  nat_rule_name: string;
}

export interface NatResult {
  snat: NatTranslation | null;
  dnat: NatTranslation | null;
}

export interface RouteInfo {
  destination: string;
  next_hop: string;
  next_hop_type: string;
  protocol: string;
  metric: number;
  preference: number;
}

export interface DeviceInfo {
  hostname: string;
  management_ip: string;
  vendor: string;
  device_type: string;
  site?: string;
  netbox?: NetBoxDevice;
}

export interface DeviceHop {
  sequence: number;
  device: DeviceInfo;
  ingress_interface?: string;
  egress_interface?: string;
  logical_context: string;
  lookup_time_ms: number;
  resolve_status?: string;
  route?: RouteInfo;
  ingress_detail?: InterfaceDetail | null;
  egress_detail?: InterfaceDetail | null;
  policy_result?: PolicyResult | null;
  nat_result?: NatResult | null;
}

export interface ICMPHop {
  ttl: number;
  ip: string;
  hostname?: string;
  rtt: number;
  device?: NetBoxDevice;
  asn?: string;
  timeout?: boolean;
}

export interface DeviceCandidate {
  hostname: string;
  management_ip: string;
  site?: string;
  vendor: string;
}

export interface TraceResult {
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
