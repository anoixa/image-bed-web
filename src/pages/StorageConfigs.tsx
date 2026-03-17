import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Loader2, Server, HardDrive, Database, Pencil, Star, TestTube, Cloud } from 'lucide-react';
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
import {
  fetchStorageConfigs,
  createStorageConfig,
  updateStorageConfig,
  deleteStorageConfig,
  setDefaultStorageConfig,
  testStorageConfig,
} from '@/api/configs';
import type { StorageConfig } from '@/types';
import { toast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useStorageConfigsStore } from '@/store/storageConfigs';

type StorageType = 'local' | 's3' | 'webdav';

interface StorageFormData {
  name: string;
  config: Record<string, string>;
  is_default: boolean;
}

const STORAGE_TYPES: { type: StorageType; label: string; icon: typeof Server }[] = [
  { type: 'local', label: '本地存储', icon: HardDrive },
  { type: 's3', label: 'S3 存储', icon: Cloud },
  { type: 'webdav', label: 'WebDAV', icon: Server },
];

interface ConfigField {
  key: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  description?: string;
}

const STORAGE_TYPE_CONFIGS: Record<StorageType, { fields: ConfigField[] }> = {
  local: {
    fields: [
      { key: 'local_path', label: '本地路径', placeholder: './data/uploads', required: true, description: '服务器上存储图片的本地路径' },
    ],
  },
  s3: {
    fields: [
      { key: 'endpoint', label: 'Endpoint', placeholder: 'https://s3.amazonaws.com 或 http://localhost:9000', required: true, description: 'S3 服务端点，AWS S3 使用 https://s3.amazonaws.com，MinIO 使用 http://ip:9000' },
      { key: 'region', label: 'Region', placeholder: 'us-east-1', description: 'S3 区域，如 us-east-1、ap-northeast-1、auto (R2)' },
      { key: 'bucket_name', label: 'Bucket 名称', placeholder: 'my-bucket', required: true, description: '存储桶名称' },
      { key: 'access_key_id', label: 'Access Key ID', required: true, description: '访问密钥 ID' },
      { key: 'secret_access_key', label: 'Secret Access Key', type: 'password', required: true, description: '访问密钥密码' },
      { key: 'force_path_style', label: 'Path Style 访问', type: 'switch', description: 'MinIO/自建 S3 需开启，AWS S3 需关闭' },
      { key: 'public_domain', label: '自定义域名', placeholder: 'https://cdn.example.com', description: 'CDN 或反向代理域名，为空则使用 Endpoint' },
      { key: 'is_private', label: '私有 Bucket', type: 'switch', description: '开启后图片访问需经过服务器代理（防盗链）' },
    ],
  },
  webdav: {
    fields: [
      { key: 'webdav_url', label: 'WebDAV URL', placeholder: 'https://nas.example.com/webdav', required: true },
      { key: 'webdav_username', label: '用户名', required: true },
      { key: 'webdav_password', label: '密码', type: 'password', required: true },
      { key: 'webdav_root_path', label: '根路径', placeholder: '/images', description: 'WebDAV 服务器上的根路径' },
    ],
  },
};

export default function StorageConfigs() {
  const [storageConfigs, setStorageConfigs] = useState<StorageConfig[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 全局存储配置 store，用于同步右上角下拉菜单
  const { refreshStorageConfigs } = useStorageConfigsStore();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<StorageType>('local');
  
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

  const [formData, setFormData] = useState<StorageFormData>({
    name: '',
    config: {},
    is_default: false,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const configs = await fetchStorageConfigs();
      const configArray = Array.isArray(configs) ? configs : [];
      const filteredConfigs = configArray.filter(config => config.category === 'storage');
      setStorageConfigs(filteredConfigs);
    } catch (error) {
      toast({
        title: '加载失败',
        description: error instanceof Error ? error.message : '获取存储配置失败',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async () => {
    try {
      await createStorageConfig({
        name: formData.name,
        category: 'storage',
        config: { type: selectedType, ...formData.config },
        is_default: formData.is_default,
      });
      toast({ title: '创建成功', description: '存储配置已创建' });
      setIsCreateOpen(false);
      resetForm();
      loadData();
      // 同步刷新全局 store，更新右上角下拉菜单
      await refreshStorageConfigs();
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
        config: formData.config,
        is_default: formData.is_default,
      });
      toast({ title: '更新成功', description: '存储配置已更新' });
      setIsEditOpen(false);
      setEditingId(null);
      resetForm();
      loadData();
      // 同步刷新全局 store，更新右上角下拉菜单
      await refreshStorageConfigs();
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
      description: '确定要删除这个存储配置吗？此操作不可恢复。',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await deleteStorageConfig(id);
          toast({ title: '删除成功', description: '存储配置已删除' });
          loadData();
          // 同步刷新全局 store，更新右上角下拉菜单
          await refreshStorageConfigs();
        } catch (error) {
          toast({
            title: '删除失败',
            description: error instanceof Error ? error.message : '请稍后重试',
            variant: 'destructive',
          });
        }
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
    });
  };

  const handleSetDefault = async (id: number) => {
    try {
      await setDefaultStorageConfig(id);
      toast({ title: '设置成功', description: '已设为默认存储' });
      loadData();
      // 同步刷新全局 store，更新右上角下拉菜单
      await refreshStorageConfigs();
    } catch (error) {
      toast({
        title: '设置失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  const handleTest = async (id: number) => {
    setTestingId(id);
    try {
      await testStorageConfig(id);
      toast({ title: '连接测试成功', description: '存储配置可正常访问' });
    } catch (error) {
      toast({
        title: '连接测试失败',
        description: error instanceof Error ? error.message : '无法连接到存储服务',
        variant: 'destructive',
      });
    } finally {
      setTestingId(null);
    }
  };

  const openEditDialog = (config: StorageConfig) => {
    setEditingId(config.id);
    setFormData({
      name: config.name,
      config: { ...config.config } as Record<string, string>,
      is_default: config.is_default,
    });
    setIsEditOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      config: {},
      is_default: false,
    });
    setSelectedType('local');
  };

  const renderConfigFields = (type: StorageType, isEditing: boolean) => {
    const config = STORAGE_TYPE_CONFIGS[type];
    return config.fields.map((field) => (
      <div key={field.key} className="space-y-2">
        <Label htmlFor={field.key}>
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        {field.description && (
          <p className="text-xs text-slate-500">{field.description}</p>
        )}
        {field.type === 'switch' ? (
          <Switch
            id={field.key}
            checked={formData.config[field.key] === 'true'}
            onCheckedChange={(checked: boolean) =>
              setFormData(prev => ({
                ...prev,
                config: { ...prev.config, [field.key]: String(checked) },
              }))
            }
          />
        ) : (
          <Input
            id={field.key}
            type={field.type || 'text'}
            placeholder={field.placeholder}
            value={formData.config[field.key] || ''}
            onChange={(e) =>
              setFormData(prev => ({
                ...prev,
                config: { ...prev.config, [field.key]: e.target.value },
              }))
            }
          />
        )}
      </div>
    ));
  };

  const StorageForm = ({ isEditing }: { isEditing: boolean }) => (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="name">
          配置名称
          <span className="text-red-500 ml-1">*</span>
        </Label>
        <Input
          id="name"
          placeholder="例如：本地存储、MinIO主存储"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
        />
      </div>

      {!isEditing && (
        <div className="space-y-2">
          <Label>存储类型</Label>
          <div className="grid grid-cols-3 gap-3">
            {STORAGE_TYPES.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedType(type)}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  selectedType === type
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <Label>配置参数</Label>
        {renderConfigFields(isEditing ? (formData.config.type as StorageType) || 'local' : selectedType, isEditing)}
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Switch
          id="is_default"
          checked={formData.is_default}
          onCheckedChange={(checked: boolean) =>
            setFormData(prev => ({ ...prev, is_default: checked }))
          }
        />
        <Label htmlFor="is_default">设为默认存储</Label>
      </div>
    </div>
  );

  const getConfigType = (config: Record<string, unknown>): StorageType => {
    return (config.type as StorageType) || 'local';
  };

  const getConfigValue = (config: Record<string, unknown>, key: string): string => {
    const value = config[key];
    return typeof value === 'string' ? value : '';
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Database className="w-6 h-6 text-indigo-600" />
            存储配置
          </h1>
          <p className="text-slate-500 mt-1">管理图片存储后端（本地、S3、WebDAV）</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              添加存储
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>添加存储配置</DialogTitle>
            </DialogHeader>
            <StorageForm isEditing={false} />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                取消
              </Button>
              <Button onClick={handleCreate}>创建</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Storage Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {storageConfigs.map((config) => {
          const configType = getConfigType(config.config);
          const typeInfo = STORAGE_TYPES.find(t => t.type === configType);
          const Icon = typeInfo?.icon || Database;
          
          return (
            <Card key={config.id} className={config.is_default ? 'ring-2 ring-indigo-500' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      config.is_default ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{config.name}</CardTitle>
                      <p className="text-xs text-slate-500">{typeInfo?.label}</p>
                    </div>
                  </div>
                  {config.is_default && (
                    <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">
                      <Star className="w-3 h-3 mr-1" />
                      默认
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0 flex flex-col">
                <div className="text-sm text-slate-600 space-y-1 flex-1 min-h-[44px]">
                  {getConfigValue(config.config, 'base_url') && (
                    <p className="truncate" title={getConfigValue(config.config, 'base_url')}>
                      URL: {getConfigValue(config.config, 'base_url')}
                    </p>
                  )}
                  {getConfigValue(config.config, 'endpoint') && (
                    <p className="truncate" title={getConfigValue(config.config, 'endpoint')}>
                      Endpoint: {getConfigValue(config.config, 'endpoint')}
                    </p>
                  )}
                  {getConfigValue(config.config, 'bucket_name') && (
                    <p>Bucket: {getConfigValue(config.config, 'bucket_name')}</p>
                  )}
                  {getConfigValue(config.config, 'public_domain') && (
                    <p className="truncate" title={getConfigValue(config.config, 'public_domain')}>
                      Domain: {getConfigValue(config.config, 'public_domain')}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center gap-2 mt-4 h-9">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-9"
                    onClick={() => openEditDialog(config)}
                  >
                    <Pencil className="w-4 h-4 mr-1" />
                    编辑
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-9"
                    onClick={() => handleTest(config.id)}
                    disabled={testingId === config.id}
                  >
                    {testingId === config.id ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <TestTube className="w-4 h-4 mr-1" />
                    )}
                    测试
                  </Button>
                  {config.is_default ? (
                    <div className="w-9 h-9" />
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0"
                      onClick={() => handleSetDefault(config.id)}
                    >
                      <Star className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 h-9 w-9 p-0"
                    onClick={() => handleDelete(config.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {storageConfigs.length === 0 && (
        <div className="text-center py-16">
          <Database className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-800 mb-2">暂无存储配置</h3>
          <p className="text-slate-500 mb-4">点击上方按钮添加第一个存储配置</p>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑存储配置</DialogTitle>
          </DialogHeader>
          <StorageForm isEditing={true} />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              取消
            </Button>
            <Button onClick={handleUpdate}>保存</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        confirmText="确认"
        cancelText="取消"
        variant={confirmDialog.variant}
      />
    </div>
  );
}
