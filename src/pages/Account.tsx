import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { User, Link2, Unlink, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useAuthStore } from '@/store/auth';
import { getOAuthIdentities, unlinkOAuthIdentity, getAuthCapabilities, startOAuthLink } from '@/api/auth';
import type { OAuthIdentity, AuthCapabilities } from '@/types';

const OAUTH_LINK_ERROR_MESSAGES: Record<string, string> = {
  already_bound: '该 OAuth 账号已绑定到其他用户。',
  disabled: '账号已被禁用。',
  invalid_state: '绑定状态已过期，请重试。',
  missing_code: 'Provider 回调未返回授权码，请重试。',
  internal: '绑定失败，请稍后重试。',
};

function getProviderLabel(provider: string): string {
  switch (provider.toLowerCase()) {
    case 'github': return 'GitHub';
    case 'google': return 'Google';
    case 'gitee': return 'Gitee';
    default: return provider;
  }
}

export default function Account() {
  const user = useAuthStore((state) => state.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const [identities, setIdentities] = useState<OAuthIdentity[]>([]);
  const [loading, setLoading] = useState(true);
  const [capabilities, setCapabilities] = useState<AuthCapabilities | null>(null);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState<OAuthIdentity | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [capsRes, identitiesRes] = await Promise.allSettled([
        getAuthCapabilities(),
        getOAuthIdentities(),
      ]);
      if (capsRes.status === 'fulfilled') {
        setCapabilities(capsRes.value);
      }
      if (identitiesRes.status === 'fulfilled') {
        setIdentities(identitiesRes.value.identities || []);
      }
    } catch (error) {
      console.error('加载账号信息失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 处理 OAuth 绑定成功提示
  useEffect(() => {
    const linked = searchParams.get('linked');
    if (linked) {
      toast({
        title: '绑定成功',
        description: `已成功绑定 ${getProviderLabel(linked)} 账号`,
      });
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('linked');
      setSearchParams(newParams, { replace: true });
      // 重新加载身份列表
      loadData();
    }

    const oauthError = searchParams.get('oauth_error');
    if (oauthError && OAUTH_LINK_ERROR_MESSAGES[oauthError]) {
      toast({
        title: '绑定失败',
        description: OAUTH_LINK_ERROR_MESSAGES[oauthError],
        variant: 'destructive',
      });
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('oauth_error');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams, loadData]);

  const handleLink = async (provider: string) => {
    try {
      const data = await startOAuthLink(provider, '/account');
      if (data.auth_url) {
        window.location.assign(data.auth_url);
        return;
      }
      throw new Error('Failed to start OAuth binding');
    } catch (error) {
      toast({
        title: '绑定启动失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  const handleUnlink = async (identity: OAuthIdentity) => {
    setUnlinkingProvider(identity.provider);
    try {
      await unlinkOAuthIdentity(identity.provider);
      toast({ title: '解绑成功', description: `已解绑 ${getProviderLabel(identity.provider)} 账号` });
      setIdentities((prev) => prev.filter((i) => i.id !== identity.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : '解绑失败';
      const isConflict = message.includes('409') || message.includes('最后一个');
      const isNotFound = message.includes('404') || message.includes('Identity not found');
      toast({
        title: isConflict ? '无法解绑' : isNotFound ? '解绑失败' : '解绑失败',
        description: isConflict
          ? '不能解绑最后一个登录方式，请先设置密码或绑定其他 OAuth。'
          : isNotFound
            ? '该 OAuth 身份未找到，可能已解绑。'
            : message,
        variant: 'destructive',
      });
      if (isNotFound) {
        // 如果后端说找不到，前端也同步移除
        setIdentities((prev) => prev.filter((i) => i.id !== identity.id));
      }
    } finally {
      setUnlinkingProvider(null);
      setConfirmUnlink(null);
    }
  };

  // 如果密码登录被禁用且只有一个 OAuth 身份，不允许解绑
  const canUnlink = !(
    capabilities &&
    !capabilities.password_login_enabled &&
    identities.length === 1
  );

  const availableProviders = capabilities?.providers?.filter(
    (p) => p.enabled && !identities.some((i) => i.provider === p.provider)
  ) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <User className="w-6 h-6 text-indigo-600" />
          账号设置
        </h1>
        <p className="text-slate-500 mt-1">管理您的账号信息和 OAuth 绑定</p>
      </div>

      {/* 用户信息卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5" />
            基本信息
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">用户名</p>
              <p className="font-medium text-slate-900">{user?.username || '-'}</p>
            </div>
            <div>
              <p className="text-slate-500">角色</p>
              <div className="mt-1">
                <Badge variant={user?.role === 'admin' ? 'default' : 'secondary'}>
                  {user?.role === 'admin' ? '管理员' : '普通用户'}
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-slate-500">状态</p>
              <div className="mt-1">
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                    user?.status === 'active' ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      user?.status === 'active' ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  {user?.status === 'active' ? '正常' : '已禁用'}
                </span>
              </div>
            </div>
            <div>
              <p className="text-slate-500">用户 ID</p>
              <p className="font-medium text-slate-900">{user?.id ?? '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* OAuth 绑定管理 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="h-5 w-5" />
            OAuth 绑定
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* 已绑定身份 */}
              {identities.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-slate-700">已绑定的账号</h3>
                  <div className="space-y-2">
                    {identities.map((identity) => (
                      <div
                        key={identity.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100"
                      >
                        <div className="flex items-center gap-3">
                          {identity.avatar_url ? (
                            <img
                              src={identity.avatar_url}
                              alt=""
                              className="w-8 h-8 rounded-full"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                              <User className="w-4 h-4 text-indigo-600" />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {identity.username || identity.email || identity.subject}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-xs">
                                {getProviderLabel(identity.provider)}
                              </Badge>
                              {identity.email && (
                                <span className="text-xs text-slate-500">{identity.email}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmUnlink(identity)}
                          disabled={unlinkingProvider === identity.provider || !canUnlink}
                          className="text-slate-500 hover:text-red-600"
                        >
                          {unlinkingProvider === identity.provider ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Unlink className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 py-4 text-sm text-slate-500 bg-slate-50 rounded-lg px-4">
                  <AlertCircle className="h-4 w-4" />
                  尚未绑定任何 OAuth 账号
                </div>
              )}

              {/* 可绑定的 Provider */}
              {availableProviders.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-slate-700">绑定新账号</h3>
                  <div className="flex flex-wrap gap-2">
                    {availableProviders.map((p) => (
                      <Button
                        key={p.provider}
                        variant="outline"
                        size="sm"
                        onClick={() => handleLink(p.provider)}
                        className="gap-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        绑定 {p.display_name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {identities.length === 0 && availableProviders.length === 0 && !loading && (
                <div className="text-sm text-slate-500 py-4 text-center">
                  当前没有可用的 OAuth 登录方式
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 解绑确认弹窗 */}
      <ConfirmDialog
        open={!!confirmUnlink}
        onOpenChange={(open) => !open && setConfirmUnlink(null)}
        title="解绑 OAuth 账号"
        description={`确定要解绑 ${confirmUnlink ? getProviderLabel(confirmUnlink.provider) : ''} 账号吗？解绑后将无法使用该方式登录。`}
        onConfirm={() => confirmUnlink && handleUnlink(confirmUnlink)}
        confirmText="解绑"
        variant="destructive"
      />
    </div>
  );
}
