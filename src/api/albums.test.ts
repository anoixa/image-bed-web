import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get, post } from '@/lib/request';
import type { Album } from '@/types';
import { createAlbum, fetchAlbums, invalidateAlbumsCache } from './albums';

vi.mock('@/lib/request', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

function album(id: number): Album {
  return {
    id,
    name: `Album ${id}`,
    description: '',
    image_count: 0,
    created_at: 1_700_000_000,
  };
}

describe('fetchAlbums cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateAlbumsCache();
  });

  it('reuses a short-lived album list request', async () => {
    vi.mocked(get).mockResolvedValueOnce({
      albums: [album(1)],
      total: 1,
      page: 1,
      limit: 20,
      total_pages: 1,
    } as never);

    const first = await fetchAlbums();
    const second = await fetchAlbums();

    expect(first).toBe(second);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/api/v1/albums?page=1&limit=20', undefined);
  });

  it('bypasses the cache when an abort signal is supplied', async () => {
    vi.mocked(get)
      .mockResolvedValueOnce({ albums: [album(1)] } as never)
      .mockResolvedValueOnce({ albums: [album(2)] } as never);

    const controller = new AbortController();
    await fetchAlbums(1, 20, { signal: controller.signal });
    await fetchAlbums(1, 20, { signal: controller.signal });

    expect(get).toHaveBeenCalledTimes(2);
  });

  it('invalidates cached albums after creating an album', async () => {
    vi.mocked(get)
      .mockResolvedValueOnce({ albums: [album(1)] } as never)
      .mockResolvedValueOnce({ albums: [album(1), album(2)] } as never);
    vi.mocked(post).mockResolvedValueOnce(album(2) as never);

    await fetchAlbums();
    await createAlbum('Album 2');
    const albums = await fetchAlbums();

    expect(albums).toHaveLength(2);
    expect(get).toHaveBeenCalledTimes(2);
  });
});
