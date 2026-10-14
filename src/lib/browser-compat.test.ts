/** @jest-environment node */
import { createContext, runInContext } from 'vm';

import {
  LEGACY_FETCH_CREDENTIALS_POLYFILL,
  LEGACY_GLOBAL_THIS_POLYFILL,
} from './browser-compat';

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

function fetchContext(defaultCredentials = 'omit') {
  const fetch = jest.fn();
  const context = createContext({ fetch, defaultCredentials });
  runInContext(
    `this.window=this;this.location={href:'https://tv.example/tv'};
    this.Request=function(input,init){this.credentials=init&&init.credentials||defaultCredentials;};`,
    context
  );
  runInContext(LEGACY_FETCH_CREDENTIALS_POLYFILL, context);
  return { fetch, context };
}

test('old fetch sends same-origin credentials and preserves request options without mutation', () => {
  const { fetch, context } = fetchContext();
  runInContext(
    "this.init=Object.freeze({method:'POST',body:'test'});fetch('/api/test',init)",
    context
  );
  const options = fetch.mock.calls[0][1];
  expect(options.credentials).toBe('same-origin');
  expect(options.method).toBe('POST');
  expect(options.body).toBe('test');
  expect(runInContext('init.credentials', context)).toBeUndefined();
});

test.each(['omit', 'same-origin', 'include'])(
  'respects explicit credentials %s',
  (credentials) => {
    const { fetch, context } = fetchContext();
    runInContext(`fetch('/api/test',{credentials:'${credentials}'})`, context);
    expect(fetch.mock.calls[0][1].credentials).toBe(credentials);
  }
);

test('does not enable cross-origin credentials or override Request policies', () => {
  const { fetch, context } = fetchContext();
  runInContext(
    "fetch('https://other.example/api');fetch(new Request('/api/test',{credentials:'omit'}));",
    context
  );
  expect(fetch.mock.calls[0][1].credentials).toBe('same-origin');
  expect(fetch.mock.calls[1][0].credentials).toBe('omit');
  expect(fetch.mock.calls[1][1]).toBeUndefined();
});

test('does not wrap modern fetch', () => {
  const { fetch, context } = fetchContext('same-origin');
  expect(runInContext('window.fetch', context)).toBe(fetch);
});
