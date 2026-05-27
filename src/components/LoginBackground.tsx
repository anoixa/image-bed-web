import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchRandomImage } from '@/api/images';

const IMAGE_COUNT = 5;
const SWITCH_INTERVAL = 15000;
const ANIMATION_DURATION = 15;

export default function LoginBackground() {
  const [images, setImages] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasImages, setHasImages] = useState(false);

  // 预加载图片池
  const loadImages = useCallback(async (signal: AbortSignal) => {
    // 尝试获取多张随机图片（要求有 WebP 变体，文件大小不超过 10MB）
    // 使用 configured 模式，不传 album_id，尊重后台配置的图源相册
    const results = await Promise.allSettled(
      Array.from({ length: IMAGE_COUNT }, () => fetchRandomImage({
        mode: 'configured',
        minWidth: 1920,
        minHeight: 1080,
        requireWebP: true,
        maxFileSize: 10 * 1024 * 1024,
      }, signal))
    );

    if (signal.aborted) return;

    const urls: string[] = [];
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        // 优先使用 WebP 变体
        const imageUrl = result.value?.variant?.url || result.value?.url;
        if (imageUrl && !urls.includes(imageUrl)) {
          urls.push(imageUrl);
        }
      }
    });

    if (urls.length > 0) {
      setImages(urls);
      setHasImages(true);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadImages(controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadImages]);

  // 定时切换
  useEffect(() => {
    if (images.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, SWITCH_INTERVAL);

    return () => clearInterval(timer);
  }, [images.length]);

  // 无图片时显示渐变背景
  if (!hasImages) {
    return (
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 animated-gradient" />
        <div className="absolute inset-0 bg-black/30" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* 双层图片实现crossfade */}
      <AnimatePresence mode="sync">
        {images.map((url, index) => {
          const isActive = index === currentIndex;
          const isPrev =
            index === (currentIndex - 1 + images.length) % images.length;

          if (!isActive && !isPrev) return null;

          // 随机生成轻微的位移方向，增加动感
          const translateX = isActive ? '-1%' : '0%';
          const translateY = isActive ? '-0.5%' : '0%';

          return (
            <motion.div
              key={url}
              initial={{ opacity: 0, scale: 1 }}
              animate={{
                opacity: isActive ? 1 : 0,
                scale: isActive ? 1.12 : 1,
                x: translateX,
                y: translateY,
              }}
              transition={{
                opacity: { duration: 2 },
                scale: { duration: ANIMATION_DURATION, ease: 'easeInOut' },
                x: { duration: ANIMATION_DURATION, ease: 'easeInOut' },
                y: { duration: ANIMATION_DURATION, ease: 'easeInOut' },
              }}
              className="absolute inset-0 will-change-transform"
            >
              <img
                src={url}
                alt=""
                className="w-full h-full object-cover"
                loading={index === 0 ? 'eager' : 'lazy'}
                decoding="async"
              />
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* 渐变遮罩 - 确保登录表单可读 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%),
            linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.3) 100%)
          `,
        }}
      />
    </div>
  );
}
