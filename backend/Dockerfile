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
