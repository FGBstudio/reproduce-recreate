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
  appId: "app.lovable.cbe763268dcc4145a9b933309ffc4d43",
  appName: "FGB Monitoring",
  webDir: "dist",
  server: {
    url: "https://cbe76326-8dcc-4145-a9b9-33309ffc4d43.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
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