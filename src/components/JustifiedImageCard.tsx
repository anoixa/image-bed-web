import { useState, memo } from 'react';
import { Link2, Trash2, FolderPlus } from 'lucide-react';
import type { Image } from '@/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/use-toast';

interface JustifiedImageCardProps {
  image: Image;
  style: React.CSSProperties;
  onDelete?: (identifier: string) => void;
  onAddToAlbum?: (identifier: string) => void;
  onPreview?: (identifier: string) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (identifier: string, selected: boolean) => void;
}

const JustifiedImageCard = memo(function JustifiedImageCard({
  image,
  style,
  onDelete,
  onAddToAlbum,
  onPreview,
  selectable = false,
  selected = false,
  onSelect,
}: JustifiedImageCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [loadedThumbnailUrl, setLoadedThumbnailUrl] = useState<string | null>(null);

  const thumbnailUrl = image.links?.thumbnail || image.thumbnail_url || image.url || '';
  const originalUrl = image.links?.original || image.url || '';
  const previewKey = image.identifier || String(image.id);
  const imageLoaded = loadedThumbnailUrl === thumbnailUrl;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!originalUrl) {
      toast({ title: '复制失败', description: '图片链接不可用', variant: 'destructive' });
      return;
    }
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(originalUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = originalUrl;
        textarea.style.position = 'fixed';
        textarea.style.left = '-999999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      toast({ title: '链接已复制', description: '图片链接已复制到剪贴板' });
    } catch {
      toast({ title: '复制失败', description: '请手动复制链接', variant: 'destructive' });
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onDelete) {
      onDelete(image.identifier);
    }
  };

  const handleSelect = (e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect?.(image.identifier, !selected);
  };

  const handleAddToAlbum = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onAddToAlbum?.(image.identifier);
  };

  const handlePreview = () => {
    if (!selectable && originalUrl) {
      onPreview?.(previewKey);
    }
  };

  const formatDate = (dateValue: string | number) => {
    const timestamp = typeof dateValue === 'number' ? dateValue * 1000 : dateValue;
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  return (
    <div
      className="relative rounded-lg overflow-hidden bg-slate-200 flex-shrink-0 group"
      style={style}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 批量选择复选框 */}
      {selectable && (
        <div className="absolute top-2 left-2 z-30" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelect?.(image.identifier, checked === true)}
            className={`w-5 h-5 border-2 ${selected ? 'bg-indigo-500 border-indigo-500' : 'bg-white/80 border-white/50'}`}
          />
        </div>
      )}

      {/* 图片加载骨架屏 */}
      {!imageLoaded && (
        <div className="absolute inset-0 bg-slate-200 animate-pulse" />
      )}

      {/* 图片 - 使用 key 防止重新加载 */}
      <div className="w-full h-full relative">
        <img
          key={`img-${image.identifier}`}
          src={thumbnailUrl}
          alt={image.filename}
          className={`w-full h-full object-cover transition-all duration-300 ${
            selectable ? 'cursor-pointer' : 'cursor-zoom-in'
          } ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          onClick={handlePreview}
          onLoad={() => setLoadedThumbnailUrl(thumbnailUrl)}
          loading="lazy"
          decoding="async"
          style={{ pointerEvents: selectable ? 'none' : 'auto' }}
        />
        
        {/* 批量模式下覆盖层处理选择 */}
        {selectable && (
          <div
            className="absolute inset-0 z-10 cursor-pointer"
            onClick={handleSelect}
          />
        )}
      </div>

      {/* 底部渐变遮罩层 - 始终显示，确保文字可读 */}
      <div className="absolute bottom-0 left-0 right-0 h-[30%] bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none" />

      {/* 信息显示（左下角） */}
      <div className="absolute bottom-0 left-0 right-0 p-3 pointer-events-none">
        <p className="text-white text-xs font-medium truncate drop-shadow-md" title={image.filename}>
          {image.filename}
        </p>
        <p className="text-white/70 text-[10px] mt-0.5">
          {formatDate(image.created_at)}
        </p>
      </div>

      {/* 悬停时的操作按钮层 - 批量模式下不显示 */}
      {!selectable && (
        <div
          className={`absolute inset-0 p-3 transition-opacity duration-300 z-10 pointer-events-none ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* 顶部：操作按钮 */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm border-0 pointer-events-auto"
                onClick={handleCopy}
                title="复制链接"
              >
                <Link2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm border-0 pointer-events-auto"
                onClick={handleAddToAlbum}
                title="添加到相册"
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 rounded-full bg-red-500/60 hover:bg-red-500/80 text-white backdrop-blur-sm border-0 pointer-events-auto"
              onClick={handleDelete}
              title="删除"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* 选中状态的半透明遮罩 */}
      {selected && selectable && (
        <div className="absolute inset-0 bg-indigo-500/10 pointer-events-none" />
      )}
    </div>
  );
});

export default JustifiedImageCard;
