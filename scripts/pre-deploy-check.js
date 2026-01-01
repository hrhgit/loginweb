#!/usr/bin/env node

/**
 * 部署前检查脚本 - 确保所有配置和构建都正确
 */

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

console.log('🚀 部署前检查...\n')

let hasErrors = false

// 检查环境变量文件
console.log('🔐 检查环境配置:')
const envFile = join(projectRoot, '.env')
if (existsSync(envFile)) {
  const envContent = readFileSync(envFile, 'utf-8')
  const requiredVars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
  
  for (const varName of requiredVars) {
    if (envContent.includes(varName)) {
      console.log(`  ✅ ${varName} 已配置`)
    } else {
      console.log(`  ❌ ${varName} 未配置`)
      hasErrors = true
    }
  }
} else {
  console.log('  ⚠️  .env 文件不存在，请确保 Vercel 环境变量已配置')
}

// 检查 Vercel 配置
console.log('\n⚙️  检查 Vercel 配置:')
const vercelConfig = join(projectRoot, 'vercel.json')
if (existsSync(vercelConfig)) {
  try {
    const config = JSON.parse(readFileSync(vercelConfig, 'utf-8'))
    
    // 检查重写规则
    if (config.rewrites && config.rewrites.length > 0) {
      console.log(`  ✅ 路由重写规则: ${config.rewrites.length} 条`)
    } else {
      console.log('  ❌ 缺少路由重写规则')
      hasErrors = true
    }
    
    // 检查头部配置
    if (config.headers && config.headers.length > 0) {
      console.log(`  ✅ HTTP 头部配置: ${config.headers.length} 条`)
      
      // 检查 JavaScript MIME 类型配置
      const jsHeaders = config.headers.find(h => h.source.includes('.js'))
      if (jsHeaders) {
        const contentTypeHeader = jsHeaders.headers.find(h => h.key === 'Content-Type')
        if (contentTypeHeader && contentTypeHeader.value.includes('application/javascript')) {
          console.log('  ✅ JavaScript MIME 类型配置正确')
        } else {
          console.log('  ❌ JavaScript MIME 类型配置错误')
          hasErrors = true
        }
      }
    } else {
      console.log('  ❌ 缺少 HTTP 头部配置')
      hasErrors = true
    }
    
  } catch (error) {
    console.log(`  ❌ vercel.json 格式错误: ${error.message}`)
    hasErrors = true
  }
} else {
  console.log('  ❌ vercel.json 文件不存在')
  hasErrors = true
}

// 检查 Vite 配置
console.log('\n🔧 检查 Vite 配置:')
const viteConfig = join(projectRoot, 'vite.config.ts')
if (existsSync(viteConfig)) {
  const configContent = readFileSync(viteConfig, 'utf-8')
  
  // 检查构建配置
  if (configContent.includes('rollupOptions')) {
    console.log('  ✅ Rollup 构建选项已配置')
  } else {
    console.log('  ⚠️  缺少 Rollup 构建选项')
  }
  
  // 检查代码分割配置
  if (configContent.includes('manualChunks')) {
    console.log('  ✅ 手动代码分割已配置')
  } else {
    console.log('  ⚠️  缺少手动代码分割配置')
  }
  
  // 检查输出目录
  if (configContent.includes('outDir')) {
    console.log('  ✅ 输出目录已配置')
  } else {
    console.log('  ✅ 使用默认输出目录 (dist)')
  }
  
} else {
  console.log('  ❌ vite.config.ts 文件不存在')
  hasErrors = true
}

// 检查 package.json 脚本
console.log('\n📦 检查 package.json:')
const packageJson = join(projectRoot, 'package.json')
if (existsSync(packageJson)) {
  try {
    const pkg = JSON.parse(readFileSync(packageJson, 'utf-8'))
    
    const requiredScripts = ['build', 'preview']
    for (const script of requiredScripts) {
      if (pkg.scripts && pkg.scripts[script]) {
        console.log(`  ✅ ${script} 脚本已配置`)
      } else {
        console.log(`  ❌ ${script} 脚本未配置`)
        hasErrors = true
      }
    }
    
    // 检查关键依赖
    const requiredDeps = ['vue', '@supabase/supabase-js', 'vue-router']
    for (const dep of requiredDeps) {
      if (pkg.dependencies && pkg.dependencies[dep]) {
        console.log(`  ✅ ${dep} 依赖已安装`)
      } else {
        console.log(`  ❌ ${dep} 依赖未安装`)
        hasErrors = true
      }
    }
    
  } catch (error) {
    console.log(`  ❌ package.json 格式错误: ${error.message}`)
    hasErrors = true
  }
} else {
  console.log('  ❌ package.json 文件不存在')
  hasErrors = true
}

// 检查构建输出
console.log('\n🏗️  检查构建输出:')
const distDir = join(projectRoot, 'dist')
if (existsSync(distDir)) {
  const indexHtml = join(distDir, 'index.html')
  if (existsSync(indexHtml)) {
    console.log('  ✅ index.html 存在')
    
    // 检查 index.html 内容
    const htmlContent = readFileSync(indexHtml, 'utf-8')
    if (htmlContent.includes('type="module"')) {
      console.log('  ✅ ES 模块入口点配置正确')
    } else {
      console.log('  ❌ ES 模块入口点配置错误')
      hasErrors = true
    }
    
    if (htmlContent.includes('modulepreload')) {
      console.log('  ✅ 模块预加载配置正确')
    } else {
      console.log('  ⚠️  缺少模块预加载配置')
    }
    
  } else {
    console.log('  ❌ index.html 不存在')
    hasErrors = true
  }
  
  const assetsDir = join(distDir, 'assets')
  if (existsSync(assetsDir)) {
    console.log('  ✅ assets 目录存在')
  } else {
    console.log('  ❌ assets 目录不存在')
    hasErrors = true
  }
  
} else {
  console.log('  ❌ dist 目录不存在，请先运行 npm run build')
  hasErrors = true
}

// 检查路由配置
console.log('\n🛣️  检查路由配置:')
const routerFile = join(projectRoot, 'src', 'router.ts')
if (existsSync(routerFile)) {
  const routerContent = readFileSync(routerFile, 'utf-8')
  
  if (routerContent.includes('createWebHistory')) {
    console.log('  ✅ 使用 HTML5 History 模式')
  } else {
    console.log('  ⚠️  未使用 HTML5 History 模式')
  }
  
  if (routerContent.includes('createRouteComponentLoader')) {
    console.log('  ✅ 使用增强的路由组件加载器')
  } else {
    console.log('  ⚠️  未使用增强的路由组件加载器')
  }
  
} else {
  console.log('  ❌ router.ts 文件不存在')
  hasErrors = true
}

// 部署建议
console.log('\n💡 部署建议:')
console.log('  📋 确保在 Vercel 项目设置中配置了以下环境变量:')
console.log('     - VITE_SUPABASE_URL')
console.log('     - VITE_SUPABASE_ANON_KEY')
console.log('  🔧 构建命令: npm run build')
console.log('  📁 输出目录: dist')
console.log('  🌐 Node.js 版本: 18.x 或更高')

// 最终结果
console.log('\n' + '='.repeat(50))
if (hasErrors) {
  console.log('❌ 部署前检查失败 - 请修复上述问题后重试')
  console.log('\n🔧 常见解决方案:')
  console.log('   1. 运行 npm run build 重新构建')
  console.log('   2. 检查 .env 文件配置')
  console.log('   3. 确保所有依赖已安装 (npm install)')
  console.log('   4. 验证 Vercel 配置文件格式')
  process.exit(1)
} else {
  console.log('✅ 部署前检查通过 - 可以安全部署')
  console.log('\n🚀 部署步骤:')
  console.log('   1. 提交代码到 Git 仓库')
  console.log('   2. 推送到 GitHub/GitLab')
  console.log('   3. 在 Vercel 中导入项目')
  console.log('   4. 配置环境变量')
  console.log('   5. 部署完成！')
}