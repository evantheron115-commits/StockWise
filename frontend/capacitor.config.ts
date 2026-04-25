import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId:   'com.valubull.app',
  appName: 'ValuBull',
  webDir:  'out',  // Next.js static export output directory

  server: {
    // Use HTTPS scheme on iOS so cookies and fetch behave like a real origin
    androidScheme: 'https',
  },

  ios: {
    // Automatically adjusts content insets so body sits below notch + above home bar
    contentInset: 'automatic',
    // Scroll the entire view (not just inner containers) — important for financial tables
    scrollEnabled: true,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration:  0,          // 0 = don't auto-hide; we call hide() manually
      launchAutoHide:      false,      // keep splash until SplashScreen.hide() is called
      backgroundColor:     '#030712', // surface-950 — matches app bg, no flash
      spinnerColor:        '#4f46e5', // brand-600
      showSpinner:         false,
      splashFullScreen:    true,
      splashImmersive:     true,
      fadeOutDuration:     200,        // ms for the crossfade into the app
    },

    // Biometric auth — Face ID / Touch ID
    BiometricAuth: {
      // Permission requested on first biometric interaction
    },
  },
};

export default config;
