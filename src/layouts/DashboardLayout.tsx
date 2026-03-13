import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useSearchParams } from 'react-router-dom';
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
} from 'lucide-react';
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
import { useAuthStore } from '@/store/auth';
import { toast } from '@/components/ui/use-toast';
import UploadModal from '@/components/UploadModal';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { path: '/', label: '全部图片', icon: ImageIcon },
  { path: '/stats', label: '统计大屏', icon: BarChart3 },
  { path: '/albums', label: '相册管理', icon: Folder },
  { path: '/settings', label: '系统设置', icon: Settings },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200/60">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
          <ImageIcon className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-slate-800 tracking-tight">Image Bed</span>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200/60">
        <LogoutButton />
      </div>
    </div>
  );
}

function LogoutButton() {
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
      className="flex items-center gap-3 px-4 py-2.5 w-full rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
    >
      <LogOut className="w-5 h-5" />
      退出登录
    </button>
  );
}

export default function DashboardLayout() {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // 标记是否有上传成功，关闭弹窗时刷新
  const hasUploadSuccess = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';
  // 本地输入状态，避免中文输入法问题
  const [inputValue, setInputValue] = useState(searchQuery);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast({
      title: '已退出',
      description: '拜拜~',
    });
    navigate('/login');
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
      <aside className="hidden lg:block w-64 fixed h-full z-40">
        <Sidebar />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <Sidebar onNavigate={() => setIsMobileMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 lg:ml-64">
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

            {/* Right: Upload + User */}
            <div className="flex items-center gap-3">
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
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => toast({ title: '敬请期待', description: '修改密码功能即将上线' })}
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
    </div>
  );
}
