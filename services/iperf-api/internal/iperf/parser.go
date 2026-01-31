package iperf

import (
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/Tom-Oram/fak/backend/internal/models"
)

// ParseEvent represents the type of event produced by parsing a line.
type ParseEvent int

const (
	EventNone            ParseEvent = iota
	EventClientConnected            // "Accepted connection from ..."
	EventBandwidthUpdate            // per-interval bandwidth line
	EventTestComplete               // summary sender/receiver line
	EventError                      // iperf3 error line
)

// ParseResult is the output of parsing a single line.
type ParseResult struct {
	Event           ParseEvent
	ConnectionEvent *models.ConnectionEvent
	BandwidthUpdate *models.BandwidthUpdate
	TestResult      *models.TestResult
	ErrorMessage    string
}

// TextParser parses iperf3 text (non-JSON) stdout line-by-line.
type TextParser struct {
	// compiled regex patterns
	reAccepted    *regexp.Regexp
	reConnectedTo *regexp.Regexp
	reUDPHeader   *regexp.Regexp
	reSeparator   *regexp.Regexp
	reInterval    *regexp.Regexp
	reSummary     *regexp.Regexp
	reListening   *regexp.Regexp

	// per-test session state
	clientIP     string
	clientPort   int
	protocol     models.Protocol
	inSummary    bool
	minBandwidth float64
	maxBandwidth float64
	intervals    int
}

// NewTextParser creates a TextParser with compiled regex patterns.
func NewTextParser() *TextParser {
	return &TextParser{
		// "Accepted connection from 10.0.0.1, port 54321"
		reAccepted: regexp.MustCompile(
			`Accepted connection from ([^,]+), port (\d+)`),

		// "[  5] local 10.0.0.2 port 5201 connected to 10.0.0.1 port 54321"
		reConnectedTo: regexp.MustCompile(
			`\[\s*\d+\]\s+local\s+\S+\s+port\s+\d+\s+connected to\s+(\S+)\s+port\s+(\d+)`),

		// "[ ID] Interval           Transfer     Bitrate         Jitter    Lost/Total Datagrams"
		reUDPHeader: regexp.MustCompile(
			`\[\s*ID\].*Jitter.*Lost/Total`),

		// "- - - - - - - - - - - - -"
		reSeparator: regexp.MustCompile(
			`^-\s+-\s+-\s+-\s+-`),

		// "[  5]   0.00-1.00   sec  2.47 GBytes  21.2 Gbits/sec"
		// "[  5]   0.00-1.00   sec  1.25 MBytes  10.5 Mbits/sec  0.123 ms  0/856 (0%)"
		reInterval: regexp.MustCompile(
			`\[\s*\d+\]\s+([\d.]+)-([\d.]+)\s+sec\s+([\d.]+)\s+(\S?Bytes)\s+([\d.]+)\s+(\S?bits/sec)(?:\s+([\d.]+)\s+ms\s+(\d+)/(\d+)\s+\(([\d.]+)%\))?`),

		// Same as interval but with sender/receiver suffix
		reSummary: regexp.MustCompile(
			`\[\s*\d+\]\s+([\d.]+)-([\d.]+)\s+sec\s+([\d.]+)\s+(\S?Bytes)\s+([\d.]+)\s+(\S?bits/sec)(?:\s+([\d.]+)\s+ms\s+(\d+)/(\d+)\s+\(([\d.]+)%\))?\s+(sender|receiver)`),

		// "Server listening on 5201 (test #2)"  or  "Server listening on 5201"
		reListening: regexp.MustCompile(
			`Server listening on (\d+)`),

		protocol: models.ProtocolTCP,
	}
}

// ParseLine parses a single line of iperf3 text output and returns a result.
func (p *TextParser) ParseLine(line string) ParseResult {
	line = strings.TrimRight(line, "\r\n")

	// Check for summary line first (has sender/receiver suffix)
	if m := p.reSummary.FindStringSubmatch(line); m != nil && p.inSummary {
		return p.buildTestComplete(m)
	}

	// "Accepted connection from ..."
	if m := p.reAccepted.FindStringSubmatch(line); m != nil {
		ip := m[1]
		return ParseResult{
			Event: EventClientConnected,
			ConnectionEvent: &models.ConnectionEvent{
				Timestamp: time.Now(),
				ClientIP:  ip,
				EventType: "connected",
			},
		}
	}

	// "connected to <IP> port <PORT>" — updates parser state
	if m := p.reConnectedTo.FindStringSubmatch(line); m != nil {
		p.clientIP = m[1]
		p.clientPort, _ = strconv.Atoi(m[2])
		return ParseResult{Event: EventNone}
	}

	// UDP header detection
	if p.reUDPHeader.MatchString(line) {
		p.protocol = models.ProtocolUDP
		return ParseResult{Event: EventNone}
	}

	// Separator marks start of summary section
	if p.reSeparator.MatchString(line) {
		p.inSummary = true
		return ParseResult{Event: EventNone}
	}

	// Server listening — reset session state for next test
	if p.reListening.MatchString(line) {
		p.resetSession()
		return ParseResult{Event: EventNone}
	}

	// Interval line (not in summary)
	if m := p.reInterval.FindStringSubmatch(line); m != nil && !p.inSummary {
		return p.buildBandwidthUpdate(m)
	}

	return ParseResult{Event: EventNone}
}

// buildBandwidthUpdate creates a BandwidthUpdate from an interval regex match.
func (p *TextParser) buildBandwidthUpdate(m []string) ParseResult {
	start, _ := strconv.ParseFloat(m[1], 64)
	end, _ := strconv.ParseFloat(m[2], 64)
	transferVal, _ := strconv.ParseFloat(m[3], 64)
	transferUnit := m[4]
	bitrateVal, _ := strconv.ParseFloat(m[5], 64)
	bitrateUnit := m[6]

	bytes := int64(convertBytes(transferVal, transferUnit))
	bps := convertBitrate(bitrateVal, bitrateUnit)

	// Track min/max for test complete
	if p.intervals == 0 {
		p.minBandwidth = bps
		p.maxBandwidth = bps
	} else {
		if bps < p.minBandwidth {
			p.minBandwidth = bps
		}
		if bps > p.maxBandwidth {
			p.maxBandwidth = bps
		}
	}
	p.intervals++

	return ParseResult{
		Event: EventBandwidthUpdate,
		BandwidthUpdate: &models.BandwidthUpdate{
			Timestamp:     time.Now(),
			IntervalStart: start,
			IntervalEnd:   end,
			Bytes:         bytes,
			BitsPerSecond: bps,
		},
	}
}

// buildTestComplete creates a TestResult from a summary regex match.
func (p *TextParser) buildTestComplete(m []string) ParseResult {
	start, _ := strconv.ParseFloat(m[1], 64)
	end, _ := strconv.ParseFloat(m[2], 64)
	transferVal, _ := strconv.ParseFloat(m[3], 64)
	transferUnit := m[4]
	bitrateVal, _ := strconv.ParseFloat(m[5], 64)
	bitrateUnit := m[6]

	bytes := int64(convertBytes(transferVal, transferUnit))
	bps := convertBitrate(bitrateVal, bitrateUnit)
	duration := end - start

	// Direction: on the server side, "receiver" = upload, "sender" = download
	role := m[11]
	direction := "upload"
	if role == "sender" {
		direction = "download"
	}

	result := &models.TestResult{
		Timestamp:        time.Now(),
		ClientIP:         p.clientIP,
		ClientPort:       p.clientPort,
		Protocol:         p.protocol,
		Duration:         duration,
		BytesTransferred: bytes,
		AvgBandwidth:     bps,
		Direction:        direction,
	}

	// Min/max from tracked intervals
	if p.intervals > 0 {
		result.MinBandwidth = p.minBandwidth
		result.MaxBandwidth = p.maxBandwidth
	} else {
		result.MinBandwidth = bps
		result.MaxBandwidth = bps
	}

	// UDP-specific fields
	if p.protocol == models.ProtocolUDP && m[7] != "" {
		jitter, _ := strconv.ParseFloat(m[7], 64)
		result.Jitter = &jitter

		lost, _ := strconv.Atoi(m[8])
		total, _ := strconv.Atoi(m[9])
		lostPct, _ := strconv.ParseFloat(m[10], 64)
		_ = lost
		_ = total
		result.PacketLoss = &lostPct
	}

	return ParseResult{
		Event:      EventTestComplete,
		TestResult: result,
	}
}

// resetSession clears per-test state for the next test session.
func (p *TextParser) resetSession() {
	p.clientIP = ""
	p.clientPort = 0
	p.protocol = models.ProtocolTCP
	p.inSummary = false
	p.minBandwidth = 0
	p.maxBandwidth = 0
	p.intervals = 0
}

// convertBytes converts a transfer value with unit to bytes.
// iperf3 uses binary prefixes: 1 GBytes = 1024^3, 1 MBytes = 1024^2, etc.
func convertBytes(value float64, unit string) float64 {
	switch {
	case strings.HasPrefix(unit, "G"):
		return value * 1024 * 1024 * 1024
	case strings.HasPrefix(unit, "M"):
		return value * 1024 * 1024
	case strings.HasPrefix(unit, "K"):
		return value * 1024
	default:
		return value
	}
}

// convertBitrate converts a bitrate value with unit to bits/sec.
// iperf3 uses decimal prefixes: 1 Gbits/sec = 1e9, 1 Mbits/sec = 1e6, etc.
func convertBitrate(value float64, unit string) float64 {
	switch {
	case strings.HasPrefix(unit, "G"):
		return value * 1e9
	case strings.HasPrefix(unit, "M"):
		return value * 1e6
	case strings.HasPrefix(unit, "K"):
		return value * 1e3
	default:
		return value
	}
}
