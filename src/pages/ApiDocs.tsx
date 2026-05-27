import { useState } from 'react';
import { BookOpen, Code, Copy, Check, Key, Image as ImageIcon, Folder, Upload, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';

// API 端点定义
interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  auth: boolean;
  params?: { name: string; type: string; required: boolean; description: string }[];
  body?: { name: string; type: string; required: boolean; description: string }[];
  response?: string;
  example?: string;
}

const imageEndpoints: ApiEndpoint[] = [
  {
    method: 'POST',
    path: '/api/v1/images/upload',
    description: '上传单张图片（支持 API Key 认证）',
    auth: true,
    body: [
      { name: 'file', type: 'File', required: true, description: '图片文件' },
      { name: 'is_public', type: 'boolean', required: false, description: '是否公开，默认 true' },
      { name: 'strategy_id', type: 'number', required: false, description: '存储策略ID' },
    ],
    response: `{
  "identifier": "abc123",
  "url": "https://example.com/images/abc123.jpg",
  "thumbnail_url": "https://example.com/thumbnails/abc123.jpg",
  "filename": "photo.jpg",
  "size": 1024000,
  "width": 1920,
  "height": 1080,
  "mime_type": "image/jpeg",
  "is_public": true
}`,
    example: `curl -X POST https://your-domain.com/api/v1/images/upload \\
  -H "Authorization: ApiKey WJWEg_HAiK8EI8HMDluJN5PAdGc5w8B5cs6mRLpUh5H8ucFAIAUS-xIeTu2pnxrmaVQkSgzQnD4WvQQuDli-rg==" \\
  -F "file=@/path/to/image.jpg" \\
  -F "is_public=true"`,
  },
  {
    method: 'POST',
    path: '/api/v1/images/uploads',
    description: '批量上传图片',
    auth: true,
    body: [
      { name: 'files[]', type: 'File[]', required: true, description: '多个图片文件' },
      { name: 'is_public', type: 'boolean', required: false, description: '是否公开' },
    ],
    response: `{
  "success_count": 3,
  "failed_count": 0,
  "results": [
    { "identifier": "abc123", "url": "...", "success": true }
  ]
}`,
    example: `curl -X POST https://your-domain.com/api/v1/images/uploads \\
  -H "Authorization: ApiKey WJWEg_HAiK8EI8HMDluJN5PAdGc5w8B5cs6mRLpUh5H8ucFAIAUS-xIeTu2pnxrmaVQkSgzQnD4WvQQuDli-rg==" \\
  -F "files[]=@image1.jpg" \\
  -F "files[]=@image2.jpg"`,
  },
  {
    method: 'POST',
    path: '/api/v1/images',
    description: '获取图片列表（支持筛选和分页）',
    auth: true,
    body: [
      { name: 'page', type: 'number', required: false, description: '页码，默认 1' },
      { name: 'limit', type: 'number', required: false, description: '每页数量，默认 20' },
      { name: 'search', type: 'string', required: false, description: '搜索关键词（文件名）' },
      { name: 'album_id', type: 'number', required: false, description: '相册ID筛选' },
      { name: 'sort', type: 'string', required: false, description: '排序：asc 或 desc' },
    ],
    response: `{
  "images": [
    {
      "identifier": "abc123",
      "filename": "photo.jpg",
      "url": "...",
      "thumbnail_url": "...",
      "size": 1024000,
      "width": 1920,
      "height": 1080,
      "is_public": true,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20
}`,
    example: `curl -X POST https://your-domain.com/api/v1/images \\
  -H "Authorization: ApiKey WJWEg_HAiK8EI8HMDluJN5PAdGc5w8B5cs6mRLpUh5H8ucFAIAUS-xIeTu2pnxrmaVQkSgzQnD4WvQQuDli-rg==" \\
  -H "Content-Type: application/json" \\
  -d '{"page":1,"limit":20,"search":"vacation"}'`,
  },
  {
    method: 'GET',
    path: '/api/v1/images/{identifier}',
    description: '获取单张图片详情',
    auth: false,
    params: [
      { name: 'identifier', type: 'string', required: true, description: '图片唯一标识' },
    ],
    response: `{
  "identifier": "abc123",
  "filename": "photo.jpg",
  "url": "...",
  "thumbnail_url": "...",
  "size": 1024000,
  "width": 1920,
  "height": 1080,
  "mime_type": "image/jpeg",
  "is_public": true,
  "created_at": "2024-01-15T10:30:00Z"
}`,
    example: `curl https://your-domain.com/api/v1/images/abc123`,
  },
  {
    method: 'DELETE',
    path: '/api/v1/images/{identifier}',
    description: '删除单张图片',
    auth: true,
    params: [
      { name: 'identifier', type: 'string', required: true, description: '图片唯一标识' },
    ],
    response: `{
  "message": "删除成功"
}`,
    example: `curl -X DELETE https://your-domain.com/api/v1/images/abc123 \\
  -H "Authorization: ApiKey WJWEg_HAiK8EI8HMDluJN5PAdGc5w8B5cs6mRLpUh5H8ucFAIAUS-xIeTu2pnxrmaVQkSgzQnD4WvQQuDli-rg=="`,
  },
  {
    method: 'POST',
    path: '/api/v1/images/delete',
    description: '批量删除图片',
    auth: true,
    body: [
      { name: 'identifiers', type: 'string[]', required: true, description: '图片标识符数组' },
    ],
    response: `{
  "success_count": 3,
  "failed_count": 0
}`,
    example: `curl -X POST https://your-domain.com/api/v1/images/delete \\
  -H "Authorization: ApiKey WJWEg_HAiK8EI8HMDluJN5PAdGc5w8B5cs6mRLpUh5H8ucFAIAUS-xIeTu2pnxrmaVQkSgzQnD4WvQQuDli-rg==" \\
  -H "Content-Type: application/json" \\
  -d '{"identifiers":["abc123","def456"]}'`,
  },
  {
    method: 'PUT',
    path: '/api/v1/images/{identifier}/visibility',
    description: '修改图片可见性',
    auth: true,
    params: [
      { name: 'identifier', type: 'string', required: true, description: '图片唯一标识' },
    ],
    body: [
      { name: 'is_public', type: 'boolean', required: true, description: '是否公开' },
    ],
    response: `{
  "message": "设置成功"
}`,
    example: `curl -X PUT https://your-domain.com/api/v1/images/abc123/visibility \\
  -H "Authorization: ApiKey WJWEg_HAiK8EI8HMDluJN5PAdGc5w8B5cs6mRLpUh5H8ucFAIAUS-xIeTu2pnxrmaVQkSgzQnD4WvQQuDli-rg==" \\
  -H "Content-Type: application/json" \\
  -d '{"is_public":false}'`,
  },
];

const albumEndpoints: ApiEndpoint[] = [
  {
    method: 'GET',
    path: '/api/v1/albums',
    description: '获取相册列表',
    auth: true,
    params: [
      { name: 'page', type: 'number', required: false, description: '页码' },
      { name: 'limit', type: 'number', required: false, description: '每页数量' },
    ],
    response: `{
  "albums": [
    {
      "id": 1,
      "name": "旅行照片",
      "description": "2024年旅行",
      "image_count": 50,
      "cover_image": "..."
    }
  ],
  "total": 10
}`,
    example: `curl https://your-domain.com/api/v1/albums \\
  -H "Authorization: ApiKey WJWEg_HAiK8EI8HMDluJN5PAdGc5w8B5cs6mRLpUh5H8ucFAIAUS-xIeTu2pnxrmaVQkSgzQnD4WvQQuDli-rg=="`,
  },
  {
    method: 'GET',
    path: '/api/v1/albums/{id}',
    description: '获取相册详情（包含图片）',
    auth: true,
    params: [
      { name: 'id', type: 'number', required: true, description: '相册ID' },
    ],
    response: `{
  "id": 1,
  "name": "旅行照片",
  "description": "...",
  "images": [...],
  "image_count": 50
}`,
    example: `curl https://your-domain.com/api/v1/albums/1 \\
  -H "Authorization: ApiKey WJWEg_HAiK8EI8HMDluJN5PAdGc5w8B5cs6mRLpUh5H8ucFAIAUS-xIeTu2pnxrmaVQkSgzQnD4WvQQuDli-rg=="`,
  },
  {
    method: 'POST',
    path: '/api/v1/albums',
    description: '创建相册',
    auth: true,
    body: [
      { name: 'name', type: 'string', required: true, description: '相册名称' },
      { name: 'description', type: 'string', required: false, description: '相册描述' },
    ],
    response: `{
  "id": 1,
  "name": "新相册",
  "description": "...",
  "image_count": 0
}`,
    example: `curl -X POST https://your-domain.com/api/v1/albums \\
  -H "Authorization: ApiKey WJWEg_HAiK8EI8HMDluJN5PAdGc5w8B5cs6mRLpUh5H8ucFAIAUS-xIeTu2pnxrmaVQkSgzQnD4WvQQuDli-rg==" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"新相册","description":"描述"}'`,
  },
  {
    method: 'PUT',
    path: '/api/v1/albums/{id}',
    description: '更新相册信息',
    auth: true,
    params: [
      { name: 'id', type: 'number', required: true, description: '相册ID' },
    ],
    body: [
      { name: 'name', type: 'string', required: false, description: '相册名称' },
      { name: 'description', type: 'string', required: false, description: '相册描述' },
    ],
    response: `{
  "id": 1,
  "name": "更新后的名称",
  "description": "..."
}`,
    example: `curl -X PUT https://your-domain.com/api/v1/albums/1 \\
  -H "Authorization: ApiKey WJWEg_HAiK8EI8HMDluJN5PAdGc5w8B5cs6mRLpUh5H8ucFAIAUS-xIeTu2pnxrmaVQkSgzQnD4WvQQuDli-rg==" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"新名称"}'`,
  },
  {
    method: 'DELETE',
    path: '/api/v1/albums/{id}',
    description: '删除相册',
    auth: true,
    params: [
      { name: 'id', type: 'number', required: true, description: '相册ID' },
    ],
    response: `{
  "message": "删除成功"
}`,
    example: `curl -X DELETE https://your-domain.com/api/v1/albums/1 \\
  -H "Authorization: ApiKey WJWEg_HAiK8EI8HMDluJN5PAdGc5w8B5cs6mRLpUh5H8ucFAIAUS-xIeTu2pnxrmaVQkSgzQnD4WvQQuDli-rg=="`,
  },
  {
    method: 'POST',
    path: '/api/v1/albums/{id}/images',
    description: '添加图片到相册',
    auth: true,
    params: [
      { name: 'id', type: 'number', required: true, description: '相册ID' },
    ],
    body: [
      { name: 'identifiers', type: 'string[]', required: true, description: '图片标识符数组' },
    ],
    response: `{
  "album_id": 1,
  "added_count": 3,
  "failed_identifiers": []
}`,
    example: `curl -X POST https://your-domain.com/api/v1/albums/1/images \\
  -H "Authorization: ApiKey WJWEg_HAiK8EI8HMDluJN5PAdGc5w8B5cs6mRLpUh5H8ucFAIAUS-xIeTu2pnxrmaVQkSgzQnD4WvQQuDli-rg==" \\
  -H "Content-Type: application/json" \\
  -d '{"identifiers":["abc123","def456"]}'`,
  },
  {
    method: 'POST',
    path: '/api/v1/albums/{id}/images/remove',
    description: '从相册移除图片',
    auth: true,
    params: [
      { name: 'id', type: 'number', required: true, description: '相册ID' },
    ],
    body: [
      { name: 'identifiers', type: 'string[]', required: true, description: '图片标识符数组' },
    ],
    response: `{
  "album_id": 1,
  "removed_count": 2
}`,
    example: `curl -X POST https://your-domain.com/api/v1/albums/1/images/remove \\
  -H "Authorization: ApiKey WJWEg_HAiK8EI8HMDluJN5PAdGc5w8B5cs6mRLpUh5H8ucFAIAUS-xIeTu2pnxrmaVQkSgzQnD4WvQQuDli-rg==" \\
  -H "Content-Type: application/json" \\
  -d '{"identifiers":["abc123"]}'`,
  },
];

function EndpointCard({ endpoint }: { endpoint: ApiEndpoint }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: '已复制到剪贴板' });
    setTimeout(() => setCopied(false), 2000);
  };

  const methodColors = {
    GET: 'bg-emerald-100 text-emerald-700',
    POST: 'bg-blue-100 text-blue-700',
    PUT: 'bg-amber-100 text-amber-700',
    DELETE: 'bg-red-100 text-red-700',
  };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 bg-slate-50 border-b border-slate-200">
        <Badge className={`${methodColors[endpoint.method]} font-mono text-xs`}>
          {endpoint.method}
        </Badge>
        <code className="text-sm font-mono text-slate-700 flex-1">{endpoint.path}</code>
        {endpoint.auth && (
          <Badge variant="outline" className="gap-1 text-amber-600 border-amber-200">
            <Key className="w-3 h-3" />
            API Key
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        <p className="text-slate-600 text-sm">{endpoint.description}</p>

        {/* Parameters */}
        {endpoint.params && endpoint.params.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">路径参数</h4>
            <div className="space-y-1">
              {endpoint.params.map((param) => (
                <div key={param.name} className="flex items-center gap-2 text-sm">
                  <code className="text-indigo-600 font-mono">{param.name}</code>
                  <span className="text-slate-400">{param.type}</span>
                  {param.required && <Badge variant="secondary" className="text-xs">必需</Badge>}
                  <span className="text-slate-500">{param.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Body */}
        {endpoint.body && endpoint.body.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">请求体</h4>
            <div className="space-y-1">
              {endpoint.body.map((field) => (
                <div key={field.name} className="flex items-center gap-2 text-sm">
                  <code className="text-indigo-600 font-mono">{field.name}</code>
                  <span className="text-slate-400">{field.type}</span>
                  {field.required && <Badge variant="secondary" className="text-xs">必需</Badge>}
                  <span className="text-slate-500">{field.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Response */}
        {endpoint.response && (
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">响应示例</h4>
            <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg text-xs overflow-x-auto">
              <code>{endpoint.response}</code>
            </pre>
          </div>
        )}

        {/* Example */}
        {endpoint.example && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase">请求示例</h4>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 text-xs"
                onClick={() => handleCopy(endpoint.example!)}
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? '已复制' : '复制'}
              </Button>
            </div>
            <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg text-xs overflow-x-auto">
              <code>{endpoint.example}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ApiDocs() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-indigo-600" />
          API 文档
        </h1>
        <p className="text-slate-500 mt-1">完整的图片和相册 API 接口参考，支持 API Key 认证</p>
      </div>

      {/* Auth Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-medium">认证方式</p>
          <p className="mt-1">
            所有需要认证的接口都需要在请求头中添加 <code className="bg-amber-100 px-1 py-0.5 rounded">Authorization</code>。
            你可以在 <strong>API Token</strong> 页面生成和管理 API Key。
          </p>
        </div>
      </div>

      {/* API Tabs */}
      <Tabs defaultValue="images" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="images" className="gap-2">
            <ImageIcon className="w-4 h-4" />
            图片 API
          </TabsTrigger>
          <TabsTrigger value="albums" className="gap-2">
            <Folder className="w-4 h-4" />
            相册 API
          </TabsTrigger>
        </TabsList>

        <TabsContent value="images" className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Upload className="w-4 h-4" />
            <span>共 {imageEndpoints.length} 个接口</span>
          </div>
          <div className="space-y-4">
            {imageEndpoints.map((endpoint, index) => (
              <EndpointCard key={index} endpoint={endpoint} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="albums" className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Folder className="w-4 h-4" />
            <span>共 {albumEndpoints.length} 个接口</span>
          </div>
          <div className="space-y-4">
            {albumEndpoints.map((endpoint, index) => (
              <EndpointCard key={index} endpoint={endpoint} />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Quick Reference */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <Code className="w-4 h-4" />
          快速参考
        </h3>
        <div className="grid gap-4 md:grid-cols-2 text-sm">
          <div>
            <p className="text-slate-500 mb-1">基础 URL</p>
            <code className="bg-white px-2 py-1 rounded border text-slate-700">https://your-domain.com/api/v1</code>
          </div>
          <div>
            <p className="text-slate-500 mb-1">认证 Header</p>
            <code className="bg-white px-2 py-1 rounded border text-slate-700">Authorization: ApiKey your-token</code>
          </div>
        </div>
      </div>
    </div>
  );
}
