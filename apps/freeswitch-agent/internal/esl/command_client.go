package esl

import (
	"bufio"
	"context"
	"fmt"
	"log/slog"
	"net"
	"strings"
	"time"

	"github.com/gokbilge/manageCallAI/apps/freeswitch-agent/internal/config"
)

// CommandClient opens a dedicated ESL connection for sending API commands.
// It is separate from the event-subscription Client to avoid racing on the
// shared event stream. Each Originate call opens, authenticates, sends, reads
// the reply, and closes — keeping the implementation simple and stateless.
type CommandClient struct {
	cfg    config.Config
	logger *slog.Logger
}

func NewCommandClient(cfg config.Config, logger *slog.Logger) *CommandClient {
	return &CommandClient{cfg: cfg, logger: logger}
}

// SendAPICommand sends a single-shot ESL "api <cmd>" command and returns
// the raw reply text. Only allowlisted callers (ApplyDispatcher) use this.
func (c *CommandClient) SendAPICommand(ctx context.Context, cmd string) (string, error) {
	if cmd == "" {
		return "", fmt.Errorf("SendAPICommand: command must not be empty")
	}
	return c.sendCommand(ctx, "api "+cmd)
}

// Originate dispatches an outbound call via FreeSWITCH bgapi originate.
// It bridges the external destination (via the named SIP trunk gateway) to the
// internal extension identified by extensionID.
//
// The gateway name convention is "trunk-{trunkID}" which matches the name
// emitted by the /freeswitch/configuration endpoint.
func (c *CommandClient) Originate(ctx context.Context, dialNumber, extensionID, trunkID string) error {
	if dialNumber == "" || trunkID == "" {
		return fmt.Errorf("originate: dial_number and trunk_id are required")
	}

	// Build the originate command.
	// A-leg: call the external number via the named gateway.
	// B-leg: connect the internal extension using the loopback dialplan.
	gatewayName := fmt.Sprintf("trunk-%s", trunkID)
	aLeg := fmt.Sprintf("sofia/gateway/%s/%s", gatewayName, dialNumber)
	bLeg := fmt.Sprintf("&bridge(sofia/internal/%s@${domain_name})", extensionID)

	command := fmt.Sprintf("bgapi originate {origination_uuid=%s,sip_h_X-ManageCall-Extension=%s}%s %s",
		newNonce(), extensionID, aLeg, bLeg)

	reply, err := c.sendCommand(ctx, command)
	if err != nil {
		return fmt.Errorf("originate ESL command failed: %w", err)
	}

	c.logger.Info("originate dispatched",
		slog.String("dial_number", dialNumber),
		slog.String("trunk_id", trunkID),
		slog.String("reply", reply),
	)

	if strings.HasPrefix(reply, "-ERR") {
		return fmt.Errorf("originate rejected by FreeSWITCH: %s", reply)
	}

	return nil
}

// sendCommand opens a one-shot ESL connection, authenticates, sends a command,
// reads the response, and closes.
func (c *CommandClient) sendCommand(ctx context.Context, command string) (string, error) {
	address := fmt.Sprintf("%s:%d", c.cfg.ESLHost, c.cfg.ESLPort)

	dialer := net.Dialer{Timeout: 5 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", address)
	if err != nil {
		return "", fmt.Errorf("connect to ESL: %w", err)
	}
	defer conn.Close()

	_ = conn.SetDeadline(time.Now().Add(15 * time.Second))

	reader := bufio.NewReader(conn)

	// Read the auth request.
	if err := readUntilHeader(reader, "Content-Type: auth/request"); err != nil {
		return "", fmt.Errorf("waiting for auth/request: %w", err)
	}

	// Send auth.
	if _, err := fmt.Fprintf(conn, "auth %s\n\n", c.cfg.ESLPassword); err != nil {
		return "", fmt.Errorf("send auth: %w", err)
	}

	// Read auth reply.
	reply, err := readNextReply(reader)
	if err != nil {
		return "", fmt.Errorf("read auth reply: %w", err)
	}
	if !strings.Contains(reply, "+OK accepted") {
		return "", fmt.Errorf("auth rejected: %s", reply)
	}

	// Send the command.
	if _, err := fmt.Fprintf(conn, "%s\n\n", command); err != nil {
		return "", fmt.Errorf("send command: %w", err)
	}

	// Read command reply.
	cmdReply, err := readNextReply(reader)
	if err != nil {
		return "", fmt.Errorf("read command reply: %w", err)
	}

	return cmdReply, nil
}

// readUntilHeader reads lines until a line contains the expected header.
func readUntilHeader(reader *bufio.Reader, header string) error {
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			return err
		}
		if strings.TrimSpace(line) == header {
			// consume the blank line after the header block
			for {
				blank, _ := reader.ReadString('\n')
				if strings.TrimSpace(blank) == "" {
					return nil
				}
			}
		}
	}
}

// readNextReply reads a full ESL reply (headers + body).
func readNextReply(reader *bufio.Reader) (string, error) {
	var headers []string
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			return "", err
		}
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			break
		}
		headers = append(headers, trimmed)
	}

	// If there's a Content-Length header, read that many bytes as the body.
	for _, h := range headers {
		if strings.HasPrefix(h, "Content-Length:") {
			var length int
			if _, err := fmt.Sscanf(h, "Content-Length: %d", &length); err == nil && length > 0 {
				body := make([]byte, length)
				if _, err := reader.Read(body); err != nil {
					return "", err
				}
				return string(body), nil
			}
		}
	}

	return strings.Join(headers, " "), nil
}

// newNonce returns a short random string for origination UUID tracing.
func newNonce() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}
