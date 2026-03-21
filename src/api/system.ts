import { get, put } from '@/lib/request';
import type { SystemInfo, HealthCheck, SystemStatus, SystemSettings, UpdateSettingsRequest } from '@/types';

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

// 获取系统设置 - GET /api/v1/admin/settings
export const fetchSystemSettings = (): Promise<SystemSettings> => {
  return get<SystemSettings>('/api/v1/admin/settings');
};

// 更新系统设置 - PUT /api/v1/admin/settings
export const updateSystemSettings = (data: UpdateSettingsRequest): Promise<SystemSettings> => {
  return put<SystemSettings>('/api/v1/admin/settings', data);
};
