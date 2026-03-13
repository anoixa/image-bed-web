import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, ImageIcon, FolderOpen, Filter, X, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, Eye, EyeOff, Album as AlbumIcon } from 'lucide-react';
import { PhotoProvider } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import ImageCard from './ImageCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { fetchImages, deleteImage } from '@/api/images';
import { fetchAlbums } from '@/api/albums';
import type { Image, PaginatedResponse, Album } from '@/types';
import { toast } from '@/components/ui/use-toast';
import { Link, useSearchParams } from 'react-router-dom';

interface ImageGalleryProps {
  albumId?: number | null;
  title?: string;
  subtitle?: string;
}

export default function ImageGallery({ albumId, title: customTitle, subtitle: customSubtitle }: ImageGalleryProps = {}) {
  const [searchParams] = useSearchParams();
  const urlAlbumId = searchParams.get('album_id');
  const effectiveAlbumId = albumId ?? (urlAlbumId ? parseInt(urlAlbumId, 10) : null);
  const searchQuery = searchParams.get('search') || undefined;

  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setPagination] = useState<PaginatedResponse<Image> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [currentAlbum, setCurrentAlbum] = useState<Album | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [hasMore, setHasMore] = useState(true);

  // 筛选状态
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');
  const [albumFilter, setAlbumFilter] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState<'created_at' | 'file_size'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Intersection Observer ref
  const loaderRef = useRef<HTMLDivElement>(null);
  
  const hasInitialized = useRef(false);
  const wasHidden = useRef(false);
  const currentSearchRef = useRef(searchQuery);

  // 加载相册列表
  useEffect(() => {
    fetchAlbums()
      .then(setAlbums)
      .catch(console.error);
  }, []);

  const initialAlbumIdRef = useRef(effectiveAlbumId);
  const initialAlbumsRef = useRef<Album[]>([]);
  
  useEffect(() => {
    initialAlbumsRef.current = albums;
  }, [albums]);

  useEffect(() => {
    const albumId = initialAlbumIdRef.current;
    const albumsList = initialAlbumsRef.current;
    
    if (albumId && albumsList.length > 0) {
      const album = albumsList.find(a => a.id === albumId);
      setCurrentAlbum(album || null);
      if (album && !hasInitialized.current) {
        setAlbumFilter(album.id);
      }
    } else {
      setCurrentAlbum(null);
      if (!hasInitialized.current) {
        setAlbumFilter('all');
      }
    }
  }, []); // 空依赖，只在挂载时执行一次

  const hasActiveFilters = visibilityFilter !== 'all' || albumFilter !== 'all';

  const resetFilters = () => {
    setVisibilityFilter('all');
    setAlbumFilter(effectiveAlbumId || 'all');
    setSortBy('created_at');
    setSortOrder('desc');
  };

  const loadImages = useCallback(async (page: number = 1, append: boolean = false) => {
    if (page === 1) {
      setLoading(true);
    }
    setError(null);

    try {
      const params: Parameters<typeof fetchImages>[0] = {
        page,
        limit: 20,
      };

      if (albumFilter !== 'all') {
        params.album_id = albumFilter;
      }

      if (searchQuery && searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const response = await fetchImages(params);

      const items = response?.items || [];
      const total = response?.total || 0;
      const perPage = response?.per_page || 20;

      if (append) {
        setImages((prev) => [...prev, ...items]);
      } else {
        setImages(items);
      }

      setPagination(response);
      setCurrentPage(page);

      const totalPages = Math.ceil(total / perPage);
      setHasMore(page < totalPages && items.length > 0);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '加载失败';
      setError(errorMsg);
      if (page === 1) {
        toast({
          title: '加载失败',
          description: errorMsg,
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibilityFilter, albumFilter, sortBy, sortOrder, effectiveAlbumId, searchQuery]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        wasHidden.current = true;
      } else if (document.visibilityState === 'visible' && wasHidden.current) {
        wasHidden.current = false;
        if (images.length > 0) {
          loadImages(1, false);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadImages, images.length]);

  // 监听外部刷新事件（如上传成功后）
  useEffect(() => {
    const handleRefresh = () => {
      loadImages(1, false);
    };
    window.addEventListener('images:refresh', handleRefresh);
    return () => window.removeEventListener('images:refresh', handleRefresh);
  }, [loadImages]);

  useEffect(() => {
    if (!hasInitialized.current) {
      loadImages(1, false);
      hasInitialized.current = true;
      currentSearchRef.current = searchQuery;
    }
  }, [loadImages]);

  useEffect(() => {
    if (hasInitialized.current && searchQuery !== currentSearchRef.current) {
      currentSearchRef.current = searchQuery;
      loadImages(1, false);
    }
  }, [searchQuery, loadImages]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && hasMore && !loading) {
          loadImages(currentPage + 1, true);
        }
      },
      {
        root: null,
        rootMargin: '100px',
        threshold: 0.1,
      }
    );

    const currentLoader = loaderRef.current;
    if (currentLoader) {
      observer.observe(currentLoader);
    }

    return () => {
      if (currentLoader) {
        observer.unobserve(currentLoader);
      }
    };
  }, [hasMore, loading, currentPage, loadImages]);

  const handleDelete = async (identifier: string) => {
    try {
      await deleteImage(identifier);
      setImages((prev) => prev.filter((img) => img.identifier !== identifier));
      toast({
        title: '删除成功',
        description: '图片已删除',
      });
    } catch (error) {
      toast({
        title: '删除失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  // 获取筛选显示文本
  const getVisibilityLabel = () => {
    switch (visibilityFilter) {
      case 'public': return '公开';
      case 'private': return '私有';
      default: return '全部可见性';
    }
  };

  const getAlbumLabel = () => {
    if (albumFilter === 'all') return '全部相册';
    const album = albums.find(a => a.id === albumFilter);
    return album ? album.name : '全部相册';
  };

  const getSortLabel = () => {
    if (sortBy === 'created_at') {
      return sortOrder === 'desc' ? '最新上传' : '最早上传';
    }
    return sortOrder === 'desc' ? '文件大小 (大→小)' : '文件大小 (小→大)';
  };

  // 标题和副标题（优先使用传入的自定义标题）
  const title = customTitle ?? (currentAlbum ? currentAlbum.name : '全部图片');
  const subtitle = customSubtitle ?? (currentAlbum
    ? currentAlbum.description || `${currentAlbum.image_count} 张图片`
    : (albumFilter !== 'all'
        ? `相册: ${getAlbumLabel()}`
        : `${images.length} 张图片`));

  if (loading && images.length === 0) {
    return (
      <PhotoProvider>
        <div className="space-y-8">
          {/* Header Skeleton */}
          <div className="mb-8">
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          {/* Masonry Skeleton */}
          <div className="columns-2 lg:columns-4 gap-4 space-y-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="break-inside-avoid mb-4 rounded-xl overflow-hidden bg-slate-200">
                <Skeleton className="w-full h-48" />
              </div>
            ))}
          </div>
        </div>
      </PhotoProvider>
    );
  }

  if (error && images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <ImageIcon className="w-10 h-10 text-red-400" />
        </div>
        <h3 className="text-lg font-medium text-slate-800 mb-2">加载失败</h3>
        <p className="text-slate-500 mb-6">{error}</p>
        <Button onClick={() => loadImages(1, false)}>
          重新加载
        </Button>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
            {currentAlbum && (
              <Link
                to="/albums"
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                返回相册
              </Link>
            )}
          </div>
          <p className="text-slate-500">{subtitle}</p>
        </div>

        {/* 筛选栏 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 可见性筛选 */}
          {!currentAlbum && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  {visibilityFilter === 'public' ? <Eye className="h-4 w-4" /> : visibilityFilter === 'private' ? <EyeOff className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
                  {getVisibilityLabel()}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40">
                <DropdownMenuLabel>可见性</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setVisibilityFilter('all')}>
                  <Filter className="h-4 w-4 mr-2" />
                  全部
                  {visibilityFilter === 'all' && <span className="ml-auto">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setVisibilityFilter('public')}>
                  <Eye className="h-4 w-4 mr-2" />
                  公开
                  {visibilityFilter === 'public' && <span className="ml-auto">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setVisibilityFilter('private')}>
                  <EyeOff className="h-4 w-4 mr-2" />
                  私有
                  {visibilityFilter === 'private' && <span className="ml-auto">✓</span>}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* 相册筛选（仅在非相册页面显示） */}
          {!currentAlbum && albums.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <AlbumIcon className="h-4 w-4" />
                  {getAlbumLabel()}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuLabel>选择相册</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setAlbumFilter('all')}>
                  全部相册
                  {albumFilter === 'all' && <span className="ml-auto">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {albums.map((album) => (
                  <DropdownMenuItem key={album.id} onClick={() => setAlbumFilter(album.id)}>
                    <span className="truncate">{album.name}</span>
                    <span className="ml-auto text-xs text-slate-400">{album.image_count}</span>
                    {albumFilter === album.id && <span className="ml-2">✓</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* 排序方式 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowUpDown className="h-4 w-4" />
                {getSortLabel()}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>排序方式</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-slate-400">排序字段</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setSortBy('created_at')}>
                创建时间
                {sortBy === 'created_at' && <span className="ml-auto">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('file_size')}>
                文件大小
                {sortBy === 'file_size' && <span className="ml-auto">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-slate-400">排序顺序</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setSortOrder('desc')}>
                <ArrowDown className="h-4 w-4 mr-2" />
                降序
                {sortOrder === 'desc' && <span className="ml-auto">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOrder('asc')}>
                <ArrowUp className="h-4 w-4 mr-2" />
                升序
                {sortOrder === 'asc' && <span className="ml-auto">✓</span>}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 重置筛选 */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1 text-slate-500">
              <X className="h-3 w-3" />
              重置
            </Button>
          )}
        </div>

        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <ImageIcon className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-800 mb-2">暂无图片</h3>
          <p className="text-slate-500 mb-6">
            {hasActiveFilters ? '当前筛选条件下没有图片' : (currentAlbum ? '该相册还没有图片' : '点击右上角上传图片开始使用')}
          </p>
          {hasActiveFilters && (
            <Button variant="outline" onClick={resetFilters} className="gap-2">
              <X className="h-4 w-4" />
              清除筛选条件
            </Button>
          )}
          {currentAlbum && !hasActiveFilters && (
            <Link to="/albums">
              <button className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors">
                <FolderOpen className="h-4 w-4" />
                返回相册列表
              </button>
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* List Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
          {currentAlbum && (
            <Link
              to="/albums"
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              返回相册
            </Link>
          )}
        </div>
        <p className="text-slate-500">{subtitle}</p>

        {/* 筛选栏 */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          {/* 可见性筛选 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                {visibilityFilter === 'public' ? <Eye className="h-4 w-4" /> : visibilityFilter === 'private' ? <EyeOff className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
                {getVisibilityLabel()}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuLabel>可见性</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setVisibilityFilter('all')}>
                <Filter className="h-4 w-4 mr-2" />
                全部
                {visibilityFilter === 'all' && <span className="ml-auto">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setVisibilityFilter('public')}>
                <Eye className="h-4 w-4 mr-2" />
                公开
                {visibilityFilter === 'public' && <span className="ml-auto">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setVisibilityFilter('private')}>
                <EyeOff className="h-4 w-4 mr-2" />
                私有
                {visibilityFilter === 'private' && <span className="ml-auto">✓</span>}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 相册筛选（仅在非相册页面显示） */}
          {!currentAlbum && albums.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <AlbumIcon className="h-4 w-4" />
                  {getAlbumLabel()}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuLabel>选择相册</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setAlbumFilter('all')}>
                  全部相册
                  {albumFilter === 'all' && <span className="ml-auto">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {albums.map((album) => (
                  <DropdownMenuItem key={album.id} onClick={() => setAlbumFilter(album.id)}>
                    <span className="truncate">{album.name}</span>
                    <span className="ml-auto text-xs text-slate-400">{album.image_count}</span>
                    {albumFilter === album.id && <span className="ml-2">✓</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* 排序方式 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowUpDown className="h-4 w-4" />
                {getSortLabel()}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>排序方式</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-slate-400">排序字段</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setSortBy('created_at')}>
                创建时间
                {sortBy === 'created_at' && <span className="ml-auto">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('file_size')}>
                文件大小
                {sortBy === 'file_size' && <span className="ml-auto">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-slate-400">排序顺序</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setSortOrder('desc')}>
                <ArrowDown className="h-4 w-4 mr-2" />
                降序
                {sortOrder === 'desc' && <span className="ml-auto">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOrder('asc')}>
                <ArrowUp className="h-4 w-4 mr-2" />
                升序
                {sortOrder === 'asc' && <span className="ml-auto">✓</span>}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 重置筛选 */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1 text-slate-500">
              <X className="h-3 w-3" />
              重置
            </Button>
          )}
        </div>

        {/* 当前筛选标签 */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {visibilityFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-slate-200" onClick={() => setVisibilityFilter('all')}>
                {getVisibilityLabel()}
                <X className="h-3 w-3" />
              </Badge>
            )}
            {albumFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-slate-200" onClick={() => setAlbumFilter('all')}>
                {getAlbumLabel()}
                <X className="h-3 w-3" />
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Masonry Image Grid with Lightbox */}
      <PhotoProvider
        maskOpacity={0.85}
        loop={true}
        maskClosable={true}
        pullClosable={true}
      >
        <div className="columns-2 lg:columns-4 gap-4 space-y-4">
          {images.map((image, index) => (
            <div
              key={image.id}
              className="animate-fade-in-up"
              style={{
                animationDelay: `${(index % 8) * 50}ms`,
                animationFillMode: 'both',
              }}
            >
              <ImageCard
                image={image}
                onDelete={handleDelete}
                currentAlbumId={effectiveAlbumId}
                onAlbumChange={() => loadImages(1, false)}
                onVisibilityChange={() => loadImages(1, false)}
              />
            </div>
          ))}
        </div>
      </PhotoProvider>

      {/* Infinite Scroll Loader */}
      <div
        ref={loaderRef}
        className="flex justify-center py-8"
      >
        {loading && hasMore && (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>加载中...</span>
          </div>
        )}
        {!hasMore && images.length > 0 && (
          <p className="text-slate-400 text-sm">已加载全部 {images.length} 张图片</p>
        )}
      </div>
    </div>
  );
}
