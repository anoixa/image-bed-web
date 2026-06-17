export type GalleryVisibilityFilter = 'all' | 'public' | 'private';
export type GalleryAlbumFilter = number | 'all';
export type GallerySortBy = 'created_at' | 'file_size';
export type GallerySortOrder = 'asc' | 'desc';

export interface GalleryFilters {
  visibility: GalleryVisibilityFilter;
  album: GalleryAlbumFilter;
  sortBy: GallerySortBy;
  sortOrder: GallerySortOrder;
}

export const DEFAULT_GALLERY_FILTERS: GalleryFilters = {
  visibility: 'all',
  album: 'all',
  sortBy: 'created_at',
  sortOrder: 'desc',
};

function parsePositiveInteger(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseGalleryFilters(params: URLSearchParams): GalleryFilters {
  const visibility = params.get('visibility');
  const albumId = parsePositiveInteger(params.get('album_id'));
  const sortBy = params.get('sort_by');
  const sortOrder = params.get('sort');

  return {
    visibility: visibility === 'public' || visibility === 'private'
      ? visibility
      : DEFAULT_GALLERY_FILTERS.visibility,
    album: albumId ?? DEFAULT_GALLERY_FILTERS.album,
    sortBy: sortBy === 'file_size' ? sortBy : DEFAULT_GALLERY_FILTERS.sortBy,
    sortOrder: sortOrder === 'asc' ? sortOrder : DEFAULT_GALLERY_FILTERS.sortOrder,
  };
}

export function applyGalleryFiltersToParams(
  params: URLSearchParams,
  filters: Partial<GalleryFilters>
): URLSearchParams {
  const nextParams = new URLSearchParams(params);
  nextParams.delete('page');

  if (filters.visibility !== undefined) {
    if (filters.visibility === 'all') {
      nextParams.delete('visibility');
    } else {
      nextParams.set('visibility', filters.visibility);
    }
  }

  if (filters.album !== undefined) {
    if (filters.album === 'all') {
      nextParams.delete('album_id');
    } else {
      nextParams.set('album_id', String(filters.album));
    }
  }

  if (filters.sortBy !== undefined) {
    if (filters.sortBy === DEFAULT_GALLERY_FILTERS.sortBy) {
      nextParams.delete('sort_by');
    } else {
      nextParams.set('sort_by', filters.sortBy);
    }
  }

  if (filters.sortOrder !== undefined) {
    if (filters.sortOrder === DEFAULT_GALLERY_FILTERS.sortOrder) {
      nextParams.delete('sort');
    } else {
      nextParams.set('sort', filters.sortOrder);
    }
  }

  return nextParams;
}
