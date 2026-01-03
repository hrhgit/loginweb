// 缓存清理工具 - 复制到浏览器控制台运行

function clearAllCaches() {
  console.group('🧹 清理所有缓存')
  
  try {
    // 1. 清除 Vue Query 缓存
    if (window.__VUE_QUERY_CLIENT__) {
      console.log('🗑️ 清除 Vue Query 缓存...')
      window.__VUE_QUERY_CLIENT__.clear()
      console.log('✅ Vue Query 缓存已清除')
    }
    
    // 2. 清除浏览器存储
    console.log('🗑️ 清除浏览器存储...')
    localStorage.clear()
    sessionStorage.clear()
    console.log('✅ 浏览器存储已清除')
    
    // 3. 清除 Service Worker 缓存
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name)
        })
        console.log('✅ Service Worker 缓存已清除')
      })
    }
    
    // 4. 强制刷新页面
    console.log('🔄 3秒后将自动刷新页面...')
    setTimeout(() => {
      window.location.reload(true)
    }, 3000)
    
    console.log('✅ 缓存清理完成')
    
  } catch (error) {
    console.error('❌ 缓存清理失败:', error)
  } finally {
    console.groupEnd()
  }
}

// 运行清理
clearAllCaches()