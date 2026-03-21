import { get, put } from '@/lib/request';
import type { SystemInfo, HealthCheck, SystemStatus, ConversionConfig, UpdateConversionRequest } from '@/types';

// 获取版本信息
export const fetchVersion = (): Promise<SystemInfo> => {
  return get('/version');
};

// 健康检查
export const healthCheck = (): Promise<HealthCheck> => {
  return get('/health');
};

// 获取系统状态
export const fetchSystemStatus = (): Promise<SystemStatus> => {
  return get('/system/status');
};

// 获取转换配置 - GET /api/v1/admin/conversion
export const fetchConversionConfig = (): Promise<ConversionConfig> => {
  return get<ConversionConfig>('/api/v1/admin/conversion');
};

// 更新转换配置 - PUT /api/v1/admin/conversion
export const updateConversionConfig = (data: UpdateConversionRequest): Promise<{ message: string }> => {
  return put<{ message: string }>('/api/v1/admin/conversion', data);
};
