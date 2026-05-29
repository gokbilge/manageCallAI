package dispatcher

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gokbilge/manageCallAI/apps/freeswitch-agent/internal/config"
)

type outboundRequest struct {
	ID          string `json:"id"`
	TenantID    string `json:"tenant_id"`
	ExtensionID string `json:"extension_id"`
	DialNumber  string `json:"dial_number"`
	SIPTrunkID  string `json:"sip_trunk_id"`
	Status      string `json:"status"`
}

type listResponse struct {
	Data []outboundRequest `json:"data"`
}

// ESLDialer sends originate commands over ESL.
type ESLDialer interface {
	Originate(ctx context.Context, dialNumber, extensionID, trunkID string) error
}

// OutboundDispatcher polls the API for pending outbound call requests and dispatches them.
type OutboundDispatcher struct {
	cfg    config.Config
	dialer ESLDialer
	client *http.Client
	logger *slog.Logger
}

func NewOutboundDispatcher(cfg config.Config, dialer ESLDialer, logger *slog.Logger) *OutboundDispatcher {
	return &OutboundDispatcher{
		cfg:    cfg,
		dialer: dialer,
		client: &http.Client{Timeout: 10 * time.Second},
		logger: logger,
	}
}

// Run polls for pending requests at the given interval until ctx is cancelled.
func (d *OutboundDispatcher) Run(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			d.poll(ctx)
		}
	}
}

func (d *OutboundDispatcher) poll(ctx context.Context) {
	baseURL := strings.TrimRight(d.cfg.APIBaseURL, "/")
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"/api/v1/runtime/outbound/pending", nil)
	if err != nil {
		d.logger.Warn("outbound dispatcher: failed to build request", slog.String("error", err.Error()))
		return
	}
	if d.cfg.RuntimeToken != "" {
		req.Header.Set("Authorization", "Bearer "+d.cfg.RuntimeToken)
	}
	if d.cfg.TenantID != "" {
		req.Header.Set("X-Tenant-ID", d.cfg.TenantID)
	}

	resp, err := d.client.Do(req)
	if err != nil {
		d.logger.Warn("outbound dispatcher: poll failed", slog.String("error", err.Error()))
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		d.logger.Warn("outbound dispatcher: unexpected status",
			slog.Int("status", resp.StatusCode),
			slog.String("body", string(body)),
		)
		return
	}

	var result listResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		d.logger.Warn("outbound dispatcher: failed to decode response", slog.String("error", err.Error()))
		return
	}

	for _, r := range result.Data {
		d.dispatch(ctx, r)
	}
}

func (d *OutboundDispatcher) dispatch(ctx context.Context, r outboundRequest) {
	if err := d.claim(ctx, r.ID); err != nil {
		d.logger.Warn("outbound dispatcher: claim failed", slog.String("id", r.ID), slog.String("error", err.Error()))
		return
	}

	err := d.dialer.Originate(ctx, r.DialNumber, r.ExtensionID, r.SIPTrunkID)
	if err != nil {
		d.logger.Error("outbound dispatcher: originate failed",
			slog.String("id", r.ID),
			slog.String("dial_number", r.DialNumber),
			slog.String("error", err.Error()),
		)
		_ = d.reportStatus(ctx, r.ID, "failed", err.Error())
		return
	}

	d.logger.Info("outbound dispatcher: dispatched",
		slog.String("id", r.ID),
		slog.String("dial_number", r.DialNumber),
	)
}

func (d *OutboundDispatcher) claim(ctx context.Context, id string) error {
	baseURL := strings.TrimRight(d.cfg.APIBaseURL, "/")
	url := fmt.Sprintf("%s/api/v1/runtime/outbound/%s/claim", baseURL, id)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, nil)
	if err != nil {
		return err
	}
	if d.cfg.RuntimeToken != "" {
		req.Header.Set("Authorization", "Bearer "+d.cfg.RuntimeToken)
	}
	resp, err := d.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("claim returned %d: %s", resp.StatusCode, string(body))
	}
	return nil
}

func (d *OutboundDispatcher) reportStatus(ctx context.Context, id, status, reason string) error {
	baseURL := strings.TrimRight(d.cfg.APIBaseURL, "/")
	url := fmt.Sprintf("%s/api/v1/runtime/outbound/%s/status", baseURL, id)
	body, _ := json.Marshal(map[string]string{"status": status, "failure_reason": reason})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, strings.NewReader(string(body)))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if d.cfg.RuntimeToken != "" {
		req.Header.Set("Authorization", "Bearer "+d.cfg.RuntimeToken)
	}
	resp, err := d.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}
