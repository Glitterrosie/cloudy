import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' keeps the build working at any path — Netlify root, a Pages
// subfolder, or a plain folder served by any static host.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', assetsInlineLimit: 8192 },
})
