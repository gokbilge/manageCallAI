package esl

import (
	"strings"
	"testing"
	"time"
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
