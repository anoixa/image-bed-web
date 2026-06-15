import { describe, expect, it } from 'vitest';
import { buildRandomImageURL } from './images';

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
