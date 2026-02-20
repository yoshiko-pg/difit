/* oxlint-disable typescript/no-explicit-any */
/// <reference types="@testing-library/jest-dom" />

import '@testing-library/jest-dom';
import 'vitest';

declare module 'vitest' {
  interface Assertion<T = any> extends jest.Matchers<void, T> {}
  interface AsymmetricMatchersContaining extends jest.Matchers<void> {}
}
