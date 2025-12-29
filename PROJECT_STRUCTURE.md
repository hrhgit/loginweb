# 项目结构与分工说明

本项目是一个基于 Vue 3 + Vite + Vue Router 的前端应用，使用 `@supabase/supabase-js` 作为后端（认证 + 数据库）。

## 1. 目录结构（核心）

- `src/main.ts`：应用入口，挂载 Vue + Router。
- `src/router.ts`：路由表（活动列表 / 我发起的活动 / 活动详情 / 活动编辑 / 个人主页）。
- `src/style.css`：全局样式与设计系统（变量、布局、组件样式、全局提示动画等）。

### 业务与状态

- `src/store/appStore.ts`：全局 store（认证、活动 CRUD、报名、全局提示 banner、权限判断等）。
- `src/store/models.ts`：store 的通用类型定义（`Event`/`DisplayEvent`/`EventStatus` 等）。
- `src/store/eventSchema.ts`：活动字段清单与默认值（统一 select 字段/演示活动默认结构）。
- `src/store/demoEvents.ts`：演示活动数据（数据库无数据时用于前端占位展示）。
- `src/lib/supabase.ts`：Supabase Client 初始化（读取 `.env` 中的 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`）。

### 页面（路由级）

- `src/pages/EventsPage.vue`：全部活动页（普通用户只能看已发布/已结束；管理员可发起活动）。
- `src/pages/MyEventsPage.vue`：我发起的活动页（仅管理员可见，只展示自己创建的活动；草稿仅在此页出现）。
- `src/pages/EventDetailPage.vue`：活动详情页（报名入口、报名表单填写、组队大厅含"我的队伍"页签、作品提交等展示）。
- `src/pages/EventEditPage.vue`：活动编辑页（编辑活动内容、报名表单设置、预览与发布/保存草稿等）。
- `src/pages/ProfilePage.vue`：个人主页（个人资料、职能/头像/联系方式、账号密码修改）。
- `src/pages/TeamCreatePage.vue`：队伍创建页（创建和编辑队伍信息）。
- `src/pages/TeamDetailPage.vue`：队伍详情页（查看队伍信息和成员）。
- `src/pages/SubmissionPage.vue`：作品提交页（提交项目文件和信息）。

### 组件（可复用 UI）

- `src/components/layout/AppHeader.vue`：全局顶栏（返回/主页、登录注册、用户信息与登出）。
- `src/components/layout/AppFooter.vue`：全局页脚。
- `src/components/feedback/GlobalBanner.vue`：全局消息提示（绿色半透明，2 秒后渐隐）。
- `src/components/modals/AuthModal.vue`：登录/注册弹窗。
- `src/components/modals/CreateEventModal.vue`：创建活动弹窗（创建成功后跳转到编辑页）。
- `src/components/modals/AvatarCropperModal.vue`：头像裁剪弹窗。
- `src/components/events/EventCard.vue`：活动卡片基础封装（卡片头部/摘要/元信息/操作区位置统一，样式复用）。
- `src/components/MyTeamsTabContent.vue`：我的队伍页签内容（显示用户在当前活动中的队伍、申请、邀请信息）。

### Composables / Utils

- `src/composables/useEventsReady.ts`：列表页通用加载逻辑（确保活动列表与我的报名状态已加载）。
- `src/utils/eventDetails.ts`：活动详情结构（介绍/亮点/流程/报名表/组队/提交清单）与序列化/反序列化（存入 `events.description`）。
- `src/utils/eventFormat.ts`：展示层格式化（时间、时间范围、地点、队伍最大人数、状态徽章等）。

## 2. 数据流与职责边界

- **页面**：负责“用户操作 + UI 交互”，调用 store 的动作函数（如 `loadEvents()`/`updateEvent()`/`submitRegistration()`）。
- **store**：负责“业务逻辑 + 与 Supabase 交互 + 权限判断 + 全局提示”。
- **utils**：负责“纯函数/格式化/描述字段（JSON）编解码”，不直接操作 UI。
- **components**：负责“可复用 UI 拼装”，不直接写数据库逻辑（只调用 store）。

## 3. 文档与数据库

- `database.md`：你提供的数据表结构说明（前端对接时以此为准）。
- `supabase.sql`：Supabase 建表与 RLS 策略（需要复制到 Supabase SQL Editor 执行）。
- `event-publish-rules.md`：活动发布/草稿/权限逻辑说明。
- `STYLING_GUIDE.md`：样式规范与组件样式约定。
- `FUNCTIONAL_LOGIC.md`：业务流程与 store 的核心逻辑说明。

## 4. 未来建议（可选）

如果后续功能继续增长，建议继续拆分 `src/store/appStore.ts` 为多个模块（例如 `auth` / `events` / `registrations` / `banners`），并保持对外暴露的 store API 不变，以降低页面耦合度。
