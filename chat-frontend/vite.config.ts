import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/widget.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/widget.[ext]',
      },
    },
  },
})
