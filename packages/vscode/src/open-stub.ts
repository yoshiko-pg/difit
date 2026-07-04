// Replaces the `open` package in the bundled VS Code build. The extension
// always launches the server with openBrowser: false and opens the URL through
// the VS Code API itself, so browser-opening logic is never needed here.
export default async function open(_target: string): Promise<void> {}
