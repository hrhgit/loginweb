# 部署文档

本目录包含项目的部署配置、检查清单和环境设置说明。

## 📋 文档列表

### 部署指南
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - 部署检查清单

## 🚀 部署流程

### 环境要求
- Node.js 18+
- npm 或 yarn
- Supabase 项目配置

### 环境变量配置
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 构建命令
```bash
# 安装依赖
npm install

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

## 🌐 部署平台

### Vercel 部署
- 自动化 CI/CD
- 环境变量配置
- 域名绑定

### 其他平台
- Netlify
- GitHub Pages
- 自托管服务器

## ✅ 部署检查

- [ ] 环境变量配置正确
- [ ] Supabase 项目设置完成
- [ ] 数据库迁移执行完成
- [ ] 静态资源路径正确
- [ ] 域名和 SSL 证书配置
- [ ] 性能监控设置