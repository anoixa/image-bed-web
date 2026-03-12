import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://192.168.10.4:8089',
        changeOrigin: true,
        cookieDomainRewrite: '',
      },
      '/images': {
        target: 'http://192.168.10.4:8089',
        changeOrigin: true,
      },
      '/thumbnails': {
        target: 'http://192.168.10.4:8089',
        changeOrigin: true,
      },
      '/random': {
        target: 'http://192.168.10.4:8089',
        changeOrigin: true,
      },
    },
  },
})
