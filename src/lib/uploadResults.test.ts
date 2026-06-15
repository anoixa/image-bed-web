import { describe, expect, it } from 'vitest';
import type { BatchUploadResult } from '@/types';
import { reconcileBatchUploadResults } from './uploadResults';

describe('reconcileBatchUploadResults', () => {
  it('maps partial batch results back to the matching files', () => {
    const result: BatchUploadResult = {
      message: 'partial success',
      total_files: 3,
      success_count: 2,
      error_count: 1,
      success: [
        { identifier: 'a-id', filename: 'a.jpg', file_size: 10, links: { original: '/a' } },
        { identifier: 'c-id', filename: 'c.jpg', file_size: 30, links: { original: '/c' } },
      ],
      errors: [{ filename: 'b.jpg', error: 'invalid image' }],
    };

    const reconciled = reconcileBatchUploadResults(
      [
        { id: 'a', filename: 'a.jpg' },
        { id: 'b', filename: 'b.jpg' },
        { id: 'c', filename: 'c.jpg' },
      ],
      result
    );

    expect(reconciled.updates.get('a')?.status).toBe('success');
    expect(reconciled.updates.get('b')).toMatchObject({
      status: 'error',
      errorMessage: 'invalid image',
    });
    expect(reconciled.updates.get('c')?.status).toBe('success');
    expect(reconciled.uploadedImages.map((image) => image.filename)).toEqual(['a.jpg', 'c.jpg']);
  });

  it('marks files with no server result as errors', () => {
    const result: BatchUploadResult = {
      message: 'incomplete response',
      total_files: 1,
      success_count: 0,
      error_count: 0,
      success: [],
      errors: [],
    };

    const reconciled = reconcileBatchUploadResults([{ id: 'a', filename: 'a.jpg' }], result);

    expect(reconciled.updates.get('a')).toMatchObject({
      status: 'error',
      errorMessage: '服务器未返回该文件的上传结果',
    });
  });
});
