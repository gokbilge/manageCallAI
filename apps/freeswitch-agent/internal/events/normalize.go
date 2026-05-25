package events

import (
	"fmt"
	"net/url"
	"strings"
	"time"
)

type NormalizedEvent struct {
	TenantID  string                 `json:"tenant_id,omitempty"`
	CallID    string                 `json:"call_id"`
	EventType string                 `json:"event_type"`
	EventTime string                 `json:"event_time,omitempty"`
	Source    string                 `json:"source"`
	Payload   map[string]interface{} `json:"payload"`
}

func NormalizeMVP(headers map[string]string) (NormalizedEvent, bool) {
	eventName := firstNonEmpty(
		headers["Event-Name"],
		headers["Event-Subclass"],
	)

	switch eventName {
	case "CHANNEL_CREATE":
		return fromHeaders("channel_create", headers), true
	case "CHANNEL_ANSWER":
		return fromHeaders("channel_answer", headers), true
	case "CHANNEL_HANGUP":
		return fromHeaders("channel_hangup", headers), true
	case "sofia::register", "sofia::unregister":
		return fromHeaders("registration_seen", headers), true
	default:
		return NormalizedEvent{}, false
	}
}

func fromHeaders(eventType string, headers map[string]string) NormalizedEvent {
	callID := firstNonEmpty(
		headers["Unique-ID"],
		headers["Channel-Call-UUID"],
		headers["variable_sip_call_id"],
		headers["from-user"],
	)

	if callID == "" {
		callID = fmt.Sprintf("%s-%d", eventType, time.Now().UnixNano())
	}

	return NormalizedEvent{
		TenantID:  "00000000-0000-0000-0000-000000000001",
		CallID:    callID,
		EventType: eventType,
		EventTime: eventTime(headers),
		Source:    "freeswitch-esl",
		Payload:   normalizePayload(headers),
	}
}

func normalizePayload(headers map[string]string) map[string]interface{} {
	payload := make(map[string]interface{}, len(headers))

	for key, value := range headers {
		payload[key] = decodeValue(value)
	}

	return payload
}

func eventTime(headers map[string]string) string {
	if raw := firstNonEmpty(headers["Event-Date-Timestamp"], headers["Caller-Channel-Created-Time"]); raw != "" {
		if micros, err := timeFromEpochMicros(raw); err == nil {
			return micros.Format(time.RFC3339Nano)
		}
	}

	return time.Now().UTC().Format(time.RFC3339Nano)
}

func timeFromEpochMicros(raw string) (time.Time, error) {
	value := strings.TrimSpace(raw)
	var micros int64
	_, err := fmt.Sscan(value, &micros)
	if err != nil {
		return time.Time{}, err
	}

	return time.Unix(0, micros*1000).UTC(), nil
}

func decodeValue(value string) string {
	decoded, err := url.QueryUnescape(value)
	if err != nil {
		return value
	}

	return decoded
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}

	return ""
}
