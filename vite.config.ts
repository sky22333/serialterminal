import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // 用相对路径，同一份产物既能部署在域名根目录，也能放在 GitHub Pages 的子路径下
  base: './',

  plugins: [react()],

  build: {
    outDir: 'dist',
    // Web Serial 只在新版 Chromium 里可用，没必要为老浏览器降级转译
    target: 'esnext',
    sourcemap: false,
    chunkSizeWarningLimit: 800,
  },

  server: {
    port: 5173,
  },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    restoreMocks: true,
    css: false,
  },
})
