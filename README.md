# 活动管理平台

这是一个基于 Vue.js 和 Supabase 构建的活动管理和发布平台，专为 Game Jam 或类似创作活动设计。

## ✨ 主要功能

- **用户认证**: 提供用户注册、登录和退出功能。
- **活动浏览**: 公开展示已发布的活动列表，支持查看活动详情。
- **活动管理 (管理员)**:
  - 创建新活动，并默认保存为草稿。
  - 编辑自己创建的活动（包括标题、时间、地点、队伍最大人数等核心信息）。
  - 发布草稿活动，使其对所有用户可见。
  - 删除草稿活动。
- **用户参与**:
  - 普通用户可以报名参加已发布的活动。
  - 用户可以查看自己创建的活动列表。
- **友好的用户体验**:
  - 全局浮动消息提示（Toast Notification），用于反馈操作结果。
  - 表单输入验证，包括错误字段高亮、底部文字提示和自动滚动到错误位置。
  - 定制的滚动条和界面样式，提升视觉一致性。

## 🛠️ 技术栈

- **前端**:
  - [Vue 3](https://vuejs.org/) (Composition API, `<script setup>`)
  - [Vite](https://vitejs.dev/) - 构建工具
  - [TypeScript](https://www.typescriptlang.org/) - 类型系统
  - [Vue Router](https://router.vuejs.org/) - 路由管理
- **后端即服务 (BaaS)**:
  - [Supabase](https://supabase.com/) - 用于数据库、用户认证和后端 API。
- **样式**:
  - 使用原生 CSS 变量构建的自定义设计系统。

## 🚀 本地开发

### 1. 环境准备

- 安装 [Node.js](https://nodejs.org/) (v18 或更高版本)。
- 克隆本项目到本地。

### 2. 配置文件

项目根目录下需要一个 `.env` 文件来配置 Supabase 的连接信息。请根据您的 Supabase 项目设置创建该文件：

```env
VITE_SUPABASE_URL="YOUR_SUPABASE_URL"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
```

### 3. 安装依赖

在项目根目录运行以下命令：

```bash
npm install
```

### 4. 运行开发服务器

```bash
npm run dev
```

服务启动后，通常可以在 `http://localhost:5173` 访问。

### 5. 构建生产版本

```bash
npm run build
```

构建产物将输出到 `dist` 目录。

## 🗃️ 数据库结构

核心数据表是 `events`，其结构大致如下：

| 字段名 | 类型 | 描述 |
| :--- | :--- | :--- |
| `id` | `uuid` | 主键，活动唯一标识 |
| `title` | `text` | 活动标题 |
| `description` | `text` | 活动描述 (包含 JSON 结构的详细信息) |
| `start_time` | `timestamptz` | 开始时间 |
| `end_time` | `timestamptz` | 结束时间 |
| `registration_start_time` | `timestamptz` | 报名开始时间 |
| `registration_end_time` | `timestamptz` | 报名结束时间 |
| `is_registration_open` | `boolean` | 报名是否开放（虚拟列） |
| `submission_start_time` | `timestamptz` | 提交开始时间 |
| `submission_end_time` | `timestamptz` | 提交结束时间 |
| `is_submission_open` | `boolean` | 提交是否开放（虚拟列） |
| `location` | `text` | 活动地点 |
| `team_max_size` | `integer` | 队伍最大人数 (0 表示不限) |
| `status` | `text` | 活动状态 (`draft`, `published`, `ended`) |
| `created_by` | `uuid` | 创建者的用户 ID |
| `created_at` | `timestamptz` | 创建时间 |

此外，还有用于处理用户认证的 `auth.users` 和报名信息的 `registrations` 等表。
