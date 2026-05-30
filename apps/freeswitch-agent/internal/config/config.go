package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	AppEnv       string
	TenantID     string
	RuntimeToken string
	ESLHost      string
	ESLPort      int
	ESLPassword  string
	APIBaseURL   string
	LogLevel     string
}

func Load() Config {
	cfg := Config{
		AppEnv:       getEnv("APP_ENV", "development"),
		TenantID:     getEnv("MANAGECALLAI_TENANT_ID", ""),
		RuntimeToken: getEnv("RUNTIME_API_TOKEN", ""),
		ESLHost:      getEnv("FREESWITCH_ESL_HOST", "127.0.0.1"),
		ESLPort:      getEnvInt("FREESWITCH_ESL_PORT", 8021),
		ESLPassword:  getEnv("FREESWITCH_ESL_PASSWORD", "ClueCon"),
		APIBaseURL:   getEnv("API_BASE_URL", "http://localhost:3000"),
		LogLevel:     getEnv("LOG_LEVEL", "info"),
	}

	if cfg.AppEnv == "production" {
		mustUseProductionSecret("RUNTIME_API_TOKEN", cfg.RuntimeToken, "change-me-runtime-token", 32)
		mustUseProductionSecret("FREESWITCH_ESL_PASSWORD", cfg.ESLPassword, "ClueCon", 16)
	}

	return cfg
}

func getEnv(key string, fallback string) string {
	if value, ok := os.LookupEnv(key); ok && value != "" {
		return value
	}

	return fallback
}

func getEnvInt(key string, fallback int) int {
	if value, ok := os.LookupEnv(key); ok && value != "" {
		parsed, err := strconv.Atoi(value)
		if err == nil {
			return parsed
		}
	}

	return fallback
}

func mustUseProductionSecret(name string, value string, disallowedValue string, minimumLength int) {
	if value == disallowedValue || len(value) < minimumLength {
		panic(fmt.Sprintf("%s must be changed to a strong production value when APP_ENV=production", name))
	}
}
