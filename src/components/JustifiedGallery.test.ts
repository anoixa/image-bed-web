import { describe, expect, it } from 'vitest';
import type { Image } from '@/types';
import { buildGalleryRows } from './justifiedGalleryLayout';

const image = (id: number, width: number, height: number) => ({
  id,
  identifier: String(id),
  width,
  height,
}) as Image;

describe('buildGalleryRows', () => {
  it('precomputes proportional card widths once per row', () => {
    const rows = buildGalleryRows([
      image(1, 400, 200),
      image(2, 200, 200),
    ], 1000);

    expect(rows).toHaveLength(1);
    expect(rows[0].imageStyles[0].flexGrow).toBeCloseTo(660);
    expect(rows[0].imageStyles[1].flexGrow).toBeCloseTo(330);
  });

  it('keeps the existing single-image row alignment limit', () => {
    const rows = buildGalleryRows([image(1, 100, 100)], 800);

    expect(rows[0].rowStyle).toEqual({
      height: 200,
      justifyContent: 'flex-start',
    });
  });
});
