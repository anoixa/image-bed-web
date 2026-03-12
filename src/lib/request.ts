import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse, LoginResponse } from '@/types';

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

const refreshTokenApi = (): Promise<LoginResponse> => {
  return refreshRequest.post<ApiResponse<LoginResponse>>('/api/auth/refresh').then((res) => {
    if (res.data.status === 'error') {
      throw new Error(res.data.msg || '刷新失败');
    }
    return res.data.data as LoginResponse;
  });
};

// 刷新 token 的状态管理
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function getTokenExpiry(): number | null {
  const storageData = localStorage.getItem('auth-storage');
  if (storageData) {
    try {
      const parsed = JSON.parse(storageData);
      return parsed.state?.accessTokenExpiry || null;
    } catch {
      return null;
    }
  }
  return null;
}

const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000;

async function checkAndRefreshTokenIfNeeded(): Promise<string | null> {
  const token = getAccessToken();
  const expiry = getTokenExpiry();
  
  if (!token || !expiry) {
    return token;
  }
  
  const now = Date.now();
  const timeUntilExpiry = expiry - now;
  
  if (timeUntilExpiry > TOKEN_REFRESH_THRESHOLD) {
    return token;
  }
  
  if (isRefreshing) {
    return new Promise((resolve) => {
      addRefreshSubscriber((newToken: string) => {
        resolve(newToken);
      });
    });
  }
  
  isRefreshing = true;
  
  try {
    const response = await refreshTokenApi();
    const newToken = response.access_token.replace('Bearer ', '');
    const newExpiry = response.access_token_expiry * 1000;
    
    setAccessToken(newToken, newExpiry);
    onTokenRefreshed(newToken);
    
    return newToken;
  } catch (error) {
    clearAuthState();
    return null;
  } finally {
    isRefreshing = false;
  }
}

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

function getAccessToken(): string | null {
  const storageData = localStorage.getItem('auth-storage');
  if (storageData) {
    try {
      const parsed = JSON.parse(storageData);
      return parsed.state?.accessToken || null;
    } catch {
      return null;
    }
  }
  return null;
}

function setAccessToken(token: string, expiry: number) {
  const storageData = localStorage.getItem('auth-storage');
  if (storageData) {
    try {
      const parsed = JSON.parse(storageData);
      parsed.state.accessToken = token;
      parsed.state.accessTokenExpiry = expiry;
      localStorage.setItem('auth-storage', JSON.stringify(parsed));
    } catch {
    }
  }
}

function clearAuthState() {
  localStorage.removeItem('auth-storage');
  window.location.href = '/login';
}

request.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await checkAndRefreshTokenIfNeeded();
    
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

request.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    return response;
  },
  async (error: AxiosError<ApiResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    if (!originalRequest || error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }
    
    originalRequest._retry = true;
    
    if (isRefreshing) {
      return new Promise((resolve) => {
        addRefreshSubscriber((token: string) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(request(originalRequest));
        });
      });
    }
    
    isRefreshing = true;
    
    try {
      const response = await refreshTokenApi();
      
      const newToken = response.access_token.replace('Bearer ', '');
      const newExpiry = response.access_token_expiry * 1000;
      
      setAccessToken(newToken, newExpiry);
      onTokenRefreshed(newToken);
      
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return request(originalRequest);
    } catch (refreshError) {
      clearAuthState();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
  );
  
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

export default request;
