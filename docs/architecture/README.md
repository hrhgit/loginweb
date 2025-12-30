# 架构文档

本目录包含项目的架构设计和结构说明文档。

## 📋 文档列表

### 核心架构
- [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) - 项目结构与分工说明
- [FUNCTIONAL_LOGIC.md](./FUNCTIONAL_LOGIC.md) - 功能逻辑说明
- [EXECUTIVE_SUMMARY.md](./EXECUTIVE_SUMMARY.md) - 执行总结

## 🏗️ 架构概览

本项目采用现代化的前端架构：

- **前端框架**: Vue 3 + Composition API
- **构建工具**: Vite
- **路由管理**: Vue Router 4
- **状态管理**: 自定义 Store (基于 Vue 响应式 API)
- **后端服务**: Supabase (BaaS)
- **数据库**: PostgreSQL (通过 Supabase)
- **认证系统**: Supabase Auth

## 🎯 设计原则

1. **组件化设计** - 可复用的 Vue 组件
2. **响应式状态管理** - 基于 Vue 3 Composition API
3. **类型安全** - TypeScript 支持
4. **性能优化** - 懒加载和代码分割
5. **用户体验** - 流畅的交互和反馈