import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // Simplified chunk naming strategy for better compatibility
        chunkFileNames: (chunkInfo) => {
          // Handle vendor chunks with consistent naming
          if (chunkInfo.name?.includes('vendor')) {
            return 'assets/vendors/[name]-[hash].js'
          }
          
          // Use default naming for all other chunks to avoid path issues
          return 'assets/chunks/[name]-[hash].js'
        },
        
        // Predictable entry file naming
        entryFileNames: 'assets/[name]-[hash].js',
        
        // Asset file naming (CSS, images, etc.)
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'assets/styles/[name]-[hash][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        },
        
        // Simplified manual chunks for better compatibility
        manualChunks: (id) => {
          // Vendor chunks
          if (id.includes('node_modules')) {
            if (id.includes('vue') || id.includes('vue-router')) {
              return 'vue-vendor'
            }
            if (id.includes('@supabase/supabase-js')) {
              return 'supabase-vendor'
            }
            if (id.includes('@tanstack/vue-query')) {
              return 'query-vendor'
            }
            if (id.includes('lucide-vue-next') || id.includes('vue-advanced-cropper')) {
              return 'ui-vendor'
            }
            if (id.includes('xlsx') || id.includes('file-saver') || id.includes('jszip')) {
              return 'file-vendor'
            }
            // Other node_modules dependencies
            return 'vendor'
          }
          
          // Let Vite handle other chunks automatically
          return undefined
        }
      }
    },
    target: 'es2020',
    
    // Ensure chunk size warnings for better optimization
    chunkSizeWarningLimit: 1000,
    
    // Enable CSS code splitting
    cssCodeSplit: true
  },
  server: {
    port: 5173,
    host: true
  },
  preview: {
    port: 4173,
    host: true
  }
})
