/** @jest-environment node */
import { createContext, runInContext } from 'vm';

import { LEGACY_GLOBAL_THIS_POLYFILL } from './browser-compat';

test('allows the Next runtime global lookup in a module-capable browser without globalThis', () => {
  const context = createContext({});
  runInContext('this.window=this; delete this.globalThis;', context);
  expect(() => runInContext('globalThis.AsyncLocalStorage', context)).toThrow(
    'globalThis is not defined'
  );
  runInContext(LEGACY_GLOBAL_THIS_POLYFILL, context);
  expect(() =>
    runInContext('globalThis.AsyncLocalStorage', context)
  ).not.toThrow();
  expect(runInContext('globalThis === window', context)).toBe(true);
  expect(
    runInContext(
      "Object.getOwnPropertyDescriptor(window, 'globalThis').enumerable",
      context
    )
  ).toBe(false);
});

test('preserves native globalThis and works on repeated loads', () => {
  const context = createContext({});
  runInContext('this.window=this; this.original=globalThis;', context);
  runInContext(LEGACY_GLOBAL_THIS_POLYFILL, context);
  runInContext(LEGACY_GLOBAL_THIS_POLYFILL, context);
  expect(runInContext('globalThis === original', context)).toBe(true);
});
