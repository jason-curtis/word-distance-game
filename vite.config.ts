import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/word-distance-game/',
  server: {
    port: 5173,
    strictPort: false
  }
})
