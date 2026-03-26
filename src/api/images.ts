import { get, post, del, put, upload, uploadWithProgress } from '@/lib/request';
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
  format: 'json' | 'image' = 'json',
  options?: {
    albumId?: number | null;
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    requireWebp?: boolean;
    maxFileSize?: number;
  }
): Promise<RandomImageResponse['data'] | null> => {
  const params = new URLSearchParams();
  
  // format 参数：只允许 json 或 image
  if (format === 'json') {
    params.append('format', 'json');
  } else {
    params.append('format', 'image');
  }
  
  // album_id 参数：
  // - 0 表示"所有公开图片"
  // - >0 表示指定相册
  // - null/undefined 时使用后台配置的随机图源相册
  if (options?.albumId !== undefined && options?.albumId !== null) {
    params.append('album_id', String(options.albumId));
  }
  
  if (options?.minWidth) params.append('min_width', String(options.minWidth));
  if (options?.minHeight) params.append('min_height', String(options.minHeight));
  if (options?.maxWidth) params.append('max_width', String(options.maxWidth));
  if (options?.maxHeight) params.append('max_height', String(options.maxHeight));
  if (options?.requireWebp) params.append('require_webp', 'true');
  if (options?.maxFileSize) params.append('max_file_size', String(options.maxFileSize));

  const query = params.toString() ? `?${params.toString()}` : '';

  try {
    const response = await fetch(`/images/random${query}`, {
      headers: {
        Accept: 'image/webp,image/avif,image/*',
      },
    });

    // 204: 没有符合条件的随机图片
    if (response.status === 204) {
      return null;
    }
    
    // 400: 请求参数不合法
    if (response.status === 400) {
      const errorData = await response.json().catch(() => ({ msg: 'Invalid request parameters' }));
      throw new Error(errorData.msg || 'Invalid request parameters');
    }
    
    // 500: 服务端查询失败
    if (response.status === 500) {
      throw new Error('Server error');
    }

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    if (format === 'json') {
      const data: RandomImageResponse = await response.json();
      return data.data;
    }

    return null;
  } catch (error) {
    // 重新抛出错误，让调用者处理
    throw error;
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
