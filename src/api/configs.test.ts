import { beforeEach, describe, expect, it, vi } from 'vitest';
import { put } from '@/lib/request';
import { sanitizeStorageConfigUpdate, updateStorageConfig } from './configs';

vi.mock('@/lib/request', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

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
