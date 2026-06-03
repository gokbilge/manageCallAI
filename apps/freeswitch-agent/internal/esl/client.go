package esl

import (
	"bufio"
	"context"
	"fmt"
	"log/slog"
	"math/rand"
	"net"
	"strings"
	"sync"
	"time"

	"github.com/gokbilge/manageCallAI/apps/freeswitch-agent/internal/config"
	"github.com/gokbilge/manageCallAI/apps/freeswitch-agent/internal/events"
	"github.com/gokbilge/manageCallAI/apps/freeswitch-agent/internal/forwarder"
)

type Client struct {
	config    config.Config
	logger    *slog.Logger
	forwarder *forwarder.APIForwarder
	mu        sync.RWMutex
	health    HealthStatus
}

type HealthStatus struct {
	Connected       bool   `json:"esl_connected"`
	LastConnectedAt string `json:"last_connected_at,omitempty"`
	LastEventAt     string `json:"last_event_at,omitempty"`
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
	attempt := 0

	for {
		if ctx.Err() != nil {
			return nil
		}

		started := time.Now()
		if err := c.runSession(ctx, address); err != nil {
			c.logger.Warn("esl session ended",
				slog.String("address", address),
				slog.String("error", err.Error()),
			)
		}
		if time.Since(started) > time.Minute {
			attempt = 0
		}

		delay := reconnectDelay(attempt)
		attempt++

		select {
		case <-ctx.Done():
			return nil
		case <-time.After(delay):
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

	go func() {
		<-ctx.Done()
		_ = conn.Close()
	}()

	reader := bufio.NewReader(conn)
	if err := c.authenticate(reader, conn); err != nil {
		return err
	}

	if err := c.subscribe(reader, conn); err != nil {
		return err
	}
	c.setConnected(true)
	defer c.setConnected(false)

	c.logger.Info("esl subscription active", slog.String("address", address))

	for {
		msg, err := readMessage(reader)
		if err != nil {
			return err
		}

		c.logger.Debug("received esl message",
			slog.String("content_type", msg.Headers["Content-Type"]),
			slog.String("reply_text", msg.Headers["Reply-Text"]),
		)

		if !isEventMessage(msg.Headers) {
			continue
		}
		c.setLastEventAt(time.Now().UTC())

		payload := parsePlainEvent(msg.Body)
		normalized, ok := events.NormalizeMVP(payload, c.config.TenantID)
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
	commands := subscriptionCommands()

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

func (c *Client) Health() HealthStatus {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.health
}

func (c *Client) setConnected(connected bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.health.Connected = connected
	if connected {
		c.health.LastConnectedAt = time.Now().UTC().Format(time.RFC3339Nano)
	}
}

func (c *Client) setLastEventAt(t time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.health.LastEventAt = t.Format(time.RFC3339Nano)
}

func subscriptionCommands() []string {
	return []string{
		"event plain CHANNEL_CREATE CHANNEL_ANSWER CHANNEL_HANGUP CHANNEL_PARK CHANNEL_UNPARK CUSTOM RECORD_START RECORD_STOP",
	}
}

func reconnectDelay(attempt int) time.Duration {
	if attempt < 0 {
		attempt = 0
	}
	if attempt > 5 {
		attempt = 5
	}

	base := time.Second << attempt
	if base > 30*time.Second {
		base = 30 * time.Second
	}

	jitterCap := int64(base / 2)
	if jitterCap <= 0 {
		return base
	}
	return base + time.Duration(rand.Int63n(jitterCap+1))
}

func isEventMessage(headers map[string]string) bool {
	switch headers["Content-Type"] {
	case "text/event-plain", "text/event-json", "text/disconnect-notice":
		return true
	default:
		return false
	}
}

// SmokeCheck performs a single ESL connection attempt: dial, authenticate, and
// send a version query. It returns nil on success and an error on any failure.
// It does not retry and exits as soon as the auth round-trip completes.
func SmokeCheck(cfg config.Config, logger *slog.Logger) error {
	address := fmt.Sprintf("%s:%d", cfg.ESLHost, cfg.ESLPort)
	logger.Info("esl smoke check: connecting", slog.String("address", address))

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	dialer := net.Dialer{Timeout: 5 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", address)
	if err != nil {
		return fmt.Errorf("esl smoke check: dial failed: %w", err)
	}
	defer conn.Close()

	reader := bufio.NewReader(conn)
	c := &Client{config: cfg, logger: logger}
	if err := c.authenticate(reader, conn); err != nil {
		return fmt.Errorf("esl smoke check: auth failed: %w", err)
	}

	logger.Info("esl smoke check: authenticated successfully", slog.String("address", address))
	return nil
}
