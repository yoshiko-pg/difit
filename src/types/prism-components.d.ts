// TypeScript declarations for Prismjs language components
declare module 'prismjs/components/*' {
  const value: unknown;
  export = value;
}

// Third-party Prism grammar plugin (registers Prism.languages.svelte on import).
declare module 'prism-svelte' {
  const value: unknown;
  export = value;
}
