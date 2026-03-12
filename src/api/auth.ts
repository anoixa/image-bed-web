import { post } from '@/lib/request';
import type { LoginResponse } from '@/types';

// 登录
export const login = (username: string, password: string): Promise<LoginResponse> => {
  return post<LoginResponse>('/api/auth/login', { username, password });
};

// 刷新 Token - 使用 HttpOnly Cookie 中的 refresh_token
export const refreshToken = (): Promise<LoginResponse> => {
  return post<LoginResponse>('/api/auth/refresh');
};

// 登出
export const logout = (): Promise<void> => {
  return post('/api/auth/logout');
};
