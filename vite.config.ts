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
        // More stable chunk naming to prevent 404 errors
        chunkFileNames: (chunkInfo) => {
          // Handle vendor chunks with consistent naming
          if (chunkInfo.name?.includes('vendor')) {
            return 'assets/vendors/[name]-[hash].js'
          }
          
          // Use shorter, more stable hashes for chunks
          return 'assets/chunks/[name]-[hash:8].js'
        },
        
        // Predictable entry file naming with shorter hash
        entryFileNames: 'assets/[name]-[hash:8].js',
        
        // Asset file naming (CSS, images, etc.)
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'assets/styles/[name]-[hash:8][extname]'
          }
          return 'assets/[name]-[hash:8][extname]'
        },
        
        // Optimized manual chunks for better caching and loading
        manualChunks: (id) => {
          // Only handle vendor chunks to avoid circular dependencies
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
          
          // Let Vite handle all application code chunks automatically
          // This prevents circular dependency issues
          return undefined
        }
      }
    },
    target: 'es2020',
    
    // Ensure chunk size warnings for better optimization
    chunkSizeWarningLimit: 1000,
    
    // Enable CSS code splitting
    cssCodeSplit: true,
    
    // Ensure consistent builds
    emptyOutDir: true
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
