import { useState, useEffect } from 'react';
import { X, FolderPlus, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { fetchAlbums, addImagesToAlbum } from '@/api/albums';
import type { Album } from '@/types';
import { toast } from '@/components/ui/use-toast';

interface AlbumSelectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageIdentifiers: string[];
  currentAlbumId?: number | null;
  onSuccess?: () => void;
}

export default function AlbumSelectModal({
  open,
  onOpenChange,
  imageIdentifiers,
  currentAlbumId,
  onSuccess,
}: AlbumSelectModalProps) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      loadAlbums();
      setSelectedAlbumId(null);
    }
  }, [open]);

  const loadAlbums = async () => {
    setLoading(true);
    try {
      const data = await fetchAlbums(1, 100);
      setAlbums(data);
    } catch (error) {
      toast({
        title: '加载失败',
        description: '无法加载相册列表',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddToAlbum = async () => {
    if (!selectedAlbumId || imageIdentifiers.length === 0) {
      console.log('[AlbumSelectModal] Invalid params:', { selectedAlbumId, imageIdentifiers });
      return;
    }

    // 过滤掉 undefined 或空值（id 可能是数字或字符串）
    const validIdentifiers = imageIdentifiers.filter(id => {
      if (id === null || id === undefined) return false;
      if (typeof id === 'string') return id.trim() !== '';
      if (typeof id === 'number') return id > 0;
      return true;
    });
    console.log('[AlbumSelectModal] Adding to album:', { selectedAlbumId, validIdentifiers, original: imageIdentifiers });
    
    if (validIdentifiers.length === 0) {
      toast({
        title: '添加失败',
        description: '图片标识符无效',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      await addImagesToAlbum(selectedAlbumId, validIdentifiers.map(id => parseInt(id, 10)).filter(id => !isNaN(id)));
      toast({
        title: '添加成功',
        description: `已成功添加 ${imageIdentifiers.length} 张图片到相册`,
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: '添加失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 过滤掉当前相册（如果已经在某个相册中）
  const availableAlbums = currentAlbumId
    ? albums.filter((a) => a.id !== currentAlbumId)
    : albums;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="w-5 h-5" />
            添加到相册
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : availableAlbums.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <FolderPlus className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>暂无可用的相册</p>
              <p className="text-sm mt-1">请先创建一个相册</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {availableAlbums.map((album) => (
                <button
                  key={album.id}
                  onClick={() => setSelectedAlbumId(album.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                    selectedAlbumId === album.id
                      ? 'bg-indigo-50 border-2 border-indigo-500'
                      : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                    <FolderPlus className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{album.name}</p>
                    <p className="text-sm text-slate-500">
                      {album.image_count || 0} 张图片
                    </p>
                  </div>
                  {selectedAlbumId === album.id && (
                    <Check className="w-5 h-5 text-indigo-600" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button
            onClick={handleAddToAlbum}
            disabled={!selectedAlbumId || submitting || availableAlbums.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                添加中...
              </>
            ) : (
              `添加到相册 (${imageIdentifiers.length})`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
