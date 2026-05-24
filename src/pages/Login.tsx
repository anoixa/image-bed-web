import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ImageIcon, Loader2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/auth';
import { toast } from '@/components/ui/use-toast';
import LoginBackground from '@/components/LoginBackground';
import { getAuthCapabilities } from '@/api/auth';
import type { AuthCapabilities } from '@/types';

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  not_linked: '请先使用本地账号登录，然后在账号设置中绑定此 OAuth 账号。',
  disabled: '账号已被禁用。',
  invalid_state: '登录状态已过期，请重试。',
  missing_code: 'Provider 回调未返回授权码，请重试。',
  internal: '登录失败，请稍后重试。',
};

function getProviderIcon(provider: string): React.ReactNode {
  const iconClass = 'w-5 h-5';
  switch (provider.toLowerCase()) {
    case 'github':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
      );
    case 'google':
      return (
        <svg className={iconClass} viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
      );
    case 'gitee':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.984 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.016 0zm6.09 5.333c.328 0 .593.266.593.593v1.482a.593.593 0 0 1-.593.593H9.777a.593.593 0 0 0-.593.593v9.63c0 .327.266.593.593.593h2.37a.593.593 0 0 0 .593-.592v-7.11a.593.593 0 0 1 .593-.593h3.556a.593.593 0 0 0 .593-.593V6.815a.593.593 0 0 0-.593-.593H12.89a.593.593 0 0 1-.593-.593V5.926c0-.327.266-.593.593-.593h5.185z" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
        </svg>
      );
  }
}

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const login = useAuthStore((state) => state.login);
  const verify2FA = useAuthStore((state) => state.verify2FA);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [capabilities, setCapabilities] = useState<AuthCapabilities | null>(null);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(true);

  // 2FA 状态
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFACode, setTwoFACode] = useState('');

  // 加载登录能力
  useEffect(() => {
    let cancelled = false;
    setCapabilitiesLoading(true);
    getAuthCapabilities()
      .then((data) => {
        if (!cancelled) setCapabilities(data);
      })
      .catch(() => {
        // 失败时默认允许密码登录
        if (!cancelled) {
          setCapabilities({
            password_login_enabled: true,
            oauth_login_enabled: false,
            providers: [],
          });
        }
      })
      .finally(() => {
        if (!cancelled) setCapabilitiesLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // 处理 OAuth 回调错误
  useEffect(() => {
    const oauthError = searchParams.get('oauth_error');
    if (oauthError && OAUTH_ERROR_MESSAGES[oauthError]) {
      toast({
        title: '登录失败',
        description: OAUTH_ERROR_MESSAGES[oauthError],
        variant: 'destructive',
      });
      // 清理 URL
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('oauth_error');
      navigate('/login', { replace: true });
    }
  }, [searchParams, navigate]);

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
      const result = await login(username, password);
      if (result.requires2FA) {
        setRequires2FA(true);
        toast({
          title: '需要二次验证',
          description: '请输入您的 6 位验证码',
        });
      } else {
        toast({
          title: '登录成功',
          description: '欢迎回来！',
        });
        setTimeout(() => navigate('/'), 300);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '请检查用户名和密码';
      const isDisabled = message.toLowerCase().includes('account disabled');
      const isPasswordDisabled = message.toLowerCase().includes('password_login_disabled');
      toast({
        title: isDisabled ? '账户已禁用' : isPasswordDisabled ? '密码登录已禁用' : '登录失败',
        description: isDisabled
          ? '账户已被禁用，请联系管理员。'
          : isPasswordDisabled
            ? '密码登录已被管理员禁用，请使用 OAuth 登录。'
            : message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (twoFACode.length !== 6) {
      toast({
        title: '请输入 6 位验证码',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      await verify2FA(twoFACode);
      toast({
        title: '登录成功',
        description: '欢迎回来！',
      });
      setTimeout(() => navigate('/'), 300);
    } catch (error) {
      const message = error instanceof Error ? error.message : '验证失败';
      toast({
        title: '验证失败',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setRequires2FA(false);
    setTwoFACode('');
    setPassword('');
  };

  const handleOAuthLogin = (provider: string) => {
    const returnTo = encodeURIComponent('/');
    window.location.href = `/api/auth/oauth/${provider}/start?return_to=${returnTo}`;
  };

  const showPasswordForm = capabilities?.password_login_enabled ?? true;
  const showOAuth = capabilities?.oauth_login_enabled && (capabilities?.providers?.length ?? 0) > 0;

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
                {requires2FA ? (
                  <Shield className="w-8 h-8 text-white" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-white" />
                )}
              </div>
            </div>

            {/* Title */}
            <div className="text-center mb-10">
              <h1 className="text-2xl font-bold text-slate-900 mb-2">
                {requires2FA ? '两步验证' : '欢迎回来'}
              </h1>
              <p className="text-slate-400 text-sm">
                {requires2FA ? '请输入您的 6 位验证码' : '管理您的极速云端图床'}
              </p>
            </div>

            {capabilitiesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              </div>
            ) : (
              <div className="space-y-5">
                {requires2FA ? (
                  /* 2FA 验证表单 */
                  <form onSubmit={handle2FASubmit} className="space-y-5">
                    <div>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="6 位验证码"
                        value={twoFACode}
                        onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        disabled={isLoading}
                        autoFocus
                        className="h-14 px-5 rounded-xl border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50 text-center text-lg tracking-widest"
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
                          验证中...
                        </>
                      ) : (
                        '验证并登录'
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleBackToLogin}
                      disabled={isLoading}
                      className="w-full text-slate-500 hover:text-slate-700"
                    >
                      返回登录
                    </Button>
                  </form>
                ) : (
                  <>
                    {/* OAuth 登录按钮 */}
                    {showOAuth && (
                      <div className="space-y-3">
                        {capabilities!.providers.map((p) => (
                          <Button
                            key={p.provider}
                            type="button"
                            variant="outline"
                            onClick={() => handleOAuthLogin(p.provider)}
                            className="w-full h-12 rounded-xl border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium transition-all"
                          >
                            <span className="mr-3">{getProviderIcon(p.provider)}</span>
                            使用 {p.display_name} 登录
                          </Button>
                        ))}

                        {/* 分隔线 */}
                        {showPasswordForm && (
                          <div className="relative my-4">
                            <div className="absolute inset-0 flex items-center">
                              <div className="w-full border-t border-slate-200" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                              <span className="bg-white/95 px-2 text-slate-400">或</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 密码登录表单 */}
                    {showPasswordForm && (
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
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
