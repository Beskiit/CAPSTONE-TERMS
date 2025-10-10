// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/terms/' : '/',
  plugins: [react()],
  server: {
    // Optional: proxy so you can call /api without CORS in dev:
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: p => p.replace(/^\/api/, '')
      }
    }
  }
})
