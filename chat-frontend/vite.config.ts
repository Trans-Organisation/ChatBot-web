import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/ChatBot-web/',
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'widget.js',
        chunkFileNames: 'widget-[name].js',
        assetFileNames: 'widget.[ext]',
      },
    },
  },
});