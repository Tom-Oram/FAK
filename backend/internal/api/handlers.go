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

// Server is the HTTP API server that manages the iPerf server lifecycle.
type Server struct {
	hub     *Hub
	manager *iperf.Manager
	storage *storage.SQLiteStorage
}

// NewServer creates a new Server with the given storage backend.
func NewServer(store *storage.SQLiteStorage) *Server {
	hub := NewHub()
	go hub.Run()

	s := &Server{
		hub:     hub,
		storage: store,
	}

	// Create manager with handler that broadcasts messages AND saves test results
	handler := func(msg models.WSMessage) {
		// Broadcast to WebSocket clients
		hub.Broadcast(msg)

		// Save test results to storage
		if msg.Type == models.WSMessageTypeTestComplete {
			if result, ok := msg.Payload.(*models.TestResult); ok {
				if err := store.SaveTestResult(result); err != nil {
					// Log error but don't fail - the broadcast already happened
					hub.Broadcast(models.WSMessage{
						Type: models.WSMessageTypeError,
						Payload: map[string]string{
							"message": fmt.Sprintf("failed to save test result: %v", err),
						},
					})
				}
			}
		}
	}

	s.manager = iperf.NewManager(handler)
	return s
}

// Routes returns a chi.Router with all API routes configured.
func (s *Server) Routes() chi.Router {
	r := chi.NewRouter()

	r.Get("/health", s.handleHealth)
	r.Get("/api/status", s.handleGetStatus)
	r.Post("/api/start", s.handleStart)
	r.Post("/api/stop", s.handleStop)
	r.Get("/api/history", s.handleGetHistory)
	r.Get("/api/history/export", s.handleExportHistory)
	r.Get("/ws", s.hub.HandleWebSocket)

	return r
}

// handleHealth returns a simple health check response.
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// handleGetStatus returns the current server status.
func (s *Server) handleGetStatus(w http.ResponseWriter, r *http.Request) {
	status := s.manager.GetStatus()
	config := s.manager.GetConfig()

	listenAddr := ""
	if status == models.ServerStatusRunning {
		listenAddr = fmt.Sprintf("%s:%d", config.BindAddress, config.Port)
	}

	payload := models.ServerStatusPayload{
		Status:     status,
		Config:     &config,
		ListenAddr: listenAddr,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(payload)
}

// handleStart starts the iPerf server with the provided configuration.
func (s *Server) handleStart(w http.ResponseWriter, r *http.Request) {
	var config models.ServerConfig
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		http.Error(w, fmt.Sprintf("invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	if err := s.manager.Start(config); err != nil {
		http.Error(w, fmt.Sprintf("failed to start server: %v", err), http.StatusInternalServerError)
		return
	}

	// Return current status
	s.handleGetStatus(w, r)
}

// handleStop stops the iPerf server.
func (s *Server) handleStop(w http.ResponseWriter, r *http.Request) {
	if err := s.manager.Stop(); err != nil {
		http.Error(w, fmt.Sprintf("failed to stop server: %v", err), http.StatusInternalServerError)
		return
	}

	// Return current status
	s.handleGetStatus(w, r)
}

// handleGetHistory returns paginated test history.
func (s *Server) handleGetHistory(w http.ResponseWriter, r *http.Request) {
	// Parse query parameters
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")
	clientIP := r.URL.Query().Get("clientIp")

	// Default and max limit
	limit := 25
	if limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 {
			limit = parsed
		}
	}
	if limit > 100 {
		limit = 100
	}

	// Default offset
	offset := 0
	if offsetStr != "" {
		if parsed, err := strconv.Atoi(offsetStr); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	var results []models.TestResult
	var err error

	if clientIP != "" {
		results, err = s.storage.GetTestResultsByClientIP(clientIP, limit, offset)
	} else {
		results, err = s.storage.GetTestResults(limit, offset)
	}

	if err != nil {
		http.Error(w, fmt.Sprintf("failed to get history: %v", err), http.StatusInternalServerError)
		return
	}

	// Get total count
	total, err := s.storage.GetTotalCount()
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to get total count: %v", err), http.StatusInternalServerError)
		return
	}

	// Ensure results is not nil for JSON encoding
	if results == nil {
		results = []models.TestResult{}
	}

	response := map[string]interface{}{
		"results": results,
		"total":   total,
		"limit":   limit,
		"offset":  offset,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// handleExportHistory exports all test history in CSV or JSON format.
func (s *Server) handleExportHistory(w http.ResponseWriter, r *http.Request) {
	format := r.URL.Query().Get("format")
	if format == "" {
		format = "csv"
	}

	// Get all results (using a large limit)
	results, err := s.storage.GetTestResults(10000, 0)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to get history: %v", err), http.StatusInternalServerError)
		return
	}

	if results == nil {
		results = []models.TestResult{}
	}

	switch format {
	case "json":
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Disposition", "attachment; filename=iperf_history.json")
		json.NewEncoder(w).Encode(results)

	case "csv":
		fallthrough
	default:
		w.Header().Set("Content-Type", "text/csv")
		w.Header().Set("Content-Disposition", "attachment; filename=iperf_history.csv")

		writer := csv.NewWriter(w)
		defer writer.Flush()

		// Write header row
		header := []string{
			"id", "timestamp", "client_ip", "client_port", "protocol",
			"duration", "bytes_transferred", "avg_bandwidth", "max_bandwidth",
			"min_bandwidth", "retransmits", "jitter", "packet_loss", "direction",
		}
		writer.Write(header)

		// Write data rows
		for _, r := range results {
			retransmits := ""
			if r.Retransmits != nil {
				retransmits = strconv.Itoa(*r.Retransmits)
			}

			jitter := ""
			if r.Jitter != nil {
				jitter = fmt.Sprintf("%.6f", *r.Jitter)
			}

			packetLoss := ""
			if r.PacketLoss != nil {
				packetLoss = fmt.Sprintf("%.6f", *r.PacketLoss)
			}

			row := []string{
				r.ID,
				r.Timestamp.Format("2006-01-02T15:04:05Z07:00"),
				r.ClientIP,
				strconv.Itoa(r.ClientPort),
				string(r.Protocol),
				fmt.Sprintf("%.6f", r.Duration),
				strconv.FormatInt(r.BytesTransferred, 10),
				fmt.Sprintf("%.6f", r.AvgBandwidth),
				fmt.Sprintf("%.6f", r.MaxBandwidth),
				fmt.Sprintf("%.6f", r.MinBandwidth),
				retransmits,
				jitter,
				packetLoss,
				r.Direction,
			}
			writer.Write(row)
		}
	}
}
