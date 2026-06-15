import { useState, useCallback } from 'react';
import { UploadCloud, X, FileImage, Loader2, CheckCircle2, AlertCircle, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { uploadImageWithProgress, uploadImagesWithProgress } from '@/api/images';
import { toast } from '@/components/ui/use-toast';
import type { UploadImageResponse, Image } from '@/types';
import { reconcileBatchUploadResults } from '@/lib/uploadResults';

// 批量链接展示组件
interface BatchLinksContentProps {
  images: UploadImageResponse[];
  format: 'url' | 'html' | 'markdown' | 'bbcode';
  onCopyAll: () => void;
}

function BatchLinksContent({ images, format, onCopyAll }: BatchLinksContentProps) {
  const getLinkValue = (image: UploadImageResponse) => {
    return getImageLinkValue(image, format);
  };

  const allLinksText = images.map(getLinkValue).join('\n');

  return (
    <div className="space-y-3 flex flex-col">
      <div className="flex justify-between items-center">
        <span className="text-sm text-slate-500">共 {images.length} 张图片</span>
        <Button variant="outline" size="sm" onClick={onCopyAll}>
          <Copy className="mr-1 h-3 w-3" />
          复制全部
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto rounded-md border bg-slate-50 p-3">
        <div className="space-y-2">
          {images.map((image, index) => (
            <div key={image.identifier} className="flex items-center gap-2 text-sm">
              <span className="text-slate-400 w-6 shrink-0">{index + 1}.</span>
              <code className="flex-1 truncate font-mono text-slate-700 bg-white px-2 py-1 rounded border">
                {getLinkValue(image)}
              </code>
            </div>
          ))}
        </div>
      </div>
      <textarea
        readOnly
        value={allLinksText}
        className="w-full h-20 font-mono text-xs bg-slate-100 border rounded-md p-2 resize-none shrink-0"
      />
    </div>
  );
}

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (image: Image) => void;
  storageId?: string;
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

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES_PER_BATCH = 30;
const THUMBNAIL_CONCURRENCY = 3;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
]);

const generateUploadId = () => Math.random().toString(36).substring(2, 9);

function escapeHtmlAttribute(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });
}

function escapeMarkdownText(value: string): string {
  return value.replace(/([\\[\]!])/g, '\\$1');
}

function escapeMarkdownUrl(value: string): string {
  return value.replace(/([\\()])/g, '\\$1');
}

function getSafeImageUrl(value?: string): string {
  const url = value?.trim();
  if (!url) return '';

  try {
    const parsed = new URL(url, window.location.origin);
    if (['http:', 'https:', 'blob:'].includes(parsed.protocol)) {
      return url;
    }
  } catch {
    return '';
  }

  return '';
}

function getImageLinkValue(image: UploadImageResponse, format: 'url' | 'html' | 'markdown' | 'bbcode'): string {
  const url = getSafeImageUrl(image.links?.url || image.links?.original);
  const filename = image.filename || 'image';

  if (!url) return '';

  switch (format) {
    case 'html':
      return `<img src="${escapeHtmlAttribute(url)}" alt="${escapeHtmlAttribute(filename)}" />`;
    case 'markdown':
      return `![${escapeMarkdownText(filename)}](${escapeMarkdownUrl(url)})`;
    case 'bbcode':
      return `[img]${url.replace(/\[/g, '%5B').replace(/\]/g, '%5D')}[/img]`;
    case 'url':
    default:
      return url;
  }
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

export default function UploadModal({ open, onOpenChange, onSuccess, storageId }: UploadModalProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  const [currentLinks, setCurrentLinks] = useState<LinkFormat[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [allUploadedImages, setAllUploadedImages] = useState<UploadImageResponse[]>([]);
  const [totalProgress, setTotalProgress] = useState(0);

  // 生成缩略图（对大图片进行压缩）
  const generateThumbnail = useCallback((file: File, maxWidth: number = 200, maxHeight: number = 200): Promise<string> => {
    return new Promise((resolve) => {
      // 小文件直接使用原图
      if (file.size < 2 * 1024 * 1024) {
        resolve(URL.createObjectURL(file));
        return;
      }

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        
        // 如果图片尺寸不大，直接使用原图
        if (img.width <= maxWidth && img.height <= maxHeight) {
          resolve(URL.createObjectURL(file));
          return;
        }

        // 计算缩放比例
        let width = img.width;
        let height = img.height;
        const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);

        // 创建 canvas 绘制缩略图
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          resolve(URL.createObjectURL(file));
          return;
        }

        // 使用更好的图像质量
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // 转换为 blob URL
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(URL.createObjectURL(blob));
            } else {
              resolve(URL.createObjectURL(file));
            }
          },
          'image/jpeg',
          0.85
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(URL.createObjectURL(file));
      };

      img.src = objectUrl;
    });
  }, []);

  const handleFileSelect = useCallback(async (fileList: FileList | null) => {
    if (!fileList) return;

    const incomingFiles = Array.from(fileList);
    const validFiles = incomingFiles.filter((file) =>
      ALLOWED_IMAGE_TYPES.has(file.type) && file.size <= MAX_FILE_SIZE
    );
    const rejectedCount = incomingFiles.length - validFiles.length;
    const availableSlots = Math.max(MAX_FILES_PER_BATCH - files.length, 0);
    const imageFiles = validFiles.slice(0, availableSlots);

    if (imageFiles.length === 0) {
      toast({
        title: '请选择图片文件',
        description: `仅支持 JPG、PNG、GIF、WebP、AVIF，单文件最大 ${formatFileSize(MAX_FILE_SIZE)}`,
        variant: 'destructive',
      });
      return;
    }

    if (rejectedCount > 0 || validFiles.length > imageFiles.length) {
      toast({
        title: '部分文件已跳过',
        description: `已跳过 ${rejectedCount + validFiles.length - imageFiles.length} 个不符合要求或超出数量限制的文件`,
      });
    }

    // 为每个文件生成缩略图
    const newFiles: UploadFile[] = await mapWithConcurrency(
      imageFiles,
      THUMBNAIL_CONCURRENCY,
      async (file) => ({
        file,
        preview: await generateThumbnail(file, 300, 300),
        id: generateUploadId(),
        progress: 0,
        status: 'pending',
      })
    );

    setFiles((prev) => [...prev, ...newFiles]);
  }, [files.length, generateThumbnail]);

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

  const updateFilesStatus = (ids: Set<string>, updates: Partial<UploadFile>) => {
    setFiles((prev) => prev.map((file) => (ids.has(file.id) ? { ...file, ...updates } : file)));
  };


  const generateLinkFormats = (image: UploadImageResponse): LinkFormat[] => {
    const formats: LinkFormat[] = [
      { key: 'url', label: 'URL', value: getImageLinkValue(image, 'url') },
      { key: 'html', label: 'HTML', value: getImageLinkValue(image, 'html') },
      { key: 'markdown', label: 'Markdown', value: getImageLinkValue(image, 'markdown') },
      { key: 'bbcode', label: 'BBCode', value: getImageLinkValue(image, 'bbcode') },
    ];
    return formats;
  };

  const handleUpload = async () => {
    if (files.length === 0 || files.every((f) => f.status === 'success')) return;

    setIsUploading(true);
    setTotalProgress(0);
    const pendingFiles = files.filter((f) => f.status !== 'success');

    // 单文件上传：使用单文件 API 带进度
    if (pendingFiles.length === 1) {
      const fileItem = pendingFiles[0];
      updateFileStatus(fileItem.id, { status: 'uploading', progress: 0 });

      try {
        const strategyId = storageId ? parseInt(storageId, 10) : undefined;
        const image = await uploadImageWithProgress(
          fileItem.file,
          true,
          strategyId,
          (progress) => {
            updateFileStatus(fileItem.id, { progress });
            setTotalProgress(progress);
          }
        );
        updateFileStatus(fileItem.id, {
          status: 'success',
          progress: 100,
          result: image,
        });
        setTotalProgress(100);
        onSuccess?.({
          identifier: image.identifier,
          filename: image.filename,
          file_size: image.file_size,
          url: image.links.url,
        } as Image);
        setAllUploadedImages([image]);
        const links = generateLinkFormats(image);
        setCurrentLinks(links);
        setShowLinks(true);
      } catch (error) {
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
    } else {
      // 批量上传：使用批量 API 带总进度
      const pendingIds = new Set(pendingFiles.map((file) => file.id));
      updateFilesStatus(pendingIds, { status: 'uploading', progress: 0, errorMessage: undefined });

      try {
        const strategyId = storageId ? parseInt(storageId, 10) : undefined;
        const filesToUpload = pendingFiles.map((f) => f.file);
        const result = await uploadImagesWithProgress(
          filesToUpload,
          true,
          strategyId,
          (progress) => {
            setTotalProgress(progress);
            // 所有文件的进度与总进度保持一致
            updateFilesStatus(pendingIds, { progress });
          }
        );

        const { updates, uploadedImages } = reconcileBatchUploadResults(
          pendingFiles.map((file) => ({ id: file.id, filename: file.file.name })),
          result
        );
        setFiles((prev) => prev.map((file) => ({ ...file, ...updates.get(file.id) })));
        const successCount = Array.from(updates.values()).filter(
          (update) => update.status === 'success'
        ).length;
        const errorCount = updates.size - successCount;

        if (uploadedImages.length > 0) {
          setAllUploadedImages(uploadedImages);
          const lastImage = uploadedImages[uploadedImages.length - 1];
          const links = generateLinkFormats(lastImage);
          setCurrentLinks(links);
          setShowLinks(true);

          // 调用每个成功上传的回调
          uploadedImages.forEach((image) => {
            onSuccess?.({
              identifier: image.identifier,
              filename: image.filename,
              file_size: image.file_size,
              url: image.links?.url || '',
            } as Image);
          });

        }

        toast({
          title: errorCount > 0 ? '部分文件上传失败' : '上传成功',
          description: `成功 ${successCount} 张，失败 ${errorCount} 张`,
          variant: errorCount > 0 ? 'destructive' : 'default',
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '上传失败';
        pendingFiles.forEach((f) => {
          updateFileStatus(f.id, {
            status: 'error',
            progress: 0,
            errorMessage: errorMsg,
          });
        });
        toast({
          title: '上传失败',
          description: errorMsg,
          variant: 'destructive',
        });
      }
    }

    setIsUploading(false);
  };

  const handleClose = () => {
    if (!isUploading) {
      files.forEach((f) => URL.revokeObjectURL(f.preview));
      setFiles([]);
      setShowLinks(false);
      setCurrentLinks([]);
      setAllUploadedImages([]);
      setTotalProgress(0);
      onOpenChange(false);
    }
  };

  const copyToClipboard = async (value: string, key: string) => {
    try {
      // 优先使用 Clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        // 回退方案：使用 execCommand（兼容 HTTP 环境）
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.left = '-999999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!success) {
          throw new Error('execCommand copy failed');
        }
      }
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

  const copyAllLinks = async (format: 'url' | 'html' | 'markdown' | 'bbcode') => {
    const getLinkValue = (image: UploadImageResponse) => {
      return getImageLinkValue(image, format);
    };

    const allLinks = allUploadedImages.map(getLinkValue).join('\n');
    
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(allLinks);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = allLinks;
        textarea.style.position = 'fixed';
        textarea.style.left = '-999999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!success) {
          throw new Error('execCommand copy failed');
        }
      }
      toast({
        title: '复制成功',
        description: `已复制 ${allUploadedImages.length} 个链接`,
      });
    } catch {
      toast({
        title: '复制失败',
        description: '请手动复制',
        variant: 'destructive',
      });
    }
  };

  // 获取最后一个成功的图片
  const lastSuccessFile = [...files].reverse().find((f: UploadFile) => f.status === 'success');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg md:max-w-2xl lg:max-w-3xl w-[calc(100vw-2rem)] max-h-[85vh] overflow-hidden flex flex-col">
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
              className="space-y-4 overflow-hidden flex flex-col"
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
                  <p className="text-xs text-slate-400">
                    支持 JPG、PNG、GIF、WebP、AVIF，单文件最大 {formatFileSize(MAX_FILE_SIZE)}
                  </p>
                </label>
              </motion.div>

              {/* File List */}
              <AnimatePresence>
                {files.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3 max-h-[50vh] overflow-y-auto"
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

              {/* Total Progress */}
              {isUploading && files.length > 1 && (
                <div className="space-y-2 p-3 bg-indigo-50 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-indigo-700 font-medium">总进度</span>
                    <span className="text-indigo-700">{totalProgress}%</span>
                  </div>
                  <Progress value={totalProgress} className="h-2" />
                </div>
              )}

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
              className="space-y-4 max-h-[70vh] overflow-y-auto pr-2"
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

              {/* Batch Links Display */}
              {allUploadedImages.length > 1 ? (
                <div className="space-y-4">
                  <Tabs defaultValue="url" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="url">URL</TabsTrigger>
                      <TabsTrigger value="html">HTML</TabsTrigger>
                      <TabsTrigger value="markdown">Markdown</TabsTrigger>
                      <TabsTrigger value="bbcode">BBCode</TabsTrigger>
                    </TabsList>
                    <TabsContent value="url" className="mt-4">
                      <BatchLinksContent
                        images={allUploadedImages}
                        format="url"
                        onCopyAll={() => copyAllLinks('url')}
                      />
                    </TabsContent>
                    <TabsContent value="html" className="mt-4">
                      <BatchLinksContent
                        images={allUploadedImages}
                        format="html"
                        onCopyAll={() => copyAllLinks('html')}
                      />
                    </TabsContent>
                    <TabsContent value="markdown" className="mt-4">
                      <BatchLinksContent
                        images={allUploadedImages}
                        format="markdown"
                        onCopyAll={() => copyAllLinks('markdown')}
                      />
                    </TabsContent>
                    <TabsContent value="bbcode" className="mt-4">
                      <BatchLinksContent
                        images={allUploadedImages}
                        format="bbcode"
                        onCopyAll={() => copyAllLinks('bbcode')}
                      />
                    </TabsContent>
                  </Tabs>
                </div>
              ) : (
                /* Single File Links */
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
              )}

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
