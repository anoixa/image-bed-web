import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useRef, useState, Suspense, lazy } from 'react';
import { useAuthStore } from '@/store/auth';
import { Toaster } from '@/components/ui/toaster';
import HttpsWarning from '@/components/HttpsWarning';
import { Loader2 } from 'lucide-react';

// Lazy load pages for code splitting
const Login = lazy(() => import('@/pages/Login'));
const DashboardLayout = lazy(() => import('@/layouts/DashboardLayout'));
const Home = lazy(() => import('@/pages/Home'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Albums = lazy(() => import('@/pages/Albums'));
const Tokens = lazy(() => import('@/pages/Tokens'));
const Settings = lazy(() => import('@/pages/Settings'));
const StorageConfigs = lazy(() => import('@/pages/StorageConfigs'));
const ApiDocs = lazy(() => import('@/pages/ApiDocs'));
const Users = lazy(() => import('@/pages/Users'));
const Account = lazy(() => import('@/pages/Account'));

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
    </div>
  );
}

// 受保护的路由组件
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// 仅管理员可访问的路由
export function AdminRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// 公开路由（已登录用户重定向到首页）
function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  const checkAndRefreshToken = useAuthStore((state) => state.checkAndRefreshToken);
  const initAuth = useAuthStore((state) => state.initAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [initialized, setInitialized] = useState(false);
  const lastVisibilityCheck = useRef<number>(0);

  // 应用初始化：恢复认证状态并获取用户信息
  useEffect(() => {
    initAuth().then(() => setInitialized(true));
  }, [initAuth]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated) {
        const now = Date.now();
        if (now - lastVisibilityCheck.current > 5000) {
          lastVisibilityCheck.current = now;
          checkAndRefreshToken();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [checkAndRefreshToken, isAuthenticated]);

  if (!initialized) {
    return <PageLoader />;
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Home />} />
            <Route path="stats" element={<Dashboard />} />
            <Route path="albums" element={<Albums />} />
            <Route path="tokens" element={<Tokens />} />
            <Route path="users" element={
              <AdminRoute>
                <Users />
              </AdminRoute>
            } />
            <Route path="settings" element={
              <AdminRoute>
                <Settings />
              </AdminRoute>
            } />
            <Route path="storage" element={
              <AdminRoute>
                <StorageConfigs />
              </AdminRoute>
            } />
            <Route path="api-docs" element={<ApiDocs />} />
            <Route path="account" element={<Account />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <HttpsWarning />
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
