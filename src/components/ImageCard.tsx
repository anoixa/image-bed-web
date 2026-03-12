import { useState } from 'react';
import { Link2, Trash2, Maximize2, FolderPlus, FolderMinus, Eye, EyeOff } from 'lucide-react';
import { PhotoView } from 'react-photo-view';
import type { Image } from '@/types';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import AlbumSelectModal from './AlbumSelectModal';
import { removeImageFromAlbum } from '@/api/albums';
import { updateImageVisibility } from '@/api/images';

interface ImageCardProps {
  image: Image;
  onDelete?: (identifier: string) => void;
  currentAlbumId?: number | null;
  onAlbumChange?: () => void;
  onVisibilityChange?: () => void;
}

export default function ImageCard({ image, onDelete, currentAlbumId, onAlbumChange, onVisibilityChange }: ImageCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isAlbumModalOpen, setIsAlbumModalOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);
  const [currentVisibility, setCurrentVisibility] = useState(image.visibility || 'public');

  // 使用缩略图链接（性能优化）
  const thumbnailUrl = image.links?.thumbnail || image.thumbnail_url || image.url || '';
  const originalUrl = image.links?.original || image.url || '';

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!originalUrl) {
      toast({
        title: '复制失败',
        description: '图片链接不可用',
        variant: 'destructive',
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(originalUrl);
      toast({
        title: '链接已复制',
        description: '图片链接已复制到剪贴板',
      });
    } catch {
      toast({
        title: '复制失败',
        description: '请手动复制链接',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onDelete) {
      onDelete(image.identifier);
    }
  };

  const handleAddToAlbum = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsAlbumModalOpen(true);
  };

  const handleRemoveFromAlbum = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!currentAlbumId) return;
    
    setIsRemoving(true);
    try {
      await removeImageFromAlbum(currentAlbumId, image.identifier);
      toast({
        title: '移除成功',
        description: '图片已从相册中移除',
      });
      onAlbumChange?.();
    } catch (error) {
      toast({
        title: '移除失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setIsRemoving(false);
    }
  };

  const handleToggleVisibility = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const newVisibility = currentVisibility === 'public' ? 'private' : 'public';
    const isPublic = newVisibility === 'public';
    setIsUpdatingVisibility(true);

    try {
      await updateImageVisibility(image.identifier, isPublic);
      setCurrentVisibility(newVisibility);
      toast({
        title: '设置成功',
        description: isPublic ? '图片已设为公开' : '图片已设为私有',
      });
      onVisibilityChange?.();
    } catch (error) {
      toast({
        title: '设置失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingVisibility(false);
    }
  };

  // 计算图片的宽高比，用于预留空间防止跳动
  const aspectRatio = image.width && image.height
    ? (image.height / image.width) * 100
    : 75; // 默认4:3比例

  return (
    <div
      className="relative break-inside-avoid mb-4 rounded-xl overflow-hidden bg-slate-200 cursor-pointer shadow-sm hover:shadow-lg transition-all duration-300"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ contain: 'layout style paint' }}
    >
      {/* 骨架屏占位 - 使用padding-bottom撑开高度 */}
      <div
        className="relative w-full"
        style={{ paddingBottom: `${aspectRatio}%` }}
      >
        {!imageLoaded && (
          <div className="absolute inset-0 bg-slate-200 animate-pulse" />
        )}
        <PhotoView src={originalUrl}>
          <img
            src={thumbnailUrl}
            alt={image.filename}
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ease-out cursor-zoom-in ${
              imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
            }`}
            onLoad={() => setImageLoaded(true)}
            loading="lazy"
            decoding="async"
          />
        </PhotoView>

        {/* Hover Overlay - 平滑淡入遮罩层 */}
        <div
          className={`absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/60 to-transparent flex flex-col justify-between p-4 transition-opacity duration-300 pointer-events-none ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Top: Filename + Zoom hint */}
          <div className="flex items-start justify-between pointer-events-auto">
            <p 
              className="text-white text-sm font-medium truncate drop-shadow-md flex-1 mr-2" 
              title={image.filename}
            >
              {image.filename}
            </p>
            <Maximize2 className="w-4 h-4 text-white/70 flex-shrink-0" />
          </div>

          {/* Bottom: Action Buttons */}
          <div className="flex items-center justify-center gap-2 pointer-events-auto">
            <Button
              variant="ghost"
              size="icon"
              className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-sm border-0 transition-all duration-200 hover:scale-110"
              onClick={handleCopy}
              title="复制链接"
            >
              <Link2 className="h-4 w-4" />
            </Button>

            {/* 可见性切换按钮 */}
            <Button
              variant="ghost"
              size="icon"
              className={`w-9 h-9 rounded-full backdrop-blur-sm border-0 transition-all duration-200 hover:scale-110 ${
                currentVisibility === 'public'
                  ? 'bg-emerald-500/60 hover:bg-emerald-500/80 text-white'
                  : 'bg-slate-500/60 hover:bg-slate-500/80 text-white'
              }`}
              onClick={handleToggleVisibility}
              disabled={isUpdatingVisibility}
              title={currentVisibility === 'public' ? '当前公开，点击设为私有' : '当前私有，点击设为公开'}
            >
              {currentVisibility === 'public' ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </Button>
            
            {/* 添加到相册按钮 */}
            {!currentAlbumId && (
              <Button
                variant="ghost"
                size="icon"
                className="w-9 h-9 rounded-full bg-indigo-500/60 hover:bg-indigo-500/80 text-white backdrop-blur-sm border-0 transition-all duration-200 hover:scale-110"
                onClick={handleAddToAlbum}
                title="添加到相册"
              >
                <FolderPlus className="h-4 w-4" />
              </Button>
            )}
            
            {/* 从相册移除按钮 */}
            {currentAlbumId && (
              <Button
                variant="ghost"
                size="icon"
                className="w-9 h-9 rounded-full bg-amber-500/60 hover:bg-amber-500/80 text-white backdrop-blur-sm border-0 transition-all duration-200 hover:scale-110"
                onClick={handleRemoveFromAlbum}
                disabled={isRemoving}
                title="从相册移除"
              >
                <FolderMinus className="h-4 w-4" />
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="icon"
              className="w-9 h-9 rounded-full bg-red-500/60 hover:bg-red-500/80 text-white backdrop-blur-sm border-0 transition-all duration-200 hover:scale-110"
              onClick={handleDelete}
              title="删除"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* 相册选择弹窗 */}
      <AlbumSelectModal
        open={isAlbumModalOpen}
        onOpenChange={setIsAlbumModalOpen}
        imageIdentifiers={[image.identifier]}
        currentAlbumId={currentAlbumId}
        onSuccess={onAlbumChange}
      />
    </div>
  );
}
