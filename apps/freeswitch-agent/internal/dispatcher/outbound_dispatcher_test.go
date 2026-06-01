package dispatcher

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gokbilge/manageCallAI/apps/freeswitch-agent/internal/config"
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
		config.Config{APIBaseURL: baseURL, RuntimeToken: "tok", TenantID: "tenant-1"},
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

func TestPollSetsTenantHeader(t *testing.T) {
	var gotTenant string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotTenant = r.Header.Get("X-Tenant-ID")
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(listResponse{Data: []outboundRequest{}})
	}))
	defer server.Close()

	d := newTestDispatcher(server.URL, &mockDialer{})
	d.poll(context.Background())

	if gotTenant != "tenant-1" {
		t.Errorf("expected tenant-1, got %q", gotTenant)
	}
}

func TestPollRejectsUnsafeDialNumber(t *testing.T) {
	statusReported := ""
	claimCalled := false

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v1/runtime/outbound/pending":
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(listResponse{
				Data: []outboundRequest{{ID: "req-bad", DialNumber: "+90555;bgapi"}},
			})
		case "/api/v1/runtime/outbound/req-bad/claim":
			claimCalled = true
			w.WriteHeader(http.StatusOK)
		case "/api/v1/runtime/outbound/req-bad/status":
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

	dialer := &mockDialer{}
	d := newTestDispatcher(server.URL, dialer)
	d.poll(context.Background())

	if dialer.callCount != 0 {
		t.Errorf("expected unsafe dial number to skip originate, got %d calls", dialer.callCount)
	}
	if claimCalled {
		t.Fatal("unsafe dial number should not be claimed")
	}
	if statusReported != "failed" {
		t.Errorf("expected failed status report, got %q", statusReported)
	}
}

func TestIsSafeDialNumber(t *testing.T) {
	cases := []struct {
		number string
		want   bool
	}{
		{"+905551234567", true},
		{"+12025551234", true},
		{"905551234567", false},
		{"+9", false},
		{"+90;bgapi", false},
		{"", false},
		{"+1234567", false},
	}
	for _, tc := range cases {
		got := isSafeDialNumber(tc.number)
		if got != tc.want {
			t.Errorf("isSafeDialNumber(%q) = %v, want %v", tc.number, got, tc.want)
		}
	}
}

func TestPollHandlesNetworkError(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	addr := ln.Addr().String()
	ln.Close()

	dialer := &mockDialer{}
	d := newTestDispatcher("http://"+addr, dialer)
	d.poll(context.Background())
	if dialer.callCount != 0 {
		t.Errorf("expected 0 originate calls on network error, got %d", dialer.callCount)
	}
}

func TestPollHandlesNon200WithBodyLogged(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":"internal"}`))
	}))
	defer server.Close()

	dialer := &mockDialer{}
	d := newTestDispatcher(server.URL, dialer)
	d.poll(context.Background())
	if dialer.callCount != 0 {
		t.Errorf("expected 0 originate calls on non-200 response, got %d", dialer.callCount)
	}
}

func TestPollHandlesInvalidJSONResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`not-valid-json`))
	}))
	defer server.Close()

	dialer := &mockDialer{}
	d := newTestDispatcher(server.URL, dialer)
	d.poll(context.Background())
	if dialer.callCount != 0 {
		t.Errorf("expected 0 originate calls on invalid JSON, got %d", dialer.callCount)
	}
}

func TestRunExitsOnContextCancel(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(listResponse{Data: []outboundRequest{}})
	}))
	defer server.Close()

	d := newTestDispatcher(server.URL, &mockDialer{})
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		d.Run(ctx, 50*time.Millisecond)
		close(done)
	}()

	time.Sleep(80 * time.Millisecond)
	cancel()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Run did not exit after context cancellation")
	}
}

