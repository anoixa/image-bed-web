import { get, post, put, del } from '@/lib/request';
import type { StorageConfig, CreateStorageConfigRequest, TestConfigRequest, TestConfigResponse, ConfigCategory } from '@/types';

// 获取存储配置列表 - GET /api/v1/admin/configs
export const fetchStorageConfigs = (category?: ConfigCategory, enabledOnly?: boolean): Promise<StorageConfig[]> => {
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  if (enabledOnly !== undefined) params.append('enabled_only', String(enabledOnly));
  const query = params.toString() ? `?${params.toString()}` : '';
  return get<StorageConfig[]>(`/api/v1/admin/configs${query}`);
};

// 获取单个存储配置 - GET /api/v1/admin/configs/{id}
export const fetchStorageConfigById = (id: number, maskSensitive: boolean = true): Promise<StorageConfig> => {
  return get<StorageConfig>(`/api/v1/admin/configs/${id}?mask_sensitive=${maskSensitive}`);
};

// 创建存储配置 - POST /api/v1/admin/configs
export const createStorageConfig = (data: CreateStorageConfigRequest): Promise<StorageConfig> => {
  return post<StorageConfig>('/api/v1/admin/configs', data);
};

// 更新存储配置 - PUT /api/v1/admin/configs/{id}
export const updateStorageConfig = (id: number, data: Partial<CreateStorageConfigRequest>): Promise<StorageConfig> => {
  return put<StorageConfig>(`/api/v1/admin/configs/${id}`, data);
};

// 删除存储配置 - DELETE /api/v1/admin/configs/{id}
export const deleteStorageConfig = (id: number): Promise<void> => {
  return del(`/api/v1/admin/configs/${id}`);
};

// 设置默认配置 - POST /api/v1/admin/configs/{id}/default
export const setDefaultStorageConfig = (id: number): Promise<void> => {
  return post(`/api/v1/admin/configs/${id}/default`);
};

// 启用配置 - POST /api/v1/admin/configs/{id}/enable
export const enableStorageConfig = (id: number): Promise<void> => {
  return post(`/api/v1/admin/configs/${id}/enable`);
};

// 禁用配置 - POST /api/v1/admin/configs/{id}/disable
export const disableStorageConfig = (id: number): Promise<void> => {
  return post(`/api/v1/admin/configs/${id}/disable`);
};

// 测试配置连接 - POST /api/v1/admin/configs/{id}/test
export const testStorageConfig = (id: number): Promise<TestConfigResponse> => {
  return post<TestConfigResponse>(`/api/v1/admin/configs/${id}/test`);
};

// 测试新配置（无需保存）- POST /api/v1/admin/configs/test
export const testNewConfig = (data: TestConfigRequest): Promise<TestConfigResponse> => {
  return post<TestConfigResponse>('/api/v1/admin/configs/test', data);
};

// 获取支持的存储提供商列表 - GET /api/v1/admin/storage/providers
export const fetchStorageProviders = (): Promise<{ category: string; name: string }[]> => {
  return get('/api/v1/admin/storage/providers');
};

// 重新加载存储配置 - POST /api/v1/admin/storage/reload/{id}
export const reloadStorageConfig = (id: number): Promise<void> => {
  return post(`/api/v1/admin/storage/reload/${id}`);
};
