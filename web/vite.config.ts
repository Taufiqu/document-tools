import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import translateHandler from './api/translate';
import scribdInspectHandler from './api/scribd-inspect';
import scribdRenderChunkHandler from './api/scribd-render-chunk';
import scribdRenderFullHandler from './api/scribd-render-full';

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

        // ── Scribd Inspect (pre-flight, GET) ──────────────────────────────
        server.middlewares.use('/api/scribd-inspect', (request, response) => {
          const urlObj = new URL(request.url ?? '', 'http://localhost');
          const query: Record<string, string> = {};
          urlObj.searchParams.forEach((value, key) => { query[key] = value; });
          console.log(`\x1b[36m[API /api/scribd-inspect]\x1b[0m Inspecting: ${query.url || 'none'}`);
          const apiResponse = {
            status(code: number) { response.statusCode = code; return apiResponse; },
            json(body: unknown) { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(body)); },
            setHeader(name: string, value: string) { response.setHeader(name, value); },
            send(body: Buffer | Uint8Array) { response.end(body); },
          };
          void scribdInspectHandler({ method: request.method, query }, apiResponse).catch((err: unknown) => {
            console.error('\x1b[31m[API /api/scribd-inspect Error]\x1b[0m', err);
            response.statusCode = 500;
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ error: err instanceof Error ? err.message : 'scribd-inspect failed' }));
          });
        });

        // ── Scribd Render Chunk (POST) ────────────────────────────────────
        server.middlewares.use('/api/scribd-render-chunk', (request, response) => {
          let rawBody = '';
          request.on('data', (chunk) => { rawBody += chunk; });
          request.on('end', async () => {
            const apiResponse = {
              status(code: number) { response.statusCode = code; return apiResponse; },
              json(body: unknown) { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(body)); },
              setHeader(name: string, value: string) { response.setHeader(name, value); },
              send(body: Buffer | Uint8Array) { response.end(body); },
            };
            try {
              const body = rawBody ? JSON.parse(rawBody) : {};
              console.log(`\x1b[34m[API /api/scribd-render-chunk]\x1b[0m Rendering doc ${body.docId} (pages ${body.from}–${body.to})...`);
              await scribdRenderChunkHandler({ method: request.method, body }, apiResponse);
              console.log(`\x1b[32m[API /api/scribd-render-chunk]\x1b[0m Done chunk ${body.from}–${body.to}`);
            } catch (error) {
              console.error('\x1b[31m[API /api/scribd-render-chunk Error]\x1b[0m', error);
              response.statusCode = 500;
              response.setHeader('Content-Type', 'application/json');
              response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Local scribd chunk render failed' }));
            }
          });
        });

        // ── Scribd Render Full (POST) ─────────────────────────────────────
        server.middlewares.use('/api/scribd-render-full', (request, response) => {
          let rawBody = '';
          request.on('data', (chunk) => { rawBody += chunk; });
          request.on('end', async () => {
            const apiResponse = {
              status(code: number) { response.statusCode = code; return apiResponse; },
              json(body: unknown) { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(body)); },
              setHeader(name: string, value: string) { response.setHeader(name, value); },
              send(body: Buffer | Uint8Array) { response.end(body); },
            };
            try {
              const body = rawBody ? JSON.parse(rawBody) : {};
              console.log(`\x1b[34m[API /api/scribd-render-full]\x1b[0m Rendering doc ${body.docId}...`);
              await scribdRenderFullHandler({ method: request.method, body }, apiResponse);
              console.log(`\x1b[32m[API /api/scribd-render-full]\x1b[0m Done full doc ${body.docId}`);
            } catch (error) {
              console.error('\x1b[31m[API /api/scribd-render-full Error]\x1b[0m', error);
              response.statusCode = 500;
              response.setHeader('Content-Type', 'application/json');
              response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Local scribd full render failed' }));
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
