import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Image } from '@/types';
import JustifiedGallery from './JustifiedGallery';

class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

function makeImage(overrides: Partial<Image> = {}): Image {
  return {
    id: 1,
    identifier: 'img-1',
    original_name: 'photo.jpg',
    filename: 'photo.jpg',
    file_size: 1024,
    is_public: true,
    created_at: 1_700_000_000,
    width: 1200,
    height: 800,
    thumbnail_url: '/thumb.jpg',
    url: '/original.jpg',
    ...overrides,
  };
}

describe('JustifiedGallery recoverable states', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retries an initial load failure without reloading the page', () => {
    const onRetry = vi.fn();

    render(
      <JustifiedGallery
        images={[]}
        loading={false}
        hasMore={false}
        error="network failed"
        onRetry={onRetry}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '重新加载' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('keeps existing images visible when a refresh fails', () => {
    const onRetry = vi.fn();

    render(
      <JustifiedGallery
        images={[makeImage()]}
        loading={false}
        hasMore={true}
        error="network failed"
        onRetry={onRetry}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('刷新失败，当前显示上一次结果');
    expect(screen.getByAltText('photo.jpg')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows a scoped retry action when loading more fails', () => {
    const onRetryLoadMore = vi.fn();

    render(
      <JustifiedGallery
        images={[makeImage()]}
        loading={false}
        hasMore={true}
        error={null}
        loadMoreError="next page failed"
        onRetryLoadMore={onRetryLoadMore}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('加载更多失败');

    fireEvent.click(screen.getByRole('button', { name: '重试加载更多' }));

    expect(onRetryLoadMore).toHaveBeenCalledTimes(1);
  });
});
