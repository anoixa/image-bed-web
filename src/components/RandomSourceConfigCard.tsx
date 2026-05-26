import { useState, useEffect, useCallback } from 'react';
import { Loader2, ImageIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { fetchRandomSourceAlbum, updateRandomSourceAlbum } from '@/api/images';
import type { Album, RandomSourceAlbumConfig, RandomSourceConfigMode } from '@/types';
import { toast } from '@/components/ui/use-toast';

interface RandomSourceConfigCardProps {
  albums: Album[];
}

export default function RandomSourceConfigCard({ albums }: RandomSourceConfigCardProps) {
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<RandomSourceConfigMode>('album');
  const [selectedAlbumId, setSelectedAlbumId] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const config = await fetchRandomSourceAlbum();
      setEnabled(config.enabled);
      if (config.album_id === 0) {
        setMode('all');
        setSelectedAlbumId(0);
      } else {
        setMode('album');
        setSelectedAlbumId(config.album_id);
      }
    } catch (error) {
      toast({
        title: '加载随机图源配置失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const saveConfig = async (
    newEnabled: boolean,
    newMode: RandomSourceConfigMode,
    newAlbumId: number
  ) => {
    setIsSaving(true);
    try {
      const payload: RandomSourceAlbumConfig =
        newMode === 'all'
          ? { enabled: newEnabled, album_id: 0, include_all_public: true }
          : { enabled: newEnabled, album_id: newAlbumId, include_all_public: false };
      await updateRandomSourceAlbum(payload);
      toast({
        title: '保存成功',
        description: '随机图源配置已更新',
      });
    } catch (error) {
      toast({
        title: '保存失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          加载中...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          随机图源配置
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enabled toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <label className="text-sm font-medium">启用公共随机图 API</label>
            <p className="text-xs text-slate-500">
              关闭后，/images/random 接口将返回 403
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(checked) => {
              setEnabled(checked);
              saveConfig(checked, mode, selectedAlbumId);
            }}
            disabled={isSaving}
          />
        </div>

        {enabled && (
          <>
            <div className="border-t border-slate-200" />

            {/* Mode selector */}
            <div className="space-y-3">
              <label className="text-sm font-medium">图源模式</label>
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    id="mode-album"
                    name="random-source-mode"
                    value="album"
                    checked={mode === 'album'}
                    onChange={(e) => {
                      const newMode = e.target.value as RandomSourceConfigMode;
                      setMode(newMode);
                      let newAlbumId = selectedAlbumId;
                      if (newMode === 'album' && newAlbumId === 0 && albums.length > 0) {
                        newAlbumId = albums[0].id;
                        setSelectedAlbumId(newAlbumId);
                      }
                      saveConfig(enabled, newMode, newAlbumId);
                    }}
                    disabled={isSaving}
                    className="mt-1"
                  />
                  <div>
                    <label htmlFor="mode-album" className="text-sm font-medium cursor-pointer">
                      指定相册
                    </label>
                    <p className="text-xs text-slate-500">
                      仅从选定的相册中随机选取图片
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    id="mode-all"
                    name="random-source-mode"
                    value="all"
                    checked={mode === 'all'}
                    onChange={(e) => {
                      const newMode = e.target.value as RandomSourceConfigMode;
                      setMode(newMode);
                      saveConfig(enabled, newMode, selectedAlbumId);
                    }}
                    disabled={isSaving}
                    className="mt-1"
                  />
                  <div>
                    <label htmlFor="mode-all" className="text-sm font-medium cursor-pointer">
                      全部公开图片
                    </label>
                    <p className="text-xs text-slate-500">
                      从所有公开图片中随机选取
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Album select */}
            {mode === 'album' && (
              <>
                <div className="border-t border-slate-200" />
                <div className="space-y-2">
                  <label className="text-sm font-medium">选择相册</label>
                  <select
                    value={selectedAlbumId}
                    onChange={(e) => {
                      const newAlbumId = parseInt(e.target.value);
                      setSelectedAlbumId(newAlbumId);
                      saveConfig(enabled, mode, newAlbumId);
                    }}
                    disabled={isSaving}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value={0}>请选择相册...</option>
                    {albums.map((album) => (
                      <option key={album.id} value={album.id}>
                        {album.name} ({album.image_count} 张图片)
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </>
        )}

        {isSaving && (
          <div className="flex items-center text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            保存中...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
