import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/auth';
import Login from '@/pages/Login';
import DashboardLayout from '@/layouts/DashboardLayout';
import Home from '@/pages/Home';
import Dashboard from '@/pages/Dashboard';
import Albums from '@/pages/Albums';
import Settings from '@/pages/Settings';
import { Toaster } from '@/components/ui/toaster';
import HttpsWarning from '@/components/HttpsWarning';

// 受保护的路由组件
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
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
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const lastVisibilityCheck = useRef<number>(0);

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

  return (
    <BrowserRouter>
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
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <HttpsWarning />
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
