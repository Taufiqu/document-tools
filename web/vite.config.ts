import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import translateHandler from './api/translate';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // API keys are server-only, but the local Vite middleware needs them in
  // process.env to exercise the same translation gateway as Vercel.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  const host = process.env.TAURI_DEV_HOST;

  return {
  plugins: [
    react(),
    {
      name: 'local-translation-api',
      configureServer(server) {
        server.middlewares.use('/api/translate', (request, response) => {
          let rawBody = '';
          request.on('data', (chunk) => { rawBody += chunk; });
          request.on('end', async () => {
            const apiResponse = {
              status(code: number) {
                response.statusCode = code;
                return apiResponse;
              },
              json(body: unknown) {
                response.setHeader('Content-Type', 'application/json');
                response.end(JSON.stringify(body));
              },
              setHeader(name: string, value: string) {
                response.setHeader(name, value);
              },
            };

            try {
              await translateHandler(
                { method: request.method, body: rawBody ? JSON.parse(rawBody) : {} },
                apiResponse,
              );
            } catch (error) {
              response.statusCode = 500;
              response.setHeader('Content-Type', 'application/json');
              response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Local translation API failed' }));
            }
          });
        });
      },
    },
  ],

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
  };
});
