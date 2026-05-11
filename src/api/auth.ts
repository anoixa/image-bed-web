import { get, post, del } from '@/lib/request';
import type { LoginResponse, User, AuthCapabilities, OAuthProvider, OAuthIdentity } from '@/types';

// 登录
export const login = (username: string, password: string): Promise<LoginResponse> => {
  return post<LoginResponse>('/api/auth/login', { username, password });
};

// 获取当前用户信息
export const getCurrentUser = (): Promise<User> => {
  return get<User>('/api/auth/me');
};

// 刷新 Token - 使用 HttpOnly Cookie 中的 refresh_token
export const refreshToken = (): Promise<LoginResponse> => {
  return post<LoginResponse>('/api/auth/refresh');
};

// 登出
export const logout = (): Promise<void> => {
  return post('/api/auth/logout');
};

// 修改密码
export const changePassword = (oldPassword: string, newPassword: string): Promise<void> => {
  return post('/api/v1/user/password', { old_password: oldPassword, new_password: newPassword });
};

// ==================== OAuth ====================

// 获取登录能力
export const getAuthCapabilities = (): Promise<AuthCapabilities> => {
  return get<AuthCapabilities>('/api/auth/capabilities');
};

// 获取 OAuth Providers（登录页一般直接用 capabilities）
export const getOAuthProviders = (): Promise<{ providers: OAuthProvider[] }> => {
  return get<{ providers: OAuthProvider[] }>('/api/auth/oauth/providers');
};

// 获取当前用户已绑定的 OAuth 身份
export const getOAuthIdentities = (): Promise<{ identities: OAuthIdentity[] }> => {
  return get<{ identities: OAuthIdentity[] }>('/api/auth/oauth/identities');
};

// 解绑 OAuth 身份
export const unlinkOAuthIdentity = (provider: string): Promise<void> => {
  return del(`/api/auth/oauth/identities/${provider}`);
};

// 启动 OAuth 绑定（JSON 模式）
export const startOAuthLink = (provider: string, returnTo: string): Promise<{ auth_url: string }> => {
  return post<{ auth_url: string }>(`/api/auth/oauth/${provider}/link/start?return_to=${encodeURIComponent(returnTo)}&response=json`);
};
