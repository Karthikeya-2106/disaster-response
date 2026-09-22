import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': { target: 'http://localhost:8081', changeOrigin: true },
      '/ws': { target: 'http://localhost:8081', changeOrigin: true, ws: true },
      '/uploads': { target: 'http://localhost:8081', changeOrigin: true }
    }
  },
  build: {
    rollupOptions: {
      output: {
        // Split the heavy libs out of the app bundle so they cache independently
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          map: ['leaflet', 'react-leaflet'],
          charts: ['recharts'],
          ws: ['@stomp/stompjs', 'sockjs-client']
        }
      }
    }
  },
  define: {
    global: 'window'   // sockjs-client needs this in browser
  }
})
