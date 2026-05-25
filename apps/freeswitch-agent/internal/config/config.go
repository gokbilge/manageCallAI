package config

import (
	"os"
	"strconv"
)

type Config struct {
	TenantID    string
	ESLHost     string
	ESLPort     int
	ESLPassword string
	APIBaseURL  string
	LogLevel    string
}

func Load() Config {
	return Config{
		TenantID:    getEnv("MANAGECALLAI_TENANT_ID", ""),
		ESLHost:     getEnv("FREESWITCH_ESL_HOST", "127.0.0.1"),
		ESLPort:     getEnvInt("FREESWITCH_ESL_PORT", 8021),
		ESLPassword: getEnv("FREESWITCH_ESL_PASSWORD", "ClueCon"),
		APIBaseURL:  getEnv("API_BASE_URL", "http://localhost:3000"),
		LogLevel:    getEnv("LOG_LEVEL", "info"),
	}
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
