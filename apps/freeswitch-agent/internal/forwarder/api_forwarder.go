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
	baseURL      string
	runtimeToken string
	tenantID     string
	client       *http.Client
	logger       *slog.Logger
}

func NewAPIForwarder(cfg config.Config, logger *slog.Logger) *APIForwarder {
	return &APIForwarder{
		baseURL:      strings.TrimRight(cfg.APIBaseURL, "/"),
		runtimeToken: strings.TrimSpace(cfg.RuntimeToken),
		tenantID:     strings.TrimSpace(cfg.TenantID),
		client: &http.Client{
			Timeout: 5 * time.Second,
		},
		logger: logger,
	}
}

// endpointFor returns the API endpoint for the given event type.
// Parking events route to the runtime parking callback; all others go to call-events.
func (f *APIForwarder) endpointFor(eventType string) string {
	switch eventType {
	case "channel_park":
		return fmt.Sprintf("%s/api/v1/runtime/parking/park", f.baseURL)
	case "channel_unpark":
		return fmt.Sprintf("%s/api/v1/runtime/parking/retrieve", f.baseURL)
	default:
		return fmt.Sprintf("%s/api/v1/call-events/internal/ingest", f.baseURL)
	}
}

// parkPayload builds the parking endpoint request body from a CHANNEL_PARK event.
func parkPayload(event events.NormalizedEvent) map[string]interface{} {
	payload := event.Payload
	slot := 0
	if v, ok := payload["variable_valet_extension"].(string); ok {
		_, _ = fmt.Sscan(v, &slot)
	}
	parkedBy := ""
	if v, ok := payload["Caller-Caller-ID-Number"].(string); ok {
		parkedBy = v
	}
	result := map[string]interface{}{
		"tenant_id": event.TenantID,
		"call_id":   event.CallID,
		"slot":      slot,
	}
	if parkedBy != "" {
		result["parked_by"] = parkedBy
	}
	return result
}

// retrievePayload builds the parking retrieve request body from a CHANNEL_UNPARK event.
func retrievePayload(event events.NormalizedEvent) map[string]interface{} {
	payload := event.Payload
	slot := 0
	if v, ok := payload["variable_valet_extension"].(string); ok {
		_, _ = fmt.Sscan(v, &slot)
	}
	return map[string]interface{}{
		"tenant_id": event.TenantID,
		"slot":      slot,
	}
}

func (f *APIForwarder) ForwardEvent(ctx context.Context, event events.NormalizedEvent) error {
	var bodyBytes []byte
	var err error

	switch event.EventType {
	case "channel_park":
		bodyBytes, err = json.Marshal(parkPayload(event))
	case "channel_unpark":
		bodyBytes, err = json.Marshal(retrievePayload(event))
	default:
		bodyBytes, err = json.Marshal(event)
	}
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		f.endpointFor(event.EventType),
		bytes.NewReader(bodyBytes),
	)
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	if f.runtimeToken != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", f.runtimeToken))
	}
	if tenantID := firstNonEmpty(event.TenantID, f.tenantID); tenantID != "" {
		req.Header.Set("X-Tenant-ID", tenantID)
	}

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

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
