package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"sync/atomic"
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

type fakeConnector struct {
	mockESLHealth
	connectErr error
	connected  atomic.Bool
}

func (f *fakeConnector) Connect(ctx context.Context) error {
	f.connected.Store(true)
	if f.connectErr != nil {
		return f.connectErr
	}
	<-ctx.Done()
	return nil
}

func validAgentConfig(t *testing.T) config.Config {
	t.Helper()
	return config.Config{
		AppEnv:       "test",
		TenantID:     "tenant-1",
		RuntimeToken: "runtime-token-that-is-long-enough",
		ESLHost:      "127.0.0.1",
		ESLPort:      8021,
		ESLPassword:  "test-esl-password",
		APIBaseURL:   "http://127.0.0.1:3000",
		HealthPort:   freePort(t),
		LogLevel:     "error",
	}
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

func TestRunAgentSmokeCheckSuccess(t *testing.T) {
	cfg := validAgentConfig(t)
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	var smokeCalled atomic.Bool

	code := runAgent(
		context.Background(),
		[]string{"--smoke-check"},
		cfg,
		logger,
		func(config.Config, *slog.Logger) eslConnector {
			t.Fatal("newClient should not be called for smoke check")
			return nil
		},
		func(got config.Config, _ *slog.Logger) error {
			smokeCalled.Store(true)
			if got.ESLPort != cfg.ESLPort {
				t.Fatalf("smoke check config ESLPort: got %d, want %d", got.ESLPort, cfg.ESLPort)
			}
			return nil
		},
	)

	if code != 0 {
		t.Fatalf("exit code: got %d, want 0", code)
	}
	if !smokeCalled.Load() {
		t.Fatal("smoke check was not called")
	}
}

func TestRunAgentSmokeCheckFailure(t *testing.T) {
	cfg := validAgentConfig(t)
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	code := runAgent(
		context.Background(),
		[]string{"--smoke-check"},
		cfg,
		logger,
		func(config.Config, *slog.Logger) eslConnector {
			t.Fatal("newClient should not be called for smoke check")
			return nil
		},
		func(config.Config, *slog.Logger) error {
			return errors.New("auth rejected")
		},
	)

	if code != 1 {
		t.Fatalf("exit code: got %d, want 1", code)
	}
}

func TestRunAgentRejectsInvalidESLPort(t *testing.T) {
	cfg := validAgentConfig(t)
	cfg.ESLPort = 0
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	code := runAgent(
		context.Background(),
		nil,
		cfg,
		logger,
		func(config.Config, *slog.Logger) eslConnector {
			t.Fatal("newClient should not be called for invalid config")
			return nil
		},
		func(config.Config, *slog.Logger) error {
			t.Fatal("smokeCheck should not be called for invalid config")
			return nil
		},
	)

	if code != 1 {
		t.Fatalf("exit code: got %d, want 1", code)
	}
}

func TestRunAgentRejectsMissingRequiredEndpointConfig(t *testing.T) {
	cfg := validAgentConfig(t)
	cfg.ESLHost = ""
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	code := runAgent(
		context.Background(),
		nil,
		cfg,
		logger,
		func(config.Config, *slog.Logger) eslConnector {
			t.Fatal("newClient should not be called for invalid config")
			return nil
		},
		func(config.Config, *slog.Logger) error {
			t.Fatal("smokeCheck should not be called for invalid config")
			return nil
		},
	)

	if code != 1 {
		t.Fatalf("exit code: got %d, want 1", code)
	}
}

func TestRunAgentReturnsFailureWhenConnectFails(t *testing.T) {
	cfg := validAgentConfig(t)
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	code := runAgent(
		context.Background(),
		nil,
		cfg,
		logger,
		func(config.Config, *slog.Logger) eslConnector {
			return &fakeConnector{connectErr: errors.New("dial refused")}
		},
		func(config.Config, *slog.Logger) error {
			t.Fatal("smokeCheck should not be called")
			return nil
		},
	)

	if code != 1 {
		t.Fatalf("exit code: got %d, want 1", code)
	}
}

func TestRunAgentGracefulShutdownOnContextCancel(t *testing.T) {
	cfg := validAgentConfig(t)
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	parent, cancel := context.WithCancel(context.Background())
	connector := &fakeConnector{}
	done := make(chan int, 1)

	go func() {
		done <- runAgent(
			parent,
			nil,
			cfg,
			logger,
			func(config.Config, *slog.Logger) eslConnector {
				return connector
			},
			func(config.Config, *slog.Logger) error {
				t.Error("smokeCheck should not be called")
				return nil
			},
		)
	}()

	for i := 0; i < 50; i++ {
		if connector.connected.Load() {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	if !connector.connected.Load() {
		t.Fatal("connector did not start")
	}

	cancel()

	select {
	case code := <-done:
		if code != 0 {
			t.Fatalf("exit code: got %d, want 0", code)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("runAgent did not return after context cancellation")
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
