const CLI_SERVER_URL_PATTERN = /difit server started on (https?:\/\/\S+)/;

const SUPPRESSED_CLI_OUTPUT_PATTERNS = [
  /^🚀 difit server started on https?:\/\/\S+$/,
  /^📋 Reviewing: .+$/,
  /^🔒 Keep-alive mode: server will stay running after browser disconnects$/,
  /^🧹 Starting with a clean slate - all existing comments will be cleared$/,
  /^🌐 Opening browser\.\.\.$/,
  /^💡 Use --open to automatically open browser$/,
  /^Press Ctrl\+C to stop the server$/,
  /^! \x1b\[33mNo differences found\. Browser will not open automatically\.\x1b\[0m$/,
  /^   Server is running at https?:\/\/\S+ if you want to check manually\.$/,
];

export function shouldSuppressCliLine(line) {
  return SUPPRESSED_CLI_OUTPUT_PATTERNS.some((pattern) => pattern.test(line));
}

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
    const serverUrlMatch = line.match(CLI_SERVER_URL_PATTERN);

    if (serverUrlMatch && !detectedServerUrl) {
      detectedServerUrl = serverUrlMatch[1];
      onServerUrl(detectedServerUrl);
    }

    if (serverUrlMatch || shouldSuppressCliLine(line)) {
      return;
    }

    if (line === '') {
      pendingBlankLines += 1;
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
