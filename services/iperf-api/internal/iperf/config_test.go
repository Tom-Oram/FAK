package iperf

import (
	"testing"

	"github.com/Tom-Oram/fak/backend/internal/models"
)

func TestBuildArgs_NoJSON_HasForceflush(t *testing.T) {
	cfg := models.DefaultServerConfig()
	args := BuildArgs(cfg)

	hasForceflush := false
	hasJSON := false
	for _, arg := range args {
		if arg == "--forceflush" {
			hasForceflush = true
		}
		if arg == "-J" {
			hasJSON = true
		}
	}

	if !hasForceflush {
		t.Error("expected --forceflush in args, not found")
	}
	if hasJSON {
		t.Error("-J should not be in args")
	}
}

func TestBuildArgs_ServerMode(t *testing.T) {
	cfg := models.DefaultServerConfig()
	args := BuildArgs(cfg)

	hasServer := false
	for _, arg := range args {
		if arg == "-s" {
			hasServer = true
		}
	}

	if !hasServer {
		t.Error("expected -s in args, not found")
	}
}
