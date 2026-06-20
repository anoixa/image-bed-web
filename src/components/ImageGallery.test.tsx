import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ImageGallery from './ImageGallery';
import { fetchImages } from '@/api/images';

vi.mock('@/api/images', () => ({
  fetchImages: vi.fn(),
  deleteImage: vi.fn(),
  deleteImages: vi.fn(),
}));

vi.mock('@/api/albums', () => ({
  fetchAlbums: vi.fn().mockResolvedValue([]),
  removeImagesFromAlbum: vi.fn(),
}));

vi.mock('./JustifiedGallery', () => ({
  default: () => <div data-testid="gallery" />,
}));

vi.mock('react-photo-view', () => ({
  PhotoProvider: ({ children }: { children: React.ReactNode }) => children,
}));

class ImmediateIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '0px';
  readonly thresholds = [0];
  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  disconnect() {}
  observe(target: Element) {
    this.callback([
      {
        boundingClientRect: target.getBoundingClientRect(),
        intersectionRatio: 1,
        intersectionRect: target.getBoundingClientRect(),
        isIntersecting: true,
        rootBounds: null,
        target,
        time: 0,
      },
    ], this);
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  unobserve() {}
}

describe('ImageGallery initial pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('IntersectionObserver', ImmediateIntersectionObserver);
  });

  it('does not let an immediately visible loader replace the first-page request', async () => {
    vi.mocked(fetchImages).mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <ImageGallery />
      </MemoryRouter>
    );

    await waitFor(() => expect(fetchImages).toHaveBeenCalledTimes(1));
    expect(fetchImages).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        sort_by: 'created_at',
        sort: 'desc',
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
});
