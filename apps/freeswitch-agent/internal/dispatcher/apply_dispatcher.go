package dispatcher

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
)

// applyRequest is the shape returned by the API pending-poll endpoint.
type applyRequest struct {
	ID            string `json:"id"`
	ActionType    string `json:"action_type"`
	TargetProfile string `json:"target_profile"`
	TargetGateway string `json:"target_gateway"`
	ObjectType    string `json:"object_type"`
	ObjectID      string `json:"object_id"`
}

type applyListResponse struct {
	Data []applyRequest `json:"data"`
}

// allowedApplyActions is the server-side allowlist enforced in the API;
// the agent maintains its own copy as a defense-in-depth measure.
var allowedApplyActions = map[string]bool{
	"reloadxml":              true,
	"sofia_profile_rescan":   true,
	"sofia_profile_killgw":   true,
	"sofia_profile_restartgw": true,
	"sofia_status_gateway":   true,
	"sofia_status_profile":   true,
}

// ESLCommander sends raw ESL commands and returns the reply.
type ESLCommander interface {
	SendAPICommand(ctx context.Context, cmd string) (string, error)
}

// ApplyDispatcher polls the API for pending gateway-apply requests and executes
// the allowlisted ESL commands on behalf of the node.
type ApplyDispatcher struct {
	cfg      config.Config
	commander ESLCommander
	client   *http.Client
	logger   *slog.Logger
}

func NewApplyDispatcher(cfg config.Config, commander ESLCommander, logger *slog.Logger) *ApplyDispatcher {
	return &ApplyDispatcher{
		cfg:      cfg,
		commander: commander,
		client:   &http.Client{Timeout: 15 * time.Second},
		logger:   logger,
	}
}

// Run polls for pending apply requests at the given interval until ctx is cancelled.
func (d *ApplyDispatcher) Run(ctx context.Context, interval time.Duration) {
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

func (d *ApplyDispatcher) poll(ctx context.Context) {
	if d.cfg.NodeID == "" {
		return // node ID not configured — skip polling
	}
	baseURL := strings.TrimRight(d.cfg.APIBaseURL, "/")
	url := fmt.Sprintf("%s/api/v1/runtime/gateway-apply/pending?node_id=%s", baseURL, d.cfg.NodeID)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		d.logger.Warn("apply dispatcher: failed to build poll request", slog.String("error", err.Error()))
		return
	}
	d.setHeaders(req)

	resp, err := d.client.Do(req)
	if err != nil {
		d.logger.Warn("apply dispatcher: poll request failed", slog.String("error", err.Error()))
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		d.logger.Warn("apply dispatcher: unexpected poll status",
			slog.Int("status", resp.StatusCode),
			slog.String("body", string(body)),
		)
		return
	}

	var result applyListResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		d.logger.Warn("apply dispatcher: failed to decode poll response", slog.String("error", err.Error()))
		return
	}

	for _, r := range result.Data {
		d.processRequest(ctx, r)
	}
}

func (d *ApplyDispatcher) processRequest(ctx context.Context, r applyRequest) {
	log := d.logger.With(
		slog.String("apply_request_id", r.ID),
		slog.String("action_type", r.ActionType),
	)

	// Defense-in-depth: validate action type locally before claiming.
	if !allowedApplyActions[r.ActionType] {
		log.Error("apply dispatcher: action type not in local allowlist — skipping")
		_ = d.reportResult(ctx, r.ID, "failed", fmt.Sprintf("action_type not allowed: %s", r.ActionType))
		return
	}

	if err := d.claim(ctx, r.ID); err != nil {
		log.Warn("apply dispatcher: claim failed", slog.String("error", err.Error()))
		return
	}

	log.Info("apply dispatcher: executing ESL command")
	reply, err := d.executeAction(ctx, r)
	if err != nil {
		log.Error("apply dispatcher: ESL command failed", slog.String("error", err.Error()))
		_ = d.reportResult(ctx, r.ID, "failed", err.Error())
		return
	}

	log.Info("apply dispatcher: ESL command succeeded", slog.String("reply", reply))
	_ = d.reportResult(ctx, r.ID, "applied", "")
}

// executeAction maps the allowlisted action_type to the correct ESL command.
// No arbitrary strings from the API body are passed to ESL — only the safe
// formatted commands below are sent.
func (d *ApplyDispatcher) executeAction(ctx context.Context, r applyRequest) (string, error) {
	switch r.ActionType {
	case "reloadxml":
		return d.commander.SendAPICommand(ctx, "reloadxml")

	case "sofia_profile_rescan":
		if r.TargetProfile == "" {
			return "", fmt.Errorf("sofia_profile_rescan requires target_profile")
		}
		return d.commander.SendAPICommand(ctx, fmt.Sprintf("sofia profile %s rescan", r.TargetProfile))

	case "sofia_profile_killgw":
		if r.TargetProfile == "" || r.TargetGateway == "" {
			return "", fmt.Errorf("sofia_profile_killgw requires target_profile and target_gateway")
		}
		return d.commander.SendAPICommand(ctx, fmt.Sprintf("sofia profile %s killgw %s", r.TargetProfile, r.TargetGateway))

	case "sofia_profile_restartgw":
		if r.TargetProfile == "" || r.TargetGateway == "" {
			return "", fmt.Errorf("sofia_profile_restartgw requires target_profile and target_gateway")
		}
		return d.commander.SendAPICommand(ctx, fmt.Sprintf("sofia profile %s restartgw %s", r.TargetProfile, r.TargetGateway))

	case "sofia_status_gateway":
		if r.TargetGateway == "" {
			return "", fmt.Errorf("sofia_status_gateway requires target_gateway")
		}
		return d.commander.SendAPICommand(ctx, fmt.Sprintf("sofia status gateway %s", r.TargetGateway))

	case "sofia_status_profile":
		if r.TargetProfile == "" {
			return "", fmt.Errorf("sofia_status_profile requires target_profile")
		}
		return d.commander.SendAPICommand(ctx, fmt.Sprintf("sofia status profile %s", r.TargetProfile))

	default:
		return "", fmt.Errorf("unhandled action_type: %s", r.ActionType)
	}
}

func (d *ApplyDispatcher) claim(ctx context.Context, id string) error {
	baseURL := strings.TrimRight(d.cfg.APIBaseURL, "/")
	url := fmt.Sprintf("%s/api/v1/runtime/gateway-apply/%s/claim", baseURL, id)
	body, _ := json.Marshal(map[string]string{"node_id": d.cfg.NodeID})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	d.setHeaders(req)

	resp, err := d.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("claim returned %d: %s", resp.StatusCode, string(b))
	}
	return nil
}

func (d *ApplyDispatcher) reportResult(ctx context.Context, id, status, errMsg string) error {
	baseURL := strings.TrimRight(d.cfg.APIBaseURL, "/")
	url := fmt.Sprintf("%s/api/v1/runtime/gateway-apply/%s/result", baseURL, id)

	payload := map[string]interface{}{
		"node_id": d.cfg.NodeID,
		"status":  status,
	}
	if errMsg != "" {
		payload["error_message"] = errMsg
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	d.setHeaders(req)

	resp, err := d.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

func (d *ApplyDispatcher) setHeaders(req *http.Request) {
	if d.cfg.RuntimeToken != "" {
		req.Header.Set("Authorization", "Bearer "+d.cfg.RuntimeToken)
	}
	if d.cfg.TenantID != "" {
		req.Header.Set("X-Tenant-ID", d.cfg.TenantID)
	}
}
