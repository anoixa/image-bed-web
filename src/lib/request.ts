import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse, LoginSuccessResponse } from '@/types';
import { clearAuthToken, getAuthToken, getAuthTokenExpiry, setAuthToken } from '@/lib/authToken';

const request: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Accept': 'application/json',
  },
});

const refreshRequest: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

export class ApiRequestError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

function normalizeResponseError(error: AxiosError<ApiResponse>): ApiRequestError {
  const message = error.response?.data?.msg || error.message || '请求失败';
  return new ApiRequestError(message, error.response?.status);
}

const refreshTokenApi = (): Promise<LoginSuccessResponse> => {
  return refreshRequest.post<ApiResponse<LoginSuccessResponse>>('/api/auth/refresh').then((res) => {
    if (res.data.status === 'error') {
      throw new Error(res.data.msg || '刷新失败');
    }
    return res.data.data as LoginSuccessResponse;
  });
};

// ============================================
// Token 刷新状态管理 - 防止并发重复刷新
// ============================================

// 当前正在进行的刷新 Promise（全局唯一）
let currentRefreshPromise: Promise<string> | null = null;

// 等待刷新的请求队列
let refreshSubscribers: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

const TOKEN_REFRESH_THRESHOLD = 10 * 60 * 1000; // 10分钟
// 排除不需要刷新 token 的接口
const EXCLUDE_FROM_REFRESH = ['/api/auth/login', '/api/auth/refresh', '/api/auth/logout'];

/**
 * 清除认证状态并跳转登录页
 */
function clearAuthState() {
  clearAuthToken();
  localStorage.removeItem('auth-storage');
  window.location.href = '/login';
}

/**
 * 执行实际的 Token 刷新
 * 这是唯一会调用后端刷新接口的地方
 */
async function performTokenRefresh(): Promise<string> {
  try {
    const response = await refreshTokenApi();
    const newToken = response.access_token.replace('Bearer ', '');
    const newExpiry = response.access_token_expiry * 1000;

    setAuthToken(newToken, newExpiry);

    // 通知所有等待的请求
    refreshSubscribers.forEach(({ resolve }) => resolve(newToken));
    refreshSubscribers = [];

    return newToken;
  } catch (error) {
    // 刷新失败，拒绝所有等待的请求
    const errMessage = error instanceof Error ? error.message : 'Token 刷新失败';
    refreshSubscribers.forEach(({ reject }) =>
      reject(new Error(errMessage))
    );
    refreshSubscribers = [];

    // 如果是账户被禁用，在跳转前记录标记，供登录页展示
    if (errMessage.toLowerCase().includes('account disabled')) {
      sessionStorage.setItem('auth_error', 'account_disabled');
    }

    clearAuthState();
    throw error;
  } finally {
    currentRefreshPromise = null;
  }
}

/**
 * 获取刷新 Promise（如果不存在则创建）
 * 这是防止并发刷新的核心机制
 */
function getOrCreateRefreshPromise(): Promise<string> {
  if (!currentRefreshPromise) {
    currentRefreshPromise = performTokenRefresh();
  }
  return currentRefreshPromise;
}

/**
 * 添加一个刷新订阅者，等待刷新完成
 */
function waitForRefresh(): Promise<string> {
  return new Promise((resolve, reject) => {
    refreshSubscribers.push({ resolve, reject });
  });
}

/**
 * 检查并在需要时刷新 Token
 * 核心逻辑：
 1. 如果 Token 未过期且不在阈值内，直接返回当前 Token
 2. 如果正在刷新，等待刷新完成
 3. 如果 Token 即将过期或已过期，启动刷新流程
 */
async function checkAndRefreshTokenIfNeeded(): Promise<string | null> {
  const token = getAuthToken();
  const expiry = getAuthTokenExpiry();

  if (!token || !expiry) {
    return token;
  }

  const now = Date.now();
  const timeUntilExpiry = expiry - now;

  // Token 还有效且不在刷新阈值内，直接使用
  if (timeUntilExpiry > TOKEN_REFRESH_THRESHOLD) {
    return token;
  }

  // Token 即将过期或已过期，需要刷新
  // 关键：如果有正在进行的刷新，等待它完成（而不是启动新的刷新）
  if (currentRefreshPromise) {
    try {
      return await waitForRefresh();
    } catch {
      return null;
    }
  }

  // 启动新的刷新流程
  try {
    return await getOrCreateRefreshPromise();
  } catch {
    return null;
  }
}

// ============================================
// 请求拦截器
// ============================================

request.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const isExcluded = EXCLUDE_FROM_REFRESH.some(url => config.url?.includes(url));
    const token = isExcluded ? null : await checkAndRefreshTokenIfNeeded();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    } else if (!config.headers['Content-Type']) {
      const methodsWithBody = ['POST', 'PUT', 'PATCH'];
      if (methodsWithBody.includes(config.method?.toUpperCase() || '')) {
        config.headers['Content-Type'] = 'application/json';
      }
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// ============================================
// 响应拦截器 - 处理 401 和 Token 刷新
// ============================================

request.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    return response;
  },
  async (error: AxiosError<ApiResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const isExcluded = EXCLUDE_FROM_REFRESH.some(url => originalRequest?.url?.includes(url));

    // 不满足刷新条件时直接抛出错误
    if (!originalRequest || error.response?.status !== 401 || originalRequest._retry || isExcluded) {
      return Promise.reject(normalizeResponseError(error));
    }

    // 标记已重试，防止无限循环
    originalRequest._retry = true;

    // 关键：如果有正在进行的刷新，等待它完成
    if (currentRefreshPromise) {
      try {
        const newToken = await waitForRefresh();
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return request(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    // 启动新的刷新流程
    try {
      const newToken = await getOrCreateRefreshPromise();
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return request(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  }
);

// ============================================
// 导出 HTTP 方法
// ============================================

export const get = <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  return request.get<ApiResponse<T>>(url, config).then((res) => {
    if (res.data.status === 'error') {
      throw new Error(res.data.msg || '请求失败');
    }
    return res.data.data as T;
  });
};

export const post = <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
  return request.post<ApiResponse<T>>(url, data, config).then((res) => {
    if (res.data.status === 'error') {
      throw new Error(res.data.msg || '请求失败');
    }
    return res.data.data as T;
  });
};

export const put = <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
  return request.put<ApiResponse<T>>(url, data, config).then((res) => {
    if (res.data.status === 'error') {
      throw new Error(res.data.msg || '请求失败');
    }
    return res.data.data as T;
  });
};

export const patch = <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
  return request.patch<ApiResponse<T>>(url, data, config).then((res) => {
    if (res.data.status === 'error') {
      throw new Error(res.data.msg || '请求失败');
    }
    return res.data.data as T;
  });
};

export const del = <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  return request.delete<ApiResponse<T>>(url, config).then((res) => {
    if (res.data.status === 'error') {
      throw new Error(res.data.msg || '请求失败');
    }
    return res.data.data as T;
  });
};

export const upload = <T>(url: string, formData: FormData, config?: AxiosRequestConfig): Promise<T> => {
  return request.post<ApiResponse<T>>(url, formData, config).then((res) => {
    if (res.data.status === 'error') {
      throw new Error(res.data.msg || '上传失败');
    }
    return res.data.data as T;
  });
};

// 带进度回调的上传函数
export const uploadWithProgress = <T>(
  url: string,
  formData: FormData,
  onProgress?: (progress: number) => void,
  config?: AxiosRequestConfig
): Promise<T> => {
  return request
    .post<ApiResponse<T>>(url, formData, {
      ...config,
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && progressEvent.total > 0) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress?.(progress);
        }
      },
    })
    .then((res) => {
      if (res.data.status === 'error') {
        throw new Error(res.data.msg || '上传失败');
      }
      return res.data.data as T;
    });
};

export default request;
