package esl

import (
	"bufio"
	"context"
	"fmt"
	"log/slog"
	"net"
	"strings"
	"time"

	"github.com/gokbilge/manageCallAI/apps/freeswitch-agent/internal/config"
	"github.com/gokbilge/manageCallAI/apps/freeswitch-agent/internal/events"
	"github.com/gokbilge/manageCallAI/apps/freeswitch-agent/internal/forwarder"
)

type Client struct {
	config    config.Config
	logger    *slog.Logger
	forwarder *forwarder.APIForwarder
}

func NewClient(cfg config.Config, logger *slog.Logger) *Client {
	return &Client{
		config:    cfg,
		logger:    logger,
		forwarder: forwarder.NewAPIForwarder(cfg, logger),
	}
}

func (c *Client) Connect(ctx context.Context) error {
	address := fmt.Sprintf("%s:%d", c.config.ESLHost, c.config.ESLPort)

	for {
		if ctx.Err() != nil {
			return nil
		}

		if err := c.runSession(ctx, address); err != nil {
			c.logger.Warn("esl session ended",
				slog.String("address", address),
				slog.String("error", err.Error()),
			)
		}

		select {
		case <-ctx.Done():
			return nil
		case <-time.After(3 * time.Second):
		}
	}
}

func (c *Client) runSession(ctx context.Context, address string) error {
	c.logger.Info("connecting to esl", slog.String("address", address))

	dialer := net.Dialer{Timeout: 3 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", address)
	if err != nil {
		return err
	}
	defer conn.Close()

	reader := bufio.NewReader(conn)
	if err := c.authenticate(reader, conn); err != nil {
		return err
	}

	if err := c.subscribe(reader, conn); err != nil {
		return err
	}

	c.logger.Info("esl subscription active", slog.String("address", address))

	for {
		if err := conn.SetReadDeadline(time.Now().Add(30 * time.Second)); err != nil {
			return err
		}

		msg, err := readMessage(reader)
		if err != nil {
			return err
		}

		if !isEventMessage(msg.Headers) {
			continue
		}

		payload := parsePlainEvent(msg.Body)
		normalized, ok := events.NormalizeMVP(payload)
		if !ok {
			c.logger.Debug("ignoring esl event",
				slog.String("content_type", msg.Headers["Content-Type"]),
				slog.String("event_name", payload["Event-Name"]),
				slog.String("event_subclass", payload["Event-Subclass"]),
			)
			continue
		}

		c.logger.Info("received normalized esl event",
			slog.String("event_type", normalized.EventType),
			slog.String("call_id", normalized.CallID),
		)

		if err := c.forwarder.ForwardEvent(ctx, normalized); err != nil {
			c.logger.Error("failed to forward esl event",
				slog.String("event_type", normalized.EventType),
				slog.String("error", err.Error()),
			)
		}
	}
}

func (c *Client) authenticate(reader *bufio.Reader, conn net.Conn) error {
	msg, err := readMessage(reader)
	if err != nil {
		return err
	}

	if !strings.EqualFold(msg.Headers["Content-Type"], "auth/request") {
		return fmt.Errorf("expected auth/request, got %q", msg.Headers["Content-Type"])
	}

	if _, err := fmt.Fprintf(conn, "auth %s\n\n", c.config.ESLPassword); err != nil {
		return err
	}

	reply, err := readMessage(reader)
	if err != nil {
		return err
	}

	if !strings.Contains(reply.Headers["Reply-Text"], "+OK") {
		return fmt.Errorf("esl auth rejected: %s", reply.Headers["Reply-Text"])
	}

	c.logger.Info("authenticated to esl")
	return nil
}

func (c *Client) subscribe(reader *bufio.Reader, conn net.Conn) error {
	commands := []string{
		"events plain CHANNEL_CREATE CHANNEL_ANSWER CHANNEL_HANGUP CUSTOM",
		"filter Event-Subclass sofia::register",
		"filter Event-Subclass sofia::unregister",
	}

	for _, command := range commands {
		if _, err := fmt.Fprintf(conn, "%s\n\n", command); err != nil {
			return err
		}

		reply, err := readMessage(reader)
		if err != nil {
			return err
		}

		if !strings.Contains(reply.Headers["Reply-Text"], "+OK") {
			return fmt.Errorf("esl subscribe command failed: %s -> %s", command, reply.Headers["Reply-Text"])
		}
	}

	return nil
}

func isEventMessage(headers map[string]string) bool {
	switch headers["Content-Type"] {
	case "text/event-plain", "text/event-json", "text/disconnect-notice":
		return true
	default:
		return false
	}
}
