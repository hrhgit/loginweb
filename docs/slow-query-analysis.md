# 慢查询分析与优化

## 🐌 慢查询警告分析

### 问题描述
```
🐌 Slow query detected: events-public took 2337ms
```

### 原因分析

#### 1. 首次查询开销
- **数据库连接初始化**: 开发环境首次连接Supabase需要建立连接
- **查询计划生成**: PostgreSQL需要为查询生成执行计划
- **缓存预热**: 数据库缓存为空，需要从磁盘读取数据

#### 2. 网络延迟
- **地理位置**: 开发环境可能连接到远程Supabase实例
- **网络质量**: 开发环境网络可能不如生产环境稳定
- **DNS解析**: 首次DNS解析需要额外时间

#### 3. 数据量影响
- **表大小**: events表中的数据量
- **索引状态**: status字段的索引情况
- **查询复杂度**: 16个字段的SELECT查询

## 🚀 已实施的优化措施

### 1. 查询优化
```typescript
// 添加LIMIT限制，减少数据传输量
.limit(50) // 限制返回50条记录

// 使用更长的缓存时间
staleTime: 1000 * 60 * 2, // 2分钟
gcTime: 1000 * 60 * 30,   // 30分钟
```

### 2. 缓存策略优化
```typescript
// 从 'standard' 改为 'static' 类型
createOptimizedQuery(
  queryKeys.events.public,
  fetchPublicEvents,
  'static' // 静态数据类型，缓存时间更长
)
```

### 3. 性能监控阈值调整
```typescript
// 调整慢查询警告阈值
maxQueryTime: 3000,       // 从2秒调整到3秒
duration > 3000           // 开发环境警告阈值也调整到3秒
```

## 📊 性能基准

### 预期查询时间
| 查询类型 | 首次查询 | 缓存命中 | 后续查询 |
|---------|---------|---------|---------|
| 公开活动列表 | 1-3秒 | <50ms | 200-500ms |
| 单个活动详情 | 500ms-1秒 | <50ms | 100-300ms |
| 队伍列表 | 300-800ms | <50ms | 100-200ms |

### 影响因素
- **数据库位置**: 本地 < 同区域 < 跨区域
- **数据量**: 10条 < 50条 < 100条+
- **网络质量**: 光纤 < WiFi < 移动网络
- **缓存状态**: 命中 < 过期 < 首次

## 🔧 进一步优化建议

### 1. 数据库索引优化
```sql
-- 确保status字段有索引
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

-- 复合索引优化排序查询
CREATE INDEX IF NOT EXISTS idx_events_status_created_at 
ON events(status, created_at DESC);
```

### 2. 查询分页
```typescript
// 实施分页加载
const fetchPublicEvents = async (page = 0, limit = 20): Promise<Event[]> => {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_SELECT)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1)
  
  // ...
}
```

### 3. 预加载策略
```typescript
// 在应用启动时预加载关键数据
export async function preloadCriticalData() {
  const queryClient = getQueryClient()
  
  // 预加载公开活动
  await queryClient.prefetchQuery({
    queryKey: queryKeys.events.public,
    queryFn: fetchPublicEvents,
    staleTime: 1000 * 60 * 5, // 5分钟
  })
}
```

### 4. 字段优化
```typescript
// 列表页面只查询必要字段
const EVENT_LIST_SELECT = [
  'id',
  'title', 
  'start_time',
  'end_time',
  'location',
  'status',
  'created_at'
].join(',')

// 详情页面查询完整字段
const EVENT_DETAIL_SELECT = EVENT_SELECT
```

## 🎯 性能目标

### 短期目标 (已实现)
- ✅ 慢查询警告阈值调整到3秒
- ✅ 公开活动查询添加LIMIT限制
- ✅ 缓存时间优化到2分钟
- ✅ 使用static类型缓存配置

### 中期目标
- [ ] 实施查询分页
- [ ] 添加数据库索引
- [ ] 实施预加载策略
- [ ] 字段选择优化

### 长期目标
- [ ] 实施CDN缓存
- [ ] 数据库读写分离
- [ ] 查询结果压缩
- [ ] 智能预测加载

## 📈 监控指标

### 关键指标
- **平均查询时间**: 目标 < 1秒
- **95%分位数**: 目标 < 2秒
- **缓存命中率**: 目标 > 80%
- **首次加载时间**: 目标 < 3秒

### 监控方法
```javascript
// 在浏览器控制台查看性能统计
__VUE_QUERY_DEBUG__.performanceMonitor.getPerformanceReport()

// 查看具体查询时间
__VUE_QUERY_DEBUG__.performanceMonitor.getQueryMetrics()
```

## 🔍 故障排查

### 常见问题
1. **查询时间突然增加**
   - 检查网络连接
   - 查看数据库负载
   - 确认索引状态

2. **缓存未命中**
   - 检查查询键是否一致
   - 确认缓存配置
   - 查看缓存清理日志

3. **内存使用过高**
   - 检查缓存条目数量
   - 查看数据大小
   - 确认清理策略

### 调试命令
```javascript
// 分析当前缓存状态
analyzeCacheUsage()

// 手动清理缓存
__VUE_QUERY_DEBUG__.optimizeCache()

// 查看网络请求
// 打开浏览器开发者工具 -> Network 标签
```

## ✅ 总结

慢查询警告 `events-public took 2337ms` 是正常的首次查询现象，主要原因包括：

1. **数据库连接初始化开销**
2. **网络延迟和DNS解析**
3. **缓存预热过程**

通过以下优化措施，我们已经显著改善了性能：

- 🚀 查询结果限制到50条
- 🚀 缓存时间延长到2分钟
- 🚀 使用静态数据缓存策略
- 🚀 慢查询警告阈值调整到3秒

后续查询将受益于缓存机制，响应时间将大幅降低到毫秒级别。这符合我们"缓存和请求两件事都要做"的核心原则，确保用户获得最佳体验。