import { useState, useEffect, useCallback } from 'react';
import { Key, Plus, Trash2, Copy, Check } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { fetchTokens, createToken, deleteToken } from '@/api/tokens';
import type { Token } from '@/types';
import { toast } from '@/components/ui/use-toast';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function Tokens() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateTokenOpen, setIsCreateTokenOpen] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [createdToken, setCreatedToken] = useState<{ token: string; hash: string } | null>(null);
  const [copied, setCopied] = useState(false);

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

  const loadTokens = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTokens();
      setTokens(Array.isArray(data) ? data : []);
    } catch (error) {
      toast({
        title: '加载失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
      setTokens([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

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
      loadTokens();
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
          loadTokens();
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
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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

  const handleCloseDialog = () => {
    setCreatedToken(null);
    setIsCreateTokenOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Key className="w-6 h-6 text-indigo-600" />
            API Token
          </h1>
          <p className="text-slate-500 mt-1">管理用于第三方应用访问的 API Token</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Token 列表
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
                          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <Button
                      onClick={handleCloseDialog}
                      className="w-full bg-indigo-600 hover:bg-indigo-700"
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
