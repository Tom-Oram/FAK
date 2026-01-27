// PCAP file format types

export interface PcapGlobalHeader {
  magicNumber: number;
  versionMajor: number;
  versionMinor: number;
  thiszone: number;
  sigfigs: number;
  snaplen: number;
  network: number;
}

export interface PcapPacketHeader {
  tsSec: number;
  tsUsec: number;
  inclLen: number;
  origLen: number;
}

// PCAPng types
export interface PcapngSectionHeader {
  byteOrderMagic: number;
  majorVersion: number;
  minorVersion: number;
  sectionLength: bigint;
}

export interface PcapngInterfaceDescription {
  linkType: number;
  snapLen: number;
  name?: string;
  description?: string;
  tsResol?: number;
}

export interface PcapngEnhancedPacket {
  interfaceId: number;
  timestampHigh: number;
  timestampLow: number;
  capturedLength: number;
  originalLength: number;
  data: Uint8Array;
}

// Ethernet frame
export interface EthernetFrame {
  destMac: string;
  srcMac: string;
  etherType: number;
  payload: Uint8Array;
}

// IP Header (v4)
export interface IPv4Header {
  version: number;
  ihl: number;
  dscp: number;
  ecn: number;
  totalLength: number;
  identification: number;
  flags: number;
  fragmentOffset: number;
  ttl: number;
  protocol: number;
  headerChecksum: number;
  srcIp: string;
  destIp: string;
  options?: Uint8Array;
  payload: Uint8Array;
}

// IP Header (v6)
export interface IPv6Header {
  version: number;
  trafficClass: number;
  flowLabel: number;
  payloadLength: number;
  nextHeader: number;
  hopLimit: number;
  srcIp: string;
  destIp: string;
  payload: Uint8Array;
}

// TCP Header
export interface TCPHeader {
  srcPort: number;
  destPort: number;
  seqNumber: number;
  ackNumber: number;
  dataOffset: number;
  flags: {
    fin: boolean;
    syn: boolean;
    rst: boolean;
    psh: boolean;
    ack: boolean;
    urg: boolean;
    ece: boolean;
    cwr: boolean;
  };
  windowSize: number;
  checksum: number;
  urgentPointer: number;
  options?: Uint8Array;
  payload: Uint8Array;
}

// UDP Header
export interface UDPHeader {
  srcPort: number;
  destPort: number;
  length: number;
  checksum: number;
  payload: Uint8Array;
}

// ICMP Header
export interface ICMPHeader {
  type: number;
  code: number;
  checksum: number;
  payload: Uint8Array;
}

// DNS structures
export interface DNSHeader {
  transactionId: number;
  flags: {
    qr: boolean;
    opcode: number;
    aa: boolean;
    tc: boolean;
    rd: boolean;
    ra: boolean;
    z: number;
    rcode: number;
  };
  questions: number;
  answerRRs: number;
  authorityRRs: number;
  additionalRRs: number;
}

export interface DNSQuestion {
  name: string;
  type: number;
  class: number;
}

export interface DNSRecord {
  name: string;
  type: number;
  class: number;
  ttl: number;
  rdlength: number;
  rdata: string;
}

export interface DNSMessage {
  header: DNSHeader;
  questions: DNSQuestion[];
  answers: DNSRecord[];
  authorities: DNSRecord[];
  additionals: DNSRecord[];
}

// HTTP structures
export interface HTTPRequest {
  method: string;
  uri: string;
  version: string;
  headers: Record<string, string>;
  body?: string;
}

export interface HTTPResponse {
  version: string;
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body?: string;
}

// TLS structures
export interface TLSRecord {
  contentType: number;
  version: number;
  length: number;
  fragment: Uint8Array;
}

export interface TLSClientHello {
  version: number;
  random: Uint8Array;
  sessionId: Uint8Array;
  cipherSuites: number[];
  compressionMethods: number[];
  extensions: TLSExtension[];
  sni?: string;
}

export interface TLSServerHello {
  version: number;
  random: Uint8Array;
  sessionId: Uint8Array;
  cipherSuite: number;
  compressionMethod: number;
  extensions: TLSExtension[];
}

export interface TLSExtension {
  type: number;
  length: number;
  data: Uint8Array;
}

// ARP structures
export interface ARPHeader {
  hardwareType: number;
  protocolType: number;
  hardwareSize: number;
  protocolSize: number;
  opcode: number;
  senderMac: string;
  senderIp: string;
  targetMac: string;
  targetIp: string;
}

// Parsed packet structure
export interface ParsedPacket {
  index: number;
  timestamp: Date;
  capturedLength: number;
  originalLength: number;
  ethernet?: EthernetFrame;
  ipv4?: IPv4Header;
  ipv6?: IPv6Header;
  tcp?: TCPHeader;
  udp?: UDPHeader;
  icmp?: ICMPHeader;
  arp?: ARPHeader;
  dns?: DNSMessage;
  http?: HTTPRequest | HTTPResponse;
  tls?: TLSRecord;
  tlsClientHello?: TLSClientHello;
  tlsServerHello?: TLSServerHello;
  raw: Uint8Array;
}

// Analysis result types
export type FindingSeverity = 'critical' | 'warning' | 'info' | 'success';

export interface Finding {
  id: string;
  severity: FindingSeverity;
  category: string;
  title: string;
  description: string;
  details: string[];
  recommendations: string[];
  affectedPackets?: number[];
  metadata?: Record<string, unknown>;
}

export interface ConnectionStats {
  srcIp: string;
  srcPort: number;
  destIp: string;
  destPort: number;
  protocol: 'TCP' | 'UDP';
  packetCount: number;
  byteCount: number;
  startTime: Date;
  endTime: Date;
  state?: string;
  retransmissions?: number;
  rtt?: number[];
}

export interface ProtocolBreakdown {
  protocol: string;
  packetCount: number;
  byteCount: number;
  percentage: number;
}

export interface AnalysisResult {
  fileName: string;
  fileSize: number;
  fileFormat: 'pcap' | 'pcapng';
  captureStartTime?: Date;
  captureEndTime?: Date;
  captureDuration?: number;
  totalPackets: number;
  totalBytes: number;
  packets: ParsedPacket[];
  findings: Finding[];
  connections: ConnectionStats[];
  protocolBreakdown: ProtocolBreakdown[];
  topTalkers: { ip: string; packetCount: number; byteCount: number }[];
  dnsQueries: { domain: string; count: number; types: string[] }[];
  tlsConnections: {
    clientIp: string;
    serverIp: string;
    sni?: string;
    version?: string;
    cipherSuite?: string;
  }[];
  httpTransactions: {
    method: string;
    uri: string;
    statusCode?: number;
    clientIp: string;
    serverIp: string;
  }[];
}
