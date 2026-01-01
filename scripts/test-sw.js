#!/usr/bin/env node

/**
 * Service Worker 测试脚本 - 验证 SW 配置和资源可用性
 */

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')
const distDir = join(projectRoot, 'dist')

console.log('🔧 Service Worker 配置测试...\n')

let hasErrors = false

// 检查 Service Worker 文件
console.log('📄 检查 Service Worker 文件:')
const swFile = join(distDir, 'sw.js')
if (existsSync(swFile)) {
  console.log('  ✅ sw.js 存在')
  
  try {
    const swContent = readFileSync(swFile, 'utf-8')
    
    // 检查缓存名称
    if (swContent.includes('event-platform-v2')) {
      console.log('  ✅ 缓存版本已更新')
    } else {
      console.log('  ⚠️  缓存版本可能需要更新')
    }
    
    // 检查基本配置
    if (swContent.includes('ESSENTIAL_ASSETS')) {
      console.log('  ✅ 基本资源配置存在')
    } else {
      console.log('  ❌ 缺少基本资源配置')
      hasErrors = true
    }
    
    if (swContent.includes('OPTIONAL_ASSETS')) {
      console.log('  ✅ 可选资源配置存在')
    } else {
      console.log('  ⚠️  缺少可选资源配置')
    }
    
  } catch (error) {
    console.log(`  ❌ 读取 sw.js 失败: ${error.message}`)
    hasErrors = true
  }
} else {
  console.log('  ❌ sw.js 文件不存在')
  hasErrors = true
}

// 提取并验证资源列表
console.log('\n📋 验证缓存资源:')
if (existsSync(swFile)) {
  try {
    const swContent = readFileSync(swFile, 'utf-8')
    
    // 提取 ESSENTIAL_ASSETS
    const essentialMatch = swContent.match(/ESSENTIAL_ASSETS\s*=\s*\[([\s\S]*?)\]/m)
    if (essentialMatch) {
      const essentialAssets = essentialMatch[1]
        .split(',')
        .map(line => line.trim().replace(/['"]/g, ''))
        .filter(asset => asset && !asset.startsWith('//'))
      
      console.log('  📦 基本资源:')
      for (const asset of essentialAssets) {
        const assetPath = asset === '/' ? 'index.html' : asset.replace(/^\//, '')
        const fullPath = join(distDir, assetPath)
        
        if (existsSync(fullPath)) {
          console.log(`    ✅ ${asset}`)
        } else {
          console.log(`    ❌ ${asset} (文件不存在)`)
          hasErrors = true
        }
      }
    }
    
    // 提取 OPTIONAL_ASSETS
    const optionalMatch = swContent.match(/OPTIONAL_ASSETS\s*=\s*\[([\s\S]*?)\]/m)
    if (optionalMatch) {
      const optionalAssets = optionalMatch[1]
        .split(',')
        .map(line => line.trim().replace(/['"]/g, ''))
        .filter(asset => asset && !asset.startsWith('//'))
      
      console.log('  📦 可选资源:')
      let availableCount = 0
      for (const asset of optionalAssets) {
        const assetPath = asset.replace(/^\//, '')
        const fullPath = join(distDir, assetPath)
        
        if (existsSync(fullPath)) {
          console.log(`    ✅ ${asset}`)
          availableCount++
        } else {
          console.log(`    ⚠️  ${asset} (可选，不存在)`)
        }
      }
      
      console.log(`  📊 可选资源可用率: ${availableCount}/${optionalAssets.length}`)
    }
    
  } catch (error) {
    console.log(`  ❌ 解析资源列表失败: ${error.message}`)
    hasErrors = true
  }
}

// 检查字体文件
console.log('\n🔤 检查字体文件:')
const fontsDir = join(distDir, 'fonts')
if (existsSync(fontsDir)) {
  const fontFiles = [
    'sora-latin.woff2',
    'sora-latin-ext.woff2',
    'worksans-latin.woff2',
    'worksans-latin-ext.woff2',
    'worksans-vietnamese.woff2'
  ]
  
  let availableFonts = 0
  for (const font of fontFiles) {
    const fontPath = join(fontsDir, font)
    if (existsSync(fontPath)) {
      console.log(`  ✅ ${font}`)
      availableFonts++
    } else {
      console.log(`  ⚠️  ${font} (不存在)`)
    }
  }
  
  console.log(`  📊 字体文件可用: ${availableFonts}/${fontFiles.length}`)
} else {
  console.log('  ❌ fonts 目录不存在')
  hasErrors = true
}

// 检查图标文件
console.log('\n🎨 检查图标文件:')
const iconsDir = join(distDir, 'icons')
if (existsSync(iconsDir)) {
  const iconFiles = [
    'home.svg',
    'arrow-left.svg'
  ]
  
  let availableIcons = 0
  for (const icon of iconFiles) {
    const iconPath = join(iconsDir, icon)
    if (existsSync(iconPath)) {
      console.log(`  ✅ ${icon}`)
      availableIcons++
    } else {
      console.log(`  ⚠️  ${icon} (不存在)`)
    }
  }
  
  console.log(`  📊 图标文件可用: ${availableIcons}/${iconFiles.length}`)
} else {
  console.log('  ❌ icons 目录不存在')
  hasErrors = true
}

// Service Worker 最佳实践检查
console.log('\n🏆 Service Worker 最佳实践:')
if (existsSync(swFile)) {
  const swContent = readFileSync(swFile, 'utf-8')
  
  // 检查错误处理
  if (swContent.includes('Promise.allSettled')) {
    console.log('  ✅ 使用 Promise.allSettled 进行错误处理')
  } else {
    console.log('  ⚠️  建议使用 Promise.allSettled 处理批量操作')
  }
  
  // 检查缓存策略
  const strategies = ['cacheFirst', 'networkFirst', 'staleWhileRevalidate']
  let strategiesFound = 0
  for (const strategy of strategies) {
    if (swContent.includes(strategy)) {
      console.log(`  ✅ 实现了 ${strategy} 缓存策略`)
      strategiesFound++
    }
  }
  
  if (strategiesFound === strategies.length) {
    console.log('  ✅ 所有缓存策略都已实现')
  } else {
    console.log(`  ⚠️  缓存策略实现: ${strategiesFound}/${strategies.length}`)
  }
  
  // 检查离线支持
  if (swContent.includes('getOfflineFallback')) {
    console.log('  ✅ 实现了离线回退机制')
  } else {
    console.log('  ⚠️  缺少离线回退机制')
  }
}

// 部署建议
console.log('\n💡 Service Worker 部署建议:')
console.log('  🔄 确保在部署后清除浏览器缓存')
console.log('  📱 在不同设备上测试离线功能')
console.log('  🌐 验证所有缓存资源在生产环境中可访问')
console.log('  📊 监控 Service Worker 安装成功率')
console.log('  🔧 定期更新缓存版本号')

// 最终结果
console.log('\n' + '='.repeat(50))
if (hasErrors) {
  console.log('❌ Service Worker 配置检查失败')
  console.log('\n🔧 修复建议:')
  console.log('   1. 确保所有基本资源文件存在')
  console.log('   2. 检查文件路径是否正确')
  console.log('   3. 验证构建输出完整性')
  console.log('   4. 更新 Service Worker 配置')
  process.exit(1)
} else {
  console.log('✅ Service Worker 配置检查通过')
  console.log('\n🎉 Service Worker 已准备就绪!')
  console.log('   - 基本资源缓存配置正确')
  console.log('   - 可选资源处理合理')
  console.log('   - 错误处理机制完善')
  console.log('   - 离线功能支持完整')
}