import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Loader2, Info, Database, Server, HardDrive, Check, Settings2, ImageIcon, Link2, Globe, Folder, RefreshCw, Cpu, AlertTriangle, Zap, Activity, Shield } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { fetchSystemStatus, fetchConversionConfig, updateConversionConfig } from '@/api/system';
import { fetchAuthSettings, updateAuthSettings } from '@/api/auth';
import type { AuthSettings } from '@/api/auth';
import { fetchAlbums } from '@/api/albums';
import {
  fetchStorageConfigs,
  createStorageConfig,
  updateStorageConfig,
  deleteStorageConfig,
  setDefaultStorageConfig,
  testStorageConfig,
  fetchTransferMode,
  updateTransferMode,
  enableStorageConfig,
  disableStorageConfig,
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
import OAuthConfigManager from '@/components/OAuthConfigManager';
import { useAuthStore } from '@/store/auth';

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
    if (!editingConfig || !conversionConfig?.avif_supported) return;
    const formats = enabled
      ? [...editingConfig.conversion_enabled_formats, 'avif']
      : editingConfig.conversion_enabled_formats.filter(f => f !== 'avif');
    handleEditConfig('conversion_enabled_formats', formats);
  };

  // 验证配置值是否有效
  // 注意：0 表示不更新该字段，是合法值
  const validateConfig = (config: ConversionConfig): string | null => {
    // 检查必须在 1–500 范围内的字段（0 表示不更新）
    if (config.max_file_size_mb !== 0 && (config.max_file_size_mb < 1 || config.max_file_size_mb > 500)) {
      return '单文件大小限制必须在 1–500 MB 之间（或设为 0 表示不更新）';
    }
    if (config.max_batch_total_mb !== 0 && (config.max_batch_total_mb < 1 || config.max_batch_total_mb > 500)) {
      return '批量上传总大小限制必须在 1–500 MB 之间（或设为 0 表示不更新）';
    }

    // 检查必须在 1–10 范围内的字段（0 表示不更新）
    if (config.concurrent_upload_limit !== 0 && (config.concurrent_upload_limit < 1 || config.concurrent_upload_limit > 10)) {
      return '批量上传并发数必须在 1–10 之间（或设为 0 表示不更新）';
    }

    // 检查必须在 1–100 范围内的字段（0 表示不更新）
    if (config.thumbnail_quality !== 0 && (config.thumbnail_quality < 1 || config.thumbnail_quality > 100)) {
      return '缩略图质量必须在 1–100 之间（或设为 0 表示不更新）';
    }
    if (config.webp_quality !== 0 && (config.webp_quality < 1 || config.webp_quality > 100)) {
      return 'WebP 质量必须在 1–100 之间（或设为 0 表示不更新）';
    }
    if (config.avif_quality !== 0 && (config.avif_quality < 1 || config.avif_quality > 100)) {
      return 'AVIF 质量必须在 1–100 之间（或设为 0 表示不更新）';
    }

    // 检查其他范围（这些字段 0 是有效值，不是"不更新"）
    if (config.webp_effort < 0 || config.webp_effort > 6) {
      return 'WebP 压缩努力度必须在 0–6 之间';
    }
    if (config.avif_speed < 0 || config.avif_speed > 8) {
      return 'AVIF 编码速度必须在 0–8 之间';
    }
    if (config.skip_smaller_than < 0) {
      return '跳过小文件转换不能为负数';
    }
    if (config.max_dimension < 0) {
      return '最大图片尺寸不能为负数';
    }

    return null;
  };

  // 保存配置到服务器
  const handleSaveConfig = async () => {
    if (!editingConfig) return;

    // 前端校验
    const error = validateConfig(editingConfig);
    if (error) {
      toast({
        title: '保存失败',
        description: error,
        variant: 'destructive',
      });
      return;
    }

    // 如果 AVIF 不被支持，从转换格式列表中移除
    let configToSave = { ...editingConfig };
    if (!conversionConfig?.avif_supported) {
      configToSave.conversion_enabled_formats =
        configToSave.conversion_enabled_formats.filter(f => f !== 'avif');
    }

    // 移除只读字段 avif_supported
    const { avif_supported: _, ...saveData } = configToSave;

    setIsUpdatingConversion(true);
    try {
      await updateConversionConfig(saveData);
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

  // 重置为服务器配置
  const handleResetConfig = () => {
    if (conversionConfig) {
      setEditingConfig(conversionConfig);
      setHasChanges(false);
    }
  };

  // 恢复系统默认配置
  const handleRestoreDefaults = () => {
    const defaultConfig: ConversionConfig = {
      thumbnail_enabled: true,
      thumbnail_sizes: [{ name: 'default', width: 600, height: 0 }],
      thumbnail_quality: 85,
      conversion_enabled_formats: ['webp'],
      webp_quality: 75,
      webp_effort: 4,
      avif_quality: 80,
      avif_speed: 4,
      avif_experimental: false,
      skip_smaller_than: 10,
      max_dimension: 4096,
      default_album_id: 0,
      default_visibility: 'public',
      concurrent_upload_limit: 3,
      max_file_size_mb: 50,
      max_batch_total_mb: 500,
      api_key_enabled: true,
      avif_supported: conversionConfig?.avif_supported ?? false,
    };
    setEditingConfig(defaultConfig);
    setHasChanges(true);
    toast({
      title: '已恢复默认',
      description: '配置已恢复为系统默认值，点击保存以应用',
    });
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general">通用设置</TabsTrigger>
          <TabsTrigger value="transfer">传输设置</TabsTrigger>
          <TabsTrigger value="background">登录背景</TabsTrigger>
          <TabsTrigger value="auth">登录设置</TabsTrigger>
          <TabsTrigger value="system">系统信息</TabsTrigger>
        </TabsList>

        {/* 通用设置 */}
        <TabsContent value="general" className="space-y-6">
          {editingConfig ? (
            <>
              {/* 操作按钮 */}
              <div className="flex justify-between items-center">
                <Button
                  variant="ghost"
                  onClick={handleRestoreDefaults}
                  disabled={isUpdatingConversion}
                  className="text-slate-500 hover:text-slate-700"
                >
                  恢复默认
                </Button>
                <div className="flex gap-3">
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
                      <p className="text-xs text-slate-500">控制是否允许通过 API Token 进行上传认证。关闭后，API Token 将无法用于任何上传操作，仅支持账号登录（JWT）方式访问上传接口。</p>
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
                      <p className="text-xs text-slate-500">上传图片的默认访问权限。"public" 所有人可访问，"private" 仅本人可见。</p>
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
                      min={0}
                      max={10}
                      value={editingConfig.concurrent_upload_limit}
                      onChange={(e) => handleEditConfig('concurrent_upload_limit', parseInt(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500">批量上传时同时处理的文件数量上限，避免服务器过载。设为 0 表示不更新。范围：1–10。</p>
                  </div>
                  <div className="border-t border-slate-200" />

                  {/* 文件大小限制 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">单文件大小限制（MB）</label>
                    <Input
                      type="number"
                      min={0}
                      max={500}
                      value={editingConfig.max_file_size_mb}
                      onChange={(e) => handleEditConfig('max_file_size_mb', parseInt(e.target.value))}
                      className="w-32"
                    />
                    <p className="text-xs text-slate-500">单张图片的最大允许上传大小。超出后服务端会拒绝处理。设为 0 表示不更新。范围：1–500。</p>
                  </div>
                  <div className="border-t border-slate-200" />

                  {/* 批量总大小限制 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">批量上传总大小限制（MB）</label>
                    <Input
                      type="number"
                      min={0}
                      max={500}
                      value={editingConfig.max_batch_total_mb}
                      onChange={(e) => handleEditConfig('max_batch_total_mb', parseInt(e.target.value))}
                      className="w-32"
                    />
                    <p className="text-xs text-slate-500">单次批量上传所有文件的总大小上限。设为 0 表示不更新。范围：1–500。</p>
                  </div>
                  <div className="border-t border-slate-200" />

                  {/* 默认相册 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">默认相册</label>
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
                    <p className="text-xs text-slate-500">上传图片时自动归入的相册 ID。设为 0 表示不自动归类。</p>
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
                      <label className="text-sm font-medium">启用缩略图</label>
                      <p className="text-xs text-slate-500">上传图片后自动生成缩略图。启用后可加快图片列表加载速度，关闭则仅保存原图。</p>
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
                      min={0}
                      max={100}
                      value={editingConfig.thumbnail_quality}
                      onChange={(e) => handleEditConfig('thumbnail_quality', parseInt(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500">缩略图的 WebP 压缩质量，数值越高画质越好，文件也越大。设为 0 视为不更新。范围：1–100。</p>
                  </div>
                  <div className="border-t border-slate-200" />

                  {/* WebP 转换开关 */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">启用的转换格式</label>
                      <p className="text-xs text-slate-500">上传后自动转换的目标格式列表。目前支持 "webp"，AVIF 为实验性功能。空数组表示不做任何格式转换。</p>
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
                      min={0}
                      max={100}
                      value={editingConfig.webp_quality}
                      onChange={(e) => handleEditConfig('webp_quality', parseInt(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500">WebP 转换的压缩质量，数值越高越清晰。系统会根据图片复杂度自动微调（±5~10）。设为 0 视为不更新。范围：1–100。</p>
                  </div>
                  <div className="border-t border-slate-200" />

                  {/* WebP Effort */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">WebP 压缩努力度</label>
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
                    <p className="text-xs text-slate-500">WebP 编码的压缩努力程度，越高压缩率越好但越慢。范围：0（最快）–6（最小体积）。</p>
                  </div>
                  <div className="border-t border-slate-200" />

                  {/* AVIF 格式开关 */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className={`text-sm font-medium flex items-center gap-2 ${!conversionConfig?.avif_supported ? 'text-slate-400' : ''}`}>
                        启用 AVIF 格式
                        <Badge variant="outline" className="text-xs">Beta</Badge>
                        {!conversionConfig?.avif_supported && (
                          <Badge variant="secondary" className="text-xs">当前服务器不支持</Badge>
                        )}
                      </label>
                      <p className="text-xs text-slate-500">
                        {conversionConfig?.avif_supported
                          ? '开启 AVIF 格式支持。启用后上传的图片会自动生成 AVIF 格式变体。该功能尚处于实验阶段，可能存在兼容性问题。'
                          : '当前服务器运行时环境不支持 AVIF 格式转换。如需启用，请确保服务器已安装支持 AVIF 的 libvips 版本。'
                        }
                      </p>
                    </div>
                    <Switch
                      checked={editingConfig.conversion_enabled_formats.includes('avif')}
                      onCheckedChange={handleAVIFToggle}
                      disabled={!conversionConfig?.avif_supported}
                    />
                  </div>
                  <div className="border-t border-slate-200" />

                  {/* AVIF 质量 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className={`text-sm font-medium ${!conversionConfig?.avif_supported ? 'text-slate-400' : ''}`}>AVIF 质量</label>
                      <span className="text-sm text-slate-500">{editingConfig.avif_quality}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={editingConfig.avif_quality}
                      onChange={(e) => handleEditConfig('avif_quality', parseInt(e.target.value))}
                      disabled={!editingConfig.conversion_enabled_formats.includes('avif') || !conversionConfig?.avif_supported}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500">AVIF 格式的压缩质量。仅在启用的转换格式包含 "avif" 时生效。设为 0 视为不更新。范围：1–100。</p>
                  </div>
                  <div className="border-t border-slate-200" />

                  {/* AVIF 速度 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className={`text-sm font-medium ${!conversionConfig?.avif_supported ? 'text-slate-400' : ''}`}>AVIF 编码速度</label>
                      <span className="text-sm text-slate-500">{editingConfig.avif_speed}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={8}
                      value={editingConfig.avif_speed}
                      onChange={(e) => handleEditConfig('avif_speed', parseInt(e.target.value))}
                      disabled={!editingConfig.conversion_enabled_formats.includes('avif') || !conversionConfig?.avif_supported}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500">AVIF 编码速度，越低压缩率越高但耗时更长。范围：0（最慢最小）–8（最快最大）。</p>
                  </div>
                  <div className="border-t border-slate-200" />

                  {/* 跳过小文件 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">跳过小文件转换（KB）</label>
                    <Input
                      type="number"
                      min={0}
                      value={editingConfig.skip_smaller_than}
                      onChange={(e) => handleEditConfig('skip_smaller_than', parseInt(e.target.value))}
                      className="w-32"
                    />
                    <p className="text-xs text-slate-500">文件小于此大小（单位 KB）时跳过格式转换，避免转换后体积反而变大。设为 0 则不跳过。</p>
                  </div>
                  <div className="border-t border-slate-200" />

                  {/* 最大处理尺寸 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">最大图片尺寸（px）</label>
                    <Input
                      type="number"
                      min={0}
                      value={editingConfig.max_dimension}
                      onChange={(e) => handleEditConfig('max_dimension', parseInt(e.target.value))}
                      className="w-32"
                    />
                    <p className="text-xs text-slate-500">图片宽或高超过此像素时拒绝处理，防止超大图片占用过多内存。设为 0 表示不限制。</p>
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

        {/* 登录设置 */}
        <TabsContent value="auth" className="space-y-6">
          <OAuthConfigManager />
          <AuthSettingsManager />
        </TabsContent>

        {/* 系统信息 */}
        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                系统状态
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </Button>
            </CardHeader>
            <CardContent>
              {!systemStatus ? (
                <div className="text-center py-8 text-slate-500">暂无系统状态信息</div>
              ) : (
                <>
                  {/* 基础信息 */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-sm text-slate-500">版本</p>
                      <p className="font-medium">{systemStatus.version || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">环境</p>
                      <Badge
                        variant={systemStatus.environment === 'production' ? 'default' : 'secondary'}
                        className={
                          systemStatus.environment === 'production'
                            ? 'bg-green-100 text-green-700 hover:bg-green-100'
                            : 'bg-amber-100 text-amber-700 hover:bg-amber-100'
                        }
                      >
                        {systemStatus.environment || 'N/A'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Go 版本</p>
                      <p className="font-medium">{systemStatus.go_version || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Commit</p>
                      <p className="font-medium text-sm font-mono">
                        {systemStatus.commit_hash ? systemStatus.commit_hash.slice(0, 8) : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Worker */}
                  <div className="border-t border-slate-200 pt-4 mb-6">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Cpu className="h-4 w-4" />
                      Worker
                      {systemStatus.worker?.failed > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {systemStatus.worker.failed} 失败
                        </Badge>
                      )}
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">队列</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress
                            value={
                              systemStatus.worker?.queue_cap > 0
                                ? (systemStatus.worker.queue_size / systemStatus.worker.queue_cap) * 100
                                : 0
                            }
                            className="h-2 flex-1"
                          />
                          <span className="text-xs text-slate-600 whitespace-nowrap">
                            {systemStatus.worker?.queue_size?.toLocaleString() || 0} / {systemStatus.worker?.queue_cap?.toLocaleString() || 0}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-slate-500">Worker 数量</p>
                        <p className="font-medium">{systemStatus.worker?.worker_count?.toLocaleString() ?? 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">进行中任务</p>
                        <p className="font-medium">{systemStatus.worker?.in_flight_tasks?.toLocaleString() ?? 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">进行中变体</p>
                        <p className="font-medium">{systemStatus.worker?.in_flight_variants?.toLocaleString() ?? 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">已提交</p>
                        <p className="font-medium">{systemStatus.worker?.submitted?.toLocaleString() ?? 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">已执行</p>
                        <p className="font-medium">{systemStatus.worker?.executed?.toLocaleString() ?? 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Sweeper */}
                  <div className="border-t border-slate-200 pt-4 mb-6">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Sweeper
                      {systemStatus.sweeper?.errors > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {systemStatus.sweeper.errors} 错误
                        </Badge>
                      )}
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">运行次数</p>
                        <p className="font-medium">{systemStatus.sweeper?.runs?.toLocaleString() ?? 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">最近成功</p>
                        <p className="font-medium">
                          {systemStatus.sweeper?.last_success_unix
                            ? new Date(systemStatus.sweeper.last_success_unix * 1000).toLocaleString()
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">重置 Variants</p>
                        <p className="font-medium">{systemStatus.sweeper?.reset_variants?.toLocaleString() ?? 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">失败 Variants</p>
                        <p className="font-medium">{systemStatus.sweeper?.failed_variants?.toLocaleString() ?? 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">失败 Images</p>
                        <p className="font-medium">{systemStatus.sweeper?.failed_images?.toLocaleString() ?? 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">重新触发</p>
                        <p className="font-medium">{systemStatus.sweeper?.retriggered?.toLocaleString() ?? 'N/A'}</p>
                      </div>
                    </div>
                    {systemStatus.sweeper?.last_error_message && (
                      <div className="mt-3 p-2 bg-red-50 rounded border border-red-100">
                        <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          最近错误
                        </p>
                        <p className="text-xs text-red-700 mt-1 font-mono break-all">
                          {systemStatus.sweeper.last_error_message}
                        </p>
                        {systemStatus.sweeper.last_error_unix > 0 && (
                          <p className="text-xs text-red-500 mt-1">
                            {new Date(systemStatus.sweeper.last_error_unix * 1000).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 内存使用 */}
                  <div className="border-t border-slate-200 pt-4 mb-6">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      内存使用
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">RSS 内存</p>
                        <p className="font-medium">{systemStatus.memory?.rss_str || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">堆内存</p>
                        <p className="font-medium">{systemStatus.memory?.heap_alloc_str || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Goroutines</p>
                        <p className="font-medium">{systemStatus.memory?.goroutines?.toLocaleString() ?? 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">上次 GC</p>
                        <p className="font-medium">
                          {systemStatus.memory?.last_gc_time
                            ? new Date(systemStatus.memory.last_gc_time * 1000).toLocaleString()
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Vips 内存 */}
                  <div className="border-t border-slate-200 pt-4 mb-6">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" />
                      Vips 内存
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">当前内存</p>
                        <p className="font-medium">{systemStatus.memory?.vips_mem_str || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">内存峰值</p>
                        <p className="font-medium">{systemStatus.memory?.vips_mem_high_str || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">分配次数</p>
                        <p className="font-medium">{systemStatus.memory?.vips_allocs?.toLocaleString() ?? 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">打开文件</p>
                        <p className="font-medium">{systemStatus.memory?.vips_open_files?.toLocaleString() ?? 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* 数据目录 */}
                  <div className="border-t border-slate-200 pt-4 mb-6">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <HardDrive className="h-4 w-4" />
                      数据目录
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">路径</p>
                        <p className="font-medium text-xs font-mono break-all">{systemStatus.data_dir?.path || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">文件数</p>
                        <p className="font-medium">{systemStatus.data_dir?.file_count?.toLocaleString() ?? 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">总大小</p>
                        <p className="font-medium">{systemStatus.data_dir?.size_str || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* 缓存配置 */}
                  <div className="border-t border-slate-200 pt-4">
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

// 登录设置管理（密码登录开关等）
function AuthSettingsManager() {
  const [settings, setSettings] = useState<AuthSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDisablePassword, setConfirmDisablePassword] = useState(false);
  const user = useAuthStore((state) => state.user);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAuthSettings();
      setSettings(data);
    } catch (error) {
      toast({
        title: '加载登录设置失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleTogglePasswordLogin = async (enabled: boolean) => {
    if (!settings) return;
    // 关闭密码登录前确认
    if (!enabled) {
      setConfirmDisablePassword(true);
      return;
    }
    await savePasswordLogin(true);
  };

  const savePasswordLogin = async (enabled: boolean) => {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await updateAuthSettings({ password_login_enabled: enabled });
      setSettings(updated);
      toast({
        title: enabled ? '密码登录已开启' : '密码登录已关闭',
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : '请稍后重试';
      toast({
        title: '保存失败',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5" />
            登录方式设置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 密码登录开关 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">启用密码登录</label>
              <p className="text-xs text-slate-500">
                关闭后，用户只能通过 OAuth 方式登录。请确保至少有一个 OAuth Provider 已启用，且您本人已绑定 OAuth 账号。
              </p>
            </div>
            <Switch
              checked={settings?.password_login_enabled ?? true}
              onCheckedChange={handleTogglePasswordLogin}
              disabled={saving}
            />
          </div>

          <div className="border-t border-slate-200" />

          {/* 当前 OAuth Provider 状态 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">OAuth Provider 状态</label>
            <div className="space-y-2">
              {settings?.providers && settings.providers.length > 0 ? (
                settings.providers.map((p) => (
                  <div
                    key={p.provider}
                    className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-100"
                  >
                    <span className="text-sm">{p.display_name || p.provider}</span>
                    <Badge variant={p.enabled ? 'default' : 'secondary'}>
                      {p.enabled ? '启用' : '禁用'}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-500">
                  尚未配置 OAuth Provider，请到上方「OAuth Provider 配置」中添加。
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200" />

          {/* Callback URL 预览 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">回调地址预览</label>
            <p className="text-xs text-slate-500">
              在第三方 OAuth 应用控制台中填写的 Callback URL。
            </p>
            <div className="space-y-2">
              {settings?.callback_urls ? (
                Object.entries(settings.callback_urls).map(([provider, url]) => (
                  <div
                    key={provider}
                    className="p-2 bg-slate-50 rounded border border-slate-100"
                  >
                    <div className="text-xs font-medium text-slate-600 mb-1">
                      {provider.toUpperCase()}
                    </div>
                    <code className="text-xs text-slate-700 break-all font-mono">
                      {url}
                    </code>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-500">暂无回调地址信息</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 关闭密码登录确认弹窗 */}
      <ConfirmDialog
        open={confirmDisablePassword}
        onOpenChange={setConfirmDisablePassword}
        title="关闭密码登录？"
        description="关闭后所有用户（包括您）将无法使用密码登录。请确保至少有一个 OAuth Provider 已启用，且您本人已绑定 OAuth 账号，否则可能导致无法登录。"
        variant="destructive"
        onConfirm={() => {
          setConfirmDisablePassword(false);
          savePasswordLogin(false);
        }}
      />
    </>
  );
}
