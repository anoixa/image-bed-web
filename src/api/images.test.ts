import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { buildRandomImageURL, fetchImages } from './images';
import { server } from '@/test/server';

describe('buildRandomImageURL', () => {
  it('builds an album request with optional filters', () => {
    expect(
      buildRandomImageURL({
        mode: 'album',
        albumId: 42,
        format: 'json',
        minWidth: 800,
        requireWebP: true,
      })
    ).toBe('/images/random?format=json&album_id=42&min_width=800&require_webp=true');
  });

  it('rejects album mode without a valid album id', () => {
    expect(() => buildRandomImageURL({ mode: 'album' })).toThrow(
      'albumId is required when mode is "album"'
    );
  });
});

describe('fetchImages', () => {
  it('passes visibility filters through as is_public', async () => {
    let requestBody: unknown;
    server.use(
      http.post('*/api/v1/images', async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({
          status: 'success',
          data: {
            images: [],
            total: 0,
            page: 1,
            limit: 20,
            total_pages: 0,
          },
        });
      })
    );

    await fetchImages({ page: 1, limit: 20, is_public: false });

    expect(requestBody).toMatchObject({ is_public: false });
  });
});
