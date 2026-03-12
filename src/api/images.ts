import { get, post, del, put, upload } from '@/lib/request';
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
export const fetchImages = (params: ImageListParams = {}): Promise<PaginatedResponse<Image>> => {
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
  }).then((response) => {
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
  formData.append('file', file);
  formData.append('is_public', String(isPublic));
  if (strategyId) {
    formData.append('strategy_id', String(strategyId));
  }
  return upload('/api/v1/images/upload', formData);
};

// 批量上传图片 - 使用 is_public 和 strategy_id
export const uploadImages = (
  files: File[],
  isPublic: boolean = true,
  strategyId?: number
): Promise<BatchUploadResult> => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files[]', file);
  });
  formData.append('is_public', String(isPublic));
  if (strategyId) {
    formData.append('strategy_id', String(strategyId));
  }
  return upload('/api/v1/images/uploads', formData);
};

// 删除单张图片 - DELETE /api/v1/images/{identifier}
export const deleteImage = (identifier: string): Promise<void> => {
  return del(`/api/v1/images/${identifier}`);
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
  return put(`/api/v1/images/${identifier}/visibility`, { is_public: isPublic });
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

// 获取公开随机图片（登录页背景用，无需认证）
// GET /images/random
export const fetchRandomImage = async (
  format: 'json' | 'binary' = 'json',
  options?: {
    minWidth?: number;
    minHeight?: number;
  }
): Promise<RandomImageResponse['data'] | null> => {
  const params = new URLSearchParams();
  if (format === 'json') params.append('format', 'json');
  if (options?.minWidth) params.append('min_width', String(options.minWidth));
  if (options?.minHeight) params.append('min_height', String(options.minHeight));

  const query = params.toString() ? `?${params.toString()}` : '';

  try {
    const response = await fetch(`/images/random${query}`, {
      headers: {
        Accept: 'image/webp,image/avif,image/*',
      },
    });

    if (response.status === 204) {
      return null; // 无可用图片
    }

    if (!response.ok) {
      return null;
    }

    if (format === 'json') {
      const data: RandomImageResponse = await response.json();
      return data.data;
    }

    return null;
  } catch {
    return null;
  }
};

// 获取随机图源相册配置（admin）- GET /api/v1/admin/random-source-album
export const fetchRandomSourceAlbum = (): Promise<RandomSourceAlbumConfig> => {
  return get<RandomSourceAlbumConfig>('/api/v1/admin/random-source-album');
};

// 设置随机图源相册（admin）- POST /api/v1/admin/random-source-album
export const updateRandomSourceAlbum = (albumId: number | null, includeAllPublic?: boolean): Promise<void> => {
  return post('/api/v1/admin/random-source-album', {
    album_id: albumId,
    include_all_public: includeAllPublic,
  });
};
