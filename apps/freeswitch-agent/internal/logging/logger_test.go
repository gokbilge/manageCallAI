package logging

import (
	"context"
	"log/slog"
	"testing"
)

func TestNewEnablesConfiguredLogLevels(t *testing.T) {
	cases := []struct {
		name         string
		level        string
		debugEnabled bool
		infoEnabled  bool
		warnEnabled  bool
		errorEnabled bool
	}{
		{name: "default info", level: "", debugEnabled: false, infoEnabled: true, warnEnabled: true, errorEnabled: true},
		{name: "debug", level: "debug", debugEnabled: true, infoEnabled: true, warnEnabled: true, errorEnabled: true},
		{name: "warn", level: "warn", debugEnabled: false, infoEnabled: false, warnEnabled: true, errorEnabled: true},
		{name: "error", level: "error", debugEnabled: false, infoEnabled: false, warnEnabled: false, errorEnabled: true},
		{name: "case insensitive", level: "WARN", debugEnabled: false, infoEnabled: false, warnEnabled: true, errorEnabled: true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			logger := New(tc.level)
			ctx := context.Background()

			if got := logger.Enabled(ctx, slog.LevelDebug); got != tc.debugEnabled {
				t.Fatalf("debug enabled = %v, want %v", got, tc.debugEnabled)
			}
			if got := logger.Enabled(ctx, slog.LevelInfo); got != tc.infoEnabled {
				t.Fatalf("info enabled = %v, want %v", got, tc.infoEnabled)
			}
			if got := logger.Enabled(ctx, slog.LevelWarn); got != tc.warnEnabled {
				t.Fatalf("warn enabled = %v, want %v", got, tc.warnEnabled)
			}
			if got := logger.Enabled(ctx, slog.LevelError); got != tc.errorEnabled {
				t.Fatalf("error enabled = %v, want %v", got, tc.errorEnabled)
			}
		})
	}
}
