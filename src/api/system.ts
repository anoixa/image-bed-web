import { get } from '@/lib/request';
import type { SystemInfo, HealthCheck, SystemStatus } from '@/types';

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
