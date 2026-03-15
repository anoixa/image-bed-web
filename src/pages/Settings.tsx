import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Loader2, Info, Database, Server, HardDrive, Check, Settings2, ImageIcon, Link2, Globe } from 'lucide-react';
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
import { fetchSystemStatus } from '@/api/system';
import { fetchAlbums } from '@/api/albums';
import {
  fetchStorageConfigs,
  createStorageConfig,
  updateStorageConfig,
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
import type { StorageConfig, Album, RandomSourceAlbumConfig, SystemStatus, TransferMode, TransferModeConfig } from '@/types';
import { toast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Settings() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [storageConfigs, setStorageConfigs] = useState<StorageConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateStorageOpen, setIsCreateStorageOpen] = useState(false);
  const [isEditStorageOpen, setIsEditStorageOpen] = useState(false);
  const [editingStorageId, setEditingStorageId] = useState<number | null>(null);
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
      const [storageResult, albumsResult, randomSourceResult, systemStatusResult, transferModeResult] = await Promise.allSettled([
        fetchStorageConfigs(),
        fetchAlbums(),
        fetchRandomSourceAlbum(),
        fetchSystemStatus(),
        fetchTransferMode(),
      ]);

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

  // 存储配置管理
  const handleCreateStorage = async () => {
    if (!newStorage.name.trim()) {
      toast({
        title: '请输入配置名称',
        variant: 'destructive',
      });
      return;
    }

    // 根据存储类型验证必填字段
    if (newStorage.config.type === 'local' && !newStorage.config.path) {
      toast({
        title: '请输入存储路径',
        variant: 'destructive',
      });
      return;
    }

    if (newStorage.config.type === 'minio') {
      if (!newStorage.config.endpoint || !newStorage.config.bucket_name ||
          !newStorage.config.access_key_id || !newStorage.config.secret_access_key) {
        toast({
          title: '请填写完整的 MinIO 配置',
          variant: 'destructive',
        });
        return;
      }
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
      setNewStorage({ name: '', config: { type: 'local' }, is_default: false });
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

  const handleSetDefault = async (id: number) => {
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
          title: '测试成功',
          description: '存储配置连接正常',
        });
      } else {
        toast({
          title: '测试失败',
          description: result.message || '无法连接到存储',
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

  // 打开编辑弹窗
  const handleOpenEditStorage = (config: StorageConfig) => {
    setEditingStorageId(config.id);
    const configType = (config.config as Record<string, string>)?.type || 'local';
    setNewStorage({
      name: config.name,
      config: {
        ...(config.config as Record<string, string>),
        type: configType as 'local' | 'minio' | 'webdav'
      },
      is_default: config.is_default,
    });
    setIsEditStorageOpen(true);
  };

  // 更新存储配置
  const handleUpdateStorage = async () => {
    if (!editingStorageId) return;
    if (!newStorage.name.trim()) {
      toast({
        title: '请输入配置名称',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updateStorageConfig(editingStorageId, {
        name: newStorage.name,
        category: 'storage',
        config: newStorage.config,
      });
      toast({
        title: '更新成功',
        description: '存储配置已更新',
      });
      setNewStorage({ name: '', config: { type: 'local' }, is_default: false });
      setIsEditStorageOpen(false);
      setEditingStorageId(null);
      loadData();
    } catch (error) {
      toast({
        title: '更新失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  // Transfer Mode 管理
  const handleUpdateTransferMode = async (mode: TransferMode) => {
    setIsUpdatingTransferMode(true);
    try {
      await updateTransferMode({ mode });
      setTransferMode(mode);
      toast({
        title: '更新成功',
        description: '传输模式已更新',
      });
    } catch (error) {
      toast({
        title: '更新失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingTransferMode(false);
    }
  };

  // 随机图源相册管理
  const handleUpdateRandomSourceAlbum = async (albumId: number | null) => {
    setIsUpdatingRandomSource(true);
    try {
      await updateRandomSourceAlbum(albumId);
      setRandomSourceAlbum(albumId);
      toast({
        title: '更新成功',
        description: '随机图源已更新',
      });
    } catch (error) {
      toast({
        title: '更新失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingRandomSource(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'storage':
        return <Database className="h-5 w-5" />;
      case 'jwt':
        return <Server className="h-5 w-5" />;
      default:
        return <Settings2 className="h-5 w-5" />;
    }
  };

  const getCategoryName = (category: string) => {
    switch (category) {
      case 'storage':
        return '存储';
      case 'jwt':
        return 'JWT';
      case 'system':
        return '系统';
      case 'image_processing':
        return '图片处理';
      case 'security':
        return '安全';
      default:
        return category;
    }
  };

  const getStorageTypeName = (type: string) => {
    switch (type) {
      case 'local':
        return '本地存储';
      case 'minio':
        return 'MinIO';
      case 'webdav':
        return 'WebDAV';
      default:
        return type;
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">系统设置</h1>
        <p className="text-slate-500 mt-1">管理存储配置和系统参数</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="storage">存储配置</TabsTrigger>
          <TabsTrigger value="transfer">传输设置</TabsTrigger>
          <TabsTrigger value="background">登录背景</TabsTrigger>
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

                              <div className="space-y-2">
                                <label className="text-sm font-medium">Public Endpoint</label>
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
                                  用户访问图片时使用的 CDN 域名或 MinIO 外部地址
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
                          {Boolean(config.config && (config.config as Record<string, unknown>).type) && (
                            <p className="text-xs text-slate-400">
                              类型: {getStorageTypeName(String((config.config as Record<string, unknown>).type))}
                              {(config.config as Record<string, unknown>).path ? ` · 路径: ${String((config.config as Record<string, unknown>).path)}` : ''}
                              {(config.config as Record<string, unknown>).endpoint ? ` · Endpoint: ${String((config.config as Record<string, unknown>).endpoint)}` : ''}
                              {(config.config as Record<string, unknown>).bucket_name ? ` · Bucket: ${String((config.config as Record<string, unknown>).bucket_name)}` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!config.is_default && config.is_enabled && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetDefault(config.id)}
                          >
                            设为默认
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditStorage(config)}
                        >
                          编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTestStorage(config.id)}
                        >
                          测试
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDeleteStorage(config.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
                传输模式设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    transferMode === 'auto'
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  onClick={() => !isUpdatingTransferMode && handleUpdateTransferMode('auto')}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                      transferMode === 'auto' ? 'border-indigo-500' : 'border-slate-300'
                    }`}>
                      {transferMode === 'auto' && <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-slate-800">自动模式</h4>
                      <p className="text-sm text-slate-500 mt-1">
                        根据存储配置自动决定使用代理还是直链。优先使用存储级别的设置。
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    transferMode === 'always_proxy'
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  onClick={() => !isUpdatingTransferMode && handleUpdateTransferMode('always_proxy')}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                      transferMode === 'always_proxy' ? 'border-indigo-500' : 'border-slate-300'
                    }`}>
                      {transferMode === 'always_proxy' && <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-slate-800">始终代理</h4>
                      <p className="text-sm text-slate-500 mt-1">
                        所有图片都通过 Go 服务器代理访问。兼容性好，但会增加服务器带宽。
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    transferMode === 'always_direct'
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  onClick={() => !isUpdatingTransferMode && handleUpdateTransferMode('always_direct')}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                      transferMode === 'always_direct' ? 'border-indigo-500' : 'border-slate-300'
                    }`}>
                      {transferMode === 'always_direct' && <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-slate-800">始终直链</h4>
                      <p className="text-sm text-slate-500 mt-1">
                        所有图片都通过 302 重定向到 CDN/MinIO 直接访问。需要正确配置存储的直链设置。
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-amber-800 mb-2">配置说明</h4>
                <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                  <li>自动模式：优先使用存储配置中的直链设置</li>
                  <li>始终代理：所有请求都经过 Go 服务器，适合内网部署</li>
                  <li>始终直链：适合有 CDN 或 MinIO 公开访问的场景</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 登录背景设置 */}
        <TabsContent value="background" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                随机图源相册
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-slate-500">
                  设置登录页面随机背景图片的来源相册。选择"所有公开图片"将使用系统中所有公开的图片。
                </p>

                <div className="space-y-2">
                  <label className="text-sm font-medium">选择图源相册</label>
                  {isUpdatingRandomSource ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      更新中...
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        onClick={() => handleUpdateRandomSourceAlbum(null)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                          randomSourceAlbum === null
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Globe className="h-5 w-5 text-slate-400" />
                          <span className="text-sm font-medium">所有公开图片</span>
                        </div>
                        {randomSourceAlbum === null && (
                          <Check className="h-4 w-4 text-indigo-600" />
                        )}
                      </button>

                      {albums.map((album) => (
                        <button
                          key={album.id}
                          onClick={() => handleUpdateRandomSourceAlbum(album.id)}
                          className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
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
                  )}
                </div>
              </div>
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

      {/* 编辑存储配置弹窗 */}
      <Dialog open={isEditStorageOpen} onOpenChange={setIsEditStorageOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑存储配置</DialogTitle>
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

            {/* 存储类型 - 只读显示 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500">存储类型（不可修改）</label>
              <Input
                value={getStorageTypeName(newStorage.config.type)}
                disabled
                className="bg-slate-100 text-slate-500 cursor-not-allowed"
              />
              <p className="text-xs text-slate-400">存储类型创建后无法修改，如需更换请删除后重新创建</p>
            </div>

            {/* 根据类型显示只读的基础配置 */}
            {newStorage.config.type === 'local' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-500">存储路径（不可修改）</label>
                <Input
                  value={newStorage.config.path || ''}
                  disabled
                  className="bg-slate-100 text-slate-500 cursor-not-allowed"
                />
              </div>
            )}

            {newStorage.config.type === 'minio' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-500">Endpoint（不可修改）</label>
                  <Input
                    value={newStorage.config.endpoint || ''}
                    disabled
                    className="bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-500">Bucket（不可修改）</label>
                  <Input
                    value={newStorage.config.bucket_name || ''}
                    disabled
                    className="bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-500">Access Key ID（不可修改）</label>
                  <Input
                    value="********"
                    disabled
                    className="bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-500">Secret Access Key（不可修改）</label>
                  <Input
                    value="********"
                    disabled
                    className="bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                </div>
                <div className="flex items-center gap-2 opacity-50">
                  <input
                    type="checkbox"
                    checked={newStorage.config.use_ssl === 'true'}
                    disabled
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  <label className="text-sm text-slate-500">使用 SSL/TLS (HTTPS)</label>
                </div>

                {/* Direct Link 配置 - 可编辑 */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    直链访问配置
                  </h4>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="edit-enable-direct-link"
                        checked={newStorage.config.enable_direct_link === 'true'}
                        onChange={(e) =>
                          setNewStorage({
                            ...newStorage,
                            config: { ...newStorage.config, enable_direct_link: String(e.target.checked) },
                          })
                        }
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <label htmlFor="edit-enable-direct-link" className="text-sm text-slate-700">
                        启用直链访问
                      </label>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Public Endpoint</label>
                      <Input
                        value={newStorage.config.public_endpoint || ''}
                        onChange={(e) =>
                          setNewStorage({
                            ...newStorage,
                            config: { ...newStorage.config, public_endpoint: e.target.value },
                          })
                        }
                        placeholder="https://cdn.example.com"
                      />
                      <p className="text-xs text-slate-500">
                        用户访问图片时使用的 CDN 域名或 MinIO 外部地址
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="edit-public-bucket"
                        checked={newStorage.config.is_public_bucket === 'true'}
                        onChange={(e) =>
                          setNewStorage({
                            ...newStorage,
                            config: { ...newStorage.config, is_public_bucket: String(e.target.checked) },
                          })
                        }
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <label htmlFor="edit-public-bucket" className="text-sm text-slate-700">
                        公开 Bucket（无需签名访问）
                      </label>
                    </div>
                  </div>
                </div>
              </>
            )}

            {newStorage.config.type === 'webdav' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-500">WebDAV URL（不可修改）</label>
                  <Input
                    value={newStorage.config.webdav_url || ''}
                    disabled
                    className="bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-500">用户名（不可修改）</label>
                  <Input
                    value={newStorage.config.webdav_username || ''}
                    disabled
                    className="bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-500">密码（不可修改）</label>
                  <Input
                    value="********"
                    disabled
                    className="bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditStorageOpen(false);
                  setEditingStorageId(null);
                  setNewStorage({ name: '', config: { type: 'local' }, is_default: false });
                }}
              >
                取消
              </Button>
              <Button onClick={handleUpdateStorage} className="bg-indigo-600 hover:bg-indigo-700">
                保存修改
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
