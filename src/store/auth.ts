import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';
import {
  login as loginApi,
  logout as logoutApi,
  getCurrentUser,
  verify2FA as verify2FAAPI,
} from '@/api/auth';
import type { LoginSuccessResponse } from '@/types';
import { clearAuthToken, setAuthToken } from '@/lib/authToken';
import { refreshAccessTokenSingleFlight } from '@/lib/request';

interface InitAuthOptions {
  allowRefresh?: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  accessTokenExpiry: number | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  twoFATicket: string | null;

  // Actions
  login: (username: string, password: string) => Promise<{ requires2FA: boolean }>;
  verify2FA: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  checkAndRefreshToken: () => Promise<boolean>;
  initAuth: (options?: InitAuthOptions) => Promise<void>;
  // Debug
  forceExpireToken: () => void;
}

// Token 过期前 5 分钟开始刷新（单位：毫秒）
const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      accessTokenExpiry: null,
      isAuthenticated: false,
      isLoading: false,
      isRefreshing: false,
      twoFATicket: null,

      login: async (username: string, password: string) => {
        set({ isLoading: true, twoFATicket: null });
        try {
          const response = await loginApi(username, password);

          // 检查是否需要 2FA
          if ('requires_2fa' in response && response.requires_2fa) {
            set({
              twoFATicket: response.ticket,
              isLoading: false,
            });
            return { requires2FA: true };
          }

          // 正常登录成功
          const successResponse = response as LoginSuccessResponse;
          const token = successResponse.access_token.replace('Bearer ', '');
          const expiry = successResponse.access_token_expiry * 1000;
          setAuthToken(token, expiry);

          const user = await getCurrentUser();

          set({
            user,
            accessToken: token,
            accessTokenExpiry: expiry,
            isAuthenticated: true,
            isLoading: false,
            twoFATicket: null,
          });
          return { requires2FA: false };
        } catch (error) {
          clearAuthToken();
          set({ isLoading: false, accessToken: null, accessTokenExpiry: null });
          throw error;
        }
      },

      verify2FA: async (code: string) => {
        set({ isLoading: true });
        try {
          const { twoFATicket } = get();
          if (!twoFATicket) {
            throw new Error('无效的 2FA 会话');
          }

          const response = await verify2FAAPI({ ticket: twoFATicket, code });
          const token = response.access_token.replace('Bearer ', '');
          const expiry = response.access_token_expiry * 1000;
          setAuthToken(token, expiry);

          const user = await getCurrentUser();

          set({
            user,
            accessToken: token,
            accessTokenExpiry: expiry,
            isAuthenticated: true,
            isLoading: false,
            twoFATicket: null,
          });
        } catch (error) {
          clearAuthToken();
          set({ isLoading: false, accessToken: null, accessTokenExpiry: null });
          throw error;
        }
      },

      logout: async () => {
        try {
          await logoutApi();
        } catch {
          // 即使请求失败也清除本地状态
        } finally {
          clearAuthToken();
          set({
            user: null,
            accessToken: null,
            accessTokenExpiry: null,
            isAuthenticated: false,
            twoFATicket: null,
          });
        }
      },

      refreshAccessToken: async (): Promise<boolean> => {
        set({ isRefreshing: true });

        try {
          const { token, expiry } = await refreshAccessTokenSingleFlight();

          // 刷新后重新获取用户信息
          const user = await getCurrentUser();

          set({
            accessToken: token,
            accessTokenExpiry: expiry,
            isAuthenticated: true,
            isRefreshing: false,
            user,
          });

          return true;
        } catch {
          clearAuthToken();
          set({
            user: null,
            accessToken: null,
            accessTokenExpiry: null,
            isAuthenticated: false,
            isRefreshing: false,
            twoFATicket: null,
          });
          return false;
        }
      },

      forceExpireToken: () => {
        set({
          accessTokenExpiry: Date.now() - 1000,
        });
      },

      checkAndRefreshToken: async (): Promise<boolean> => {
        const { accessToken, accessTokenExpiry, refreshAccessToken } = get();

        if (!accessToken || !accessTokenExpiry) {
          return false;
        }

        const now = Date.now();
        const timeUntilExpiry = accessTokenExpiry - now;

        if (timeUntilExpiry > TOKEN_REFRESH_THRESHOLD) {
          return true;
        }

        return await refreshAccessToken();
      },

      initAuth: async ({ allowRefresh = true }: InitAuthOptions = {}) => {
        const { accessToken, accessTokenExpiry, refreshAccessToken } = get();

        // 如果没有 accessToken，尝试用 refresh_token cookie 刷新一次
        // （OAuth 登录后后端只设置了 refresh_token cookie）
        if (!accessToken) {
          if (allowRefresh) {
            const ok = await refreshAccessToken();
            if (ok) {
              return;
            }
            clearAuthToken();
          }
          set({
            user: null,
            accessToken: null,
            accessTokenExpiry: null,
            isAuthenticated: false,
            isRefreshing: false,
            twoFATicket: null,
          });
          return;
        }

        const now = Date.now();
        const timeUntilExpiry = accessTokenExpiry! - now;

        // Token 已过期，尝试刷新
        if (timeUntilExpiry <= 0) {
          const ok = await refreshAccessToken();
          if (!ok) {
            clearAuthToken();
            set({
              user: null,
              accessToken: null,
              accessTokenExpiry: null,
              isAuthenticated: false,
              twoFATicket: null,
            });
          }
          return;
        }

        // Token 有效，直接获取用户信息
        try {
          const user = await getCurrentUser();
          set({
            user,
            isAuthenticated: true,
          });
        } catch {
          // /me 失败（如 401），清除状态
          clearAuthToken();
          set({
            user: null,
            accessToken: null,
            accessTokenExpiry: null,
            isAuthenticated: false,
            twoFATicket: null,
          });
        }
      },
    }),
    {
      name: 'auth-storage',
      version: 2,
      migrate: (persistedState) => {
        const state = persistedState as Partial<Pick<AuthState, 'user' | 'isAuthenticated'>>;
        return {
          user: state.user ?? null,
          isAuthenticated: false,
        };
      },
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
