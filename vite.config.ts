import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "./",
  server: {
    host: "localhost",
    port: 8080,
    hmr: {
      host: "localhost",
      protocol: "ws",
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'gx.png', 'pbh-logo.png'],
      manifest: {
        name: 'GenX Cloud CID',
        short_name: 'GenX POS',
        description: 'GenX Cloud Restaurant Management System',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'gx.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'gx.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'gx.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3MB
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      }
    }),
    {
      name: 'api-server-middleware',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url && req.url.startsWith('/api/')) {
            try {
              if (req.url.startsWith('/api/auth/login')) {
                const chunks: any[] = [];
                for await (const chunk of req) chunks.push(chunk);
                const rawBody = Buffer.concat(chunks).toString();
                let parsedBody = {};
                try { parsedBody = JSON.parse(rawBody); } catch {}
                req.body = parsedBody;

                const { handleLogin } = await import('./api/auth/login');
                const result = await handleLogin(req);
                res.statusCode = result.status;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(result.body));
                return;
              }
              if (req.url.startsWith('/api/auth/logout')) {
                const chunks: any[] = [];
                for await (const chunk of req) chunks.push(chunk);
                const rawBody = Buffer.concat(chunks).toString();
                let parsedBody = {};
                try { parsedBody = JSON.parse(rawBody); } catch {}
                req.body = parsedBody;

                const { handleLogout } = await import('./api/auth/logout');
                const result = await handleLogout(req);
                res.statusCode = result.status;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(result.body));
                return;
              }
              if (req.url.startsWith('/api/me')) {
                const { handleMe } = await import('./api/me');
                const result = await handleMe(req);
                res.statusCode = result.status;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(result.body));
                return;
              }
              if (req.url.startsWith('/api/restaurant/settings')) {
                const { handleGetSettings } = await import('./api/restaurant/settings');
                const result = await handleGetSettings(req);
                res.statusCode = result.status;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(result.body));
                return;
              }
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message }));
              return;
            }
          }
          next();
        });
      }
    }
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query', '@tanstack/react-query-persist-client'],
          'vendor-ui': ['lucide-react', 'recharts', 'framer-motion'],
        },
      },
    },
  },
}));
