package iperf

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/Tom-Oram/fak/backend/internal/models"
)

// EventHandler is a callback function that handles WebSocket messages
type EventHandler func(models.WSMessage)

// Manager manages the iperf3 server process
type Manager struct {
	mu           sync.RWMutex
	cmd          *exec.Cmd
	cancel       context.CancelFunc
	config       models.ServerConfig
	status       models.ServerStatus
	eventHandler EventHandler
	idleTimer    *time.Timer
}

// NewManager creates a new Manager with the given event handler
func NewManager(handler EventHandler) *Manager {
	return &Manager{
		status:       models.ServerStatusStopped,
		config:       models.DefaultServerConfig(),
		eventHandler: handler,
	}
}

// GetStatus returns the current server status
func (m *Manager) GetStatus() models.ServerStatus {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.status
}

// GetConfig returns the current server configuration
func (m *Manager) GetConfig() models.ServerConfig {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.config
}

// Start starts the iperf3 server with the given configuration
func (m *Manager) Start(cfg models.ServerConfig) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Check not already running
	if m.status == models.ServerStatusRunning {
		return fmt.Errorf("server is already running")
	}

	// Validate config (return first error)
	if errors := ValidateConfig(cfg); len(errors) > 0 {
		return errors[0]
	}

	// Create context with cancel
	ctx, cancel := context.WithCancel(context.Background())
	m.cancel = cancel

	// Build args and exec iperf3 with context
	args := BuildArgs(cfg)
	cmd := exec.CommandContext(ctx, "iperf3", args...)
	m.cmd = cmd
	m.config = cfg

	// Get stdout pipe
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		return fmt.Errorf("failed to get stdout pipe: %w", err)
	}

	// Get stderr pipe
	stderr, err := cmd.StderrPipe()
	if err != nil {
		cancel()
		return fmt.Errorf("failed to get stderr pipe: %w", err)
	}

	// Start process
	if err := cmd.Start(); err != nil {
		cancel()
		return fmt.Errorf("failed to start iperf3: %w", err)
	}

	// Set status to Running, send status update
	m.status = models.ServerStatusRunning
	m.sendStatusUpdateLocked()

	// Start parseOutput goroutine
	go m.parseOutput(stdout)

	// Start readStderr goroutine
	go m.readStderr(stderr)

	// Start monitorProcess goroutine
	go m.monitorProcess()

	// Start idle timer if configured
	if cfg.IdleTimeout > 0 {
		m.idleTimer = time.AfterFunc(time.Duration(cfg.IdleTimeout)*time.Second, func() {
			m.Stop()
		})
	}

	return nil
}

// Stop stops the iperf3 server
func (m *Manager) Stop() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Check is running
	if m.status != models.ServerStatusRunning {
		return fmt.Errorf("server is not running")
	}

	// Cancel context
	if m.cancel != nil {
		m.cancel()
		m.cancel = nil
	}

	// Stop idle timer
	if m.idleTimer != nil {
		m.idleTimer.Stop()
		m.idleTimer = nil
	}

	// Set status to Stopped, send status update
	m.status = models.ServerStatusStopped
	m.sendStatusUpdateLocked()

	return nil
}

// parseOutput reads iperf3 text output line-by-line and dispatches events.
func (m *Manager) parseOutput(stdout io.ReadCloser) {
	defer stdout.Close()

	parser := NewTextParser()
	scanner := bufio.NewScanner(stdout)

	for scanner.Scan() {
		line := scanner.Text()

		// Reset idle timer on any output
		m.resetIdleTimer()

		result := parser.ParseLine(line)

		switch result.Event {
		case EventClientConnected:
			// Check allowlist
			m.mu.RLock()
			allowlist := m.config.Allowlist
			m.mu.RUnlock()

			if !IsClientAllowed(result.ConnectionEvent.ClientIP, allowlist) {
				m.sendError(fmt.Sprintf("client %s not in allowlist", result.ConnectionEvent.ClientIP))
				continue
			}

			m.sendEvent(models.WSMessage{
				Type:    models.WSMessageTypeClientConnected,
				Payload: result.ConnectionEvent,
			})

		case EventBandwidthUpdate:
			m.sendEvent(models.WSMessage{
				Type:    models.WSMessageTypeBandwidthUpdate,
				Payload: result.BandwidthUpdate,
			})

		case EventTestComplete:
			m.sendEvent(models.WSMessage{
				Type:    models.WSMessageTypeTestComplete,
				Payload: result.TestResult,
			})

		case EventError:
			m.sendError(result.ErrorMessage)
		}
	}
}

// readStderr reads stderr lines and sends them as error messages.
func (m *Manager) readStderr(stderr io.ReadCloser) {
	defer stderr.Close()

	scanner := bufio.NewScanner(stderr)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" {
			m.sendError(fmt.Sprintf("iperf3: %s", line))
		}
	}
}

// monitorProcess waits for the iperf3 process to exit
func (m *Manager) monitorProcess() {
	if m.cmd == nil {
		return
	}

	err := m.cmd.Wait()

	m.mu.Lock()
	defer m.mu.Unlock()

	// Only update status if we're still running (not manually stopped)
	if m.status == models.ServerStatusRunning {
		if err != nil {
			// Check if it was killed by context cancellation
			if m.cmd.ProcessState != nil && m.cmd.ProcessState.Exited() {
				// Process exited normally or was terminated
				m.status = models.ServerStatusStopped
			} else {
				m.status = models.ServerStatusError
			}
		} else {
			m.status = models.ServerStatusStopped
		}
		m.sendStatusUpdateLocked()
	}

	// Clean up
	m.cmd = nil
	if m.idleTimer != nil {
		m.idleTimer.Stop()
		m.idleTimer = nil
	}
}

// resetIdleTimer resets the idle timer to IdleTimeout seconds
func (m *Manager) resetIdleTimer() {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.idleTimer != nil && m.config.IdleTimeout > 0 {
		m.idleTimer.Reset(time.Duration(m.config.IdleTimeout) * time.Second)
	}
}

// sendStatusUpdate sends a server status WebSocket message (must be called with lock held)
func (m *Manager) sendStatusUpdateLocked() {
	listenAddr := ""
	if m.status == models.ServerStatusRunning {
		listenAddr = fmt.Sprintf("%s:%d", m.config.BindAddress, m.config.Port)
	}

	m.sendEventLocked(models.WSMessage{
		Type: models.WSMessageTypeServerStatus,
		Payload: models.ServerStatusPayload{
			Status:     m.status,
			Config:     &m.config,
			ListenAddr: listenAddr,
		},
	})
}

// sendError sends an error WebSocket message
func (m *Manager) sendError(msg string) {
	m.sendEvent(models.WSMessage{
		Type: models.WSMessageTypeError,
		Payload: map[string]string{
			"message": msg,
		},
	})
}

// sendEvent sends a WebSocket message via the event handler
func (m *Manager) sendEvent(msg models.WSMessage) {
	if m.eventHandler != nil {
		m.eventHandler(msg)
	}
}

// sendEventLocked sends a WebSocket message via the event handler (for use when lock is already held)
func (m *Manager) sendEventLocked(msg models.WSMessage) {
	if m.eventHandler != nil {
		m.eventHandler(msg)
	}
}
