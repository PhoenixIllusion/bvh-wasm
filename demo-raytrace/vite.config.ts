import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        format: 'esm',
        dir: '../.git-pages/demo-raytrace/'
      }
    },
    target: ['esnext']
  },
  optimizeDeps: {
    esbuildOptions: {
      supported: {
        'top-level-await': true
      }
    }
  },
  worker: {
    format: 'es'
  },
  base: './',
  server: {
    host: 'localhost',
    port: 8080
  }
})