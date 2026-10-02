import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 5173 is taken by a local Docker container, so use a fixed port instead.
    port: 5180,
    strictPort: true,
    // Forward /api calls to the Flask backend during development.
    proxy: {
      '/api': 'http://127.0.0.1:5001',
    },
  },
})
