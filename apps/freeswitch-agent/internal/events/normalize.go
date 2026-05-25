package events

type NormalizedEvent struct {
	EventType      string                 `json:"eventType"`
	CallID         string                 `json:"callId,omitempty"`
	OccurredAt     string                 `json:"occurredAt,omitempty"`
	Source         string                 `json:"source"`
	TenantHint     string                 `json:"tenantHint,omitempty"`
	RegistrationID string                 `json:"registrationId,omitempty"`
	Payload        map[string]interface{} `json:"payload"`
}

func NormalizeMVP(eventType string, payload map[string]interface{}) NormalizedEvent {
	return NormalizedEvent{
		EventType: eventType,
		Source:    "freeswitch-esl",
		Payload:   payload,
	}
}
