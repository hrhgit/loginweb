#!/usr/bin/env node

import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')
const distDir = join(projectRoot, 'dist')

/**
 * Build verification script for module loading fix
 * Validates that all dynamic imports have corresponding chunk files
 */

class BuildVerifier {
  constructor() {
    this.errors = []
    this.warnings = []
    this.dynamicImports = new Set()
    this.generatedChunks = new Set()
  }

  /**
   * Extract dynamic imports from router and other source files
   */
  extractDynamicImports() {
    console.log('🔍 Extracting dynamic imports...')
    
    // Check router file for dynamic imports
    const routerPath = join(projectRoot, 'src/router.ts')
    if (existsSync(routerPath)) {
      const routerContent = readFileSync(routerPath, 'utf-8')
      
      // Match import() statements
      const importMatches = routerContent.match(/import\(['"`]([^'"`]+)['"`]\)/g)
      if (importMatches) {
        importMatches.forEach(match => {
          const path = match.match(/import\(['"`]([^'"`]+)['"`]\)/)[1]
          this.dynamicImports.add(path)
        })
      }
    }

    console.log(`📦 Found ${this.dynamicImports.size} dynamic imports:`)
    this.dynamicImports.forEach(imp => console.log(`   - ${imp}`))
  }

  /**
   * Scan dist directory for generated chunks
   */
  scanGeneratedChunks() {
    console.log('\n🔍 Scanning generated chunks...')
    
    if (!existsSync(distDir)) {
      this.errors.push('Build directory does not exist. Run build first.')
      return
    }

    this.scanDirectory(distDir)
    
    console.log(`📦 Found ${this.generatedChunks.size} chunk files:`)
    this.generatedChunks.forEach(chunk => console.log(`   - ${chunk}`))
  }

  /**
   * Recursively scan directory for JS files
   */
  scanDirectory(dir) {
    try {
      const items = readdirSync(dir)
      
      items.forEach(item => {
        const fullPath = join(dir, item)
        const stat = statSync(fullPath)
        
        if (stat.isDirectory()) {
          this.scanDirectory(fullPath)
        } else if (item.endsWith('.js')) {
          // Store relative path from dist
          const relativePath = fullPath.replace(distDir, '').replace(/^[\\\/]/, '')
          this.generatedChunks.add(relativePath)
        }
      })
    } catch (error) {
      this.errors.push(`Error scanning directory ${dir}: ${error.message}`)
    }
  }

  /**
   * Verify chunk naming follows expected patterns
   */
  verifyChunkNaming() {
    console.log('\n🔍 Verifying chunk naming patterns...')
    
    const expectedPatterns = {
      pages: /^assets[\\\/]pages[\\\/][a-z0-9-]+-[a-zA-Z0-9_-]+\.js$/i,
      vendors: /^assets[\\\/]vendors[\\\/][a-z0-9-]+-[a-zA-Z0-9_-]+\.js$/i,
      components: /^assets[\\\/]components[\\\/][a-z0-9-]+-[a-zA-Z0-9_-]+\.js$/i,
      chunks: /^assets[\\\/]chunks[\\\/][a-z0-9-]+-[a-zA-Z0-9_-]+\.js$/i,
      entry: /^assets[\\\/][a-z0-9-]+-[a-zA-Z0-9_-]+\.js$/i
    }

    let patternsFound = {
      pages: 0,
      vendors: 0,
      components: 0,
      chunks: 0,
      entry: 0,
      other: 0
    }

    this.generatedChunks.forEach(chunk => {
      let matched = false
      
      // Skip service worker files
      if (chunk === 'background-worker.js' || chunk === 'sw.js') {
        patternsFound.other++
        return
      }
      
      for (const [type, pattern] of Object.entries(expectedPatterns)) {
        if (pattern.test(chunk)) {
          patternsFound[type]++
          matched = true
          break
        }
      }
      
      if (!matched) {
        this.warnings.push(`Chunk doesn't match expected naming pattern: ${chunk}`)
      }
    })

    console.log('📊 Chunk distribution:')
    Object.entries(patternsFound).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count} files`)
    })

    // Verify we have expected vendor chunks
    const hasVueVendor = Array.from(this.generatedChunks).some(chunk => 
      chunk.includes('vue-vendor'))
    const hasSupabaseVendor = Array.from(this.generatedChunks).some(chunk => 
      chunk.includes('supabase-vendor'))
    
    if (hasVueVendor) {
      console.log('✅ Vue vendor chunk found')
    } else {
      this.warnings.push('Vue vendor chunk not found')
    }
    
    if (hasSupabaseVendor) {
      console.log('✅ Supabase vendor chunk found')
    } else {
      this.warnings.push('Supabase vendor chunk not found')
    }
  }

  /**
   * Verify that dynamic imports have corresponding chunks
   */
  verifyDynamicImportChunks() {
    console.log('\n🔍 Verifying dynamic import chunks...')
    
    this.dynamicImports.forEach(importPath => {
      // Extract component name from path
      const componentName = importPath
        .replace('./pages/', '')
        .replace('./components/', '')
        .replace('.vue', '')
        .toLowerCase()
      
      // Check if there's a corresponding chunk
      const hasChunk = Array.from(this.generatedChunks).some(chunk => {
        return chunk.includes(componentName) || 
               chunk.includes(importPath.replace('./', '').replace('.vue', ''))
      })
      
      if (!hasChunk) {
        this.warnings.push(`No chunk found for dynamic import: ${importPath}`)
      }
    })
  }

  /**
   * Check for MIME type issues in index.html
   */
  verifyIndexHtml() {
    console.log('\n🔍 Verifying index.html...')
    
    const indexPath = join(distDir, 'index.html')
    if (!existsSync(indexPath)) {
      this.errors.push('index.html not found in build output')
      return
    }

    const indexContent = readFileSync(indexPath, 'utf-8')
    
    // Check for proper script tags
    const scriptTags = indexContent.match(/<script[^>]*src="[^"]*"[^>]*>/g) || []
    
    scriptTags.forEach(tag => {
      // Verify script tags have proper type (should be module or no type for JS)
      if (!tag.includes('type="module"') && !tag.includes('.js"')) {
        this.warnings.push(`Script tag may have MIME type issues: ${tag}`)
      }
    })

    console.log(`📄 Found ${scriptTags.length} script tags in index.html`)
  }

  /**
   * Run all verification checks
   */
  async verify() {
    console.log('🚀 Starting build verification...\n')
    
    try {
      this.extractDynamicImports()
      this.scanGeneratedChunks()
      this.verifyChunkNaming()
      this.verifyDynamicImportChunks()
      this.verifyIndexHtml()
      
      this.printResults()
      
      return this.errors.length === 0
    } catch (error) {
      console.error('❌ Verification failed:', error.message)
      return false
    }
  }

  /**
   * Print verification results
   */
  printResults() {
    console.log('\n' + '='.repeat(50))
    console.log('📋 BUILD VERIFICATION RESULTS')
    console.log('='.repeat(50))
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ All checks passed! Build is ready for deployment.')
    } else {
      if (this.errors.length > 0) {
        console.log('\n❌ ERRORS:')
        this.errors.forEach(error => console.log(`   - ${error}`))
      }
      
      if (this.warnings.length > 0) {
        console.log('\n⚠️  WARNINGS:')
        this.warnings.forEach(warning => console.log(`   - ${warning}`))
      }
    }
    
    console.log(`\n📊 Summary: ${this.errors.length} errors, ${this.warnings.length} warnings`)
    
    if (this.errors.length > 0) {
      console.log('\n💡 Fix errors before deploying to production.')
      process.exit(1)
    }
  }
}

// Run verification if called directly
const verifier = new BuildVerifier()
verifier.verify().catch(console.error)