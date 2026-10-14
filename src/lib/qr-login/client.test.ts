import { parseQrSession, qrErrorText, requestQrJson } from './client';

class FakeXHR {
  static current: FakeXHR;
  status = 200;
  responseURL = '';
  responseText = '{}';
  contentType = 'application/json';
  timeout = 0;
  onload = () => {
    /* assigned by the transport */
  };
  onerror = () => {
    /* assigned by the transport */
  };
  ontimeout = () => {
    /* assigned by the transport */
  };
  onabort = () => {
    /* assigned by the transport */
  };
  constructor() {
    FakeXHR.current = this;
  }
  open() {
    /* transport stub */
  }
  setRequestHeader() {
    /* transport stub */
  }
  getResponseHeader() {
    return this.contentType;
  }
  send() {
    /* tests settle the request explicitly */
  }
  abort() {
    this.onabort();
  }
}

const originalXHR = window.XMLHttpRequest;
beforeEach(() => {
  window.XMLHttpRequest = FakeXHR as unknown as typeof XMLHttpRequest;
});
afterAll(() => {
  window.XMLHttpRequest = originalXHR;
});

test.each([
  [503, 'application/json', '{}', 'HTTP_503'],
  [403, 'text/html', '<html>private-response</html>', 'HTTP_403'],
  [200, 'text/html', '<html>private-response</html>', 'NOT_JSON'],
  [200, 'application/json', 'private-response', 'INVALID_JSON'],
])(
  'rejects invalid HTTP/JSON responses (%s)',
  async (status, type, body, code) => {
    const request = requestQrJson('/api/auth/qr/create', 'POST');
    Object.assign(FakeXHR.current, {
      status,
      contentType: type,
      responseText: body,
    });
    FakeXHR.current.onload();
    await expect(request.promise).rejects.toMatchObject({ code });
    await request.promise.catch((error) =>
      expect(qrErrorText(error)).not.toContain('private-response')
    );
  }
);

test.each([
  ['ontimeout', 'TIMEOUT'],
  ['onerror', 'NETWORK'],
  ['onabort', 'ABORTED'],
] as const)('settles %s safely', async (event, code) => {
  const request = requestQrJson('/api/auth/qr/create', 'POST');
  expect(FakeXHR.current.timeout).toBe(12000);
  FakeXHR.current[event]();
  await expect(request.promise).rejects.toMatchObject({ code });
});

test('rejects redirects even when their final response is 200', async () => {
  const request = requestQrJson('/api/auth/qr/create', 'POST');
  FakeXHR.current.responseURL = 'http://localhost/login';
  FakeXHR.current.onload();
  await expect(request.promise).rejects.toMatchObject({ code: 'REDIRECT' });
});

test('accepts a session and ignores untrusted returned QR origin', async () => {
  const request = requestQrJson('/api/auth/qr/create', 'POST');
  FakeXHR.current.responseText = JSON.stringify({
    token: 'test-session-123456789',
    ttl: 120,
    expiresAt: 1,
    qrUrl: 'https://example.invalid',
  });
  FakeXHR.current.onload();
  const data = parseQrSession(await request.promise);
  expect(data.qrUrl).toBe(
    'http://localhost/qr-login?token=test-session-123456789'
  );
  expect(data.ttl).toBe(120);
});

test.each([
  null,
  {},
  { token: 'bad', expiresAt: 1, ttl: 120 },
  { token: 'test-session-123456789', expiresAt: 1, ttl: 0 },
])('rejects malformed session', (data) => {
  expect(() => parseQrSession(data)).toThrow('INVALID_DATA');
});

test('never displays arbitrary exception details', () => {
  expect(qrErrorText(new Error('private-token'))).not.toContain(
    'private-token'
  );
});
