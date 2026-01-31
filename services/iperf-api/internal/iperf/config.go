package iperf

import (
	"fmt"
	"net"
	"strconv"

	"github.com/Tom-Oram/fak/backend/internal/models"
)

// ValidationError represents a configuration validation error
type ValidationError struct {
	Field   string
	Message string
}

// Error returns the string representation of the validation error
func (e ValidationError) Error() string {
	return fmt.Sprintf("%s: %s", e.Field, e.Message)
}

// ValidateConfig validates the server configuration and returns any validation errors
func ValidateConfig(cfg models.ServerConfig) []ValidationError {
	var errors []ValidationError

	// Port must be 1-65535
	if cfg.Port < 1 || cfg.Port > 65535 {
		errors = append(errors, ValidationError{
			Field:   "port",
			Message: "must be between 1 and 65535",
		})
	}

	// BindAddress must be valid IP if not empty or "0.0.0.0"
	if cfg.BindAddress != "" && cfg.BindAddress != "0.0.0.0" {
		if net.ParseIP(cfg.BindAddress) == nil {
			errors = append(errors, ValidationError{
				Field:   "bindAddress",
				Message: "must be a valid IP address",
			})
		}
	}

	// IdleTimeout must be non-negative
	if cfg.IdleTimeout < 0 {
		errors = append(errors, ValidationError{
			Field:   "idleTimeout",
			Message: "must be non-negative",
		})
	}

	// Each allowlist entry must be valid IP or CIDR
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

// isValidIPOrCIDR returns true if s is a valid IP address or CIDR notation
func isValidIPOrCIDR(s string) bool {
	// Check if it's a valid IP address
	if net.ParseIP(s) != nil {
		return true
	}

	// Check if it's a valid CIDR notation
	_, _, err := net.ParseCIDR(s)
	return err == nil
}

// BuildArgs builds the command-line arguments for iperf3 based on the configuration
func BuildArgs(cfg models.ServerConfig) []string {
	args := []string{
		"-s",                          // server mode
		"--forceflush",                // flush output per line
		"-p", strconv.Itoa(cfg.Port), // port
	}

	// Add bind address if not empty or "0.0.0.0"
	if cfg.BindAddress != "" && cfg.BindAddress != "0.0.0.0" {
		args = append(args, "-B", cfg.BindAddress)
	}

	// Add one-off mode if enabled
	if cfg.OneOff {
		args = append(args, "-1")
	}

	// Note: UDP is auto-detected by iperf3 server, no flag needed

	return args
}

// IsClientAllowed checks if a client IP is allowed based on the allowlist
func IsClientAllowed(clientIP string, allowlist []string) bool {
	// Empty allowlist means all clients are allowed
	if len(allowlist) == 0 {
		return true
	}

	parsedClientIP := net.ParseIP(clientIP)
	if parsedClientIP == nil {
		return false
	}

	for _, entry := range allowlist {
		// Check for exact IP match
		if entry == clientIP {
			return true
		}

		// Check for CIDR match
		_, network, err := net.ParseCIDR(entry)
		if err == nil && network.Contains(parsedClientIP) {
			return true
		}
	}

	return false
}
