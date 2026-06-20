import { useState, useEffect, useCallback, useRef } from 'react';
import { ImageIcon, FolderOpen, Filter, X, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, Eye, EyeOff, Album as AlbumIcon, CheckSquare } from 'lucide-react';
import { PhotoProvider } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import JustifiedGallery from './JustifiedGallery';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { fetchImages, deleteImage, deleteImages } from '@/api/images';
import { fetchAlbums, removeImagesFromAlbum } from '@/api/albums';
import type { Image, PaginatedResponse, Album } from '@/types';
import { toast } from '@/components/ui/use-toast';
import { isRequestCanceled } from '@/lib/request';
import { Link, useSearchParams } from 'react-router-dom';
import ConfirmDialog from './ConfirmDialog';
import AlbumSelectModal from './AlbumSelectModal';
import {
  applyGalleryFiltersToParams,
  DEFAULT_GALLERY_FILTERS,
  parseGalleryFilters,
  type GalleryFilters,
  type GalleryAlbumFilter,
  type GallerySortBy,
  type GallerySortOrder,
  type GalleryVisibilityFilter,
} from '@/lib/galleryFilters';

interface ImageGalleryProps {
  albumId?: number | null;
  title?: string;
  subtitle?: string;
}

export default function ImageGallery({ albumId, title: customTitle, subtitle: customSubtitle }: ImageGalleryProps = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlFilters = parseGalleryFilters(searchParams);
  const urlAlbumId = searchParams.get('album_id');
  const effectiveAlbumId = albumId ?? (urlAlbumId ? parseInt(urlAlbumId, 10) : null);
  const searchQuery = searchParams.get('search') || undefined;

  const [images, setImages] = useState<Image[]>([]);
  const [initialLoading, setInitialLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [, setPagination] = useState<PaginatedResponse<Image> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [currentAlbum, setCurrentAlbum] = useState<Album | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [hasMore, setHasMore] = useState(true);

  // 筛选状态
  const [visibilityFilter, setVisibilityFilterState] = useState<GalleryVisibilityFilter>(urlFilters.visibility);
  const [albumFilter, setAlbumFilterState] = useState<GalleryAlbumFilter>(effectiveAlbumId ?? urlFilters.album);
  const [sortBy, setSortByState] = useState<GallerySortBy>(urlFilters.sortBy);
  const [sortOrder, setSortOrderState] = useState<GallerySortOrder>(urlFilters.sortOrder);

  // Intersection Observer ref
  const loaderRef = useRef<HTMLDivElement>(null);
  
  const inFlightRequestRef = useRef<string | null>(null);
  const latestRequestIdRef = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);
  const imagesCountRef = useRef(0);

  // 批量操作状态
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  
  // 单张图片删除确认状态
  const [showSingleDeleteConfirm, setShowSingleDeleteConfirm] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<string | null>(null);

  // 相册选择弹窗状态
  const [isAlbumModalOpen, setIsAlbumModalOpen] = useState(false);
  const [currentImageForAlbum, setCurrentImageForAlbum] = useState<string | null>(null);

  useEffect(() => {
    imagesCountRef.current = images.length;
  }, [images.length]);

  // 加载相册列表
  useEffect(() => {
    fetchAlbums()
      .then(setAlbums)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (effectiveAlbumId && albums.length > 0) {
      const album = albums.find(a => a.id === effectiveAlbumId);
      setCurrentAlbum(album || null);
    } else {
      setCurrentAlbum(null);
    }
  }, [albums, effectiveAlbumId]);

  const hasActiveFilters = visibilityFilter !== 'all' || albumFilter !== 'all';
  const isBusy = initialLoading || refreshing || loadingMore;

  const updateUrlFilters = useCallback((filters: Partial<GalleryFilters>) => {
    setSearchParams((currentParams) => applyGalleryFiltersToParams(currentParams, filters), {
      replace: true,
    });
  }, [setSearchParams]);

  const setVisibilityFilter = useCallback((filter: GalleryVisibilityFilter) => {
    setVisibilityFilterState(filter);
    setCurrentPage(1);
    updateUrlFilters({ visibility: filter });
  }, [updateUrlFilters]);

  const setAlbumFilter = useCallback((filter: GalleryAlbumFilter) => {
    setAlbumFilterState(filter);
    setCurrentPage(1);
    updateUrlFilters({ album: filter });
  }, [updateUrlFilters]);

  const setSortBy = useCallback((sort: GallerySortBy) => {
    setSortByState(sort);
    setCurrentPage(1);
    updateUrlFilters({ sortBy: sort });
  }, [updateUrlFilters]);

  const setSortOrder = useCallback((order: GallerySortOrder) => {
    setSortOrderState(order);
    setCurrentPage(1);
    updateUrlFilters({ sortOrder: order });
  }, [updateUrlFilters]);

  const resetFilters = () => {
    setVisibilityFilterState(DEFAULT_GALLERY_FILTERS.visibility);
    setAlbumFilterState(effectiveAlbumId || DEFAULT_GALLERY_FILTERS.album);
    setSortByState(DEFAULT_GALLERY_FILTERS.sortBy);
    setSortOrderState(DEFAULT_GALLERY_FILTERS.sortOrder);
    setCurrentPage(1);
    updateUrlFilters({
      visibility: DEFAULT_GALLERY_FILTERS.visibility,
      album: effectiveAlbumId || DEFAULT_GALLERY_FILTERS.album,
      sortBy: DEFAULT_GALLERY_FILTERS.sortBy,
      sortOrder: DEFAULT_GALLERY_FILTERS.sortOrder,
    });
  };

  const loadImages = useCallback(async (page: number = 1, append: boolean = false) => {
    const requestKey = JSON.stringify({
      page,
      append,
      albumFilter,
      visibilityFilter,
      search: searchQuery?.trim() || '',
      sortBy,
      sortOrder,
    });

    if (inFlightRequestRef.current === requestKey) {
      return;
    }

    inFlightRequestRef.current = requestKey;
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    latestRequestIdRef.current += 1;
    const requestId = latestRequestIdRef.current;

    const loadMode = append ? 'append' : (imagesCountRef.current === 0 ? 'initial' : 'refresh');

    if (loadMode === 'append') {
      setLoadingMore(true);
      setLoadMoreError(null);
    } else {
      setLoadingMore(false);
      setLoadMoreError(null);
      setError(null);
      if (loadMode === 'initial') {
        setInitialLoading(true);
      } else {
        setRefreshing(true);
      }
    }

    try {
      const params: Parameters<typeof fetchImages>[0] = {
        page,
        limit: 20,
        sort: sortOrder,
      };

      if (albumFilter !== 'all') {
        params.album_id = albumFilter;
      }

      if (visibilityFilter !== 'all') {
        params.is_public = visibilityFilter === 'public';
      }

      if (searchQuery && searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const response = await fetchImages(params, { signal: controller.signal });

      if (requestId !== latestRequestIdRef.current) {
        return;
      }

      const items = [...(response?.items || [])].sort((a, b) => {
        const aValue = sortBy === 'file_size' ? a.file_size : a.created_at;
        const bValue = sortBy === 'file_size' ? b.file_size : b.created_at;
        return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
      });
      const total = response?.total || 0;
      const perPage = response?.per_page || 20;

      if (append) {
        setImages((prev) => [...prev, ...items]);
      } else {
        setImages(items);
      }

      setPagination(response);
      setCurrentPage(page);
      setHasLoaded(true);
      setError(null);
      setLoadMoreError(null);

      const totalPages = Math.ceil(total / perPage);
      setHasMore(page < totalPages && items.length > 0);
    } catch (err) {
      if (isRequestCanceled(err)) {
        return;
      }
      const errorMsg = err instanceof Error ? err.message : '加载失败';
      if (loadMode === 'append') {
        setLoadMoreError(errorMsg);
        toast({
          title: '加载更多失败',
          description: errorMsg,
          variant: 'destructive',
        });
      } else {
        setError(errorMsg);
        toast({
          title: loadMode === 'initial' ? '加载失败' : '刷新失败',
          description: errorMsg,
          variant: 'destructive',
        });
      }
    } finally {
      if (inFlightRequestRef.current === requestKey) {
        inFlightRequestRef.current = null;
      }
      if (requestId === latestRequestIdRef.current) {
        requestControllerRef.current = null;
        setInitialLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        setHasLoaded(true);
      }
    }
  }, [albumFilter, searchQuery, sortBy, sortOrder, visibilityFilter]);

  useEffect(() => () => requestControllerRef.current?.abort(), []);

  useEffect(() => {
    if (searchParams.has('page')) {
      updateUrlFilters({});
    }
  }, [searchParams, updateUrlFilters]);

  // 监听外部刷新事件（如上传成功后）
  useEffect(() => {
    const handleRefresh = () => {
      loadImages(1, false);
    };
    window.addEventListener('images:refresh', handleRefresh);
    return () => window.removeEventListener('images:refresh', handleRefresh);
  }, [loadImages]);

  // 监听 URL 中的 album_id 变化，更新筛选状态
  useEffect(() => {
    if (effectiveAlbumId) {
      setAlbumFilterState(effectiveAlbumId);
    } else {
      setAlbumFilterState(urlFilters.album);
    }
    setVisibilityFilterState(urlFilters.visibility);
    setSortByState(urlFilters.sortBy);
    setSortOrderState(urlFilters.sortOrder);
  }, [effectiveAlbumId, urlFilters.album, urlFilters.sortBy, urlFilters.sortOrder, urlFilters.visibility]);

  useEffect(() => {
    loadImages(1, false);
  }, [loadImages]);

  const loadNextPage = useCallback((ignoreLoadMoreError: boolean = false) => {
    if (hasMore && !isBusy && (ignoreLoadMoreError || !loadMoreError)) {
      loadImages(currentPage + 1, true);
    }
  }, [currentPage, hasMore, isBusy, loadImages, loadMoreError]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting) {
          loadNextPage();
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
  }, [loadNextPage]);

  useEffect(() => {
    const handleScrollNearBottom = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const scrollHeight = document.documentElement.scrollHeight;

      if (scrollHeight - scrollTop - viewportHeight < 600) {
        loadNextPage();
      }
    };

    window.addEventListener('scroll', handleScrollNearBottom, { passive: true });
    handleScrollNearBottom();

    return () => window.removeEventListener('scroll', handleScrollNearBottom);
  }, [loadNextPage]);

  // 显示单张图片删除确认
  const handleShowDeleteConfirm = (identifier: string) => {
    setImageToDelete(identifier);
    setShowSingleDeleteConfirm(true);
  };

  // 执行单张图片删除
  const handleConfirmSingleDelete = async () => {
    if (!imageToDelete) return;
    
    try {
      await deleteImage(imageToDelete);
      setImages((prev) => prev.filter((img) => img.identifier !== imageToDelete));
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
    } finally {
      setShowSingleDeleteConfirm(false);
      setImageToDelete(null);
    }
  };

  // 批量选择处理
  const handleSelectImage = (identifier: string, selected: boolean) => {
    setSelectedImages((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(identifier);
      } else {
        newSet.delete(identifier);
      }
      return newSet;
    });
  };

  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectedImages.size === images.length) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(images.map(img => img.identifier)));
    }
  };

  // 退出批量模式
  const exitBatchMode = () => {
    setIsBatchMode(false);
    setSelectedImages(new Set());
  };

  // 打开添加图片到相册的弹窗
  const handleAddToAlbum = (identifier: string) => {
    setCurrentImageForAlbum(identifier);
    setIsAlbumModalOpen(true);
  };

  // 批量添加到相册
  const handleBatchAddToAlbum = () => {
    if (selectedImages.size === 0) return;
    setCurrentImageForAlbum(null); // 清空单张图片，使用选中的多张
    setIsAlbumModalOpen(true);
  };

  // 关闭相册弹窗
  const closeAlbumModal = () => {
    setIsAlbumModalOpen(false);
    setCurrentImageForAlbum(null);
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedImages.size === 0) return;
    
    try {
      const identifiers = Array.from(selectedImages);
      await deleteImages(identifiers);
      
      // 从列表中移除已删除的图片
      setImages((prev) => prev.filter((img) => !selectedImages.has(img.identifier)));
      
      toast({
        title: '批量删除成功',
        description: `成功删除 ${identifiers.length} 张图片`,
      });
      
      // 退出批量模式
      exitBatchMode();
    } catch (error) {
      toast({
        title: '批量删除失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  // 批量从相册移除
  const handleBatchRemoveFromAlbum = async () => {
    if (selectedImages.size === 0 || !effectiveAlbumId) return;
    
    try {
      const identifiers = Array.from(selectedImages);
      const response = await removeImagesFromAlbum(effectiveAlbumId, identifiers);
      
      // 从列表中移除已从相册移除的图片
      setImages((prev) => prev.filter((img) => !selectedImages.has(img.identifier)));
      
      toast({
        title: '批量移除成功',
        description: `成功从相册移除 ${response.removed_count} 张图片`,
      });
      
      // 退出批量模式
      exitBatchMode();
    } catch (error) {
      toast({
        title: '批量移除失败',
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

  const retryFirstPage = useCallback(() => {
    loadImages(1, false);
  }, [loadImages]);

  const retryLoadMore = useCallback(() => {
    loadNextPage(true);
  }, [loadNextPage]);

  // 标题和副标题（优先使用传入的自定义标题）
  const title = customTitle ?? (currentAlbum ? currentAlbum.name : '全部图片');
  const subtitle = customSubtitle ?? (currentAlbum
    ? currentAlbum.description || `${currentAlbum.image_count} 张图片`
    : (albumFilter !== 'all'
        ? `相册: ${getAlbumLabel()}`
        : `${images.length} 张图片`));

  if (!hasLoaded || (initialLoading && images.length === 0)) {
    return (
      <PhotoProvider>
        <div className="space-y-8">
          {/* Header Skeleton */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-6 h-6 bg-slate-300 rounded animate-pulse" />
              <div className="w-32 h-8 bg-slate-300 rounded animate-pulse" />
            </div>
            <div className="w-48 h-4 bg-slate-300 rounded animate-pulse" />
          </div>
          {/* Masonry Skeleton */}
          <div className="columns-2 lg:columns-4 gap-4 space-y-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="break-inside-avoid mb-4 rounded-xl overflow-hidden bg-slate-300">
                <Skeleton className="w-full h-48 bg-slate-300" />
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
        <Button onClick={retryFirstPage} disabled={initialLoading}>
          {initialLoading ? '加载中...' : '重新加载'}
        </Button>
      </div>
    );
  }

  if (images.length === 0 && hasLoaded) {
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

        {/* 批量操作按钮 / 筛选栏 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 批量选择按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsBatchMode(true)}
            className="gap-2"
          >
            <CheckSquare className="h-4 w-4" />
            批量选择
          </Button>

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
          <ImageIcon className="w-6 h-6 text-indigo-600" />
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

      {/* 单张图片删除确认对话框 */}
      <ConfirmDialog
        open={showSingleDeleteConfirm}
        onOpenChange={setShowSingleDeleteConfirm}
        title="确认删除"
        description="确定要删除这张图片吗？此操作不可恢复。"
        onConfirm={handleConfirmSingleDelete}
        confirmText="删除"
        cancelText="取消"
        variant="destructive"
      />

      {/* Justified Layout Gallery - 等高瀑布流布局 */}
      <JustifiedGallery
        images={images}
        loading={loadingMore}
        refreshing={refreshing}
        hasMore={hasMore}
        error={error}
        loadMoreError={loadMoreError}
        currentAlbum={currentAlbum}
        albums={albums}
        visibilityFilter={visibilityFilter}
        albumFilter={albumFilter}
        sortBy={sortBy}
        sortOrder={sortOrder}
        isBatchMode={isBatchMode}
        selectedImages={selectedImages}
        onDelete={handleShowDeleteConfirm}
        onAddToAlbum={handleAddToAlbum}
        onBatchDelete={handleBatchDelete}
        onBatchRemoveFromAlbum={handleBatchRemoveFromAlbum}
        onBatchAddToAlbum={handleBatchAddToAlbum}
        onSelectImage={handleSelectImage}
        onSelectAll={handleSelectAll}
        onExitBatchMode={exitBatchMode}
        setVisibilityFilter={setVisibilityFilter}
        setAlbumFilter={setAlbumFilter}
        setSortBy={setSortBy}
        setSortOrder={setSortOrder}
        setIsBatchMode={setIsBatchMode}
        effectiveAlbumId={effectiveAlbumId}
        loaderRef={loaderRef}
        onRetry={retryFirstPage}
        onRetryLoadMore={retryLoadMore}
      />

      {/* 相册选择弹窗 */}
      <AlbumSelectModal
        open={isAlbumModalOpen}
        onOpenChange={closeAlbumModal}
        imageIdentifiers={currentImageForAlbum ? [currentImageForAlbum] : Array.from(selectedImages)}
        onSuccess={closeAlbumModal}
      />

    </div>
  );
}
