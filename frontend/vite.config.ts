import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const localEngineToken = process.env.PAPERORCHESTRA_ENGINE_TOKEN;

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["manifest.webmanifest"],
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
        // The optional WebLLM runtime is several megabytes. Load it only when a
        // researcher explicitly starts a local model, then cache it at runtime.
        globIgnores: ["**/webllm.worker-*.js", "**/lib-*.js"],
        navigateFallback: "/index.html",
        maximumFileSizeToCacheInBytes: 1024 * 1024,
        runtimeCaching: [{
          urlPattern: /\/assets\/(?:webllm\.worker|lib)-[^/]+\.js$/,
          handler: "CacheFirst",
          options: {
            cacheName: "optional-local-ai-runtime",
            expiration: { maxEntries: 6, maxAgeSeconds: 30 * 24 * 60 * 60 }
          }
        }, {
          urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
          handler: "CacheFirst",
          options: { cacheName: "font-cache", expiration: { maxEntries: 12, maxAgeSeconds: 31536000 } }
        }]
      },
      devOptions: { enabled: false }
    })
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/engine\//, "/api/"),
        configure: proxy => {
          proxy.on("proxyReq", proxyReq => {
            // Keep the local engine secret on the dev server; never expose it in browser code.
            if (localEngineToken) proxyReq.setHeader("Authorization", "Bearer " + localEngineToken);
          });
        }
      }
    }
  }
});
