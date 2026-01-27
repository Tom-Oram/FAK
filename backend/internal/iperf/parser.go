package iperf

import (
	"encoding/json"
	"math"
	"time"

	"github.com/Tom-Oram/fak/backend/internal/models"
)

// iperf3 JSON output structures - these match iperf3 JSON output format

// Iperf3Output represents the complete JSON output from iperf3
type Iperf3Output struct {
	Start     Iperf3Start      `json:"start"`
	Intervals []Iperf3Interval `json:"intervals"`
	End       Iperf3End        `json:"end"`
	Error     string           `json:"error,omitempty"`
}

// Iperf3Start contains information about the test start
type Iperf3Start struct {
	Connected []Iperf3Connected `json:"connected"`
	Timestamp Iperf3Timestamp   `json:"timestamp"`
	TestStart Iperf3TestStart   `json:"test_start"`
}

// Iperf3Connected contains connection details
type Iperf3Connected struct {
	Socket     int    `json:"socket"`
	LocalHost  string `json:"local_host"`
	LocalPort  int    `json:"local_port"`
	RemoteHost string `json:"remote_host"`
	RemotePort int    `json:"remote_port"`
}

// Iperf3Timestamp contains timing information
type Iperf3Timestamp struct {
	Time     string `json:"time"`
	Timesecs int64  `json:"timesecs"`
}

// Iperf3TestStart contains test configuration details
type Iperf3TestStart struct {
	Protocol   string `json:"protocol"`
	NumStreams int    `json:"num_streams"`
	BlkSize    int    `json:"blksize"`
	Duration   int    `json:"duration"`
	Reverse    int    `json:"reverse"`
}

// Iperf3Interval contains data for a single measurement interval
type Iperf3Interval struct {
	Streams []Iperf3Stream `json:"streams"`
	Sum     Iperf3Sum      `json:"sum"`
}

// Iperf3Stream contains per-stream interval data
type Iperf3Stream struct {
	Socket        int     `json:"socket"`
	Start         float64 `json:"start"`
	End           float64 `json:"end"`
	Seconds       float64 `json:"seconds"`
	Bytes         int64   `json:"bytes"`
	BitsPerSecond float64 `json:"bits_per_second"`
	Retransmits   int     `json:"retransmits"`
	Omitted       bool    `json:"omitted"`
}

// Iperf3Sum contains summary data for an interval
type Iperf3Sum struct {
	Start         float64 `json:"start"`
	End           float64 `json:"end"`
	Seconds       float64 `json:"seconds"`
	Bytes         int64   `json:"bytes"`
	BitsPerSecond float64 `json:"bits_per_second"`
	Retransmits   int     `json:"retransmits"`
	Omitted       bool    `json:"omitted"`
}

// Iperf3End contains the final test results
type Iperf3End struct {
	Streams        []Iperf3EndStream `json:"streams"`
	SumSent        Iperf3SumStats    `json:"sum_sent"`
	SumReceived    Iperf3SumStats    `json:"sum_received"`
	CPUUtilization Iperf3CPU         `json:"cpu_utilization_percent"`
}

// Iperf3EndStream contains per-stream final results
type Iperf3EndStream struct {
	Sender   Iperf3SumStats `json:"sender"`
	Receiver Iperf3SumStats `json:"receiver"`
}

// Iperf3SumStats contains summary statistics
type Iperf3SumStats struct {
	Start         float64 `json:"start"`
	End           float64 `json:"end"`
	Seconds       float64 `json:"seconds"`
	Bytes         int64   `json:"bytes"`
	BitsPerSecond float64 `json:"bits_per_second"`
	Retransmits   int     `json:"retransmits"`
	Jitter        float64 `json:"jitter_ms"`
	LostPackets   int     `json:"lost_packets"`
	Packets       int     `json:"packets"`
	LostPercent   float64 `json:"lost_percent"`
}

// Iperf3CPU contains CPU utilization data
type Iperf3CPU struct {
	HostTotal    float64 `json:"host_total"`
	HostUser     float64 `json:"host_user"`
	HostSystem   float64 `json:"host_system"`
	RemoteTotal  float64 `json:"remote_total"`
	RemoteUser   float64 `json:"remote_user"`
	RemoteSystem float64 `json:"remote_system"`
}

// ParseOutput parses iperf3 JSON output into an Iperf3Output struct
func ParseOutput(data []byte) (*Iperf3Output, error) {
	var output Iperf3Output
	if err := json.Unmarshal(data, &output); err != nil {
		return nil, err
	}
	return &output, nil
}

// ExtractBandwidthUpdate extracts a BandwidthUpdate from an interval
func ExtractBandwidthUpdate(interval Iperf3Interval) models.BandwidthUpdate {
	return models.BandwidthUpdate{
		Timestamp:     time.Now(),
		IntervalStart: interval.Sum.Start,
		IntervalEnd:   interval.Sum.End,
		Bytes:         interval.Sum.Bytes,
		BitsPerSecond: interval.Sum.BitsPerSecond,
	}
}

// ExtractTestResult extracts a TestResult from complete iperf3 output
func ExtractTestResult(output *Iperf3Output) *models.TestResult {
	if output == nil {
		return nil
	}

	result := &models.TestResult{
		Timestamp: time.Now(),
	}

	// Extract client info from connected
	if len(output.Start.Connected) > 0 {
		conn := output.Start.Connected[0]
		result.ClientIP = conn.RemoteHost
		result.ClientPort = conn.RemotePort
	}

	// Determine protocol
	protocol := output.Start.TestStart.Protocol
	if protocol == "UDP" {
		result.Protocol = models.ProtocolUDP
	} else {
		result.Protocol = models.ProtocolTCP
	}

	// Determine direction: reverse=1 means download (client receives), otherwise upload
	if output.Start.TestStart.Reverse == 1 {
		result.Direction = "download"
	} else {
		result.Direction = "upload"
	}

	// Choose the appropriate stats based on direction
	// For upload: use SumReceived (what the server received)
	// For download: use SumSent (what the server sent)
	var stats Iperf3SumStats
	if result.Direction == "upload" {
		stats = output.End.SumReceived
	} else {
		stats = output.End.SumSent
	}

	result.Duration = stats.Seconds
	result.BytesTransferred = stats.Bytes
	result.AvgBandwidth = stats.BitsPerSecond

	// Calculate min/max bandwidth from intervals
	minBandwidth := math.MaxFloat64
	maxBandwidth := 0.0

	for _, interval := range output.Intervals {
		if !interval.Sum.Omitted {
			bps := interval.Sum.BitsPerSecond
			if bps < minBandwidth {
				minBandwidth = bps
			}
			if bps > maxBandwidth {
				maxBandwidth = bps
			}
		}
	}

	// Handle case with no intervals
	if minBandwidth == math.MaxFloat64 {
		minBandwidth = stats.BitsPerSecond
	}
	if maxBandwidth == 0.0 {
		maxBandwidth = stats.BitsPerSecond
	}

	result.MinBandwidth = minBandwidth
	result.MaxBandwidth = maxBandwidth

	// Include TCP-specific metrics
	if result.Protocol == models.ProtocolTCP {
		retransmits := stats.Retransmits
		result.Retransmits = &retransmits
	}

	// Include UDP-specific metrics
	if result.Protocol == models.ProtocolUDP {
		jitter := stats.Jitter
		result.Jitter = &jitter

		packetLoss := stats.LostPercent
		result.PacketLoss = &packetLoss
	}

	return result
}

// ExtractConnectionEvent creates a ConnectionEvent from iperf3 start output
func ExtractConnectionEvent(output *Iperf3Output) *models.ConnectionEvent {
	if output == nil || len(output.Start.Connected) == 0 {
		return nil
	}

	conn := output.Start.Connected[0]

	return &models.ConnectionEvent{
		Timestamp: time.Now(),
		ClientIP:  conn.RemoteHost,
		EventType: "connected",
		Details:   "",
	}
}
