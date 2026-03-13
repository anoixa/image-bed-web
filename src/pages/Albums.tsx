import { useState, useEffect, useCallback } from 'react';
import { Folder, Plus, Trash2, Edit2, X, Check, Loader2, Image, ExternalLink } from 'lucide-react';

// 相册封面组件
function AlbumCover({ coverUrl, name }: { coverUrl?: string; name: string }) {
  const [hasError, setHasError] = useState(false);
  const hasCover = coverUrl && coverUrl.trim() !== '';

  if (!hasCover || hasError) {
    return <Folder className="w-6 h-6 text-indigo-600" />;
  }

  return (
    <img
      src={coverUrl}
      alt=""
      className="w-full h-full object-cover"
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
}
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { fetchAlbums, createAlbum, updateAlbum, deleteAlbum } from '@/api/albums';
import type { Album } from '@/types';
import { toast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';

export default function Albums() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [newAlbumDesc, setNewAlbumDesc] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const loadAlbums = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAlbums();
      setAlbums(data);
    } catch (error) {
      toast({
        title: '加载失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlbums();
  }, [loadAlbums]);

  const handleCreate = async () => {
    if (!newAlbumName.trim()) {
      toast({
        title: '请输入相册名称',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createAlbum(newAlbumName, newAlbumDesc);
      toast({
        title: '创建成功',
        description: '相册已创建',
      });
      setNewAlbumName('');
      setNewAlbumDesc('');
      setIsCreateOpen(false);
      loadAlbums();
    } catch (error) {
      toast({
        title: '创建失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  const handleUpdate = async (id: number) => {
    if (!editName.trim()) {
      toast({
        title: '请输入相册名称',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updateAlbum(id, editName, editDesc);
      toast({
        title: '更新成功',
        description: '相册已更新',
      });
      setEditingId(null);
      loadAlbums();
    } catch (error) {
      toast({
        title: '更新失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个相册吗？')) return;

    try {
      await deleteAlbum(id);
      toast({
        title: '删除成功',
        description: '相册已删除',
      });
      loadAlbums();
    } catch (error) {
      toast({
        title: '删除失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  const startEditing = (album: Album) => {
    setEditingId(album.id);
    setEditName(album.name);
    setEditDesc(album.description);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">相册管理</h1>
          <p className="text-slate-500 mt-1">创建和管理您的图片相册</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="mr-2 h-4 w-4" />
              新建相册
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新建相册</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">相册名称</label>
                <Input
                  value={newAlbumName}
                  onChange={(e) => setNewAlbumName(e.target.value)}
                  placeholder="请输入相册名称"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">描述（可选）</label>
                <Input
                  value={newAlbumDesc}
                  onChange={(e) => setNewAlbumDesc(e.target.value)}
                  placeholder="请输入相册描述"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleCreate} className="bg-indigo-600 hover:bg-indigo-700">
                  创建
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {albums.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <Folder className="w-12 h-12 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-800 mb-2">暂无相册</h3>
          <p className="text-slate-500 mb-6">创建您的第一个相册来整理图片</p>
          <Button onClick={() => setIsCreateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="mr-2 h-4 w-4" />
            新建相册
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {albums.map((album) => (
            <Card key={album.id} className="overflow-hidden">
              <CardContent className="p-6">
                {editingId === album.id ? (
                  <div className="space-y-4">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="相册名称"
                    />
                    <Input
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="相册描述"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleUpdate(album.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* 相册卡片内容 - 可点击跳转 */}
                    <Link 
                      to={`/?album_id=${album.id}`}
                      className="block cursor-pointer group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center overflow-hidden">
                            <AlbumCover coverUrl={album.cover_url} name={album.name} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
                              {album.name}
                            </h3>
                            <p className="text-sm text-slate-500 flex items-center gap-1">
                              <Image className="w-3 h-3" />
                              {album.image_count} 张图片
                            </p>
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      {album.description && (
                        <p className="text-sm text-slate-500 mt-3 line-clamp-2">
                          {album.description}
                        </p>
                      )}
                    </Link>

                    {/* 操作按钮 */}
                    <div className="flex justify-end gap-1 pt-2 border-t border-slate-100">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-slate-600"
                        onClick={() => startEditing(album)}
                      >
                        <Edit2 className="h-4 w-4 mr-1" />
                        编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-red-500 hover:text-red-600"
                        onClick={() => handleDelete(album.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        删除
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
