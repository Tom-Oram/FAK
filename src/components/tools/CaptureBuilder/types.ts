// BPF Filter types
export type FilterConditionType = 'protocol' | 'host' | 'port' | 'net' | 'portrange';
export type FilterDirection = 'src' | 'dst' | 'src or dst';
export type FilterOperator = 'and' | 'or';

export interface FilterCondition {
  id: string;
  enabled: boolean;
  not: boolean;
  type: FilterConditionType;
  protocol?: string;
  host?: string;
  port?: number;
  portEnd?: number;
  net?: string;
  direction?: FilterDirection;
}

export interface BpfFilterState {
  conditions: FilterCondition[];
  operators: FilterOperator[];
  rawMode: boolean;
  rawFilter: string;
  isValid: boolean;
  parseError?: string;
}

// Command output types
export interface CommandStep {
  step: number;
  title: string;
  command: string;
  explanation: string;
  flags?: { flag: string; description: string }[];
}

// Validation types
export type ValidationSeverity = 'error' | 'warning';

export interface ValidationMessage {
  field: string;
  message: string;
  severity: ValidationSeverity;
}

// Tcpdump types
export type TcpdumpVerbosity = '' | '-v' | '-vv' | '-vvv';
export type TcpdumpHexOutput = '' | '-x' | '-X' | '-xx' | '-XX';
export type TcpdumpTimestamp = '' | '-t' | '-tt' | '-ttt' | '-tttt' | '-ttttt';

export interface TcpdumpOptions {
  interface: string;
  customInterface: string;
  packetCount: string;
  snaplen: string;
  noResolveHosts: boolean;
  noResolvePorts: boolean;
  verbosity: TcpdumpVerbosity;
  hexOutput: TcpdumpHexOutput;
  lineBuffered: boolean;
  printWhileWriting: boolean;
  timestamp: TcpdumpTimestamp;
  writeFile: string;
  readFile: string;
  rotateSize: string;
  rotateSeconds: string;
  rotateCount: string;
}

// Fortinet types
export type FortinetVerbosity = '1' | '2' | '3' | '4' | '5' | '6';

export interface FortinetOptions {
  interface: string;
  customInterface: string;
  verbosity: FortinetVerbosity;
  packetCount: string;
  absoluteTimestamp: boolean;
  debugFlowEnabled: boolean;
  debugFlowFunction: string;
  debugFlowAddress: string;
  debugFlowVerbose: boolean;
}

// Palo Alto types
export interface PaloAltoOptions {
  filterName: string;
  sourceIp: string;
  sourceZone: string;
  destIp: string;
  destZone: string;
  sourcePort: string;
  destPort: string;
  protocol: string;
  nonIpFilter: boolean;
  ethertype: string;
  stageReceive: boolean;
  stageTransmit: boolean;
  stageDrop: boolean;
  stageFirewall: boolean;
  packetCount: string;
  byteCount: string;
  fileName: string;
  includeCounters: boolean;
  includeSessions: boolean;
  showGuiSteps: boolean;
}

// Cisco ASA types
export type AsaCaptureType = 'raw-data' | 'asp-drop' | 'isakmp' | 'webvpn';
export type AsaDirection = 'both' | 'ingress' | 'egress';

export interface CiscoAsaOptions {
  captureName: string;
  interface: string;
  customInterface: string;
  captureType: AsaCaptureType;
  direction: AsaDirection;
  accessList: string;
  sourceIp: string;
  sourceMask: string;
  destIp: string;
  destMask: string;
  protocol: string;
  port: string;
  portOperator: string;
  bufferSize: string;
  packetLength: string;
  circularBuffer: boolean;
  packetCount: string;
  includeShowCapture: boolean;
  includeShowConn: boolean;
  includePacketTracer: boolean;
  packetTracerProtocol: string;
  packetTracerSourceIp: string;
  packetTracerSourcePort: string;
  packetTracerDestIp: string;
  packetTracerDestPort: string;
}

// Tab type
export type CaptureTab = 'tcpdump' | 'fortinet' | 'paloalto' | 'cisco-asa';
