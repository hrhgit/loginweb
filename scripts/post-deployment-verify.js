#!/usr/bin/env node

/**
 * 部署后验证脚本
 * 
 * 在部署完成后运行，验证关键路由可访问性、静态资源正确性和系统健康状况
 */

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

/**
 * 部署后验证器
 */
class PostDeploymentVerifier {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl || process.env.DEPLOYMENT_URL || 'http://localhost:4173'
    this.errors = []
    this.warnings = []
    this.checks = []
  }

  /**
   * 执行完整的部署后验证
   */
  async verify() {
    console.log('🚀 开始部署后验证...')
    console.log(`🌐 验证目标: ${this.baseUrl}`)
    
    try {
      await this.verifyRouteAccessibility()
      await this.verifyStaticAssets()
      await this.verifyModuleLoading()
      await this.verifyErrorHandling()
      await this.verifyPerformance()
      
      this.printResults()
      
      return this.errors.length === 0
    } catch (error) {
      console.error('❌ 验证过程失败:', error.message)
      return false
    }
  }

  /**
   * 验证关键路由可访问性
   */
  async verifyRouteAccessibility() {
    console.log('\n🔍 验证路由可访问性...')
    
    const criticalRoutes = [
      { path: '/', name: '首页', critical: true },
      { path: '/events', name: '活动列表', critical: true },
      { path: '/events/test-id', name: '活动详情', critical: true },
      { path: '/teams', name: '团队页面', critical: false },
      { path: '/profile', name: '个人资料', critical: false }
    ]

    for (const route of criticalRoutes) {
      const startTime = Date.now()
      
      try {
        const response = await this.fetchWithTimeout(`${this.baseUrl}${route.path}`, 10000)
        const duration = Date.now() - startTime
        
        if (response.ok) {
          console.log(`✅ ${route.name} (${route.path}) - ${duration}ms`)
          this.checks.push({
            type: 'route',
            name: route.name,
            status: 'passed',
            duration
          })
        } else {
          const message = `${route.name} 返回状态码 ${response.status}`
          if (route.critical) {
            console.log(`❌ ${message}`)
            this.errors.push(message)
          } else {
            console.log(`⚠️  ${message}`)
            this.warnings.push(message)
          }
          
          this.checks.push({
            type: 'route',
            name: route.name,
            status: route.critical ? 'failed' : 'warning',
            duration
          })
        }
      } catch (error) {
        const duration = Date.now() - startTime
        const message = `${route.name} 访问失败: ${error.message}`
        
        if (route.critical) {
          console.log(`❌ ${message}`)
          this.errors.push(message)
        } else {
          console.log(`⚠️  ${message}`)
          this.warnings.push(message)
        }
        
        this.checks.push({
          type: 'route',
          name: route.name,
          status: route.critical ? 'failed' : 'warning',
          duration
        })
      }
    }
  }

  /**
   * 验证静态资源
   */
  async verifyStaticAssets() {
    console.log('\n🔍 验证静态资源...')
    
    // 首先获取index.html来提取实际的资源路径
    let indexContent = ''
    try {
      const indexResponse = await this.fetchWithTimeout(`${this.baseUrl}/`, 5000)
      if (indexResponse.ok) {
        indexContent = await indexResponse.text()
      }
    } catch (error) {
      console.log(`⚠️  无法获取index.html: ${error.message}`)
      this.warnings.push('无法获取index.html进行资源验证')
      return
    }

    // 从index.html中提取资源路径
    const scriptMatches = indexContent.match(/<script[^>]*src="([^"]*)"[^>]*>/g) || []
    const linkMatches = indexContent.match(/<link[^>]*href="([^"]*)"[^>]*>/g) || []
    
    const assets = new Set()
    
    // 提取JavaScript文件
    scriptMatches.forEach(match => {
      const srcMatch = match.match(/src="([^"]*)"/)
      if (srcMatch && srcMatch[1]) {
        assets.add(srcMatch[1])
      }
    })
    
    // 提取CSS文件
    linkMatches.forEach(match => {
      const hrefMatch = match.match(/href="([^"]*)"/)
      if (hrefMatch && hrefMatch[1] && hrefMatch[1].endsWith('.css')) {
        assets.add(hrefMatch[1])
      }
    })

    // 添加一些常见的静态资源
    const commonAssets = [
      '/vite.svg',
      '/fonts/sora-latin.woff2',
      '/fonts/worksans-latin.woff2'
    ]
    
    commonAssets.forEach(asset => assets.add(asset))

    console.log(`📦 发现 ${assets.size} 个资源需要验证`)

    for (const asset of assets) {
      const startTime = Date.now()
      
      try {
        const assetUrl = asset.startsWith('http') ? asset : `${this.baseUrl}${asset}`
        const response = await this.fetchWithTimeout(assetUrl, 5000)
        const duration = Date.now() - startTime
        
        if (response.ok) {
          // 验证MIME类型
          const contentType = response.headers.get('content-type') || ''
          let expectedMimeType = ''
          let mimeTypeCorrect = true
          
          if (asset.endsWith('.js')) {
            expectedMimeType = 'application/javascript'
            mimeTypeCorrect = contentType.includes('javascript') || contentType.includes('text/javascript')
          } else if (asset.endsWith('.css')) {
            expectedMimeType = 'text/css'
            mimeTypeCorrect = contentType.includes('css')
          } else if (asset.endsWith('.woff2')) {
            expectedMimeType = 'font/woff2'
            mimeTypeCorrect = contentType.includes('font') || contentType.includes('woff')
          }
          
          if (expectedMimeType && !mimeTypeCorrect) {
            console.log(`⚠️  ${asset} - MIME类型错误: ${contentType}`)
            this.warnings.push(`${asset} MIME类型错误: ${contentType}，期望: ${expectedMimeType}`)
            
            this.checks.push({
              type: 'asset',
              name: asset,
              status: 'warning',
              duration,
              details: { contentType, expectedMimeType }
            })
          } else {
            console.log(`✅ ${asset} - ${duration}ms`)
            this.checks.push({
              type: 'asset',
              name: asset,
              status: 'passed',
              duration
            })
          }
        } else {
          console.log(`⚠️  ${asset} - 状态码 ${response.status}`)
          this.warnings.push(`${asset} 返回状态码 ${response.status}`)
          
          this.checks.push({
            type: 'asset',
            name: asset,
            status: 'warning',
            duration
          })
        }
      } catch (error) {
        const duration = Date.now() - startTime
        console.log(`⚠️  ${asset} - 访问失败: ${error.message}`)
        this.warnings.push(`${asset} 访问失败: ${error.message}`)
        
        this.checks.push({
          type: 'asset',
          name: asset,
          status: 'warning',
          duration
        })
      }
    }
  }

  /**
   * 验证模块加载
   */
  async verifyModuleLoading() {
    console.log('\n🔍 验证模块加载...')
    
    try {
      // 检查是否存在动态导入的chunk文件
      const indexResponse = await this.fetchWithTimeout(`${this.baseUrl}/`, 5000)
      if (!indexResponse.ok) {
        this.warnings.push('无法获取首页进行模块加载验证')
        return
      }

      const indexContent = await indexResponse.text()
      
      // 检查是否包含预期的模块加载代码
      const hasModuleSupport = indexContent.includes('type="module"')
      const hasImportMaps = indexContent.includes('importmap') || indexContent.includes('import(')
      
      if (hasModuleSupport) {
        console.log('✅ 模块系统支持正常')
        this.checks.push({
          type: 'module',
          name: '模块系统支持',
          status: 'passed',
          duration: 0
        })
      } else {
        console.log('⚠️  未检测到模块系统支持')
        this.warnings.push('未检测到模块系统支持')
        this.checks.push({
          type: 'module',
          name: '模块系统支持',
          status: 'warning',
          duration: 0
        })
      }

      // 尝试访问一个可能的chunk文件
      try {
        const chunkResponse = await this.fetchWithTimeout(`${this.baseUrl}/assets/pages/eventdetailpage-*.js`, 3000)
        if (chunkResponse.ok) {
          console.log('✅ 动态chunk文件可访问')
        }
      } catch (error) {
        // 这是预期的，因为我们不知道确切的chunk文件名
        console.log('ℹ️  无法验证具体chunk文件（需要实际文件名）')
      }
      
    } catch (error) {
      console.log(`⚠️  模块加载验证失败: ${error.message}`)
      this.warnings.push(`模块加载验证失败: ${error.message}`)
    }
  }

  /**
   * 验证错误处理
   */
  async verifyErrorHandling() {
    console.log('\n🔍 验证错误处理...')
    
    try {
      // 尝试访问一个不存在的路由，应该返回index.html（SPA行为）
      const response = await this.fetchWithTimeout(`${this.baseUrl}/non-existent-route-${Date.now()}`, 5000)
      
      if (response.ok) {
        const content = await response.text()
        
        // 检查是否返回了index.html而不是404页面
        if (content.includes('<div id="app">') || content.includes('<!DOCTYPE html>')) {
          console.log('✅ SPA路由回退正常')
          this.checks.push({
            type: 'error_handling',
            name: 'SPA路由回退',
            status: 'passed',
            duration: 0
          })
        } else {
          console.log('⚠️  SPA路由回退可能有问题')
          this.warnings.push('SPA路由回退可能有问题')
          this.checks.push({
            type: 'error_handling',
            name: 'SPA路由回退',
            status: 'warning',
            duration: 0
          })
        }
      } else {
        console.log(`⚠️  不存在路由返回状态码 ${response.status}`)
        this.warnings.push(`不存在路由返回状态码 ${response.status}`)
        this.checks.push({
          type: 'error_handling',
          name: 'SPA路由回退',
          status: 'warning',
          duration: 0
        })
      }
    } catch (error) {
      console.log(`⚠️  错误处理验证失败: ${error.message}`)
      this.warnings.push(`错误处理验证失败: ${error.message}`)
    }
  }

  /**
   * 验证性能
   */
  async verifyPerformance() {
    console.log('\n🔍 验证性能...')
    
    const performanceTests = [
      { name: '首页加载', path: '/', threshold: 3000 },
      { name: '活动列表加载', path: '/events', threshold: 5000 }
    ]

    for (const test of performanceTests) {
      const startTime = Date.now()
      
      try {
        const response = await this.fetchWithTimeout(`${this.baseUrl}${test.path}`, test.threshold + 2000)
        const duration = Date.now() - startTime
        
        if (response.ok) {
          if (duration < test.threshold) {
            console.log(`✅ ${test.name} - ${duration}ms (良好)`)
            this.checks.push({
              type: 'performance',
              name: test.name,
              status: 'passed',
              duration
            })
          } else {
            console.log(`⚠️  ${test.name} - ${duration}ms (较慢)`)
            this.warnings.push(`${test.name} 加载时间 ${duration}ms 超过阈值 ${test.threshold}ms`)
            this.checks.push({
              type: 'performance',
              name: test.name,
              status: 'warning',
              duration
            })
          }
        } else {
          console.log(`❌ ${test.name} - 状态码 ${response.status}`)
          this.errors.push(`${test.name} 返回状态码 ${response.status}`)
        }
      } catch (error) {
        const duration = Date.now() - startTime
        console.log(`❌ ${test.name} - 超时或失败: ${error.message}`)
        this.errors.push(`${test.name} 超时或失败: ${error.message}`)
      }
    }
  }

  /**
   * 带超时的fetch请求
   */
  async fetchWithTimeout(url, timeout) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'PostDeploymentVerifier/1.0'
        }
      })
      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        throw new Error(`请求超时 (${timeout}ms)`)
      }
      throw error
    }
  }

  /**
   * 打印验证结果
   */
  printResults() {
    console.log('\n' + '='.repeat(60))
    console.log('📋 部署后验证结果')
    console.log('='.repeat(60))
    
    // 统计信息
    const totalChecks = this.checks.length
    const passedChecks = this.checks.filter(c => c.status === 'passed').length
    const warningChecks = this.checks.filter(c => c.status === 'warning').length
    const failedChecks = this.checks.filter(c => c.status === 'failed').length
    
    console.log(`\n📊 检查统计:`)
    console.log(`   总计: ${totalChecks}`)
    console.log(`   通过: ${passedChecks}`)
    console.log(`   警告: ${warningChecks}`)
    console.log(`   失败: ${failedChecks}`)
    
    // 按类型分组显示结果
    const checksByType = this.checks.reduce((acc, check) => {
      if (!acc[check.type]) acc[check.type] = []
      acc[check.type].push(check)
      return acc
    }, {})
    
    console.log(`\n📋 详细结果:`)
    Object.entries(checksByType).forEach(([type, checks]) => {
      console.log(`\n${this.getTypeIcon(type)} ${this.getTypeName(type)}:`)
      checks.forEach(check => {
        const icon = check.status === 'passed' ? '✅' : check.status === 'warning' ? '⚠️' : '❌'
        const duration = check.duration ? ` (${check.duration}ms)` : ''
        console.log(`   ${icon} ${check.name}${duration}`)
      })
    })
    
    // 错误和警告
    if (this.errors.length > 0) {
      console.log('\n❌ 错误:')
      this.errors.forEach(error => console.log(`   - ${error}`))
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️  警告:')
      this.warnings.forEach(warning => console.log(`   - ${warning}`))
    }
    
    // 总体状态
    console.log('\n' + '='.repeat(60))
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('🎉 部署验证完全通过！系统运行正常。')
    } else if (this.errors.length === 0) {
      console.log('✅ 部署验证基本通过，但有一些警告需要关注。')
    } else {
      console.log('❌ 部署验证失败，存在严重问题需要修复。')
    }
    
    console.log(`🌐 验证目标: ${this.baseUrl}`)
    console.log(`⏰ 验证时间: ${new Date().toLocaleString()}`)
    
    if (this.errors.length > 0) {
      console.log('\n💡 建议: 修复上述错误后重新部署。')
      process.exit(1)
    }
  }

  getTypeIcon(type) {
    const icons = {
      route: '🛣️',
      asset: '📦',
      module: '🧩',
      error_handling: '🛡️',
      performance: '⚡'
    }
    return icons[type] || '📋'
  }

  getTypeName(type) {
    const names = {
      route: '路由验证',
      asset: '静态资源',
      module: '模块加载',
      error_handling: '错误处理',
      performance: '性能测试'
    }
    return names[type] || type
  }
}

// 主执行逻辑
async function main() {
  const args = process.argv.slice(2)
  const baseUrl = args[0] || process.env.DEPLOYMENT_URL || 'http://localhost:4173'
  
  console.log('🚀 部署后验证脚本')
  console.log(`📅 ${new Date().toLocaleString()}`)
  
  const verifier = new PostDeploymentVerifier(baseUrl)
  const success = await verifier.verify()
  
  process.exit(success ? 0 : 1)
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ 脚本执行失败:', error)
    process.exit(1)
  })
}

export { PostDeploymentVerifier }