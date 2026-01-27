package models

import "time"

// ServerStatus represents the current state of the iPerf server
type ServerStatus string

const (
	ServerStatusStopped ServerStatus = "stopped"
	ServerStatusRunning ServerStatus = "running"
	ServerStatusError   ServerStatus = "error"
)

// Protocol represents the network protocol for iPerf tests
type Protocol string

const (
	ProtocolTCP Protocol = "tcp"
	ProtocolUDP Protocol = "udp"
)

// ServerConfig holds the configuration for the iPerf server
type ServerConfig struct {
	Port        int      `json:"port"`
	BindAddress string   `json:"bindAddress"`
	Protocol    Protocol `json:"protocol"`
	OneOff      bool     `json:"oneOff"`
	IdleTimeout int      `json:"idleTimeout"`
	Allowlist   []string `json:"allowlist,omitempty"`
}

// DefaultServerConfig returns a ServerConfig with sensible defaults
func DefaultServerConfig() ServerConfig {
	return ServerConfig{
		Port:        5201,
		BindAddress: "0.0.0.0",
		Protocol:    ProtocolTCP,
		OneOff:      false,
		IdleTimeout: 300,
		Allowlist:   nil,
	}
}

// TestResult represents the results of a completed iPerf test
type TestResult struct {
	ID               string    `json:"id"`
	Timestamp        time.Time `json:"timestamp"`
	ClientIP         string    `json:"clientIp"`
	ClientPort       int       `json:"clientPort"`
	Protocol         Protocol  `json:"protocol"`
	Duration         float64   `json:"duration"`
	BytesTransferred int64     `json:"bytesTransferred"`
	AvgBandwidth     float64   `json:"avgBandwidth"`
	MaxBandwidth     float64   `json:"maxBandwidth"`
	MinBandwidth     float64   `json:"minBandwidth"`
	Retransmits      *int      `json:"retransmits,omitempty"`
	Jitter           *float64  `json:"jitter,omitempty"`
	PacketLoss       *float64  `json:"packetLoss,omitempty"`
	Direction        string    `json:"direction"`
}

// BandwidthUpdate represents a real-time bandwidth measurement
type BandwidthUpdate struct {
	Timestamp     time.Time `json:"timestamp"`
	IntervalStart float64   `json:"intervalStart"`
	IntervalEnd   float64   `json:"intervalEnd"`
	Bytes         int64     `json:"bytes"`
	BitsPerSecond float64   `json:"bitsPerSecond"`
}

// ConnectionEvent represents a client connection or disconnection event
type ConnectionEvent struct {
	Timestamp time.Time `json:"timestamp"`
	ClientIP  string    `json:"clientIp"`
	EventType string    `json:"eventType"`
	Details   string    `json:"details,omitempty"`
}

// WSMessageType represents the type of WebSocket message
type WSMessageType string

const (
	WSMessageTypeServerStatus    WSMessageType = "server_status"
	WSMessageTypeClientConnected WSMessageType = "client_connected"
	WSMessageTypeBandwidthUpdate WSMessageType = "bandwidth_update"
	WSMessageTypeTestComplete    WSMessageType = "test_complete"
	WSMessageTypeError           WSMessageType = "error"
)

// WSMessage is the wrapper for all WebSocket messages
type WSMessage struct {
	Type    WSMessageType `json:"type"`
	Payload interface{}   `json:"payload"`
}

// ServerStatusPayload is the payload for server status WebSocket messages
type ServerStatusPayload struct {
	Status     ServerStatus  `json:"status"`
	Config     *ServerConfig `json:"config,omitempty"`
	ListenAddr string        `json:"listenAddr,omitempty"`
	ErrorMsg   string        `json:"errorMsg,omitempty"`
}
