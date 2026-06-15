import { get, post, del, put, upload, uploadWithProgress } from '@/lib/request';
import type { ApiRequestConfig } from '@/lib/request';
import type {
  Image,
  PaginatedResponse,
  BatchDeleteResult,
  BatchUploadResult,
  UploadConfig,
  ChunkedUploadStatus,
  UploadImageResponse,
  RandomImageResponse,
  RandomSourceAlbumConfig,
  RandomImageParams,
} from '@/types';

// 图片列表查询参数 - 匹配后端Swagger定义 (images.ImageRequestBody)
export interface ImageListParams {
  page?: number;
  limit?: number;
  storage_type?: string;
  identifier?: string;
  search?: string;
  album_id?: number | null;
  start_time?: number;
  end_time?: number;
  sort?: 'asc' | 'desc';
}

// 图片列表响应结构 (images.ImageListResponse)
interface ImageListResponse {
  images: Image[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// 获取图片列表 - POST /api/v1/images
export const fetchImages = (
  params: ImageListParams = {},
  config?: ApiRequestConfig
): Promise<PaginatedResponse<Image>> => {
  return post<ImageListResponse>('/api/v1/images', {
    page: params.page || 1,
    limit: params.limit || 20,
    storage_type: params.storage_type,
    identifier: params.identifier,
    search: params.search,
    album_id: params.album_id,
    start_time: params.start_time,
    end_time: params.end_time,
    sort: params.sort || 'desc',
  }, config).then((response) => {
    const mappedItems = response.images.map((item: Image) => ({
      ...item,
      // 后端返回 id，前端使用 identifier
      identifier: item.identifier || (item as unknown as { id: string }).id,
      // 前端兼容字段
      filename: item.original_name,
      visibility: (item.is_public ? 'public' : 'private') as 'public' | 'private',
    }));
    return {
      items: mappedItems,
      total: response.total || 0,
      page: response.page || 1,
      per_page: response.limit || 20,
    };
  });
};

// 获取单张图片详情
export const fetchImageById = (identifier: string): Promise<Image> => {
  return get(`/api/v1/images/${identifier}`);
};

// 上传单张图片 - 使用 is_public 和 strategy_id
export const uploadImage = (
  file: File,
  isPublic: boolean = true,
  strategyId?: number
): Promise<UploadImageResponse> => {
  const formData = new FormData();
  formData.append('files', file);
  formData.append('is_public', String(isPublic));
  if (strategyId) {
    formData.append('strategy_id', String(strategyId));
  }
  return upload('/api/v1/images/upload', formData);
};

// 上传单张图片（带进度回调）
export const uploadImageWithProgress = (
  file: File,
  isPublic: boolean = true,
  strategyId?: number,
  onProgress?: (progress: number) => void
): Promise<UploadImageResponse> => {
  const formData = new FormData();
  formData.append('files', file);
  formData.append('is_public', String(isPublic));
  if (strategyId) {
    formData.append('strategy_id', String(strategyId));
  }
  return uploadWithProgress('/api/v1/images/upload', formData, onProgress);
};

// 批量上传图片 - 使用 is_public 和 strategy_id
export const uploadImages = (
  files: File[],
  isPublic: boolean = true,
  strategyId?: number
): Promise<BatchUploadResult> => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });
  formData.append('is_public', String(isPublic));
  if (strategyId) {
    formData.append('strategy_id', String(strategyId));
  }
  return upload('/api/v1/images/upload', formData);
};

// 批量上传图片（带进度回调）
export const uploadImagesWithProgress = (
  files: File[],
  isPublic: boolean = true,
  strategyId?: number,
  onProgress?: (progress: number) => void
): Promise<BatchUploadResult> => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });
  formData.append('is_public', String(isPublic));
  if (strategyId) {
    formData.append('strategy_id', String(strategyId));
  }
  return uploadWithProgress('/api/v1/images/upload', formData, onProgress);
};

// 删除单张图片 - DELETE /api/v1/images/{identifier}
export const deleteImage = (identifier: string): Promise<void> => {
  return del(`/api/v1/images/${identifier}`, { expectData: false });
};

// 批量删除图片 - POST /api/v1/images/delete
export const deleteImages = (identifiers: string[]): Promise<BatchDeleteResult> => {
  return post('/api/v1/images/delete', { identifiers });
};

// 修改图片可见性 - PUT /api/v1/images/{identifier}/visibility
export const updateImageVisibility = (
  identifier: string,
  isPublic: boolean
): Promise<void> => {
  return put(`/api/v1/images/${identifier}/visibility`, { is_public: isPublic }, { expectData: false });
};

// 初始化分片上传
export const initChunkedUpload = (
  filename: string,
  fileSize: number,
  mimeType: string
): Promise<UploadConfig> => {
  return post('/api/v1/images/upload/chunked/init', {
    filename,
    file_size: fileSize,
    mime_type: mimeType,
  });
};

// 上传分片
export const uploadChunk = (
  uploadId: string,
  chunkIndex: number,
  chunk: Blob
): Promise<ChunkedUploadStatus> => {
  const formData = new FormData();
  formData.append('upload_id', uploadId);
  formData.append('chunk_index', String(chunkIndex));
  formData.append('chunk', chunk);
  return upload('/api/v1/images/upload/chunked', formData);
};

// 完成分片上传
export const completeChunkedUpload = (uploadId: string): Promise<Image> => {
  return post('/api/v1/images/upload/chunked/complete', { upload_id: uploadId });
};

// 查询分片上传状态
export const getChunkedUploadStatus = (uploadId: string): Promise<ChunkedUploadStatus> => {
  return get(`/api/v1/images/upload/chunked/status?upload_id=${uploadId}`);
};

export function buildRandomImageURL(params: RandomImageParams): string {
  const query = new URLSearchParams();

  if (params.format === 'json') {
    query.set('format', 'json');
  }

  if (params.mode === 'album') {
    if (!params.albumId || params.albumId <= 0) {
      throw new Error('albumId is required when mode is "album"');
    }
    query.set('album_id', String(params.albumId));
  }

  if (params.mode === 'all') {
    query.set('album_id', '0');
  }

  if (params.minWidth) query.set('min_width', String(params.minWidth));
  if (params.minHeight) query.set('min_height', String(params.minHeight));
  if (params.maxWidth) query.set('max_width', String(params.maxWidth));
  if (params.maxHeight) query.set('max_height', String(params.maxHeight));
  if (params.requireWebP) query.set('require_webp', 'true');
  if (params.maxFileSize) query.set('max_file_size', String(params.maxFileSize));

  const qs = query.toString();
  return qs ? `/images/random?${qs}` : '/images/random';
}

// 获取公开随机图片元数据（登录页背景用，无需认证）
// GET /images/random?format=json
export const fetchRandomImage = async (
  params: Omit<RandomImageParams, 'format'>,
  signal?: AbortSignal
): Promise<RandomImageResponse['data'] | null> => {
  const url = buildRandomImageURL({ ...params, format: 'json' });

  try {
    const response = await fetch(url, {
      signal,
      headers: {
        Accept: 'application/json',
      },
    });

    // 204: 没有符合条件的随机图片
    if (response.status === 204) {
      return null;
    }

    // 403: Random API disabled
    if (response.status === 403) {
      return null;
    }

    if (!response.ok) {
      console.warn(`Random image fetch failed: HTTP ${response.status}`);
      return null;
    }

    const data: RandomImageResponse = await response.json();
    return data.data;
  } catch (error) {
    console.warn('Random image fetch error:', error);
    return null;
  }
};

// 获取随机图源相册配置（admin）- GET /api/v1/admin/random-source-album
export const fetchRandomSourceAlbum = (): Promise<RandomSourceAlbumConfig> => {
  return get<RandomSourceAlbumConfig>('/api/v1/admin/random-source-album');
};

// 设置随机图源相册（admin）- POST /api/v1/admin/random-source-album
export const updateRandomSourceAlbum = (config: RandomSourceAlbumConfig): Promise<void> => {
  return post('/api/v1/admin/random-source-album', config, { expectData: false });
};
