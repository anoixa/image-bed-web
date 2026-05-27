import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  ImageIcon,
  Folder,
  Settings,
  Menu,
  Search,
  Upload,
  LogOut,
  User,
  BarChart3,
  X,
  Key,
  Lock,
  Eye,
  EyeOff,
  Database,
  ChevronDown,
  Check,
  HardDrive,
  BookOpen,
  Cloud,
  ChevronLeft,
  ChevronRight,
  Shield,
  UserCog,
} from 'lucide-react';
import { changePassword } from '@/api/auth';
import { setDefaultStorageConfig } from '@/api/configs';
import { useStorageConfigsStore } from '@/store/storageConfigs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/auth';
import { toast } from '@/components/ui/use-toast';
import UploadModal from '@/components/UploadModal';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const allNavItems: NavItem[] = [
  { path: '/', label: '全部图片', icon: ImageIcon },
  { path: '/stats', label: '统计大屏', icon: BarChart3 },
  { path: '/albums', label: '相册管理', icon: Folder },
  { path: '/tokens', label: 'API Token', icon: Key },
  { path: '/users', label: '用户管理', icon: Shield, adminOnly: true },
  { path: '/storage', label: '存储配置', icon: Database },
  { path: '/api-docs', label: 'API 文档', icon: BookOpen },
  { path: '/settings', label: '系统设置', icon: Settings },
  { path: '/account', label: '账号设置', icon: UserCog },
];

// 导航项链接组件 - 保留 URL 查询参数
function NavItemLink({ item, onNavigate, collapsed = false }: { item: NavItem; onNavigate?: () => void; collapsed?: boolean }) {
  const Icon = item.icon;
  const location = useLocation();

  const to = {
    pathname: item.path,
    search: location.pathname === item.path ? location.search : undefined,
  };

  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
          isActive
            ? 'bg-indigo-50 text-indigo-600'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        } ${collapsed ? 'justify-center px-2' : ''}`
      }
      title={collapsed ? item.label : undefined}
    >
      <Icon className="w-5 h-5" />
      {!collapsed && item.label}
    </NavLink>
  );
}

function Sidebar({ onNavigate, collapsed, onToggleCollapse }: { onNavigate?: () => void; collapsed?: boolean; onToggleCollapse?: () => void }) {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';
  const navItems = allNavItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200/60 relative">
      <div className={`p-6 flex items-center gap-3 ${collapsed ? 'justify-center p-4' : ''}`}>
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="8" y="12" width="20" height="20" rx="6" fill="#E2E8F0" />
          <rect x="11" y="9" width="20" height="20" rx="6" fill="#94A3B8" />
          <rect x="14" y="6" width="20" height="20" rx="7" fill="url(#paint0_linear)" />
          <circle cx="24" cy="16" r="3" fill="white" fillOpacity="0.8" />
          <defs>
            <linearGradient id="paint0_linear" x1="14" y1="6" x2="34" y2="26" gradientUnits="userSpaceOnUse">
              <stop stopColor="#6366F1" />
              <stop offset="1" stopColor="#4F46E5" />
            </linearGradient>
          </defs>
        </svg>
        {!collapsed && <span className="text-xl font-bold text-slate-800 tracking-tight">Image Bed</span>}
      </div>

      <nav className={`flex-1 px-4 py-4 space-y-1 ${collapsed ? 'px-2' : ''}`}>
        {navItems.map((item) => (
          <NavItemLink
            key={item.path}
            item={item}
            onNavigate={onNavigate}
            collapsed={collapsed}
          />
        ))}
      </nav>

      <div className={`p-4 border-t border-slate-200/60 ${collapsed ? 'px-2' : ''}`}>
        <LogoutButton collapsed={collapsed} />
      </div>

      {/* 折叠/展开按钮 */}
      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className="absolute -right-3 top-20 w-6 h-6 bg-white border border-slate-200 rounded-full shadow-sm flex items-center justify-center hover:bg-slate-50 hover:shadow transition-all"
          title={collapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          {collapsed ? <ChevronRight className="w-3 h-3 text-slate-500" /> : <ChevronLeft className="w-3 h-3 text-slate-500" />}
        </button>
      )}
    </div>
  );
}

function LogoutButton({ collapsed = false }: { collapsed?: boolean }) {
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast({
      title: '已退出登录',
      description: '期待您的再次访问',
    });
    navigate('/login');
  };

  return (
    <button
      onClick={handleLogout}
      className={`flex items-center gap-3 px-4 py-2.5 w-full rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors ${collapsed ? 'justify-center px-2' : ''}`}
      title={collapsed ? '退出登录' : undefined}
    >
      <LogOut className="w-5 h-5" />
      {!collapsed && '退出登录'}
    </button>
  );
}

export default function DashboardLayout() {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  // 标记是否有上传成功，关闭弹窗时刷新
  const hasUploadSuccess = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';
  // 本地输入状态，避免中文输入法问题
  const [inputValue, setInputValue] = useState(searchQuery);
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();

  // 修改密码弹窗状态
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // 从全局 store 获取存储配置列表
  const { storageConfigs, loadStorageConfigs, refreshStorageConfigs } = useStorageConfigsStore();

  // 获取存储类型图标
  const getStorageIcon = (type?: string) => {
    switch (type) {
      case 's3':
        return <Cloud className="h-4 w-4 text-slate-500" />;
      case 'local':
        return <HardDrive className="h-4 w-4 text-slate-500" />;
      case 'webdav':
        return <Database className="h-4 w-4 text-slate-500" />;
      default:
        return <Database className="h-4 w-4 text-slate-500" />;
    }
  };

  // 加载存储配置
  useEffect(() => {
    loadStorageConfigs();
  }, [loadStorageConfigs]);

  const handleLogout = async () => {
    await logout();
    toast({
      title: '已退出',
      description: '拜拜~',
    });
    navigate('/login');
  };

  // 计算密码复杂度
  const getPasswordStrength = (password: string): { score: number; label: string; color: string } => {
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    const levels = [
      { label: '太短', color: 'bg-red-500' },
      { label: '弱', color: 'bg-orange-500' },
      { label: '一般', color: 'bg-yellow-500' },
      { label: '良好', color: 'bg-blue-500' },
      { label: '强', color: 'bg-green-500' },
      { label: '非常强', color: 'bg-emerald-500' },
    ];
    return { score, ...levels[score] };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  const handleChangePassword = async () => {
    // 验证
    if (!oldPassword) {
      toast({ title: '请输入当前密码', variant: 'destructive' });
      return;
    }
    if (!newPassword) {
      toast({ title: '请输入新密码', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: '新密码最少6位', variant: 'destructive' });
      return;
    }
    if (passwordStrength.score < 3) {
      toast({ title: '密码强度不足', description: '请使用包含大小写字母、数字和特殊字符的密码', variant: 'destructive' });
      return;
    }
    if (newPassword === oldPassword) {
      toast({ title: '新密码不能与旧密码相同', variant: 'destructive' });
      return;
    }
    if (!confirmPassword) {
      toast({ title: '请确认新密码', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: '两次输入的新密码不一致', variant: 'destructive' });
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword(oldPassword, newPassword);
      toast({ title: '密码修改成功', description: '请使用新密码重新登录' });
      setIsPasswordDialogOpen(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // 修改成功后退出登录
      await logout();
      navigate('/login');
    } catch (error) {
      toast({
        title: '修改失败',
        description: error instanceof Error ? error.message : '请检查当前密码是否正确',
        variant: 'destructive',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // 同步 URL 参数到本地状态
  useEffect(() => {
    setInputValue(searchQuery);
  }, [searchQuery]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // 按 Enter 时才更新 URL
      const value = inputValue.trim();
      if (value) {
        setSearchParams({ search: value });
      } else {
        searchParams.delete('search');
        setSearchParams(searchParams);
      }
    }
  };

  const handleSearchBlur = () => {
    // 失焦时也更新 URL（可选）
    const value = inputValue.trim();
    if (value !== searchQuery) {
      if (value) {
        setSearchParams({ search: value });
      } else {
        searchParams.delete('search');
        setSearchParams(searchParams);
      }
    }
  };

  const handleClearSearch = () => {
    setInputValue('');
    searchParams.delete('search');
    setSearchParams(searchParams);
  };

  // 上传成功时标记，关闭弹窗后刷新
  const handleUploadSuccess = () => {
    hasUploadSuccess.current = true;
  };

  // 处理弹窗关闭
  const handleUploadOpenChange = (open: boolean) => {
    setIsUploadOpen(open);
    // 弹窗关闭且有上传成功时刷新图片列表
    if (!open && hasUploadSuccess.current) {
      hasUploadSuccess.current = false;
      window.dispatchEvent(new CustomEvent('images:refresh'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:block ${isSidebarCollapsed ? 'w-20' : 'w-64'} fixed h-full z-40 transition-all duration-300`}>
        <Sidebar
          collapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <Sidebar onNavigate={() => setIsMobileMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b border-slate-200/60 bg-white/80 backdrop-blur-md">
          <div className="flex items-center justify-between px-6 h-16">
            {/* Left: Search */}
            <div className="flex items-center gap-4">
              <Sheet>
                <SheetTrigger asChild className="lg:hidden">
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">打开菜单</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0">
                  <Sidebar />
                </SheetContent>
              </Sheet>

              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="search"
                  placeholder="搜索图片..."
                  value={inputValue}
                  onChange={handleSearchChange}
                  onKeyDown={handleSearchKeyDown}
                  onBlur={handleSearchBlur}
                  className="pl-10 pr-10 w-64 max-w-xs bg-slate-100/80 border-0 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                />
                {inputValue && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded-full bg-slate-300 hover:bg-slate-400 transition-colors"
                    type="button"
                  >
                    <X className="h-3 w-3 text-slate-600" />
                  </button>
                )}
              </div>
            </div>

            {/* Right: Storage Select + Upload + User */}
            <div className="flex items-center gap-3">
              {/* 默认存储设置 */}
              {storageConfigs.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm hover:bg-slate-50 min-w-[140px]">
                      {(() => {
                        const defaultConfig = storageConfigs.find(c => c.is_default);
                        const storageType = (defaultConfig?.config as Record<string, string>)?.type;
                        return getStorageIcon(storageType);
                      })()}
                      <span className="truncate">
                        {storageConfigs.find(c => c.is_default)?.name || '设置默认存储'}
                      </span>
                      <ChevronDown className="h-4 w-4 ml-auto text-slate-500" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">点击设置默认存储</div>
                    <DropdownMenuSeparator />
                    {storageConfigs.map((config) => {
                      const storageType = (config.config as Record<string, string>)?.type;
                      return (
                        <DropdownMenuItem
                          key={config.id}
                          onClick={async () => {
                            try {
                              await setDefaultStorageConfig(config.id);
                              // 刷新存储配置列表
                              await refreshStorageConfigs();
                              toast({
                                title: '设置成功',
                                description: `${config.name} 已设为默认存储`,
                              });
                            } catch (error) {
                              toast({
                                title: '设置失败',
                                description: error instanceof Error ? error.message : '请稍后重试',
                                variant: 'destructive',
                              });
                            }
                          }}
                          className="cursor-pointer"
                        >
                          <div className="flex items-center justify-between w-full gap-3">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {getStorageIcon(storageType)}
                              <span className="truncate">{config.name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {config.is_default && (
                                <Badge variant="secondary" className="text-xs whitespace-nowrap">默认</Badge>
                              )}
                              {config.is_default && (
                                <Check className="h-4 w-4 text-indigo-600 shrink-0" />
                              )}
                            </div>
                          </div>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              
              <Button
                onClick={() => setIsUploadOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
              >
                <Upload className="mr-2 h-4 w-4" />
                上传图片
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center border border-slate-200 hover:bg-slate-300 transition-colors">
                    <User className="w-5 h-5 text-slate-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-2">
                    <p className="text-sm font-medium text-slate-900">{user?.username}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {user?.role && (
                        <Badge
                          variant={user.role === 'admin' ? 'default' : 'secondary'}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {user.role === 'admin' ? '管理员' : '普通用户'}
                        </Badge>
                      )}
                      {user?.status && (
                        <span className={`text-[10px] px-1.5 py-0 rounded-full border ${
                          user.status === 'active'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {user.status === 'active' ? '正常' : '已禁用'}
                        </span>
                      )}
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => navigate('/account')}
                    className="cursor-pointer"
                  >
                    <UserCog className="mr-2 h-4 w-4" />
                    账号设置
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setIsPasswordDialogOpen(true)}
                    className="cursor-pointer"
                  >
                    <Key className="mr-2 h-4 w-4" />
                    修改密码
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer text-red-600 focus:text-red-600"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="bg-slate-50 min-h-[calc(100vh-4rem)]">
          <div className="max-w-[1400px] 2xl:max-w-[1700px] mx-auto px-6 py-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Upload Modal */}
      <UploadModal
        open={isUploadOpen}
        onOpenChange={handleUploadOpenChange}
        onSuccess={handleUploadSuccess}
      />

      {/* 修改密码弹窗 */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              修改密码
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">当前密码</label>
              <div className="relative">
                <Input
                  type={showOldPassword ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="请输入当前密码"
                />
                <button
                  type="button"
                  onClick={() => setShowOldPassword(!showOldPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">新密码</label>
              <div className="relative">
                <Input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="最少6位"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {/* 密码强度指示器 */}
              {newPassword && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">密码强度</span>
                    <span className={`text-xs font-medium ${
                      passwordStrength.score >= 3 ? 'text-green-600' :
                      passwordStrength.score >= 2 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`h-1.5 flex-1 rounded-full transition-all ${
                          level <= passwordStrength.score ? passwordStrength.color : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                  <ul className="text-xs text-slate-500 space-y-1">
                    <li className={newPassword.length >= 6 ? 'text-green-600' : ''}>• 至少6个字符</li>
                    <li className={/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) ? 'text-green-600' : ''}>• 包含大小写字母</li>
                    <li className={/[0-9]/.test(newPassword) ? 'text-green-600' : ''}>• 包含数字</li>
                    <li className={/[^a-zA-Z0-9]/.test(newPassword) ? 'text-green-600' : ''}>• 包含特殊字符</li>
                  </ul>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">确认新密码</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入新密码"
              />
              {confirmPassword && confirmPassword !== newPassword && (
                <p className="text-xs text-red-500">两次输入的密码不一致</p>
              )}
              {confirmPassword && confirmPassword === newPassword && newPassword.length >= 6 && (
                <p className="text-xs text-green-600">密码一致</p>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsPasswordDialogOpen(false);
                  setOldPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
              >
                取消
              </Button>
              <Button
                onClick={handleChangePassword}
                disabled={isChangingPassword}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {isChangingPassword ? '修改中...' : '确认修改'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
