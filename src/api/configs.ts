import { get, post, put, del } from '@/lib/request';
import { createPromiseCache } from '@/lib/apiCache';
import type { StorageConfig, CreateStorageConfigRequest, TestConfigRequest, TestConfigResponse, ConfigCategory, TransferModeConfig, TransferModeRequest } from '@/types';

const MASKED_SECRET_PATTERN = /^(?:\*+|•+|●+|x+|<masked>|masked|redacted)$/i;
const SENSITIVE_CONFIG_KEY_PATTERN = /(?:secret|password|token|private_key|api_key)/i;
const storageConfigsCache = createPromiseCache<StorageConfig[]>();

export function invalidateStorageConfigsCache() {
  storageConfigsCache.invalidate();
}

export function isMaskedSensitiveValue(value: unknown): boolean {
  return typeof value === 'string' && MASKED_SECRET_PATTERN.test(value.trim());
}

export function sanitizeStorageConfigUpdate(
  data: Partial<CreateStorageConfigRequest>
): Partial<CreateStorageConfigRequest> {
  if (!data.config) {
    return data;
  }

  const config = Object.fromEntries(
    Object.entries(data.config).filter(([key, value]) => {
      if (!SENSITIVE_CONFIG_KEY_PATTERN.test(key)) {
        return true;
      }
      return value !== '' && value !== null && value !== undefined && !isMaskedSensitiveValue(value);
    })
  );
  const sanitized = { ...data };

  if (Object.keys(config).length > 0) {
    sanitized.config = config;
  } else {
    delete sanitized.config;
  }

  return sanitized;
}

// 获取存储配置列表 - GET /api/v1/admin/configs
export const fetchStorageConfigs = (category?: ConfigCategory, enabledOnly?: boolean): Promise<StorageConfig[]> => {
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  if (enabledOnly !== undefined) params.append('enabled_only', String(enabledOnly));
  const query = params.toString() ? `?${params.toString()}` : '';
  return storageConfigsCache.get(`${category ?? 'all'}:${enabledOnly ?? 'all'}`, () => (
    get<StorageConfig[]>(`/api/v1/admin/configs${query}`)
  ));
};

// 获取单个存储配置 - GET /api/v1/admin/configs/{id}
export const fetchStorageConfigById = (id: number, maskSensitive: boolean = true): Promise<StorageConfig> => {
  return get<StorageConfig>(`/api/v1/admin/configs/${id}?mask_sensitive=${maskSensitive}`);
};

// 创建存储配置 - POST /api/v1/admin/configs
export const createStorageConfig = (data: CreateStorageConfigRequest): Promise<StorageConfig> => {
  return post<StorageConfig>('/api/v1/admin/configs', data).then((config) => {
    invalidateStorageConfigsCache();
    return config;
  });
};

// 更新存储配置 - PUT /api/v1/admin/configs/{id}
export const updateStorageConfig = (id: number, data: Partial<CreateStorageConfigRequest>): Promise<StorageConfig> => {
  return put<StorageConfig>(`/api/v1/admin/configs/${id}`, sanitizeStorageConfigUpdate(data)).then((config) => {
    invalidateStorageConfigsCache();
    return config;
  });
};

// 删除存储配置 - DELETE /api/v1/admin/configs/{id}
export const deleteStorageConfig = (id: number): Promise<void> => {
  return del<void>(`/api/v1/admin/configs/${id}`, { expectData: false }).then((result) => {
    invalidateStorageConfigsCache();
    return result;
  });
};

// 设置默认配置 - POST /api/v1/admin/configs/{id}/default
export const setDefaultStorageConfig = (id: number): Promise<void> => {
  return post<void>(`/api/v1/admin/configs/${id}/default`, undefined, { expectData: false }).then((result) => {
    invalidateStorageConfigsCache();
    return result;
  });
};

// 启用配置 - POST /api/v1/admin/configs/{id}/enable
export const enableStorageConfig = (id: number): Promise<void> => {
  return post<void>(`/api/v1/admin/configs/${id}/enable`, undefined, { expectData: false }).then((result) => {
    invalidateStorageConfigsCache();
    return result;
  });
};

// 禁用配置 - POST /api/v1/admin/configs/{id}/disable
export const disableStorageConfig = (id: number): Promise<void> => {
  return post<void>(`/api/v1/admin/configs/${id}/disable`, undefined, { expectData: false }).then((result) => {
    invalidateStorageConfigsCache();
    return result;
  });
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
  return post<void>(`/api/v1/admin/storage/reload/${id}`, undefined, { expectData: false }).then((result) => {
    invalidateStorageConfigsCache();
    return result;
  });
};

// 获取全局 Transfer Mode 配置 - GET /api/v1/admin/transfer-mode
export const fetchTransferMode = (): Promise<TransferModeConfig> => {
  return get<TransferModeConfig>('/api/v1/admin/transfer-mode');
};

// 更新全局 Transfer Mode 配置 - POST /api/v1/admin/transfer-mode
export const updateTransferMode = (data: TransferModeRequest): Promise<TransferModeConfig> => {
  return post<TransferModeConfig>('/api/v1/admin/transfer-mode', data);
};
