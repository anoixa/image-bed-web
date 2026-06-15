import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.DEV_PROXY_TARGET || 'http://localhost:8080'

  return {
    base: '/',
    plugins: [
      react(),
      {
        name: 'remove-crossorigin',
        transformIndexHtml(html: string) {
          return html.replace(/\s+crossorigin(?=[\s>])/g, '')
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/node_modules/react-photo-view/')) {
              return 'photo-view'
            }
            if (id.includes('/node_modules/@radix-ui/')) {
              return 'ui-vendor'
            }
            if (
              id.includes('/node_modules/react/') ||
              id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/react-router')
            ) {
              return 'react-vendor'
            }
          },
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            const name = assetInfo.name || ''
            if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(name)) {
              return 'assets/images/[name]-[hash][extname]'
            }
            return 'assets/[name]-[hash][extname]'
          },
        },
      },
      minify: 'oxc',
      sourcemap: false,
      target: 'esnext',
      cssCodeSplit: true,
      chunkSizeWarningLimit: 500,
    },
    server: {
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          cookieDomainRewrite: '',
        },
        '/images': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/thumbnails': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/random': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
