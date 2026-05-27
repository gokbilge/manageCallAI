package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/gokbilge/manageCallAI/apps/freeswitch-agent/internal/config"
	"github.com/gokbilge/manageCallAI/apps/freeswitch-agent/internal/esl"
	"github.com/gokbilge/manageCallAI/apps/freeswitch-agent/internal/logging"
)

func main() {
	cfg := config.Load()
	logger := logging.New(cfg.LogLevel)

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
	if err := client.Connect(ctx); err != nil {
		logger.Error("failed to initialize esl client", slog.String("error", err.Error()))
		os.Exit(1)
	}

	<-ctx.Done()
	logger.Info("shutting down manageCallAI freeswitch-agent")
}
