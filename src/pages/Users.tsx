import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Trash2,
  KeyRound,
  Copy,
  Check,
  UserCog,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useAuthStore } from '@/store/auth';
import {
  listUsers,
  createUser,
  updateUserRole,
  updateUserStatus,
  resetUserPassword,
  deleteUser,
} from '@/api/admin';
import type { UserListItem, UserRole, UserStatus } from '@/types';

const PAGE_SIZE = 20;

export default function Users() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const currentUser = useAuthStore((state) => state.user);

  // 弹窗状态
  const [createOpen, setCreateOpen] = useState(false);
  const [passwordResultOpen, setPasswordResultOpen] = useState(false);
  const [passwordResult, setPasswordResult] = useState('');
  const [passwordResultTitle, setPasswordResultTitle] = useState('');
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<UserListItem | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listUsers(page, PAGE_SIZE);
      setUsers(data.users);
      setTotal(data.total);
    } catch (error) {
      toast({
        title: '加载失败',
        description: error instanceof Error ? error.message : '获取用户列表失败',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleRoleChange = async (user: UserListItem, role: UserRole) => {
    try {
      await updateUserRole(user.id, { role });
      toast({ title: '角色更新成功' });
      loadUsers();
    } catch (error) {
      toast({
        title: '更新失败',
        description: error instanceof Error ? error.message : '更新角色失败',
        variant: 'destructive',
      });
    }
  };

  const handleStatusChange = async (user: UserListItem, status: UserStatus) => {
    try {
      await updateUserStatus(user.id, { status });
      toast({ title: status === 'active' ? '用户已启用' : '用户已禁用' });
      loadUsers();
    } catch (error) {
      toast({
        title: '更新失败',
        description: error instanceof Error ? error.message : '更新状态失败',
        variant: 'destructive',
      });
    }
  };

  const openResetConfirm = (user: UserListItem) => {
    setTargetUser(user);
    setResetConfirmOpen(true);
  };

  const handleResetPassword = async () => {
    if (!targetUser) return;
    try {
      const res = await resetUserPassword(targetUser.id);
      setPasswordResult(res.password);
      setPasswordResultTitle(`已重置 ${targetUser.username} 的密码`);
      setPasswordResultOpen(true);
      toast({ title: '密码重置成功' });
    } catch (error) {
      toast({
        title: '重置失败',
        description: error instanceof Error ? error.message : '重置密码失败',
        variant: 'destructive',
      });
    } finally {
      setResetConfirmOpen(false);
      setTargetUser(null);
    }
  };

  const openDeleteConfirm = (user: UserListItem) => {
    setTargetUser(user);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!targetUser) return;
    try {
      await deleteUser(targetUser.id);
      toast({ title: '用户已删除' });
      loadUsers();
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除用户失败';
      const isConflict = message.includes('409') || message.includes('owns');
      toast({
        title: isConflict ? '无法删除' : '删除失败',
        description: isConflict
          ? '该用户仍拥有图片或相册，请先转移或删除内容。'
          : message,
        variant: 'destructive',
      });
    } finally {
      setDeleteConfirmOpen(false);
      setTargetUser(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-600" />
            用户管理
          </h1>
          <p className="text-slate-500 mt-1">管理系统用户、角色与状态</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={loadUsers}
            disabled={loading}
            className="gap-2"
          >
            <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
          >
            <Plus className="h-4 w-4" />
            创建用户
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-medium text-slate-600">ID</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">用户名</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">角色</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">状态</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">创建时间</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">更新时间</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-100 rounded animate-pulse w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    暂无用户数据
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const isSelf = user.id === currentUser?.id;
                  return (
                    <tr
                      key={user.id}
                      className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-500">{user.id}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        <div className="flex items-center gap-2">
                          {user.username}
                          {isSelf && (
                            <span className="text-[10px] px-1.5 py-0 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                              我
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isSelf ? (
                          <RoleBadge role={user.role} />
                        ) : (
                          <select
                            value={user.role}
                            onChange={(e) =>
                              handleRoleChange(user, e.target.value as UserRole)
                            }
                            className="text-sm border border-slate-200 rounded-md px-2 py-1 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                          >
                            <option value="admin">管理员</option>
                            <option value="user">普通用户</option>
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={user.status} />
                          {!isSelf && (
                            <Switch
                              checked={user.status === 'active'}
                              onCheckedChange={(checked) =>
                                handleStatusChange(user, checked ? 'active' : 'disabled')
                              }
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDate(user.updated_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openResetConfirm(user)}
                            className="h-8 px-2 text-slate-600 hover:text-indigo-600"
                            title="重置密码"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteConfirm(user)}
                            className="h-8 px-2 text-slate-600 hover:text-red-600"
                            title="删除用户"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50">
          <p className="text-sm text-slate-500">
            共 {total} 条记录，第 {page} / {totalPages} 页
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Create User Dialog */}
      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={(password) => {
          loadUsers();
          if (password) {
            setPasswordResult(password);
            setPasswordResultTitle('新用户已创建');
            setPasswordResultOpen(true);
          }
        }}
      />

      {/* Password Result Dialog */}
      <PasswordResultDialog
        open={passwordResultOpen}
        onOpenChange={setPasswordResultOpen}
        title={passwordResultTitle}
        password={passwordResult}
      />

      {/* Reset Password Confirm */}
      <ConfirmDialog
        open={resetConfirmOpen}
        onOpenChange={setResetConfirmOpen}
        title="重置密码"
        description={`确定要重置用户 "${targetUser?.username}" 的密码吗？重置后该用户的所有现有会话将被撤销。`}
        onConfirm={handleResetPassword}
        confirmText="重置"
      />

      {/* Delete User Confirm */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="删除用户"
        description={`确定要删除用户 "${targetUser?.username}" 吗？此操作不可撤销。如果该用户仍拥有图片或相册，删除将失败。`}
        onConfirm={handleDelete}
        confirmText="删除"
        variant="destructive"
      />
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  return role === 'admin' ? (
    <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white">管理员</Badge>
  ) : (
    <Badge variant="secondary">普通用户</Badge>
  );
}

function StatusBadge({ status }: { status: UserStatus }) {
  return status === 'active' ? (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      正常
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
      已禁用
    </span>
  );
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ==================== Create User Dialog ====================

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (generatedPassword?: string) => void;
}

function CreateUserDialog({ open, onOpenChange, onSuccess }: CreateUserDialogProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setRole('user');
  };

  const handleSubmit = async () => {
    if (!username.trim()) {
      toast({ title: '请输入用户名', variant: 'destructive' });
      return;
    }
    if (password && password.length < 6) {
      toast({ title: '密码至少需要6位字符', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createUser({
        username: username.trim(),
        password: password || undefined,
        role,
      });
      toast({ title: '用户创建成功', description: `用户名: ${res.username}` });
      onOpenChange(false);
      resetForm();
      onSuccess(res.password);
    } catch (error) {
      toast({
        title: '创建失败',
        description: error instanceof Error ? error.message : '创建用户失败',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            创建用户
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              用户名 <span className="text-red-500">*</span>
            </label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">密码</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="留空则自动生成"
            />
            <p className="text-xs text-slate-400">密码最少6位，留空将由系统自动生成。</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">角色</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="user">普通用户</option>
              <option value="admin">管理员</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => { onOpenChange(false); resetForm(); }}>
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  创建中...
                </>
              ) : (
                '创建'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Password Result Dialog ====================

interface PasswordResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  password: string;
}

function PasswordResultDialog({ open, onOpenChange, title, password }: PasswordResultDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: '复制失败', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-amber-600" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 space-y-3">
            <p className="text-sm text-amber-800 font-medium">
              以下密码仅显示一次，请妥善保存！
            </p>
            <div className="flex items-center gap-2">
              <Input
                value={password}
                readOnly
                className="font-mono text-base bg-white border-amber-200"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="shrink-0 border-amber-200 hover:bg-amber-100"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4 text-amber-700" />
                )}
              </Button>
            </div>
          </div>
          <p className="text-xs text-red-500">
            警告：所有现有会话已撤销，用户需要使用新密码重新登录。
          </p>
          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)}>我知道了</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
