package iperf

import (
	"math"
	"testing"

	"github.com/Tom-Oram/fak/backend/internal/models"
)

func TestConvertBytes(t *testing.T) {
	tests := []struct {
		value float64
		unit  string
		want  float64
	}{
		{1.0, "GBytes", 1024 * 1024 * 1024},
		{2.5, "GBytes", 2.5 * 1024 * 1024 * 1024},
		{1.0, "MBytes", 1024 * 1024},
		{100.0, "MBytes", 100 * 1024 * 1024},
		{1.0, "KBytes", 1024},
		{512.0, "KBytes", 512 * 1024},
		{1.0, "Bytes", 1.0},
		{1024.0, "Bytes", 1024.0},
	}

	for _, tt := range tests {
		got := convertBytes(tt.value, tt.unit)
		if math.Abs(got-tt.want) > 0.01 {
			t.Errorf("convertBytes(%v, %q) = %v, want %v", tt.value, tt.unit, got, tt.want)
		}
	}
}

func TestConvertBitrate(t *testing.T) {
	tests := []struct {
		value float64
		unit  string
		want  float64
	}{
		{1.0, "Gbits/sec", 1e9},
		{21.2, "Gbits/sec", 21.2e9},
		{1.0, "Mbits/sec", 1e6},
		{500.0, "Mbits/sec", 500e6},
		{1.0, "Kbits/sec", 1e3},
		{256.0, "Kbits/sec", 256e3},
		{1.0, "bits/sec", 1.0},
	}

	for _, tt := range tests {
		got := convertBitrate(tt.value, tt.unit)
		if math.Abs(got-tt.want) > 0.01 {
			t.Errorf("convertBitrate(%v, %q) = %v, want %v", tt.value, tt.unit, got, tt.want)
		}
	}
}

func TestParseLine_AcceptedConnection(t *testing.T) {
	p := NewTextParser()
	result := p.ParseLine("Accepted connection from 10.0.0.1, port 54321")

	if result.Event != EventClientConnected {
		t.Fatalf("expected EventClientConnected, got %v", result.Event)
	}
	if result.ConnectionEvent == nil {
		t.Fatal("ConnectionEvent is nil")
	}
	if result.ConnectionEvent.ClientIP != "10.0.0.1" {
		t.Errorf("ClientIP = %q, want %q", result.ConnectionEvent.ClientIP, "10.0.0.1")
	}
	if result.ConnectionEvent.EventType != "connected" {
		t.Errorf("EventType = %q, want %q", result.ConnectionEvent.EventType, "connected")
	}
}

func TestParseLine_ConnectedTo(t *testing.T) {
	p := NewTextParser()
	result := p.ParseLine("[  5] local 10.0.0.2 port 5201 connected to 10.0.0.1 port 54321")

	if result.Event != EventNone {
		t.Fatalf("expected EventNone, got %v", result.Event)
	}
	if p.clientIP != "10.0.0.1" {
		t.Errorf("clientIP = %q, want %q", p.clientIP, "10.0.0.1")
	}
	if p.clientPort != 54321 {
		t.Errorf("clientPort = %d, want %d", p.clientPort, 54321)
	}
}

func TestParseLine_TCPInterval(t *testing.T) {
	p := NewTextParser()
	result := p.ParseLine("[  5]   0.00-1.00   sec  2.47 GBytes  21.2 Gbits/sec")

	if result.Event != EventBandwidthUpdate {
		t.Fatalf("expected EventBandwidthUpdate, got %v", result.Event)
	}
	if result.BandwidthUpdate == nil {
		t.Fatal("BandwidthUpdate is nil")
	}
	if result.BandwidthUpdate.IntervalStart != 0.0 {
		t.Errorf("IntervalStart = %v, want 0.0", result.BandwidthUpdate.IntervalStart)
	}
	if result.BandwidthUpdate.IntervalEnd != 1.0 {
		t.Errorf("IntervalEnd = %v, want 1.0", result.BandwidthUpdate.IntervalEnd)
	}
	expectedBps := 21.2e9
	if math.Abs(result.BandwidthUpdate.BitsPerSecond-expectedBps) > 1.0 {
		t.Errorf("BitsPerSecond = %v, want %v", result.BandwidthUpdate.BitsPerSecond, expectedBps)
	}
}

func TestParseLine_UDPInterval(t *testing.T) {
	p := NewTextParser()

	// Set protocol to UDP via header line
	p.ParseLine("[ ID] Interval           Transfer     Bitrate         Jitter    Lost/Total Datagrams")
	if p.protocol != models.ProtocolUDP {
		t.Fatalf("protocol = %q, want %q", p.protocol, models.ProtocolUDP)
	}

	result := p.ParseLine("[  5]   0.00-1.00   sec  1.25 MBytes  10.5 Mbits/sec  0.123 ms  0/856 (0%)")

	if result.Event != EventBandwidthUpdate {
		t.Fatalf("expected EventBandwidthUpdate, got %v", result.Event)
	}
	expectedBps := 10.5e6
	if math.Abs(result.BandwidthUpdate.BitsPerSecond-expectedBps) > 1.0 {
		t.Errorf("BitsPerSecond = %v, want %v", result.BandwidthUpdate.BitsPerSecond, expectedBps)
	}
}

func TestParseLine_Separator(t *testing.T) {
	p := NewTextParser()
	result := p.ParseLine("- - - - - - - - - - - - -")

	if result.Event != EventNone {
		t.Fatalf("expected EventNone, got %v", result.Event)
	}
	if !p.inSummary {
		t.Error("expected inSummary=true after separator")
	}
}

func TestParseLine_SummaryReceiver(t *testing.T) {
	p := NewTextParser()
	p.clientIP = "10.0.0.1"
	p.clientPort = 54321

	// Set inSummary
	p.ParseLine("- - - - - - - - - - - - -")

	result := p.ParseLine("[  5]   0.00-10.00  sec  23.2 GBytes  19.9 Gbits/sec                  receiver")

	if result.Event != EventTestComplete {
		t.Fatalf("expected EventTestComplete, got %v", result.Event)
	}
	if result.TestResult == nil {
		t.Fatal("TestResult is nil")
	}
	if result.TestResult.Direction != "upload" {
		t.Errorf("Direction = %q, want %q", result.TestResult.Direction, "upload")
	}
	if result.TestResult.ClientIP != "10.0.0.1" {
		t.Errorf("ClientIP = %q, want %q", result.TestResult.ClientIP, "10.0.0.1")
	}
	if result.TestResult.Protocol != models.ProtocolTCP {
		t.Errorf("Protocol = %q, want %q", result.TestResult.Protocol, models.ProtocolTCP)
	}
}

func TestParseLine_SummarySender(t *testing.T) {
	p := NewTextParser()
	p.clientIP = "10.0.0.1"
	p.clientPort = 54321

	p.ParseLine("- - - - - - - - - - - - -")

	result := p.ParseLine("[  5]   0.00-10.04  sec  23.2 GBytes  19.9 Gbits/sec                  sender")

	if result.Event != EventTestComplete {
		t.Fatalf("expected EventTestComplete, got %v", result.Event)
	}
	if result.TestResult.Direction != "download" {
		t.Errorf("Direction = %q, want %q", result.TestResult.Direction, "download")
	}
}

func TestParseLine_ServerListening_ResetsState(t *testing.T) {
	p := NewTextParser()

	// Set some state
	p.clientIP = "10.0.0.1"
	p.clientPort = 54321
	p.protocol = models.ProtocolUDP
	p.inSummary = true
	p.intervals = 5

	result := p.ParseLine("Server listening on 5201")

	if result.Event != EventNone {
		t.Fatalf("expected EventNone, got %v", result.Event)
	}
	if p.clientIP != "" {
		t.Errorf("clientIP = %q, want empty", p.clientIP)
	}
	if p.clientPort != 0 {
		t.Errorf("clientPort = %d, want 0", p.clientPort)
	}
	if p.protocol != models.ProtocolTCP {
		t.Errorf("protocol = %q, want %q", p.protocol, models.ProtocolTCP)
	}
	if p.inSummary {
		t.Error("expected inSummary=false after reset")
	}
	if p.intervals != 0 {
		t.Errorf("intervals = %d, want 0", p.intervals)
	}
}

func TestParseLine_ServerListening_WithTestNumber(t *testing.T) {
	p := NewTextParser()
	p.clientIP = "10.0.0.1"

	result := p.ParseLine("Server listening on 5201 (test #2)")

	if result.Event != EventNone {
		t.Fatalf("expected EventNone, got %v", result.Event)
	}
	if p.clientIP != "" {
		t.Errorf("clientIP = %q, want empty after reset", p.clientIP)
	}
}

func TestParseLine_EmptyAndIrrelevantLines(t *testing.T) {
	p := NewTextParser()

	lines := []string{
		"",
		"   ",
		"-----------------------------------------------------------",
		"[ ID] Interval           Transfer     Bitrate",
		"iperf 3.12 (cJSON 1.7.15)",
		"Time: Fri, 31 Jan 2026 12:00:00 GMT",
	}

	for _, line := range lines {
		result := p.ParseLine(line)
		if result.Event != EventNone {
			t.Errorf("ParseLine(%q) = %v, want EventNone", line, result.Event)
		}
	}
}

func TestFullTCPSession(t *testing.T) {
	p := NewTextParser()

	lines := []struct {
		line      string
		wantEvent ParseEvent
	}{
		{"-----------------------------------------------------------", EventNone},
		{"Server listening on 5201", EventNone},
		{"-----------------------------------------------------------", EventNone},
		{"Accepted connection from 192.168.1.10, port 45678", EventClientConnected},
		{"[  5] local 192.168.1.1 port 5201 connected to 192.168.1.10 port 45679", EventNone},
		{"[ ID] Interval           Transfer     Bitrate", EventNone},
		{"[  5]   0.00-1.00   sec  2.47 GBytes  21.2 Gbits/sec", EventBandwidthUpdate},
		{"[  5]   1.00-2.00   sec  2.50 GBytes  21.5 Gbits/sec", EventBandwidthUpdate},
		{"[  5]   2.00-3.00   sec  2.45 GBytes  21.0 Gbits/sec", EventBandwidthUpdate},
		{"- - - - - - - - - - - - -", EventNone},
		{"[  5]   0.00-3.00   sec  7.42 GBytes  21.2 Gbits/sec                  receiver", EventTestComplete},
	}

	connEvents := 0
	bwEvents := 0
	completeEvents := 0

	for _, tt := range lines {
		result := p.ParseLine(tt.line)
		if result.Event != tt.wantEvent {
			t.Errorf("ParseLine(%q): event = %v, want %v", tt.line, result.Event, tt.wantEvent)
		}
		switch result.Event {
		case EventClientConnected:
			connEvents++
		case EventBandwidthUpdate:
			bwEvents++
		case EventTestComplete:
			completeEvents++
			if result.TestResult.ClientIP != "192.168.1.10" {
				t.Errorf("ClientIP = %q, want %q", result.TestResult.ClientIP, "192.168.1.10")
			}
			if result.TestResult.ClientPort != 45679 {
				t.Errorf("ClientPort = %d, want %d", result.TestResult.ClientPort, 45679)
			}
			if result.TestResult.Direction != "upload" {
				t.Errorf("Direction = %q, want %q", result.TestResult.Direction, "upload")
			}
			if result.TestResult.Protocol != models.ProtocolTCP {
				t.Errorf("Protocol = %q, want %q", result.TestResult.Protocol, models.ProtocolTCP)
			}
		}
	}

	if connEvents != 1 {
		t.Errorf("connEvents = %d, want 1", connEvents)
	}
	if bwEvents != 3 {
		t.Errorf("bwEvents = %d, want 3", bwEvents)
	}
	if completeEvents != 1 {
		t.Errorf("completeEvents = %d, want 1", completeEvents)
	}
}

func TestFullUDPSession(t *testing.T) {
	p := NewTextParser()

	lines := []struct {
		line      string
		wantEvent ParseEvent
	}{
		{"Server listening on 5201", EventNone},
		{"Accepted connection from 192.168.1.10, port 45678", EventClientConnected},
		{"[  5] local 192.168.1.1 port 5201 connected to 192.168.1.10 port 45679", EventNone},
		{"[ ID] Interval           Transfer     Bitrate         Jitter    Lost/Total Datagrams", EventNone},
		{"[  5]   0.00-1.00   sec  1.25 MBytes  10.5 Mbits/sec  0.050 ms  0/856 (0%)", EventBandwidthUpdate},
		{"[  5]   1.00-2.00   sec  1.25 MBytes  10.5 Mbits/sec  0.040 ms  0/856 (0%)", EventBandwidthUpdate},
		{"- - - - - - - - - - - - -", EventNone},
		{"[  5]   0.00-2.00   sec  2.50 MBytes  10.5 Mbits/sec  0.045 ms  2/1712 (0.12%)  receiver", EventTestComplete},
	}

	for _, tt := range lines {
		result := p.ParseLine(tt.line)
		if result.Event != tt.wantEvent {
			t.Errorf("ParseLine(%q): event = %v, want %v", tt.line, result.Event, tt.wantEvent)
		}
		if result.Event == EventTestComplete {
			if result.TestResult.Protocol != models.ProtocolUDP {
				t.Errorf("Protocol = %q, want %q", result.TestResult.Protocol, models.ProtocolUDP)
			}
			if result.TestResult.Jitter == nil {
				t.Fatal("Jitter is nil, want non-nil")
			}
			if math.Abs(*result.TestResult.Jitter-0.045) > 0.001 {
				t.Errorf("Jitter = %v, want 0.045", *result.TestResult.Jitter)
			}
			if result.TestResult.PacketLoss == nil {
				t.Fatal("PacketLoss is nil, want non-nil")
			}
			if math.Abs(*result.TestResult.PacketLoss-0.12) > 0.01 {
				t.Errorf("PacketLoss = %v, want 0.12", *result.TestResult.PacketLoss)
			}
			if result.TestResult.Direction != "upload" {
				t.Errorf("Direction = %q, want %q", result.TestResult.Direction, "upload")
			}
		}
	}
}

func TestMinMaxBandwidth_NoIntervals(t *testing.T) {
	p := NewTextParser()
	p.clientIP = "10.0.0.1"

	// Go straight to summary without any interval lines
	p.ParseLine("- - - - - - - - - - - - -")
	result := p.ParseLine("[  5]   0.00-10.00  sec  23.2 GBytes  19.9 Gbits/sec                  receiver")

	if result.Event != EventTestComplete {
		t.Fatalf("expected EventTestComplete, got %v", result.Event)
	}

	expectedBps := 19.9e9
	if math.Abs(result.TestResult.MinBandwidth-expectedBps) > 1.0 {
		t.Errorf("MinBandwidth = %v, want %v (fallback to avg)", result.TestResult.MinBandwidth, expectedBps)
	}
	if math.Abs(result.TestResult.MaxBandwidth-expectedBps) > 1.0 {
		t.Errorf("MaxBandwidth = %v, want %v (fallback to avg)", result.TestResult.MaxBandwidth, expectedBps)
	}
}

func TestMinMaxBandwidth_WithIntervals(t *testing.T) {
	p := NewTextParser()

	p.ParseLine("[  5]   0.00-1.00   sec  2.47 GBytes  21.2 Gbits/sec")
	p.ParseLine("[  5]   1.00-2.00   sec  2.50 GBytes  21.5 Gbits/sec")
	p.ParseLine("[  5]   2.00-3.00   sec  2.45 GBytes  21.0 Gbits/sec")

	p.ParseLine("- - - - - - - - - - - - -")
	result := p.ParseLine("[  5]   0.00-3.00   sec  7.42 GBytes  21.2 Gbits/sec                  receiver")

	if result.Event != EventTestComplete {
		t.Fatalf("expected EventTestComplete, got %v", result.Event)
	}
	if math.Abs(result.TestResult.MinBandwidth-21.0e9) > 1.0 {
		t.Errorf("MinBandwidth = %v, want %v", result.TestResult.MinBandwidth, 21.0e9)
	}
	if math.Abs(result.TestResult.MaxBandwidth-21.5e9) > 1.0 {
		t.Errorf("MaxBandwidth = %v, want %v", result.TestResult.MaxBandwidth, 21.5e9)
	}
}

func TestMultipleTestSessions(t *testing.T) {
	p := NewTextParser()

	// First test session
	p.ParseLine("Server listening on 5201")
	p.ParseLine("Accepted connection from 10.0.0.1, port 50000")
	p.ParseLine("[  5] local 10.0.0.2 port 5201 connected to 10.0.0.1 port 50001")
	p.ParseLine("[  5]   0.00-1.00   sec  2.47 GBytes  21.2 Gbits/sec")
	p.ParseLine("- - - - - - - - - - - - -")
	r1 := p.ParseLine("[  5]   0.00-1.00   sec  2.47 GBytes  21.2 Gbits/sec                  receiver")

	if r1.Event != EventTestComplete {
		t.Fatalf("test 1: expected EventTestComplete, got %v", r1.Event)
	}
	if r1.TestResult.ClientIP != "10.0.0.1" {
		t.Errorf("test 1: ClientIP = %q, want %q", r1.TestResult.ClientIP, "10.0.0.1")
	}

	// Server listening resets state
	p.ParseLine("Server listening on 5201 (test #2)")

	// Verify state was reset
	if p.clientIP != "" {
		t.Errorf("after reset: clientIP = %q, want empty", p.clientIP)
	}
	if p.inSummary {
		t.Error("after reset: inSummary should be false")
	}
	if p.intervals != 0 {
		t.Errorf("after reset: intervals = %d, want 0", p.intervals)
	}

	// Second test session with different client
	p.ParseLine("Accepted connection from 10.0.0.2, port 60000")
	p.ParseLine("[  5] local 10.0.0.2 port 5201 connected to 10.0.0.2 port 60001")
	p.ParseLine("[  5]   0.00-1.00   sec  1.00 GBytes  8.59 Gbits/sec")
	p.ParseLine("- - - - - - - - - - - - -")
	r2 := p.ParseLine("[  5]   0.00-1.00   sec  1.00 GBytes  8.59 Gbits/sec                  receiver")

	if r2.Event != EventTestComplete {
		t.Fatalf("test 2: expected EventTestComplete, got %v", r2.Event)
	}
	if r2.TestResult.ClientIP != "10.0.0.2" {
		t.Errorf("test 2: ClientIP = %q, want %q", r2.TestResult.ClientIP, "10.0.0.2")
	}
}
