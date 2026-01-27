# iPerf Server Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a fully integrated iPerf3 server to FAK with Go backend, WebSocket real-time updates, SQLite persistence, and React dashboard.

**Architecture:** Go backend manages iperf3 subprocess, parses JSON output, broadcasts via WebSocket. React frontend displays live graphs, connection logs, and historical data. Docker Compose orchestrates both services.

**Tech Stack:** Go (chi router, gorilla/websocket, go-sqlite3), React/TypeScript, Recharts, Docker Compose, SQLite

---

## Phase 1: Go Backend Foundation

### Task 1: Initialize Go module and project structure

**Files:**
- Create: `backend/go.mod`
- Create: `backend/go.sum`
- Create: `backend/cmd/server/main.go`
- Create: `backend/internal/models/types.go`

**Step 1: Create backend directory structure**

```bash
mkdir -p backend/cmd/server backend/internal/{api,iperf,storage,models}
```

**Step 2: Initialize Go module**

```bash
cd backend && go mod init github.com/Tom-Oram/fak/backend
```

**Step 3: Create types.go with core data models**

```go
// backend/internal/models/types.go
package models

import "time"

type ServerStatus string

const (
	StatusStopped ServerStatus = "stopped"
	StatusRunning ServerStatus = "running"
	StatusError   ServerStatus = "error"
)

type Protocol string

const (
	ProtocolTCP Protocol = "tcp"
	ProtocolUDP Protocol = "udp"
)

type ServerConfig struct {
	Port        int      `json:"port"`
	BindAddress string   `json:"bindAddress"`
	Protocol    Protocol `json:"protocol"`
	OneOff      bool     `json:"oneOff"`
	IdleTimeout int      `json:"idleTimeout"`
	Allowlist   []string `json:"allowlist"`
}

func DefaultServerConfig() ServerConfig {
	return ServerConfig{
		Port:        5201,
		BindAddress: "0.0.0.0",
		Protocol:    ProtocolTCP,
		OneOff:      false,
		IdleTimeout: 300,
		Allowlist:   []string{},
	}
}

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

type BandwidthUpdate struct {
	Timestamp     int64   `json:"timestamp"`
	IntervalStart float64 `json:"intervalStart"`
	IntervalEnd   float64 `json:"intervalEnd"`
	Bytes         int64   `json:"bytes"`
	BitsPerSecond float64 `json:"bitsPerSecond"`
}

type ConnectionEvent struct {
	Timestamp time.Time `json:"timestamp"`
	ClientIP  string    `json:"clientIp"`
	EventType string    `json:"eventType"`
	Details   string    `json:"details"`
}

// WebSocket message types
type WSMessageType string

const (
	WSServerStatus    WSMessageType = "server_status"
	WSClientConnected WSMessageType = "client_connected"
	WSBandwidthUpdate WSMessageType = "bandwidth_update"
	WSTestComplete    WSMessageType = "test_complete"
	WSError           WSMessageType = "error"
)

type WSMessage struct {
	Type    WSMessageType `json:"type"`
	Payload interface{}   `json:"payload"`
}

type ServerStatusPayload struct {
	Status      ServerStatus `json:"status"`
	Config      ServerConfig `json:"config"`
	ListenAddr  string       `json:"listenAddr,omitempty"`
	ErrorMsg    string       `json:"errorMsg,omitempty"`
}
```

**Step 4: Create minimal main.go**

```go
// backend/cmd/server/main.go
package main

import (
	"log"
	"net/http"
)

func main() {
	log.Println("iPerf Server backend starting...")

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("OK"))
	})

	log.Println("Listening on :8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal(err)
	}
}
```

**Step 5: Add dependencies**

```bash
cd backend && go get github.com/go-chi/chi/v5 github.com/gorilla/websocket github.com/mattn/go-sqlite3 github.com/google/uuid
```

**Step 6: Verify it compiles**

```bash
cd backend && go build ./cmd/server
```

**Step 7: Commit**

```bash
git add backend/
git commit -m "feat(iperf): initialize Go backend with core types"
```

---

### Task 2: Implement SQLite storage layer

**Files:**
- Create: `backend/internal/storage/sqlite.go`

**Step 1: Create sqlite.go with storage operations**

```go
// backend/internal/storage/sqlite.go
package storage

import (
	"database/sql"
	"time"

	"github.com/Tom-Oram/fak/backend/internal/models"
	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"
)

type SQLiteStorage struct {
	db *sql.DB
}

func NewSQLiteStorage(dbPath string) (*SQLiteStorage, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	s := &SQLiteStorage{db: db}
	if err := s.migrate(); err != nil {
		return nil, err
	}

	return s, nil
}

func (s *SQLiteStorage) migrate() error {
	query := `
	CREATE TABLE IF NOT EXISTS test_results (
		id TEXT PRIMARY KEY,
		timestamp DATETIME NOT NULL,
		client_ip TEXT NOT NULL,
		client_port INTEGER NOT NULL,
		protocol TEXT NOT NULL,
		duration REAL NOT NULL,
		bytes_transferred INTEGER NOT NULL,
		avg_bandwidth REAL NOT NULL,
		max_bandwidth REAL NOT NULL,
		min_bandwidth REAL NOT NULL,
		retransmits INTEGER,
		jitter REAL,
		packet_loss REAL,
		direction TEXT NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_timestamp ON test_results(timestamp);
	CREATE INDEX IF NOT EXISTS idx_client_ip ON test_results(client_ip);
	`
	_, err := s.db.Exec(query)
	return err
}

func (s *SQLiteStorage) SaveTestResult(result *models.TestResult) error {
	if result.ID == "" {
		result.ID = uuid.New().String()
	}
	if result.Timestamp.IsZero() {
		result.Timestamp = time.Now()
	}

	query := `
	INSERT INTO test_results (
		id, timestamp, client_ip, client_port, protocol, duration,
		bytes_transferred, avg_bandwidth, max_bandwidth, min_bandwidth,
		retransmits, jitter, packet_loss, direction
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := s.db.Exec(query,
		result.ID, result.Timestamp, result.ClientIP, result.ClientPort,
		result.Protocol, result.Duration, result.BytesTransferred,
		result.AvgBandwidth, result.MaxBandwidth, result.MinBandwidth,
		result.Retransmits, result.Jitter, result.PacketLoss, result.Direction,
	)
	return err
}

func (s *SQLiteStorage) GetTestResults(limit, offset int) ([]models.TestResult, error) {
	query := `
	SELECT id, timestamp, client_ip, client_port, protocol, duration,
		bytes_transferred, avg_bandwidth, max_bandwidth, min_bandwidth,
		retransmits, jitter, packet_loss, direction
	FROM test_results
	ORDER BY timestamp DESC
	LIMIT ? OFFSET ?
	`
	rows, err := s.db.Query(query, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.TestResult
	for rows.Next() {
		var r models.TestResult
		err := rows.Scan(
			&r.ID, &r.Timestamp, &r.ClientIP, &r.ClientPort,
			&r.Protocol, &r.Duration, &r.BytesTransferred,
			&r.AvgBandwidth, &r.MaxBandwidth, &r.MinBandwidth,
			&r.Retransmits, &r.Jitter, &r.PacketLoss, &r.Direction,
		)
		if err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	return results, rows.Err()
}

func (s *SQLiteStorage) GetTestResultsByClientIP(clientIP string, limit, offset int) ([]models.TestResult, error) {
	query := `
	SELECT id, timestamp, client_ip, client_port, protocol, duration,
		bytes_transferred, avg_bandwidth, max_bandwidth, min_bandwidth,
		retransmits, jitter, packet_loss, direction
	FROM test_results
	WHERE client_ip = ?
	ORDER BY timestamp DESC
	LIMIT ? OFFSET ?
	`
	rows, err := s.db.Query(query, clientIP, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.TestResult
	for rows.Next() {
		var r models.TestResult
		err := rows.Scan(
			&r.ID, &r.Timestamp, &r.ClientIP, &r.ClientPort,
			&r.Protocol, &r.Duration, &r.BytesTransferred,
			&r.AvgBandwidth, &r.MaxBandwidth, &r.MinBandwidth,
			&r.Retransmits, &r.Jitter, &r.PacketLoss, &r.Direction,
		)
		if err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	return results, rows.Err()
}

func (s *SQLiteStorage) GetTotalCount() (int, error) {
	var count int
	err := s.db.QueryRow("SELECT COUNT(*) FROM test_results").Scan(&count)
	return count, err
}

func (s *SQLiteStorage) Close() error {
	return s.db.Close()
}
```

**Step 2: Verify it compiles**

```bash
cd backend && go build ./...
```

**Step 3: Commit**

```bash
git add backend/internal/storage/
git commit -m "feat(iperf): add SQLite storage layer for test results"
```

---

### Task 3: Implement iperf3 config and CLI builder

**Files:**
- Create: `backend/internal/iperf/config.go`

**Step 1: Create config.go**

```go
// backend/internal/iperf/config.go
package iperf

import (
	"fmt"
	"net"
	"strconv"

	"github.com/Tom-Oram/fak/backend/internal/models"
)

type ValidationError struct {
	Field   string
	Message string
}

func (e ValidationError) Error() string {
	return fmt.Sprintf("%s: %s", e.Field, e.Message)
}

func ValidateConfig(cfg models.ServerConfig) []ValidationError {
	var errors []ValidationError

	// Port validation
	if cfg.Port < 1 || cfg.Port > 65535 {
		errors = append(errors, ValidationError{
			Field:   "port",
			Message: "must be between 1 and 65535",
		})
	}

	// Bind address validation
	if cfg.BindAddress != "" && cfg.BindAddress != "0.0.0.0" {
		if ip := net.ParseIP(cfg.BindAddress); ip == nil {
			errors = append(errors, ValidationError{
				Field:   "bindAddress",
				Message: "must be a valid IP address",
			})
		}
	}

	// Idle timeout validation
	if cfg.IdleTimeout < 0 {
		errors = append(errors, ValidationError{
			Field:   "idleTimeout",
			Message: "must be non-negative",
		})
	}

	// Allowlist validation
	for i, entry := range cfg.Allowlist {
		if !isValidIPOrCIDR(entry) {
			errors = append(errors, ValidationError{
				Field:   fmt.Sprintf("allowlist[%d]", i),
				Message: fmt.Sprintf("invalid IP or CIDR: %s", entry),
			})
		}
	}

	return errors
}

func isValidIPOrCIDR(s string) bool {
	// Try parsing as IP
	if ip := net.ParseIP(s); ip != nil {
		return true
	}
	// Try parsing as CIDR
	_, _, err := net.ParseCIDR(s)
	return err == nil
}

func BuildArgs(cfg models.ServerConfig) []string {
	args := []string{
		"-s",           // Server mode
		"-J",           // JSON output
		"-p", strconv.Itoa(cfg.Port),
	}

	if cfg.BindAddress != "" && cfg.BindAddress != "0.0.0.0" {
		args = append(args, "-B", cfg.BindAddress)
	}

	if cfg.OneOff {
		args = append(args, "-1") // One-off mode
	}

	if cfg.Protocol == models.ProtocolUDP {
		// Note: iperf3 server auto-detects UDP from client
		// No server-side flag needed
	}

	return args
}

func IsClientAllowed(clientIP string, allowlist []string) bool {
	if len(allowlist) == 0 {
		return true // Empty allowlist = allow all
	}

	ip := net.ParseIP(clientIP)
	if ip == nil {
		return false
	}

	for _, entry := range allowlist {
		// Check exact IP match
		if allowedIP := net.ParseIP(entry); allowedIP != nil {
			if ip.Equal(allowedIP) {
				return true
			}
			continue
		}

		// Check CIDR match
		_, network, err := net.ParseCIDR(entry)
		if err == nil && network.Contains(ip) {
			return true
		}
	}

	return false
}
```

**Step 2: Verify it compiles**

```bash
cd backend && go build ./...
```

**Step 3: Commit**

```bash
git add backend/internal/iperf/config.go
git commit -m "feat(iperf): add config validation and CLI argument builder"
```

---

### Task 4: Implement iperf3 JSON parser

**Files:**
- Create: `backend/internal/iperf/parser.go`

**Step 1: Create parser.go**

```go
// backend/internal/iperf/parser.go
package iperf

import (
	"encoding/json"
	"time"

	"github.com/Tom-Oram/fak/backend/internal/models"
)

// iperf3 JSON output structures
type Iperf3Output struct {
	Start     Iperf3Start      `json:"start"`
	Intervals []Iperf3Interval `json:"intervals"`
	End       Iperf3End        `json:"end"`
	Error     string           `json:"error,omitempty"`
}

type Iperf3Start struct {
	Connected []Iperf3Connected `json:"connected"`
	Timestamp Iperf3Timestamp   `json:"timestamp"`
	TestStart Iperf3TestStart   `json:"test_start"`
}

type Iperf3Connected struct {
	Socket     int    `json:"socket"`
	LocalHost  string `json:"local_host"`
	LocalPort  int    `json:"local_port"`
	RemoteHost string `json:"remote_host"`
	RemotePort int    `json:"remote_port"`
}

type Iperf3Timestamp struct {
	Time     string `json:"time"`
	Timesecs int64  `json:"timesecs"`
}

type Iperf3TestStart struct {
	Protocol   string `json:"protocol"`
	NumStreams int    `json:"num_streams"`
	BlkSize    int    `json:"blksize"`
	Duration   int    `json:"duration"`
	Reverse    int    `json:"reverse"`
}

type Iperf3Interval struct {
	Streams []Iperf3Stream `json:"streams"`
	Sum     Iperf3Sum      `json:"sum"`
}

type Iperf3Stream struct {
	Socket        int     `json:"socket"`
	Start         float64 `json:"start"`
	End           float64 `json:"end"`
	Seconds       float64 `json:"seconds"`
	Bytes         int64   `json:"bytes"`
	BitsPerSecond float64 `json:"bits_per_second"`
	Retransmits   int     `json:"retransmits,omitempty"`
	Omitted       bool    `json:"omitted"`
}

type Iperf3Sum struct {
	Start         float64 `json:"start"`
	End           float64 `json:"end"`
	Seconds       float64 `json:"seconds"`
	Bytes         int64   `json:"bytes"`
	BitsPerSecond float64 `json:"bits_per_second"`
	Retransmits   int     `json:"retransmits,omitempty"`
	Omitted       bool    `json:"omitted"`
}

type Iperf3End struct {
	Streams           []Iperf3EndStream `json:"streams"`
	SumSent           Iperf3SumStats    `json:"sum_sent"`
	SumReceived       Iperf3SumStats    `json:"sum_received"`
	CPUUtilization    Iperf3CPU         `json:"cpu_utilization_percent"`
}

type Iperf3EndStream struct {
	Sender   Iperf3SumStats `json:"sender"`
	Receiver Iperf3SumStats `json:"receiver"`
}

type Iperf3SumStats struct {
	Start         float64  `json:"start"`
	End           float64  `json:"end"`
	Seconds       float64  `json:"seconds"`
	Bytes         int64    `json:"bytes"`
	BitsPerSecond float64  `json:"bits_per_second"`
	Retransmits   int      `json:"retransmits,omitempty"`
	Jitter        float64  `json:"jitter_ms,omitempty"`
	LostPackets   int      `json:"lost_packets,omitempty"`
	Packets       int      `json:"packets,omitempty"`
	LostPercent   float64  `json:"lost_percent,omitempty"`
}

type Iperf3CPU struct {
	HostTotal    float64 `json:"host_total"`
	HostUser     float64 `json:"host_user"`
	HostSystem   float64 `json:"host_system"`
	RemoteTotal  float64 `json:"remote_total"`
	RemoteUser   float64 `json:"remote_user"`
	RemoteSystem float64 `json:"remote_system"`
}

// ParseOutput parses complete iperf3 JSON output
func ParseOutput(data []byte) (*Iperf3Output, error) {
	var output Iperf3Output
	if err := json.Unmarshal(data, &output); err != nil {
		return nil, err
	}
	return &output, nil
}

// ExtractBandwidthUpdate extracts a bandwidth update from an interval
func ExtractBandwidthUpdate(interval Iperf3Interval) models.BandwidthUpdate {
	return models.BandwidthUpdate{
		Timestamp:     time.Now().UnixMilli(),
		IntervalStart: interval.Sum.Start,
		IntervalEnd:   interval.Sum.End,
		Bytes:         interval.Sum.Bytes,
		BitsPerSecond: interval.Sum.BitsPerSecond,
	}
}

// ExtractTestResult extracts a test result from complete output
func ExtractTestResult(output *Iperf3Output) *models.TestResult {
	if output == nil || len(output.Start.Connected) == 0 {
		return nil
	}

	conn := output.Start.Connected[0]

	// Determine direction (reverse = download to server)
	direction := "upload"
	if output.Start.TestStart.Reverse == 1 {
		direction = "download"
	}

	// Use received stats for upload, sent for download
	var stats Iperf3SumStats
	if direction == "upload" {
		stats = output.End.SumReceived
	} else {
		stats = output.End.SumSent
	}

	result := &models.TestResult{
		Timestamp:        time.Now(),
		ClientIP:         conn.RemoteHost,
		ClientPort:       conn.RemotePort,
		Protocol:         models.Protocol(output.Start.TestStart.Protocol),
		Duration:         stats.Seconds,
		BytesTransferred: stats.Bytes,
		AvgBandwidth:     stats.BitsPerSecond,
		Direction:        direction,
	}

	// Calculate min/max from intervals
	if len(output.Intervals) > 0 {
		minBw := output.Intervals[0].Sum.BitsPerSecond
		maxBw := output.Intervals[0].Sum.BitsPerSecond
		for _, interval := range output.Intervals {
			if !interval.Sum.Omitted {
				if interval.Sum.BitsPerSecond < minBw {
					minBw = interval.Sum.BitsPerSecond
				}
				if interval.Sum.BitsPerSecond > maxBw {
					maxBw = interval.Sum.BitsPerSecond
				}
			}
		}
		result.MinBandwidth = minBw
		result.MaxBandwidth = maxBw
	} else {
		result.MinBandwidth = stats.BitsPerSecond
		result.MaxBandwidth = stats.BitsPerSecond
	}

	// TCP-specific: retransmits
	if stats.Retransmits > 0 {
		result.Retransmits = &stats.Retransmits
	}

	// UDP-specific: jitter and packet loss
	if stats.Jitter > 0 {
		result.Jitter = &stats.Jitter
	}
	if stats.LostPercent > 0 {
		result.PacketLoss = &stats.LostPercent
	}

	return result
}

// ExtractConnectionEvent creates a connection event from start info
func ExtractConnectionEvent(output *Iperf3Output) *models.ConnectionEvent {
	if output == nil || len(output.Start.Connected) == 0 {
		return nil
	}

	conn := output.Start.Connected[0]
	return &models.ConnectionEvent{
		Timestamp: time.Now(),
		ClientIP:  conn.RemoteHost,
		EventType: "connected",
		Details:   output.Start.TestStart.Protocol,
	}
}
```

**Step 2: Verify it compiles**

```bash
cd backend && go build ./...
```

**Step 3: Commit**

```bash
git add backend/internal/iperf/parser.go
git commit -m "feat(iperf): add JSON output parser for iperf3"
```

---

### Task 5: Implement iperf3 process manager

**Files:**
- Create: `backend/internal/iperf/manager.go`

**Step 1: Create manager.go**

```go
// backend/internal/iperf/manager.go
package iperf

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os/exec"
	"sync"
	"time"

	"github.com/Tom-Oram/fak/backend/internal/models"
)

type EventHandler func(models.WSMessage)

type Manager struct {
	mu           sync.RWMutex
	cmd          *exec.Cmd
	cancel       context.CancelFunc
	config       models.ServerConfig
	status       models.ServerStatus
	eventHandler EventHandler
	idleTimer    *time.Timer
}

func NewManager(handler EventHandler) *Manager {
	return &Manager{
		status:       models.StatusStopped,
		config:       models.DefaultServerConfig(),
		eventHandler: handler,
	}
}

func (m *Manager) GetStatus() models.ServerStatus {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.status
}

func (m *Manager) GetConfig() models.ServerConfig {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.config
}

func (m *Manager) Start(cfg models.ServerConfig) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.status == models.StatusRunning {
		return fmt.Errorf("server already running")
	}

	// Validate config
	if errs := ValidateConfig(cfg); len(errs) > 0 {
		return errs[0]
	}

	m.config = cfg

	// Create context for cancellation
	ctx, cancel := context.WithCancel(context.Background())
	m.cancel = cancel

	// Build command
	args := BuildArgs(cfg)
	m.cmd = exec.CommandContext(ctx, "iperf3", args...)

	// Get stdout pipe for JSON parsing
	stdout, err := m.cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to get stdout pipe: %w", err)
	}

	// Start the process
	if err := m.cmd.Start(); err != nil {
		return fmt.Errorf("failed to start iperf3: %w", err)
	}

	m.status = models.StatusRunning

	// Notify status change
	m.sendStatusUpdate()

	// Start output parser goroutine
	go m.parseOutput(stdout)

	// Start process monitor goroutine
	go m.monitorProcess()

	// Start idle timer if configured
	if cfg.IdleTimeout > 0 {
		m.resetIdleTimer()
	}

	return nil
}

func (m *Manager) Stop() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.status != models.StatusRunning {
		return fmt.Errorf("server not running")
	}

	if m.cancel != nil {
		m.cancel()
	}

	if m.idleTimer != nil {
		m.idleTimer.Stop()
	}

	m.status = models.StatusStopped
	m.sendStatusUpdate()

	return nil
}

func (m *Manager) parseOutput(stdout io.ReadCloser) {
	defer stdout.Close()

	var jsonBuffer []byte
	braceCount := 0
	scanner := bufio.NewScanner(stdout)

	// Increase buffer size for large JSON outputs
	buf := make([]byte, 64*1024)
	scanner.Buffer(buf, 1024*1024)

	for scanner.Scan() {
		line := scanner.Bytes()

		// Count braces to detect complete JSON objects
		for _, b := range line {
			if b == '{' {
				braceCount++
			} else if b == '}' {
				braceCount--
			}
		}

		jsonBuffer = append(jsonBuffer, line...)
		jsonBuffer = append(jsonBuffer, '\n')

		// When braces balance, we have a complete JSON object
		if braceCount == 0 && len(jsonBuffer) > 2 {
			m.processJSON(jsonBuffer)
			jsonBuffer = nil
		}
	}
}

func (m *Manager) processJSON(data []byte) {
	output, err := ParseOutput(data)
	if err != nil {
		m.sendError(fmt.Sprintf("JSON parse error: %v", err))
		return
	}

	// Handle error from iperf3
	if output.Error != "" {
		m.sendError(output.Error)
		return
	}

	// Check client allowlist
	if len(output.Start.Connected) > 0 {
		clientIP := output.Start.Connected[0].RemoteHost
		m.mu.RLock()
		allowed := IsClientAllowed(clientIP, m.config.Allowlist)
		m.mu.RUnlock()

		if !allowed {
			m.sendEvent(models.WSMessage{
				Type: models.WSError,
				Payload: map[string]string{
					"message": fmt.Sprintf("Client %s not in allowlist", clientIP),
				},
			})
			return
		}
	}

	// Send connection event
	if connEvent := ExtractConnectionEvent(output); connEvent != nil {
		m.sendEvent(models.WSMessage{
			Type:    models.WSClientConnected,
			Payload: connEvent,
		})
		m.resetIdleTimer()
	}

	// Send bandwidth updates for each interval
	for _, interval := range output.Intervals {
		if !interval.Sum.Omitted {
			update := ExtractBandwidthUpdate(interval)
			m.sendEvent(models.WSMessage{
				Type:    models.WSBandwidthUpdate,
				Payload: update,
			})
		}
	}

	// Send test complete if we have end data
	if output.End.SumSent.Bytes > 0 || output.End.SumReceived.Bytes > 0 {
		result := ExtractTestResult(output)
		if result != nil {
			m.sendEvent(models.WSMessage{
				Type:    models.WSTestComplete,
				Payload: result,
			})
		}
	}
}

func (m *Manager) monitorProcess() {
	if m.cmd == nil {
		return
	}

	err := m.cmd.Wait()

	m.mu.Lock()
	defer m.mu.Unlock()

	if m.status == models.StatusRunning {
		if err != nil && err.Error() != "signal: killed" {
			m.status = models.StatusError
			m.sendEvent(models.WSMessage{
				Type: models.WSError,
				Payload: map[string]string{
					"message": fmt.Sprintf("iperf3 exited: %v", err),
				},
			})
		} else {
			m.status = models.StatusStopped
		}
		m.sendStatusUpdate()
	}
}

func (m *Manager) resetIdleTimer() {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.config.IdleTimeout <= 0 {
		return
	}

	if m.idleTimer != nil {
		m.idleTimer.Stop()
	}

	m.idleTimer = time.AfterFunc(time.Duration(m.config.IdleTimeout)*time.Second, func() {
		m.Stop()
	})
}

func (m *Manager) sendStatusUpdate() {
	m.sendEvent(models.WSMessage{
		Type: models.WSServerStatus,
		Payload: models.ServerStatusPayload{
			Status:     m.status,
			Config:     m.config,
			ListenAddr: fmt.Sprintf("%s:%d", m.config.BindAddress, m.config.Port),
		},
	})
}

func (m *Manager) sendError(msg string) {
	m.sendEvent(models.WSMessage{
		Type: models.WSError,
		Payload: map[string]string{
			"message": msg,
		},
	})
}

func (m *Manager) sendEvent(msg models.WSMessage) {
	if m.eventHandler != nil {
		m.eventHandler(msg)
	}
}
```

**Step 2: Verify it compiles**

```bash
cd backend && go build ./...
```

**Step 3: Commit**

```bash
git add backend/internal/iperf/manager.go
git commit -m "feat(iperf): add process manager for iperf3 server"
```

---

### Task 6: Implement WebSocket hub

**Files:**
- Create: `backend/internal/api/websocket.go`

**Step 1: Create websocket.go**

```go
// backend/internal/api/websocket.go
package api

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/Tom-Oram/fak/backend/internal/models"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
}

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Printf("Client connected, total: %d", len(h.clients))

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()
			log.Printf("Client disconnected, total: %d", len(h.clients))

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) Broadcast(msg models.WSMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}
	h.broadcast <- data
}

func (h *Hub) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	client := &Client{
		hub:  h,
		conn: conn,
		send: make(chan []byte, 256),
	}

	h.register <- client

	go client.writePump()
	go client.readPump()
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket read error: %v", err)
			}
			break
		}

		// Handle incoming commands (start/stop server)
		var cmd struct {
			Action string              `json:"action"`
			Config models.ServerConfig `json:"config,omitempty"`
		}
		if err := json.Unmarshal(message, &cmd); err != nil {
			log.Printf("Invalid command: %v", err)
			continue
		}

		// Commands are handled by the server, not the hub
		// This is just for receiving messages
		log.Printf("Received command: %s", cmd.Action)
	}
}

func (c *Client) writePump() {
	defer c.conn.Close()

	for message := range c.send {
		if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
			log.Printf("WebSocket write error: %v", err)
			return
		}
	}
}
```

**Step 2: Verify it compiles**

```bash
cd backend && go build ./...
```

**Step 3: Commit**

```bash
git add backend/internal/api/websocket.go
git commit -m "feat(iperf): add WebSocket hub for real-time updates"
```

---

### Task 7: Implement REST API handlers

**Files:**
- Create: `backend/internal/api/handlers.go`

**Step 1: Create handlers.go**

```go
// backend/internal/api/handlers.go
package api

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/Tom-Oram/fak/backend/internal/iperf"
	"github.com/Tom-Oram/fak/backend/internal/models"
	"github.com/Tom-Oram/fak/backend/internal/storage"
	"github.com/go-chi/chi/v5"
)

type Server struct {
	hub     *Hub
	manager *iperf.Manager
	storage *storage.SQLiteStorage
}

func NewServer(storage *storage.SQLiteStorage) *Server {
	hub := NewHub()
	go hub.Run()

	manager := iperf.NewManager(func(msg models.WSMessage) {
		hub.Broadcast(msg)

		// Save test results to storage
		if msg.Type == models.WSTestComplete {
			if result, ok := msg.Payload.(*models.TestResult); ok {
				storage.SaveTestResult(result)
			}
		}
	})

	return &Server{
		hub:     hub,
		manager: manager,
		storage: storage,
	}
}

func (s *Server) Routes() chi.Router {
	r := chi.NewRouter()

	// Health check
	r.Get("/health", s.handleHealth)

	// Server control
	r.Get("/api/status", s.handleGetStatus)
	r.Post("/api/start", s.handleStart)
	r.Post("/api/stop", s.handleStop)

	// History
	r.Get("/api/history", s.handleGetHistory)
	r.Get("/api/history/export", s.handleExportHistory)

	// WebSocket
	r.Get("/ws", s.hub.HandleWebSocket)

	return r
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Write([]byte("OK"))
}

func (s *Server) handleGetStatus(w http.ResponseWriter, r *http.Request) {
	status := s.manager.GetStatus()
	config := s.manager.GetConfig()

	response := models.ServerStatusPayload{
		Status:     status,
		Config:     config,
		ListenAddr: fmt.Sprintf("%s:%d", config.BindAddress, config.Port),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *Server) handleStart(w http.ResponseWriter, r *http.Request) {
	var config models.ServerConfig
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		http.Error(w, fmt.Sprintf("Invalid config: %v", err), http.StatusBadRequest)
		return
	}

	if err := s.manager.Start(config); err != nil {
		http.Error(w, fmt.Sprintf("Failed to start: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "started"})
}

func (s *Server) handleStop(w http.ResponseWriter, r *http.Request) {
	if err := s.manager.Stop(); err != nil {
		http.Error(w, fmt.Sprintf("Failed to stop: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "stopped"})
}

func (s *Server) handleGetHistory(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = 25
	}
	if limit > 100 {
		limit = 100
	}

	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if offset < 0 {
		offset = 0
	}

	clientIP := r.URL.Query().Get("clientIp")

	var results []models.TestResult
	var err error

	if clientIP != "" {
		results, err = s.storage.GetTestResultsByClientIP(clientIP, limit, offset)
	} else {
		results, err = s.storage.GetTestResults(limit, offset)
	}

	if err != nil {
		http.Error(w, fmt.Sprintf("Database error: %v", err), http.StatusInternalServerError)
		return
	}

	total, _ := s.storage.GetTotalCount()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"results": results,
		"total":   total,
		"limit":   limit,
		"offset":  offset,
	})
}

func (s *Server) handleExportHistory(w http.ResponseWriter, r *http.Request) {
	format := r.URL.Query().Get("format")
	if format == "" {
		format = "csv"
	}

	results, err := s.storage.GetTestResults(10000, 0)
	if err != nil {
		http.Error(w, fmt.Sprintf("Database error: %v", err), http.StatusInternalServerError)
		return
	}

	switch format {
	case "json":
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Disposition", "attachment; filename=iperf_history.json")
		json.NewEncoder(w).Encode(results)

	case "csv":
		w.Header().Set("Content-Type", "text/csv")
		w.Header().Set("Content-Disposition", "attachment; filename=iperf_history.csv")

		writer := csv.NewWriter(w)
		defer writer.Flush()

		// Header row
		writer.Write([]string{
			"ID", "Timestamp", "Client IP", "Client Port", "Protocol",
			"Duration", "Bytes", "Avg Bandwidth", "Max Bandwidth", "Min Bandwidth",
			"Retransmits", "Jitter", "Packet Loss", "Direction",
		})

		// Data rows
		for _, r := range results {
			retransmits := ""
			if r.Retransmits != nil {
				retransmits = strconv.Itoa(*r.Retransmits)
			}
			jitter := ""
			if r.Jitter != nil {
				jitter = fmt.Sprintf("%.2f", *r.Jitter)
			}
			packetLoss := ""
			if r.PacketLoss != nil {
				packetLoss = fmt.Sprintf("%.2f", *r.PacketLoss)
			}

			writer.Write([]string{
				r.ID,
				r.Timestamp.Format("2006-01-02 15:04:05"),
				r.ClientIP,
				strconv.Itoa(r.ClientPort),
				string(r.Protocol),
				fmt.Sprintf("%.2f", r.Duration),
				strconv.FormatInt(r.BytesTransferred, 10),
				fmt.Sprintf("%.0f", r.AvgBandwidth),
				fmt.Sprintf("%.0f", r.MaxBandwidth),
				fmt.Sprintf("%.0f", r.MinBandwidth),
				retransmits,
				jitter,
				packetLoss,
				r.Direction,
			})
		}

	default:
		http.Error(w, "Invalid format, use 'json' or 'csv'", http.StatusBadRequest)
	}
}
```

**Step 2: Verify it compiles**

```bash
cd backend && go build ./...
```

**Step 3: Commit**

```bash
git add backend/internal/api/handlers.go
git commit -m "feat(iperf): add REST API handlers for server control and history"
```

---

### Task 8: Wire up main.go with all components

**Files:**
- Modify: `backend/cmd/server/main.go`

**Step 1: Update main.go**

```go
// backend/cmd/server/main.go
package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/Tom-Oram/fak/backend/internal/api"
	"github.com/Tom-Oram/fak/backend/internal/storage"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func main() {
	log.Println("iPerf Server backend starting...")

	// Determine data directory
	dataDir := os.Getenv("DATA_DIR")
	if dataDir == "" {
		dataDir = "./data"
	}

	// Ensure data directory exists
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		log.Fatalf("Failed to create data directory: %v", err)
	}

	// Initialize SQLite storage
	dbPath := filepath.Join(dataDir, "iperf.db")
	store, err := storage.NewSQLiteStorage(dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize storage: %v", err)
	}
	defer store.Close()

	log.Printf("Database initialized at %s", dbPath)

	// Create API server
	server := api.NewServer(store)

	// Setup router with middleware
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(corsMiddleware)

	// Mount API routes
	r.Mount("/", server.Routes())

	// Get port from environment
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Listening on :%s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatal(err)
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
```

**Step 2: Verify it compiles and runs**

```bash
cd backend && go build ./cmd/server && ./server &
sleep 2 && curl http://localhost:8080/health && pkill server
```

**Step 3: Commit**

```bash
git add backend/cmd/server/main.go
git commit -m "feat(iperf): wire up main.go with all backend components"
```

---

## Phase 2: Docker Setup

### Task 9: Create backend Dockerfile

**Files:**
- Create: `backend/Dockerfile`

**Step 1: Create Dockerfile**

```dockerfile
# backend/Dockerfile
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache gcc musl-dev

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the binary
RUN CGO_ENABLED=1 go build -o server ./cmd/server

# Runtime stage
FROM alpine:3.19

# Install iperf3
RUN apk add --no-cache iperf3

# Create non-root user
RUN adduser -D -u 1000 appuser

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/server .

# Create data directory
RUN mkdir -p /app/data && chown -R appuser:appuser /app

USER appuser

ENV DATA_DIR=/app/data
ENV PORT=8080

EXPOSE 8080
EXPOSE 5201-5210

CMD ["./server"]
```

**Step 2: Commit**

```bash
git add backend/Dockerfile
git commit -m "feat(iperf): add backend Dockerfile with iperf3"
```

---

### Task 10: Create frontend nginx config and Dockerfile

**Files:**
- Create: `frontend/nginx.conf`
- Create: `frontend/Dockerfile`

**Step 1: Create nginx.conf**

```nginx
# frontend/nginx.conf
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Serve static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://backend:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Proxy WebSocket to backend
    location /ws {
        proxy_pass http://backend:8080/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }

    # Health check
    location /health {
        proxy_pass http://backend:8080/health;
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 1000;
}
```

**Step 2: Create frontend Dockerfile**

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build
RUN npm run build

# Runtime stage
FROM nginx:alpine

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

**Step 3: Commit**

```bash
git add frontend/nginx.conf frontend/Dockerfile
git commit -m "feat(iperf): add frontend Dockerfile and nginx config"
```

---

### Task 11: Create Docker Compose files

**Files:**
- Create: `docker-compose.yml`
- Create: `docker-compose.dev.yml`

**Step 1: Create docker-compose.yml**

```yaml
# docker-compose.yml
version: '3.8'

services:
  frontend:
    build: .
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped

  backend:
    build: ./backend
    ports:
      - "8080:8080"
      - "5201:5201"
      - "5202:5202"
      - "5203:5203"
      - "5204:5204"
      - "5205:5205"
    volumes:
      - iperf-data:/app/data
    environment:
      - DATA_DIR=/app/data
      - PORT=8080
      - IPERF_PORT_MIN=5201
      - IPERF_PORT_MAX=5205
    restart: unless-stopped

volumes:
  iperf-data:
```

**Step 2: Create docker-compose.dev.yml**

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "5173:5173"
    volumes:
      - ./src:/app/src
      - ./public:/app/public
    environment:
      - VITE_API_URL=http://localhost:8080
    depends_on:
      - backend

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    ports:
      - "8080:8080"
      - "5201:5201"
    volumes:
      - ./backend:/app
      - iperf-data:/app/data
    environment:
      - DATA_DIR=/app/data
      - PORT=8080

volumes:
  iperf-data:
```

**Step 3: Create Dockerfile.dev for frontend (optional)**

```dockerfile
# Dockerfile.dev (in root, for frontend dev)
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

**Step 4: Commit**

```bash
git add docker-compose.yml docker-compose.dev.yml Dockerfile.dev
git commit -m "feat(iperf): add Docker Compose configuration"
```

---

## Phase 3: React Frontend

### Task 12: Create frontend types and WebSocket hook

**Files:**
- Create: `src/components/tools/IperfServer/types.ts`
- Create: `src/components/tools/IperfServer/hooks/useIperfWebSocket.ts`

**Step 1: Create types.ts**

```typescript
// src/components/tools/IperfServer/types.ts

export type ServerStatus = 'stopped' | 'running' | 'error'
export type Protocol = 'tcp' | 'udp'

export interface ServerConfig {
  port: number
  bindAddress: string
  protocol: Protocol
  oneOff: boolean
  idleTimeout: number
  allowlist: string[]
}

export const DEFAULT_CONFIG: ServerConfig = {
  port: 5201,
  bindAddress: '0.0.0.0',
  protocol: 'tcp',
  oneOff: false,
  idleTimeout: 300,
  allowlist: [],
}

export interface TestResult {
  id: string
  timestamp: string
  clientIp: string
  clientPort: number
  protocol: Protocol
  duration: number
  bytesTransferred: number
  avgBandwidth: number
  maxBandwidth: number
  minBandwidth: number
  retransmits?: number
  jitter?: number
  packetLoss?: number
  direction: 'upload' | 'download'
}

export interface BandwidthUpdate {
  timestamp: number
  intervalStart: number
  intervalEnd: number
  bytes: number
  bitsPerSecond: number
}

export interface ConnectionEvent {
  timestamp: string
  clientIp: string
  eventType: 'connected' | 'test_started' | 'test_complete' | 'error'
  details: string
}

export type WSMessageType =
  | 'server_status'
  | 'client_connected'
  | 'bandwidth_update'
  | 'test_complete'
  | 'error'

export interface WSMessage<T = unknown> {
  type: WSMessageType
  payload: T
}

export interface ServerStatusPayload {
  status: ServerStatus
  config: ServerConfig
  listenAddr?: string
  errorMsg?: string
}

export interface HistoryResponse {
  results: TestResult[]
  total: number
  limit: number
  offset: number
}
```

**Step 2: Create useIperfWebSocket.ts**

```typescript
// src/components/tools/IperfServer/hooks/useIperfWebSocket.ts
import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  ServerStatus,
  ServerConfig,
  BandwidthUpdate,
  ConnectionEvent,
  TestResult,
  WSMessage,
  ServerStatusPayload,
  DEFAULT_CONFIG,
} from '../types'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws'
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

interface UseIperfWebSocketReturn {
  status: ServerStatus
  config: ServerConfig
  listenAddr: string
  bandwidthData: BandwidthUpdate[]
  connectionLog: ConnectionEvent[]
  lastError: string | null
  isConnected: boolean
  startServer: (config: ServerConfig) => Promise<void>
  stopServer: () => Promise<void>
  clearBandwidthData: () => void
}

export function useIperfWebSocket(): UseIperfWebSocketReturn {
  const [status, setStatus] = useState<ServerStatus>('stopped')
  const [config, setConfig] = useState<ServerConfig>({
    port: 5201,
    bindAddress: '0.0.0.0',
    protocol: 'tcp',
    oneOff: false,
    idleTimeout: 300,
    allowlist: [],
  })
  const [listenAddr, setListenAddr] = useState('')
  const [bandwidthData, setBandwidthData] = useState<BandwidthUpdate[]>([])
  const [connectionLog, setConnectionLog] = useState<ConnectionEvent[]>([])
  const [lastError, setLastError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number>()

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(WS_URL)

    ws.onopen = () => {
      setIsConnected(true)
      setLastError(null)
    }

    ws.onclose = () => {
      setIsConnected(false)
      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = window.setTimeout(connect, 3000)
    }

    ws.onerror = () => {
      setLastError('WebSocket connection error')
    }

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data)
        handleMessage(message)
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e)
      }
    }

    wsRef.current = ws
  }, [])

  const handleMessage = useCallback((message: WSMessage) => {
    switch (message.type) {
      case 'server_status': {
        const payload = message.payload as ServerStatusPayload
        setStatus(payload.status)
        setConfig(payload.config)
        if (payload.listenAddr) {
          setListenAddr(payload.listenAddr)
        }
        if (payload.errorMsg) {
          setLastError(payload.errorMsg)
        }
        break
      }

      case 'client_connected': {
        const event = message.payload as ConnectionEvent
        setConnectionLog((prev) => [
          ...prev.slice(-499), // Keep last 500
          { ...event, eventType: 'connected' },
        ])
        break
      }

      case 'bandwidth_update': {
        const update = message.payload as BandwidthUpdate
        setBandwidthData((prev) => {
          const newData = [...prev, update]
          // Keep last 60 seconds of data (assuming 1 update per second)
          return newData.slice(-60)
        })
        break
      }

      case 'test_complete': {
        const result = message.payload as TestResult
        setConnectionLog((prev) => [
          ...prev.slice(-499),
          {
            timestamp: result.timestamp,
            clientIp: result.clientIp,
            eventType: 'test_complete',
            details: `${formatBandwidth(result.avgBandwidth)} avg`,
          },
        ])
        break
      }

      case 'error': {
        const payload = message.payload as { message: string }
        setLastError(payload.message)
        setConnectionLog((prev) => [
          ...prev.slice(-499),
          {
            timestamp: new Date().toISOString(),
            clientIp: '',
            eventType: 'error',
            details: payload.message,
          },
        ])
        break
      }
    }
  }, [])

  useEffect(() => {
    connect()

    // Fetch initial status
    fetch(`${API_URL}/api/status`)
      .then((res) => res.json())
      .then((data: ServerStatusPayload) => {
        setStatus(data.status)
        setConfig(data.config)
        if (data.listenAddr) setListenAddr(data.listenAddr)
      })
      .catch((e) => setLastError(`Failed to fetch status: ${e.message}`))

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      wsRef.current?.close()
    }
  }, [connect])

  const startServer = useCallback(async (newConfig: ServerConfig) => {
    const response = await fetch(`${API_URL}/api/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(text)
    }
  }, [])

  const stopServer = useCallback(async () => {
    const response = await fetch(`${API_URL}/api/stop`, {
      method: 'POST',
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(text)
    }
  }, [])

  const clearBandwidthData = useCallback(() => {
    setBandwidthData([])
  }, [])

  return {
    status,
    config,
    listenAddr,
    bandwidthData,
    connectionLog,
    lastError,
    isConnected,
    startServer,
    stopServer,
    clearBandwidthData,
  }
}

function formatBandwidth(bps: number): string {
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(2)} Gbps`
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(2)} Mbps`
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(2)} Kbps`
  return `${bps.toFixed(0)} bps`
}
```

**Step 3: Create hooks directory and index**

```bash
mkdir -p src/components/tools/IperfServer/hooks
```

**Step 4: Commit**

```bash
git add src/components/tools/IperfServer/
git commit -m "feat(iperf): add frontend types and WebSocket hook"
```

---

### Task 13: Create ServerControls and ConfigPanel components

**Files:**
- Create: `src/components/tools/IperfServer/components/ServerControls.tsx`
- Create: `src/components/tools/IperfServer/components/ConfigPanel.tsx`

**Step 1: Create ServerControls.tsx**

```tsx
// src/components/tools/IperfServer/components/ServerControls.tsx
import { Play, Square, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import type { ServerStatus } from '../types'

interface ServerControlsProps {
  status: ServerStatus
  listenAddr: string
  isConnected: boolean
  onStart: () => void
  onStop: () => void
}

export default function ServerControls({
  status,
  listenAddr,
  isConnected,
  onStart,
  onStop,
}: ServerControlsProps) {
  const [copied, setCopied] = useState(false)

  const clientCommand = listenAddr
    ? `iperf3 -c ${listenAddr.split(':')[0]} -p ${listenAddr.split(':')[1]}`
    : ''

  const copyCommand = () => {
    navigator.clipboard.writeText(clientCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="card">
      <div className="card-body space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-900">Server Control</h3>
            <StatusBadge status={status} isConnected={isConnected} />
          </div>

          {status === 'running' ? (
            <button onClick={onStop} className="btn-danger flex items-center gap-2">
              <Square className="w-4 h-4" />
              Stop Server
            </button>
          ) : (
            <button
              onClick={onStart}
              disabled={!isConnected}
              className="btn-primary flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Start Server
            </button>
          )}
        </div>

        {status === 'running' && listenAddr && (
          <div className="p-4 bg-slate-50 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Listening on:</span>
              <span className="font-mono text-primary-600">{listenAddr}</span>
            </div>

            <div className="pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Client command:</span>
                <button
                  onClick={copyCommand}
                  className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <code className="block mt-1 p-2 bg-slate-800 text-green-400 rounded text-sm font-mono">
                {clientCommand}
              </code>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({
  status,
  isConnected,
}: {
  status: ServerStatus
  isConnected: boolean
}) {
  if (!isConnected) {
    return (
      <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
        Connecting...
      </span>
    )
  }

  switch (status) {
    case 'running':
      return (
        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full flex items-center gap-1">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Running
        </span>
      )
    case 'error':
      return (
        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
          Error
        </span>
      )
    default:
      return (
        <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-full">
          Stopped
        </span>
      )
  }
}
```

**Step 2: Create ConfigPanel.tsx**

```tsx
// src/components/tools/IperfServer/components/ConfigPanel.tsx
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { ServerConfig, Protocol } from '../types'

interface ConfigPanelProps {
  config: ServerConfig
  onChange: (config: ServerConfig) => void
  disabled: boolean
}

export default function ConfigPanel({ config, onChange, disabled }: ConfigPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const updateConfig = (updates: Partial<ServerConfig>) => {
    onChange({ ...config, ...updates })
  }

  return (
    <div className="card">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <h3 className="text-lg font-semibold text-slate-900">Configuration</h3>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-slate-500" />
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-500" />
        )}
      </button>

      {isExpanded && (
        <div className="card-body border-t border-slate-100 space-y-4">
          {/* Port and Bind Address */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Port
              </label>
              <input
                type="number"
                value={config.port}
                onChange={(e) => updateConfig({ port: parseInt(e.target.value) || 5201 })}
                disabled={disabled}
                min={1}
                max={65535}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Bind Address
              </label>
              <input
                type="text"
                value={config.bindAddress}
                onChange={(e) => updateConfig({ bindAddress: e.target.value })}
                disabled={disabled}
                placeholder="0.0.0.0"
                className="input w-full"
              />
            </div>
          </div>

          {/* Protocol */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Protocol
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="protocol"
                  value="tcp"
                  checked={config.protocol === 'tcp'}
                  onChange={() => updateConfig({ protocol: 'tcp' as Protocol })}
                  disabled={disabled}
                  className="text-primary-600"
                />
                <span className="text-sm text-slate-700">TCP</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="protocol"
                  value="udp"
                  checked={config.protocol === 'udp'}
                  onChange={() => updateConfig({ protocol: 'udp' as Protocol })}
                  disabled={disabled}
                  className="text-primary-600"
                />
                <span className="text-sm text-slate-700">UDP</span>
              </label>
            </div>
          </div>

          {/* One-off and Idle Timeout */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.oneOff}
                  onChange={(e) => updateConfig({ oneOff: e.target.checked })}
                  disabled={disabled}
                  className="text-primary-600 rounded"
                />
                <span className="text-sm text-slate-700">One-off mode</span>
              </label>
              <p className="text-xs text-slate-500 mt-1 ml-6">
                Stop after single client test
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Idle Timeout (seconds)
              </label>
              <input
                type="number"
                value={config.idleTimeout}
                onChange={(e) =>
                  updateConfig({ idleTimeout: parseInt(e.target.value) || 0 })
                }
                disabled={disabled}
                min={0}
                className="input w-full"
              />
              <p className="text-xs text-slate-500 mt-1">0 = no timeout</p>
            </div>
          </div>

          {/* Allowlist */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Allowed Clients (IP/CIDR)
            </label>
            <textarea
              value={config.allowlist.join('\n')}
              onChange={(e) =>
                updateConfig({
                  allowlist: e.target.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              disabled={disabled}
              placeholder="Leave empty to allow all clients&#10;192.168.1.0/24&#10;10.0.0.5"
              rows={3}
              className="input w-full font-mono text-sm"
            />
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/components/tools/IperfServer/components/
git commit -m "feat(iperf): add ServerControls and ConfigPanel components"
```

---

### Task 14: Create LiveGraph and ConnectionLog components

**Files:**
- Create: `src/components/tools/IperfServer/components/LiveGraph.tsx`
- Create: `src/components/tools/IperfServer/components/ConnectionLog.tsx`

**Step 1: Create LiveGraph.tsx**

```tsx
// src/components/tools/IperfServer/components/LiveGraph.tsx
import { Trash2 } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { BandwidthUpdate } from '../types'

interface LiveGraphProps {
  data: BandwidthUpdate[]
  onClear: () => void
}

export default function LiveGraph({ data, onClear }: LiveGraphProps) {
  const chartData = data.map((d, i) => ({
    time: i,
    bandwidth: d.bitsPerSecond,
    label: formatBandwidth(d.bitsPerSecond),
  }))

  // Calculate Y-axis domain
  const maxBandwidth = Math.max(...data.map((d) => d.bitsPerSecond), 1e6)
  const yMax = roundUpNice(maxBandwidth)

  return (
    <div className="card">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Live Bandwidth</h3>
        <button
          onClick={onClear}
          className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
        >
          <Trash2 className="w-4 h-4" />
          Clear
        </button>
      </div>

      <div className="p-4">
        {data.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-500">
            Waiting for data...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={256}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickLine={{ stroke: '#94a3b8' }}
                axisLine={{ stroke: '#94a3b8' }}
                label={{
                  value: 'Time (s)',
                  position: 'insideBottom',
                  offset: -5,
                  fontSize: 12,
                  fill: '#64748b',
                }}
              />
              <YAxis
                domain={[0, yMax]}
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickLine={{ stroke: '#94a3b8' }}
                axisLine={{ stroke: '#94a3b8' }}
                tickFormatter={(v) => formatBandwidthShort(v)}
                label={{
                  value: 'Bandwidth',
                  angle: -90,
                  position: 'insideLeft',
                  fontSize: 12,
                  fill: '#64748b',
                }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-white border border-slate-200 rounded shadow-lg p-2">
                        <p className="text-sm font-medium text-slate-900">
                          {formatBandwidth(payload[0].value as number)}
                        </p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Line
                type="monotone"
                dataKey="bandwidth"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

function formatBandwidth(bps: number): string {
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(2)} Gbps`
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(2)} Mbps`
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(2)} Kbps`
  return `${bps.toFixed(0)} bps`
}

function formatBandwidthShort(bps: number): string {
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(0)}G`
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(0)}M`
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(0)}K`
  return `${bps.toFixed(0)}`
}

function roundUpNice(n: number): number {
  const order = Math.pow(10, Math.floor(Math.log10(n)))
  const normalized = n / order
  if (normalized <= 1) return order
  if (normalized <= 2) return 2 * order
  if (normalized <= 5) return 5 * order
  return 10 * order
}
```

**Step 2: Create ConnectionLog.tsx**

```tsx
// src/components/tools/IperfServer/components/ConnectionLog.tsx
import { useEffect, useRef } from 'react'
import { Wifi, CheckCircle, XCircle, Info } from 'lucide-react'
import type { ConnectionEvent } from '../types'

interface ConnectionLogProps {
  events: ConnectionEvent[]
}

export default function ConnectionLog({ events }: ConnectionLogProps) {
  const logRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [events])

  return (
    <div className="card">
      <div className="p-4 border-b border-slate-100">
        <h3 className="text-lg font-semibold text-slate-900">Connection Log</h3>
      </div>

      <div ref={logRef} className="p-4 h-64 overflow-y-auto space-y-2">
        {events.length === 0 ? (
          <div className="text-center text-slate-500 py-8">
            No connections yet
          </div>
        ) : (
          events.map((event, i) => (
            <LogEntry key={i} event={event} />
          ))
        )}
      </div>
    </div>
  )
}

function LogEntry({ event }: { event: ConnectionEvent }) {
  const Icon = getEventIcon(event.eventType)
  const colorClass = getEventColor(event.eventType)

  const timestamp = new Date(event.timestamp).toLocaleTimeString()

  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${colorClass}`} />
      <span className="text-slate-500 flex-shrink-0">{timestamp}</span>
      {event.clientIp && (
        <span className="font-mono text-slate-700">{event.clientIp}</span>
      )}
      <span className="text-slate-600">{event.details}</span>
    </div>
  )
}

function getEventIcon(type: ConnectionEvent['eventType']) {
  switch (type) {
    case 'connected':
      return Wifi
    case 'test_complete':
      return CheckCircle
    case 'error':
      return XCircle
    default:
      return Info
  }
}

function getEventColor(type: ConnectionEvent['eventType']): string {
  switch (type) {
    case 'connected':
      return 'text-blue-500'
    case 'test_complete':
      return 'text-green-500'
    case 'error':
      return 'text-red-500'
    default:
      return 'text-slate-500'
  }
}
```

**Step 3: Commit**

```bash
git add src/components/tools/IperfServer/components/
git commit -m "feat(iperf): add LiveGraph and ConnectionLog components"
```

---

### Task 15: Create TestHistory component

**Files:**
- Create: `src/components/tools/IperfServer/components/TestHistory.tsx`

**Step 1: Create TestHistory.tsx**

```tsx
// src/components/tools/IperfServer/components/TestHistory.tsx
import { useState, useEffect } from 'react'
import { Download, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import type { TestResult, HistoryResponse } from '../types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export default function TestHistory() {
  const [results, setResults] = useState<TestResult[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [clientFilter, setClientFilter] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: (page * pageSize).toString(),
      })
      if (clientFilter) {
        params.set('clientIp', clientFilter)
      }

      const response = await fetch(`${API_URL}/api/history?${params}`)
      const data: HistoryResponse = await response.json()
      setResults(data.results || [])
      setTotal(data.total)
    } catch (e) {
      console.error('Failed to fetch history:', e)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchHistory()
  }, [page, pageSize, clientFilter])

  const exportCSV = () => {
    window.open(`${API_URL}/api/history/export?format=csv`, '_blank')
  }

  const exportJSON = () => {
    window.open(`${API_URL}/api/history/export?format=json`, '_blank')
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="card">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Test History</h3>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="btn-secondary text-sm flex items-center gap-1">
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button onClick={exportJSON} className="btn-secondary text-sm flex items-center gap-1">
            <Download className="w-4 h-4" />
            JSON
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-slate-100 flex items-center gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={clientFilter}
            onChange={(e) => {
              setClientFilter(e.target.value)
              setPage(0)
            }}
            placeholder="Filter by client IP..."
            className="input pl-9 w-full"
          />
        </div>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(parseInt(e.target.value))
            setPage(0)
          }}
          className="input"
        >
          <option value={25}>25 per page</option>
          <option value={50}>50 per page</option>
          <option value={100}>100 per page</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-700">Time</th>
              <th className="px-4 py-3 text-left font-medium text-slate-700">Client</th>
              <th className="px-4 py-3 text-left font-medium text-slate-700">Protocol</th>
              <th className="px-4 py-3 text-left font-medium text-slate-700">Duration</th>
              <th className="px-4 py-3 text-left font-medium text-slate-700">Avg</th>
              <th className="px-4 py-3 text-left font-medium text-slate-700">Peak</th>
              <th className="px-4 py-3 text-left font-medium text-slate-700">Direction</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : results.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No test results yet
                </td>
              </tr>
            ) : (
              results.map((result) => (
                <tr key={result.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(result.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700">{result.clientIp}</td>
                  <td className="px-4 py-3 uppercase text-slate-600">{result.protocol}</td>
                  <td className="px-4 py-3 text-slate-600">{result.duration.toFixed(1)}s</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {formatBandwidth(result.avgBandwidth)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatBandwidth(result.maxBandwidth)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        result.direction === 'upload'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {result.direction}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 flex items-center justify-between">
          <span className="text-sm text-slate-600">
            Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="btn-secondary p-2 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-slate-600">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="btn-secondary p-2 disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function formatBandwidth(bps: number): string {
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(2)} Gbps`
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(2)} Mbps`
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(2)} Kbps`
  return `${bps.toFixed(0)} bps`
}
```

**Step 2: Commit**

```bash
git add src/components/tools/IperfServer/components/TestHistory.tsx
git commit -m "feat(iperf): add TestHistory component with filtering and export"
```

---

### Task 16: Create main IperfServer component and integrate into app

**Files:**
- Create: `src/components/tools/IperfServer/index.tsx`
- Create: `src/components/tools/IperfServer/components/index.ts`
- Modify: `src/components/tools/index.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Dashboard.tsx`

**Step 1: Create components/index.ts**

```typescript
// src/components/tools/IperfServer/components/index.ts
export { default as ServerControls } from './ServerControls'
export { default as ConfigPanel } from './ConfigPanel'
export { default as LiveGraph } from './LiveGraph'
export { default as ConnectionLog } from './ConnectionLog'
export { default as TestHistory } from './TestHistory'
```

**Step 2: Create main index.tsx**

```tsx
// src/components/tools/IperfServer/index.tsx
import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { useIperfWebSocket } from './hooks/useIperfWebSocket'
import {
  ServerControls,
  ConfigPanel,
  LiveGraph,
  ConnectionLog,
  TestHistory,
} from './components'
import type { ServerConfig } from './types'
import { DEFAULT_CONFIG } from './types'

export default function IperfServer() {
  const {
    status,
    config: serverConfig,
    listenAddr,
    bandwidthData,
    connectionLog,
    lastError,
    isConnected,
    startServer,
    stopServer,
    clearBandwidthData,
  } = useIperfWebSocket()

  const [localConfig, setLocalConfig] = useState<ServerConfig>(DEFAULT_CONFIG)
  const [startError, setStartError] = useState<string | null>(null)

  const handleStart = async () => {
    setStartError(null)
    try {
      await startServer(localConfig)
    } catch (e) {
      setStartError((e as Error).message)
    }
  }

  const handleStop = async () => {
    try {
      await stopServer()
    } catch (e) {
      setStartError((e as Error).message)
    }
  }

  const displayError = startError || lastError

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">iPerf Server</h1>
        <p className="mt-1 text-slate-600">
          Run an iperf3 server for bandwidth testing with real-time monitoring
        </p>
      </div>

      {/* Error Banner */}
      {displayError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Error</p>
            <p className="text-sm text-red-700">{displayError}</p>
          </div>
        </div>
      )}

      {/* Server Controls */}
      <ServerControls
        status={status}
        listenAddr={listenAddr}
        isConnected={isConnected}
        onStart={handleStart}
        onStop={handleStop}
      />

      {/* Config Panel */}
      <ConfigPanel
        config={status === 'running' ? serverConfig : localConfig}
        onChange={setLocalConfig}
        disabled={status === 'running'}
      />

      {/* Live Monitoring */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LiveGraph data={bandwidthData} onClear={clearBandwidthData} />
        <ConnectionLog events={connectionLog} />
      </div>

      {/* Test History */}
      <TestHistory />
    </div>
  )
}
```

**Step 3: Update tools/index.ts**

Add to the file:
```typescript
export { default as IperfServer } from './IperfServer'
```

**Step 4: Update App.tsx**

Add the route:
```tsx
<Route path="iperf-server" element={<IperfServer />} />
```

**Step 5: Update Dashboard.tsx**

Add to tools array:
```typescript
{
  name: 'iPerf Server',
  description: 'Run an iperf3 server for bandwidth testing with real-time monitoring and historical data.',
  href: '/iperf-server',
  icon: Activity,
  features: ['Live bandwidth graph', 'Client allowlist', 'Test history', 'CSV/JSON export'],
},
```

And import Activity from lucide-react.

**Step 6: Commit**

```bash
git add src/components/tools/IperfServer/ src/components/tools/index.ts src/App.tsx src/components/layout/Dashboard.tsx
git commit -m "feat(iperf): integrate IperfServer into FAK app"
```

---

### Task 17: Add Recharts dependency and verify build

**Step 1: Install Recharts**

```bash
npm install recharts
```

**Step 2: Verify build passes**

```bash
npm run build
```

**Step 3: Commit package changes**

```bash
git add package.json package-lock.json
git commit -m "feat(iperf): add recharts dependency for live graphs"
```

---

### Task 18: Final integration testing

**Step 1: Start backend in one terminal**

```bash
cd backend && go run ./cmd/server
```

**Step 2: Start frontend in another terminal**

```bash
npm run dev
```

**Step 3: Verify**

- Navigate to http://localhost:5173/iperf-server
- Verify WebSocket connects (status badge shows "Stopped" not "Connecting...")
- Configure and start server
- From another machine: `iperf3 -c <host> -p 5201`
- Verify live graph updates
- Verify connection log shows events
- Verify test history populates
- Stop server
- Test CSV/JSON export

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(iperf): integration fixes from testing"
```

---

## Summary

**Phase 1: Go Backend (Tasks 1-8)**
- Core types and models
- SQLite storage layer
- iperf3 config validation and CLI builder
- JSON output parser
- Process manager
- WebSocket hub
- REST API handlers
- Main server wiring

**Phase 2: Docker Setup (Tasks 9-11)**
- Backend Dockerfile with iperf3
- Frontend nginx config and Dockerfile
- Docker Compose for production and development

**Phase 3: React Frontend (Tasks 12-18)**
- Types and WebSocket hook
- ServerControls and ConfigPanel
- LiveGraph and ConnectionLog
- TestHistory with filtering and export
- Main component integration
- Final testing

---

## Implementation Progress

All tasks completed on 2026-01-27.

**Notes:**
- The system may have an iperf3 systemd service running on port 5201. If the iPerf Server fails to start on the default port, either:
  1. Stop the system service: `sudo systemctl stop iperf3`
  2. Use a different port (e.g., 5210) in the UI configuration
- Docker deployment requires the system to have Docker and Docker Compose installed
- For development, run backend (`go run ./cmd/server`) and frontend (`npm run dev`) separately
- In production (Docker), use `docker compose up --build`
