import { get } from '@/lib/request';
import type { SystemInfo, HealthCheck } from '@/types';

// 获取版本信息
export const fetchVersion = (): Promise<SystemInfo> => {
  return get('/version');
};

// 健康检查
export const healthCheck = (): Promise<HealthCheck> => {
  return get('/health');
};
