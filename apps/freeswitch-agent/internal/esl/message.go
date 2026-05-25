package esl

import (
	"bufio"
	"fmt"
	"io"
	"strconv"
	"strings"
)

type Message struct {
	Headers map[string]string
	Body    string
}

func readMessage(reader *bufio.Reader) (Message, error) {
	headers := map[string]string{}

	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			return Message{}, err
		}

		line = strings.TrimRight(line, "\r\n")
		if line == "" {
			break
		}

		parts := strings.SplitN(line, ": ", 2)
		if len(parts) == 2 {
			headers[parts[0]] = parts[1]
		}
	}

	body := ""
	if rawLength, ok := headers["Content-Length"]; ok {
		length, err := strconv.Atoi(strings.TrimSpace(rawLength))
		if err != nil {
			return Message{}, fmt.Errorf("invalid content length: %w", err)
		}

		buf := make([]byte, length)
		if _, err := io.ReadFull(reader, buf); err != nil {
			return Message{}, err
		}
		body = string(buf)
	}

	return Message{
		Headers: headers,
		Body:    body,
	}, nil
}

func parsePlainEvent(body string) map[string]string {
	fields := map[string]string{}

	for _, line := range strings.Split(body, "\n") {
		line = strings.TrimRight(line, "\r")
		if line == "" {
			continue
		}

		parts := strings.SplitN(line, ": ", 2)
		if len(parts) == 2 {
			fields[parts[0]] = parts[1]
		}
	}

	return fields
}
