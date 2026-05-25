package esl

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"time"

	"github.com/gokbilge/manageCallAI/apps/freeswitch-agent/internal/config"
)

type Client struct {
	config config.Config
	logger *slog.Logger
}

func NewClient(cfg config.Config, logger *slog.Logger) *Client {
	return &Client{
		config: cfg,
		logger: logger,
	}
}

func (c *Client) Connect(ctx context.Context) error {
	address := fmt.Sprintf("%s:%d", c.config.ESLHost, c.config.ESLPort)

	c.logger.Info("preparing esl connection",
		slog.String("address", address),
		slog.String("mode", "outbound-placeholder"),
	)

	dialer := net.Dialer{Timeout: 3 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", address)
	if err != nil {
		c.logger.Warn("esl dial failed; keeping placeholder structure only",
			slog.String("address", address),
			slog.String("error", err.Error()),
		)
		return nil
	}
	defer conn.Close()

	c.logger.Info("connected to esl endpoint",
		slog.String("remote_addr", conn.RemoteAddr().String()),
	)

	c.logger.Info("esl subscription logic is not implemented yet")
	return nil
}
