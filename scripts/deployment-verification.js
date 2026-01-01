#!/usr/bin/env node

/**
 * 部署后验证脚本
 * 检查关键路由可访问性和模块加载性能
 */

import { performance } from 'perf_hooks'
import fetch from 'node-fetch'

// 配置
const CONFIG = {
  baseUrl: process.env.DEPLOYMENT_URL || 'http://localhost:5173',
  timeout: 10000,
  maxRetries: 3,
  criticalRoutes: [
    '/',
    '/events',
    '/my-events',
    '/profile',
    '/event/1',
    '/team/create',
    '/team/1'
  ],
  staticAssets: [
    '/assets/index.js',
    '/assets/index.css',
    '/favicon.ico'
  ],
  performanceThresholds: {
    pageLoad: 3000, // 3 seconds
    assetLoad: 2000, // 2 seconds
    apiResponse: 1000 // 1 second
  }
}

class DeploymentVerifier {
  constructor() {
    this.results = {
      routes: [],
      assets: [],
      performance: [],
      errors: [],
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        warnings: 0
      }
    }
  }

  async verify() {
    console.log('🚀 开始部署验证...')
    console.log(`目标URL: ${CONFIG.baseUrl}`)
    console.log('=' .repeat(50))

    try {
      // 验证基础连接
      await this.verifyBaseConnection()
      
      // 验证关键路由
      await this.verifyRoutes()
      
      // 验证静态资源
      await this.verifyAssets()
      
      // 验证性能指标
      await this.verifyPerformance()
      
      // 生成报告
      this.generateReport()
      
    } catch (error) {
      console.error('❌ 验证过程中发生错误:', error.message)
      process.exit(1)
    }
  }

  async verifyBaseConnection() {
    console.log('🔍 验证基础连接...')
    
    try {
      const startTime = performance.now()
      const response = await this.fetchWithTimeout(CONFIG.baseUrl)
      const endTime = performance.now()
      
      if (response.ok) {
        console.log(`✅ 基础连接正常 (${Math.round(endTime - startTime)}ms)`)
        this.results.summary.passed++
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (error) {
      console.log(`❌ 基础连接失败: ${error.message}`)
      this.results.errors.push({
        type: 'connection',
        message: error.message,
        timestamp: new Date().toISOString()
      })
      this.results.summary.failed++
      throw error
    }
    
    this.results.summary.totalTests++
  }

  async verifyRoutes() {
    console.log('🔍 验证关键路由...')
    
    for (const route of CONFIG.criticalRoutes) {
      const url = `${CONFIG.baseUrl}${route}`
      const startTime = performance.now()
      
      try {
        const response = await this.fetchWithTimeout(url)
        const endTime = performance.now()
        const loadTime = Math.round(endTime - startTime)
        
        const result = {
          route,
          url,
          status: response.status,
          loadTime,
          success: response.ok,
          contentType: response.headers.get('content-type'),
          timestamp: new Date().toISOString()
        }
        
        this.results.routes.push(result)
        
        if (response.ok) {
          const status = loadTime > CONFIG.performanceThresholds.pageLoad ? '⚠️' : '✅'
          console.log(`${status} ${route}: ${response.status} (${loadTime}ms)`)
          
          if (loadTime > CONFIG.performanceThresholds.pageLoad) {
            this.results.summary.warnings++
          } else {
            this.results.summary.passed++
          }
        } else {
          console.log(`❌ ${route}: ${response.status} ${response.statusText}`)
          this.results.summary.failed++
          this.results.errors.push({
            type: 'route',
            route,
            status: response.status,
            message: response.statusText,
            timestamp: new Date().toISOString()
          })
        }
      } catch (error) {
        console.log(`❌ ${route}: ${error.message}`)
        this.results.routes.push({
          route,
          url,
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        })
        this.results.summary.failed++
        this.results.errors.push({
          type: 'route',
          route,
          message: error.message,
          timestamp: new Date().toISOString()
        })
      }
      
      this.results.summary.totalTests++
    }
  }

  async verifyAssets() {
    console.log('🔍 验证静态资源...')
    
    for (const asset of CONFIG.staticAssets) {
      const url = `${CONFIG.baseUrl}${asset}`
      const startTime = performance.now()
      
      try {
        const response = await this.fetchWithTimeout(url)
        const endTime = performance.now()
        const loadTime = Math.round(endTime - startTime)
        
        const result = {
          asset,
          url,
          status: response.status,
          loadTime,
          success: response.ok,
          contentType: response.headers.get('content-type'),
          size: response.headers.get('content-length'),
          timestamp: new Date().toISOString()
        }
        
        this.results.assets.push(result)
        
        if (response.ok) {
          const status = loadTime > CONFIG.performanceThresholds.assetLoad ? '⚠️' : '✅'
          console.log(`${status} ${asset}: ${response.status} (${loadTime}ms)`)
          
          if (loadTime > CONFIG.performanceThresholds.assetLoad) {
            this.results.summary.warnings++
          } else {
            this.results.summary.passed++
          }
        } else {
          console.log(`❌ ${asset}: ${response.status} ${response.statusText}`)
          this.results.summary.failed++
        }
      } catch (error) {
        console.log(`❌ ${asset}: ${error.message}`)
        this.results.assets.push({
          asset,
          url,
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        })
        this.results.summary.failed++
      }
      
      this.results.summary.totalTests++
    }
  }

  async verifyPerformance() {
    console.log('🔍 验证性能指标...')
    
    // 测试首页加载性能
    const performanceTests = [
      { name: '首页加载', url: CONFIG.baseUrl },
      { name: '事件列表', url: `${CONFIG.baseUrl}/events` },
      { name: '用户资料', url: `${CONFIG.baseUrl}/profile` }
    ]
    
    for (const test of performanceTests) {
      try {
        const metrics = await this.measurePagePerformance(test.url)
        
        this.results.performance.push({
          name: test.name,
          url: test.url,
          ...metrics,
          timestamp: new Date().toISOString()
        })
        
        const status = metrics.totalTime > CONFIG.performanceThresholds.pageLoad ? '⚠️' : '✅'
        console.log(`${status} ${test.name}: ${metrics.totalTime}ms (TTFB: ${metrics.ttfb}ms)`)
        
        if (metrics.totalTime > CONFIG.performanceThresholds.pageLoad) {
          this.results.summary.warnings++
        } else {
          this.results.summary.passed++
        }
      } catch (error) {
        console.log(`❌ ${test.name}: ${error.message}`)
        this.results.summary.failed++
      }
      
      this.results.summary.totalTests++
    }
  }

  async measurePagePerformance(url) {
    const startTime = performance.now()
    
    const response = await this.fetchWithTimeout(url)
    const ttfb = performance.now() - startTime // Time to First Byte
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const content = await response.text()
    const totalTime = performance.now() - startTime
    
    return {
      ttfb: Math.round(ttfb),
      totalTime: Math.round(totalTime),
      contentSize: content.length,
      status: response.status,
      success: true
    }
  }

  async fetchWithTimeout(url, options = {}) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout)
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'DeploymentVerifier/1.0',
          ...options.headers
        }
      })
      
      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        throw new Error(`请求超时 (${CONFIG.timeout}ms)`)
      }
      throw error
    }
  }

  generateReport() {
    console.log('\n' + '=' .repeat(50))
    console.log('📊 验证报告')
    console.log('=' .repeat(50))
    
    const { summary } = this.results
    const successRate = ((summary.passed / summary.totalTests) * 100).toFixed(1)
    
    console.log(`总测试数: ${summary.totalTests}`)
    console.log(`通过: ${summary.passed}`)
    console.log(`失败: ${summary.failed}`)
    console.log(`警告: ${summary.warnings}`)
    console.log(`成功率: ${successRate}%`)
    
    // 性能摘要
    if (this.results.performance.length > 0) {
      console.log('\n📈 性能摘要:')
      const avgLoadTime = this.results.performance
        .reduce((sum, p) => sum + p.totalTime, 0) / this.results.performance.length
      console.log(`平均页面加载时间: ${Math.round(avgLoadTime)}ms`)
      
      const slowPages = this.results.performance
        .filter(p => p.totalTime > CONFIG.performanceThresholds.pageLoad)
      if (slowPages.length > 0) {
        console.log(`慢页面 (>${CONFIG.performanceThresholds.pageLoad}ms):`)
        slowPages.forEach(p => console.log(`  - ${p.name}: ${p.totalTime}ms`))
      }
    }
    
    // 错误摘要
    if (this.results.errors.length > 0) {
      console.log('\n❌ 错误摘要:')
      this.results.errors.forEach(error => {
        console.log(`  - ${error.type}: ${error.message}`)
      })
    }
    
    // 保存详细报告
    this.saveDetailedReport()
    
    // 确定退出状态
    if (summary.failed > 0) {
      console.log('\n❌ 部署验证失败')
      process.exit(1)
    } else if (summary.warnings > 0) {
      console.log('\n⚠️ 部署验证完成，但有性能警告')
      process.exit(0)
    } else {
      console.log('\n✅ 部署验证成功')
      process.exit(0)
    }
  }

  saveDetailedReport() {
    const reportData = {
      timestamp: new Date().toISOString(),
      config: CONFIG,
      results: this.results,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    }
    
    const fs = require('fs')
    const path = require('path')
    
    const reportDir = path.join(process.cwd(), 'deployment-reports')
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true })
    }
    
    const reportFile = path.join(reportDir, `verification-${Date.now()}.json`)
    fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2))
    
    console.log(`\n📄 详细报告已保存: ${reportFile}`)
  }
}

// 运行验证
if (require.main === module) {
  const verifier = new DeploymentVerifier()
  verifier.verify().catch(error => {
    console.error('验证失败:', error)
    process.exit(1)
  })
}

export { DeploymentVerifier }