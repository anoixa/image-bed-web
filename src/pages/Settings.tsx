import { useState, useEffect, useCallback } from 'react';
import { Key, Plus, Trash2, Copy, Loader2, Info, Database, Server, HardDrive, Check, Settings2, ImageIcon, Link2, Globe } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { fetchTokens, createToken, deleteToken } from '@/api/tokens';
import { fetchVersion, fetchSystemStatus } from '@/api/system';
import { fetchAlbums } from '@/api/albums';
import {
  fetchStorageConfigs,
  createStorageConfig,
  deleteStorageConfig,
  setDefaultStorageConfig,
  testStorageConfig,
  fetchTransferMode,
  updateTransferMode
} from '@/api/configs';
import {
  fetchRandomSourceAlbum,
  updateRandomSourceAlbum
} from '@/api/images';
import type { Token, SystemInfo, StorageConfig, Album, RandomSourceAlbumConfig, SystemStatus, TransferMode, TransferModeConfig } from '@/types';
import { toast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Settings() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [storageConfigs, setStorageConfigs] = useState<StorageConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateTokenOpen, setIsCreateTokenOpen] = useState(false);
  const [isCreateStorageOpen, setIsCreateStorageOpen] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [createdToken, setCreatedToken] = useState<{ token: string; hash: string } | null>(null);
  const [activeTab, setActiveTab] = useState('storage');

  // 确认弹窗状态
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant?: 'destructive' | 'default';
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  // 随机图源相册配置
  const [albums, setAlbums] = useState<Album[]>([]);
  const [randomSourceAlbum, setRandomSourceAlbum] = useState<number | null>(null);
  const [isUpdatingRandomSource, setIsUpdatingRandomSource] = useState(false);

  // Transfer Mode 配置
  const [transferMode, setTransferMode] = useState<TransferMode>('auto');
  const [isUpdatingTransferMode, setIsUpdatingTransferMode] = useState(false);

  // 存储配置表单 - category 固定为 'storage'，存储类型放在 config.type 中
  const [newStorage, setNewStorage] = useState<{
    name: string;
    config: {
      type: 'local' | 'minio' | 'webdav';
      [key: string]: string;
    };
    is_default: boolean;
  }>({
    name: '',
    config: { type: 'local' },
    is_default: false,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 分别处理每个请求，避免一个失败影响其他请求
      const [tokensResult, versionResult, storageResult, albumsResult, randomSourceResult, systemStatusResult, transferModeResult] = await Promise.allSettled([
        fetchTokens(),
        fetchVersion(),
        fetchStorageConfigs(),
        fetchAlbums(),
        fetchRandomSourceAlbum(),
        fetchSystemStatus(),
        fetchTransferMode(),
      ]);

      // 处理 Token 数据
      if (tokensResult.status === 'fulfilled') {
        const tokenData = tokensResult.value;
        setTokens(Array.isArray(tokenData) ? tokenData : []);
      } else {
        console.error('加载 Token 失败:', tokensResult.reason);
        setTokens([]);
      }

      // 处理系统版本数据
      if (versionResult.status === 'fulfilled') {
        setSystemInfo(versionResult.value);
      } else {
        console.error('加载系统版本失败:', versionResult.reason);
      }

      // 处理存储配置数据
      if (storageResult.status === 'fulfilled') {
        // 只显示 category 为 storage 的配置
        const configs = storageResult.value;
        const configArray = Array.isArray(configs) ? configs : [];
        const filteredConfigs = configArray.filter(config => config.category === 'storage');
        setStorageConfigs(filteredConfigs);
      } else {
        console.error('加载存储配置失败:', storageResult.reason);
        setStorageConfigs([]);
        toast({
          title: '加载存储配置失败',
          description: storageResult.reason instanceof Error ? storageResult.reason.message : '请稍后重试',
          variant: 'destructive',
        });
      }

      // 处理相册数据
      if (albumsResult.status === 'fulfilled') {
        setAlbums(albumsResult.value);
      } else {
        console.error('加载相册失败:', albumsResult.reason);
        setAlbums([]);
      }

      // 处理随机图源相册配置
      if (randomSourceResult.status === 'fulfilled') {
        // album_id 为 0 时表示"所有公开图片"，转换为 null
        const albumId = randomSourceResult.value.album_id;
        setRandomSourceAlbum(albumId === 0 ? null : albumId);
      } else {
        console.error('加载随机图源相册配置失败:', randomSourceResult.reason);
        setRandomSourceAlbum(null);
      }

      // 处理系统状态
      if (systemStatusResult.status === 'fulfilled') {
        setSystemStatus(systemStatusResult.value);
      } else {
        console.error('加载系统状态失败:', systemStatusResult.reason);
      }

      // 处理 Transfer Mode 配置
      if (transferModeResult.status === 'fulfilled') {
        setTransferMode(transferModeResult.value.mode);
      } else {
        console.error('加载 Transfer Mode 配置失败:', transferModeResult.reason);
        setTransferMode('auto');
      }
    } catch (error) {
      toast({
        title: '加载失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Token 管理
  const handleCreateToken = async () => {
    if (!newTokenName.trim()) {
      toast({
        title: '请输入Token名称',
        variant: 'destructive',
      });
      return;
    }

    try {
      const token = await createToken(newTokenName);
      setCreatedToken(token);
      setNewTokenName('');
      setActiveTab('tokens');  // 创建成功后自动切换到 tokens 选项卡
      loadData();
    } catch (error) {
      toast({
        title: '创建失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteToken = async (id: number) => {
    setConfirmDialog({
      open: true,
      title: '删除 Token',
      description: '确定要删除这个 Token 吗？删除后将无法恢复。',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await deleteToken(id);
          toast({
            title: '删除成功',
            description: 'Token 已删除',
          });
          loadData();
        } catch (error) {
          toast({
            title: '删除失败',
            description: error instanceof Error ? error.message : '请稍后重试',
            variant: 'destructive',
          });
        }
      },
    });
  };

  const handleCopyToken = async (token: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(token);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = token;
        textarea.style.position = 'fixed';
        textarea.style.left = '-999999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!success) {
          throw new Error('execCommand copy failed');
        }
      }
      toast({
        title: '复制成功',
        description: 'Token已复制到剪贴板',
      });
    } catch {
      toast({
        title: '复制失败',
        description: '请手动复制',
        variant: 'destructive',
      });
    }
  };

  // 更新随机图源相册
  const handleUpdateRandomSourceAlbum = async (albumId: number | null) => {
    setIsUpdatingRandomSource(true);
    try {
      await updateRandomSourceAlbum(albumId ?? 0);
      setRandomSourceAlbum(albumId);
      toast({
        title: '设置成功',
        description: albumId
          ? `已将 "${albums.find(a => a.id === albumId)?.name}" 设为登录页背景图源`
          : '已取消登录页背景图源设置（将使用所有公开图片）',
      });
    } catch (error) {
      toast({
        title: '设置失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingRandomSource(false);
    }
  };

  // 更新 Transfer Mode
  const handleUpdateTransferMode = async (mode: TransferMode) => {
    setIsUpdatingTransferMode(true);
    try {
      const result = await updateTransferMode({ mode });
      setTransferMode(result.mode);
      toast({
        title: '设置成功',
        description: `全局传输模式已更新为：${mode === 'auto' ? '自动' : mode === 'always_proxy' ? '始终代理' : '始终直链'}`,
      });
    } catch (error) {
      toast({
        title: '设置失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingTransferMode(false);
    }
  };

  // 存储配置管理
  const handleCreateStorage = async () => {
    if (!newStorage.name.trim()) {
      toast({
        title: '请输入配置名称',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createStorageConfig({
        name: newStorage.name,
        category: 'storage',
        config: newStorage.config,
        is_default: newStorage.is_default,
      });
      toast({
        title: '创建成功',
        description: '存储配置已创建',
      });
      setNewStorage({
        name: '',
        config: { type: 'local' },
        is_default: false,
      });
      setIsCreateStorageOpen(false);
      loadData();
    } catch (error) {
      toast({
        title: '创建失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteStorage = async (id: number) => {
    setConfirmDialog({
      open: true,
      title: '删除存储配置',
      description: '确定要删除这个存储配置吗？删除后将无法恢复。',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await deleteStorageConfig(id);
          toast({
            title: '删除成功',
            description: '存储配置已删除',
          });
          loadData();
        } catch (error) {
          toast({
            title: '删除失败',
            description: error instanceof Error ? error.message : '请稍后重试',
            variant: 'destructive',
          });
        }
      },
    });
  };

  const handleSetDefaultStorage = async (id: number) => {
    try {
      await setDefaultStorageConfig(id);
      toast({
        title: '设置成功',
        description: '默认存储已更新',
      });
      loadData();
    } catch (error) {
      toast({
        title: '设置失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  const handleTestStorage = async (id: number) => {
    try {
      const result = await testStorageConfig(id);
      if (result.success) {
        toast({
          title: '连接测试成功',
          description: result.message,
        });
      } else {
        toast({
          title: '连接测试失败',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: '测试失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'local':
        return <HardDrive className="h-5 w-5" />;
      case 'minio':
        return <Database className="h-5 w-5" />;
      case 'webdav':
        return <Server className="h-5 w-5" />;
      default:
        return <Database className="h-5 w-5" />;
    }
  };

  const getCategoryName = (category: string) => {
    switch (category) {
      case 'local':
        return '本地存储';
      case 'minio':
        return 'MinIO';
      case 'webdav':
        return 'WebDAV';
      default:
        return category;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">系统设置</h1>
        <p className="text-slate-500 mt-1">管理 API Token 和存储配置</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="storage">存储配置</TabsTrigger>
          <TabsTrigger value="transfer">传输设置</TabsTrigger>
          <TabsTrigger value="background">登录背景</TabsTrigger>
          <TabsTrigger value="tokens">API Token</TabsTrigger>
          <TabsTrigger value="system">系统信息</TabsTrigger>
        </TabsList>

        {/* 存储配置 */}
        <TabsContent value="storage" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  存储配置管理
                </CardTitle>
                <Dialog open={isCreateStorageOpen} onOpenChange={setIsCreateStorageOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-indigo-600 hover:bg-indigo-700">
                      <Plus className="mr-2 h-4 w-4" />
                      新建配置
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>新建存储配置</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">配置名称</label>
                        <Input
                          value={newStorage.name}
                          onChange={(e) => setNewStorage({ ...newStorage, name: e.target.value })}
                          placeholder="例如：本地存储、MinIO主库"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">存储类型</label>
                        <select
                          value={newStorage.config.type}
                          onChange={(e) =>
                            setNewStorage({
                              ...newStorage,
                              config: { type: e.target.value as 'local' | 'minio' | 'webdav' }
                            })
                          }
                          className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                        >
                          <option value="local">本地存储</option>
                          <option value="minio">MinIO</option>
                          <option value="webdav">WebDAV</option>
                        </select>
                      </div>

                      {/* 配置字段 */}
                      {newStorage.config.type === 'local' && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">存储路径</label>
                          <Input
                            placeholder="/data/uploads"
                            onChange={(e) =>
                              setNewStorage({
                                ...newStorage,
                                config: { ...newStorage.config, path: e.target.value },
                              })
                            }
                          />
                        </div>
                      )}

                      {newStorage.config.type === 'minio' && (
                        <>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Endpoint</label>
                            <Input
                              placeholder="192.168.10.3:9000"
                              onChange={(e) =>
                                setNewStorage({
                                  ...newStorage,
                                  config: { ...newStorage.config, endpoint: e.target.value },
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Bucket</label>
                            <Input
                              placeholder="image-pre"
                              onChange={(e) =>
                                setNewStorage({
                                  ...newStorage,
                                  config: { ...newStorage.config, bucket_name: e.target.value },
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Access Key ID</label>
                            <Input
                              onChange={(e) =>
                                setNewStorage({
                                  ...newStorage,
                                  config: { ...newStorage.config, access_key_id: e.target.value },
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Secret Access Key</label>
                            <Input
                              type="password"
                              onChange={(e) =>
                                setNewStorage({
                                  ...newStorage,
                                  config: { ...newStorage.config, secret_access_key: e.target.value },
                                })
                              }
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="minio-ssl"
                              checked={newStorage.config.use_ssl === 'true'}
                              onChange={(e) =>
                                setNewStorage({
                                  ...newStorage,
                                  config: { ...newStorage.config, use_ssl: String(e.target.checked) },
                                })
                              }
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <label htmlFor="minio-ssl" className="text-sm text-slate-700">
                              使用 SSL/TLS (HTTPS)
                            </label>
                          </div>

                          {/* Direct Link 配置 */}
                          <div className="border-t pt-4 mt-4">
                            <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                              <Link2 className="h-4 w-4" />
                              直链访问配置
                            </h4>

                            <div className="space-y-4">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id="minio-enable-direct-link"
                                  checked={newStorage.config.enable_direct_link === 'true'}
                                  onChange={(e) =>
                                    setNewStorage({
                                      ...newStorage,
                                      config: { ...newStorage.config, enable_direct_link: String(e.target.checked) },
                                    })
                                  }
                                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <label htmlFor="minio-enable-direct-link" className="text-sm text-slate-700">
                                  启用直链访问
                                </label>
                              </div>

                              {newStorage.config.enable_direct_link === 'true' && (
                                <>
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">Public Endpoint (CDN URL)</label>
                                    <Input
                                      placeholder="https://cdn.example.com"
                                      onChange={(e) =>
                                        setNewStorage({
                                          ...newStorage,
                                          config: { ...newStorage.config, public_endpoint: e.target.value },
                                        })
                                      }
                                    />
                                    <p className="text-xs text-slate-500">
                                      可选，用于 CDN 加速，留空则使用 MinIO Endpoint
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      id="minio-public-bucket"
                                      checked={newStorage.config.is_public_bucket === 'true'}
                                      onChange={(e) =>
                                        setNewStorage({
                                          ...newStorage,
                                          config: { ...newStorage.config, is_public_bucket: String(e.target.checked) },
                                        })
                                      }
                                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <label htmlFor="minio-public-bucket" className="text-sm text-slate-700">
                                      公开 Bucket（无需签名访问）
                                    </label>
                                  </div>

                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">传输模式</label>
                                    <select
                                      value={newStorage.config.transfer_mode || 'auto'}
                                      onChange={(e) =>
                                        setNewStorage({
                                          ...newStorage,
                                          config: { ...newStorage.config, transfer_mode: e.target.value as TransferMode },
                                        })
                                      }
                                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                                    >
                                      <option value="auto">自动（根据全局设置）</option>
                                      <option value="always_proxy">始终代理（通过 Go 服务器）</option>
                                      <option value="always_direct">始终直链（302 重定向到 CDN/MinIO）</option>
                                    </select>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </>
                      )}

                      {newStorage.config.type === 'webdav' && (
                        <>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">WebDAV URL</label>
                            <Input
                              placeholder="https://dav.example.com"
                              onChange={(e) =>
                                setNewStorage({
                                  ...newStorage,
                                  config: { ...newStorage.config, webdav_url: e.target.value },
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">用户名</label>
                            <Input
                              onChange={(e) =>
                                setNewStorage({
                                  ...newStorage,
                                  config: { ...newStorage.config, webdav_username: e.target.value },
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">密码</label>
                            <Input
                              type="password"
                              onChange={(e) =>
                                setNewStorage({
                                  ...newStorage,
                                  config: { ...newStorage.config, webdav_password: e.target.value },
                                })
                              }
                            />
                          </div>
                        </>
                      )}

                      <div className="flex items-center gap-2 pt-2">
                        <input
                          type="checkbox"
                          id="is_default"
                          checked={newStorage.is_default}
                          onChange={(e) =>
                            setNewStorage({ ...newStorage, is_default: e.target.checked })
                          }
                          className="rounded border-gray-300"
                        />
                        <label htmlFor="is_default" className="text-sm">
                          设为默认存储
                        </label>
                      </div>

                      <div className="flex justify-end gap-3 pt-4">
                        <Button variant="outline" onClick={() => setIsCreateStorageOpen(false)}>
                          取消
                        </Button>
                        <Button onClick={handleCreateStorage} className="bg-indigo-600 hover:bg-indigo-700">
                          创建
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {!storageConfigs || storageConfigs.length === 0 ? (
                <div className="text-center py-10">
                  <Database className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">暂无存储配置</p>
                  <p className="text-sm text-slate-400 mt-1">创建存储配置以开始使用</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {storageConfigs.map((config) => (
                    <div
                      key={config.id}
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        config.is_default
                          ? 'bg-indigo-50 border-indigo-200'
                          : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            config.is_default ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {getCategoryIcon(config.category)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{config.name}</span>
                            {config.is_default && (
                              <Badge className="bg-indigo-600">默认</Badge>
                            )}
                            <Badge variant={config.is_enabled ? 'default' : 'secondary'}>
                              {config.is_enabled ? '启用' : '禁用'}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-500">
                            {getCategoryName(config.category)} · {formatDate(config.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!config.is_default && config.is_enabled && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetDefaultStorage(config.id)}
                            title="设为默认"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTestStorage(config.id)}
                          title="测试连接"
                        >
                          <Settings2 className="h-4 w-4" />
                        </Button>
                        {!config.is_default && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteStorage(config.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 传输设置 */}
        <TabsContent value="transfer" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                图片传输模式设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500 mb-2">
                    设置图片访问的全局传输模式。启用直链访问后，系统可以通过 302 重定向直接将请求转发到 CDN 或 MinIO，减轻服务器压力。
                  </p>
                  <p className="text-sm text-slate-400">
                    存储级别的设置会覆盖全局设置。仅在 MinIO 存储类型中可用。
                  </p>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="text-sm font-medium">选择传输模式</label>
                    <div className="grid gap-2">
                      <button
                        onClick={() => handleUpdateTransferMode('auto')}
                        disabled={isUpdatingTransferMode}
                        className={`flex items-start gap-3 p-4 rounded-lg border transition-all text-left ${
                          transferMode === 'auto'
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className={`mt-0.5 ${transferMode === 'auto' ? 'text-indigo-600' : 'text-slate-400'}`}>
                          {transferMode === 'auto' && <Check className="h-5 w-5" />}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">自动模式</div>
                          <p className="text-xs text-slate-500 mt-1">
                            根据存储配置自动决定使用代理还是直链。优先使用存储级别的设置。
                          </p>
                        </div>
                      </button>

                      <button
                        onClick={() => handleUpdateTransferMode('always_proxy')}
                        disabled={isUpdatingTransferMode}
                        className={`flex items-start gap-3 p-4 rounded-lg border transition-all text-left ${
                          transferMode === 'always_proxy'
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className={`mt-0.5 ${transferMode === 'always_proxy' ? 'text-indigo-600' : 'text-slate-400'}`}>
                          {transferMode === 'always_proxy' && <Check className="h-5 w-5" />}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">始终代理</div>
                          <p className="text-xs text-slate-500 mt-1">
                            所有图片请求都通过 Go 服务器代理。适用于需要统一访问控制或 CDN 不可用的场景。
                          </p>
                        </div>
                      </button>

                      <button
                        onClick={() => handleUpdateTransferMode('always_direct')}
                        disabled={isUpdatingTransferMode}
                        className={`flex items-start gap-3 p-4 rounded-lg border transition-all text-left ${
                          transferMode === 'always_direct'
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className={`mt-0.5 ${transferMode === 'always_direct' ? 'text-indigo-600' : 'text-slate-400'}`}>
                          {transferMode === 'always_direct' && <Check className="h-5 w-5" />}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">始终直链</div>
                          <p className="text-xs text-slate-500 mt-1">
                            所有图片都通过 302 重定向到 CDN/MinIO 直接访问。需要正确配置存储的直链设置。
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 登录背景配置 */}
        <TabsContent value="background" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                登录页背景设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500 mb-2">
                    选择一个相册作为登录页 Ken Burns 背景的图源。系统将从这个相册中随机选择图片展示。
                  </p>
                  <p className="text-sm text-slate-400">
                    如不选择，将从所有公开图片中随机获取。
                  </p>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  </div>
                ) : albums.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-lg">
                    <ImageIcon className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500">暂无相册</p>
                    <p className="text-sm text-slate-400 mt-1">请先创建相册并上传图片</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="text-sm font-medium">选择相册</label>
                    <div className="grid gap-2">
                      <button
                        onClick={() => handleUpdateRandomSourceAlbum(null)}
                        disabled={isUpdatingRandomSource}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                          randomSourceAlbum === null
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <span className="text-sm">所有公开图片（默认）</span>
                        {randomSourceAlbum === null && (
                          <Check className="h-4 w-4 text-indigo-600" />
                        )}
                      </button>

                      {albums.map((album) => (
                        <button
                          key={album.id}
                          onClick={() => handleUpdateRandomSourceAlbum(album.id)}
                          disabled={isUpdatingRandomSource}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                            randomSourceAlbum === album.id
                              ? 'border-indigo-500 bg-indigo-50'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">{album.name}</span>
                            <span className="text-xs text-slate-400">
                              {album.image_count} 张图片
                            </span>
                          </div>
                          {randomSourceAlbum === album.id && (
                            <Check className="h-4 w-4 text-indigo-600" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Token */}
        <TabsContent value="tokens" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  API Token 管理
                </CardTitle>
                <Dialog open={isCreateTokenOpen} onOpenChange={setIsCreateTokenOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-indigo-600 hover:bg-indigo-700">
                      <Plus className="mr-2 h-4 w-4" />
                      新建 Token
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>新建 API Token</DialogTitle>
                    </DialogHeader>
                    {createdToken ? (
                      <div className="space-y-4 pt-4">
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                          <p className="text-sm text-amber-800 font-medium mb-2">
                            请立即复制保存，此 Token 只显示一次！
                          </p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 bg-slate-900 text-slate-100 px-3 py-2 rounded text-sm font-mono break-all">
                              {createdToken.token}
                            </code>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => createdToken.token && handleCopyToken(createdToken.token)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <Button
                          onClick={() => {
                            setCreatedToken(null);
                            setIsCreateTokenOpen(false);
                          }}
                          className="w-full"
                        >
                          完成
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Token 名称</label>
                          <Input
                            value={newTokenName}
                            onChange={(e) => setNewTokenName(e.target.value)}
                            placeholder="例如：手机应用、第三方工具"
                          />
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                          <Button variant="outline" onClick={() => setIsCreateTokenOpen(false)}>
                            取消
                          </Button>
                          <Button onClick={handleCreateToken} className="bg-indigo-600 hover:bg-indigo-700">
                            创建
                          </Button>
                        </div>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {!tokens || tokens.length === 0 ? (
                <div className="text-center py-10">
                  <Key className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">暂无 API Token</p>
                  <p className="text-sm text-slate-400 mt-1">创建 Token 用于第三方应用访问</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tokens.map((token) => (
                    <div
                      key={token.id}
                      className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{token.description || token.prefix}</span>
                          <Badge variant={token.is_active ? 'default' : 'secondary'}>
                            {token.is_active ? '有效' : '已失效'}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-500 mt-1">
                          Token: {token.prefix}*** · 创建于 {formatDate(token.created_at)}
                          {token.last_used_at && ` · 最后使用 ${formatDate(token.last_used_at)}`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleDeleteToken(token.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 系统信息 */}
        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                系统信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 版本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">版本</p>
                  <p className="font-medium">{systemInfo?.version || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Commit</p>
                  <p className="font-medium font-mono text-sm">
                    {systemInfo?.commit?.slice(0, 8) || 'Unknown'}
                  </p>
                </div>
              </div>

              {/* 系统状态 */}
              {systemStatus && (
                <>
                  {/* 运行环境 */}
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-slate-700 mb-3">运行环境</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-slate-500">环境</p>
                        <p className="font-medium text-sm">{systemStatus.environment}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">缓存</p>
                        <p className="font-medium text-sm">{systemStatus.cache.provider}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">CPU 核心</p>
                        <p className="font-medium text-sm">{systemStatus.runtime.num_cpu}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Goroutines</p>
                        <p className="font-medium text-sm">{systemStatus.memory.goroutines}</p>
                      </div>
                    </div>
                  </div>

                  {/* 内存使用 */}
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-slate-700 mb-3">内存使用</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-slate-500">堆内存分配</p>
                        <p className="font-medium text-sm">{systemStatus.memory.heap_alloc_str}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">堆系统内存</p>
                        <p className="font-medium text-sm">{systemStatus.memory.heap_sys_str}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">堆使用内存</p>
                        <p className="font-medium text-sm">{systemStatus.memory.heap_in_use_str}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">GC 系统内存</p>
                        <p className="font-medium text-sm">{systemStatus.memory.gc_sys_str}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">栈内存</p>
                        <p className="font-medium text-sm">{systemStatus.memory.stack_sys_str}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">GC 次数</p>
                        <p className="font-medium text-sm">{systemStatus.memory.num_gc}</p>
                      </div>
                    </div>
                  </div>

                  {/* 数据目录 */}
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-slate-700 mb-3">数据目录</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-slate-500">路径</p>
                        <p className="font-medium text-sm font-mono">{systemStatus.data_dir.path}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">文件数</p>
                        <p className="font-medium text-sm">{systemStatus.data_dir.file_count}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">总大小</p>
                        <p className="font-medium text-sm">{systemStatus.data_dir.size_str}</p>
                      </div>
                    </div>
                  </div>

                  {/* Go 运行时 */}
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-slate-700 mb-3">Go 运行时</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-500">Go 版本</p>
                        <p className="font-medium text-sm font-mono">{systemStatus.go_version}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Commit</p>
                        <p className="font-medium text-sm font-mono">{systemStatus.commit_hash || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 确认弹窗 */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        variant={confirmDialog.variant}
      />
    </div>
  );
}
