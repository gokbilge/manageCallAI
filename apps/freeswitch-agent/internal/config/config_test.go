package config

import (
	"testing"
)

func TestLoadDefaults(t *testing.T) {
	for _, key := range []string{
		"MANAGECALLAI_TENANT_ID", "RUNTIME_API_TOKEN", "FREESWITCH_ESL_HOST",
		"FREESWITCH_ESL_PORT", "FREESWITCH_ESL_PASSWORD", "API_BASE_URL", "LOG_LEVEL",
	} {
		t.Setenv(key, "")
	}

	cfg := Load()

	if cfg.ESLHost != "127.0.0.1" {
		t.Errorf("ESLHost default: got %q, want 127.0.0.1", cfg.ESLHost)
	}
	if cfg.ESLPort != 8021 {
		t.Errorf("ESLPort default: got %d, want 8021", cfg.ESLPort)
	}
	if cfg.ESLPassword != "ClueCon" {
		t.Errorf("ESLPassword default: got %q, want ClueCon", cfg.ESLPassword)
	}
	if cfg.APIBaseURL != "http://localhost:3000" {
		t.Errorf("APIBaseURL default: got %q, want http://localhost:3000", cfg.APIBaseURL)
	}
	if cfg.LogLevel != "info" {
		t.Errorf("LogLevel default: got %q, want info", cfg.LogLevel)
	}
	if cfg.TenantID != "" {
		t.Errorf("TenantID default should be empty, got %q", cfg.TenantID)
	}
	if cfg.RuntimeToken != "" {
		t.Errorf("RuntimeToken default should be empty, got %q", cfg.RuntimeToken)
	}
}

func TestLoadOverridesFromEnv(t *testing.T) {
	t.Setenv("MANAGECALLAI_TENANT_ID", "tenant-xyz")
	t.Setenv("RUNTIME_API_TOKEN", "tok-abc")
	t.Setenv("FREESWITCH_ESL_HOST", "10.0.0.1")
	t.Setenv("FREESWITCH_ESL_PORT", "9021")
	t.Setenv("FREESWITCH_ESL_PASSWORD", "MySecret")
	t.Setenv("API_BASE_URL", "http://api:8080")
	t.Setenv("LOG_LEVEL", "debug")

	cfg := Load()

	if cfg.TenantID != "tenant-xyz" {
		t.Errorf("TenantID: got %q, want tenant-xyz", cfg.TenantID)
	}
	if cfg.RuntimeToken != "tok-abc" {
		t.Errorf("RuntimeToken: got %q, want tok-abc", cfg.RuntimeToken)
	}
	if cfg.ESLHost != "10.0.0.1" {
		t.Errorf("ESLHost: got %q, want 10.0.0.1", cfg.ESLHost)
	}
	if cfg.ESLPort != 9021 {
		t.Errorf("ESLPort: got %d, want 9021", cfg.ESLPort)
	}
	if cfg.ESLPassword != "MySecret" {
		t.Errorf("ESLPassword: got %q, want MySecret", cfg.ESLPassword)
	}
	if cfg.APIBaseURL != "http://api:8080" {
		t.Errorf("APIBaseURL: got %q, want http://api:8080", cfg.APIBaseURL)
	}
	if cfg.LogLevel != "debug" {
		t.Errorf("LogLevel: got %q, want debug", cfg.LogLevel)
	}
}

func TestLoadInvalidPortFallsToDefault(t *testing.T) {
	t.Setenv("FREESWITCH_ESL_PORT", "not-a-number")

	cfg := Load()

	if cfg.ESLPort != 8021 {
		t.Errorf("ESLPort with invalid value: got %d, want 8021", cfg.ESLPort)
	}
}

func TestLoadEmptyStringEnvFallsToDefault(t *testing.T) {
	t.Setenv("FREESWITCH_ESL_HOST", "")

	cfg := Load()

	if cfg.ESLHost != "127.0.0.1" {
		t.Errorf("ESLHost with empty env: got %q, want 127.0.0.1", cfg.ESLHost)
	}
}
