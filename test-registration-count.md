# 活动报名人数功能测试指南

## 功能概述

我已经为你的活动管理平台添加了虚拟列功能，可以直接查询活动的报名总人数。这个功能包括：

### 1. 数据库层面的优化

#### 创建的数据库函数：
- `get_event_registration_count(event_uuid uuid)` - 获取单个活动的报名人数
- `get_events_with_registration_counts()` - 批量获取所有活动及其报名人数
- `events_with_registration_count` 视图 - 包含报名人数的活动视图

#### 优势：
- **性能优化**：使用数据库函数比应用层计算更高效
- **数据一致性**：确保报名人数的准确性
- **缓存友好**：与 Vue Query 缓存策略完美配合

### 2. 前端组合函数

#### 新增的组合函数：
- `useEventsWithRegistrationCount()` - 获取所有活动及报名人数
- `usePublicEventsWithRegistrationCount()` - 获取公开活动及报名人数  
- `useMyEventsWithRegistrationCount(userId)` - 获取用户创建的活动及报名人数
- `useEventRegistrationCount(eventId)` - 获取单个活动的报名人数

#### 更新的组合函数：
- `useRegistrationCount(eventId)` - 现在使用数据库函数优化性能

### 3. 组件更新

#### EventCard 组件：
- 新增 `showRegistrationCount` 属性
- 显示报名人数（如：`9 人已报名`）
- 支持带报名人数的活动数据类型

#### 页面组件：
- `EventsPage.vue` - 公开活动列表显示报名人数
- `MyEventsPage.vue` - 我的活动列表显示报名人数
- `EventDetailPage.vue` - 活动详情页已有报名人数显示

### 4. 缓存管理

#### 遵循项目缓存规范：
- **stale-while-revalidate** 策略，30秒缓存时间
- **智能缓存失效**：报名操作后自动清除相关缓存
- **网络错误重试**：最多重试3次
- **离线支持**：显示缓存数据

## 测试步骤

### 1. 数据库函数测试

在 Supabase SQL 编辑器中运行：

```sql
-- 测试单个活动报名人数
SELECT get_event_registration_count('your-event-id-here');

-- 测试批量获取活动和报名人数
SELECT id, title, registration_count 
FROM get_events_with_registration_counts() 
LIMIT 5;

-- 测试视图
SELECT id, title, registration_count 
FROM events_with_registration_count 
LIMIT 5;
```

### 2. 前端功能测试

#### 活动列表页面测试：
1. 访问 `/events` 页面
2. 检查活动卡片是否显示报名人数
3. 验证报名人数格式：`X 人已报名`

#### 我的活动页面测试：
1. 以管理员身份登录
2. 访问 `/events/mine` 页面  
3. 检查活动卡片是否显示报名人数

#### 活动详情页面测试：
1. 访问任意活动详情页 `/events/{id}`
2. 在活动信息区域查看 `已报名人数` 字段
3. 验证数字显示正确

### 3. 缓存行为测试

#### 缓存更新测试：
1. 查看活动的报名人数
2. 进行报名操作
3. 验证报名人数是否立即更新（缓存失效）

#### 网络状态测试：
1. 断开网络连接
2. 查看是否显示缓存的报名人数
3. 重新连接网络，验证数据是否更新

### 4. 性能测试

#### 加载性能：
1. 打开浏览器开发者工具 Network 标签
2. 访问活动列表页面
3. 验证只有一个数据库请求（批量获取）
4. 检查响应时间是否合理

#### 缓存效果：
1. 首次访问页面记录加载时间
2. 30秒内再次访问，应该使用缓存（无网络请求）
3. 30秒后访问，应该发起新请求更新数据

## 调试工具

### Vue Query 调试：
在浏览器控制台中使用：
```javascript
// 查看缓存统计
__VUE_QUERY_DEBUG__.getCacheStats()

// 清空所有缓存
__VUE_QUERY_DEBUG__.clearCache()

// 手动优化缓存
__VUE_QUERY_DEBUG__.optimizeCache()
```

### 网络状态监控：
- 查看 `NetworkStatusIndicator` 组件显示的网络状态
- 监控 `store.connectionQuality` 的变化
- 观察离线模式下的行为

## 预期结果

### 功能正常的标志：
- ✅ 活动卡片显示准确的报名人数
- ✅ 报名操作后人数立即更新
- ✅ 缓存策略按预期工作（30秒内使用缓存）
- ✅ 网络错误时有重试机制
- ✅ 离线时显示缓存数据

### 性能指标：
- ✅ 活动列表加载时间 < 2秒
- ✅ 报名人数更新延迟 < 500ms
- ✅ 缓存命中率 > 80%
- ✅ 网络请求数量最小化

## 故障排除

### 常见问题：

1. **报名人数不显示**
   - 检查数据库函数是否创建成功
   - 验证组件是否传递了 `showRegistrationCount={true}`

2. **报名后人数不更新**
   - 检查缓存失效逻辑是否正确执行
   - 验证 Vue Query 的 `invalidateQueries` 调用

3. **性能问题**
   - 检查是否使用了批量查询函数
   - 验证缓存配置是否正确

4. **网络错误**
   - 检查错误重试机制
   - 验证离线模式下的行为

## 后续优化建议

1. **实时更新**：考虑使用 Supabase 实时订阅来实现报名人数的实时更新
2. **数据分析**：添加报名趋势图表和统计信息
3. **通知系统**：在报名人数达到特定阈值时发送通知
4. **导出功能**：支持导出报名人数统计报告

这个实现遵循了项目的缓存管理规范，提供了高性能、用户友好的报名人数查询功能。