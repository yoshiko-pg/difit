// Drop-in replacement for @parcel/watcher used in the bundled VS Code build.
// The real package resolves its native binding through node_modules at load
// time; here the prebuilt binaries ship inside the extension at
// dist/server/prebuilds/<package-name>/watcher.node instead.
import { createRequire } from 'node:module';
import path from 'node:path';

import { MUSL, familySync } from 'detect-libc';

import { createWrapper } from '#parcel-watcher-wrapper';

function bindingPackageName(): string {
  let name = `@parcel/watcher-${process.platform}-${process.arch}`;
  if (process.platform === 'linux') {
    name += familySync() === MUSL ? '-musl' : '-glibc';
  }
  return name;
}

const requireBinding = createRequire(__filename);
const bindingPath = path.join(__dirname, 'prebuilds', bindingPackageName(), 'watcher.node');
const wrapper = createWrapper(requireBinding(bindingPath));

export const writeSnapshot = wrapper.writeSnapshot;
export const getEventsSince = wrapper.getEventsSince;
export const subscribe = wrapper.subscribe;
export const unsubscribe = wrapper.unsubscribe;
