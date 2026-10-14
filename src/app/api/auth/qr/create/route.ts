import { NextRequest, NextResponse } from 'next/server';

import { createQrLoginSession } from '@/lib/qr-login/store';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const session = await createQrLoginSession();
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get('x-moontv-public-host');
  // Only our dedicated origin may generate links for these owned public entries.
  // Never interpolate an arbitrary forwarded host into the QR login URL.
  const publicHosts = new Set(['tv.vafa.eu.org', 'tv-cn.vafa.eu.org']);
  const origin = requestUrl.hostname === 'origin-tv.vafa.eu.org' &&
    forwardedHost && publicHosts.has(forwardedHost)
    ? `https://${forwardedHost}`
    : requestUrl.origin;
  const qrUrl = `${origin}/qr-login?token=${encodeURIComponent(session.token)}`;
  return NextResponse.json({ token: session.token, qrUrl, expiresAt: session.expiresAt, ttl: 120 });
}
