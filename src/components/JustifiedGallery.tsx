import { useState, useMemo, useRef, useEffect } from 'react';
import { Loader2, ImageIcon, FolderOpen, Filter, X, CheckSquare, Square, FolderMinus, FolderPlus, Trash2, ArrowUpDown, Eye, EyeOff } from 'lucide-react';
import { PhotoSlider } from 'react-photo-view';
import type { Image, Album } from '@/types';
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
import JustifiedImageCard from './JustifiedImageCard';
import ConfirmDialog from './ConfirmDialog';
import { buildGalleryRows, GALLERY_GAP } from './justifiedGalleryLayout';

interface JustifiedGalleryProps {
  images: Image[];
  loading: boolean;
  refreshing?: boolean;
  hasMore: boolean;
  error: string | null;
  loadMoreError?: string | null;
  currentAlbum?: Album | null;
  albums?: Album[];
  visibilityFilter?: 'all' | 'public' | 'private';
  albumFilter?: number | 'all';
  sortBy?: 'created_at' | 'file_size';
  sortOrder?: 'asc' | 'desc';
  isBatchMode?: boolean;
  selectedImages?: Set<string>;
  onDelete?: (identifier: string) => void;
  onAddToAlbum?: (identifier: string) => void;
  onBatchDelete?: () => void;
  onBatchRemoveFromAlbum?: () => void;
  onBatchAddToAlbum?: (identifiers: string[]) => void;
  onSelectImage?: (identifier: string, selected: boolean) => void;
  onSelectAll?: () => void;
  onExitBatchMode?: () => void;
  setVisibilityFilter?: (filter: 'all' | 'public' | 'private') => void;
  setAlbumFilter?: (filter: number | 'all') => void;
  setSortBy?: (sort: 'created_at' | 'file_size') => void;
  setSortOrder?: (order: 'asc' | 'desc') => void;
  setIsBatchMode?: (mode: boolean) => void;
  effectiveAlbumId?: number | null;
  loaderRef?: React.RefObject<HTMLDivElement | null>;
  onRetry?: () => void;
  onRetryLoadMore?: () => void;
}

const GAP = GALLERY_GAP;

const getImageOriginalUrl = (image: Image) => image.links?.original || image.url || '';
const getImagePreviewKey = (image: Image) => image.identifier || String(image.id);

export default function JustifiedGallery({
  images,
  loading,
  refreshing = false,
  hasMore,
  error,
  loadMoreError = null,
  currentAlbum,
  albums = [],
  visibilityFilter = 'all',
  albumFilter = 'all',
  sortBy = 'created_at',
  sortOrder = 'desc',
  isBatchMode = false,
  selectedImages = new Set(),
  onDelete,
  onAddToAlbum,
  onBatchDelete,
  onBatchRemoveFromAlbum,
  onBatchAddToAlbum,
  onSelectImage,
  onSelectAll,
  onExitBatchMode,
  setVisibilityFilter,
  setAlbumFilter,
  setSortBy,
  setSortOrder,
  setIsBatchMode,
  effectiveAlbumId,
  loaderRef,
  onRetry,
  onRetryLoadMore,
}: JustifiedGalleryProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 使用 ResizeObserver 获取容器宽度
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    let frameId: number | null = null;
    
    const updateWidth = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      frameId = requestAnimationFrame(() => {
        const width = node.getBoundingClientRect().width;
        if (width > 0) {
          setContainerWidth((prev) => (prev === width ? prev : width));
        }
        frameId = null;
      });
    };
    
    updateWidth();
    
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    
    return () => {
      observer.disconnect();
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, []);

  // 将图片分组到行
  const rows = useMemo(() => {
    return buildGalleryRows(images, containerWidth);
  }, [images, containerWidth]);

  const previewImages = useMemo(() => {
    return images.map((image) => ({
      key: getImagePreviewKey(image),
      src: getImageOriginalUrl(image),
      width: image.width,
      height: image.height,
    }));
  }, [images]);

  useEffect(() => {
    if (previewIndex >= previewImages.length) {
      setPreviewIndex(Math.max(previewImages.length - 1, 0));
    }
  }, [previewImages.length, previewIndex]);

  const handlePreview = (identifier: string) => {
    const index = previewImages.findIndex((image) => image.key === identifier);
    if (index === -1 || !previewImages[index]?.src) {
      return;
    }
    setPreviewIndex(index);
    setPreviewVisible(true);
  };

  const hasActiveFilters = visibilityFilter !== 'all' || albumFilter !== 'all';

  const getVisibilityLabel = () => {
    switch (visibilityFilter) {
      case 'public': return '仅公开';
      case 'private': return '仅私有';
      default: return '全部可见性';
    }
  };

  const getAlbumLabel = () => {
    if (albumFilter === 'all') return '全部相册';
    const album = albums.find(a => a.id === albumFilter);
    return album?.name || '选择相册';
  };

  const getSortLabel = () => {
    const field = sortBy === 'created_at' ? '创建时间' : '文件大小';
    const order = sortOrder === 'desc' ? '降序' : '升序';
    return `${field} · ${order}`;
  };

  const resetFilters = () => {
    setVisibilityFilter?.('all');
    setAlbumFilter?.('all');
  };

  if (error && images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <ImageIcon className="w-10 h-10 text-slate-400" />
        </div>
        <h3 className="text-lg font-medium text-slate-800 mb-2">加载失败</h3>
        <p className="text-slate-500 mb-6">{error}</p>
        <Button onClick={onRetry}>重新加载</Button>
      </div>
    );
  }

  if (images.length === 0 && !loading) {
    return (
      <div className="space-y-8">
        {/* Empty State */}
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
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" ref={containerRef}>
      {/* 批量操作工具栏 / 筛选栏 */}
        {isBatchMode ? (
          <div className="flex flex-wrap items-center justify-between gap-2 mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={onSelectAll}
                className="gap-2 text-indigo-700 hover:text-indigo-800 hover:bg-indigo-100"
              >
                {selectedImages.size === images.length ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                {selectedImages.size === images.length ? '取消全选' : '全选'}
              </Button>
              <span className="text-sm text-indigo-700">
                已选择 <strong>{selectedImages.size}</strong> 张图片
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onExitBatchMode} className="border-indigo-300 text-indigo-700 hover:bg-indigo-100">
                取消
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBatchAddToAlbum?.(Array.from(selectedImages))}
                disabled={selectedImages.size === 0}
                className="gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-100"
              >
                <FolderPlus className="h-4 w-4" />
                添加到相册
              </Button>
              {effectiveAlbumId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRemoveConfirm(true)}
                  disabled={selectedImages.size === 0}
                  className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  <FolderMinus className="h-4 w-4" />
                  从相册移除
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={selectedImages.size === 0}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                删除选中
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setIsBatchMode?.(true)} className="gap-2">
              <CheckSquare className="h-4 w-4" />
              批量选择
            </Button>

            {!currentAlbum && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    {visibilityFilter === 'public' ? <Eye className="h-4 w-4" /> : visibilityFilter === 'private' ? <EyeOff className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
                    {getVisibilityLabel()}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40">
                  <DropdownMenuLabel>可见性</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setVisibilityFilter?.('all')}>全部</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setVisibilityFilter?.('public')}>公开</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setVisibilityFilter?.('private')}>私有</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {!currentAlbum && albums.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <FolderOpen className="h-4 w-4" />
                    {getAlbumLabel()}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuLabel>选择相册</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setAlbumFilter?.('all')}>全部相册</DropdownMenuItem>
                  {albums.map((album) => (
                    <DropdownMenuItem key={album.id} onClick={() => setAlbumFilter?.(album.id)}>
                      <span className="truncate">{album.name}</span>
                      <span className="ml-auto text-xs text-slate-400">{album.image_count}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowUpDown className="h-4 w-4" />
                  {getSortLabel()}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuLabel>排序方式</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSortBy?.('created_at')}>创建时间</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy?.('file_size')}>文件大小</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSortOrder?.('desc')}>降序</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOrder?.('asc')}>升序</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1 text-slate-500">
                <X className="h-3 w-3" />
                重置
              </Button>
            )}
          </div>
        )}

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {visibilityFilter !== 'all' && (
            <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-slate-200" onClick={() => setVisibilityFilter?.('all')}>
              {getVisibilityLabel()}
              <X className="h-3 w-3" />
            </Badge>
          )}
          {albumFilter !== 'all' && (
            <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-slate-200" onClick={() => setAlbumFilter?.('all')}>
              {getAlbumLabel()}
              <X className="h-3 w-3" />
            </Badge>
          )}
        </div>
      )}

      {refreshing && (
        <div className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>正在更新列表...</span>
        </div>
      )}

      {error && images.length > 0 && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          <span>刷新失败，当前显示上一次结果：{error}</span>
          <Button variant="outline" size="sm" onClick={onRetry}>
            重试
          </Button>
        </div>
      )}

      {/* 确认对话框 */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="确认批量删除"
        description={`确定要删除选中的 ${selectedImages.size} 张图片吗？此操作不可恢复。`}
        onConfirm={() => {
          onBatchDelete?.();
          setShowDeleteConfirm(false);
        }}
        confirmText="删除"
        cancelText="取消"
        variant="destructive"
      />

      <ConfirmDialog
        open={showRemoveConfirm}
        onOpenChange={setShowRemoveConfirm}
        title="确认从相册移除"
        description={`确定要从相册中移除选中的 ${selectedImages.size} 张图片吗？`}
        onConfirm={() => {
          onBatchRemoveFromAlbum?.();
          setShowRemoveConfirm(false);
        }}
        confirmText="移除"
        cancelText="取消"
      />

      {/* 等高瀑布流图片网格 */}
      <div className="flex flex-col" style={{ gap: GAP }}>
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="flex w-full"
            style={{
              ...row.rowStyle,
              gap: GAP,
            }}
          >
            {row.images.map((image, imageIndex) => (
              <JustifiedImageCard
                key={getImagePreviewKey(image)}
                image={image}
                style={row.imageStyles[imageIndex]}
                onDelete={onDelete}
                onAddToAlbum={onAddToAlbum}
                onPreview={handlePreview}
                selectable={isBatchMode}
                selected={selectedImages.has(image.identifier)}
                priority={rowIndex === 0}
                onSelect={onSelectImage}
              />
            ))}
          </div>
        ))}
      </div>

      <PhotoSlider
        images={previewImages}
        index={previewIndex}
        visible={previewVisible}
        onIndexChange={setPreviewIndex}
        onClose={() => setPreviewVisible(false)}
        maskOpacity={0.85}
        loop={true}
      />

      {/* 加载更多 */}
      <div ref={loaderRef} className="flex justify-center py-8">
        {loadMoreError && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          >
            <span>加载更多失败：{loadMoreError}</span>
            <Button variant="outline" size="sm" onClick={onRetryLoadMore}>
              重试加载更多
            </Button>
          </div>
        )}
        {loading && hasMore && (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>加载中...</span>
          </div>
        )}
        {!loadMoreError && !hasMore && images.length > 0 && (
          <p className="text-slate-400 text-sm">已加载全部 {images.length} 张图片</p>
        )}
      </div>
    </div>
  );
}
