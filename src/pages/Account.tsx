import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  User, Link2, Unlink, Loader2, ExternalLink, AlertCircle,
  Shield, ShieldCheck, ShieldOff, Copy, Check, KeyRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useAuthStore } from '@/store/auth';
import {
  getOAuthIdentities, unlinkOAuthIdentity, getAuthCapabilities, startOAuthLink,
  get2FAStatus, setup2FA, enable2FA, disable2FA,
} from '@/api/auth';
import type { OAuthIdentity, AuthCapabilities } from '@/types';
import QRCode from 'qrcode';

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

  // 2FA 状态
  const [twoFAEnabled, setTwoFAEnabled] = useState<boolean | null>(null);
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [setupStep, setSetupStep] = useState<'password' | 'qr' | 'confirm'>('password');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupQRDataURL, setSetupQRDataURL] = useState('');
  const [setupSecret, setSetupSecret] = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);

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

  const load2FAStatus = useCallback(async () => {
    try {
      const status = await get2FAStatus();
      setTwoFAEnabled(status.enabled);
    } catch {
      setTwoFAEnabled(null);
    }
  }, []);

  useEffect(() => {
    loadData();
    load2FAStatus();
  }, [loadData, load2FAStatus]);

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

  // ==================== 2FA Handlers ====================

  const handleStartSetup = async () => {
    if (!setupPassword.trim()) {
      toast({ title: '请输入当前密码', variant: 'destructive' });
      return;
    }
    setTwoFALoading(true);
    try {
      const res = await setup2FA({ current_password: setupPassword.trim() });
      setSetupSecret(res.secret);
      // 生成二维码
      const dataURL = await QRCode.toDataURL(res.uri, { width: 200, margin: 2 });
      setSetupQRDataURL(dataURL);
      setSetupStep('qr');
    } catch (error) {
      const message = error instanceof Error ? error.message : '设置失败';
      toast({ title: '设置失败', description: message, variant: 'destructive' });
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleEnable2FA = async () => {
    if (setupCode.length !== 6) {
      toast({ title: '请输入 6 位验证码', variant: 'destructive' });
      return;
    }
    setTwoFALoading(true);
    try {
      await enable2FA({ code: setupCode });
      toast({ title: '2FA 已启用', description: '两步验证已成功开启' });
      setTwoFAEnabled(true);
      setShowSetupDialog(false);
      resetSetupState();
    } catch (error) {
      const message = error instanceof Error ? error.message : '启用失败';
      toast({ title: '启用失败', description: message, variant: 'destructive' });
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (disableCode.length !== 6) {
      toast({ title: '请输入 6 位验证码', variant: 'destructive' });
      return;
    }
    setTwoFALoading(true);
    try {
      await disable2FA({ code: disableCode });
      toast({ title: '2FA 已关闭', description: '两步验证已成功关闭' });
      setTwoFAEnabled(false);
      setShowDisableDialog(false);
      setDisableCode('');
    } catch (error) {
      const message = error instanceof Error ? error.message : '关闭失败';
      toast({ title: '关闭失败', description: message, variant: 'destructive' });
    } finally {
      setTwoFALoading(false);
    }
  };

  const resetSetupState = () => {
    setSetupStep('password');
    setSetupPassword('');
    setSetupQRDataURL('');
    setSetupSecret('');
    setSetupCode('');
    setCopiedSecret(false);
  };

  const handleCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(setupSecret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } catch {
      toast({ title: '复制失败', variant: 'destructive' });
    }
  };

  const handleOpenSetup = () => {
    resetSetupState();
    setShowSetupDialog(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <User className="w-6 h-6 text-indigo-600" />
          账号设置
        </h1>
        <p className="text-slate-500 mt-1">管理您的账号信息和安全设置</p>
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

      {/* 两步验证 (2FA) 卡片 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5" />
            两步验证 (2FA)
          </CardTitle>
          {twoFAEnabled !== null && (
            twoFAEnabled ? (
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100 gap-1">
                <ShieldCheck className="h-3 w-3" />
                已开启
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <ShieldOff className="h-3 w-3" />
                未开启
              </Badge>
            )
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-slate-600">
                {twoFAEnabled
                  ? '您的账号已启用两步验证，登录时需要输入验证码。'
                  : '开启两步验证后，登录时除了密码还需要输入验证码，提高账号安全性。'}
              </p>
            </div>
            <div className="ml-4 shrink-0">
              {twoFAEnabled === null ? (
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              ) : twoFAEnabled ? (
                <Button variant="outline" size="sm" onClick={() => setShowDisableDialog(true)}>
                  关闭 2FA
                </Button>
              ) : (
                <Button size="sm" onClick={handleOpenSetup} className="bg-indigo-600 hover:bg-indigo-700">
                  开启 2FA
                </Button>
              )}
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

      {/* ==================== 2FA 设置弹窗 ==================== */}
      {showSetupDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <Shield className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">开启两步验证</h2>
                  <p className="text-sm text-slate-500">
                    {setupStep === 'password' && '验证当前密码'}
                    {setupStep === 'qr' && '扫描 QR 码'}
                    {setupStep === 'confirm' && '输入验证码确认'}
                  </p>
                </div>
              </div>

              {/* 步骤 1：输入密码 */}
              {setupStep === 'password' && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">
                    为了安全起见，请输入您的当前密码以继续开启两步验证。
                  </p>
                  <Input
                    type="password"
                    placeholder="当前密码"
                    value={setupPassword}
                    onChange={(e) => setSetupPassword(e.target.value)}
                    disabled={twoFALoading}
                    autoFocus
                  />
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setShowSetupDialog(false)} disabled={twoFALoading}>
                      取消
                    </Button>
                    <Button
                      onClick={handleStartSetup}
                      disabled={twoFALoading}
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      {twoFALoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          处理中...
                        </>
                      ) : (
                        '下一步'
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* 步骤 2：展示 QR 码 */}
              {setupStep === 'qr' && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">
                    请使用 Google Authenticator、Microsoft Authenticator 等验证器扫描下方二维码。
                  </p>
                  {setupQRDataURL && (
                    <div className="flex justify-center">
                      <img src={setupQRDataURL} alt="2FA QR Code" className="w-48 h-48" />
                    </div>
                  )}
                  <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                    <p className="text-xs text-slate-500">无法扫描？请手动输入密钥：</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm font-mono bg-white border border-slate-200 rounded px-2 py-1 break-all">
                        {setupSecret}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopySecret}
                        className="shrink-0"
                      >
                        {copiedSecret ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setSetupStep('password')} disabled={twoFALoading}>
                      上一步
                    </Button>
                    <Button
                      onClick={() => setSetupStep('confirm')}
                      disabled={twoFALoading}
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      已扫描，下一步
                    </Button>
                  </div>
                </div>
              )}

              {/* 步骤 3：确认验证码 */}
              {setupStep === 'confirm' && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">
                    请输入验证器上显示的 6 位验证码以确认设置。
                  </p>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="6 位验证码"
                    value={setupCode}
                    onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    disabled={twoFALoading}
                    autoFocus
                    className="text-center text-lg tracking-widest"
                  />
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setSetupStep('qr')} disabled={twoFALoading}>
                      上一步
                    </Button>
                    <Button
                      onClick={handleEnable2FA}
                      disabled={twoFALoading || setupCode.length !== 6}
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      {twoFALoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          启用中...
                        </>
                      ) : (
                        '启用 2FA'
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== 2FA 关闭弹窗 ==================== */}
      {showDisableDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                  <ShieldOff className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">关闭两步验证</h2>
                  <p className="text-sm text-slate-500">此操作会降低账号安全性</p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                <p className="text-sm text-amber-800">
                  <strong>警告：</strong> 关闭两步验证后，您的账号将仅通过密码保护。建议保持开启以提高安全性。
                </p>
              </div>

              <p className="text-sm text-slate-600">请输入当前 6 位验证码以确认关闭。</p>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="6 位验证码"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={twoFALoading}
                autoFocus
                className="text-center text-lg tracking-widest"
              />

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowDisableDialog(false)} disabled={twoFALoading}>
                  取消
                </Button>
                <Button
                  onClick={handleDisable2FA}
                  disabled={twoFALoading || disableCode.length !== 6}
                  variant="destructive"
                >
                  {twoFALoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      处理中...
                    </>
                  ) : (
                    '确认关闭'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
