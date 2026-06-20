import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get, post, put } from '@/lib/request';
import type { StorageConfig } from '@/types';
import {
  createStorageConfig,
  fetchStorageConfigs,
  invalidateStorageConfigsCache,
  sanitizeStorageConfigUpdate,
  updateStorageConfig,
} from './configs';

vi.mock('@/lib/request', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

function storageConfig(id: number): StorageConfig {
  return {
    id,
    name: `Storage ${id}`,
    category: 'storage',
    is_default: id === 1,
    is_enabled: true,
    config: {},
    created_at: '2026-06-20T00:00:00Z',
    updated_at: '2026-06-20T00:00:00Z',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  invalidateStorageConfigsCache();
});

describe('sanitizeStorageConfigUpdate', () => {
  it('omits blank and masked secrets while preserving editable fields', () => {
    expect(
      sanitizeStorageConfigUpdate({
        name: 'Primary storage',
        config: {
          endpoint: 'https://storage.example.com',
          secret_access_key: '******',
          webdav_password: '',
          client_secret: '<masked>',
        },
      })
    ).toEqual({
      name: 'Primary storage',
      config: {
        endpoint: 'https://storage.example.com',
      },
    });
  });

  it('preserves a newly entered secret', () => {
    expect(
      sanitizeStorageConfigUpdate({
        config: {
          client_secret: 'new-secret-value',
        },
      })
    ).toEqual({
      config: {
        client_secret: 'new-secret-value',
      },
    });
  });
});

describe('updateStorageConfig', () => {
  beforeEach(() => {
    vi.mocked(put).mockResolvedValue({} as never);
  });

  it('does not send masked secrets to the update endpoint', async () => {
    await updateStorageConfig(7, {
      name: 'Renamed provider',
      config: {
        provider: 'github',
        client_id: 'client-id',
        client_secret: '********',
      },
    });

    expect(put).toHaveBeenCalledWith('/api/v1/admin/configs/7', {
      name: 'Renamed provider',
      config: {
        provider: 'github',
        client_id: 'client-id',
      },
    });
  });
});

describe('fetchStorageConfigs cache', () => {
  it('reuses a short-lived storage config list request by filter key', async () => {
    vi.mocked(get).mockResolvedValueOnce([storageConfig(1)] as never);

    const first = await fetchStorageConfigs('storage', true);
    const second = await fetchStorageConfigs('storage', true);

    expect(first).toBe(second);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/api/v1/admin/configs?category=storage&enabled_only=true');
  });

  it('invalidates cached storage config lists after creating a config', async () => {
    vi.mocked(get)
      .mockResolvedValueOnce([storageConfig(1)] as never)
      .mockResolvedValueOnce([storageConfig(1), storageConfig(2)] as never);
    vi.mocked(post).mockResolvedValueOnce(storageConfig(2) as never);

    await fetchStorageConfigs();
    await createStorageConfig({
      name: 'Storage 2',
      category: 'storage',
      config: {},
    });
    const refreshed = await fetchStorageConfigs();

    expect(refreshed).toHaveLength(2);
    expect(get).toHaveBeenCalledTimes(2);
  });
});
