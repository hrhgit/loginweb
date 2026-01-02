# 报名表单加载问题排查指南

## 常见问题及解决方案

### 1. 报名表单完全不显示

**可能原因：**
- 活动未配置报名表单
- 用户未登录
- 网络连接问题
- 缓存问题

**解决步骤：**

1. **检查登录状态**
   ```
   确保用户已登录，未登录用户无法查看报名表单
   ```

2. **检查活动配置**
   ```
   活动管理员需要在活动编辑页面配置报名表单
   ```

3. **清除缓存**
   ```javascript
   // 在浏览器控制台执行
   __REGISTRATION_FORM_FIX__.fixCache('活动ID', '用户ID')
   ```

4. **强制刷新数据**
   ```javascript
   // 在浏览器控制台执行
   __REGISTRATION_FORM_FIX__.forceRefresh(registrationDataQuery)
   ```

### 2. 报名表单显示空白

**可能原因：**
- 所有问题都被依赖条件隐藏
- 表单数据加载失败
- 组件渲染问题

**解决步骤：**

1. **检查问题依赖条件**
   ```
   检查表单问题的依赖设置，确保至少有一个问题是可见的
   ```

2. **查看控制台错误**
   ```
   打开浏览器开发者工具，查看是否有JavaScript错误
   ```

3. **使用调试工具**
   ```javascript
   // 在浏览器控制台执行
   __REGISTRATION_FORM_DEBUG__.logDebug(debugInfo)
   ```

### 3. 报名表单加载缓慢

**可能原因：**
- 网络连接较慢
- 服务器响应延迟
- 缓存配置问题

**解决步骤：**

1. **检查网络状态**
   ```
   确保网络连接正常，可以尝试刷新页面
   ```

2. **查看缓存状态**
   ```javascript
   // 在浏览器控制台执行
   __VUE_QUERY_DEBUG__.getCacheStats()
   ```

3. **优化缓存**
   ```javascript
   // 在浏览器控制台执行
   __VUE_QUERY_DEBUG__.optimizeCache()
   ```

### 4. 报名表单数据不更新

**可能原因：**
- 缓存数据过期
- 数据同步问题
- 网络请求失败

**解决步骤：**

1. **手动刷新数据**
   ```javascript
   // 在浏览器控制台执行
   registrationDataQuery.refetchAll()
   ```

2. **清除相关缓存**
   ```javascript
   // 在浏览器控制台执行
   __REGISTRATION_FORM_FIX__.fixCache('活动ID', '用户ID')
   ```

## 开发环境调试工具

### 1. 报名表单调试工具

```javascript
// 查看详细调试信息
__REGISTRATION_FORM_DEBUG__.logDebug(debugInfo)

// 收集调试信息
const debugInfo = __REGISTRATION_FORM_DEBUG__.collectDebugInfo(params)

// 生成修复建议
const suggestions = __REGISTRATION_FORM_DEBUG__.generateSuggestions(debugInfo)
```

### 2. 报名表单修复工具

```javascript
// 修复缓存问题
__REGISTRATION_FORM_FIX__.fixCache(eventId, userId)

// 强制刷新数据
__REGISTRATION_FORM_FIX__.forceRefresh(registrationDataQuery)

// 自动诊断并修复
__REGISTRATION_FORM_FIX__.diagnoseAndFix(params)
```

### 3. Vue Query 调试工具

```javascript
// 查看缓存统计
__VUE_QUERY_DEBUG__.getCacheStats()

// 清空所有缓存
__VUE_QUERY_DEBUG__.clearCache()

// 优化缓存
__VUE_QUERY_DEBUG__.optimizeCache()
```

## 预防措施

### 1. 正确配置活动

- 确保活动状态为"已发布"
- 正确配置报名表单问题
- 设置合理的依赖条件

### 2. 网络优化

- 使用稳定的网络连接
- 避免在网络不稳定时操作
- 定期清理浏览器缓存

### 3. 缓存管理

- 遵循项目缓存规范
- 合理设置缓存时间
- 及时清除过期缓存

## 联系技术支持

如果以上方法都无法解决问题，请联系技术支持并提供以下信息：

1. **错误描述**
   - 具体的错误现象
   - 出现错误的步骤
   - 错误发生的时间

2. **环境信息**
   - 浏览器类型和版本
   - 操作系统
   - 网络环境

3. **调试信息**
   ```javascript
   // 在浏览器控制台执行并提供结果
   console.log('Debug Info:', __REGISTRATION_FORM_DEBUG__.collectDebugInfo(params))
   console.log('Cache Stats:', __VUE_QUERY_DEBUG__.getCacheStats())
   ```

4. **控制台错误**
   - 浏览器开发者工具中的错误信息
   - 网络请求失败的详细信息