package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"slices"
	"syscall"
	"time"

	"github.com/gokbilge/manageCallAI/apps/freeswitch-agent/internal/config"
	"github.com/gokbilge/manageCallAI/apps/freeswitch-agent/internal/esl"
	"github.com/gokbilge/manageCallAI/apps/freeswitch-agent/internal/logging"
)

func main() {
	cfg := config.Load()
	logger := logging.New(cfg.LogLevel)

	// --smoke-check: single ESL auth round-trip, then exit.
	if slices.Contains(os.Args[1:], "--smoke-check") {
		if err := esl.SmokeCheck(cfg, logger); err != nil {
			logger.Error("ESL smoke check failed", slog.String("error", err.Error()))
			os.Exit(1)
		}
		logger.Info("ESL smoke check passed")
		os.Exit(0)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	logger.Info("starting manageCallAI freeswitch-agent",
		slog.String("esl_host", cfg.ESLHost),
		slog.Int("esl_port", cfg.ESLPort),
		slog.String("api_base_url", cfg.APIBaseURL),
		slog.String("tenant_id", cfg.TenantID),
		slog.Bool("runtime_token_configured", cfg.RuntimeToken != ""),
		slog.String("log_level", cfg.LogLevel),
	)

	client := esl.NewClient(cfg, logger)
	healthServer := startHealthServer(ctx, cfg, client, logger)
	defer func() {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = healthServer.Shutdown(shutdownCtx)
	}()

	if err := client.Connect(ctx); err != nil {
		logger.Error("failed to initialize esl client", slog.String("error", err.Error()))
		os.Exit(1)
	}

	<-ctx.Done()
	logger.Info("shutting down manageCallAI freeswitch-agent")
}

type eslHealth interface {
	Health() esl.HealthStatus
}

func startHealthServer(ctx context.Context, cfg config.Config, client eslHealth, logger *slog.Logger) *http.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		health := client.Health()
		status := "degraded"
		httpStatus := http.StatusServiceUnavailable
		if health.Connected {
			status = "healthy"
			httpStatus = http.StatusOK
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(httpStatus)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":            status,
			"esl_connected":     health.Connected,
			"last_connected_at": health.LastConnectedAt,
			"last_event_at":     health.LastEventAt,
		})
	})

	server := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.HealthPort),
		Handler:           mux,
		ReadHeaderTimeout: 2 * time.Second,
	}

	go func() {
		logger.Info("starting freeswitch-agent health server", slog.Int("port", cfg.HealthPort))
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("freeswitch-agent health server failed", slog.String("error", err.Error()))
		}
	}()

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}()

	return server
}
