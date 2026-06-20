import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get, put } from '@/lib/request';
import type { AuthCapabilities } from '@/types';
import {
  fetchAuthSettings,
  getAuthCapabilities,
  invalidateAuthConfigCache,
  type AuthSettings,
  updateAuthSettings,
} from './auth';

vi.mock('@/lib/request', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

const capabilities: AuthCapabilities = {
  password_login_enabled: true,
  oauth_login_enabled: false,
  providers: [],
};

const settings: AuthSettings = {
  password_login_enabled: true,
  oauth_login_enabled: false,
  providers: [],
  callback_urls: {},
};

describe('auth config cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateAuthConfigCache();
  });

  it('reuses auth capabilities and settings requests', async () => {
    vi.mocked(get)
      .mockResolvedValueOnce(capabilities as never)
      .mockResolvedValueOnce(settings as never);

    await getAuthCapabilities();
    await getAuthCapabilities();
    await fetchAuthSettings();
    await fetchAuthSettings();

    expect(get).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenNthCalledWith(1, '/api/auth/capabilities');
    expect(get).toHaveBeenNthCalledWith(2, '/api/v1/admin/auth/settings');
  });

  it('invalidates cached auth settings after updating them', async () => {
    vi.mocked(get)
      .mockResolvedValueOnce(settings as never)
      .mockResolvedValueOnce({ ...settings, oauth_login_enabled: true } as never);
    vi.mocked(put).mockResolvedValueOnce({ ...settings, oauth_login_enabled: true } as never);

    await fetchAuthSettings();
    await updateAuthSettings({ oauth_login_enabled: true });
    const refreshed = await fetchAuthSettings();

    expect(refreshed.oauth_login_enabled).toBe(true);
    expect(get).toHaveBeenCalledTimes(2);
  });
});
