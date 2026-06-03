package forwarder

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gokbilge/manageCallAI/apps/freeswitch-agent/internal/config"
	"github.com/gokbilge/manageCallAI/apps/freeswitch-agent/internal/events"
)

func newTestForwarder(baseURL, token string) *APIForwarder {
	return NewAPIForwarder(
		config.Config{APIBaseURL: baseURL, RuntimeToken: token, TenantID: "configured-tenant"},
		slog.New(slog.NewTextHandler(io.Discard, nil)),
	)
}

func testEvent() events.NormalizedEvent {
	return events.NormalizedEvent{
		TenantID:  "tenant-1",
		CallID:    "call-uuid-1",
		EventType: "channel_answer",
		Source:    "freeswitch-esl",
		Payload:   map[string]interface{}{"Event-Name": "CHANNEL_ANSWER"},
	}
}

func TestForwardEventSuccess(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	err := newTestForwarder(server.URL, "tok").ForwardEvent(context.Background(), testEvent())
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

func TestForwardEventSetsAuthorizationHeader(t *testing.T) {
	var gotAuth string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	_ = newTestForwarder(server.URL, "my-secret-token").ForwardEvent(context.Background(), testEvent())

	if gotAuth != "Bearer my-secret-token" {
		t.Errorf("Authorization: got %q, want %q", gotAuth, "Bearer my-secret-token")
	}
}

func TestForwardEventSetsTenantHeaderFromEvent(t *testing.T) {
	var gotTenant string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotTenant = r.Header.Get("X-Tenant-ID")
		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	_ = newTestForwarder(server.URL, "tok").ForwardEvent(context.Background(), testEvent())

	if gotTenant != "tenant-1" {
		t.Errorf("X-Tenant-ID: got %q, want tenant-1", gotTenant)
	}
}

func TestForwardEventNoAuthHeaderWhenTokenEmpty(t *testing.T) {
	var gotAuth string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	_ = newTestForwarder(server.URL, "").ForwardEvent(context.Background(), testEvent())

	if gotAuth != "" {
		t.Errorf("expected no Authorization header, got %q", gotAuth)
	}
}

func TestForwardEventUsesPostMethod(t *testing.T) {
	var gotMethod string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	_ = newTestForwarder(server.URL, "").ForwardEvent(context.Background(), testEvent())

	if gotMethod != http.MethodPost {
		t.Errorf("expected POST, got %q", gotMethod)
	}
}

func TestForwardEventUsesCorrectPath(t *testing.T) {
	var gotPath string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	_ = newTestForwarder(server.URL, "").ForwardEvent(context.Background(), testEvent())

	const want = "/api/v1/call-events/internal/ingest"
	if gotPath != want {
		t.Errorf("path: got %q, want %q", gotPath, want)
	}
}

func TestForwardEventSendsJSONBody(t *testing.T) {
	var gotBody []byte
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotBody, _ = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	ev := testEvent()
	_ = newTestForwarder(server.URL, "").ForwardEvent(context.Background(), ev)

	var decoded events.NormalizedEvent
	if err := json.Unmarshal(gotBody, &decoded); err != nil {
		t.Fatalf("body is not valid JSON: %v", err)
	}
	if decoded.CallID != ev.CallID {
		t.Errorf("CallID in body: got %q, want %q", decoded.CallID, ev.CallID)
	}
	if decoded.EventType != ev.EventType {
		t.Errorf("EventType in body: got %q, want %q", decoded.EventType, ev.EventType)
	}
}

func TestForwardEventErrorOnNonSuccessStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":"internal error"}`))
	}))
	defer server.Close()

	err := newTestForwarder(server.URL, "").ForwardEvent(context.Background(), testEvent())
	if err == nil {
		t.Fatal("expected error for 5xx response, got nil")
	}
	if !strings.Contains(err.Error(), "500") {
		t.Errorf("error should mention status code, got: %v", err)
	}
}

func TestForwardEventErrorOn4xxStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":"unauthorized"}`))
	}))
	defer server.Close()

	err := newTestForwarder(server.URL, "").ForwardEvent(context.Background(), testEvent())
	if err == nil {
		t.Fatal("expected error for 401 response, got nil")
	}
	if !strings.Contains(err.Error(), "401") {
		t.Errorf("error should mention status code, got: %v", err)
	}
}

func TestForwardEventTrailingSlashStripped(t *testing.T) {
	var gotPath string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	_ = newTestForwarder(server.URL+"/", "").ForwardEvent(context.Background(), testEvent())

	const want = "/api/v1/call-events/internal/ingest"
	if gotPath != want {
		t.Errorf("path with trailing slash in base URL: got %q, want %q", gotPath, want)
	}
}

func TestForwardEvent2xxVariantsSucceed(t *testing.T) {
	for _, status := range []int{http.StatusOK, http.StatusCreated, http.StatusAccepted} {
		code := status
		t.Run(http.StatusText(code), func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(code)
			}))
			defer server.Close()

			err := newTestForwarder(server.URL, "tok").ForwardEvent(context.Background(), testEvent())
			if err != nil {
				t.Fatalf("status %d should succeed, got error: %v", code, err)
			}
		})
	}
}

func TestForwardEventFallsBackToConfigTenantIDWhenEventTenantEmpty(t *testing.T) {
	var gotTenant string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotTenant = r.Header.Get("X-Tenant-ID")
		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	eventWithNoTenant := events.NormalizedEvent{
		TenantID:  "",
		CallID:    "call-1",
		EventType: "channel_create",
		Source:    "freeswitch-esl",
		Payload:   map[string]interface{}{},
	}

	_ = newTestForwarder(server.URL, "tok").ForwardEvent(context.Background(), eventWithNoTenant)

	if gotTenant != "configured-tenant" {
		t.Errorf("X-Tenant-ID: expected config fallback %q, got %q", "configured-tenant", gotTenant)
	}
}

func TestForwardEventContextCancellationReturnsError(t *testing.T) {
	// Server that blocks indefinitely to simulate a slow backend
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
	}))
	defer server.Close()

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately

	err := newTestForwarder(server.URL, "tok").ForwardEvent(ctx, testEvent())
	if err == nil {
		t.Fatal("expected error when context is already cancelled")
	}
}

func TestForwardEvent_ParkRouted(t *testing.T) {
	var gotPath string
	var gotBody []byte
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotBody, _ = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusCreated)
	}))
	defer srv.Close()

	parkEvent := events.NormalizedEvent{
		TenantID:  "tenant-1",
		CallID:    "call-park",
		EventType: "channel_park",
		Source:    "freeswitch-esl",
		Payload:   map[string]interface{}{"variable_valet_extension": "801"},
	}

	err := newTestForwarder(srv.URL, "tok").ForwardEvent(context.Background(), parkEvent)
	if err != nil {
		t.Fatalf("expected no error: %v", err)
	}
	if gotPath != "/api/v1/runtime/parking/park" {
		t.Errorf("path: got %q, want /api/v1/runtime/parking/park", gotPath)
	}
	var body map[string]interface{}
	if err := json.Unmarshal(gotBody, &body); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if body["tenant_id"] != "tenant-1" {
		t.Errorf("tenant_id: got %v, want tenant-1", body["tenant_id"])
	}
	if body["call_id"] != "call-park" {
		t.Errorf("call_id: got %v, want call-park", body["call_id"])
	}
}

func TestForwardEvent_UnparkRouted(t *testing.T) {
	var gotPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	unparkEvent := events.NormalizedEvent{
		TenantID:  "tenant-1",
		CallID:    "call-unpark",
		EventType: "channel_unpark",
		Source:    "freeswitch-esl",
		Payload:   map[string]interface{}{"variable_valet_extension": "801"},
	}

	err := newTestForwarder(srv.URL, "tok").ForwardEvent(context.Background(), unparkEvent)
	if err != nil {
		t.Fatalf("expected no error: %v", err)
	}
	if gotPath != "/api/v1/runtime/parking/retrieve" {
		t.Errorf("path: got %q, want /api/v1/runtime/parking/retrieve", gotPath)
	}
}

func TestForwardEventRuntimeTokenNotInErrorMessage(t *testing.T) {
	secret := "super-secret-runtime-token"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":"unauthorized"}`))
	}))
	defer server.Close()

	err := newTestForwarder(server.URL, secret).ForwardEvent(context.Background(), testEvent())
	if err == nil {
		t.Fatal("expected error on 401")
	}
	if strings.Contains(err.Error(), secret) {
		t.Errorf("runtime token must not appear in error messages: %v", err)
	}
}
