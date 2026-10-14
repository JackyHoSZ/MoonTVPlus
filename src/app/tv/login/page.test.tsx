import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { QrRequestError, requestQrJson } from '@/lib/qr-login/client';

import TVLoginPage from './page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/components/tv/TVLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
jest.mock('@/lib/qr-login/client', () => ({
  ...jest.requireActual('@/lib/qr-login/client'),
  requestQrJson: jest.fn(),
}));

const requestMock = requestQrJson as jest.MockedFunction<typeof requestQrJson>;

beforeEach(() => {
  jest.useFakeTimers();
  requestMock.mockReset();
});
afterEach(() => {
  jest.useRealTimers();
});

test('failure stops the spinner; retry creates a QR using TTL despite an incorrect device clock', async () => {
  requestMock.mockImplementationOnce(() => ({
    promise: Promise.reject(new QrRequestError('TIMEOUT')),
    cancel: jest.fn(),
  }));
  render(<TVLoginPage />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByRole('status')).toHaveTextContent('TIMEOUT');
  const retry = screen.getByRole('button', { name: '重试生成二维码' });
  expect(retry).toBeEnabled();
  requestMock.mockImplementationOnce(() => ({
    promise: Promise.resolve({
      token: 'test-session-123456789',
      expiresAt: 1,
      ttl: 120,
    }),
    cancel: jest.fn(),
  }));
  fireEvent.click(retry);
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByText('剩余 120 秒')).toBeInTheDocument();
  expect(screen.getByAltText('扫码登录二维码')).toBeInTheDocument();
  expect(requestMock).toHaveBeenLastCalledWith('/api/auth/qr/create', 'POST');
  fireEvent.error(screen.getByAltText('扫码登录二维码'));
  expect(screen.getByRole('status')).toHaveTextContent('IMAGE');
  expect(screen.queryByAltText('扫码登录二维码')).not.toBeInTheDocument();
});

test('unmount aborts an in-flight creation request', () => {
  const cancel = jest.fn();
  requestMock.mockReturnValue({
    promise: new Promise(() => {
      /* deliberately pending until unmount */
    }),
    cancel,
  });
  const view = render(<TVLoginPage />);
  view.unmount();
  expect(cancel).toHaveBeenCalledTimes(1);
});
