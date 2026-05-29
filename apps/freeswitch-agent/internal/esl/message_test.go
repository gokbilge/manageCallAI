package esl

import (
	"bufio"
	"fmt"
	"strings"
	"testing"
)

func TestReadMessageHeadersOnly(t *testing.T) {
	raw := "Content-Type: auth/request\n\n"
	msg, err := readMessage(bufio.NewReader(strings.NewReader(raw)))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if msg.Headers["Content-Type"] != "auth/request" {
		t.Fatalf("expected auth/request, got %q", msg.Headers["Content-Type"])
	}
	if msg.Body != "" {
		t.Fatalf("expected empty body, got %q", msg.Body)
	}
}

func TestReadMessageMultipleHeaders(t *testing.T) {
	raw := "Content-Type: command/reply\nReply-Text: +OK\n\n"
	msg, err := readMessage(bufio.NewReader(strings.NewReader(raw)))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if msg.Headers["Reply-Text"] != "+OK" {
		t.Fatalf("expected +OK, got %q", msg.Headers["Reply-Text"])
	}
	if len(msg.Headers) != 2 {
		t.Fatalf("expected 2 headers, got %d", len(msg.Headers))
	}
}

func TestReadMessageWithBody(t *testing.T) {
	body := "Event-Name: CHANNEL_CREATE\nUnique-ID: abc-123\n"
	raw := fmt.Sprintf("Content-Type: text/event-plain\nContent-Length: %d\n\n%s", len(body), body)
	msg, err := readMessage(bufio.NewReader(strings.NewReader(raw)))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if msg.Headers["Content-Type"] != "text/event-plain" {
		t.Fatalf("expected text/event-plain, got %q", msg.Headers["Content-Type"])
	}
	if msg.Body != body {
		t.Fatalf("expected body %q, got %q", body, msg.Body)
	}
}

func TestReadMessageInvalidContentLength(t *testing.T) {
	raw := "Content-Length: not-a-number\n\n"
	_, err := readMessage(bufio.NewReader(strings.NewReader(raw)))
	if err == nil {
		t.Fatal("expected error for invalid Content-Length")
	}
}

func TestParsePlainEventBasic(t *testing.T) {
	body := "Event-Name: CHANNEL_ANSWER\nUnique-ID: call-uuid-1\n"
	fields := parsePlainEvent(body)
	if fields["Event-Name"] != "CHANNEL_ANSWER" {
		t.Fatalf("expected CHANNEL_ANSWER, got %q", fields["Event-Name"])
	}
	if fields["Unique-ID"] != "call-uuid-1" {
		t.Fatalf("expected call-uuid-1, got %q", fields["Unique-ID"])
	}
}

func TestParsePlainEventSkipsEmptyLines(t *testing.T) {
	body := "\nEvent-Name: CHANNEL_HANGUP\n\nUnique-ID: uuid-2\n"
	fields := parsePlainEvent(body)
	if len(fields) != 2 {
		t.Fatalf("expected 2 fields, got %d: %v", len(fields), fields)
	}
}

func TestParsePlainEventSkipsLinesWithoutSeparator(t *testing.T) {
	body := "NoColonHere\nEvent-Name: CHANNEL_CREATE\n"
	fields := parsePlainEvent(body)
	if _, ok := fields["NoColonHere"]; ok {
		t.Fatal("should not parse line with no ': ' separator")
	}
	if fields["Event-Name"] != "CHANNEL_CREATE" {
		t.Fatalf("expected CHANNEL_CREATE, got %q", fields["Event-Name"])
	}
}

func TestParsePlainEventValueWithColonPreserved(t *testing.T) {
	body := "some-key: value:with:colons\n"
	fields := parsePlainEvent(body)
	if fields["some-key"] != "value:with:colons" {
		t.Fatalf("expected %q, got %q", "value:with:colons", fields["some-key"])
	}
}

func TestIsEventMessage(t *testing.T) {
	cases := []struct {
		contentType string
		want        bool
	}{
		{"text/event-plain", true},
		{"text/event-json", true},
		{"text/disconnect-notice", true},
		{"command/reply", false},
		{"auth/request", false},
		{"", false},
	}

	for _, tc := range cases {
		got := isEventMessage(map[string]string{"Content-Type": tc.contentType})
		if got != tc.want {
			t.Errorf("isEventMessage(%q) = %v, want %v", tc.contentType, got, tc.want)
		}
	}
}
