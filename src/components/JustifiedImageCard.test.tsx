import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Image } from '@/types';
import JustifiedImageCard from './JustifiedImageCard';

function makeImage(overrides: Partial<Image> = {}): Image {
  return {
    id: 1,
    identifier: 'img-1',
    original_name: 'original.jpg',
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

describe('JustifiedImageCard image loading', () => {
  it('prioritizes first-screen thumbnails', () => {
    render(<JustifiedImageCard image={makeImage()} style={{}} priority />);

    const image = screen.getByAltText('photo.jpg');
    expect(image).toHaveAttribute('src', '/thumb.jpg');
    expect(image).toHaveAttribute('loading', 'eager');
    expect(image).toHaveAttribute('decoding', 'async');
    expect(image).toHaveAttribute('fetchpriority', 'high');
    expect(image).toHaveAttribute('width', '1200');
    expect(image).toHaveAttribute('height', '800');
    expect(image).toHaveAttribute('sizes');
  });

  it('keeps non-priority thumbnails lazy-loaded', () => {
    render(<JustifiedImageCard image={makeImage()} style={{}} />);

    const image = screen.getByAltText('photo.jpg');
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('fetchpriority', 'auto');
  });
});
