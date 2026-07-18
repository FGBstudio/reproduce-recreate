import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for FGB Monitoring native apps (iOS + Android).
 *
 * The `server.url` field enables HOT-RELOAD against the Lovable preview while
 * developing on a physical device or emulator. REMOVE the entire `server`
 * block before producing a release build for the App Store / Play Store —
 * production apps must bundle the static `dist/` output instead.
 */
const config: CapacitorConfig = {
  appId: "com.fgbstudio.monitoring",
  appName: "FGB Monitoring",
  webDir: "dist",
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#002838",
      showSpinner: false,
      androidSplashResourceName: "splash",
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#002838",
    },
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#002838",
  },
  android: {
    backgroundColor: "#002838",
  },
};

export default config;