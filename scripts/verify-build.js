#!/usr/bin/env node

/**
 * 构建验证脚本 - 验证 Vite 构建输出的完整性
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')
const distDir = join(projectRoot, 'dist')

console.log('🔍 验证构建输出...\n')

// 验证基本文件存在
const requiredFiles = [
  'index.html',
  'vite.svg',
  'sw.js',
  'background-worker.js'
]

console.log('📁 检查基本文件:')
let hasErrors = false

for (const file of requiredFiles) {
  const filePath = join(distDir, file)
  if (existsSync(filePath)) {
    console.log(`  ✅ ${file}`)
  } else {
    console.log(`  ❌ ${file} - 文件不存在`)
    hasErrors = true
  }
}

// 验证 assets 目录结构
const assetsDir = join(distDir, 'assets')
if (existsSync(assetsDir)) {
  console.log('\n📦 检查 assets 目录结构:')
  
  const expectedDirs = ['chunks', 'styles', 'vendors']
  for (const dir of expectedDirs) {
    const dirPath = join(assetsDir, dir)
    if (existsSync(dirPath)) {
      const files = readdirSync(dirPath)
      console.log(`  ✅ ${dir}/ (${files.length} 个文件)`)
    } else {
      console.log(`  ❌ ${dir}/ - 目录不存在`)
      hasErrors = true
    }
  }
} else {
  console.log('\n❌ assets 目录不存在')
  hasErrors = true
}

// 验证 index.html 中的模块引用
console.log('\n🔗 检查 index.html 模块引用:')
try {
  const indexHtml = readFileSync(join(distDir, 'index.html'), 'utf-8')
  
  // 检查主入口文件
  const mainScriptMatch = indexHtml.match(/src="([^"]+index-[^"]+\.js)"/)
  if (mainScriptMatch) {
    const mainScript = mainScriptMatch[1].replace(/^\//, '')
    const mainScriptPath = join(distDir, mainScript)
    if (existsSync(mainScriptPath)) {
      console.log(`  ✅ 主入口文件: ${mainScript}`)
    } else {
      console.log(`  ❌ 主入口文件不存在: ${mainScript}`)
      hasErrors = true
    }
  } else {
    console.log('  ❌ 未找到主入口文件引用')
    hasErrors = true
  }
  
  // 检查预加载模块
  const preloadMatches = indexHtml.matchAll(/href="([^"]+\.js)"/g)
  let preloadCount = 0
  for (const match of preloadMatches) {
    const preloadScript = match[1].replace(/^\//, '')
    const preloadPath = join(distDir, preloadScript)
    if (existsSync(preloadPath)) {
      console.log(`  ✅ 预加载模块: ${preloadScript}`)
      preloadCount++
    } else {
      console.log(`  ❌ 预加载模块不存在: ${preloadScript}`)
      hasErrors = true
    }
  }
  
  console.log(`  📊 总计 ${preloadCount} 个预加载模块`)
  
} catch (error) {
  console.log(`  ❌ 读取 index.html 失败: ${error.message}`)
  hasErrors = true
}

// 验证 JavaScript 文件的 MIME 类型兼容性
console.log('\n🎭 检查 JavaScript 文件:')
try {
  const checkJsFiles = (dir, prefix = '') => {
    const items = readdirSync(dir)
    let jsCount = 0
    
    for (const item of items) {
      const itemPath = join(dir, item)
      const stat = statSync(itemPath)
      
      if (stat.isDirectory()) {
        jsCount += checkJsFiles(itemPath, `${prefix}${item}/`)
      } else if (item.endsWith('.js')) {
        // 检查文件内容是否为有效的 JavaScript
        try {
          const content = readFileSync(itemPath, 'utf-8')
          if (content.trim().length === 0) {
            console.log(`  ⚠️  空文件: ${prefix}${item}`)
          } else if (content.startsWith('<!DOCTYPE html>') || content.startsWith('<html')) {
            console.log(`  ❌ HTML 内容在 JS 文件中: ${prefix}${item}`)
            hasErrors = true
          } else {
            console.log(`  ✅ ${prefix}${item} (${(content.length / 1024).toFixed(1)}KB)`)
          }
          jsCount++
        } catch (error) {
          console.log(`  ❌ 读取失败: ${prefix}${item} - ${error.message}`)
          hasErrors = true
        }
      }
    }
    
    return jsCount
  }
  
  const totalJsFiles = checkJsFiles(assetsDir)
  console.log(`  📊 总计 ${totalJsFiles} 个 JavaScript 文件`)
  
} catch (error) {
  console.log(`  ❌ 检查 JavaScript 文件失败: ${error.message}`)
  hasErrors = true
}

// 验证 CSS 文件
console.log('\n🎨 检查 CSS 文件:')
try {
  const stylesDir = join(assetsDir, 'styles')
  if (existsSync(stylesDir)) {
    const cssFiles = readdirSync(stylesDir).filter(f => f.endsWith('.css'))
    console.log(`  📊 总计 ${cssFiles.length} 个 CSS 文件`)
    
    for (const cssFile of cssFiles.slice(0, 5)) { // 只显示前5个
      const cssPath = join(stylesDir, cssFile)
      const content = readFileSync(cssPath, 'utf-8')
      console.log(`  ✅ ${cssFile} (${(content.length / 1024).toFixed(1)}KB)`)
    }
    
    if (cssFiles.length > 5) {
      console.log(`  ... 还有 ${cssFiles.length - 5} 个 CSS 文件`)
    }
  }
} catch (error) {
  console.log(`  ❌ 检查 CSS 文件失败: ${error.message}`)
  hasErrors = true
}

// 计算总体构建大小
console.log('\n📊 构建统计:')
try {
  const calculateSize = (dir) => {
    let totalSize = 0
    const items = readdirSync(dir)
    
    for (const item of items) {
      const itemPath = join(dir, item)
      const stat = statSync(itemPath)
      
      if (stat.isDirectory()) {
        totalSize += calculateSize(itemPath)
      } else {
        totalSize += stat.size
      }
    }
    
    return totalSize
  }
  
  const totalSize = calculateSize(distDir)
  console.log(`  📦 总构建大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`)
  
  const assetsSize = calculateSize(assetsDir)
  console.log(`  🎯 Assets 大小: ${(assetsSize / 1024 / 1024).toFixed(2)} MB`)
  
} catch (error) {
  console.log(`  ❌ 计算构建大小失败: ${error.message}`)
}

// 最终结果
console.log('\n' + '='.repeat(50))
if (hasErrors) {
  console.log('❌ 构建验证失败 - 发现问题需要修复')
  process.exit(1)
} else {
  console.log('✅ 构建验证通过 - 所有文件正常')
  console.log('\n🚀 可以安全部署到 Vercel')
}