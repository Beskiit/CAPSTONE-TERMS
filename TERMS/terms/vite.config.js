// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Use env to control base path. For root domains (e.g. terms.kiri8tives.com) use '/'.
// For subpath deployments (e.g. example.com/terms) set VITE_BASE='/terms/'.
const BASE = process.env.VITE_BASE || '/'

export default defineConfig({
  base: BASE,
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
