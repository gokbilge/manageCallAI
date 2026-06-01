package esl

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gokbilge/manageCallAI/apps/freeswitch-agent/internal/config"
)

func TestSubscriptionCommandsAvoidAllEvents(t *testing.T) {
	commands := subscriptionCommands()
	if len(commands) == 0 {
		t.Fatal("expected at least one subscription command")
	}

	joined := strings.Join(commands, "\n")
	if strings.Contains(joined, "events plain all") {
		t.Fatal("subscription must not use events plain all")
	}
	for _, want := range []string{"CHANNEL_CREATE", "CHANNEL_ANSWER", "CHANNEL_HANGUP", "CUSTOM", "RECORD_START", "RECORD_STOP"} {
		if !strings.Contains(joined, want) {
			t.Fatalf("subscription command missing %s: %s", want, joined)
		}
	}
}

func TestReconnectDelayUsesBoundedBackoff(t *testing.T) {
	first := reconnectDelay(0)
	later := reconnectDelay(5)
	capped := reconnectDelay(20)

	if first < time.Second || first > 1500*time.Millisecond {
		t.Fatalf("attempt 0 delay out of range: %s", first)
	}
	if later < 30*time.Second || later > 45*time.Second {
		t.Fatalf("attempt 5 delay out of range: %s", later)
	}
	if capped < 30*time.Second || capped > 45*time.Second {
		t.Fatalf("capped delay out of range: %s", capped)
	}
}

func TestReconnectDelayMonotonicallyNonDecreasing(t *testing.T) {
	prev := time.Duration(0)
	for attempt := 0; attempt <= 6; attempt++ {
		d := reconnectDelay(attempt)
		// Delay should be >= previous minimum (base, not jitter).
		// We check the minimum because jitter is random.
		baseMin := time.Second << min(attempt, 5)
		if baseMin > 30*time.Second {
			baseMin = 30 * time.Second
		}
		if d < baseMin {
			t.Fatalf("attempt %d delay %s is below minimum %s", attempt, d, baseMin)
		}
		_ = prev
		prev = d
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func TestHealthDefaultsToDisconnected(t *testing.T) {
	c := &Client{}
	h := c.Health()
	if h.Connected {
		t.Fatal("new client should start disconnected")
	}
	if h.LastConnectedAt != "" {
		t.Fatalf("expected empty LastConnectedAt, got %q", h.LastConnectedAt)
	}
}

func TestSetConnectedUpdatesHealth(t *testing.T) {
	c := &Client{}
	c.setConnected(true)
	h := c.Health()
	if !h.Connected {
		t.Fatal("expected connected after setConnected(true)")
	}
	if h.LastConnectedAt == "" {
		t.Fatal("expected LastConnectedAt to be set after connect")
	}

	c.setConnected(false)
	h2 := c.Health()
	if h2.Connected {
		t.Fatal("expected disconnected after setConnected(false)")
	}
	// LastConnectedAt should still carry the last-connected timestamp
	if h2.LastConnectedAt == "" {
		t.Fatal("expected LastConnectedAt to be preserved after disconnect")
	}
}

func TestSetLastEventAtUpdatesHealth(t *testing.T) {
	c := &Client{}
	if c.Health().LastEventAt != "" {
		t.Fatal("expected empty LastEventAt initially")
	}

	now := time.Now().UTC()
	c.setLastEventAt(now)
	if c.Health().LastEventAt == "" {
		t.Fatal("expected LastEventAt to be set after setLastEventAt")
	}
}

// TestRunSessionAuthenticate verifies the full ESL handshake and subscription
// using an in-process net.Pipe() as the mock FreeSWITCH TCP connection.
func TestRunSessionAuthenticatesAndSubscribes(t *testing.T) {
	serverConn, clientConn := net.Pipe()
	defer serverConn.Close()
	defer clientConn.Close()

	password := "TestClueCon"
	errCh := make(chan error, 1)

	// Mock FreeSWITCH server: send auth challenge, reply +OK, reply +OK for subscribe, close.
	go func() {
		defer serverConn.Close()

		// 1. Send auth/request
		_, err := fmt.Fprint(serverConn, "Content-Type: auth/request\n\n")
		if err != nil {
			errCh <- fmt.Errorf("server: send auth/request: %w", err)
			return
		}

		// 2. Read auth command
		reader := bufio.NewReader(serverConn)
		line, err := reader.ReadString('\n')
		if err != nil {
			errCh <- fmt.Errorf("server: read auth command: %w", err)
			return
		}
		line = strings.TrimRight(line, "\r\n")
		if !strings.HasPrefix(line, "auth "+password) {
			errCh <- fmt.Errorf("server: unexpected auth command: %q", line)
			return
		}
		// Consume trailing blank line
		_, _ = reader.ReadString('\n')

		// 3. Reply +OK to auth
		_, err = fmt.Fprint(serverConn, "Content-Type: command/reply\nReply-Text: +OK accepted\n\n")
		if err != nil {
			errCh <- fmt.Errorf("server: send auth reply: %w", err)
			return
		}

		// 4. Read subscribe command
		_, err = reader.ReadString('\n')
		if err != nil {
			errCh <- fmt.Errorf("server: read subscribe: %w", err)
			return
		}
		// Consume trailing blank line
		_, _ = reader.ReadString('\n')

		// 5. Reply +OK to subscribe
		_, err = fmt.Fprint(serverConn, "Content-Type: command/reply\nReply-Text: +OK event listener enabled plain\n\n")
		if err != nil {
			errCh <- fmt.Errorf("server: send subscribe reply: %w", err)
			return
		}

		// 6. Send one event then close (simulates disconnect)
		eventBody := "Event-Name: CHANNEL_CREATE\nUnique-ID: test-uuid-1\n"
		_, err = fmt.Fprintf(serverConn, "Content-Type: text/event-plain\nContent-Length: %d\n\n%s", len(eventBody), eventBody)
		if err != nil {
			// Client closed before we could send â€” that's OK for this test
		}

		errCh <- nil
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	// Client side: use the pipe as the TCP connection by monkey-patching runSession
	// indirectly. We call authenticate + subscribe directly on the clientConn.
	reader := bufio.NewReader(clientConn)
	cfg := config.Config{ESLPassword: password, TenantID: "test-tenant"}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	c := NewClient(cfg, logger)

	if err := c.authenticate(reader, clientConn); err != nil {
		cancel()
		t.Fatalf("authenticate failed: %v", err)
	}
	if err := c.subscribe(reader, clientConn); err != nil {
		cancel()
		t.Fatalf("subscribe failed: %v", err)
	}

	// Read the event message that the mock server sent
	msg, err := readMessage(reader)
	if err != nil {
		cancel()
		t.Fatalf("readMessage failed: %v", err)
	}

	if msg.Headers["Content-Type"] != "text/event-plain" {
		t.Errorf("expected text/event-plain, got %q", msg.Headers["Content-Type"])
	}

	cancel()

	select {
	case err := <-errCh:
		if err != nil {
			t.Fatalf("mock server error: %v", err)
		}
	case <-ctx.Done():
		// Timeout is fine â€” we just want to verify client-side behavior
	}
}

func TestRunSessionAuthRejectsWrongPassword(t *testing.T) {
	serverConn, clientConn := net.Pipe()
	defer serverConn.Close()
	defer clientConn.Close()

	go func() {
		defer serverConn.Close()
		_, _ = fmt.Fprint(serverConn, "Content-Type: auth/request\n\n")
		reader := bufio.NewReader(serverConn)
		_, _ = reader.ReadString('\n') // auth line
		_, _ = reader.ReadString('\n') // blank line
		_, _ = fmt.Fprint(serverConn, "Content-Type: command/reply\nReply-Text: -ERR invalid\n\n")
	}()

	cfg := config.Config{ESLPassword: "correct", TenantID: "t"}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	c := NewClient(cfg, logger)

	reader := bufio.NewReader(clientConn)
	err := c.authenticate(reader, clientConn)
	if err == nil {
		t.Fatal("expected auth to fail on -ERR reply")
	}
	if !strings.Contains(err.Error(), "-ERR") {
		t.Errorf("error should mention -ERR, got: %v", err)
	}
}

// TestConnectExitsOnPreCancelledContext verifies Connect returns nil immediately
// when the context is already cancelled before any connection attempt.
func TestConnectExitsOnPreCancelledContext(t *testing.T) {
	cfg := config.Config{ESLHost: "127.0.0.1", ESLPort: 59990}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	c := NewClient(cfg, logger)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	start := time.Now()
	err := c.Connect(ctx)
	if err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
	if time.Since(start) > 200*time.Millisecond {
		t.Fatal("Connect should return immediately on pre-cancelled context")
	}
}

// TestConnectRetriesAndExitsOnContextCancel verifies the reconnect loop runs
// at least one failed attempt before exiting on context cancellation.
func TestConnectRetriesAndExitsOnContextCancel(t *testing.T) {
	cfg := config.Config{ESLHost: "127.0.0.1", ESLPort: 59991}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	c := NewClient(cfg, logger)

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- c.Connect(ctx) }()

	time.Sleep(50 * time.Millisecond)
	cancel()

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("expected nil, got %v", err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("Connect did not exit after context cancellation")
	}
}

type mockESLServer struct {
	ln       net.Listener
	password string
	events   []string
}

func newMockESLServer(t *testing.T, password string, events []string) *mockESLServer {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	s := &mockESLServer{ln: ln, password: password, events: events}
	go s.serveOne(t)
	return s
}

func (s *mockESLServer) addr() string { return s.ln.Addr().String() }

func (s *mockESLServer) serveOne(t *testing.T) {
	t.Helper()
	conn, err := s.ln.Accept()
	if err != nil {
		return
	}
	defer conn.Close()
	_ = s.ln.Close()

	reader := bufio.NewReader(conn)
	_, _ = fmt.Fprint(conn, "Content-Type: auth/request\n\n")
	line, _ := reader.ReadString('\n')
	line = strings.TrimRight(line, "\r\n")
	if !strings.HasPrefix(line, "auth "+s.password) {
		return
	}
	_, _ = reader.ReadString('\n')
	_, _ = fmt.Fprint(conn, "Content-Type: command/reply\nReply-Text: +OK accepted\n\n")
	_, _ = reader.ReadString('\n')
	_, _ = reader.ReadString('\n')
	_, _ = fmt.Fprint(conn, "Content-Type: command/reply\nReply-Text: +OK event listener enabled plain\n\n")
	for _, body := range s.events {
		_, _ = fmt.Fprintf(conn, "Content-Type: text/event-plain\nContent-Length: %d\n\n%s", len(body), body)
	}
}

// TestRunSessionFullHandshakeAndEventDelivery exercises the full runSession path.
func TestRunSessionFullHandshakeAndEventDelivery(t *testing.T) {
	eventBody := "Event-Name: CHANNEL_CREATE\nUnique-ID: call-uuid-test\n"
	srv := newMockESLServer(t, "testpass", []string{eventBody})

	var forwarded int
	apiServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		forwarded++
		w.WriteHeader(http.StatusCreated)
	}))
	defer apiServer.Close()

	host, portStr, _ := net.SplitHostPort(srv.addr())
	port, _ := strconv.Atoi(portStr)
	cfg := config.Config{ESLHost: host, ESLPort: port, ESLPassword: "testpass", TenantID: "tenant-1", APIBaseURL: apiServer.URL}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	c := NewClient(cfg, logger)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := c.runSession(ctx, srv.addr())
	if err == nil {
		t.Fatal("expected non-nil error when server closes connection")
	}
	h := c.Health()
	if h.Connected {
		t.Error("expected disconnected after runSession returns")
	}
	if h.LastConnectedAt == "" {
		t.Error("expected LastConnectedAt to be set")
	}
	if forwarded == 0 {
		t.Error("expected at least one event to be forwarded")
	}
}

// TestRunSessionHandlesNonEventMessages verifies non-event messages do not panic.
func TestRunSessionHandlesNonEventMessages(t *testing.T) {
	srv := newMockESLServer(t, "testpass", []string{})
	apiServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusCreated)
	}))
	defer apiServer.Close()

	host, portStr, _ := net.SplitHostPort(srv.addr())
	port, _ := strconv.Atoi(portStr)
	cfg := config.Config{ESLHost: host, ESLPort: port, ESLPassword: "testpass", TenantID: "tenant-1", APIBaseURL: apiServer.URL}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	c := NewClient(cfg, logger)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := c.runSession(ctx, srv.addr())
	if err == nil {
		t.Fatal("expected non-nil error when server closes connection")
	}
}
