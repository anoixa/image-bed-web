import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { RefreshCw, ImageIcon, Folder, Users, HardDrive, TrendingUp } from 'lucide-react';
import { fetchDashboardStats, refreshDashboardStats } from '@/api/dashboard';
import type { DashboardStats, StorageStat } from '@/types';
import { useAuthStore } from '@/store/auth';
import { toast } from '@/components/ui/use-toast';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const wasHidden = useRef(false);
  const isAdmin = useAuthStore((state) => state.user?.role === 'admin');

  const loadStats = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      const data = await fetchDashboardStats();
      setStats(data);
    } catch (error) {
      toast({
        title: '加载失败',
        description: error instanceof Error ? error.message : '获取统计数据失败',
        variant: 'destructive',
      });
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await refreshDashboardStats();
      await loadStats();
      toast({
        title: '刷新成功',
        description: '统计数据已更新',
      });
    } catch (error) {
      toast({
        title: '刷新失败',
        description: error instanceof Error ? error.message : '刷新统计数据失败',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        wasHidden.current = true;
      } else if (document.visibilityState === 'visible' && wasHidden.current) {
        wasHidden.current = false;
        if (stats) {
          loadStats(true);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [stats]);

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-indigo-600" />
              仪表盘
            </h1>
            <p className="text-slate-500 mt-1">系统概览与统计</p>
          </div>
        </div>
        <div className={`grid grid-cols-1 md:grid-cols-2 ${isAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
          {Array.from({ length: isAdmin ? 4 : 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6 h-32 bg-slate-100" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-slate-500 mb-4">加载统计数据失败</p>
        <Button onClick={() => loadStats()}>重试</Button>
      </div>
    );
  }

  const { overview, storage_stats, trend } = stats;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-indigo-600" />
            仪表盘
          </h1>
          <p className="text-slate-500 mt-1">系统概览与统计</p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          刷新数据
        </Button>
      </div>

      {/* Overview Cards */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${isAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
        <StatCard
          icon={ImageIcon}
          label="图片总数"
          value={overview.images.total}
          subValue={`今日 +${overview.images.today}`}
          color="text-blue-600"
          bgColor="bg-blue-50"
        />
        <StatCard
          icon={Folder}
          label="相册数量"
          value={overview.albums.total}
          color="text-purple-600"
          bgColor="bg-purple-50"
        />
        {isAdmin && (
          <StatCard
            icon={Users}
            label="用户数量"
            value={overview.users.total}
            color="text-emerald-600"
            bgColor="bg-emerald-50"
          />
        )}
        <StatCard
          icon={HardDrive}
          label="存储占用"
          value={overview.storage.total_size_human}
          subValue={`${storage_stats.length} 个存储源`}
          color="text-amber-600"
          bgColor="bg-amber-50"
        />
      </div>

      {/* Storage Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            存储详情
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {storage_stats.map((stat) => (
            <StorageStatItem key={stat.storage_id} stat={stat} />
          ))}
        </CardContent>
      </Card>

      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            上传趋势 (近30天)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-end gap-1">
            {trend.data.slice(-30).map((value, index) => {
              const max = Math.max(...trend.data);
              const height = max > 0 ? (value / max) * 100 : 0;
              return (
                <div
                  key={index}
                  className="flex-1 bg-indigo-500/80 hover:bg-indigo-600 rounded-t transition-colors relative group"
                  style={{ height: `${height}%`, minHeight: '4px' }}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    {trend.dates.slice(-30)[index]}: {value} 张
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-400">
            <span>{trend.dates.slice(-30)[0]}</span>
            <span>{trend.dates.slice(-30)[trend.dates.length - 1]}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subValue?: string;
  color: string;
  bgColor: string;
}

function StatCard({ icon: Icon, label, value, subValue, color, bgColor }: StatCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className={`p-3 rounded-lg ${bgColor}`}>
            <Icon className={`h-6 w-6 ${color}`} />
          </div>
        </div>
        <div className="mt-4">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
          {subValue && (
            <p className="text-sm text-slate-400 mt-1">{subValue}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StorageStatItem({ stat }: { stat: StorageStat }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-700">{stat.storage_name}</span>
          <span className="text-sm text-slate-400">({stat.count} 张)</span>
        </div>
        <div className="text-right">
          <span className="text-sm font-medium text-slate-700">{stat.size_human}</span>
          <span className="text-sm text-slate-400 ml-2">({stat.percentage.toFixed(1)}%)</span>
        </div>
      </div>
      <Progress value={stat.percentage} className="h-2" />
    </div>
  );
}
