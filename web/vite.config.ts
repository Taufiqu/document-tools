import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// TAURI_DEV_HOST is set by Tauri CLI in desktop dev mode
const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Tauri: don't hide Rust compile errors in terminal
  clearScreen: false,

  server: {
    host: host || false,
    port: 5173,
    strictPort: true,
    // HMR configuration for Tauri dev environment
    hmr: host
      ? { protocol: 'ws', host, port: 5173 }
      : undefined,
    // Don't watch the Rust source directory
    watch: { ignored: ['**/src-tauri/**'] },
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    // Target modern browsers bundled with Tauri WebView2 (Chromium-based)
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          'pdf-vendor': ['pdf-lib', 'pdfjs-dist'],
          'zip-vendor': ['jszip', 'file-saver'],
        },
      },
    },
  },
});
