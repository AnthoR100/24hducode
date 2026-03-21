import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/game': 'http://localhost:4000',
      '/db': 'http://localhost:4000',
      '/config': 'http://localhost:4000',
    }
  }
})
