package storage

import (
	"database/sql"
	"time"

	"github.com/Tom-Oram/fak/backend/internal/models"
	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"
)

// SQLiteStorage provides SQLite-based persistence for iPerf test results.
type SQLiteStorage struct {
	db *sql.DB
}

// NewSQLiteStorage opens a SQLite database at the given path, runs migrations,
// and returns a ready-to-use storage instance.
func NewSQLiteStorage(dbPath string) (*SQLiteStorage, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}

	storage := &SQLiteStorage{db: db}

	if err := storage.migrate(); err != nil {
		db.Close()
		return nil, err
	}

	return storage, nil
}

// migrate creates the required tables and indexes if they don't exist.
func (s *SQLiteStorage) migrate() error {
	createTableSQL := `
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

	_, err := s.db.Exec(createTableSQL)
	return err
}

// SaveTestResult inserts a test result into the database.
// If the result has no ID, a new UUID is generated.
// If the timestamp is zero, the current time is used.
func (s *SQLiteStorage) SaveTestResult(result *models.TestResult) error {
	if result.ID == "" {
		result.ID = uuid.New().String()
	}

	if result.Timestamp.IsZero() {
		result.Timestamp = time.Now()
	}

	insertSQL := `
	INSERT INTO test_results (
		id, timestamp, client_ip, client_port, protocol, duration,
		bytes_transferred, avg_bandwidth, max_bandwidth, min_bandwidth,
		retransmits, jitter, packet_loss, direction
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	_, err := s.db.Exec(
		insertSQL,
		result.ID,
		result.Timestamp,
		result.ClientIP,
		result.ClientPort,
		result.Protocol,
		result.Duration,
		result.BytesTransferred,
		result.AvgBandwidth,
		result.MaxBandwidth,
		result.MinBandwidth,
		result.Retransmits,
		result.Jitter,
		result.PacketLoss,
		result.Direction,
	)

	return err
}

// GetTestResults retrieves test results ordered by timestamp descending,
// with pagination support via limit and offset.
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

	return scanTestResults(rows)
}

// GetTestResultsByClientIP retrieves test results for a specific client IP,
// ordered by timestamp descending with pagination support.
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

	return scanTestResults(rows)
}

// GetTotalCount returns the total number of test results in the database.
func (s *SQLiteStorage) GetTotalCount() (int, error) {
	var count int
	err := s.db.QueryRow("SELECT COUNT(*) FROM test_results").Scan(&count)
	return count, err
}

// Close closes the database connection.
func (s *SQLiteStorage) Close() error {
	return s.db.Close()
}

// scanTestResults is a helper function to scan rows into TestResult structs.
func scanTestResults(rows *sql.Rows) ([]models.TestResult, error) {
	var results []models.TestResult

	for rows.Next() {
		var r models.TestResult
		var protocol string

		err := rows.Scan(
			&r.ID,
			&r.Timestamp,
			&r.ClientIP,
			&r.ClientPort,
			&protocol,
			&r.Duration,
			&r.BytesTransferred,
			&r.AvgBandwidth,
			&r.MaxBandwidth,
			&r.MinBandwidth,
			&r.Retransmits,
			&r.Jitter,
			&r.PacketLoss,
			&r.Direction,
		)
		if err != nil {
			return nil, err
		}

		r.Protocol = models.Protocol(protocol)
		results = append(results, r)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return results, nil
}
