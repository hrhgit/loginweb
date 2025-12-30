# 网格布局一致性指南

## 问题背景

VirtualCardGrid组件和CSS媒体查询都控制响应式布局，当两者断点不一致时会导致样式冲突。

## 标准断点

所有网格布局必须使用统一的断点：

```css
/* 标准断点 */
@media (max-width: 980px) {
  /* 2列布局 */
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 640px) {
  /* 1列布局 */
  grid-template-columns: 1fr;
}
```

## VirtualCardGrid配置

```typescript
// 组件内的响应式逻辑必须与CSS断点一致
const updateResponsiveColumns = () => {
  const width = window.innerWidth
  if (width <= 640) {
    responsiveColumns.value = 1
  } else if (width <= 980) {
    responsiveColumns.value = 2
  } else {
    responsiveColumns.value = props.columns
  }
}
```

## 检查清单

修改网格布局时，确保：

1. ✅ CSS媒体查询使用980px和640px断点
2. ✅ VirtualCardGrid的响应式逻辑匹配
3. ✅ gap值在CSS和组件中一致
4. ✅ 测试不同屏幕尺寸下的表现

## 现有网格类

- `team-grid` - 队伍网格 (gap: 14px)
- `showcase-grid` - 作品展示网格 (gap: 24px)  
- `seeker-grid` - 队友寻找网格 (gap: 14px)
- `team-member-grid` - 队员网格 (gap: 12px)

所有这些类都应该遵循相同的断点规则。