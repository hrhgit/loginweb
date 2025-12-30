# 功能逻辑说明

本文档旨在阐述本活动管理平台的核心功能、业务逻辑和数据流。

## 1. 全局状态管理 (`src/store/appStore.ts`)

本项目采用类似于 Pinia 的模式，通过 `proxyRefs` 将 Vue 的响应式 API (`ref`, `computed`, `reactive`) 组合成一个单一的、可全局访问的 `store`。`appStore.ts` 是所有业务逻辑和客户端状态的中央枢纽。

### Store 拆分辅助文件

- `src/store/models.ts`: 统一定义 `Event`/`DisplayEvent`/`EventStatus` 等类型。
- `src/store/demoEvents.ts`: 前端演示用的活动数据（当数据库无返回数据时用于占位展示）。

### 用户认证

- **初始化**: 应用启动时，`App.vue` 会调用 `store.init()`。该函数通过 `supabase.auth.onAuthStateChange` 设置一个监听器，以响应用户登录状态的变化，并自动刷新用户信息和相关数据。
- **登录/注册**: `src/components/modals/AuthModal.vue` 负责收集用户信息，并调用 `store.submitAuth()`。该函数根据当前的 `authView` (`sign_in` 或 `sign_up`) 来执行 Supabase 对应的登录或注册方法。
- **退出登录**: `store.handleSignOut()` 函数负责清除本地用户状态，并调用 `supabase.auth.signOut()` 来终止会话。

### 活动数据处理

- **数据加载**:
  - `loadEvents()`: 从 Supabase 的 `events` 表中获取活动列表。它会根据用户是否为管理员来决定是否拉取状态为 `draft`（草稿）的活动。
  - `fetchEventById()`: 当需要访问单个活动详情且本地缓存不存在时，此函数会从 Supabase 获取特定 ID 的活动数据。
- **活动创建 (`submitCreate`)**:
  - 仅管理员可调用。
  - 收集“创建活动”模态框（`src/components/modals/CreateEventModal.vue`）中的数据，并将其插入到 `events` 表中。
  - 新创建的活动状态默认为 `draft`。
- **活动更新 (`updateEvent`)**:
  - 这是`EventEditPage.vue` 中保存逻辑的核心。
  - 它接受一个 `Partial<Event>` 对象作为参数，允许对活动的任意字段进行更新，提供了高度的灵活性。
  - 保存成功后，它会更新本地 `events` 数组中的对应项，以确保视图的实时响应。

### 通知系统

- **消息设置 (`setBanner`)**: 此函数现在是全局 Toast 通知的触发器。
- 当被调用时，它会设置 `bannerInfo` 或 `bannerError` 的值，并在 2 秒后通过 `setTimeout` 自动清除，从而实现消息的自动消失效果。
- 最终的 UI 渲染由 `src/components/feedback/GlobalBanner.vue` 负责，并通过过渡动画实现渐隐。

## 2. 核心组件逻辑

### `App.vue`

- 作为应用的根组件，它负责渲染核心布局（`app-shell`），并组合下列全局组件：
  - `src/components/layout/AppHeader.vue`: 顶栏（返回/主页、登录注册、用户信息与登出）。
  - `src/components/feedback/GlobalBanner.vue`: 全局提示（绿色半透明，2 秒后渐隐）。
  - `src/components/layout/AppFooter.vue`: 页脚。
  - `src/components/modals/AuthModal.vue`: 登录/注册弹窗。
  - `src/components/modals/CreateEventModal.vue`: 创建活动弹窗。

### `EventDetailPage.vue` (活动详情页)

- **数据获取**: 通过路由参数中的 `id`，调用 `store.fetchEventById()` 来获取和展示单个活动的详细信息。
- **权限控制**: 包含一个 `canEdit` 计算属性，用于判断当前登录用户是否为该活动的创建者且是管理员。
- **编辑入口**: 如果 `canEdit` 为 `true`，页面上会显示一个“编辑活动”按钮，通过 `RouterLink` 将用户导航到对应的编辑页面 (`/events/:id/edit`)。

### `EventEditPage.vue` (活动编辑页)

- **核心编辑界面**: 这是项目中最复杂的前端组件之一，负责所有活动内容的编辑。
- **数据加载与填充**:
  - `loadEvent()` 函数负责获取当前活动的数据。
  - 成功获取后，它会将活动的核心属性（如 `title`, `start_time`）填充到本地的 `edit...` 系列 `ref` 变量中。
  - 同时，它会解析 `description` 字段（一个 JSON 字符串），并将其中更复杂的结构化数据填充到表单中（例如，活动介绍、活动流程等）。
- **数据保存 (`handleSave`)**:
  - **客户端验证**: 在提交前，`validateAndScroll()` 函数会检查所有字段的有效性（如标题是否为空、时间是否合法等）。如果验证失败，它会将错误信息存入 `fieldErrors` 对象，并自动滚动到第一个出错的字段。
  - **数据打包**: 将所有可编辑字段（核心属性 + 描述详情）重新组合，并调用 `store.updateEvent()` 将更新推送到数据库。
- **预览模式**: 提供一个“预览”切换功能，允许管理员在保存前查看详情页面的最终渲染效果。
