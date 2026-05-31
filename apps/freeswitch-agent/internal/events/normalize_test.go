package events

import (
	"strings"
	"testing"
	"time"
)

func TestNormalizeMVPCustomRegisterEvent(t *testing.T) {
	event, ok := NormalizeMVP(map[string]string{
		"Event-Name":           "CUSTOM",
		"Event-Subclass":       "sofia%3A%3Aregister",
		"from-user":            "200",
		"Event-Date-Timestamp": "1779850934891000",
	}, "tenant-1")
	if !ok {
		t.Fatal("expected custom register event to normalize")
	}

	if event.EventType != "registration_seen" {
		t.Fatalf("expected registration_seen, got %q", event.EventType)
	}

	if event.CallID != "200" {
		t.Fatalf("expected call id from from-user, got %q", event.CallID)
	}
}

func TestNormalizeMVPSofiaExpire(t *testing.T) {
	event, ok := NormalizeMVP(map[string]string{
		"Event-Name":     "CUSTOM",
		"Event-Subclass": "sofia::expire",
		"from-user":      "202",
	}, "tenant-1")
	if !ok {
		t.Fatal("expected sofia::expire to normalize")
	}
	if event.EventType != "registration_expired" {
		t.Fatalf("expected registration_expired, got %q", event.EventType)
	}
	if event.CallID != "202" {
		t.Fatalf("expected 202 from from-user, got %q", event.CallID)
	}
}

func TestNormalizeMVPChannelCreateStillUsesEventName(t *testing.T) {
	event, ok := NormalizeMVP(map[string]string{
		"Event-Name": "CHANNEL_CREATE",
		"Unique-ID":  "uuid-1",
	}, "tenant-1")
	if !ok {
		t.Fatal("expected channel create event to normalize")
	}

	if event.EventType != "channel_create" {
		t.Fatalf("expected channel_create, got %q", event.EventType)
	}
}

func TestNormalizeMVPChannelAnswer(t *testing.T) {
	event, ok := NormalizeMVP(map[string]string{
		"Event-Name": "CHANNEL_ANSWER",
		"Unique-ID":  "uuid-answer",
	}, "tenant-2")
	if !ok {
		t.Fatal("expected CHANNEL_ANSWER to normalize")
	}
	if event.EventType != "channel_answer" {
		t.Fatalf("expected channel_answer, got %q", event.EventType)
	}
	if event.TenantID != "tenant-2" {
		t.Fatalf("expected tenant-2, got %q", event.TenantID)
	}
}

func TestNormalizeMVPChannelHangup(t *testing.T) {
	event, ok := NormalizeMVP(map[string]string{
		"Event-Name": "CHANNEL_HANGUP",
		"Unique-ID":  "uuid-hangup",
	}, "tenant-1")
	if !ok {
		t.Fatal("expected CHANNEL_HANGUP to normalize")
	}
	if event.EventType != "channel_hangup" {
		t.Fatalf("expected channel_hangup, got %q", event.EventType)
	}
	if event.CallID != "uuid-hangup" {
		t.Fatalf("expected uuid-hangup, got %q", event.CallID)
	}
}

func TestNormalizeMVPChannelHangupComplete(t *testing.T) {
	event, ok := NormalizeMVP(map[string]string{
		"Event-Name":    "CHANNEL_HANGUP_COMPLETE",
		"Unique-ID":     "uuid-hangup-complete",
		"Hangup-Cause":  "NORMAL_CLEARING",
		"variable_uuid": "ignored-uuid",
	}, "tenant-1")
	if !ok {
		t.Fatal("expected CHANNEL_HANGUP_COMPLETE to normalize")
	}
	if event.EventType != "channel_hangup_complete" {
		t.Fatalf("expected channel_hangup_complete, got %q", event.EventType)
	}
	if event.CallID != "uuid-hangup-complete" {
		t.Fatalf("expected uuid-hangup-complete, got %q", event.CallID)
	}
	if event.Payload["Hangup-Cause"] != "NORMAL_CLEARING" {
		t.Fatalf("expected hangup cause in payload, got %q", event.Payload["Hangup-Cause"])
	}
}

func TestNormalizeMVPSofiaUnregister(t *testing.T) {
	event, ok := NormalizeMVP(map[string]string{
		"Event-Name":     "CUSTOM",
		"Event-Subclass": "sofia::unregister",
		"from-user":      "201",
	}, "tenant-1")
	if !ok {
		t.Fatal("expected sofia::unregister to normalize")
	}
	if event.EventType != "registration_expired" {
		t.Fatalf("expected registration_expired, got %q", event.EventType)
	}
	if event.CallID != "201" {
		t.Fatalf("expected 201 from from-user, got %q", event.CallID)
	}
}

func TestNormalizeMVPUnknownReturnsFalse(t *testing.T) {
	_, ok := NormalizeMVP(map[string]string{"Event-Name": "HEARTBEAT"}, "tenant-1")
	if ok {
		t.Fatal("expected HEARTBEAT to not normalize")
	}
}

func TestNormalizeMVPSourceIsFreeSwitchESL(t *testing.T) {
	event, ok := NormalizeMVP(map[string]string{"Event-Name": "CHANNEL_CREATE", "Unique-ID": "uuid-1"}, "tenant-1")
	if !ok {
		t.Fatal("expected channel create to normalize")
	}
	if event.Source != "freeswitch-esl" {
		t.Fatalf("expected freeswitch-esl, got %q", event.Source)
	}
}

func TestNormalizeMVPCallIDFallbackToChannelCallUUID(t *testing.T) {
	event, ok := NormalizeMVP(map[string]string{
		"Event-Name":        "CHANNEL_CREATE",
		"Channel-Call-UUID": "fallback-uuid",
	}, "tenant-1")
	if !ok {
		t.Fatal("expected channel create to normalize")
	}
	if event.CallID != "fallback-uuid" {
		t.Fatalf("expected fallback-uuid, got %q", event.CallID)
	}
}

func TestNormalizeMVPCallIDFallbackToSipCallID(t *testing.T) {
	event, ok := NormalizeMVP(map[string]string{
		"Event-Name":           "CHANNEL_CREATE",
		"variable_sip_call_id": "sip-id-123",
	}, "tenant-1")
	if !ok {
		t.Fatal("expected channel create to normalize")
	}
	if event.CallID != "sip-id-123" {
		t.Fatalf("expected sip-id-123, got %q", event.CallID)
	}
}

func TestNormalizeMVPGeneratedCallIDWhenNoIDFields(t *testing.T) {
	event, ok := NormalizeMVP(map[string]string{"Event-Name": "CHANNEL_CREATE"}, "tenant-1")
	if !ok {
		t.Fatal("expected channel create to normalize")
	}
	if event.CallID == "" {
		t.Fatal("expected a generated call ID, got empty string")
	}
	if !strings.HasPrefix(event.CallID, "channel_create-") {
		t.Fatalf("generated call ID should start with event type, got %q", event.CallID)
	}
}

func TestNormalizeMVPEventTimeParsedFromMicros(t *testing.T) {
	event, ok := NormalizeMVP(map[string]string{
		"Event-Name":           "CHANNEL_ANSWER",
		"Unique-ID":            "uuid-1",
		"Event-Date-Timestamp": "1000000000000000",
	}, "tenant-1")
	if !ok {
		t.Fatal("expected channel answer to normalize")
	}
	parsed, err := time.Parse(time.RFC3339Nano, event.EventTime)
	if err != nil {
		t.Fatalf("EventTime is not RFC3339Nano: %v", err)
	}
	if parsed.Unix() != 1000000000 {
		t.Fatalf("expected unix 1000000000, got %d", parsed.Unix())
	}
}

func TestNormalizeMVPPayloadURLDecoded(t *testing.T) {
	event, ok := NormalizeMVP(map[string]string{
		"Event-Name":           "CHANNEL_CREATE",
		"Unique-ID":            "uuid-1",
		"Caller-CallerID-Name": "John%20Doe",
	}, "tenant-1")
	if !ok {
		t.Fatal("expected channel create to normalize")
	}
	if event.Payload["Caller-CallerID-Name"] != "John Doe" {
		t.Fatalf("expected URL-decoded value, got %q", event.Payload["Caller-CallerID-Name"])
	}
}

func TestTimeFromEpochMicros(t *testing.T) {
	got, err := timeFromEpochMicros("1000000000000000")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Unix() != 1000000000 {
		t.Fatalf("expected unix 1000000000, got %d", got.Unix())
	}
}

func TestTimeFromEpochMicrosInvalid(t *testing.T) {
	_, err := timeFromEpochMicros("not-a-number")
	if err == nil {
		t.Fatal("expected error for non-numeric input")
	}
}

func TestDecodeValueURLEncoded(t *testing.T) {
	if got := decodeValue("hello%20world"); got != "hello world" {
		t.Fatalf("expected %q, got %q", "hello world", got)
	}
}

func TestDecodeValueInvalidPercentReturnsOriginal(t *testing.T) {
	input := "bad%zz"
	if got := decodeValue(input); got != input {
		t.Fatalf("expected original %q, got %q", input, got)
	}
}

func TestFirstNonEmptySkipsBlanks(t *testing.T) {
	if got := firstNonEmpty("", "  ", "first"); got != "first" {
		t.Fatalf("expected first, got %q", got)
	}
}

func TestFirstNonEmptyAllEmpty(t *testing.T) {
	if got := firstNonEmpty("", "  ", ""); got != "" {
		t.Fatalf("expected empty string, got %q", got)
	}
}
