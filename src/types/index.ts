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

// 相册类型 - 匹配后端Swagger定义 (albums.AlbumDTO)
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

// 相册详情 - 匹配后端Swagger定义 (albums.AlbumDetailResponse)
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

// Token 类型 - 匹配后端Swagger定义
export interface Token {
  id: number;
  is_active: boolean;
  hash: string;
  prefix: string;
  description?: string;
  last_used_at?: string;
  created_at: string;
}

// 创建Token请求 - 匹配后端Swagger定义 (key.req)
export interface CreateTokenRequest {
  description?: string;
}

// 创建Token响应 - 后端返回在 data 中，结构由后端决定
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

// 上传配置 (后端可能不提供，前端保留)
export interface UploadConfig {
  upload_id: string;
  chunk_size: number;
  total_chunks: number;
}

// 分片上传状态 (后端可能不提供，前端保留)
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

// 批量上传结果 - 匹配后端实际返回
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
  // 数据库状态
  database: {
    status: string;
    message?: string;
  };
  // 存储状态
  storage: {
    status: string;
    type: string;
    message?: string;
  };
  // 缓存状态
  cache: {
    status: string;
    message?: string;
  };
  // 系统运行时间
  uptime: string;
  // 内存使用
  memory: {
    used: number;
    total: number;
    usage_percent: number;
  };
  // Go 运行时信息
  go_version: string;
  goroutines: number;
  // 图片统计
  images: {
    total: number;
    public: number;
    private: number;
  };
}

// Dashboard 统计数据 - 实际后端返回的嵌套结构
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

// 配置分类 - 匹配后端Swagger定义
export type ConfigCategory = 'storage' | 'jwt' | 'system' | 'image_processing' | 'security';

// 存储配置 - 匹配后端Swagger定义
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

// 创建存储配置请求 - 匹配后端Swagger定义 (models.SystemConfigStoreRequest)
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

// 随机图片响应 - 匹配API文档
export interface RandomImageResponse {
  status: string;
  msg: string;
  data: {
    identifier: string;
    url: string;
    width: number;
    height: number;
    mime_type: string;
  };
}

// 随机图源相册配置 - 匹配API文档
export interface RandomSourceAlbumConfig {
  album_id: number | null;
  include_all_public?: boolean;
}
