export interface ApiResponse<T = unknown> {
  status: 'success' | 'error';
  msg?: string;
  data?: T;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
}

export interface ImageLinks {
  original: string;
  thumbnail?: string;
  url?: string;
  thumbnail_url?: string;
  html?: string;
  bbcode?: string;
  markdown?: string;
  markdown_with_link?: string;
}

export interface Image {
  id: number;
  identifier: string;
  original_name: string;
  file_size: number;
  mime_type?: string;
  width?: number;
  height?: number;
  is_public: boolean;
  url?: string;
  thumbnail_url?: string;
  created_at: number;
  album_id?: number | null;
  visibility?: 'public' | 'private';
  filename?: string;
  links?: ImageLinks;
  variants?: ImageVariant[];
}

export interface UploadImageResponse {
  identifier: string;
  filename: string;
  file_size: number;
  links: ImageLinks;
}

export interface ImageVariant {
  format: string;
  identifier: string;
  file_size: number;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

// 相册类型
export interface Album {
  id: number;
  name: string;
  description: string;
  cover_url?: string;
  image_count: number;
  created_at: number;
  updated_at?: number;
  // 前端兼容字段
  cover_image?: string;
}

// 相册详情
export interface AlbumDetail extends Album {
  images: AlbumImage[];
}

// 相册中的图片 (albums.AlbumImageDTO)
export interface AlbumImage {
  id: number;
  original_name: string;
  url: string;
  file_size: number;
  width?: number;
  height?: number;
  mime_type?: string;
  created_at: number;
}

// Token 类型 
export interface Token {
  id: number;
  is_active: boolean;
  hash: string;
  prefix: string;
  description?: string;
  last_used_at?: number;
  created_at: number;
}

// 创建Token请求
export interface CreateTokenRequest {
  description?: string;
}

// 创建Token响应
export interface CreateTokenResponse {
  token: string;
  hash: string;
}

// 登录响应 - 匹配后端Swagger定义 (api.loginResponse)
export interface LoginResponse {
  access_token: string;
  access_token_expiry: number;
}

// 用户
export interface User {
  id: number;
  username: string;
}

// 上传配置
export interface UploadConfig {
  upload_id: string;
  chunk_size: number;
  total_chunks: number;
}

// 分片上传状态
export interface ChunkedUploadStatus {
  upload_id: string;
  total_chunks: number;
  received_chunks: number[];
  missing_chunks: number[];
}

// 批量删除结果 (后端返回通用响应，前端自行统计)
export interface BatchDeleteResult {
  deleted_count: number;
}

// 批量上传结果
export interface BatchUploadResult {
  message: string;
  total_files: number;
  success_count: number;
  error_count: number;
  success: Array<{
    identifier: string;
    filename: string;
    file_size: number;
    links: ImageLinks;
  }>;
  errors: Array<{
    filename: string;
    error: string;
  }>;
}

// 系统信息
export interface SystemInfo {
  version: string;
  commit: string;
}

// 健康检查
export interface HealthCheck {
  status: string;
  uptime: string;
  version: string;
  commit: string;
  checks: {
    database: string;
    cache: string;
    storage: string;
  };
}

// 系统状态
export interface SystemStatus {
  version: string;
  commit_hash: string;
  go_version: string;
  environment: string;
  cache: {
    provider: string;
    type: string;
  };
  data_dir: {
    path: string;
    file_count: number;
    total_size: number;
    size_str: string;
  };
  memory: {
    heap_alloc_mb: number;
    heap_alloc_str: string;
    heap_sys_mb: number;
    heap_sys_str: string;
    heap_in_use_mb: number;
    heap_in_use_str: string;
    gc_sys_mb: number;
    gc_sys_str: string;
    stack_sys_mb: number;
    stack_sys_str: string;
    total_alloc_mb: number;
    total_alloc_str: string;
    rss_mb: number;
    rss_str: string;
    last_gc_time: number;
    num_gc: number;
    goroutines: number;
    vips_mem_mb: number;
    vips_mem_str: string;
    vips_mem_high_mb: number;
    vips_mem_high_str: string;
    vips_allocs: number;
    vips_open_files: number;
  };
  runtime: {
    num_cpu: number;
  };
}

// Dashboard 统计数据
export interface DashboardStats {
  overview: {
    images: {
      total: number;
      today: number;
      yesterday: number;
      this_week: number;
      this_month: number;
    };
    albums: {
      total: number;
    };
    users: {
      total: number;
    };
    storage: {
      total_size: number;
      total_size_human: string;
    };
  };
  storage_stats: StorageStat[];
  trend: {
    period: string;
    dates: string[];
    data: number[];
  };
}

// 存储统计
export interface StorageStat {
  storage_id: number;
  storage_name: string;
  count: number;
  size: number;
  size_human: string;
  percentage: number;
}

// 配置分类
export type ConfigCategory = 'storage' | 'jwt' | 'system' | 'image_processing' | 'security';

// 存储配置
export interface StorageConfig {
  id: number;
  name: string;
  category: ConfigCategory;
  is_default: boolean;
  is_enabled: boolean;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  description?: string;
  priority?: number;
  // 前端兼容字段
  key?: string;
  created_by?: number;
}

// 创建存储配置请求
export interface CreateStorageConfigRequest {
  name: string;
  category: ConfigCategory;
  config: Record<string, unknown>;
  is_enabled?: boolean;
  is_default?: boolean;
  description?: string;
  priority?: number;
}

// 测试配置请求 (models.TestConfigRequest)
export interface TestConfigRequest {
  category: ConfigCategory;
  config: Record<string, unknown>;
}

// 测试配置响应 (models.TestConfigResponse)
export interface TestConfigResponse {
  success: boolean;
  message?: string;
}

// 随机图片响应
export interface RandomImageResponse {
  status: string;
  msg: string;
  data: {
    id: number;
    identifier: string;
    url: string;
    width: number;
    height: number;
    size: number;
    mime_type: string;
    is_public: boolean;
    created_at: string;
    variant?: {
      identifier: string;
      format: string;
      url: string;
    };
  };
}

// 随机图源相册配置
export interface RandomSourceAlbumConfig {
  album_id: number | null;
  include_all_public?: boolean;
}

// Transfer Mode 类型
export type TransferMode = 'auto' | 'always_proxy' | 'always_direct';

// Transfer Mode 配置
export interface TransferModeConfig {
  mode: TransferMode;
  updated_at?: string;
}

// Transfer Mode 配置请求
export interface TransferModeRequest {
  mode: TransferMode;
}

// MinIO 存储配置扩展（用于前端表单）
export interface MinIOConfig {
  type: 'minio';
  endpoint: string;
  bucket_name: string;
  access_key_id: string;
  secret_access_key: string;
  use_ssl?: string;
  // Direct Link 相关配置
  enable_direct_link?: boolean;
  public_endpoint?: string;
  is_public_bucket?: boolean;
}

// 缩略图尺寸
export interface ThumbnailSize {
  name: string;
  width: number;
  height: number;
}

// 转换配置（合并后的配置）
export interface ConversionConfig {
  // 缩略图设置
  thumbnail_enabled: boolean;
  thumbnail_sizes: ThumbnailSize[];
  thumbnail_quality: number;
  // 格式转换设置
  conversion_enabled_formats: string[];
  webp_quality: number;
  webp_effort: number;
  avif_quality: number;
  avif_speed: number;
  avif_experimental: boolean;
  // 处理限制
  skip_smaller_than: number;
  max_dimension: number;
  // 上传设置
  default_album_id: number;
  default_visibility: 'public' | 'private';
  concurrent_upload_limit: number;
  max_file_size_mb: number;
  max_batch_total_mb: number;
  // 功能开关
  api_key_enabled: boolean;
}

// 更新转换配置请求
export type UpdateConversionRequest = Partial<ConversionConfig>;
