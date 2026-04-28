import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => ({
  // For GitHub Pages (subfolder hosting) we need relative asset paths.
  // In dev/preview keep root paths.
  base: command === "build" ? "./" : "/",
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-pdf': ['jspdf', 'jspdf-autotable', 'html2canvas'],
          'vendor-charts': ['recharts'],
          'vendor-lucide': ['lucide-react'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      // Service worker MUST be disabled in dev/preview to avoid breaking the
      // Lovable iframe preview (see PWA guidance).
      devOptions: { enabled: false },
      includeAssets: [
        "favicon.ico",
        "robots.txt",
        "apple-touch-icon-180.png",
      ],
      manifest: {
        name: "FGB Monitoring World",
        short_name: "FGB",
        description: "Real-time monitoring and analytics for smart buildings.",
        theme_color: "#002838",
        background_color: "#002838",
        display: "standalone",
        orientation: "portrait",
        start_url: ".",
        scope: ".",
        lang: "it",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "pwa-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
