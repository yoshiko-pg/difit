type ScrollHandler = () => void;

declare global {
  interface Window {
    __difitVirtualRowScrollRegistry?: Map<string, ScrollHandler>;
  }
}

function getRegistry(): Map<string, ScrollHandler> | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!window.__difitVirtualRowScrollRegistry) {
    window.__difitVirtualRowScrollRegistry = new Map<string, ScrollHandler>();
  }

  return window.__difitVirtualRowScrollRegistry;
}

export function registerVirtualRowScrollHandlers(handlers: Map<string, ScrollHandler>): () => void {
  const registry = getRegistry();
  if (!registry) {
    return () => undefined;
  }

  handlers.forEach((handler, id) => {
    registry.set(id, handler);
  });

  return () => {
    handlers.forEach((handler, id) => {
      const current = registry.get(id);
      if (current === handler) {
        registry.delete(id);
      }
    });
  };
}

export function scrollToVirtualRowById(id: string): boolean {
  const registry = getRegistry();
  if (!registry) {
    return false;
  }

  const handler = registry.get(id);
  if (!handler) {
    return false;
  }

  handler();
  return true;
}
