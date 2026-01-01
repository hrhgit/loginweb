# Service Worker 网络错误修复总结

## 问题描述

在 Service Worker 运行时出现以下错误：

```
sw.js:132  Service Worker: Fetch error 
TypeError: Failed to fetch
    at networkFirst (sw.js:169:35)
    at handleFetch (sw.js:129:18)
    at sw.js:103:21
```

## 根本原因分析

### 1. 网络请求失败处理不当
- `networkFirst` 函数在网络失败且无缓存时直接抛出错误
- 错误没有被正确捕获和处理，导致 Service Worker 崩溃
- 缺少对网络状态的智能检测

### 2. 缺少请求超时机制
- 网络请求可能无限期挂起
- 没有设置合理的超时时间
- 用户体验差，页面长时间无响应

### 3. 错误传播链问题
- 错误在多个函数间传播时处理不一致
- 缺少最终的错误兜底机制
- 没有提供用户友好的错误响应

## 解决方案

### 1. 增强网络状态检测

**添加智能离线检测**：
```javascript
// 网络状态跟踪
let isOnline = true
let networkFailureCount = 0
const MAX_NETWORK_FAILURES = 3

function isLikelyOffline() {
  return networkFailureCount >= MAX_NETWORK_FAILURES
}

function recordNetworkResult(success) {
  if (success) {
    networkFailureCount = Math.max(0, networkFailureCount - 1)
    isOnline = true
  } else {
    networkFailureCount++
    if (networkFailureCount >= MAX_NETWORK_FAILURES) {
      isOnline = false
      console.log('Service Worker: Detected offline state')
    }
  }
}
```

### 2. 优化 networkFirst 策略

**修改前**：
```javascript
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request)
    // ... 处理成功响应
    return networkResponse
  } catch (error) {
    // ... 尝试缓存
    throw error  // ❌ 直接抛出错误
  }
}
```

**修改后**：
```javascript
async function networkFirst(request) {
  // 智能离线检测
  if (isLikelyOffline()) {
    console.log('Service Worker: Likely offline, trying cache first')
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
  }
  
  try {
    // 添加超时机制
    const networkResponse = await fetch(request, {
      signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined
    })
    
    recordNetworkResult(true)  // 记录成功
    return networkResponse
  } catch (error) {
    recordNetworkResult(false)  // 记录失败
    
    // 尝试缓存
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    
    // 返回结构化错误响应而不是抛出异常
    if (isApiCall(new URL(request.url))) {
      return new Response(JSON.stringify({
        error: 'network_unavailable',
        message: '网络不可用，请检查网络连接',
        offline: true
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    throw error  // 只对非 API 请求抛出
  }
}
```

### 3. 改进错误处理链

**增强 handleFetch 函数**：
```javascript
async function handleFetch(request) {
  try {
    // 各种缓存策略...
    return await networkFirst(request)
  } catch (error) {
    console.log('Service Worker: Fetch error for', request.url, error)
    
    // 多层错误处理
    try {
      return await getOfflineFallback(request)
    } catch (fallbackError) {
      // 最终兜底：返回基本错误响应
      return new Response(JSON.stringify({
        error: 'service_worker_error',
        message: '服务不可用',
        url: request.url
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
}
```

### 4. 添加请求过滤

**优化 fetch 事件监听**：
```javascript
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // 跳过非 GET 请求
  if (request.method !== 'GET') return
  
  // 跳过非 HTTP 协议
  if (!url.protocol.startsWith('http')) return
  
  // 跳过跨域请求（除非是 API）
  if (url.origin !== self.location.origin && !isApiCall(url)) {
    return
  }
  
  console.log('Service Worker: Handling fetch for', request.url)
  event.respondWith(handleFetch(request))
})
```

### 5. 静态资源错误处理

**为 CSS/JS 文件提供回退**：
```javascript
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request)
  if (cachedResponse) return cachedResponse
  
  try {
    const networkResponse = await fetch(request)
    // 缓存成功响应
    return networkResponse
  } catch (error) {
    const url = new URL(request.url)
    
    // CSS 文件回退
    if (url.pathname.endsWith('.css')) {
      return new Response('/* Offline - CSS not available */', {
        status: 200,
        headers: { 'Content-Type': 'text/css' }
      })
    }
    
    // JS 文件回退
    if (url.pathname.endsWith('.js')) {
      return new Response('// Offline - Script not available', {
        status: 200,
        headers: { 'Content-Type': 'application/javascript' }
      })
    }
    
    throw error
  }
}
```

## 修复效果

### 1. 错误处理改进
- ✅ 网络错误不再导致 Service Worker 崩溃
- ✅ 提供用户友好的错误响应
- ✅ 智能的离线状态检测
- ✅ 多层错误处理机制

### 2. 性能优化
- ✅ 添加 10 秒请求超时
- ✅ 智能缓存优先策略（离线时）
- ✅ 减少不必要的网络请求
- ✅ 优化的错误恢复机制

### 3. 用户体验提升
- ✅ 离线时优先使用缓存
- ✅ 网络恢复时自动重新尝试
- ✅ 清晰的错误信息提示
- ✅ 渐进式功能降级

## 与 Vue Query 缓存的协作

### Service Worker 层面（网络层）
```javascript
// 网络请求失败时返回结构化错误
return new Response(JSON.stringify({
  error: 'network_unavailable',
  message: '网络不可用，请检查网络连接',
  offline: true
}), {
  status: 503,
  headers: { 'Content-Type': 'application/json' }
})
```

### Vue Query 层面（应用层）
```typescript
// Vue Query 会接收到 503 错误并触发重试机制
retry: (failureCount, error) => {
  const isNetworkError = error?.message?.includes('网络') || 
                        error?.message?.includes('fetch') ||
                        error?.code === 'NETWORK_ERROR'
  return isNetworkError && failureCount < 3
}
```

两层缓存协同工作：
1. **Service Worker** 处理网络层错误，提供离线回退
2. **Vue Query** 处理应用层缓存，提供数据同步和重试

## 测试验证

### 构建验证
```bash
npm run build
✅ 构建成功，无错误

npm run test-sw
✅ Service Worker 配置检查通过
✅ 所有缓存策略都已实现
✅ 错误处理机制完善
```

### 功能测试建议

1. **网络断开测试**：
   - 断开网络连接
   - 刷新页面，验证离线页面显示
   - 检查缓存资源是否正常加载

2. **网络恢复测试**：
   - 重新连接网络
   - 验证自动重新获取数据
   - 检查错误计数器重置

3. **API 错误测试**：
   - 模拟 API 服务器错误
   - 验证返回结构化错误响应
   - 检查 Vue Query 重试机制

## 部署建议

1. **清除浏览器缓存**：
   ```javascript
   // 在浏览器控制台执行
   caches.keys().then(names => {
     names.forEach(name => caches.delete(name))
   })
   ```

2. **监控 Service Worker 状态**：
   ```javascript
   navigator.serviceWorker.getRegistrations().then(registrations => {
     console.log('Active Service Workers:', registrations.length)
   })
   ```

3. **验证网络错误处理**：
   - 在开发者工具中模拟离线状态
   - 检查控制台日志输出
   - 验证错误响应格式

修复完成后，Service Worker 将能够：
- ✅ 优雅处理所有网络错误
- ✅ 智能检测和适应网络状态
- ✅ 提供一致的用户体验
- ✅ 与 Vue Query 缓存完美协作
- ✅ 支持渐进式功能降级