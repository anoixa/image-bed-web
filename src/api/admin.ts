import { get, post, put, del } from '@/lib/request';
import type { ApiRequestConfig } from '@/lib/request';
import type {
  PaginatedUsersResponse,
  CreateUserRequest,
  CreateUserResponse,
  UpdateRoleRequest,
  UpdateStatusRequest,
  ResetPasswordResponse,
  UserOAuthIdentitiesResponse,
} from '@/types';

// 获取用户列表（分页）
export const listUsers = (
  page: number = 1,
  pageSize: number = 20,
  config?: ApiRequestConfig
): Promise<PaginatedUsersResponse> => {
  return get<PaginatedUsersResponse>(
    `/api/v1/admin/users?page=${page}&page_size=${pageSize}`,
    config
  );
};

// 创建用户
export const createUser = (data: CreateUserRequest): Promise<CreateUserResponse> => {
  return post<CreateUserResponse>('/api/v1/admin/users', data);
};

// 更新用户角色
export const updateUserRole = (id: number, data: UpdateRoleRequest): Promise<void> => {
  return put<void>(`/api/v1/admin/users/${id}/role`, data, { expectData: false });
};

// 更新用户状态
export const updateUserStatus = (id: number, data: UpdateStatusRequest): Promise<void> => {
  return put<void>(`/api/v1/admin/users/${id}/status`, data, { expectData: false });
};

// 重置用户密码
export const resetUserPassword = (id: number): Promise<ResetPasswordResponse> => {
  return post<ResetPasswordResponse>(`/api/v1/admin/users/${id}/reset-password`);
};

// 删除用户
export const deleteUser = (id: number): Promise<void> => {
  return del<void>(`/api/v1/admin/users/${id}`, { expectData: false });
};

// ==================== OAuth 管理 ====================

// 查看用户 OAuth 身份和邀请
export const getUserOAuthIdentities = (id: number): Promise<UserOAuthIdentitiesResponse> => {
  return get<UserOAuthIdentitiesResponse>(`/api/v1/admin/users/${id}/oauth-identities`);
};

// 管理员重置用户 2FA
export const resetUser2FA = (id: number): Promise<{ message: string }> => {
  return post<{ message: string }>(`/api/v1/admin/users/${id}/2fa/reset`);
};

// 管理员解绑用户 OAuth 身份
export const unlinkUserOAuthIdentity = (id: number, provider: string): Promise<{ message: string }> => {
  return del<{ message: string }>(`/api/v1/admin/users/${id}/oauth-identities/${provider}`);
};
