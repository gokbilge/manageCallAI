package dispatcher

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

// mockCommander records every SendAPICommand call.
type mockCommander struct {
	commands []string
	reply    string
	err      error
}

func (m *mockCommander) SendAPICommand(_ context.Context, cmd string) (string, error) {
	m.commands = append(m.commands, cmd)
	if m.err != nil {
		return "", m.err
	}
	return m.reply, nil
}

func newDiscardLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

// ── Allowlist tests ───────────────────────────────────────────────────────────

func TestApplyDispatcher_Allowlist(t *testing.T) {
	tests := []struct {
		action  string
		allowed bool
	}{
		{"reloadxml", true},
		{"sofia_profile_rescan", true},
		{"sofia_profile_killgw", true},
		{"sofia_profile_restartgw", true},
		{"sofia_status_gateway", true},
		{"sofia_status_profile", true},
		{"arbitrary_command", false},
		{"shell_exec", false},
		{"", false},
	}
	for _, tt := range tests {
		got := allowedApplyActions[tt.action]
		if got != tt.allowed {
			t.Errorf("allowedApplyActions[%q] = %v, want %v", tt.action, got, tt.allowed)
		}
	}
}

// ── executeAction tests ───────────────────────────────────────────────────────

func TestApplyDispatcher_ExecuteAction(t *testing.T) {
	tests := []struct {
		name    string
		req     applyRequest
		wantCmd string
		wantErr bool
	}{
		{
			name:    "reloadxml",
			req:     applyRequest{ActionType: "reloadxml"},
			wantCmd: "reloadxml",
		},
		{
			name:    "sofia_profile_rescan",
			req:     applyRequest{ActionType: "sofia_profile_rescan", TargetProfile: "external"},
			wantCmd: "sofia profile external rescan",
		},
		{
			name:    "sofia_profile_rescan_missing_profile",
			req:     applyRequest{ActionType: "sofia_profile_rescan"},
			wantErr: true,
		},
		{
			name:    "sofia_profile_killgw",
			req:     applyRequest{ActionType: "sofia_profile_killgw", TargetProfile: "external", TargetGateway: "trunk-abc"},
			wantCmd: "sofia profile external killgw trunk-abc",
		},
		{
			name:    "sofia_profile_killgw_missing_gateway",
			req:     applyRequest{ActionType: "sofia_profile_killgw", TargetProfile: "external"},
			wantErr: true,
		},
		{
			name:    "sofia_profile_restartgw",
			req:     applyRequest{ActionType: "sofia_profile_restartgw", TargetProfile: "external", TargetGateway: "trunk-xyz"},
			wantCmd: "sofia profile external restartgw trunk-xyz",
		},
		{
			name:    "sofia_status_gateway",
			req:     applyRequest{ActionType: "sofia_status_gateway", TargetGateway: "trunk-def"},
			wantCmd: "sofia status gateway trunk-def",
		},
		{
			name:    "sofia_status_profile",
			req:     applyRequest{ActionType: "sofia_status_profile", TargetProfile: "external"},
			wantCmd: "sofia status profile external",
		},
		{
			name:    "unknown_action",
			req:     applyRequest{ActionType: "rm -rf /"},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mock := &mockCommander{reply: "+OK"}
			d := &ApplyDispatcher{commander: mock, logger: newDiscardLogger()}

			_, err := d.executeAction(context.Background(), tt.req)
			if tt.wantErr {
				if err == nil {
					t.Error("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Errorf("unexpected error: %v", err)
				return
			}
			if len(mock.commands) != 1 || mock.commands[0] != tt.wantCmd {
				t.Errorf("command = %v, want [%q]", mock.commands, tt.wantCmd)
			}
		})
	}
}

// ── Integration-style poll tests ──────────────────────────────────────────────

func TestApplyDispatcher_PollAndExecute(t *testing.T) {
	const nodeID = "node-test-uuid"
	resultCh := make(chan map[string]interface{}, 1)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/api/v1/runtime/gateway-apply/pending":
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"data": []map[string]interface{}{
					{
						"id":             "req-1",
						"action_type":    "reloadxml",
						"target_profile": nil,
						"target_gateway": nil,
						"object_type":    "sip_trunk",
						"object_id":      "trunk-1",
					},
				},
			})
		case r.Method == http.MethodPost && r.URL.Path == "/api/v1/runtime/gateway-apply/req-1/claim":
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"data": map[string]string{"id": "req-1"}})
		case r.Method == http.MethodPost && r.URL.Path == "/api/v1/runtime/gateway-apply/req-1/result":
			var body map[string]interface{}
			_ = json.NewDecoder(r.Body).Decode(&body)
			resultCh <- body
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	mock := &mockCommander{reply: "+OK"}
	cfg := config.Config{APIBaseURL: srv.URL, NodeID: nodeID, RuntimeToken: "test-token"}
	d := NewApplyDispatcher(cfg, mock, newDiscardLogger())

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	d.poll(ctx)

	select {
	case result := <-resultCh:
		if result["status"] != "applied" {
			t.Errorf("status = %v, want applied", result["status"])
		}
		if len(mock.commands) != 1 || mock.commands[0] != "reloadxml" {
			t.Errorf("commands = %v, want [reloadxml]", mock.commands)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for result callback")
	}
}

func TestApplyDispatcher_RejectsDisallowedAction(t *testing.T) {
	resultCh := make(chan map[string]interface{}, 1)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == http.MethodGet:
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"data": []map[string]interface{}{
					{"id": "req-bad", "action_type": "rm -rf /", "object_type": "sip_trunk", "object_id": "trunk-1"},
				},
			})
		case r.Method == http.MethodPost && r.URL.Path == "/api/v1/runtime/gateway-apply/req-bad/result":
			var body map[string]interface{}
			_ = json.NewDecoder(r.Body).Decode(&body)
			resultCh <- body
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	mock := &mockCommander{reply: "+OK"}
	cfg := config.Config{APIBaseURL: srv.URL, NodeID: "node-1", RuntimeToken: "test"}
	d := NewApplyDispatcher(cfg, mock, newDiscardLogger())

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	d.poll(ctx)

	select {
	case result := <-resultCh:
		if result["status"] != "failed" {
			t.Errorf("disallowed action should report failed, got %v", result["status"])
		}
		if len(mock.commands) != 0 {
			t.Errorf("no ESL command should be sent for disallowed action, got: %v", mock.commands)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out — result not reported")
	}
}

func TestApplyDispatcher_SkipsWhenNodeIDEmpty(t *testing.T) {
	called := false
	srv := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		called = true
	}))
	defer srv.Close()

	mock := &mockCommander{}
	cfg := config.Config{APIBaseURL: srv.URL, NodeID: "", RuntimeToken: "test"}
	d := NewApplyDispatcher(cfg, mock, newDiscardLogger())
	d.poll(context.Background())

	if called {
		t.Error("poll should not make HTTP requests when NodeID is empty")
	}
}
