import { get, post, put, del } from '@/lib/request';
import type { Album, AlbumDetail, AlbumImage } from '@/types';

// 相册列表响应结构
interface AlbumsResponse {
  albums: Album[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// 添加图片到相册的响应
interface AddImagesToAlbumResponse {
  album_id: number;
  added_count: number;
  failed_identifiers: string[];
}

// 从相册移除图片的响应
interface RemoveImagesFromAlbumResponse {
  album_id: number;
  removed_count: number;
  failed_identifiers: string[];
}

// 获取相册列表 - GET /api/v1/albums
export const fetchAlbums = (page: number = 1, limit: number = 20): Promise<Album[]> => {
  return get<AlbumsResponse>(`/api/v1/albums?page=${page}&limit=${limit}`).then(
    (res) => res?.albums || []
  );
};

// 获取相册详情 - GET /api/v1/albums/{id}
export const fetchAlbumById = (id: string | number): Promise<AlbumDetail> => {
  return get<AlbumDetail>(`/api/v1/albums/${id}`);
};

// 创建相册 - POST /api/v1/albums
export const createAlbum = (name: string, description: string = ''): Promise<Album> => {
  return post<Album>('/api/v1/albums', { name, description });
};

// 更新相册 - PUT /api/v1/albums/{id}
export const updateAlbum = (
  id: string | number,
  name: string,
  description: string
): Promise<Album> => {
  return put<Album>(`/api/v1/albums/${id}`, { name, description });
};

// 删除相册 - DELETE /api/v1/albums/{id}
export const deleteAlbum = (id: string | number): Promise<void> => {
  return del(`/api/v1/albums/${id}`);
};

// 添加图片到相册 - POST /api/v1/albums/{id}/images
export const addImagesToAlbum = (
  albumId: string | number,
  identifiers: string[]
): Promise<AddImagesToAlbumResponse> => {
  const url = `/api/v1/albums/${albumId}/images`;
  return post<AddImagesToAlbumResponse>(url, { identifiers });
};

// 从相册移除图片 - DELETE /api/v1/albums/{id}/images/{imageId}
export const removeImageFromAlbum = (
  albumId: string | number,
  imageId: string | number
): Promise<void> => {
  return del(`/api/v1/albums/${albumId}/images/${imageId}`);
};

// 批量从相册移除图片 - POST /api/v1/albums/{id}/images/remove
export const removeImagesFromAlbum = (
  albumId: string | number,
  identifiers: string[]
): Promise<RemoveImagesFromAlbumResponse> => {
  const url = `/api/v1/albums/${albumId}/images/remove`;
  return post<RemoveImagesFromAlbumResponse>(url, { identifiers });
};
