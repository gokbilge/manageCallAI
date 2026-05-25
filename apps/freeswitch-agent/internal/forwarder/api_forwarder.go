package forwarder

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gokbilge/manageCallAI/apps/freeswitch-agent/internal/config"
	"github.com/gokbilge/manageCallAI/apps/freeswitch-agent/internal/events"
)

type APIForwarder struct {
	baseURL string
	client  *http.Client
	logger  *slog.Logger
}

func NewAPIForwarder(cfg config.Config, logger *slog.Logger) *APIForwarder {
	return &APIForwarder{
		baseURL: strings.TrimRight(cfg.APIBaseURL, "/"),
		client: &http.Client{
			Timeout: 5 * time.Second,
		},
		logger: logger,
	}
}

func (f *APIForwarder) ForwardEvent(ctx context.Context, event events.NormalizedEvent) error {
	body, err := json.Marshal(event)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		fmt.Sprintf("%s/api/v1/call-events/internal/ingest", f.baseURL),
		bytes.NewReader(body),
	)
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := f.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		payload, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("api forward failed: status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(payload)))
	}

	f.logger.Debug("forwarded normalized event",
		slog.String("event_type", event.EventType),
		slog.String("call_id", event.CallID),
	)

	return nil
}
