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
        navigateFallback: "/index.html",
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        runtimeCaching: [{
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
            if (localEngineToken) proxyReq.setHeader("Authorization", "Bearer " + localEngineToken);
          });
        }
      }
    }
  }
});
