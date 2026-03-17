import { useState, useMemo } from 'react';
import { Loader2, ImageIcon, FolderOpen, Filter, X, CheckSquare, Square, FolderMinus, FolderPlus, Trash2, ArrowUpDown, Eye, EyeOff } from 'lucide-react';
import { PhotoProvider } from 'react-photo-view';
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
import { Link } from 'react-router-dom';
import JustifiedImageCard from './JustifiedImageCard';
import ConfirmDialog from './ConfirmDialog';

interface JustifiedGalleryProps {
  images: Image[];
  loading: boolean;
  hasMore: boolean;
  error: string | null;
  currentAlbum?: Album | null;
  albums?: Album[];
  title?: string;
  subtitle?: string;
  visibilityFilter?: 'all' | 'public' | 'private';
  albumFilter?: number | 'all';
  sortBy?: 'created_at' | 'file_size';
  sortOrder?: 'asc' | 'desc';
  isBatchMode?: boolean;
  selectedImages?: Set<string>;
  onLoadMore?: () => void;
  onDelete?: (identifier: string) => void;
  onBatchDelete?: () => void;
  onBatchRemoveFromAlbum?: () => void;
  onSelectImage?: (identifier: string, selected: boolean) => void;
  onSelectAll?: () => void;
  onExitBatchMode?: () => void;
  onVisibilityChange?: () => void;
  onAlbumChange?: () => void;
  setVisibilityFilter?: (filter: 'all' | 'public' | 'private') => void;
  setAlbumFilter?: (filter: number | 'all') => void;
  setSortBy?: (sort: 'created_at' | 'file_size') => void;
  setSortOrder?: (order: 'asc' | 'desc') => void;
  setIsBatchMode?: (mode: boolean) => void;
  effectiveAlbumId?: number | null;
  loaderRef?: React.RefObject<HTMLDivElement | null>;
}

// 行高常量
const ROW_HEIGHT = 200;
const GAP = 10;

// 将图片分组到行中
function groupImagesIntoRows(images: Image[], containerWidth: number): Image[][] {
  if (!containerWidth || images.length === 0) return [];

  const rows: Image[][] = [];
  let currentRow: Image[] = [];
  let currentRowWidth = 0;

  for (const image of images) {
    const aspectRatio = (image.width || 1) / (image.height || 1);
    const imageWidth = ROW_HEIGHT * aspectRatio;

    // 如果当前行加上这张图片会超出容器宽度（且当前行已有图片）
    const wouldExceed = currentRowWidth + imageWidth + (currentRow.length > 0 ? GAP : 0) > containerWidth;
    
    if (wouldExceed && currentRow.length > 0) {
      // 保存当前行，开始新行
      rows.push(currentRow);
      currentRow = [image];
      currentRowWidth = imageWidth;
    } else {
      // 添加到当前行
      currentRow.push(image);
      currentRowWidth += imageWidth + (currentRow.length > 1 ? GAP : 0);
    }
  }

  // 添加最后一行
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  return rows;
}

export default function JustifiedGallery({
  images,
  loading,
  hasMore,
  error,
  currentAlbum,
  albums = [],
  title,
  subtitle,
  visibilityFilter = 'all',
  albumFilter = 'all',
  sortBy = 'created_at',
  sortOrder = 'desc',
  isBatchMode = false,
  selectedImages = new Set(),
  onLoadMore,
  onDelete,
  onBatchDelete,
  onBatchRemoveFromAlbum,
  onSelectImage,
  onSelectAll,
  onExitBatchMode,
  onVisibilityChange,
  onAlbumChange,
  setVisibilityFilter,
  setAlbumFilter,
  setSortBy,
  setSortOrder,
  setIsBatchMode,
  effectiveAlbumId,
  loaderRef,
}: JustifiedGalleryProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isWidthReady, setIsWidthReady] = useState(false);

  // 使用 ResizeObserver 获取容器宽度
  const containerRef = (node: HTMLDivElement | null) => {
    if (!node) return;
    
    const updateWidth = () => {
      const width = node.clientWidth;
      if (width > 0) {
        setContainerWidth(width);
        setIsWidthReady(true);
      }
    };
    
    updateWidth();
    
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    
    return () => observer.disconnect();
  };

  // 将图片分组到行
  const rows = useMemo(() => {
    return groupImagesIntoRows(images, containerWidth);
  }, [images, containerWidth]);

  // 计算每行的缩放比例（让行填满容器宽度）
  const getRowStyle = (row: Image[]): React.CSSProperties => {
    if (row.length === 0) return {};

    // 计算行内图片原始总宽度
    const totalOriginalWidth = row.reduce((sum, img) => {
      const aspectRatio = (img.width || 1) / (img.height || 1);
      return sum + ROW_HEIGHT * aspectRatio;
    }, 0);

    // 计算总 gap
    const totalGap = (row.length - 1) * GAP;

    // 计算需要的缩放比例
    const scale = (containerWidth - totalGap) / totalOriginalWidth;

    // 如果只有一张图片且缩放后太宽，限制最大宽度
    if (row.length === 1 && scale > 3) {
      return { height: ROW_HEIGHT, justifyContent: 'flex-start' };
    }

    return { height: ROW_HEIGHT };
  };

  // 计算单个图片的样式
  const getImageStyle = (image: Image, row: Image[]): React.CSSProperties => {
    const aspectRatio = (image.width || 1) / (image.height || 1);
    const originalWidth = ROW_HEIGHT * aspectRatio;

    // 计算行缩放比例
    const totalOriginalWidth = row.reduce((sum, img) => {
      const ar = (img.width || 1) / (img.height || 1);
      return sum + ROW_HEIGHT * ar;
    }, 0);
    const totalGap = (row.length - 1) * GAP;
    const scale = (containerWidth - totalGap) / totalOriginalWidth;

    // 最后一行且填不满时，保持原始比例
    const isLastRow = row === rows[rows.length - 1];
    const rowTotalWidth = totalOriginalWidth * scale + totalGap;
    
    if (isLastRow && rowTotalWidth < containerWidth * 0.8) {
      return {
        height: ROW_HEIGHT,
        width: originalWidth,
        flexShrink: 0,
      };
    }

    return {
      height: ROW_HEIGHT,
      flexGrow: originalWidth * scale,
      flexBasis: 0,
    };
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

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <ImageIcon className="w-10 h-10 text-slate-400" />
        </div>
        <h3 className="text-lg font-medium text-slate-800 mb-2">加载失败</h3>
        <p className="text-slate-500 mb-6">{error}</p>
        <Button onClick={() => window.location.reload()}>重新加载</Button>
      </div>
    );
  }

  // 宽度未测量完成时显示 loading
  if (!isWidthReady) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
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
      <PhotoProvider maskOpacity={0.85} loop={true}>
        <div className="flex flex-col" style={{ gap: GAP }}>
          {rows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className="flex w-full"
              style={{
                ...getRowStyle(row),
                gap: GAP,
              }}
            >
              {row.map((image) => (
                <JustifiedImageCard
                  key={image.id}
                  image={image}
                  style={getImageStyle(image, row)}
                  onDelete={onDelete}
                  selectable={isBatchMode}
                  selected={selectedImages.has(image.identifier)}
                  onSelect={onSelectImage}
                />
              ))}
            </div>
          ))}
        </div>
      </PhotoProvider>

      {/* 加载更多 */}
      <div ref={loaderRef} className="flex justify-center py-8">
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
