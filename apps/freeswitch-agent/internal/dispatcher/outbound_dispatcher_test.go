package dispatcher

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gokbilge/manageCallAI/apps/freeswitch-agent/internal/config"
	"log/slog"
	"io"
)

type mockDialer struct {
	callCount int
	lastDial  string
	failWith  error
}

func (m *mockDialer) Originate(_ context.Context, dialNumber, _, _ string) error {
	m.callCount++
	m.lastDial = dialNumber
	return m.failWith
}

func newTestDispatcher(baseURL string, dialer ESLDialer) *OutboundDispatcher {
	return NewOutboundDispatcher(
		config.Config{APIBaseURL: baseURL, RuntimeToken: "tok"},
		dialer,
		slog.New(slog.NewTextHandler(io.Discard, nil)),
	)
}

func TestPollDispatchesEachPendingRequest(t *testing.T) {
	claimCalled := 0
	dialer := &mockDialer{}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/v1/runtime/outbound/pending" {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(listResponse{
				Data: []outboundRequest{
					{ID: "req-1", DialNumber: "+905551234567", ExtensionID: "ext-1"},
				},
			})
			return
		}
		if r.URL.Path == "/api/v1/runtime/outbound/req-1/claim" {
			claimCalled++
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]string{"status": "dispatched"})
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	d := newTestDispatcher(server.URL, dialer)
	d.poll(context.Background())

	if claimCalled != 1 {
		t.Errorf("expected 1 claim call, got %d", claimCalled)
	}
	if dialer.callCount != 1 {
		t.Errorf("expected 1 originate call, got %d", dialer.callCount)
	}
	if dialer.lastDial != "+905551234567" {
		t.Errorf("expected dial to +905551234567, got %q", dialer.lastDial)
	}
}

func TestPollReportsFailureWhenOriginateFails(t *testing.T) {
	statusReported := ""
	dialer := &mockDialer{failWith: errors.New("ESL connection refused")}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v1/runtime/outbound/pending":
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(listResponse{
				Data: []outboundRequest{{ID: "req-2", DialNumber: "+901111111111"}},
			})
		case "/api/v1/runtime/outbound/req-2/claim":
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]string{"status": "dispatched"})
		case "/api/v1/runtime/outbound/req-2/status":
			body, _ := io.ReadAll(r.Body)
			var m map[string]string
			_ = json.Unmarshal(body, &m)
			statusReported = m["status"]
			w.WriteHeader(http.StatusOK)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	d := newTestDispatcher(server.URL, dialer)
	d.poll(context.Background())

	if statusReported != "failed" {
		t.Errorf("expected status=failed reported, got %q", statusReported)
	}
}

func TestPollSkipsWhenClaimFails(t *testing.T) {
	dialer := &mockDialer{}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/v1/runtime/outbound/pending" {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(listResponse{
				Data: []outboundRequest{{ID: "req-3", DialNumber: "+901234567890"}},
			})
			return
		}
		w.WriteHeader(http.StatusConflict)
	}))
	defer server.Close()

	d := newTestDispatcher(server.URL, dialer)
	d.poll(context.Background())

	if dialer.callCount != 0 {
		t.Errorf("expected 0 originate calls when claim fails, got %d", dialer.callCount)
	}
}

func TestPollHandlesEmptyPendingList(t *testing.T) {
	dialer := &mockDialer{}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(listResponse{Data: []outboundRequest{}})
	}))
	defer server.Close()

	d := newTestDispatcher(server.URL, dialer)
	d.poll(context.Background())

	if dialer.callCount != 0 {
		t.Errorf("expected 0 originate calls for empty list, got %d", dialer.callCount)
	}
}

func TestPollSetsAuthorizationHeader(t *testing.T) {
	var gotAuth string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(listResponse{Data: []outboundRequest{}})
	}))
	defer server.Close()

	d := newTestDispatcher(server.URL, &mockDialer{})
	d.poll(context.Background())

	if gotAuth != "Bearer tok" {
		t.Errorf("expected Bearer tok, got %q", gotAuth)
	}
}
