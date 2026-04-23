import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/auth';
import { toast } from '@/components/ui/use-toast';
import LoginBackground from '@/components/LoginBackground';

export default function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 检测 sessionStorage 中由 request.ts 标记的刷新失败禁用状态
  useEffect(() => {
    const authError = sessionStorage.getItem('auth_error');
    if (authError === 'account_disabled') {
      sessionStorage.removeItem('auth_error');
      toast({
        title: '账户已禁用',
        description: '账户已被禁用，请联系管理员。',
        variant: 'destructive',
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      toast({
        title: '请输入用户名',
        variant: 'destructive',
      });
      return;
    }
    
    if (password.length < 6) {
      toast({
        title: '密码至少需要6位字符',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      await login(username, password);
      toast({
        title: '登录成功',
        description: '欢迎回来！',
      });
      setTimeout(() => navigate('/'), 300);
    } catch (error) {
      const message = error instanceof Error ? error.message : '请检查用户名和密码';
      const isDisabled = message.toLowerCase().includes('account disabled');
      toast({
        title: isDisabled ? '账户已禁用' : '登录失败',
        description: isDisabled
          ? '账户已被禁用，请联系管理员。'
          : message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* 背景层 */}
      <LoginBackground />

      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Card - 添加毛玻璃效果 */}
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 p-8 sm:p-10">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <ImageIcon className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-10">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">欢迎回来</h1>
            <p className="text-slate-400 text-sm">管理您的极速云端图床</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Input
                type="text"
                placeholder="用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                className="h-14 px-5 rounded-xl border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50"
              />
            </div>

            <div>
              <Input
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="h-14 px-5 rounded-xl border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-14 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-base shadow-lg shadow-indigo-600/25 transition-all hover:shadow-xl hover:shadow-indigo-600/30 disabled:opacity-70"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  登录中...
                </>
              ) : (
                '进入控制台'
              )}
            </Button>
          </form>
          </div>
        </div>
      </div>
    </>
  );
}
