/** QR-only transport. XHR also works on WebViews without fetch/AbortController. */
export type QrSession = {
  token: string;
  qrUrl: string;
  expiresAt: number;
  ttl: number;
};
export class QrRequestError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

export function requestQrJson(path: string, method = 'GET') {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<unknown>((resolve, reject) => {
    const fail = (code: string) => reject(new QrRequestError(code));
    xhr.open(method, path, true);
    xhr.timeout = 12000;
    xhr.setRequestHeader('Accept', 'application/json');
    // Preserve fetch's former no-store behavior for status polling.
    xhr.setRequestHeader('Cache-Control', 'no-cache, no-store');
    xhr.onload = () => {
      // Never display a response body, URL, token or an arbitrary exception message.
      try {
        if (xhr.responseURL) {
          const expected = new URL(path, window.location.href);
          const actual = new URL(xhr.responseURL, window.location.href);
          if (
            actual.origin !== expected.origin ||
            actual.pathname !== expected.pathname
          ) {
            fail('REDIRECT');
            return;
          }
        }
      } catch {
        fail('REDIRECT');
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        fail(`HTTP_${xhr.status}`);
        return;
      }
      if (
        !/application\/json/i.test(xhr.getResponseHeader('Content-Type') || '')
      ) {
        fail('NOT_JSON');
        return;
      }
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch {
        fail('INVALID_JSON');
      }
    };
    xhr.onerror = () => fail('NETWORK');
    xhr.ontimeout = () => fail('TIMEOUT');
    xhr.onabort = () => fail('ABORTED');
    xhr.send();
  });
  return { promise, cancel: () => xhr.abort() };
}

export function parseQrSession(value: unknown): QrSession {
  const data = value as Partial<QrSession> | null;
  if (
    !data ||
    typeof data.token !== 'string' ||
    !/^[A-Za-z0-9_-]{16,256}$/.test(data.token) ||
    typeof data.expiresAt !== 'number' ||
    !Number.isFinite(data.expiresAt) ||
    typeof data.ttl !== 'number' ||
    !Number.isFinite(data.ttl) ||
    data.ttl <= 0 ||
    data.ttl > 300
  ) {
    throw new QrRequestError('INVALID_DATA');
  }
  // The confirming browser must use the same public origin as the TV.
  return {
    token: data.token,
    expiresAt: data.expiresAt,
    ttl: data.ttl,
    qrUrl: `${window.location.origin}/qr-login?token=${encodeURIComponent(
      data.token
    )}`,
  };
}

export function qrErrorText(error: unknown): string {
  const code = error instanceof QrRequestError ? error.code : 'CLIENT';
  const reasons: Record<string, string> = {
    TIMEOUT: '请求超过 12 秒，请检查网络后重试',
    NETWORK: '网络或证书连接失败，请检查网络和设备时间',
    REDIRECT: '接口发生了异常跳转，请重新加载登录页',
    NOT_JSON: '接口返回了非 JSON 内容，可能是跳转页或拦截页',
    INVALID_JSON: '接口 JSON 内容无效',
    INVALID_DATA: '接口数据不完整',
    CLIENT: '登录组件执行失败，请重新加载或尝试 GeckoView 版本',
  };
  if (/^HTTP_\d{3}$/.test(code)) return `登录请求失败（${code}），请重试`;
  return `${reasons[code] || reasons.CLIENT}（${
    reasons[code] ? code : 'CLIENT'
  }）`;
}
