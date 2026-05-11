import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Trash2, Pencil, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  fetchStorageConfigs,
  createStorageConfig,
  updateStorageConfig,
  deleteStorageConfig,
  enableStorageConfig,
  disableStorageConfig,
} from '@/api/configs';
import type { StorageConfig } from '@/types';
import { toast } from '@/components/ui/use-toast';

type OAuthProviderType = 'github' | 'google' | 'gitee';

interface OAuthFormData {
  name: string;
  provider: OAuthProviderType;
  client_id: string;
  client_secret: string;
  is_enabled: boolean;
}

const PROVIDER_LABELS: Record<OAuthProviderType, string> = {
  github: 'GitHub',
  google: 'Google',
  gitee: 'Gitee',
};

function getCallbackUrl(provider: string): string {
  return `${window.location.origin}/api/auth/oauth/${provider}/callback`;
}

export default function OAuthConfigManager() {
  const [configs, setConfigs] = useState<StorageConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  const [formData, setFormData] = useState<OAuthFormData>({
    name: '',
    provider: 'github',
    client_id: '',
    client_secret: '',
    is_enabled: true,
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant: 'destructive' | 'default';
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {},
    variant: 'destructive',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchStorageConfigs('oauth');
      setConfigs(Array.isArray(result) ? result : []);
    } catch (error) {
      toast({
        title: '加载失败',
        description: error instanceof Error ? error.message : '获取 OAuth 配置失败',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setFormData({
      name: '',
      provider: 'github',
      client_id: '',
      client_secret: '',
      is_enabled: true,
    });
    setShowSecret(false);
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.client_id) {
      toast({ title: '请填写名称和 Client ID', variant: 'destructive' });
      return;
    }
    try {
      await createStorageConfig({
        name: formData.name,
        category: 'oauth',
        config: {
          provider: formData.provider,
          client_id: formData.client_id,
          client_secret: formData.client_secret,
        },
        is_enabled: formData.is_enabled,
      });
      toast({ title: '创建成功', description: 'OAuth Provider 已添加' });
      setIsCreateOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      toast({
        title: '创建失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    try {
      await updateStorageConfig(editingId, {
        name: formData.name,
        config: {
          provider: formData.provider,
          client_id: formData.client_id,
          client_secret: formData.client_secret,
        },
        is_enabled: formData.is_enabled,
      });
      toast({ title: '更新成功', description: 'OAuth Provider 已更新' });
      setIsEditOpen(false);
      setEditingId(null);
      resetForm();
      loadData();
    } catch (error) {
      toast({
        title: '更新失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = (id: number) => {
    setConfirmDialog({
      open: true,
      title: '确认删除',
      description: '确定要删除这个 OAuth Provider 配置吗？此操作不可恢复。',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await deleteStorageConfig(id);
          toast({ title: '删除成功', description: '配置已删除' });
          loadData();
        } catch (error) {
          toast({
            title: '删除失败',
            description: error instanceof Error ? error.message : '请稍后重试',
            variant: 'destructive',
          });
        }
        setConfirmDialog((prev) => ({ ...prev, open: false }));
      },
    });
  };

  const handleToggle = async (config: StorageConfig) => {
    try {
      if (config.is_enabled) {
        await disableStorageConfig(config.id);
      } else {
        await enableStorageConfig(config.id);
      }
      toast({ title: config.is_enabled ? '已禁用' : '已启用' });
      loadData();
    } catch (error) {
      toast({
        title: '操作失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  const openEdit = (config: StorageConfig) => {
    setEditingId(config.id);
    const cfg = config.config as Record<string, string>;
    setFormData({
      name: config.name,
      provider: (cfg.provider as OAuthProviderType) || 'github',
      client_id: cfg.client_id || '',
      client_secret: cfg.client_secret || '',
      is_enabled: config.is_enabled,
    });
    setIsEditOpen(true);
  };

  const openCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ExternalLink className="h-5 w-5" />
            OAuth Provider 配置
          </CardTitle>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            添加 Provider
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : configs.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              暂无 OAuth Provider 配置
            </div>
          ) : (
            <div className="space-y-4">
              {configs.map((config) => {
                const cfg = config.config as Record<string, string>;
                const provider = cfg.provider || 'github';
                return (
                  <div
                    key={config.id}
                    className="flex items-start justify-between p-4 bg-slate-50 rounded-lg border border-slate-100"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{config.name}</span>
                        <Badge variant="outline">
                          {PROVIDER_LABELS[provider as OAuthProviderType] || provider}
                        </Badge>
                        {config.is_enabled ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                            启用
                          </Badge>
                        ) : (
                          <Badge variant="secondary">禁用</Badge>
                        )}
                      </div>
                      <div className="text-sm text-slate-500">
                        Client ID: {cfg.client_id || '-'}
                      </div>
                      <div className="text-xs text-slate-400 font-mono break-all">
                        Callback: {getCallbackUrl(provider)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-4 shrink-0">
                      <Switch
                        checked={config.is_enabled}
                        onCheckedChange={() => handleToggle(config)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(config)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(config.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 创建弹窗 */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>添加 OAuth Provider</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="oauth-name">
                名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="oauth-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="例如：GitHub"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oauth-provider">Provider</Label>
              <select
                id="oauth-provider"
                value={formData.provider}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    provider: e.target.value as OAuthProviderType,
                  }))
                }
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="github">GitHub</option>
                <option value="google">Google</option>
                <option value="gitee">Gitee</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="oauth-client-id">
                Client ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="oauth-client-id"
                value={formData.client_id}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, client_id: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oauth-client-secret">Client Secret</Label>
              <div className="relative">
                <Input
                  id="oauth-client-secret"
                  type={showSecret ? 'text' : 'password'}
                  value={formData.client_secret}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      client_secret: e.target.value,
                    }))
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showSecret ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="oauth-enabled"
                checked={formData.is_enabled}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, is_enabled: checked }))
                }
              />
              <Label htmlFor="oauth-enabled">启用</Label>
            </div>
            <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded break-all">
              Callback URL: {getCallbackUrl(formData.provider)}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                取消
              </Button>
              <Button onClick={handleCreate}>创建</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 编辑弹窗 */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑 OAuth Provider</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-oauth-name">
                名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-oauth-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-oauth-provider">Provider</Label>
              <select
                id="edit-oauth-provider"
                value={formData.provider}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    provider: e.target.value as OAuthProviderType,
                  }))
                }
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="github">GitHub</option>
                <option value="google">Google</option>
                <option value="gitee">Gitee</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-oauth-client-id">
                Client ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-oauth-client-id"
                value={formData.client_id}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, client_id: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-oauth-client-secret">Client Secret</Label>
              <div className="relative">
                <Input
                  id="edit-oauth-client-secret"
                  type={showSecret ? 'text' : 'password'}
                  value={formData.client_secret}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      client_secret: e.target.value,
                    }))
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showSecret ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="edit-oauth-enabled"
                checked={formData.is_enabled}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, is_enabled: checked }))
                }
              />
              <Label htmlFor="edit-oauth-enabled">启用</Label>
            </div>
            <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded break-all">
              Callback URL: {getCallbackUrl(formData.provider)}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                取消
              </Button>
              <Button onClick={handleUpdate}>保存</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          setConfirmDialog((prev) => ({ ...prev, open }))
        }
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        variant={confirmDialog.variant}
      />
    </div>
  );
}
