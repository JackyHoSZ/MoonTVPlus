// Private deployment policy. Keep upstream application code unchanged.
import app from '../.open-next/worker.js';
export * from '../.open-next/worker.js';

const publicProxyPaths = [
  '/api/proxy-m3u8', '/api/cms-proxy', '/api/openlist/cms-proxy',
  '/api/openlist/play', '/api/openlist/proxy', '/api/emby/cms-proxy',
  '/api/emby/play', '/api/emby/subtitle', '/api/emby/sources',
];

export default {
  ...app,
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname.replace(/\/+$/, '');
    if (env.DISABLE_PUBLIC_PROXIES !== 'false' &&
        publicProxyPaths.some(p => path === p || path.startsWith(`${p}/`))) {
      return new Response('This proxy is disabled for this private deployment.', { status: 404 });
    }
    if (env.DANMAKU_ENABLED !== 'true' && path.startsWith('/api/danmaku/')) {
      return Response.json({
        success: false, errorCode: -1, errorMessage: '弹幕服务尚未配置',
        animes: [], bangumi: { episodes: [] }, isMatched: false, matches: [],
        count: 0, comments: [],
      });
    }
    // Do not serve an unprotected application before secrets are provisioned.
    if (!env.USERNAME || !env.PASSWORD) {
      return new Response('Private site setup in progress.', { status: 503 });
    }
    const response = await app.fetch(request, env, ctx);
    const forwardedHost = request.headers.get('x-forwarded-host');
    const fromVpsEntry = new URL(request.url).hostname === 'origin-tv.vafa.eu.org' &&
      ['tv.vafa.eu.org', 'tv-cn.vafa.eu.org'].includes(forwardedHost);
    // Also prevent image/file endpoints from relaying media bytes to the VPS.
    if (fromVpsEntry && response.body) {
      const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      const media = /^(video\/|audio\/)/.test(type) ||
        ['application/octet-stream', 'application/vnd.apple.mpegurl',
         'application/x-mpegurl', 'application/dash+xml', 'application/mp4'].includes(type);
      if (media) {
        await response.body.cancel();
        return Response.json({ error: 'Media relay disabled on VPS entry; use a direct-play source.' },
          { status: 403, headers: { 'Cache-Control': 'no-store' } });
      }
    }
    return response;
  },
};
