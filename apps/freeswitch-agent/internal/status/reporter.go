// Package status polls FreeSWITCH for read-only status information and
// pushes snapshots to the API. Only safe ESL read commands are used.
package status

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gokbilge/manageCallAI/apps/freeswitch-agent/internal/config"
)

// ESLReadCommander sends safe read-only ESL API commands.
type ESLReadCommander interface {
	SendAPICommand(ctx context.Context, cmd string) (string, error)
}

// StatusReporter polls FreeSWITCH and pushes snapshots to the API.
type StatusReporter struct {
	cfg      config.Config
	commander ESLReadCommander
	client   *http.Client
	logger   *slog.Logger
}

// NewStatusReporter creates a StatusReporter. The nodeID must be set in cfg.NodeID.
func NewStatusReporter(cfg config.Config, commander ESLReadCommander, logger *slog.Logger) *StatusReporter {
	return &StatusReporter{
		cfg:      cfg,
		commander: commander,
		client:   &http.Client{Timeout: 20 * time.Second},
		logger:   logger,
	}
}

// Run polls FreeSWITCH status at the given interval and pushes to the API until ctx is cancelled.
func (r *StatusReporter) Run(ctx context.Context, interval time.Duration) {
	if r.cfg.NodeID == "" {
		r.logger.Warn("status reporter: NodeID not set — skipping status push")
		return
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			r.collect(ctx)
		}
	}
}

func (r *StatusReporter) collect(ctx context.Context) {
	snapshot := r.buildSnapshot(ctx)
	if err := r.push(ctx, snapshot); err != nil {
		r.logger.Warn("status reporter: push failed", slog.String("error", err.Error()))
	}
}

type snapshotPayload struct {
	NodeID                    string                    `json:"node_id"`
	FreeSwitchVersion         string                    `json:"freeswitch_version,omitempty"`
	LoadedModules             []string                  `json:"loaded_modules"`
	MissingRequiredModules    []string                  `json:"missing_required_modules"`
	SofiaProfiles             map[string]profileStatus  `json:"sofia_profiles"`
	GatewayStatuses           map[string]gatewayStatus  `json:"gateway_statuses"`
	ActiveChannelCount        *int                      `json:"active_channel_count,omitempty"`
	ActiveRegistrationCount   *int                      `json:"active_registration_count,omitempty"`
}

type profileStatus struct {
	State string `json:"state"`
}

type gatewayStatus struct {
	State  string `json:"state"`
	PingMs *int   `json:"ping_ms,omitempty"`
}

var requiredModules = []string{
	"mod_sofia",
	"mod_event_socket",
	"mod_xml_curl",
	"mod_lua",
	"mod_dptools",
}

func (r *StatusReporter) buildSnapshot(ctx context.Context) snapshotPayload {
	snap := snapshotPayload{
		NodeID:          r.cfg.NodeID,
		LoadedModules:   []string{},
		MissingRequiredModules: []string{},
		SofiaProfiles:   map[string]profileStatus{},
		GatewayStatuses: map[string]gatewayStatus{},
	}

	// FreeSWITCH version
	if ver, err := r.commander.SendAPICommand(ctx, "version"); err == nil {
		snap.FreeSwitchVersion = strings.TrimSpace(ver)
	}

	// Loaded modules
	if modReply, err := r.commander.SendAPICommand(ctx, "show modules"); err == nil {
		snap.LoadedModules = parseModuleNames(modReply)
		snap.MissingRequiredModules = findMissingModules(snap.LoadedModules, requiredModules)
	}

	// Sofia status (profiles + gateways)
	if sofiaReply, err := r.commander.SendAPICommand(ctx, "sofia status"); err == nil {
		snap.SofiaProfiles, snap.GatewayStatuses = parseSofiaStatus(sofiaReply)
	}

	// Active channel count
	if chanReply, err := r.commander.SendAPICommand(ctx, "show channels count"); err == nil {
		if n, err := parseCount(chanReply); err == nil {
			snap.ActiveChannelCount = &n
		}
	}

	// Active registration count
	if regReply, err := r.commander.SendAPICommand(ctx, "show registrations count"); err == nil {
		if n, err := parseCount(regReply); err == nil {
			snap.ActiveRegistrationCount = &n
		}
	}

	return snap
}

func (r *StatusReporter) push(ctx context.Context, snap snapshotPayload) error {
	baseURL := strings.TrimRight(r.cfg.APIBaseURL, "/")
	url := fmt.Sprintf("%s/api/v1/platform/nodes/%s/status-snapshot", baseURL, snap.NodeID)

	body, err := json.Marshal(snap)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if r.cfg.RuntimeToken != "" {
		req.Header.Set("Authorization", "Bearer "+r.cfg.RuntimeToken)
	}

	resp, err := r.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)

	if resp.StatusCode >= 300 {
		return fmt.Errorf("status push returned %d", resp.StatusCode)
	}

	r.logger.Debug("status reporter: snapshot pushed",
		slog.String("node_id", snap.NodeID),
		slog.Int("loaded_modules", len(snap.LoadedModules)),
	)
	return nil
}

// parseModuleNames extracts module names from the `show modules` ESL reply.
// The reply is a text table with lines like: "  mod_sofia  ..."
func parseModuleNames(reply string) []string {
	var modules []string
	seen := make(map[string]bool)
	for _, line := range strings.Split(reply, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "mod_") {
			name := strings.Fields(trimmed)[0]
			if !seen[name] {
				seen[name] = true
				modules = append(modules, name)
			}
		}
	}
	return modules
}

// findMissingModules returns required modules that are not in loaded.
func findMissingModules(loaded, required []string) []string {
	loadedSet := make(map[string]bool, len(loaded))
	for _, m := range loaded {
		loadedSet[m] = true
	}
	var missing []string
	for _, r := range required {
		if !loadedSet[r] {
			missing = append(missing, r)
		}
	}
	if missing == nil {
		return []string{}
	}
	return missing
}

func parseSofiaStatus(reply string) (map[string]profileStatus, map[string]gatewayStatus) {
	profiles := map[string]profileStatus{}
	gateways := map[string]gatewayStatus{}

	for _, line := range strings.Split(reply, "\n") {
		trimmed := strings.TrimSpace(line)
		// Skip headers, separators, empty lines, and summary lines.
		if trimmed == "" || strings.HasPrefix(trimmed, "=") ||
			strings.HasPrefix(trimmed, "Name") || strings.HasPrefix(trimmed, "Total") {
			continue
		}

		// FreeSWITCH sofia status rows are tab-separated: name\ttype\tdata\tstate
		cols := strings.Split(trimmed, "\t")
		if len(cols) < 4 {
			continue
		}

		name := strings.TrimSpace(cols[0])
		typeField := strings.TrimSpace(cols[1])
		// State is in the last column; may include "(count)" suffix.
		rawState := strings.TrimSpace(cols[len(cols)-1])
		stateParts := strings.Fields(rawState)
		if len(stateParts) == 0 {
			continue
		}
		state := stateParts[0]

		switch typeField {
		case "profile":
			profiles[name] = profileStatus{State: state}
		case "gateway":
			gateways[name] = gatewayStatus{State: state}
		}
	}

	return profiles, gateways
}

// parseCount extracts a count integer from replies like "1 total." or "0 total."
func parseCount(reply string) (int, error) {
	trimmed := strings.TrimSpace(reply)
	fields := strings.Fields(trimmed)
	if len(fields) == 0 {
		return 0, fmt.Errorf("empty reply")
	}
	return strconv.Atoi(fields[0])
}
