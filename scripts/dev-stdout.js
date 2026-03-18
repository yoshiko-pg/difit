const CLI_SERVER_URL_PATTERN = /difit server started on (https?:\/\/\S+)/;
const PORT_RETRY_PATTERN = /^Port \d+ is busy, trying \d+\.\.\.$/;

export function createCliStdoutProxy({ onServerUrl, onOutput }) {
  let buffer = '';
  let pendingBlankLines = 0;
  let detectedServerUrl;

  function flushPendingBlankLines() {
    while (pendingBlankLines > 0) {
      onOutput('\n');
      pendingBlankLines -= 1;
    }
  }

  function handleLine(rawLine, hasTrailingNewline) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;

    if (line === '') {
      pendingBlankLines += 1;
      return;
    }

    const serverUrlMatch = line.match(CLI_SERVER_URL_PATTERN);

    if (serverUrlMatch && !detectedServerUrl) {
      detectedServerUrl = serverUrlMatch[1];
      onServerUrl(detectedServerUrl);
    }

    if (serverUrlMatch || PORT_RETRY_PATTERN.test(line)) {
      pendingBlankLines = 0;
      return;
    }

    flushPendingBlankLines();
    onOutput(hasTrailingNewline ? `${line}\n` : line);
  }

  return {
    push(chunk) {
      buffer += chunk;

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        handleLine(line, true);
      }
    },
    flush() {
      if (buffer.length > 0) {
        handleLine(buffer, false);
      }

      buffer = '';
      pendingBlankLines = 0;
    },
  };
}
