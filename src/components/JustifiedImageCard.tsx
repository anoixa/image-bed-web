import { useState } from 'react';
import { PhotoView } from 'react-photo-view';
import { Link2, Trash2, FolderPlus, Check } from 'lucide-react';
import type { Image } from '@/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/use-toast';

interface JustifiedImageCardProps {
  image: Image;
  style: React.CSSProperties;
  onDelete?: (identifier: string) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (identifier: string, selected: boolean) => void;
}

export default function JustifiedImageCard({
  image,
  style,
  onDelete,
  selectable = false,
  selected = false,
  onSelect,
}: JustifiedImageCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const thumbnailUrl = image.links?.thumbnail || image.thumbnail_url || image.url || '';
  const originalUrl = image.links?.original || image.url || '';

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
        <div
          className="absolute top-2 left-2 z-20"
          onClick={handleSelect}
        >
          <Checkbox
            checked={selected}
            className={`w-5 h-5 border-2 ${selected ? 'bg-indigo-500 border-indigo-500' : 'bg-white/80 border-white/50'}`}
          />
        </div>
      )}

      {/* 图片加载骨架屏 */}
      {!imageLoaded && (
        <div className="absolute inset-0 bg-slate-200 animate-pulse" />
      )}

      {/* 图片 - 使用 PhotoView 实现点击查看大图 */}
      <PhotoView src={originalUrl}>
        <img
          src={thumbnailUrl}
          alt={image.filename}
          className={`w-full h-full object-cover transition-all duration-300 cursor-zoom-in ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setImageLoaded(true)}
          loading="lazy"
          decoding="async"
        />
      </PhotoView>

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

      {/* 悬停时的操作按钮层 */}
      <div
        className={`absolute inset-0 p-3 transition-opacity duration-300 ${
          isHovered && !selectable ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* 顶部：操作按钮 */}
        <div className="flex items-start justify-between pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm border-0"
              onClick={handleCopy}
              title="复制链接"
            >
              <Link2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm border-0"
              title="添加到相册"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 rounded-full bg-red-500/60 hover:bg-red-500/80 text-white backdrop-blur-sm border-0"
            onClick={handleDelete}
            title="删除"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* 选中状态的勾选标记 */}
      {selected && (
        <div className="absolute inset-0 bg-indigo-500/20 pointer-events-none">
          <div className="absolute top-2 right-2 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center">
            <Check className="w-4 h-4 text-white" />
          </div>
        </div>
      )}
    </div>
  );
}
