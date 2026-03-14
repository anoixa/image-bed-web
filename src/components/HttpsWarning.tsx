import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HttpsWarning() {
  const [showWarning, setShowWarning] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // 检测当前协议
    const isHttps = window.location.protocol === 'https:';
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // 如果不是 HTTPS 且不是本地开发环境，显示警告
    if (!isHttps && !isLocalhost) {
      setShowWarning(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    // 保存到 sessionStorage，当前会话不再显示
    sessionStorage.setItem('https-warning-dismissed', 'true');
  };

  // 检查是否已经关闭过
  useEffect(() => {
    if (sessionStorage.getItem('https-warning-dismissed') === 'true') {
      setDismissed(true);
    }
  }, []);

  if (!showWarning || dismissed) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-50 border-b border-amber-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">
              安全警告：当前使用 HTTP 连接
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              您的数据传输未加密，建议配置 HTTPS 以确保安全。部分功能（如密码自动填充）可能受限。
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="shrink-0 text-amber-700 hover:text-amber-800 hover:bg-amber-100"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
