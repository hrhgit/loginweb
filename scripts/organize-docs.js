#!/usr/bin/env node

/**
 * 文档组织脚本
 * 用于自动整理和分类项目中的 markdown 文档
 */

const fs = require('fs');
const path = require('path');

const DOCS_DIR = 'docs';
const ROOT_DIR = '.';

// 文档分类规则
const CATEGORY_RULES = {
  architecture: [
    /project.?structure/i,
    /functional.?logic/i,
    /executive.?summary/i,
    /architecture/i
  ],
  performance: [
    /performance/i,
    /optimization/i,
    /speed/i,
    /benchmark/i
  ],
  database: [
    /database/i,
    /migration/i,
    /schema/i,
    /sql/i,
    /db/i
  ],
  deployment: [
    /deployment/i,
    /deploy/i,
    /checklist/i,
    /release/i
  ],
  features: [
    /feature/i,
    /summary/i,
    /integration/i,
    /test.?result/i,
    /enhancement/i,
    /功能说明/i
  ],
  guides: [
    /guide/i,
    /styling/i,
    /best.?practice/i,
    /reference/i,
    /rules/i
  ]
};

/**
 * 根据文件名确定分类
 */
function categorizeFile(filename) {
  const baseName = path.basename(filename, '.md').toLowerCase();
  
  for (const [category, patterns] of Object.entries(CATEGORY_RULES)) {
    if (patterns.some(pattern => pattern.test(baseName))) {
      return category;
    }
  }
  
  return 'misc'; // 未分类
}

/**
 * 扫描根目录中的 markdown 文件
 */
function scanMarkdownFiles() {
  const files = fs.readdirSync(ROOT_DIR);
  return files.filter(file => 
    file.endsWith('.md') && 
    file !== 'README.md' && 
    !file.startsWith('.')
  );
}

/**
 * 创建目录结构
 */
function ensureDirectories() {
  const categories = Object.keys(CATEGORY_RULES);
  
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR);
  }
  
  categories.forEach(category => {
    const categoryDir = path.join(DOCS_DIR, category);
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir);
    }
  });
}

/**
 * 移动文件到对应分类目录
 */
function organizeFiles() {
  const markdownFiles = scanMarkdownFiles();
  const organized = {};
  
  markdownFiles.forEach(file => {
    const category = categorizeFile(file);
    const sourcePath = path.join(ROOT_DIR, file);
    const targetDir = path.join(DOCS_DIR, category);
    const targetPath = path.join(targetDir, file);
    
    if (!organized[category]) {
      organized[category] = [];
    }
    
    try {
      fs.renameSync(sourcePath, targetPath);
      organized[category].push(file);
      console.log(`✅ 移动 ${file} 到 ${category}/`);
    } catch (error) {
      console.error(`❌ 移动 ${file} 失败:`, error.message);
    }
  });
  
  return organized;
}

/**
 * 生成分类索引文件
 */
function generateCategoryIndex(category, files) {
  const categoryDir = path.join(DOCS_DIR, category);
  const indexPath = path.join(categoryDir, 'README.md');
  
  const content = `# ${category.charAt(0).toUpperCase() + category.slice(1)} 文档

本目录包含 ${category} 相关的文档。

## 📋 文档列表

${files.map(file => `- [${file}](./${file})`).join('\n')}

---

*此文件由脚本自动生成，最后更新时间: ${new Date().toLocaleString('zh-CN')}*
`;

  fs.writeFileSync(indexPath, content);
  console.log(`📝 生成索引文件: ${category}/README.md`);
}

/**
 * 主函数
 */
function main() {
  console.log('🚀 开始整理文档...\n');
  
  // 确保目录结构存在
  ensureDirectories();
  
  // 组织文件
  const organized = organizeFiles();
  
  // 生成索引文件
  Object.entries(organized).forEach(([category, files]) => {
    if (files.length > 0) {
      generateCategoryIndex(category, files);
    }
  });
  
  console.log('\n✨ 文档整理完成！');
  console.log(`📁 文档已整理到 ${DOCS_DIR}/ 目录中`);
}

if (require.main === module) {
  main();
}

module.exports = {
  categorizeFile,
  scanMarkdownFiles,
  organizeFiles
};