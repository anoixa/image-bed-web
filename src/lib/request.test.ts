import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { getAuthToken, clearAuthToken } from './authToken';
import { refreshAccessTokenSingleFlight } from './request';
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
