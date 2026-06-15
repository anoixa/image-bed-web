import { get, post, put, del } from '@/lib/request';
import type {
  LoginResponse,
  LoginSuccessResponse,
  User,
  AuthCapabilities,
  OAuthProvider,
  OAuthIdentity,
  TwoFAStatus,
  TwoFASetupResponse,
  TwoFASetupRequest,
  TwoFAToggleRequest,
  TwoFAVerifyRequest,
} from '@/types';

// 登录
export const login = (username: string, password: string): Promise<LoginResponse> => {
  return post<LoginResponse>('/api/auth/login', { username, password });
};

// 获取当前用户信息
export const getCurrentUser = (): Promise<User> => {
  return get<User>('/api/auth/me');
};

// 刷新 Token - 使用 HttpOnly Cookie 中的 refresh_token
export const refreshToken = (): Promise<LoginSuccessResponse> => {
  return post<LoginSuccessResponse>('/api/auth/refresh');
};

// 登出
export const logout = (): Promise<void> => {
  return post('/api/auth/logout', undefined, { expectData: false });
};

// 修改密码
export const changePassword = (oldPassword: string, newPassword: string): Promise<void> => {
  return post('/api/v1/user/password', { old_password: oldPassword, new_password: newPassword }, { expectData: false });
};

// ==================== 2FA ====================

// 提交两步验证码登录
export const verify2FA = (data: TwoFAVerifyRequest): Promise<LoginSuccessResponse> => {
  return post<LoginSuccessResponse>('/api/auth/login/2fa', data);
};

// 获取当前用户 2FA 状态
export const get2FAStatus = (): Promise<TwoFAStatus> => {
  return get<TwoFAStatus>('/api/v1/user/2fa');
};

// 初始化 2FA 设置
export const setup2FA = (data: TwoFASetupRequest): Promise<TwoFASetupResponse> => {
  return post<TwoFASetupResponse>('/api/v1/user/2fa/setup', data);
};

// 启用 2FA
export const enable2FA = (data: TwoFAToggleRequest): Promise<void> => {
  return post('/api/v1/user/2fa/enable', data, { expectData: false });
};

// 关闭 2FA
export const disable2FA = (data: TwoFAToggleRequest): Promise<void> => {
  return post('/api/v1/user/2fa/disable', data, { expectData: false });
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
  return del(`/api/auth/oauth/identities/${provider}`, { expectData: false });
};

// 启动 OAuth 绑定（JSON 模式）
export const startOAuthLink = (provider: string, returnTo: string): Promise<{ auth_url: string }> => {
  return post<{ auth_url: string }>(`/api/auth/oauth/${provider}/link/start?return_to=${encodeURIComponent(returnTo)}&response=json`);
};

// ==================== Admin Auth Settings ====================

export interface AuthSettings {
  password_login_enabled: boolean;
  oauth_login_enabled: boolean;
  providers: OAuthProvider[];
  callback_urls: Record<string, string>;
}

export interface UpdateAuthSettingsRequest {
  password_login_enabled?: boolean;
  oauth_login_enabled?: boolean;
}

// 获取管理员登录设置
export const fetchAuthSettings = (): Promise<AuthSettings> => {
  return get<AuthSettings>('/api/v1/admin/auth/settings');
};

// 更新管理员登录设置
export const updateAuthSettings = (data: UpdateAuthSettingsRequest): Promise<AuthSettings> => {
  return put<AuthSettings>('/api/v1/admin/auth/settings', data);
};
