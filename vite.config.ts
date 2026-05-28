import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/Licensia/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png", "maskable-icon.png", "sol-de-mayo.png"],
      manifest: {
        name: "Licencia AR",
        short_name: "LicenciaAR",
        description: "Podgotovka k ekzamenu na prava v Argentine",
        theme_color: "#0a142e",
        background_color: "#0a142e",
        display: "standalone",
        orientation: "portrait",
        scope: "/Licensia/",
        start_url: "/Licensia/",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "maskable-icon.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,webp}"],
        runtimeCaching: [
          {
            urlPattern: /\/src\/data\/.*\.json$/,
            handler: "CacheFirst",
            options: {
              cacheName: "licencia-data",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: /cdn\.jsdelivr\.net/,
            handler: "CacheFirst",
            options: {
              cacheName: "cdn-icons",
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60 * 60 * 24 * 60,
              },
            },
          },
          {
            urlPattern: /\/question-images\//,
            handler: "CacheFirst",
            options: {
              cacheName: "question-images",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: /\/signs\//,
            handler: "CacheFirst",
            options: {
              cacheName: "sign-images",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
    }),
  ],
});
