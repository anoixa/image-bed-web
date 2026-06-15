import type { BatchUploadResult, UploadImageResponse } from '@/types';

interface PendingUpload {
  id: string;
  filename: string;
}

export interface UploadStatusUpdate {
  status: 'success' | 'error';
  progress: number;
  result?: UploadImageResponse;
  errorMessage?: string;
}

export interface ReconciledUploadResults {
  updates: Map<string, UploadStatusUpdate>;
  uploadedImages: UploadImageResponse[];
}

export function reconcileBatchUploadResults(
  pendingFiles: PendingUpload[],
  result: BatchUploadResult
): ReconciledUploadResults {
  const pendingByFilename = new Map<string, PendingUpload[]>();
  const updates = new Map<string, UploadStatusUpdate>();
  const uploadedImages: UploadImageResponse[] = [];

  pendingFiles.forEach((file) => {
    const queue = pendingByFilename.get(file.filename) ?? [];
    queue.push(file);
    pendingByFilename.set(file.filename, queue);
  });

  const takePendingFile = (filename: string) => pendingByFilename.get(filename)?.shift();

  result.success.forEach((item) => {
    const pending = takePendingFile(item.filename);
    if (!pending) return;

    const image: UploadImageResponse = {
      identifier: item.identifier,
      filename: item.filename,
      file_size: item.file_size,
      links: item.links,
    };
    uploadedImages.push(image);
    updates.set(pending.id, { status: 'success', progress: 100, result: image });
  });

  result.errors.forEach((item) => {
    const pending = takePendingFile(item.filename);
    if (!pending) return;

    updates.set(pending.id, {
      status: 'error',
      progress: 0,
      errorMessage: item.error || '上传失败',
    });
  });

  pendingByFilename.forEach((queue) => {
    queue.forEach((pending) => {
      updates.set(pending.id, {
        status: 'error',
        progress: 0,
        errorMessage: '服务器未返回该文件的上传结果',
      });
    });
  });

  return { updates, uploadedImages };
}
