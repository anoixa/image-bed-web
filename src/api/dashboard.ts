import { get, post } from '@/lib/request';
import type { DashboardStats } from '@/types';

// 获取 Dashboard 统计数据
// GET /api/v1/dashboard/stats
// 响应已包含在 data 字段中，request 库会自动提取
export const fetchDashboardStats = (): Promise<DashboardStats> => {
  return get<DashboardStats>('/api/v1/dashboard/stats');
};

// 刷新统计数据缓存
// POST /api/v1/dashboard/stats/refresh
export const refreshDashboardStats = (): Promise<void> => {
  return post('/api/v1/dashboard/stats/refresh');
};
