import type { CSSProperties } from 'react';
import type { Image } from '@/types';

const ROW_HEIGHT = 200;
export const GALLERY_GAP = 10;

export interface GalleryRow {
  images: Image[];
  rowStyle: CSSProperties;
  imageStyles: CSSProperties[];
}

export function buildGalleryRows(images: Image[], containerWidth: number): GalleryRow[] {
  const effectiveWidth = containerWidth > 0 ? containerWidth : 800;
  if (images.length === 0) return [];

  const groupedRows: Image[][] = [];
  let currentRow: Image[] = [];
  let currentRowWidth = 0;

  for (const image of images) {
    const aspectRatio = (image.width || 1) / (image.height || 1);
    const imageWidth = ROW_HEIGHT * aspectRatio;
    const wouldExceed = currentRowWidth + imageWidth
      + (currentRow.length > 0 ? GALLERY_GAP : 0) > effectiveWidth;

    if (wouldExceed && currentRow.length > 0) {
      groupedRows.push(currentRow);
      currentRow = [image];
      currentRowWidth = imageWidth;
    } else {
      currentRow.push(image);
      currentRowWidth += imageWidth + (currentRow.length > 1 ? GALLERY_GAP : 0);
    }
  }

  if (currentRow.length > 0) {
    groupedRows.push(currentRow);
  }

  return groupedRows.map((row, rowIndex) => {
    const originalWidths = row.map((image) => {
      const aspectRatio = (image.width || 1) / (image.height || 1);
      return ROW_HEIGHT * aspectRatio;
    });
    const totalOriginalWidth = originalWidths.reduce((sum, width) => sum + width, 0);
    const totalGap = (row.length - 1) * GALLERY_GAP;
    const scale = (effectiveWidth - totalGap) / totalOriginalWidth;
    const isLastRow = rowIndex === groupedRows.length - 1;
    const rowTotalWidth = totalOriginalWidth * scale + totalGap;
    const keepOriginalSize = isLastRow && rowTotalWidth < effectiveWidth * 0.8;

    return {
      images: row,
      rowStyle: row.length === 1 && scale > 3
        ? { height: ROW_HEIGHT, justifyContent: 'flex-start' }
        : { height: ROW_HEIGHT },
      imageStyles: originalWidths.map((originalWidth) => keepOriginalSize
        ? { height: ROW_HEIGHT, width: originalWidth, flexShrink: 0 }
        : { height: ROW_HEIGHT, flexGrow: originalWidth * scale, flexBasis: 0 }),
    };
  });
}
