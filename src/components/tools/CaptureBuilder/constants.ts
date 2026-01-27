import { TcpdumpOptions, FortinetOptions, PaloAltoOptions, CiscoAsaOptions } from './types';

// Common interfaces
export const COMMON_INTERFACES = [
  { value: 'any', label: 'any (all interfaces)' },
  { value: 'eth0', label: 'eth0' },
  { value: 'eth1', label: 'eth1' },
  { value: 'ens192', label: 'ens192' },
  { value: 'lo', label: 'lo (loopback)' },
];

export const FORTINET_INTERFACES = [
  { value: 'any', label: 'any (all interfaces)' },
  { value: 'port1', label: 'port1' },
  { value: 'port2', label: 'port2' },
  { value: 'wan1', label: 'wan1' },
  { value: 'wan2', label: 'wan2' },
  { value: 'internal', label: 'internal' },
  { value: 'dmz', label: 'dmz' },
];

export const ASA_INTERFACES = [
  { value: 'inside', label: 'inside' },
  { value: 'outside', label: 'outside' },
  { value: 'dmz', label: 'dmz' },
  { value: 'management', label: 'management' },
];

export const PROTOCOLS = [
  { value: '', label: 'Any' },
  { value: 'tcp', label: 'TCP' },
  { value: 'udp', label: 'UDP' },
  { value: 'icmp', label: 'ICMP' },
  { value: 'arp', label: 'ARP' },
  { value: 'ip', label: 'IP' },
];

export const PALOALTO_PROTOCOLS = [
  { value: '', label: 'Any' },
  { value: '6', label: 'TCP (6)' },
  { value: '17', label: 'UDP (17)' },
  { value: '1', label: 'ICMP (1)' },
  { value: '47', label: 'GRE (47)' },
  { value: '50', label: 'ESP (50)' },
];

// Default values
export const DEFAULT_TCPDUMP_OPTIONS: TcpdumpOptions = {
  interface: 'any',
  customInterface: '',
  packetCount: '',
  snaplen: '',
  noResolveHosts: false,
  noResolvePorts: false,
  verbosity: '',
  hexOutput: '',
  lineBuffered: false,
  printWhileWriting: false,
  timestamp: '',
  writeFile: '',
  readFile: '',
  rotateSize: '',
  rotateSeconds: '',
  rotateCount: '',
};

export const DEFAULT_FORTINET_OPTIONS: FortinetOptions = {
  interface: 'any',
  customInterface: '',
  verbosity: '4',
  packetCount: '0',
  absoluteTimestamp: true,
  debugFlowEnabled: false,
  debugFlowFunction: 'all',
  debugFlowAddress: '',
  debugFlowVerbose: true,
};

export const DEFAULT_PALOALTO_OPTIONS: PaloAltoOptions = {
  filterName: 'capture1',
  sourceIp: '',
  sourceZone: '',
  destIp: '',
  destZone: '',
  sourcePort: '',
  destPort: '',
  protocol: '',
  nonIpFilter: false,
  ethertype: '',
  stageReceive: true,
  stageTransmit: true,
  stageDrop: true,
  stageFirewall: false,
  packetCount: '50',
  byteCount: '',
  fileName: 'capture.pcap',
  includeCounters: false,
  includeSessions: false,
  showGuiSteps: false,
};

export const DEFAULT_CISCOASA_OPTIONS: CiscoAsaOptions = {
  captureName: 'capture1',
  interface: 'inside',
  customInterface: '',
  captureType: 'raw-data',
  direction: 'both',
  accessList: '',
  sourceIp: '',
  sourceMask: '',
  destIp: '',
  destMask: '',
  protocol: '',
  port: '',
  portOperator: 'eq',
  bufferSize: '',
  packetLength: '',
  circularBuffer: false,
  packetCount: '',
  includeShowCapture: true,
  includeShowConn: false,
  includePacketTracer: false,
  packetTracerProtocol: 'tcp',
  packetTracerSourceIp: '',
  packetTracerSourcePort: '',
  packetTracerDestIp: '',
  packetTracerDestPort: '',
};

// Validation warnings
export const WARNINGS = {
  noPacketLimit: 'No packet limit set - capture may run indefinitely',
  captureOnAny: "Capturing on 'any' may impact device performance",
  noFilter: 'No filter specified - capturing all traffic',
  largeBuffer: 'Buffer size over 32MB may impact memory on older devices',
  fullSnaplen: 'Snaplen 0 captures full packets - large file sizes expected',
};
