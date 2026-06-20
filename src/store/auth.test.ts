import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { server } from '@/test/server';
import { clearAuthToken, getAuthToken } from '@/lib/authToken';
import { useAuthStore } from './auth';

function resetAuthStore() {
  clearAuthToken();
  localStorage.removeItem('auth-storage');
  useAuthStore.setState({
    user: null,
    accessToken: null,
    accessTokenExpiry: null,
    isAuthenticated: false,
    isLoading: false,
    isRefreshing: false,
    twoFATicket: null,
  });
}

describe('auth initialization', () => {
  beforeEach(() => {
    resetAuthStore();
  });

  it('skips refresh-token recovery on the login route', async () => {
    let refreshCalls = 0;
    server.use(
      http.post('*/api/auth/refresh', () => {
        refreshCalls += 1;
        return HttpResponse.json({
          status: 'success',
          data: {
            access_token: 'Bearer refreshed-token',
            access_token_expiry: 2_000_000_000,
          },
        });
      })
    );

    await useAuthStore.getState().initAuth({ allowRefresh: false });

    expect(refreshCalls).toBe(0);
    expect(getAuthToken()).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
