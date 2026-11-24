import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { readFileSync } from "fs";
import { execSync } from "child_process";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { sentryVitePlugin } from "@sentry/vite-plugin";

function resolveAppRelease(): string {
  const pkg = JSON.parse(
    readFileSync(path.resolve(__dirname, "./package.json"), "utf-8"),
  ) as { version?: string };
  const version = pkg.version || "0.0.0";
  let sha = process.env.GITHUB_SHA?.slice(0, 7) || "";
  if (!sha) {
    try {
      sha = execSync("git rev-parse --short HEAD", {
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim();
    } catch {
      sha = "local";
    }
  }
  return `fgb-monitoring@${version}+${sha}`;
}

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN || env.SENTRY_AUTH_TOKEN;
  const sentryOrg = process.env.SENTRY_ORG || env.SENTRY_ORG;
  const sentryProject = process.env.SENTRY_PROJECT || env.SENTRY_PROJECT;

  const appRelease = resolveAppRelease();
  const hasSentryUpload = command === "build" && Boolean(sentryAuthToken);

  return {
    // For GitHub Pages (subfolder hosting) we need relative asset paths.
    // In dev/preview keep root paths.
    base: command === "build" ? "./" : "/",
    define: {
      __APP_RELEASE__: JSON.stringify(appRelease),
    },
    server: {
      host: "::",
      port: 8080,
    },
    esbuild: {
      // Rimuove i log di debug SOLO dalla build di produzione (restano in dev)
      pure: ["console.log", "console.debug"],
    },
    build: {
      // Emit hidden source maps only when CI uploads & deletes them via SENTRY_AUTH_TOKEN
      sourcemap: hasSentryUpload ? "hidden" : false,
      rollupOptions: {
        output: {
          manualChunks: {
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
          sourcemap: false,
          navigateFallbackDenylist: [/^\/~oauth/],
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          // ISTRUZIONI CRITICHE PER PWA: 
          // Escludiamo le immagini di presentazione pesanti dalla cache offline
          globIgnores: [
            "**/FGB_Mac.png", 
            "**/FGB_Pad.png", 
            "**/FGB_Phone.png", 
            "**/Glass.jpg"
          ],
          // Alziamo il limite a 10MB per coprire futuri asset validi ma voluminosi
          maximumFileSizeToCacheInBytes: 10485760,
        },
      }),
      // Must stay last in plugins so source maps upload & delete after all bundling/PWA steps
      hasSentryUpload &&
        sentryVitePlugin({
          org: sentryOrg,
          project: sentryProject,
          authToken: sentryAuthToken,
          telemetry: false,
          release: { name: appRelease },
          sourcemaps: {
            filesToDeleteAfterUpload: ["./dist/**/*.map"],
          },
        }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
