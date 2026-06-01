package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/gokbilge/manageCallAI/apps/freeswitch-agent/internal/config"
	"github.com/gokbilge/manageCallAI/apps/freeswitch-agent/internal/esl"
)

type mockESLHealth struct {
	connected       bool
	lastConnectedAt string
	lastEventAt     string
}

func (m *mockESLHealth) Health() esl.HealthStatus {
	return esl.HealthStatus{Connected: m.connected, LastConnectedAt: m.lastConnectedAt, LastEventAt: m.lastEventAt}
}

func freePort(t *testing.T) int {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("freePort: %v", err)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	_ = ln.Close()
	return port
}

func startTestHealthServer(t *testing.T, client eslHealth) (string, func()) {
	t.Helper()
	port := freePort(t)
	cfg := config.Config{HealthPort: port}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	ctx, cancel := context.WithCancel(context.Background())
	server := startHealthServer(ctx, cfg, client, logger)
	baseURL := fmt.Sprintf("http://127.0.0.1:%d", port)
	for i := 0; i < 20; i++ {
		resp, err := http.Get(baseURL + "/health")
		if err == nil {
			_ = resp.Body.Close()
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	return baseURL, func() {
		cancel()
		shutdownCtx, sc := context.WithTimeout(context.Background(), 2*time.Second)
		defer sc()
		_ = server.Shutdown(shutdownCtx)
	}
}

func TestHealthEndpointHealthy(t *testing.T) {
	client := &mockESLHealth{connected: true, lastConnectedAt: "2026-06-01T00:00:00Z"}
	baseURL, stop := startTestHealthServer(t, client)
	defer stop()

	resp, err := http.Get(baseURL + "/health")
	if err != nil {
		t.Fatalf("GET /health: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
	var body map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["status"] != "healthy" {
		t.Errorf("expected healthy, got %v", body["status"])
	}
}

func TestHealthEndpointDegraded(t *testing.T) {
	client := &mockESLHealth{connected: false}
	baseURL, stop := startTestHealthServer(t, client)
	defer stop()

	resp, err := http.Get(baseURL + "/health")
	if err != nil {
		t.Fatalf("GET /health: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Errorf("expected 503, got %d", resp.StatusCode)
	}
}

func TestHealthEndpointReturnsJSON(t *testing.T) {
	client := &mockESLHealth{connected: true}
	baseURL, stop := startTestHealthServer(t, client)
	defer stop()

	resp, err := http.Get(baseURL + "/health")
	if err != nil {
		t.Fatalf("GET /health: %v", err)
	}
	defer resp.Body.Close()

	if ct := resp.Header.Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type: got %q, want application/json", ct)
	}
}

func TestHealthEndpointLastConnectedAt(t *testing.T) {
	ts := "2026-06-01T12:00:00Z"
	client := &mockESLHealth{connected: true, lastConnectedAt: ts}
	baseURL, stop := startTestHealthServer(t, client)
	defer stop()

	resp, err := http.Get(baseURL + "/health")
	if err != nil {
		t.Fatalf("GET /health: %v", err)
	}
	defer resp.Body.Close()

	var body map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["last_connected_at"] != ts {
		t.Errorf("last_connected_at: got %v, want %q", body["last_connected_at"], ts)
	}
}

func TestHealthServerShutsDownOnContextCancel(t *testing.T) {
	client := &mockESLHealth{connected: true}
	port := freePort(t)
	cfg := config.Config{HealthPort: port}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	ctx, cancel := context.WithCancel(context.Background())
	server := startHealthServer(ctx, cfg, client, logger)
	time.Sleep(20 * time.Millisecond)
	cancel()
	shutdownCtx, sc := context.WithTimeout(context.Background(), 2*time.Second)
	defer sc()
	_ = server.Shutdown(shutdownCtx)
	time.Sleep(20 * time.Millisecond)
	_, err := http.Get(fmt.Sprintf("http://127.0.0.1:%d/health", port))
	if err == nil {
		t.Error("expected connection refused after shutdown")
	}
}
