import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.bharathcyclehub.inventory",
  appName: "BCH Inventory",
  webDir: "out",
  server: {
    // Points to your Vercel deployment — the app runs as a wrapped web view
    url: "https://bike-inventory.vercel.app",
    cleartext: false,
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
    },
  },
};

export default config;
