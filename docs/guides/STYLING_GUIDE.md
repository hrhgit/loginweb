# 样式与设计规范

本文档描述了项目的前端样式架构、设计约定和可复用组件的样式规则。

## 1. 核心理念

本项目未使用任何大型 CSS 框架（如 Bootstrap 或 Tailwind），而是采用了一套基于原生 CSS 自定义属性（CSS Variables）的自定义设计系统。这种方法提供了高度的灵活性和可维护性。

- **全局样式**: 所有核心样式都定义在 `src/style.css` 文件中。
- **变量驱动**: 颜色、阴影、边框等核心设计元素都通过 CSS 变量进行管理。

## 2. CSS 变量 (`:root`)

所有全局 CSS 变量都在 `src/style.css` 的 `:root` 选择器中定义，方便统一修改和主题管理。

- **颜色 (Colors)**:
  - `--bg`: 主要背景色。
  - `--surface`, `--surface-strong`, `--surface-muted`: 用于卡片、模态框等层级元素的背景色，有不同透明度或亮度。
  - `--ink`: 主要文字颜色。
  - `--muted`: 次要或辅助性文字的颜色。
  - `--accent`: 主题强调色，用于主要按钮、链接和高亮元素。
  - `--accent-2`: 第二强调色，通常与 `--accent` 结合用于渐变。
  - `--danger`: 危险或错误状态的颜色，用于错误提示和删除按钮。
- **阴影 (Shadows)**:
  - `--shadow`: 标准卡片阴影。
  - `--shadow-sm`: 更细微的阴影，用于页眉等元素。
- **边框 (Borders)**:
  - `--border`: 标准边框颜色，通常是半透明的深色。

## 3. 布局系统 (Layout)

- **`.app-shell`**: 应用的主容器，通过 `width: min(1120px, 92vw)` 和 `margin: 0 auto` 实现响应式的居中布局。
- **网格系统**: 大量使用 CSS Grid 来实现灵活的组件布局，例如：
  - `.activity-grid`: 两列布局的活动卡片网格。
  - `.detail-grid`: 用于详情页面的两列布局。
  - `.flow-grid`: 用于展示流程的自适应网格。

## 4. 命名约定 (BEM-like)

项目遵循一种类似于 BEM (Block-Element-Modifier) 的命名约定，以提高 CSS 的可读性和模块化。

- **块 (Block)**: 代表一个独立的组件，如 `.btn`, `.card`, `.field`。
- **元素 (Element)**: 组件的组成部分，使用双下划线 `__` 连接，如 `.activity-card__title`, `.modal__header`。
- **修饰符 (Modifier)**: 代表组件的不同状态或变体，使用双连字符 `--` 连接，如 `.btn--primary`, `.field--error`。

**示例**:

```css
/* 块 (Block) */
.btn { /* ... */ }

/* 修饰符 (Modifier) */
.btn--primary { /* ... */ }
.btn--ghost { /* ... */ }
```

## 5. 关键可复用样式

### 按钮 (`.btn`)

- **`.btn`**: 基础按钮样式，定义了 padding、圆角、字体和过渡效果。
- **`.btn--primary`**: 主要操作按钮，通常有主题色背景。
- **`.btn--ghost`**: “幽灵”按钮，透明背景，用于次要操作。
- **`.btn--danger`**: 危险操作按钮，使用 `--danger` 颜色。
- **`.btn--flat`**: 扁平按钮，无边框和阴影。
- **`.btn--icon`**: 纯图标按钮，通常为圆形或方形。

### 卡片 (`.card`)

- **`.activity-card`**: 活动列表中的卡片，包含边框、阴影和内部网格布局。
- **`.detail-card`**: 详情页右侧的信息卡片。
- **`.flow-card`**: 用于展示流程步骤的虚线边框卡片。

### 模态框 (`.modal`)

- **`.modal-backdrop`**: 半透明的背景遮罩，使用 `position: fixed` 和 `z-index` 覆盖整个页面。
- **`.modal`**: 模态框本身，具有圆角、阴影和背景色，并通过 `max-height` 和 `overflow: auto` 实现内部滚动。

### 表单 (`.form`, `.field`)

- **`.form`**: 定义了表单内部元素的间距。
- **`.field`**: 一个独立的表单字段容器，包含 `<span>` 标签和 `input`, `textarea` 等。
- **`.field--error`**: 应用于 `.field` 元素，当验证失败时，其内部的 `<span>` 和输入框会变为红色。
- **`.error-text`**: 显示在输入框下方的小字错误提示。

#### 表单校验提示用法

- 给字段容器加 `field--error`，触发红色边框与高亮。
- 在输入框下方放 `p.help-text.error-text` 作为通用的小字错误提示。
- 对非标准输入控件（如自定义上传框）可额外加 `input-error` 来显示红色边框。

示例：

```html
<div class="field field--error">
  <label>作品名</label>
  <input class="input-error" type="text" />
  <p class="help-text error-text">请填写作品名</p>
</div>
```
