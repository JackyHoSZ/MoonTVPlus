'use client';

import { Loader2, Smartphone } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  parseQrSession,
  qrErrorText,
  QrRequestError,
  QrSession,
  requestQrJson,
} from '@/lib/qr-login/client';

import TVLayout from '@/components/tv/TVLayout';

export default function TVLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const target = searchParams.get('redirect') || '/tv';
  const redirect =
    target.startsWith('/') && !target.startsWith('//') && !target.includes('\\')
      ? target
      : '/tv';
  const [qr, setQr] = useState<QrSession | null>(null);
  const [status, setStatus] = useState('正在加载登录组件...');
  const [engine, setEngine] = useState('');
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const generation = useRef(0);
  const cancelCreate = useRef<(() => void) | null>(null);
  const deadline = useRef(0);

  const create = useCallback(async () => {
    const attempt = ++generation.current;
    cancelCreate.current?.();
    setQr(null);
    setLeft(0);
    setBusy(true);
    setFailed(false);
    setStatus('正在生成二维码...');
    try {
      const request = requestQrJson('/api/auth/qr/create', 'POST');
      cancelCreate.current = request.cancel;
      const data = parseQrSession(await request.promise);
      if (attempt !== generation.current) return;
      // Device clocks can be wrong. Use server TTL rather than comparing epochs.
      deadline.current = Date.now() + data.ttl * 1000;
      setQr(data);
      setLeft(Math.ceil(data.ttl));
      setStatus('请使用手机扫码登录');
    } catch (error) {
      if (attempt !== generation.current) return;
      setFailed(true);
      setStatus(qrErrorText(error));
    } finally {
      if (attempt === generation.current) {
        setBusy(false);
        cancelCreate.current = null;
      }
    }
  }, []);

  useEffect(() => {
    document
      .getElementById('tv-login-root')
      ?.setAttribute('data-ready', 'true');
    const version = /Chrome\/([0-9]+)/.exec(navigator.userAgent);
    setEngine(version ? `浏览器内核 Chrome ${version[1]}；` : '');
    void create();
    return () => {
      // Invalidate async results across unmount and Strict Mode remount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      cancelCreate.current?.();
    };
  }, [create]);

  useEffect(() => {
    if (!qr || failed) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((deadline.current - Date.now()) / 1000)
      );
      setLeft(remaining);
      if (remaining <= 0) {
        window.clearInterval(timer);
        setFailed(true);
        setStatus('二维码已过期，请重试生成');
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [qr, failed]);

  useEffect(() => {
    if (!qr || failed) return;
    let stopped = false;
    let timer: number;
    let cancel: (() => void) | undefined;
    const poll = async () => {
      try {
        const request = requestQrJson(
          `/api/auth/qr/status?token=${encodeURIComponent(qr.token)}`
        );
        cancel = request.cancel;
        const data = (await request.promise) as { status?: string } | null;
        if (stopped) return;
        if (
          !data ||
          !['pending', 'scanned', 'confirmed', 'expired', 'cancelled'].includes(
            data.status || ''
          )
        ) {
          throw new QrRequestError('INVALID_DATA');
        }
        if (data.status === 'confirmed') {
          setStatus('登录成功，正在进入电视端');
          router.replace(redirect);
          return;
        }
        if (data.status === 'expired' || data.status === 'cancelled') {
          setFailed(true);
          setStatus(
            data.status === 'expired'
              ? '二维码已过期，请重试生成'
              : '登录已取消，请重试生成'
          );
          return;
        }
        if (data.status === 'scanned') setStatus('已扫码，请在手机上确认');
        timer = window.setTimeout(poll, 2000);
      } catch (error) {
        if (!stopped) {
          setFailed(true);
          setStatus(`登录状态查询失败：${qrErrorText(error)}`);
        }
      }
    };
    timer = window.setTimeout(poll, 2000);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      cancel?.();
    };
  }, [qr, failed, redirect, router]);

  const qrImg =
    qr && !failed
      ? `/api/auth/qr/image?data=${encodeURIComponent(qr.qrUrl)}`
      : '';
  return (
    <TVLayout showNav={false}>
      <section
        id='tv-login-root'
        className='mx-auto grid max-w-6xl grid-cols-[1fr_430px] gap-8 rounded-[42px] border border-white/10 bg-slate-950/75 p-8 shadow-2xl shadow-black/60'
      >
        <div className='flex flex-col justify-center'>
          <div className='inline-flex w-fit items-center gap-3 rounded-full bg-rose-600 px-5 py-2 text-xl font-bold text-white'>
            <Smartphone className='h-6 w-6' /> 手机确认 · 电视自动登录
          </div>
          <h1 className='mt-4 text-6xl font-black tracking-tight'>扫码登录</h1>
          <p className='mt-4 max-w-2xl text-2xl leading-relaxed text-slate-300'>
            用已登录的手机浏览器扫描右侧二维码，在手机上确认后，电视端会自动进入。
          </p>
          <p
            id='tv-login-status'
            role='status'
            className='mt-5 text-xl font-bold text-rose-300'
          >
            {status}
          </p>
          <div className='mt-4 flex gap-3'>
            <button
              type='button'
              disabled={busy}
              onClick={() => void create()}
              className='tv-focusable rounded-xl bg-rose-600 px-4 py-3 text-xl disabled:opacity-50'
            >
              重试生成二维码
            </button>
            <a
              href='/tv/login'
              className='tv-focusable rounded-xl bg-white/10 px-4 py-3 text-xl'
            >
              重新加载登录页
            </a>
          </div>
          <p id='tv-login-compat' className='mt-3 text-sm text-slate-300'>
            {engine}登录诊断版本 QR-2。若一直停在加载组件，请重新加载或尝试
            GeckoView 版本。
          </p>
          <noscript>JavaScript 未启用，无法生成二维码。</noscript>
        </div>
        <div className='rounded-[36px] border border-white/10 bg-white p-7 text-center text-black shadow-2xl shadow-black/60'>
          {qrImg ? (
            // A short-lived authenticated QR must not enter the image optimizer cache.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrImg}
              alt='扫码登录二维码'
              className='mx-auto h-[360px] w-[360px]'
              onError={() => {
                setFailed(true);
                setStatus('二维码图片加载失败，请重试（IMAGE）');
              }}
            />
          ) : (
            <div className='flex h-[360px] items-center justify-center'>
              {busy ? (
                <Loader2 className='h-12 w-12 animate-spin' />
              ) : (
                <span className='text-2xl'>等待生成二维码</span>
              )}
            </div>
          )}
          <div className='mt-5 text-2xl font-black'>
            {qr && !failed ? `剩余 ${left} 秒` : '二维码尚未就绪'}
          </div>
        </div>
      </section>
      {/* ES5 watchdog still explains a failed hydration on old WebViews. */}
      <script src='/tv-login-bootstrap.js' defer />
    </TVLayout>
  );
}
