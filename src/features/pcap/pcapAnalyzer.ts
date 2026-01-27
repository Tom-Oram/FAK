import type {
  ParsedPacket,
  Finding,
  ConnectionStats,
  ProtocolBreakdown,
  AnalysisResult,
} from './types';
import { PcapParser } from './pcapParser';

// Cipher suite mappings for TLS analysis
const WEAK_CIPHER_SUITES = new Set([
  0x0000, // TLS_NULL_WITH_NULL_NULL
  0x0001, // TLS_RSA_WITH_NULL_MD5
  0x0002, // TLS_RSA_WITH_NULL_SHA
  0x0004, // TLS_RSA_WITH_RC4_128_MD5
  0x0005, // TLS_RSA_WITH_RC4_128_SHA
  0x000A, // TLS_RSA_WITH_3DES_EDE_CBC_SHA
  0x002F, // TLS_RSA_WITH_AES_128_CBC_SHA
  0x0035, // TLS_RSA_WITH_AES_256_CBC_SHA
  0xC011, // TLS_ECDHE_RSA_WITH_RC4_128_SHA
  0xC007, // TLS_ECDHE_ECDSA_WITH_RC4_128_SHA
]);

const TLS_VERSION_NAMES: Record<number, string> = {
  0x0300: 'SSL 3.0',
  0x0301: 'TLS 1.0',
  0x0302: 'TLS 1.1',
  0x0303: 'TLS 1.2',
  0x0304: 'TLS 1.3',
};

const DNS_RCODE_NAMES: Record<number, string> = {
  0: 'NOERROR',
  1: 'FORMERR',
  2: 'SERVFAIL',
  3: 'NXDOMAIN',
  4: 'NOTIMP',
  5: 'REFUSED',
};

const DNS_TYPE_NAMES: Record<number, string> = {
  1: 'A',
  2: 'NS',
  5: 'CNAME',
  6: 'SOA',
  12: 'PTR',
  15: 'MX',
  16: 'TXT',
  28: 'AAAA',
  33: 'SRV',
  257: 'CAA',
};

const ICMP_UNREACHABLE_CODES: Record<number, string> = {
  0: 'Net Unreachable',
  1: 'Host Unreachable',
  2: 'Protocol Unreachable',
  3: 'Port Unreachable',
  4: 'Fragmentation Needed',
  5: 'Source Route Failed',
  6: 'Destination Network Unknown',
  7: 'Destination Host Unknown',
  9: 'Network Administratively Prohibited',
  10: 'Host Administratively Prohibited',
  13: 'Communication Administratively Prohibited',
};

export class PcapAnalyzer {
  private packets: ParsedPacket[] = [];
  private format: 'pcap' | 'pcapng' = 'pcap';

  public analyze(file: File): Promise<AnalysisResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        try {
          const parser = new PcapParser(reader.result as ArrayBuffer);
          const parsed = parser.parse();
          this.packets = parsed.packets;
          this.format = parsed.format;

          const result = this.generateAnalysis(file);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  private generateAnalysis(file: File): AnalysisResult {
    const findings: Finding[] = [];
    const connections = this.analyzeConnections();
    const protocolBreakdown = this.calculateProtocolBreakdown();
    const topTalkers = this.calculateTopTalkers();
    const dnsQueries = this.analyzeDNS();
    const tlsConnections = this.analyzeTLS();
    const httpTransactions = this.analyzeHTTP();

    // Run all pattern detection
    findings.push(...this.detectTCPIssues(connections));
    findings.push(...this.detectDNSIssues());
    findings.push(...this.detectTLSIssues());
    findings.push(...this.detectHTTPIssues());
    findings.push(...this.detectNetworkAnomalies());
    findings.push(...this.detectSecurityIssues());
    findings.push(...this.detectPerformanceIssues(connections));

    // Calculate capture times
    let captureStartTime: Date | undefined;
    let captureEndTime: Date | undefined;
    if (this.packets.length > 0) {
      captureStartTime = this.packets[0].timestamp;
      captureEndTime = this.packets[this.packets.length - 1].timestamp;
    }

    const captureDuration = captureStartTime && captureEndTime
      ? (captureEndTime.getTime() - captureStartTime.getTime()) / 1000
      : undefined;

    const totalBytes = this.packets.reduce((sum, p) => sum + p.capturedLength, 0);

    // Sort findings by severity
    const severityOrder = { critical: 0, warning: 1, info: 2, success: 3 };
    findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return {
      fileName: file.name,
      fileSize: file.size,
      fileFormat: this.format,
      captureStartTime,
      captureEndTime,
      captureDuration,
      totalPackets: this.packets.length,
      totalBytes,
      packets: this.packets,
      findings,
      connections,
      protocolBreakdown,
      topTalkers,
      dnsQueries,
      tlsConnections,
      httpTransactions,
    };
  }

  private analyzeConnections(): ConnectionStats[] {
    const connections = new Map<string, ConnectionStats>();

    for (const packet of this.packets) {
      const ip = packet.ipv4 || packet.ipv6;
      if (!ip) continue;

      const srcIp = 'srcIp' in ip ? ip.srcIp : '';
      const destIp = 'destIp' in ip ? ip.destIp : '';

      if (packet.tcp) {
        const key = `${srcIp}:${packet.tcp.srcPort}-${destIp}:${packet.tcp.destPort}`;
        const reverseKey = `${destIp}:${packet.tcp.destPort}-${srcIp}:${packet.tcp.srcPort}`;

        let conn = connections.get(key) || connections.get(reverseKey);
        if (!conn) {
          conn = {
            srcIp,
            srcPort: packet.tcp.srcPort,
            destIp,
            destPort: packet.tcp.destPort,
            protocol: 'TCP',
            packetCount: 0,
            byteCount: 0,
            startTime: packet.timestamp,
            endTime: packet.timestamp,
            retransmissions: 0,
            rtt: [],
          };
          connections.set(key, conn);
        }

        conn.packetCount++;
        conn.byteCount += packet.capturedLength;
        conn.endTime = packet.timestamp;

        // Detect state based on flags
        if (packet.tcp.flags.syn && !packet.tcp.flags.ack) {
          conn.state = 'SYN_SENT';
        } else if (packet.tcp.flags.syn && packet.tcp.flags.ack) {
          conn.state = 'SYN_RECEIVED';
        } else if (packet.tcp.flags.fin) {
          conn.state = 'FIN_WAIT';
        } else if (packet.tcp.flags.rst) {
          conn.state = 'RESET';
        } else if (packet.tcp.flags.ack) {
          conn.state = 'ESTABLISHED';
        }
      } else if (packet.udp) {
        const key = `${srcIp}:${packet.udp.srcPort}-${destIp}:${packet.udp.destPort}`;
        const reverseKey = `${destIp}:${packet.udp.destPort}-${srcIp}:${packet.udp.srcPort}`;

        let conn = connections.get(key) || connections.get(reverseKey);
        if (!conn) {
          conn = {
            srcIp,
            srcPort: packet.udp.srcPort,
            destIp,
            destPort: packet.udp.destPort,
            protocol: 'UDP',
            packetCount: 0,
            byteCount: 0,
            startTime: packet.timestamp,
            endTime: packet.timestamp,
          };
          connections.set(key, conn);
        }

        conn.packetCount++;
        conn.byteCount += packet.capturedLength;
        conn.endTime = packet.timestamp;
      }
    }

    return Array.from(connections.values());
  }

  private calculateProtocolBreakdown(): ProtocolBreakdown[] {
    const protocols = new Map<string, { packets: number; bytes: number }>();

    for (const packet of this.packets) {
      let protocol = 'Other';

      if (packet.tcp) {
        if (packet.http) {
          protocol = 'HTTP';
        } else if (packet.tls || packet.tlsClientHello || packet.tlsServerHello) {
          protocol = 'TLS/HTTPS';
        } else {
          protocol = 'TCP';
        }
      } else if (packet.udp) {
        if (packet.dns) {
          protocol = 'DNS';
        } else {
          protocol = 'UDP';
        }
      } else if (packet.icmp) {
        protocol = 'ICMP';
      } else if (packet.arp) {
        protocol = 'ARP';
      } else if (packet.ipv6) {
        protocol = 'IPv6';
      }

      const current = protocols.get(protocol) || { packets: 0, bytes: 0 };
      current.packets++;
      current.bytes += packet.capturedLength;
      protocols.set(protocol, current);
    }

    const total = this.packets.length;
    return Array.from(protocols.entries())
      .map(([protocol, stats]) => ({
        protocol,
        packetCount: stats.packets,
        byteCount: stats.bytes,
        percentage: (stats.packets / total) * 100,
      }))
      .sort((a, b) => b.packetCount - a.packetCount);
  }

  private calculateTopTalkers(): { ip: string; packetCount: number; byteCount: number }[] {
    const talkers = new Map<string, { packets: number; bytes: number }>();

    for (const packet of this.packets) {
      const ip = packet.ipv4 || packet.ipv6;
      if (!ip) continue;

      const srcIp = 'srcIp' in ip ? ip.srcIp : '';
      const destIp = 'destIp' in ip ? ip.destIp : '';

      for (const ipAddr of [srcIp, destIp]) {
        const current = talkers.get(ipAddr) || { packets: 0, bytes: 0 };
        current.packets++;
        current.bytes += packet.capturedLength;
        talkers.set(ipAddr, current);
      }
    }

    return Array.from(talkers.entries())
      .map(([ip, stats]) => ({
        ip,
        packetCount: stats.packets,
        byteCount: stats.bytes,
      }))
      .sort((a, b) => b.packetCount - a.packetCount)
      .slice(0, 10);
  }

  private analyzeDNS(): { domain: string; count: number; types: string[] }[] {
    const queries = new Map<string, { count: number; types: Set<string> }>();

    for (const packet of this.packets) {
      if (!packet.dns) continue;

      for (const question of packet.dns.questions) {
        const current = queries.get(question.name) || { count: 0, types: new Set() };
        current.count++;
        current.types.add(DNS_TYPE_NAMES[question.type] || `TYPE${question.type}`);
        queries.set(question.name, current);
      }
    }

    return Array.from(queries.entries())
      .map(([domain, stats]) => ({
        domain,
        count: stats.count,
        types: Array.from(stats.types),
      }))
      .sort((a, b) => b.count - a.count);
  }

  private analyzeTLS(): AnalysisResult['tlsConnections'] {
    const connections: AnalysisResult['tlsConnections'] = [];

    for (const packet of this.packets) {
      if (!packet.tlsClientHello) continue;

      const ip = packet.ipv4 || packet.ipv6;
      if (!ip) continue;

      const srcIp = 'srcIp' in ip ? ip.srcIp : '';
      const destIp = 'destIp' in ip ? ip.destIp : '';

      connections.push({
        clientIp: srcIp,
        serverIp: destIp,
        sni: packet.tlsClientHello.sni,
        version: TLS_VERSION_NAMES[packet.tlsClientHello.version],
      });
    }

    return connections;
  }

  private analyzeHTTP(): AnalysisResult['httpTransactions'] {
    const transactions: AnalysisResult['httpTransactions'] = [];

    for (const packet of this.packets) {
      if (!packet.http) continue;

      const ip = packet.ipv4 || packet.ipv6;
      if (!ip) continue;

      const srcIp = 'srcIp' in ip ? ip.srcIp : '';
      const destIp = 'destIp' in ip ? ip.destIp : '';

      if ('method' in packet.http) {
        transactions.push({
          method: packet.http.method,
          uri: packet.http.uri,
          clientIp: srcIp,
          serverIp: destIp,
        });
      } else {
        // Find matching request and update it
        const lastRequest = transactions[transactions.length - 1];
        if (lastRequest && !lastRequest.statusCode) {
          lastRequest.statusCode = packet.http.statusCode;
        }
      }
    }

    return transactions;
  }

  private detectTCPIssues(connections: ConnectionStats[]): Finding[] {
    const findings: Finding[] = [];
    const tcpPackets = this.packets.filter((p) => p.tcp);

    // Detect TCP resets
    const resetPackets = tcpPackets.filter((p) => p.tcp?.flags.rst);
    if (resetPackets.length > 0) {
      const resetConnections = new Set<string>();
      for (const packet of resetPackets) {
        const ip = packet.ipv4 || packet.ipv6;
        if (ip && packet.tcp) {
          const srcIp = 'srcIp' in ip ? ip.srcIp : '';
          const destIp = 'destIp' in ip ? ip.destIp : '';
          resetConnections.add(`${srcIp}:${packet.tcp.srcPort} -> ${destIp}:${packet.tcp.destPort}`);
        }
      }

      findings.push({
        id: 'tcp-resets',
        severity: resetPackets.length > 10 ? 'critical' : 'warning',
        category: 'TCP',
        title: `TCP Connection Resets Detected (${resetPackets.length})`,
        description: 'TCP RST packets indicate abruptly terminated connections, which may signal service issues, firewall blocks, or application errors.',
        details: [
          `Total RST packets: ${resetPackets.length}`,
          `Unique connections affected: ${resetConnections.size}`,
          ...Array.from(resetConnections).slice(0, 5),
        ],
        recommendations: [
          'Check if a firewall is blocking connections',
          'Verify the target service is running and accepting connections',
          'Check for port mismatches between client and server',
          'Review application logs for connection rejection reasons',
          'Consider using netstat or ss to verify listening ports',
        ],
        affectedPackets: resetPackets.map((p) => p.index),
      });
    }

    // Detect SYN packets without SYN-ACK (failed connection attempts)
    const synOnlyPackets = tcpPackets.filter((p) => p.tcp?.flags.syn && !p.tcp?.flags.ack);
    const synAckPackets = tcpPackets.filter((p) => p.tcp?.flags.syn && p.tcp?.flags.ack);

    if (synOnlyPackets.length > synAckPackets.length * 2 && synOnlyPackets.length > 5) {
      findings.push({
        id: 'tcp-syn-flood',
        severity: 'warning',
        category: 'TCP',
        title: 'High Number of Unanswered SYN Packets',
        description: 'Many SYN packets without corresponding SYN-ACK responses. This could indicate connection issues, host unreachability, or potential SYN flood attack.',
        details: [
          `SYN packets: ${synOnlyPackets.length}`,
          `SYN-ACK packets: ${synAckPackets.length}`,
          `Success rate: ${((synAckPackets.length / synOnlyPackets.length) * 100).toFixed(1)}%`,
        ],
        recommendations: [
          'Verify the target hosts are reachable',
          'Check for network path issues (routing, MTU)',
          'Look for SYN flood attack indicators if this is unexpected',
          'Verify firewall rules allow return traffic',
          'Check if hosts are under heavy load',
        ],
        affectedPackets: synOnlyPackets.slice(0, 100).map((p) => p.index),
      });
    }

    // Detect zero window situations
    const zeroWindowPackets = tcpPackets.filter((p) => p.tcp?.windowSize === 0);
    if (zeroWindowPackets.length > 0) {
      findings.push({
        id: 'tcp-zero-window',
        severity: 'warning',
        category: 'TCP',
        title: `TCP Zero Window Conditions (${zeroWindowPackets.length})`,
        description: 'Zero window advertisements indicate the receiver cannot accept more data, typically due to application slowness or resource exhaustion.',
        details: [
          `Zero window packets: ${zeroWindowPackets.length}`,
          'This indicates receiver buffer exhaustion',
        ],
        recommendations: [
          'Check receiving application for processing delays',
          'Verify system memory and buffer allocations',
          'Look for application-level bottlenecks',
          'Consider increasing TCP buffer sizes if consistently occurring',
          'Profile the receiving application for slowdowns',
        ],
        affectedPackets: zeroWindowPackets.map((p) => p.index),
      });
    }

    // Detect potential retransmissions (simplified detection)
    const seqNumbers = new Map<string, Set<number>>();
    const retransmissions: ParsedPacket[] = [];

    for (const packet of tcpPackets) {
      if (!packet.tcp || !packet.ipv4) continue;

      const key = `${packet.ipv4.srcIp}:${packet.tcp.srcPort}-${packet.ipv4.destIp}:${packet.tcp.destPort}`;
      const seqs = seqNumbers.get(key) || new Set();

      if (seqs.has(packet.tcp.seqNumber) && packet.tcp.payload.length > 0) {
        retransmissions.push(packet);
      }
      seqs.add(packet.tcp.seqNumber);
      seqNumbers.set(key, seqs);
    }

    if (retransmissions.length > 0) {
      const retransPercent = (retransmissions.length / tcpPackets.length) * 100;
      findings.push({
        id: 'tcp-retransmissions',
        severity: retransPercent > 5 ? 'critical' : retransPercent > 1 ? 'warning' : 'info',
        category: 'TCP',
        title: `TCP Retransmissions Detected (${retransmissions.length})`,
        description: 'Retransmissions occur when packets are lost or delayed beyond the timeout period. High retransmission rates indicate network issues.',
        details: [
          `Retransmitted packets: ${retransmissions.length}`,
          `Retransmission rate: ${retransPercent.toFixed(2)}%`,
          retransPercent > 5 ? 'CRITICAL: High packet loss affecting performance' : '',
        ].filter(Boolean),
        recommendations: [
          'Check for network congestion along the path',
          'Verify interface error counters on network devices',
          'Look for duplex mismatches on network links',
          'Check for QoS policies that might be dropping traffic',
          'Verify MTU settings along the path',
        ],
        affectedPackets: retransmissions.slice(0, 100).map((p) => p.index),
      });
    }

    // Detect connections with only FIN/RST (ungraceful terminations)
    const incompletConnections = connections.filter((c) => c.state === 'RESET' || c.packetCount < 3);
    if (incompletConnections.length > connections.length * 0.3 && connections.length > 5) {
      findings.push({
        id: 'tcp-incomplete-connections',
        severity: 'warning',
        category: 'TCP',
        title: `High Rate of Incomplete TCP Connections`,
        description: 'Many connections never completed the handshake or were terminated abnormally.',
        details: [
          `Incomplete connections: ${incompletConnections.length} of ${connections.length}`,
          `Rate: ${((incompletConnections.length / connections.length) * 100).toFixed(1)}%`,
        ],
        recommendations: [
          'Investigate network path stability',
          'Check for aggressive connection timeouts',
          'Verify server capacity and connection limits',
          'Look for port scanning activity if unexpected',
        ],
      });
    }

    return findings;
  }

  private detectDNSIssues(): Finding[] {
    const findings: Finding[] = [];
    const dnsPackets = this.packets.filter((p) => p.dns);

    if (dnsPackets.length === 0) return findings;

    // Detect DNS errors
    const errorResponses = dnsPackets.filter(
      (p) => p.dns?.header.flags.qr && p.dns.header.flags.rcode !== 0
    );

    const errorsByType = new Map<number, ParsedPacket[]>();
    for (const packet of errorResponses) {
      const rcode = packet.dns!.header.flags.rcode;
      const packets = errorsByType.get(rcode) || [];
      packets.push(packet);
      errorsByType.set(rcode, packets);
    }

    for (const [rcode, packets] of errorsByType) {
      const rcodeName = DNS_RCODE_NAMES[rcode] || `RCODE${rcode}`;
      const domains = new Set<string>();

      for (const packet of packets) {
        if (packet.dns?.questions[0]) {
          domains.add(packet.dns.questions[0].name);
        }
      }

      let severity: Finding['severity'] = 'info';
      let description = '';
      const recommendations: string[] = [];

      switch (rcode) {
        case 2: // SERVFAIL
          severity = 'critical';
          description = 'DNS server failures indicate the resolver encountered errors processing queries. This often means upstream DNS issues or DNSSEC validation failures.';
          recommendations.push(
            'Check DNS server health and connectivity',
            'Verify DNSSEC chain if enabled',
            'Test with alternative DNS resolvers',
            'Check for DNS server resource exhaustion'
          );
          break;
        case 3: // NXDOMAIN
          severity = packets.length > 10 ? 'warning' : 'info';
          description = 'NXDOMAIN responses indicate queried domains do not exist. May be normal for typos, or indicate misconfiguration or malware activity.';
          recommendations.push(
            'Verify domain names are spelled correctly',
            'Check for malware making suspicious DNS queries',
            'Review application configuration for outdated domain references',
            'Check for DNS-based ad/tracker blocking'
          );
          break;
        case 5: // REFUSED
          severity = 'warning';
          description = 'DNS queries were refused by the server. This typically means ACL restrictions or the server is not configured to serve these queries.';
          recommendations.push(
            'Verify you are using authorized DNS servers',
            'Check DNS server ACL configurations',
            'Verify recursive query settings'
          );
          break;
      }

      findings.push({
        id: `dns-${rcodeName.toLowerCase()}`,
        severity,
        category: 'DNS',
        title: `DNS ${rcodeName} Responses (${packets.length})`,
        description,
        details: [
          `Error responses: ${packets.length}`,
          `Affected domains: ${domains.size}`,
          ...Array.from(domains).slice(0, 10),
        ],
        recommendations,
        affectedPackets: packets.map((p) => p.index),
      });
    }

    // Detect unusually slow DNS responses
    const dnsQueries = new Map<number, { packet: ParsedPacket; time: number }>();
    const dnsResponses: { query: ParsedPacket; response: ParsedPacket; latency: number }[] = [];

    for (const packet of dnsPackets) {
      if (!packet.dns) continue;

      const txId = packet.dns.header.transactionId;
      if (!packet.dns.header.flags.qr) {
        // Query
        dnsQueries.set(txId, { packet, time: packet.timestamp.getTime() });
      } else {
        // Response
        const query = dnsQueries.get(txId);
        if (query) {
          const latency = packet.timestamp.getTime() - query.time;
          dnsResponses.push({ query: query.packet, response: packet, latency });
        }
      }
    }

    const slowResponses = dnsResponses.filter((r) => r.latency > 500);
    if (slowResponses.length > 0) {
      const avgLatency = dnsResponses.reduce((sum, r) => sum + r.latency, 0) / dnsResponses.length;

      findings.push({
        id: 'dns-slow-responses',
        severity: avgLatency > 1000 ? 'warning' : 'info',
        category: 'DNS',
        title: `Slow DNS Responses Detected`,
        description: 'Some DNS queries took longer than expected to resolve. High DNS latency can significantly impact application performance.',
        details: [
          `Slow responses (>500ms): ${slowResponses.length}`,
          `Average latency: ${avgLatency.toFixed(0)}ms`,
          `Max latency: ${Math.max(...dnsResponses.map((r) => r.latency))}ms`,
        ],
        recommendations: [
          'Consider using closer DNS resolvers',
          'Implement local DNS caching',
          'Check DNS server load and performance',
          'Consider using DNS over HTTPS/TLS for security-sensitive queries',
        ],
      });
    }

    // Detect potential DNS tunneling (unusually long domain names or TXT queries)
    const suspiciousDomains = dnsPackets.filter((p) => {
      if (!p.dns?.questions[0]) return false;
      const name = p.dns.questions[0].name;
      const type = p.dns.questions[0].type;
      // Long subdomains or TXT queries to unusual domains
      return name.length > 100 || (type === 16 && name.split('.').some((label) => label.length > 30));
    });

    if (suspiciousDomains.length > 5) {
      findings.push({
        id: 'dns-tunneling-suspected',
        severity: 'critical',
        category: 'Security',
        title: 'Potential DNS Tunneling Detected',
        description: 'Unusually long domain names or suspicious TXT queries may indicate DNS tunneling, which is used for data exfiltration or C2 communication.',
        details: [
          `Suspicious queries: ${suspiciousDomains.length}`,
          ...suspiciousDomains.slice(0, 5).map((p) => p.dns?.questions[0]?.name || ''),
        ],
        recommendations: [
          'Investigate the queried domains for legitimacy',
          'Check for malware or unauthorized data exfiltration tools',
          'Implement DNS query logging and analysis',
          'Consider DNS filtering to block suspicious TLD queries',
          'Review endpoint security for compromise indicators',
        ],
        affectedPackets: suspiciousDomains.map((p) => p.index),
      });
    }

    return findings;
  }

  private detectTLSIssues(): Finding[] {
    const findings: Finding[] = [];
    const tlsPackets = this.packets.filter((p) => p.tls || p.tlsClientHello || p.tlsServerHello);

    if (tlsPackets.length === 0) return findings;

    // Detect deprecated TLS versions
    const deprecatedVersions = new Map<string, ParsedPacket[]>();
    for (const packet of tlsPackets) {
      let version: number | undefined;
      if (packet.tlsClientHello) {
        version = packet.tlsClientHello.version;
      } else if (packet.tlsServerHello) {
        version = packet.tlsServerHello.version;
      }

      if (version && version < 0x0303) {
        const versionName = TLS_VERSION_NAMES[version] || `0x${version.toString(16)}`;
        const packets = deprecatedVersions.get(versionName) || [];
        packets.push(packet);
        deprecatedVersions.set(versionName, packets);
      }
    }

    for (const [version, packets] of deprecatedVersions) {
      findings.push({
        id: `tls-deprecated-${version.replace(/\s/g, '-').toLowerCase()}`,
        severity: 'critical',
        category: 'Security',
        title: `Deprecated TLS Version in Use: ${version}`,
        description: `${version} is deprecated and contains known vulnerabilities. Modern applications should use TLS 1.2 or 1.3.`,
        details: [
          `Connections using ${version}: ${packets.length}`,
          'This version is vulnerable to POODLE, BEAST, and other attacks',
        ],
        recommendations: [
          `Upgrade all systems to support TLS 1.2 or 1.3`,
          'Disable legacy TLS versions in server configuration',
          'Update client applications to use modern TLS libraries',
          'If legacy systems require old TLS, isolate them in a separate network segment',
        ],
        affectedPackets: packets.map((p) => p.index),
      });
    }

    // Detect weak cipher suites
    const weakCipherPackets: ParsedPacket[] = [];
    for (const packet of tlsPackets) {
      if (packet.tlsServerHello) {
        if (WEAK_CIPHER_SUITES.has(packet.tlsServerHello.cipherSuite)) {
          weakCipherPackets.push(packet);
        }
      }
    }

    if (weakCipherPackets.length > 0) {
      findings.push({
        id: 'tls-weak-ciphers',
        severity: 'critical',
        category: 'Security',
        title: 'Weak TLS Cipher Suites Negotiated',
        description: 'Connections are using weak cipher suites that provide inadequate security. These may be vulnerable to decryption attacks.',
        details: [
          `Connections with weak ciphers: ${weakCipherPackets.length}`,
          'RC4, NULL, and export ciphers are known to be insecure',
        ],
        recommendations: [
          'Update server cipher suite configuration',
          'Prioritize AEAD ciphers (AES-GCM, ChaCha20-Poly1305)',
          'Disable RC4, 3DES, and export-grade ciphers',
          'Use Mozilla SSL Configuration Generator for recommended settings',
        ],
        affectedPackets: weakCipherPackets.map((p) => p.index),
      });
    }

    // Detect TLS handshake failures
    const tlsAlerts = this.packets.filter((p) => p.tls?.contentType === 21);
    if (tlsAlerts.length > 0) {
      findings.push({
        id: 'tls-handshake-failures',
        severity: 'warning',
        category: 'TLS',
        title: `TLS Alerts Detected (${tlsAlerts.length})`,
        description: 'TLS alert messages indicate handshake failures or protocol errors. These may prevent secure connections from being established.',
        details: [
          `TLS alerts: ${tlsAlerts.length}`,
          'Common causes: certificate issues, cipher mismatch, protocol version incompatibility',
        ],
        recommendations: [
          'Check server certificate validity and chain',
          'Verify cipher suite compatibility between client and server',
          'Ensure TLS version compatibility',
          'Check for certificate hostname mismatches',
        ],
        affectedPackets: tlsAlerts.map((p) => p.index),
      });
    }

    // Check for missing SNI
    const noSniPackets = tlsPackets.filter((p) => p.tlsClientHello && !p.tlsClientHello.sni);
    if (noSniPackets.length > 0) {
      findings.push({
        id: 'tls-missing-sni',
        severity: 'info',
        category: 'TLS',
        title: 'TLS Connections Without SNI',
        description: 'Some TLS connections do not include Server Name Indication (SNI). This may cause issues with virtual hosting.',
        details: [
          `Connections without SNI: ${noSniPackets.length}`,
          'SNI is required for proper certificate selection on shared hosts',
        ],
        recommendations: [
          'Update client applications to send SNI',
          'Verify compatibility with legacy systems if SNI cannot be enabled',
          'Consider dedicated IPs for services requiring clients without SNI support',
        ],
        affectedPackets: noSniPackets.map((p) => p.index),
      });
    }

    return findings;
  }

  private detectHTTPIssues(): Finding[] {
    const findings: Finding[] = [];
    const httpPackets = this.packets.filter((p) => p.http);

    if (httpPackets.length === 0) return findings;

    // Detect HTTP error responses
    const errorResponses = httpPackets.filter(
      (p) => p.http && 'statusCode' in p.http && p.http.statusCode >= 400
    );

    const errorsByCode = new Map<number, ParsedPacket[]>();
    for (const packet of errorResponses) {
      if (packet.http && 'statusCode' in packet.http) {
        const packets = errorsByCode.get(packet.http.statusCode) || [];
        packets.push(packet);
        errorsByCode.set(packet.http.statusCode, packets);
      }
    }

    for (const [code, packets] of errorsByCode) {
      let severity: Finding['severity'] = 'info';
      let description = '';
      const recommendations: string[] = [];

      if (code >= 500) {
        severity = 'critical';
        description = `HTTP ${code} errors indicate server-side problems. The server is unable to fulfill valid requests.`;
        recommendations.push(
          'Check server application logs for errors',
          'Verify server resources (CPU, memory, disk)',
          'Check database connectivity and performance',
          'Review recent deployments for issues'
        );
      } else if (code === 401 || code === 403) {
        severity = 'warning';
        description = `HTTP ${code} errors indicate authentication/authorization failures.`;
        recommendations.push(
          'Verify credentials are correct',
          'Check for expired tokens or sessions',
          'Review access control configurations',
          'Check for IP-based restrictions'
        );
      } else if (code === 404) {
        severity = packets.length > 10 ? 'warning' : 'info';
        description = 'HTTP 404 errors indicate requests for non-existent resources.';
        recommendations.push(
          'Verify requested URLs are correct',
          'Check for broken links or outdated references',
          'Review URL routing configuration'
        );
      } else if (code === 429) {
        severity = 'warning';
        description = 'HTTP 429 indicates rate limiting. Requests are being throttled.';
        recommendations.push(
          'Implement request rate limiting on the client side',
          'Check if requests can be batched or cached',
          'Contact service provider to request rate limit increase if needed'
        );
      }

      findings.push({
        id: `http-error-${code}`,
        severity,
        category: 'HTTP',
        title: `HTTP ${code} Errors (${packets.length})`,
        description,
        details: [`Error responses: ${packets.length}`],
        recommendations,
        affectedPackets: packets.map((p) => p.index),
      });
    }

    // Detect unencrypted HTTP with sensitive paths
    const unencryptedSensitive = httpPackets.filter((p) => {
      if (!p.http || !('method' in p.http)) return false;
      const uri = p.http.uri.toLowerCase();
      return (
        uri.includes('password') ||
        uri.includes('token') ||
        uri.includes('api_key') ||
        uri.includes('secret') ||
        uri.includes('auth') ||
        uri.includes('login') ||
        uri.includes('session')
      );
    });

    if (unencryptedSensitive.length > 0) {
      findings.push({
        id: 'http-sensitive-unencrypted',
        severity: 'critical',
        category: 'Security',
        title: 'Sensitive Data Over Unencrypted HTTP',
        description: 'Requests containing potentially sensitive information (authentication, tokens) are being sent over unencrypted HTTP.',
        details: [
          `Potentially sensitive requests: ${unencryptedSensitive.length}`,
          'This data could be intercepted by attackers',
        ],
        recommendations: [
          'Immediately migrate to HTTPS for all sensitive endpoints',
          'Implement HSTS to prevent downgrade attacks',
          'Review all HTTP endpoints for sensitive data exposure',
          'Use secure cookies with HttpOnly and Secure flags',
        ],
        affectedPackets: unencryptedSensitive.map((p) => p.index),
      });
    }

    return findings;
  }

  private detectNetworkAnomalies(): Finding[] {
    const findings: Finding[] = [];

    // Detect ICMP errors
    const icmpErrors = this.packets.filter((p) => p.icmp && p.icmp.type === 3);
    if (icmpErrors.length > 0) {
      const errorCounts = new Map<number, number>();
      for (const packet of icmpErrors) {
        if (packet.icmp) {
          errorCounts.set(packet.icmp.code, (errorCounts.get(packet.icmp.code) || 0) + 1);
        }
      }

      const details = ['Destination Unreachable breakdown:'];
      for (const [code, count] of errorCounts) {
        details.push(`  ${ICMP_UNREACHABLE_CODES[code] || `Code ${code}`}: ${count}`);
      }

      findings.push({
        id: 'icmp-destination-unreachable',
        severity: icmpErrors.length > 10 ? 'warning' : 'info',
        category: 'Network',
        title: `ICMP Destination Unreachable (${icmpErrors.length})`,
        description: 'ICMP Destination Unreachable messages indicate routing problems, firewall blocks, or unavailable services.',
        details,
        recommendations: [
          'Check routing tables for correct next-hop addresses',
          'Verify firewall rules allow required traffic',
          'Confirm target services are running and listening',
          'Check for MTU issues if fragmentation needed messages appear',
        ],
        affectedPackets: icmpErrors.map((p) => p.index),
      });
    }

    // Detect TTL issues (TTL exceeded)
    const ttlExceeded = this.packets.filter((p) => p.icmp && p.icmp.type === 11);
    if (ttlExceeded.length > 0) {
      findings.push({
        id: 'icmp-ttl-exceeded',
        severity: ttlExceeded.length > 20 ? 'warning' : 'info',
        category: 'Network',
        title: `TTL Exceeded Messages (${ttlExceeded.length})`,
        description: 'TTL exceeded messages may indicate routing loops or paths with too many hops.',
        details: [
          `TTL exceeded packets: ${ttlExceeded.length}`,
          'May be normal for traceroute, but unexpected occurrences indicate routing issues',
        ],
        recommendations: [
          'Run traceroute to verify path to destination',
          'Check for routing loops in network topology',
          'Verify BGP/OSPF configurations for proper path selection',
        ],
        affectedPackets: ttlExceeded.map((p) => p.index),
      });
    }

    // Detect fragmentation
    const fragmentedPackets = this.packets.filter(
      (p) => p.ipv4 && (p.ipv4.fragmentOffset > 0 || (p.ipv4.flags & 0x01) !== 0)
    );
    if (fragmentedPackets.length > 0) {
      findings.push({
        id: 'ip-fragmentation',
        severity: 'info',
        category: 'Network',
        title: `IP Fragmentation Detected (${fragmentedPackets.length})`,
        description: 'IP fragmentation can cause performance issues and may indicate MTU mismatches along the path.',
        details: [
          `Fragmented packets: ${fragmentedPackets.length}`,
          'Fragmentation adds overhead and may cause issues with stateful firewalls',
        ],
        recommendations: [
          'Verify MTU settings along the path',
          'Consider enabling Path MTU Discovery',
          'Check for GRE/IPsec tunnels that may reduce effective MTU',
          'Ensure DF bit is set appropriately for PMTUD',
        ],
        affectedPackets: fragmentedPackets.map((p) => p.index),
      });
    }

    // Detect broadcast storms or excessive broadcasts
    const broadcastPackets = this.packets.filter(
      (p) =>
        p.ethernet?.destMac === 'ff:ff:ff:ff:ff:ff' ||
        (p.ipv4 && p.ipv4.destIp.endsWith('.255'))
    );

    if (broadcastPackets.length > this.packets.length * 0.1 && broadcastPackets.length > 50) {
      findings.push({
        id: 'excessive-broadcasts',
        severity: 'warning',
        category: 'Network',
        title: `Excessive Broadcast Traffic (${broadcastPackets.length})`,
        description: 'High broadcast traffic can indicate network issues, misconfigurations, or potential broadcast storms.',
        details: [
          `Broadcast packets: ${broadcastPackets.length}`,
          `Percentage of traffic: ${((broadcastPackets.length / this.packets.length) * 100).toFixed(1)}%`,
        ],
        recommendations: [
          'Check for spanning tree issues or loops',
          'Verify DHCP server configuration',
          'Consider network segmentation with VLANs',
          'Check for malfunctioning NICs or switches',
        ],
        affectedPackets: broadcastPackets.slice(0, 100).map((p) => p.index),
      });
    }

    // Detect duplicate IPs (gratuitous ARP indicating conflicts)
    const arpPackets = this.packets.filter((p) => p.arp);
    const ipMacMapping = new Map<string, Set<string>>();

    for (const packet of arpPackets) {
      if (packet.arp) {
        const macs = ipMacMapping.get(packet.arp.senderIp) || new Set();
        macs.add(packet.arp.senderMac);
        ipMacMapping.set(packet.arp.senderIp, macs);
      }
    }

    const conflictingIps = Array.from(ipMacMapping.entries()).filter(
      ([, macs]) => macs.size > 1
    );

    if (conflictingIps.length > 0) {
      findings.push({
        id: 'ip-conflicts',
        severity: 'critical',
        category: 'Network',
        title: `Potential IP Address Conflicts Detected`,
        description: 'Multiple MAC addresses are claiming the same IP address. This indicates IP conflicts that will cause connectivity issues.',
        details: [
          `Conflicting IPs: ${conflictingIps.length}`,
          ...conflictingIps.map(([ip, macs]) => `${ip}: ${Array.from(macs).join(', ')}`),
        ],
        recommendations: [
          'Identify devices with duplicate IPs using MAC addresses',
          'Check DHCP server for proper lease management',
          'Verify static IP assignments don\'t overlap DHCP ranges',
          'Consider implementing DHCP snooping and dynamic ARP inspection',
        ],
      });
    }

    return findings;
  }

  private detectSecurityIssues(): Finding[] {
    const findings: Finding[] = [];

    // Detect potential port scanning
    const tcpPackets = this.packets.filter((p) => p.tcp);
    const synScanIndicators = new Map<string, Set<number>>();

    for (const packet of tcpPackets) {
      if (packet.tcp?.flags.syn && !packet.tcp.flags.ack && packet.ipv4) {
        const srcIp = packet.ipv4.srcIp;
        const ports = synScanIndicators.get(srcIp) || new Set();
        ports.add(packet.tcp.destPort);
        synScanIndicators.set(srcIp, ports);
      }
    }

    for (const [ip, ports] of synScanIndicators) {
      if (ports.size > 20) {
        findings.push({
          id: `port-scan-${ip.replace(/\./g, '-')}`,
          severity: 'critical',
          category: 'Security',
          title: `Potential Port Scan from ${ip}`,
          description: `Host ${ip} is sending SYN packets to ${ports.size} different ports, indicating a possible port scan.`,
          details: [
            `Source IP: ${ip}`,
            `Unique ports targeted: ${ports.size}`,
            `Sample ports: ${Array.from(ports).slice(0, 20).join(', ')}`,
          ],
          recommendations: [
            'Verify if this is authorized security testing',
            'Block the source IP if unauthorized',
            'Review firewall logs for additional suspicious activity',
            'Consider implementing port scan detection at the firewall level',
            'Check for lateral movement if source is internal',
          ],
        });
      }
    }

    // Detect ARP spoofing indicators
    const arpResponses = this.packets.filter((p) => p.arp && p.arp.opcode === 2);
    const arpGratuitous = arpResponses.filter(
      (p) => p.arp && p.arp.senderIp === p.arp.targetIp
    );

    if (arpGratuitous.length > 10) {
      findings.push({
        id: 'arp-spoofing-risk',
        severity: 'warning',
        category: 'Security',
        title: 'Excessive Gratuitous ARP Detected',
        description: 'Large numbers of gratuitous ARP packets may indicate ARP spoofing attempts or network instability.',
        details: [
          `Gratuitous ARP packets: ${arpGratuitous.length}`,
          'Gratuitous ARP can be used for legitimate failover or malicious MITM attacks',
        ],
        recommendations: [
          'Enable Dynamic ARP Inspection (DAI) on switches',
          'Implement static ARP entries for critical infrastructure',
          'Use VLANs to limit broadcast domains',
          'Monitor for unauthorized ARP responses',
        ],
        affectedPackets: arpGratuitous.map((p) => p.index),
      });
    }

    // Detect clear-text protocols with credentials
    const clearTextAuth = this.packets.filter((p) => {
      if (p.tcp?.payload && p.tcp.payload.length > 0) {
        const text = new TextDecoder('utf-8', { fatal: false }).decode(p.tcp.payload);
        const lowerText = text.toLowerCase();
        return (
          (lowerText.includes('user') && lowerText.includes('pass')) ||
          lowerText.includes('authorization: basic') ||
          lowerText.includes('auth login') ||
          lowerText.includes('auth plain')
        );
      }
      return false;
    });

    if (clearTextAuth.length > 0) {
      findings.push({
        id: 'cleartext-credentials',
        severity: 'critical',
        category: 'Security',
        title: 'Potential Clear-text Credentials Detected',
        description: 'Traffic containing what appears to be authentication data was found in clear text, making it vulnerable to interception.',
        details: [
          `Suspicious packets: ${clearTextAuth.length}`,
          'Clear-text authentication exposes credentials to network attackers',
        ],
        recommendations: [
          'Immediately migrate to encrypted protocols (HTTPS, SMTPS, IMAPS)',
          'Implement TLS for all services handling authentication',
          'Rotate any credentials that may have been exposed',
          'Audit network for other clear-text authentication protocols',
        ],
        affectedPackets: clearTextAuth.map((p) => p.index),
      });
    }

    return findings;
  }

  private detectPerformanceIssues(connections: ConnectionStats[]): Finding[] {
    const findings: Finding[] = [];

    // Analyze window sizes
    const windowSizes = this.packets
      .filter((p) => p.tcp)
      .map((p) => p.tcp!.windowSize);

    if (windowSizes.length > 0) {
      const avgWindow = windowSizes.reduce((a, b) => a + b, 0) / windowSizes.length;
      const smallWindows = windowSizes.filter((w) => w < 8192).length;

      if (smallWindows > windowSizes.length * 0.3 && windowSizes.length > 50) {
        findings.push({
          id: 'tcp-small-windows',
          severity: 'warning',
          category: 'Performance',
          title: 'Frequently Small TCP Window Sizes',
          description: 'Many packets have small receive window sizes, which can limit throughput and indicate receiver-side bottlenecks.',
          details: [
            `Average window size: ${Math.round(avgWindow)} bytes`,
            `Packets with small windows (<8KB): ${smallWindows} (${((smallWindows / windowSizes.length) * 100).toFixed(1)}%)`,
          ],
          recommendations: [
            'Check receiving application performance',
            'Increase TCP buffer sizes on constrained hosts',
            'Verify memory availability on endpoints',
            'Consider TCP window scaling if not already enabled',
          ],
        });
      }
    }

    // Check for long-lived connections
    const longConnections = connections.filter((c) => {
      const duration = c.endTime.getTime() - c.startTime.getTime();
      return duration > 60000; // More than 1 minute
    });

    if (longConnections.length > 0 && connections.length > 10) {
      const avgDuration =
        longConnections.reduce(
          (sum, c) => sum + (c.endTime.getTime() - c.startTime.getTime()),
          0
        ) / longConnections.length;

      findings.push({
        id: 'long-connections',
        severity: 'info',
        category: 'Performance',
        title: `Long-lived Connections Detected (${longConnections.length})`,
        description: 'Some connections remained open for extended periods. This is normal for persistent connections but may indicate resource holding issues.',
        details: [
          `Long connections: ${longConnections.length}`,
          `Average duration: ${(avgDuration / 1000).toFixed(1)} seconds`,
        ],
        recommendations: [
          'Verify long connections are expected (websockets, streaming, etc.)',
          'Check for proper connection pooling and reuse',
          'Ensure idle timeout policies are appropriate',
        ],
      });
    }

    // Add a success finding if no major issues
    const criticalCount = findings.filter((f) => f.severity === 'critical').length;
    const warningCount = findings.filter((f) => f.severity === 'warning').length;

    if (criticalCount === 0 && warningCount === 0 && this.packets.length > 0) {
      findings.push({
        id: 'no-major-issues',
        severity: 'success',
        category: 'Summary',
        title: 'No Major Issues Detected',
        description: 'The analysis did not find any critical or warning-level issues in the capture file.',
        details: [
          `Total packets analyzed: ${this.packets.length}`,
          'Continue monitoring for any emerging patterns',
        ],
        recommendations: [
          'Consider capturing during peak load periods for comparison',
          'Set up continuous monitoring for production environments',
        ],
      });
    }

    return findings;
  }
}
