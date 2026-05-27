package events

import "testing"

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
