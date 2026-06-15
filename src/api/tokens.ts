import { get, post, del } from '@/lib/request';
import type { Token, CreateTokenResponse } from '@/types';

// Token列表响应结构
interface TokensResponse {
  tokens: Token[];
  total_count: number;
}

// 创建 Token - POST /api/v1/token
export const createToken = (description: string): Promise<CreateTokenResponse> => {
  return post<CreateTokenResponse>('/api/v1/token', {
    description,
  });
};

// 获取 Token 列表 - GET /api/v1/token
export const fetchTokens = (): Promise<Token[]> => {
  return get<TokensResponse>('/api/v1/token').then(
    (res) => res.tokens || []
  );
};

// 启用 Token - POST /api/v1/token/{id}/enable
export const enableToken = (id: string | number): Promise<void> => {
  return post(`/api/v1/token/${id}/enable`, undefined, { expectData: false });
};

// 禁用 Token - POST /api/v1/token/{id}/disable
export const disableToken = (id: string | number): Promise<void> => {
  return post(`/api/v1/token/${id}/disable`, undefined, { expectData: false });
};

// 撤销 Token - DELETE /api/v1/token/{id}
export const deleteToken = (id: string | number): Promise<void> => {
  return del(`/api/v1/token/${id}`, { expectData: false });
};
