package status

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gokbilge/manageCallAI/apps/freeswitch-agent/internal/config"
)

type mockCommander struct {
	responses map[string]string
}

func (m *mockCommander) SendAPICommand(_ context.Context, cmd string) (string, error) {
	if r, ok := m.responses[cmd]; ok {
		return r, nil
	}
	return "", nil
}

func newMockCommander() *mockCommander {
	return &mockCommander{
		responses: map[string]string{
			"version": "FreeSWITCH Version 1.10.11 (release branch)",
			"show modules": `
Name                    Key             Status      Type        Filename
mod_sofia               N/A             Running     endpoint    /usr/lib/freeswitch/mod/mod_sofia.so
mod_event_socket        N/A             Running     application /usr/lib/freeswitch/mod/mod_event_socket.so
mod_xml_curl            N/A             Running     xml_int     /usr/lib/freeswitch/mod/mod_xml_curl.so
mod_lua                 N/A             Running     application /usr/lib/freeswitch/mod/mod_lua.so
mod_dptools             N/A             Running     dialplan    /usr/lib/freeswitch/mod/mod_dptools.so
2 records.`,
			"sofia status": `
                     Name	Type	Data	State
=================================================================================================
                 internal	profile	sip:mod_sofia@192.168.1.1:5060	RUNNING (0)
                 external	profile	sip:mod_sofia@192.168.1.1:5080	RUNNING (0)
             trunk-abc-123	gateway	sip:provider.example.com	REGED
=================================================================================================
2 profiles 1 alias 1 gateways.`,
			"show channels count": "2 total.",
			"show registrations count": "5 total.",
		},
	}
}

func TestStatusReporter_BuildSnapshot(t *testing.T) {
	cfg := config.Config{
		NodeID:     "node-uuid-1",
		APIBaseURL: "http://api:3000",
	}
	r := NewStatusReporter(cfg, newMockCommander(), slog.New(slog.NewTextHandler(io.Discard, nil)))
	snap := r.buildSnapshot(context.Background())

	if snap.NodeID != "node-uuid-1" {
		t.Errorf("NodeID: got %q, want node-uuid-1", snap.NodeID)
	}
	if snap.FreeSwitchVersion == "" {
		t.Error("expected non-empty FreeSwitchVersion")
	}
	if len(snap.LoadedModules) == 0 {
		t.Error("expected at least one loaded module")
	}
	if len(snap.MissingRequiredModules) > 0 {
		t.Errorf("unexpected missing modules: %v", snap.MissingRequiredModules)
	}
	if len(snap.SofiaProfiles) == 0 {
		t.Error("expected at least one sofia profile")
	}
	if len(snap.GatewayStatuses) == 0 {
		t.Error("expected at least one gateway status")
	}
	if snap.ActiveChannelCount == nil || *snap.ActiveChannelCount != 2 {
		t.Errorf("active_channel_count: got %v, want 2", snap.ActiveChannelCount)
	}
	if snap.ActiveRegistrationCount == nil || *snap.ActiveRegistrationCount != 5 {
		t.Errorf("active_registration_count: got %v, want 5", snap.ActiveRegistrationCount)
	}
}

func TestStatusReporter_Push(t *testing.T) {
	var received snapshotPayload
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &received)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	cfg := config.Config{NodeID: "node-1", APIBaseURL: srv.URL, RuntimeToken: "tok"}
	reporter := NewStatusReporter(cfg, newMockCommander(), slog.New(slog.NewTextHandler(io.Discard, nil)))
	snap := reporter.buildSnapshot(context.Background())
	err := reporter.push(context.Background(), snap)
	if err != nil {
		t.Fatalf("push failed: %v", err)
	}
	if received.NodeID != "node-1" {
		t.Errorf("pushed node_id: got %q, want node-1", received.NodeID)
	}
}

func TestStatusReporter_SkipsWhenNodeIDEmpty(t *testing.T) {
	called := false
	srv := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		called = true
	}))
	defer srv.Close()

	cfg := config.Config{NodeID: "", APIBaseURL: srv.URL}
	reporter := NewStatusReporter(cfg, newMockCommander(), slog.New(slog.NewTextHandler(io.Discard, nil)))

	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()
	reporter.Run(ctx, 50*time.Millisecond)

	if called {
		t.Error("should not push when NodeID is empty")
	}
}

func TestParseModuleNames(t *testing.T) {
	input := `mod_sofia   N/A   Running   endpoint
mod_dptools N/A   Running   dialplan
2 records.`
	names := parseModuleNames(input)
	if len(names) < 2 {
		t.Errorf("expected at least 2 modules, got %v", names)
	}
}

func TestFindMissingModules(t *testing.T) {
	loaded := []string{"mod_sofia", "mod_dptools"}
	required := []string{"mod_sofia", "mod_dptools", "mod_lua"}
	missing := findMissingModules(loaded, required)
	if len(missing) != 1 || missing[0] != "mod_lua" {
		t.Errorf("expected [mod_lua], got %v", missing)
	}
}

func TestParseCount(t *testing.T) {
	n, err := parseCount("3 total.")
	if err != nil || n != 3 {
		t.Errorf("parseCount: got %d/%v, want 3/nil", n, err)
	}
	_, err = parseCount("")
	if err == nil {
		t.Error("expected error for empty input")
	}
}
