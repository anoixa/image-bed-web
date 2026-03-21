import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Loader2, Info, Database, Server, HardDrive, Check, Settings2, ImageIcon, Link2, Globe, Folder } from 'lucide-react';
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
import { fetchSystemStatus, fetchConversionConfig, updateConversionConfig } from '@/api/system';
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
import type { StorageConfig, Album, RandomSourceAlbumConfig, SystemStatus, TransferMode, TransferModeConfig, ConversionConfig } from '@/types';
import { toast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';

export default function Settings() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [storageConfigs, setStorageConfigs] = useState<StorageConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateStorageOpen, setIsCreateStorageOpen] = useState(false);
  const [isEditStorageOpen, setIsEditStorageOpen] = useState(false);
  const [editingStorageId, setEditingStorageId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('general');

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

  // 转换配置
  const [conversionConfig, setConversionConfig] = useState<ConversionConfig | null>(null);
  const [editingConfig, setEditingConfig] = useState<ConversionConfig | null>(null);
  const [isUpdatingConversion, setIsUpdatingConversion] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // 存储配置表单
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

      const [storageResult, albumsResult, randomSourceResult, systemStatusResult, transferModeResult, conversionConfigResult] = await Promise.allSettled([
        fetchStorageConfigs(),
        fetchAlbums(),
        fetchRandomSourceAlbum(),
        fetchSystemStatus(),
        fetchTransferMode(),
        fetchConversionConfig(),
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

      // 处理转换配置数据
      if (conversionConfigResult.status === 'fulfilled') {
        setConversionConfig(conversionConfigResult.value);
        setEditingConfig(conversionConfigResult.value);
        setHasChanges(false);
      } else {
        console.error('加载转换配置失败:', conversionConfigResult.reason);
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
    if (!newStorage.name) {
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
        is_enabled: true,
        is_default: newStorage.is_default,
      });
      toast({
        title: '创建成功',
        description: '存储配置已创建',
      });
      setIsCreateStorageOpen(false);
      setNewStorage({ name: '', config: { type: 'local' }, is_default: false });
      loadData();
    } catch (error) {
      toast({
        title: '创建失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateStorage = async () => {
    if (!editingStorageId || !newStorage.name) {
      toast({
        title: '请输入配置名称',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updateStorageConfig(editingStorageId, {
        name: newStorage.name,
        is_default: newStorage.is_default,
      });
      toast({
        title: '更新成功',
        description: '存储配置已更新',
      });
      setIsEditStorageOpen(false);
      setEditingStorageId(null);
      setNewStorage({ name: '', config: { type: 'local' }, is_default: false });
      loadData();
    } catch (error) {
      toast({
        title: '更新失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteStorage = (id: number) => {
    setConfirmDialog({
      open: true,
      title: '确认删除',
      description: '确定要删除这个存储配置吗？此操作不可恢复。',
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
        description: '默认存储配置已更新',
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
          title: '连接成功',
          description: result.message || '存储配置连接正常',
        });
      } else {
        toast({
          title: '连接失败',
          description: result.message || '无法连接到存储服务',
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

  const openEditStorage = (config: StorageConfig) => {
    setEditingStorageId(config.id);
    setNewStorage({
      name: config.name,
      config: config.config as { type: 'local' | 'minio' | 'webdav'; [key: string]: string },
      is_default: config.is_default,
    });
    setIsEditStorageOpen(true);
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

  const handleEditConfig = <K extends keyof ConversionConfig>(
    key: K,
    value: ConversionConfig[K]
  ) => {
    if (!editingConfig) return;
    setEditingConfig({ ...editingConfig, [key]: value });
    setHasChanges(true);
  };

  // WebP 开关本地编辑
  const handleWebPToggle = (enabled: boolean) => {
    if (!editingConfig) return;
    const formats = enabled
      ? [...editingConfig.conversion_enabled_formats, 'webp']
      : editingConfig.conversion_enabled_formats.filter(f => f !== 'webp');
    handleEditConfig('conversion_enabled_formats', formats);
  };

  // AVIF 开关本地编辑
  const handleAVIFToggle = (enabled: boolean) => {
    if (!editingConfig) return;
    const formats = enabled
      ? [...editingConfig.conversion_enabled_formats, 'avif']
      : editingConfig.conversion_enabled_formats.filter(f => f !== 'avif');
    handleEditConfig('conversion_enabled_formats', formats);
  };

  // 保存配置到服务器
  const handleSaveConfig = async () => {
    if (!editingConfig) return;

    setIsUpdatingConversion(true);
    try {
      await updateConversionConfig(editingConfig);
      setConversionConfig(editingConfig);
      setHasChanges(false);
      toast({
        title: '保存成功',
        description: '设置已保存',
      });
    } catch (error) {
      toast({
        title: '保存失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingConversion(false);
    }
  };

  // 重置配置
  const handleResetConfig = () => {
    if (conversionConfig) {
      setEditingConfig(conversionConfig);
      setHasChanges(false);
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

  const formatDate = (dateString: string | number | undefined) => {
    if (!dateString) return '-';
    const timestamp = typeof dateString === 'number' ? dateString * 1000 : dateString;
    const date = new Date(timestamp);
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
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Settings2 className="w-6 h-6 text-indigo-600" />
          系统设置
        </h1>
        <p className="text-slate-500 mt-1">管理存储配置和系统参数</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">通用设置</TabsTrigger>
          <TabsTrigger value="transfer">传输设置</TabsTrigger>
          <TabsTrigger value="background">登录背景</TabsTrigger>
          <TabsTrigger value="system">系统信息</TabsTrigger>
        </TabsList>

        {/* 通用设置 */}
        <TabsContent value="general" className="space-y-6">
          {editingConfig ? (
            <>
              {/* 操作按钮 */}
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={handleResetConfig}
                  disabled={!hasChanges || isUpdatingConversion}
                >
                  重置
                </Button>
                <Button
                  onClick={handleSaveConfig}
                  disabled={!hasChanges || isUpdatingConversion}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {isUpdatingConversion ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      保存中...
                    </>
                  ) : (
                    '保存设置'
                  )}
                </Button>
              </div>

              {/* 上传设置卡片 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    上传设置
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* API Key 认证 */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">启用 API Token 认证</label>
                      <p className="text-xs text-slate-500">关闭后上传接口将不需要 Token 认证</p>
                    </div>
                    <Switch
                      checked={editingConfig.api_key_enabled}
                      onCheckedChange={(checked) => handleEditConfig('api_key_enabled', checked)}
                    />
                  </div>
                  <div className="border-t border-slate-200" />

                  {/* 默认可见性 */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">默认可见性</label>
                      <p className="text-xs text-slate-500">新上传图片的默认访问权限</p>
                    </div>
                    <select
                      value={editingConfig.default_visibility}
                      onChange={(e) => handleEditConfig('default_visibility', e.target.value as 'public' | 'private')}
                      className="h-9 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="public">公开</option>
                      <option value="private">私有</option>
                    </select>
                  </div>
                  <div className="border-t border-slate-200" />

                  {/* 并发上传限制 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">批量上传并发数</label>
                      <span className="text-sm text-slate-500">{editingConfig.concurrent_upload_limit}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={editingConfig.concurrent_upload_limit}
                      onChange={(e) => handleEditConfig('concurrent_upload_limit', parseInt(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500">范围：1-10，建议值：3-5</p>
                  </div>
                  <div className="border-t border-slate-200" />

                  {/* 文件大小限制 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">单文件大小限制 (MB)</label>
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={editingConfig.max_file_size_mb}
                      onChange={(e) => handleEditConfig('max_file_size_mb', parseInt(e.target.value))}
                      className="w-32"
                    />
                    <p className="text-xs text-slate-500">范围：1-500 MB</p>
                  </div>
                  <div className="border-t border-slate-200" />

                  {/* 默认相册 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">默认上传相册</label>
                    <select
                      value={editingConfig.default_album_id}
                      onChange={(e) => handleEditConfig('default_album_id', parseInt(e.target.value))}
                      className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      <option value={0}>不指定（使用上次选择的相册）</option>
                      {albums.map((album) => (
                        <option key={album.id} value={album.id}>
                          {album.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500">上传时默认选中的相册，0 表示不指定</p>
                  </div>
                </CardContent>
              </Card>

              {/* 图片处理设置卡片 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    图片处理
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* 缩略图开关 */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">生成缩略图</label>
                      <p className="text-xs text-slate-500">上传后自动生成缩略图</p>
                    </div>
                    <Switch
                      checked={editingConfig.thumbnail_enabled}
                      onCheckedChange={(checked) => handleEditConfig('thumbnail_enabled', checked)}
                    />
                  </div>
                  <div className="border-t border-slate-200" />

                  {/* 缩略图质量 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">缩略图质量</label>
                      <span className="text-sm text-slate-500">{editingConfig.thumbnail_quality}%</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={editingConfig.thumbnail_quality}
                      onChange={(e) => handleEditConfig('thumbnail_quality', parseInt(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500">范围：1-100，建议值：80-90</p>
                  </div>
                  <div className="border-t border-slate-200" />

                  {/* WebP 转换开关 */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">启用 WebP 转换</label>
                      <p className="text-xs text-slate-500">上传后自动转换为 WebP 格式</p>
                    </div>
                    <Switch
                      checked={editingConfig.conversion_enabled_formats.includes('webp')}
                      onCheckedChange={handleWebPToggle}
                    />
                  </div>
                  <div className="border-t border-slate-200" />

                  {/* WebP 质量 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">WebP 质量</label>
                      <span className="text-sm text-slate-500">{editingConfig.webp_quality}%</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={editingConfig.webp_quality}
                      onChange={(e) => handleEditConfig('webp_quality', parseInt(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500">范围：1-100，建议值：75-85</p>
                  </div>
                  <div className="border-t border-slate-200" />

                  {/* WebP Effort */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">WebP 编码 effort</label>
                      <span className="text-sm text-slate-500">{editingConfig.webp_effort}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={6}
                      value={editingConfig.webp_effort}
                      onChange={(e) => handleEditConfig('webp_effort', parseInt(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500">0=最快，6=最小文件</p>
                  </div>
                  <div className="border-t border-slate-200" />

                  {/* AVIF 实验性功能 */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium flex items-center gap-2">
                        启用 AVIF（实验性）
                        <Badge variant="outline" className="text-xs">Beta</Badge>
                      </label>
                      <p className="text-xs text-slate-500">上传后同时生成 AVIF 格式（需要更多 CPU）</p>
                    </div>
                    <Switch
                      checked={editingConfig.avif_experimental}
                      onCheckedChange={(checked) => handleEditConfig('avif_experimental', checked)}
                    />
                  </div>
                  <div className="border-t border-slate-200" />

                  {/* AVIF 质量 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">AVIF 质量</label>
                      <span className="text-sm text-slate-500">{editingConfig.avif_quality}%</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={editingConfig.avif_quality}
                      onChange={(e) => handleEditConfig('avif_quality', parseInt(e.target.value))}
                      disabled={!editingConfig.avif_experimental}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500">范围：1-100</p>
                  </div>
                  <div className="border-t border-slate-200" />

                  {/* AVIF 速度 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">AVIF 编码速度</label>
                      <span className="text-sm text-slate-500">{editingConfig.avif_speed}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      value={editingConfig.avif_speed}
                      onChange={(e) => handleEditConfig('avif_speed', parseInt(e.target.value))}
                      disabled={!editingConfig.avif_experimental}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500">0=最小文件，10=最快</p>
                  </div>
                  <div className="border-t border-slate-200" />

                  {/* 跳过小文件 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">跳过小于 (KB)</label>
                    <Input
                      type="number"
                      min={0}
                      value={editingConfig.skip_smaller_than}
                      onChange={(e) => handleEditConfig('skip_smaller_than', parseInt(e.target.value))}
                      className="w-32"
                    />
                    <p className="text-xs text-slate-500">小于此值的图片不转换格式，0=不限制</p>
                  </div>
                  <div className="border-t border-slate-200" />

                  {/* 最大处理尺寸 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">最大处理尺寸 (px)</label>
                    <Input
                      type="number"
                      min={0}
                      value={editingConfig.max_dimension}
                      onChange={(e) => handleEditConfig('max_dimension', parseInt(e.target.value))}
                      className="w-32"
                    />
                    <p className="text-xs text-slate-500">超过此尺寸的图片会被缩放，0=无限制</p>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-8 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                加载中...
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 传输设置 */}
        <TabsContent value="transfer" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                传输模式
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    id="mode-auto"
                    name="transfer-mode"
                    value="auto"
                    checked={transferMode === 'auto'}
                    onChange={(e) => handleUpdateTransferMode(e.target.value as TransferMode)}
                    disabled={isUpdatingTransferMode}
                    className="mt-1"
                  />
                  <div>
                    <label htmlFor="mode-auto" className="font-medium cursor-pointer">
                      自动模式
                    </label>
                    <p className="text-sm text-slate-500">
                      系统根据存储配置自动选择传输方式（推荐）
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    id="mode-proxy"
                    name="transfer-mode"
                    value="always_proxy"
                    checked={transferMode === 'always_proxy'}
                    onChange={(e) => handleUpdateTransferMode(e.target.value as TransferMode)}
                    disabled={isUpdatingTransferMode}
                    className="mt-1"
                  />
                  <div>
                    <label htmlFor="mode-proxy" className="font-medium cursor-pointer">
                      总是代理
                    </label>
                    <p className="text-sm text-slate-500">
                      所有图片都通过服务器代理访问（隐藏真实存储地址）
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    id="mode-direct"
                    name="transfer-mode"
                    value="always_direct"
                    checked={transferMode === 'always_direct'}
                    onChange={(e) => handleUpdateTransferMode(e.target.value as TransferMode)}
                    disabled={isUpdatingTransferMode}
                    className="mt-1"
                  />
                  <div>
                    <label htmlFor="mode-direct" className="font-medium cursor-pointer">
                      总是直连
                    </label>
                    <p className="text-sm text-slate-500">
                      直接访问存储服务的 URL（性能更好，但会暴露存储地址）
                    </p>
                  </div>
                </div>
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
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">选择相册</label>
                <p className="text-xs text-slate-500 mb-2">
                  登录页面背景将从这个相册中随机选取图片显示
                </p>
                <select
                  value={randomSourceAlbum === null ? '' : randomSourceAlbum}
                  onChange={(e) => {
                    const value = e.target.value;
                    handleUpdateRandomSourceAlbum(value === '' ? null : parseInt(value));
                  }}
                  disabled={isUpdatingRandomSource}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">所有公开图片</option>
                  {albums.map((album) => (
                    <option key={album.id} value={album.id}>
                      {album.name} ({album.image_count} 张图片)
                    </option>
                  ))}
                </select>
              </div>

              {isUpdatingRandomSource && (
                <div className="flex items-center text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  保存中...
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
                <Server className="h-5 w-5" />
                系统状态
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!systemStatus ? (
                <div className="text-center py-8 text-slate-500">暂无系统状态信息</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-sm text-slate-500">版本</p>
                      <p className="font-medium">{systemStatus.version || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">环境</p>
                      <p className="font-medium">{systemStatus.environment || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Go 版本</p>
                      <p className="font-medium">{systemStatus.go_version || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Commit</p>
                      <p className="font-medium text-sm font-mono">{systemStatus.commit_hash || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-4 mb-6">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      数据目录
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">路径</p>
                        <p className="font-medium text-xs font-mono break-all">{systemStatus.data_dir?.path || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">文件数</p>
                        <p className="font-medium">{systemStatus.data_dir?.file_count?.toLocaleString() || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">总大小</p>
                        <p className="font-medium">{systemStatus.data_dir?.size_str || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <HardDrive className="h-4 w-4" />
                      内存使用
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">堆内存</p>
                        <p className="font-medium">{systemStatus.memory?.heap_alloc_str || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">系统内存</p>
                        <p className="font-medium">{systemStatus.memory?.heap_sys_str || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">GC 系统</p>
                        <p className="font-medium">{systemStatus.memory?.gc_sys_str || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">栈内存</p>
                        <p className="font-medium">{systemStatus.memory?.stack_sys_str || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">累计分配</p>
                        <p className="font-medium">{systemStatus.memory?.total_alloc_str || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">GC 次数</p>
                        <p className="font-medium">{systemStatus.memory?.num_gc?.toLocaleString() || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Goroutines</p>
                        <p className="font-medium">{systemStatus.memory?.goroutines?.toLocaleString() || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">CPU 核心</p>
                        <p className="font-medium">{systemStatus.runtime?.num_cpu || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-4 mt-6">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      缓存配置
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">Provider</p>
                        <p className="font-medium">{systemStatus.cache?.provider || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Type</p>
                        <p className="font-medium">{systemStatus.cache?.type || 'N/A'}</p>
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
