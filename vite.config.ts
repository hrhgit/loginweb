import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    // Enable code splitting and chunk optimization
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // Vendor chunks
          'vue-vendor': ['vue', 'vue-router'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'ui-vendor': ['lucide-vue-next', 'vue-advanced-cropper'],
          'file-vendor': ['file-saver', 'jszip', 'xlsx', 'tus-js-client'],
          
          // Feature-based chunks
          'admin-features': [
            './src/pages/EventAdminPage.vue',
            './src/components/admin/JudgeManagementPanel.vue',
            './src/components/admin/JudgeWorkspace.vue',
            './src/components/admin/FormResponseViewer.vue',
            './src/components/admin/EnhancedDataTable.vue',
            './src/components/admin/TableEnhancements.vue'
          ],
          
          'judge-features': [
            './src/pages/JudgeWorkspacePage.vue'
          ],
          
          'team-features': [
            './src/pages/TeamCreatePage.vue',
            './src/pages/TeamDetailPage.vue'
          ],
          
          'submission-features': [
            './src/pages/SubmissionPage.vue',
            './src/pages/SubmissionDetailPage.vue'
          ]
        },
        
        // Optimize chunk file names for better caching
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
          if (facadeModuleId) {
            // Route-based chunks
            if (facadeModuleId.includes('/pages/')) {
              const pageName = facadeModuleId.split('/').pop()?.replace('.vue', '')
              return `pages/[name]-${pageName}.[hash].js`
            }
            // Component-based chunks
            if (facadeModuleId.includes('/components/')) {
              return `components/[name].[hash].js`
            }
          }
          return `chunks/[name].[hash].js`
        },
        
        // Optimize entry file names
        entryFileNames: `assets/[name].[hash].js`,
        assetFileNames: `assets/[name].[hash].[ext]`
      }
    },
    
    // Optimize chunk size warnings
    chunkSizeWarningLimit: 1000,
    
    // Enable source maps for better debugging
    sourcemap: false,
    
    // Use default minifier instead of terser
    minify: 'esbuild'
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'vue',
      'vue-router',
      '@supabase/supabase-js',
      'lucide-vue-next'
    ],
    exclude: [
      // Large optional dependencies that should be loaded on demand
      'vue-advanced-cropper',
      'xlsx',
      'jszip'
    ]
  }
})
