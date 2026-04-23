import { get, post, put, del } from '@/lib/request';
import type {
  PaginatedUsersResponse,
  CreateUserRequest,
  CreateUserResponse,
  UpdateRoleRequest,
  UpdateStatusRequest,
  ResetPasswordResponse,
} from '@/types';

// 获取用户列表（分页）
export const listUsers = (
  page: number = 1,
  pageSize: number = 20
): Promise<PaginatedUsersResponse> => {
  return get<PaginatedUsersResponse>(
    `/api/v1/admin/users?page=${page}&page_size=${pageSize}`
  );
};

// 创建用户
export const createUser = (data: CreateUserRequest): Promise<CreateUserResponse> => {
  return post<CreateUserResponse>('/api/v1/admin/users', data);
};

// 更新用户角色
export const updateUserRole = (id: number, data: UpdateRoleRequest): Promise<void> => {
  return put<void>(`/api/v1/admin/users/${id}/role`, data);
};

// 更新用户状态
export const updateUserStatus = (id: number, data: UpdateStatusRequest): Promise<void> => {
  return put<void>(`/api/v1/admin/users/${id}/status`, data);
};

// 重置用户密码
export const resetUserPassword = (id: number): Promise<ResetPasswordResponse> => {
  return post<ResetPasswordResponse>(`/api/v1/admin/users/${id}/reset-password`);
};

// 删除用户
export const deleteUser = (id: number): Promise<void> => {
  return del<void>(`/api/v1/admin/users/${id}`);
};
