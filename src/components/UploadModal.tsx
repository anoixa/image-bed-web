import { useState, useCallback } from 'react';
import { UploadCloud, X, FileImage, Loader2, CheckCircle2, AlertCircle, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { uploadImage } from '@/api/images';
import { toast } from '@/components/ui/use-toast';
import type { UploadImageResponse, Image } from '@/types';

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (image: Image) => void;
}

interface UploadFile {
  file: File;
  preview: string;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
  result?: UploadImageResponse;
}

interface LinkFormat {
  key: string;
  label: string;
  value: string;
}

export default function UploadModal({ open, onOpenChange, onSuccess }: UploadModalProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  const [currentLinks, setCurrentLinks] = useState<LinkFormat[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const handleFileSelect = useCallback((fileList: FileList | null) => {
    if (!fileList) return;

    const imageFiles = Array.from(fileList).filter((file) => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      toast({
        title: '请选择图片文件',
        description: '仅支持 JPG、PNG、GIF、WebP 等图片格式',
        variant: 'destructive',
      });
      return;
    }

    const newFiles: UploadFile[] = imageFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      id: generateId(),
      progress: 0,
      status: 'pending',
    }));

    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  const updateFileStatus = (id: string, updates: Partial<UploadFile>) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const simulateProgress = (id: string) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 90) {
        progress = 90;
        clearInterval(interval);
      }
      updateFileStatus(id, { progress });
    }, 200);
    return interval;
  };

  const generateLinkFormats = (image: UploadImageResponse): LinkFormat[] => {
    const url = image.links?.url || '';
    
    const formats: LinkFormat[] = [
      { key: 'url', label: 'URL', value: url },
      { key: 'html', label: 'HTML', value: image.links?.html || (url ? `<img src="${url}" alt="${image.filename || 'image'}" />` : '') },
      { key: 'markdown', label: 'Markdown', value: image.links?.markdown || (url ? `![${image.filename || 'image'}](${url})` : '') },
      { key: 'bbcode', label: 'BBCode', value: image.links?.bbcode || (url ? `[img]${url}[/img]` : '') },
    ];
    return formats;
  };

  const handleUpload = async () => {
    if (files.length === 0 || files.every((f) => f.status === 'success')) return;

    setIsUploading(true);
    const pendingFiles = files.filter((f) => f.status !== 'success');
    const uploadedImages: UploadImageResponse[] = [];

    for (const fileItem of pendingFiles) {
      updateFileStatus(fileItem.id, { status: 'uploading', progress: 10 });
      const progressInterval = simulateProgress(fileItem.id);

      try {
        const image = await uploadImage(fileItem.file, true);
        clearInterval(progressInterval);
        updateFileStatus(fileItem.id, {
          status: 'success',
          progress: 100,
          result: image,
        });
        uploadedImages.push(image);
        onSuccess?.({
          identifier: image.identifier,
          filename: image.filename,
          file_size: image.file_size,
          url: image.links.url,
        } as Image);
      } catch (error) {
        clearInterval(progressInterval);
        const errorMsg = error instanceof Error ? error.message : '上传失败';
        updateFileStatus(fileItem.id, {
          status: 'error',
          progress: 0,
          errorMessage: errorMsg,
        });
        toast({
          title: '上传失败',
          description: errorMsg,
          variant: 'destructive',
        });
      }
    }

    setIsUploading(false);

    if (uploadedImages.length > 0) {
      const lastImage = uploadedImages[uploadedImages.length - 1];
      const links = generateLinkFormats(lastImage);
      setCurrentLinks(links);
      
      // 自动复制 URL
      const urlLink = links.find((l) => l.key === 'url');
      if (urlLink) {
        try {
          await navigator.clipboard.writeText(urlLink.value);
          toast({
            title: '上传成功',
            description: '链接已自动复制到剪贴板',
          });
        } catch {
          toast({
            title: '上传成功',
            description: '图片已上传，请手动复制链接',
          });
        }
      }
      
      setShowLinks(true);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      files.forEach((f) => URL.revokeObjectURL(f.preview));
      setFiles([]);
      setShowLinks(false);
      setCurrentLinks([]);
      onOpenChange(false);
    }
  };

  const copyToClipboard = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast({
        title: '复制失败',
        description: '请手动复制',
        variant: 'destructive',
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  // 获取最后一个成功的图片
  const lastSuccessFile = [...files].reverse().find((f: UploadFile) => f.status === 'success');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg overflow-hidden">
        <DialogHeader>
          <DialogTitle>{showLinks ? '上传成功' : '上传图片'}</DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {!showLinks ? (
            <motion.div
              key="upload"
              initial={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* Drop Zone */}
              <motion.div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                animate={{
                  scale: isDragOver ? 1.02 : 1,
                  borderColor: isDragOver ? 'rgb(99 102 241)' : 'rgb(203 213 225)',
                  backgroundColor: isDragOver ? 'rgb(238 242 255)' : 'transparent',
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="border-2 border-dashed rounded-xl p-8 text-center"
              >
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer block">
                  <motion.div
                    animate={{ y: isDragOver ? -5 : 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  >
                    <UploadCloud
                      className={`mx-auto h-12 w-12 mb-4 transition-colors ${
                        isDragOver ? 'text-indigo-500' : 'text-slate-400'
                      }`}
                    />
                  </motion.div>
                  <p className="text-sm text-slate-600 mb-1">
                    拖拽图片到此处，或 <span className="text-indigo-600 font-medium">点击选择</span>
                  </p>
                  <p className="text-xs text-slate-400">支持 JPG、PNG、GIF、WebP 等格式，单文件最大 10MB</p>
                </label>
              </motion.div>

              {/* File List */}
              <AnimatePresence>
                {files.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3 max-h-64 overflow-y-auto"
                  >
                    {files.map((fileItem) => (
                      <motion.div
                        key={fileItem.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className={`flex flex-col gap-2 p-3 rounded-lg ${
                          fileItem.status === 'error'
                            ? 'bg-red-50 border border-red-200'
                            : fileItem.status === 'success'
                            ? 'bg-green-50 border border-green-200'
                            : 'bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-200 shrink-0">
                            <img
                              src={fileItem.preview}
                              alt={fileItem.file.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">
                              {fileItem.file.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatFileSize(fileItem.file.size)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            {fileItem.status === 'success' && (
                              <span className="text-green-600">
                                <CheckCircle2 className="h-5 w-5" />
                              </span>
                            )}
                            {fileItem.status !== 'uploading' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-red-500"
                                onClick={() => removeFile(fileItem.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Progress Bar */}
                        {fileItem.status === 'uploading' && (
                          <div className="space-y-1">
                            <Progress value={fileItem.progress} className="h-1.5" />
                            <p className="text-xs text-slate-500 text-right">{Math.round(fileItem.progress)}%</p>
                          </div>
                        )}

                        {/* Error Message */}
                        {fileItem.status === 'error' && (
                          <div className="flex items-center gap-1.5 text-xs text-red-600">
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span>{fileItem.errorMessage || '上传失败'}</span>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={handleClose} disabled={isUploading}>
                  关闭
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={files.length === 0 || isUploading || files.every((f) => f.status === 'success')}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      上传中...
                    </>
                  ) : (
                    <>
                      <FileImage className="mr-2 h-4 w-4" />
                      开始上传
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="links"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* Success Icon & Preview */}
              <div className="flex flex-col items-center gap-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                  className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center"
                >
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </motion.div>
                {lastSuccessFile && (
                  <div className="w-32 h-32 rounded-lg overflow-hidden bg-slate-100 border">
                    <img
                      src={lastSuccessFile.result?.links?.thumbnail || lastSuccessFile.preview}
                      alt={lastSuccessFile.file.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
              </div>

              {/* Link Selector Tabs */}
              <Tabs defaultValue="url" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  {currentLinks.map((link) => (
                    <TabsTrigger key={link.key} value={link.key}>
                      {link.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {currentLinks.map((link) => (
                  <TabsContent key={link.key} value={link.key}>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={link.value}
                        className="flex-1 font-mono text-sm bg-slate-50"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(link.value, link.key)}
                        className="shrink-0"
                      >
                        {copiedKey === link.key ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowLinks(false);
                    files.forEach((f) => URL.revokeObjectURL(f.preview));
                    setFiles([]);
                    onOpenChange(false);
                  }}
                >
                  完成
                </Button>
                <Button
                  onClick={() => {
                    setShowLinks(false);
                    files.forEach((f) => URL.revokeObjectURL(f.preview));
                    setFiles([]);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <FileImage className="mr-2 h-4 w-4" />
                  继续上传
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
