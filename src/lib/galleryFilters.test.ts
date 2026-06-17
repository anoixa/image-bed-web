import { describe, expect, it } from 'vitest';
import { applyGalleryFiltersToParams, parseGalleryFilters } from './galleryFilters';

describe('gallery filter URL state', () => {
  it('parses recoverable filter state from URL params', () => {
    const filters = parseGalleryFilters(
      new URLSearchParams('visibility=private&album_id=12&sort_by=file_size&sort=asc&page=3')
    );

    expect(filters).toEqual({
      visibility: 'private',
      album: 12,
      sortBy: 'file_size',
      sortOrder: 'asc',
      page: 3,
    });
  });

  it('writes non-default filters and keeps unrelated params', () => {
    const params = applyGalleryFiltersToParams(new URLSearchParams('search=logo'), {
      visibility: 'public',
      album: 5,
      sortBy: 'file_size',
      sortOrder: 'asc',
      page: 2,
    });

    expect(params.toString()).toBe(
      'search=logo&visibility=public&album_id=5&sort_by=file_size&sort=asc&page=2'
    );
  });

  it('removes defaults from the URL', () => {
    const params = applyGalleryFiltersToParams(
      new URLSearchParams('search=logo&visibility=public&album_id=5&sort_by=file_size&sort=asc&page=2'),
      {
        visibility: 'all',
        album: 'all',
        sortBy: 'created_at',
        sortOrder: 'desc',
        page: 1,
      }
    );

    expect(params.toString()).toBe('search=logo');
  });
});
