import type {
  PcapGlobalHeader,
  PcapngInterfaceDescription,
  ParsedPacket,
  EthernetFrame,
  IPv4Header,
  IPv6Header,
  TCPHeader,
  UDPHeader,
  ICMPHeader,
  ARPHeader,
  DNSMessage,
  DNSQuestion,
  DNSRecord,
  TLSRecord,
  TLSClientHello,
  TLSServerHello,
  TLSExtension,
  HTTPRequest,
  HTTPResponse,
} from './types';

// Magic numbers for file format detection
const PCAP_MAGIC_MICROSECONDS = 0xa1b2c3d4;
const PCAP_MAGIC_NANOSECONDS = 0xa1b23c4d;
const PCAP_MAGIC_MICROSECONDS_SWAPPED = 0xd4c3b2a1;
const PCAP_MAGIC_NANOSECONDS_SWAPPED = 0x4d3cb2a1;
const PCAPNG_MAGIC = 0x0a0d0d0a;
const PCAPNG_BYTE_ORDER_MAGIC = 0x1a2b3c4d;

// Link types
const LINKTYPE_ETHERNET = 1;
const LINKTYPE_RAW = 101;
const LINKTYPE_LINUX_SLL = 113;
const LINKTYPE_LINUX_SLL2 = 276;

// EtherTypes
const ETHERTYPE_IPV4 = 0x0800;
const ETHERTYPE_ARP = 0x0806;
const ETHERTYPE_IPV6 = 0x86dd;
const ETHERTYPE_VLAN = 0x8100;

// IP Protocols
const IPPROTO_ICMP = 1;
const IPPROTO_TCP = 6;
const IPPROTO_UDP = 17;
const IPPROTO_ICMPV6 = 58;

// Well-known ports
const PORT_DNS = 53;
const PORT_HTTP = 80;
const PORT_HTTPS = 443;
const PORT_HTTP_ALT = 8080;

// PCAPng block types
const PCAPNG_SHB = 0x0a0d0d0a;
const PCAPNG_IDB = 0x00000001;
const PCAPNG_EPB = 0x00000006;
const PCAPNG_SPB = 0x00000003;
const PCAPNG_PB = 0x00000002;

export class PcapParser {
  private data: DataView;
  private buffer: Uint8Array;
  private offset: number = 0;
  private littleEndian: boolean = true;
  private isNanosecond: boolean = false;
  private format: 'pcap' | 'pcapng' = 'pcap';
  private interfaces: PcapngInterfaceDescription[] = [];

  constructor(arrayBuffer: ArrayBuffer) {
    this.buffer = new Uint8Array(arrayBuffer);
    this.data = new DataView(arrayBuffer);
  }

  public parse(): { packets: ParsedPacket[]; format: 'pcap' | 'pcapng' } {
    this.detectFormat();

    const packets: ParsedPacket[] = [];
    let packetIndex = 0;

    if (this.format === 'pcap') {
      // Skip global header (already read during format detection)
      this.offset = 24;

      while (this.offset < this.buffer.length - 16) {
        try {
          const packet = this.readPcapPacket(packetIndex++);
          if (packet) packets.push(packet);
        } catch {
          break;
        }
      }
    } else {
      // PCAPng format
      this.offset = 0;

      while (this.offset < this.buffer.length - 8) {
        try {
          const packet = this.readPcapngBlock(packetIndex);
          if (packet) {
            packets.push(packet);
            packetIndex++;
          }
        } catch {
          break;
        }
      }
    }

    return { packets, format: this.format };
  }

  private detectFormat(): void {
    const magic = this.data.getUint32(0, false);

    if (magic === PCAPNG_MAGIC) {
      // Check for PCAPng byte order magic
      const blockLength = this.data.getUint32(4, true);
      if (blockLength >= 28) {
        const byteOrderMagic = this.data.getUint32(8, true);
        if (byteOrderMagic === PCAPNG_BYTE_ORDER_MAGIC) {
          this.format = 'pcapng';
          this.littleEndian = true;
          return;
        }
        const byteOrderMagicBE = this.data.getUint32(8, false);
        if (byteOrderMagicBE === PCAPNG_BYTE_ORDER_MAGIC) {
          this.format = 'pcapng';
          this.littleEndian = false;
          return;
        }
      }
    }

    // Check for pcap format
    if (magic === PCAP_MAGIC_MICROSECONDS) {
      this.format = 'pcap';
      this.littleEndian = false;
      this.isNanosecond = false;
    } else if (magic === PCAP_MAGIC_NANOSECONDS) {
      this.format = 'pcap';
      this.littleEndian = false;
      this.isNanosecond = true;
    } else if (magic === PCAP_MAGIC_MICROSECONDS_SWAPPED) {
      this.format = 'pcap';
      this.littleEndian = true;
      this.isNanosecond = false;
    } else if (magic === PCAP_MAGIC_NANOSECONDS_SWAPPED) {
      this.format = 'pcap';
      this.littleEndian = true;
      this.isNanosecond = true;
    } else {
      throw new Error('Unknown file format');
    }

    // Parse pcap global header
    this.parsePcapGlobalHeader();
  }

  private parsePcapGlobalHeader(): PcapGlobalHeader {
    return {
      magicNumber: this.data.getUint32(0, this.littleEndian),
      versionMajor: this.data.getUint16(4, this.littleEndian),
      versionMinor: this.data.getUint16(6, this.littleEndian),
      thiszone: this.data.getInt32(8, this.littleEndian),
      sigfigs: this.data.getUint32(12, this.littleEndian),
      snaplen: this.data.getUint32(16, this.littleEndian),
      network: this.data.getUint32(20, this.littleEndian),
    };
  }

  private readPcapPacket(index: number): ParsedPacket | null {
    if (this.offset + 16 > this.buffer.length) return null;

    const tsSec = this.data.getUint32(this.offset, this.littleEndian);
    const tsUsec = this.data.getUint32(this.offset + 4, this.littleEndian);
    const inclLen = this.data.getUint32(this.offset + 8, this.littleEndian);
    const origLen = this.data.getUint32(this.offset + 12, this.littleEndian);

    this.offset += 16;

    if (inclLen > 65535 || this.offset + inclLen > this.buffer.length) {
      return null;
    }

    const packetData = this.buffer.slice(this.offset, this.offset + inclLen);
    this.offset += inclLen;

    const timestamp = new Date(tsSec * 1000 + Math.floor(
      this.isNanosecond ? tsUsec / 1000000 : tsUsec / 1000
    ));

    const packet: ParsedPacket = {
      index,
      timestamp,
      capturedLength: inclLen,
      originalLength: origLen,
      raw: packetData,
    };

    this.parsePacketLayers(packet, packetData, LINKTYPE_ETHERNET);
    return packet;
  }

  private readPcapngBlock(packetIndex: number): ParsedPacket | null {
    if (this.offset + 8 > this.buffer.length) return null;

    const blockType = this.data.getUint32(this.offset, this.littleEndian);
    const blockTotalLength = this.data.getUint32(this.offset + 4, this.littleEndian);

    if (blockTotalLength < 12 || this.offset + blockTotalLength > this.buffer.length) {
      return null;
    }

    const blockEnd = this.offset + blockTotalLength;

    switch (blockType) {
      case PCAPNG_SHB:
        this.parsePcapngSHB();
        break;
      case PCAPNG_IDB:
        this.parsePcapngIDB();
        break;
      case PCAPNG_EPB:
        const packet = this.parsePcapngEPB(packetIndex);
        this.offset = blockEnd;
        return packet;
      case PCAPNG_SPB:
      case PCAPNG_PB:
        // Simple packet block or old packet block
        break;
    }

    this.offset = blockEnd;
    return null;
  }

  private parsePcapngSHB(): void {
    // Section Header Block
    const byteOrderMagic = this.data.getUint32(this.offset + 8, this.littleEndian);
    this.littleEndian = byteOrderMagic === PCAPNG_BYTE_ORDER_MAGIC;
    this.interfaces = [];
  }

  private parsePcapngIDB(): void {
    // Interface Description Block
    const linkType = this.data.getUint16(this.offset + 8, this.littleEndian);
    const snapLen = this.data.getUint32(this.offset + 12, this.littleEndian);

    this.interfaces.push({
      linkType,
      snapLen,
      tsResol: 6, // Default: microseconds
    });
  }

  private parsePcapngEPB(index: number): ParsedPacket | null {
    // Enhanced Packet Block
    const interfaceId = this.data.getUint32(this.offset + 8, this.littleEndian);
    const timestampHigh = this.data.getUint32(this.offset + 12, this.littleEndian);
    const timestampLow = this.data.getUint32(this.offset + 16, this.littleEndian);
    const capturedLen = this.data.getUint32(this.offset + 20, this.littleEndian);
    const originalLen = this.data.getUint32(this.offset + 24, this.littleEndian);

    if (capturedLen > 65535) return null;

    const dataOffset = this.offset + 28;
    const packetData = this.buffer.slice(dataOffset, dataOffset + capturedLen);

    // Calculate timestamp (default: microseconds since epoch)
    const iface = this.interfaces[interfaceId] || { linkType: LINKTYPE_ETHERNET, snapLen: 65535, tsResol: 6 };
    const tsResol = iface.tsResol || 6;
    const timestamp64 = BigInt(timestampHigh) * BigInt(0x100000000) + BigInt(timestampLow);
    const divisor = BigInt(10 ** tsResol);
    const seconds = Number(timestamp64 / divisor);
    const subseconds = Number(timestamp64 % divisor) / Number(divisor);
    const timestamp = new Date((seconds + subseconds) * 1000);

    const packet: ParsedPacket = {
      index,
      timestamp,
      capturedLength: capturedLen,
      originalLength: originalLen,
      raw: packetData,
    };

    this.parsePacketLayers(packet, packetData, iface.linkType);
    return packet;
  }

  private parsePacketLayers(packet: ParsedPacket, data: Uint8Array, linkType: number): void {
    let offset = 0;
    let etherType: number | undefined;

    // Handle link layer
    switch (linkType) {
      case LINKTYPE_ETHERNET:
        if (data.length < 14) return;
        packet.ethernet = this.parseEthernet(data);
        etherType = packet.ethernet.etherType;
        offset = 14;

        // Handle VLAN tagging
        while (etherType === ETHERTYPE_VLAN && offset + 4 <= data.length) {
          etherType = (data[offset + 2] << 8) | data[offset + 3];
          offset += 4;
        }
        break;
      case LINKTYPE_RAW:
        // Raw IP
        const version = (data[0] >> 4) & 0xf;
        etherType = version === 6 ? ETHERTYPE_IPV6 : ETHERTYPE_IPV4;
        break;
      case LINKTYPE_LINUX_SLL:
        if (data.length < 16) return;
        etherType = (data[14] << 8) | data[15];
        offset = 16;
        break;
      case LINKTYPE_LINUX_SLL2:
        if (data.length < 20) return;
        etherType = (data[0] << 8) | data[1];
        offset = 20;
        break;
    }

    const payload = data.slice(offset);

    // Parse network layer
    if (etherType === ETHERTYPE_IPV4 && payload.length >= 20) {
      packet.ipv4 = this.parseIPv4(payload);
      this.parseTransportLayer(packet, packet.ipv4.protocol, packet.ipv4.payload);
    } else if (etherType === ETHERTYPE_IPV6 && payload.length >= 40) {
      packet.ipv6 = this.parseIPv6(payload);
      this.parseTransportLayer(packet, packet.ipv6.nextHeader, packet.ipv6.payload);
    } else if (etherType === ETHERTYPE_ARP && payload.length >= 28) {
      packet.arp = this.parseARP(payload);
    }
  }

  private parseEthernet(data: Uint8Array): EthernetFrame {
    return {
      destMac: this.formatMac(data.slice(0, 6)),
      srcMac: this.formatMac(data.slice(6, 12)),
      etherType: (data[12] << 8) | data[13],
      payload: data.slice(14),
    };
  }

  private parseIPv4(data: Uint8Array): IPv4Header {
    const ihl = data[0] & 0x0f;
    const headerLength = ihl * 4;

    return {
      version: (data[0] >> 4) & 0x0f,
      ihl,
      dscp: (data[1] >> 2) & 0x3f,
      ecn: data[1] & 0x03,
      totalLength: (data[2] << 8) | data[3],
      identification: (data[4] << 8) | data[5],
      flags: (data[6] >> 5) & 0x07,
      fragmentOffset: ((data[6] & 0x1f) << 8) | data[7],
      ttl: data[8],
      protocol: data[9],
      headerChecksum: (data[10] << 8) | data[11],
      srcIp: `${data[12]}.${data[13]}.${data[14]}.${data[15]}`,
      destIp: `${data[16]}.${data[17]}.${data[18]}.${data[19]}`,
      options: headerLength > 20 ? data.slice(20, headerLength) : undefined,
      payload: data.slice(headerLength),
    };
  }

  private parseIPv6(data: Uint8Array): IPv6Header {
    return {
      version: (data[0] >> 4) & 0x0f,
      trafficClass: ((data[0] & 0x0f) << 4) | ((data[1] >> 4) & 0x0f),
      flowLabel: ((data[1] & 0x0f) << 16) | (data[2] << 8) | data[3],
      payloadLength: (data[4] << 8) | data[5],
      nextHeader: data[6],
      hopLimit: data[7],
      srcIp: this.formatIPv6(data.slice(8, 24)),
      destIp: this.formatIPv6(data.slice(24, 40)),
      payload: data.slice(40),
    };
  }

  private parseTransportLayer(packet: ParsedPacket, protocol: number, data: Uint8Array): void {
    if (data.length === 0) return;

    if (protocol === IPPROTO_TCP && data.length >= 20) {
      packet.tcp = this.parseTCP(data);
      this.parseApplicationLayer(packet, packet.tcp.srcPort, packet.tcp.destPort, packet.tcp.payload);
    } else if (protocol === IPPROTO_UDP && data.length >= 8) {
      packet.udp = this.parseUDP(data);
      this.parseApplicationLayer(packet, packet.udp.srcPort, packet.udp.destPort, packet.udp.payload);
    } else if (protocol === IPPROTO_ICMP && data.length >= 4) {
      packet.icmp = this.parseICMP(data);
    } else if (protocol === IPPROTO_ICMPV6 && data.length >= 4) {
      packet.icmp = this.parseICMP(data);
    }
  }

  private parseTCP(data: Uint8Array): TCPHeader {
    const dataOffset = (data[12] >> 4) & 0x0f;
    const headerLength = dataOffset * 4;
    const flagsByte = data[13];

    return {
      srcPort: (data[0] << 8) | data[1],
      destPort: (data[2] << 8) | data[3],
      seqNumber: (data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7],
      ackNumber: (data[8] << 24) | (data[9] << 16) | (data[10] << 8) | data[11],
      dataOffset,
      flags: {
        fin: (flagsByte & 0x01) !== 0,
        syn: (flagsByte & 0x02) !== 0,
        rst: (flagsByte & 0x04) !== 0,
        psh: (flagsByte & 0x08) !== 0,
        ack: (flagsByte & 0x10) !== 0,
        urg: (flagsByte & 0x20) !== 0,
        ece: (flagsByte & 0x40) !== 0,
        cwr: (flagsByte & 0x80) !== 0,
      },
      windowSize: (data[14] << 8) | data[15],
      checksum: (data[16] << 8) | data[17],
      urgentPointer: (data[18] << 8) | data[19],
      options: headerLength > 20 ? data.slice(20, headerLength) : undefined,
      payload: data.slice(headerLength),
    };
  }

  private parseUDP(data: Uint8Array): UDPHeader {
    return {
      srcPort: (data[0] << 8) | data[1],
      destPort: (data[2] << 8) | data[3],
      length: (data[4] << 8) | data[5],
      checksum: (data[6] << 8) | data[7],
      payload: data.slice(8),
    };
  }

  private parseICMP(data: Uint8Array): ICMPHeader {
    return {
      type: data[0],
      code: data[1],
      checksum: (data[2] << 8) | data[3],
      payload: data.slice(4),
    };
  }

  private parseARP(data: Uint8Array): ARPHeader {
    return {
      hardwareType: (data[0] << 8) | data[1],
      protocolType: (data[2] << 8) | data[3],
      hardwareSize: data[4],
      protocolSize: data[5],
      opcode: (data[6] << 8) | data[7],
      senderMac: this.formatMac(data.slice(8, 14)),
      senderIp: `${data[14]}.${data[15]}.${data[16]}.${data[17]}`,
      targetMac: this.formatMac(data.slice(18, 24)),
      targetIp: `${data[24]}.${data[25]}.${data[26]}.${data[27]}`,
    };
  }

  private parseApplicationLayer(packet: ParsedPacket, srcPort: number, destPort: number, data: Uint8Array): void {
    if (data.length === 0) return;

    // DNS
    if (srcPort === PORT_DNS || destPort === PORT_DNS) {
      try {
        packet.dns = this.parseDNS(data);
      } catch {
        // Not valid DNS
      }
    }

    // HTTP
    if (srcPort === PORT_HTTP || destPort === PORT_HTTP || srcPort === PORT_HTTP_ALT || destPort === PORT_HTTP_ALT) {
      try {
        const httpData = this.parseHTTP(data);
        if (httpData) {
          packet.http = httpData;
        }
      } catch {
        // Not valid HTTP
      }
    }

    // TLS
    if (srcPort === PORT_HTTPS || destPort === PORT_HTTPS || data[0] >= 20 && data[0] <= 23) {
      try {
        const tlsData = this.parseTLS(data);
        if (tlsData) {
          packet.tls = tlsData.record;
          if (tlsData.clientHello) packet.tlsClientHello = tlsData.clientHello;
          if (tlsData.serverHello) packet.tlsServerHello = tlsData.serverHello;
        }
      } catch {
        // Not valid TLS
      }
    }
  }

  private parseDNS(data: Uint8Array): DNSMessage {
    if (data.length < 12) throw new Error('DNS message too short');

    const flags = (data[2] << 8) | data[3];
    const header = {
      transactionId: (data[0] << 8) | data[1],
      flags: {
        qr: (flags >> 15) === 1,
        opcode: (flags >> 11) & 0x0f,
        aa: ((flags >> 10) & 0x01) === 1,
        tc: ((flags >> 9) & 0x01) === 1,
        rd: ((flags >> 8) & 0x01) === 1,
        ra: ((flags >> 7) & 0x01) === 1,
        z: (flags >> 4) & 0x07,
        rcode: flags & 0x0f,
      },
      questions: (data[4] << 8) | data[5],
      answerRRs: (data[6] << 8) | data[7],
      authorityRRs: (data[8] << 8) | data[9],
      additionalRRs: (data[10] << 8) | data[11],
    };

    let offset = 12;
    const questions: DNSQuestion[] = [];
    const answers: DNSRecord[] = [];
    const authorities: DNSRecord[] = [];
    const additionals: DNSRecord[] = [];

    // Parse questions
    for (let i = 0; i < header.questions && offset < data.length; i++) {
      const { name, newOffset } = this.parseDNSName(data, offset);
      offset = newOffset;
      if (offset + 4 <= data.length) {
        questions.push({
          name,
          type: (data[offset] << 8) | data[offset + 1],
          class: (data[offset + 2] << 8) | data[offset + 3],
        });
        offset += 4;
      }
    }

    // Parse answers
    for (let i = 0; i < header.answerRRs && offset < data.length; i++) {
      const record = this.parseDNSRecord(data, offset);
      if (record) {
        answers.push(record.record);
        offset = record.newOffset;
      }
    }

    // Parse authorities
    for (let i = 0; i < header.authorityRRs && offset < data.length; i++) {
      const record = this.parseDNSRecord(data, offset);
      if (record) {
        authorities.push(record.record);
        offset = record.newOffset;
      }
    }

    // Parse additionals
    for (let i = 0; i < header.additionalRRs && offset < data.length; i++) {
      const record = this.parseDNSRecord(data, offset);
      if (record) {
        additionals.push(record.record);
        offset = record.newOffset;
      }
    }

    return { header, questions, answers, authorities, additionals };
  }

  private parseDNSName(data: Uint8Array, offset: number): { name: string; newOffset: number } {
    const labels: string[] = [];
    let jumped = false;
    let jumpOffset = offset;

    while (offset < data.length) {
      const length = data[offset];
      if (length === 0) {
        offset++;
        break;
      }

      // Check for pointer
      if ((length & 0xc0) === 0xc0) {
        if (!jumped) {
          jumpOffset = offset + 2;
        }
        offset = ((length & 0x3f) << 8) | data[offset + 1];
        jumped = true;
        continue;
      }

      offset++;
      if (offset + length <= data.length) {
        labels.push(new TextDecoder().decode(data.slice(offset, offset + length)));
        offset += length;
      } else {
        break;
      }
    }

    return {
      name: labels.join('.'),
      newOffset: jumped ? jumpOffset : offset,
    };
  }

  private parseDNSRecord(data: Uint8Array, offset: number): { record: DNSRecord; newOffset: number } | null {
    const { name, newOffset } = this.parseDNSName(data, offset);
    offset = newOffset;

    if (offset + 10 > data.length) return null;

    const type = (data[offset] << 8) | data[offset + 1];
    const recordClass = (data[offset + 2] << 8) | data[offset + 3];
    const ttl = (data[offset + 4] << 24) | (data[offset + 5] << 16) | (data[offset + 6] << 8) | data[offset + 7];
    const rdlength = (data[offset + 8] << 8) | data[offset + 9];
    offset += 10;

    let rdata = '';
    if (offset + rdlength <= data.length) {
      if (type === 1 && rdlength === 4) {
        // A record
        rdata = `${data[offset]}.${data[offset + 1]}.${data[offset + 2]}.${data[offset + 3]}`;
      } else if (type === 28 && rdlength === 16) {
        // AAAA record
        rdata = this.formatIPv6(data.slice(offset, offset + 16));
      } else if (type === 5 || type === 2 || type === 12) {
        // CNAME, NS, PTR
        rdata = this.parseDNSName(data, offset).name;
      } else if (type === 15) {
        // MX
        const preference = (data[offset] << 8) | data[offset + 1];
        const exchange = this.parseDNSName(data, offset + 2).name;
        rdata = `${preference} ${exchange}`;
      } else {
        rdata = `[${rdlength} bytes]`;
      }
      offset += rdlength;
    }

    return {
      record: { name, type, class: recordClass, ttl, rdlength, rdata },
      newOffset: offset,
    };
  }

  private parseHTTP(data: Uint8Array): HTTPRequest | HTTPResponse | null {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(data);
    const lines = text.split('\r\n');
    if (lines.length === 0) return null;

    const firstLine = lines[0];
    const headers: Record<string, string> = {};

    // Parse headers
    let bodyStart = 1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === '') {
        bodyStart = i + 1;
        break;
      }
      const colonIndex = lines[i].indexOf(':');
      if (colonIndex > 0) {
        const key = lines[i].substring(0, colonIndex).trim().toLowerCase();
        const value = lines[i].substring(colonIndex + 1).trim();
        headers[key] = value;
      }
    }

    // Check if request
    const requestMatch = firstLine.match(/^(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH|CONNECT|TRACE)\s+(\S+)\s+HTTP\/(\d\.\d)/);
    if (requestMatch) {
      return {
        method: requestMatch[1],
        uri: requestMatch[2],
        version: requestMatch[3],
        headers,
        body: lines.slice(bodyStart).join('\r\n') || undefined,
      };
    }

    // Check if response
    const responseMatch = firstLine.match(/^HTTP\/(\d\.\d)\s+(\d{3})\s*(.*)/);
    if (responseMatch) {
      return {
        version: responseMatch[1],
        statusCode: parseInt(responseMatch[2]),
        statusText: responseMatch[3],
        headers,
        body: lines.slice(bodyStart).join('\r\n') || undefined,
      };
    }

    return null;
  }

  private parseTLS(data: Uint8Array): { record: TLSRecord; clientHello?: TLSClientHello; serverHello?: TLSServerHello } | null {
    if (data.length < 5) return null;

    const contentType = data[0];
    if (contentType < 20 || contentType > 23) return null;

    const version = (data[1] << 8) | data[2];
    const length = (data[3] << 8) | data[4];

    if (data.length < 5 + length) return null;

    const fragment = data.slice(5, 5 + length);
    const record: TLSRecord = { contentType, version, length, fragment };

    // Parse handshake messages
    if (contentType === 22 && fragment.length > 4) {
      const handshakeType = fragment[0];

      if (handshakeType === 1) {
        // Client Hello
        return { record, clientHello: this.parseTLSClientHello(fragment) };
      } else if (handshakeType === 2) {
        // Server Hello
        return { record, serverHello: this.parseTLSServerHello(fragment) };
      }
    }

    return { record };
  }

  private parseTLSClientHello(data: Uint8Array): TLSClientHello | undefined {
    if (data.length < 38) return undefined;

    let offset = 4; // Skip handshake type and length
    const version = (data[offset] << 8) | data[offset + 1];
    offset += 2;

    const random = data.slice(offset, offset + 32);
    offset += 32;

    const sessionIdLength = data[offset];
    offset++;
    const sessionId = data.slice(offset, offset + sessionIdLength);
    offset += sessionIdLength;

    if (offset + 2 > data.length) return undefined;
    const cipherSuitesLength = (data[offset] << 8) | data[offset + 1];
    offset += 2;

    const cipherSuites: number[] = [];
    for (let i = 0; i < cipherSuitesLength; i += 2) {
      if (offset + 2 <= data.length) {
        cipherSuites.push((data[offset] << 8) | data[offset + 1]);
        offset += 2;
      }
    }

    if (offset >= data.length) return { version, random, sessionId, cipherSuites, compressionMethods: [], extensions: [] };

    const compressionMethodsLength = data[offset];
    offset++;
    const compressionMethods: number[] = [];
    for (let i = 0; i < compressionMethodsLength; i++) {
      if (offset < data.length) {
        compressionMethods.push(data[offset]);
        offset++;
      }
    }

    const extensions: TLSExtension[] = [];
    let sni: string | undefined;

    if (offset + 2 <= data.length) {
      const extensionsLength = (data[offset] << 8) | data[offset + 1];
      offset += 2;
      const extensionsEnd = offset + extensionsLength;

      while (offset + 4 <= extensionsEnd && offset + 4 <= data.length) {
        const extType = (data[offset] << 8) | data[offset + 1];
        const extLength = (data[offset + 2] << 8) | data[offset + 3];
        offset += 4;

        if (offset + extLength > data.length) break;
        const extData = data.slice(offset, offset + extLength);
        extensions.push({ type: extType, length: extLength, data: extData });

        // Parse SNI
        if (extType === 0 && extLength > 5) {
          const sniListLength = (extData[0] << 8) | extData[1];
          if (sniListLength > 0 && extData[2] === 0) {
            const sniLength = (extData[3] << 8) | extData[4];
            if (sniLength > 0 && 5 + sniLength <= extData.length) {
              sni = new TextDecoder().decode(extData.slice(5, 5 + sniLength));
            }
          }
        }

        offset += extLength;
      }
    }

    return { version, random, sessionId, cipherSuites, compressionMethods, extensions, sni };
  }

  private parseTLSServerHello(data: Uint8Array): TLSServerHello | undefined {
    if (data.length < 38) return undefined;

    let offset = 4; // Skip handshake type and length
    const version = (data[offset] << 8) | data[offset + 1];
    offset += 2;

    const random = data.slice(offset, offset + 32);
    offset += 32;

    const sessionIdLength = data[offset];
    offset++;
    const sessionId = data.slice(offset, offset + sessionIdLength);
    offset += sessionIdLength;

    if (offset + 3 > data.length) return undefined;
    const cipherSuite = (data[offset] << 8) | data[offset + 1];
    offset += 2;
    const compressionMethod = data[offset];
    offset++;

    const extensions: TLSExtension[] = [];
    if (offset + 2 <= data.length) {
      const extensionsLength = (data[offset] << 8) | data[offset + 1];
      offset += 2;
      const extensionsEnd = offset + extensionsLength;

      while (offset + 4 <= extensionsEnd && offset + 4 <= data.length) {
        const extType = (data[offset] << 8) | data[offset + 1];
        const extLength = (data[offset + 2] << 8) | data[offset + 3];
        offset += 4;

        if (offset + extLength > data.length) break;
        const extData = data.slice(offset, offset + extLength);
        extensions.push({ type: extType, length: extLength, data: extData });
        offset += extLength;
      }
    }

    return { version, random, sessionId, cipherSuite, compressionMethod, extensions };
  }

  private formatMac(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(':');
  }

  private formatIPv6(bytes: Uint8Array): string {
    const parts: string[] = [];
    for (let i = 0; i < 16; i += 2) {
      parts.push(((bytes[i] << 8) | bytes[i + 1]).toString(16));
    }
    return parts.join(':');
  }
}
