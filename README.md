# Image Bed Web
图床管理前端，基于 React + TypeScript + Tailwind CSS 构建。

## 技术栈

- **React 19** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Tailwind CSS** - CSS 框架
- **shadcn/ui** - UI 组件库
- **Zustand** - 状态管理
- **Axios** - HTTP 客户端

## 开发环境

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 配置

复制 `.env.example` 为 `.env`，并按开发环境配置 API 地址和代理目标：

```env
VITE_API_BASE_URL=
DEV_PROXY_TARGET=http://localhost:8080
```

开发环境建议保留 `VITE_API_BASE_URL` 为空，通过 `DEV_PROXY_TARGET` 使用 Vite 代理。

## 许可证

MIT
