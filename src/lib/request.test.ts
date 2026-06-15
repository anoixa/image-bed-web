import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { getAuthToken, clearAuthToken } from './authToken';
import { CanceledError } from 'axios';
import { ApiRequestError, get, isRequestCanceled, post, refreshAccessTokenSingleFlight, unwrapApiResponse } from './request';
import { server } from '@/test/server';

describe('refreshAccessTokenSingleFlight', () => {
  beforeEach(() => {
    clearAuthToken();
  });

  it('shares one refresh request across concurrent callers', async () => {
    let refreshCalls = 0;
    server.use(
      http.post('*/api/auth/refresh', async () => {
        refreshCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return HttpResponse.json({
          status: 'success',
          data: {
            access_token: 'Bearer refreshed-token',
            access_token_expiry: 2_000_000_000,
          },
        });
      })
    );

    const results = await Promise.all([
      refreshAccessTokenSingleFlight(),
      refreshAccessTokenSingleFlight(),
      refreshAccessTokenSingleFlight(),
    ]);

    expect(refreshCalls).toBe(1);
    expect(results.every((result) => result.token === 'refreshed-token')).toBe(true);
    expect(getAuthToken()).toBe('refreshed-token');
  });
});

describe('API response envelope', () => {
  it('fails fast when a success response omits required data', async () => {
    server.use(
      http.get('*/api/malformed', () => HttpResponse.json({ status: 'success' }))
    );

    await expect(get('/api/malformed')).rejects.toThrow('成功响应缺少 data');
  });

  it('allows an explicitly empty success response for void commands', async () => {
    server.use(
      http.post('*/api/command', () => HttpResponse.json({ status: 'success' }))
    );

    await expect(post('/api/command', undefined, { expectData: false })).resolves.toBeUndefined();
  });

  it('preserves the API error message', () => {
    expect(() =>
      unwrapApiResponse({ status: 'error', msg: 'permission denied' }, '/api/admin')
    ).toThrow(ApiRequestError);
    expect(() =>
      unwrapApiResponse({ status: 'error', msg: 'permission denied' }, '/api/admin')
    ).toThrow('permission denied');
  });
});

describe('request cancellation', () => {
  it('keeps canceled requests distinguishable from API failures', () => {
    expect(isRequestCanceled(new CanceledError())).toBe(true);
    expect(isRequestCanceled(new ApiRequestError('failed'))).toBe(false);
  });
});
