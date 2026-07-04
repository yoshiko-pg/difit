// Resolved by esbuild (build.mjs) to @parcel/watcher's internal wrapper.js.
declare module '#parcel-watcher-wrapper' {
  type Watcher = typeof import('@parcel/watcher');

  export function createWrapper(binding: unknown): {
    writeSnapshot: Watcher['writeSnapshot'];
    getEventsSince: Watcher['getEventsSince'];
    subscribe: Watcher['subscribe'];
    unsubscribe: Watcher['unsubscribe'];
  };
}
