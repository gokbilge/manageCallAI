package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"slices"
	"syscall"
	"time"

	"github.com/gokbilge/manageCallAI/apps/freeswitch-agent/internal/config"
	"github.com/gokbilge/manageCallAI/apps/freeswitch-agent/internal/dispatcher"
	"github.com/gokbilge/manageCallAI/apps/freeswitch-agent/internal/esl"
	"github.com/gokbilge/manageCallAI/apps/freeswitch-agent/internal/logging"
)

func main() {
	cfg := config.Load()
	logger := logging.New(cfg.LogLevel)
	os.Exit(runAgent(context.Background(), os.Args[1:], cfg, logger, newESLConnector, esl.SmokeCheck))
}

type eslConnector interface {
	eslHealth
	Connect(context.Context) error
}

func runAgent(
	parent context.Context,
	args []string,
	cfg config.Config,
	logger *slog.Logger,
	newClient func(config.Config, *slog.Logger) eslConnector,
	smokeCheck func(config.Config, *slog.Logger) error,
) int {
	if err := validateAgentConfig(cfg); err != nil {
		logger.Error("invalid freeswitch-agent configuration", slog.String("error", err.Error()))
		return 1
	}

	if slices.Contains(args, "--smoke-check") {
		if err := smokeCheck(cfg, logger); err != nil {
			logger.Error("ESL smoke check failed", slog.String("error", err.Error()))
			return 1
		}
		logger.Info("ESL smoke check passed")
		return 0
	}

	ctx, stop := signal.NotifyContext(parent, syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	logger.Info("starting manageCallAI freeswitch-agent",
		slog.String("esl_host", cfg.ESLHost),
		slog.Int("esl_port", cfg.ESLPort),
		slog.String("api_base_url", cfg.APIBaseURL),
		slog.String("tenant_id", cfg.TenantID),
		slog.Bool("runtime_token_configured", cfg.RuntimeToken != ""),
		slog.String("log_level", cfg.LogLevel),
	)

	client := newClient(cfg, logger)
	healthServer := startHealthServer(ctx, cfg, client, logger)
	defer func() {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = healthServer.Shutdown(shutdownCtx)
	}()

	// Start the outbound call dispatcher — polls the API for pending outbound
	// call requests and executes them via FreeSWITCH ESL originate commands.
	cmdClient := esl.NewCommandClient(cfg, logger)
	outboundDispatcher := dispatcher.NewOutboundDispatcher(cfg, cmdClient, logger)
	go outboundDispatcher.Run(ctx, 2*time.Second)

	// Start the gateway apply dispatcher — polls the API for pending
	// runtime_apply_requests and executes allowlisted ESL commands (reloadxml,
	// sofia profile rescan, etc.) to apply trunk config changes without manual CLI.
	applyDispatcher := dispatcher.NewApplyDispatcher(cfg, cmdClient, logger)
	go applyDispatcher.Run(ctx, 3*time.Second)

	if err := client.Connect(ctx); err != nil {
		logger.Error("failed to initialize esl client", slog.String("error", err.Error()))
		return 1
	}

	<-ctx.Done()
	logger.Info("shutting down manageCallAI freeswitch-agent")
	return 0
}

func newESLConnector(cfg config.Config, logger *slog.Logger) eslConnector {
	return esl.NewClient(cfg, logger)
}

type eslHealth interface {
	Health() esl.HealthStatus
}

func validateAgentConfig(cfg config.Config) error {
	if cfg.ESLPort <= 0 || cfg.ESLPort > 65535 {
		return fmt.Errorf("FREESWITCH_ESL_PORT must be between 1 and 65535, got %d", cfg.ESLPort)
	}
	if cfg.HealthPort <= 0 || cfg.HealthPort > 65535 {
		return fmt.Errorf("HEALTH_PORT must be between 1 and 65535, got %d", cfg.HealthPort)
	}
	if cfg.ESLHost == "" {
		return errors.New("FREESWITCH_ESL_HOST is required")
	}
	if cfg.APIBaseURL == "" {
		return errors.New("API_BASE_URL is required")
	}
	return nil
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
