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
      launchShowDuration:  0,          // app calls SplashScreen.hide() manually
      launchAutoHide:      false,
      backgroundColor:     '#000000', // pure black — seamless transition into dark UI
      spinnerColor:        '#4f46e5', // brand-600
      showSpinner:         false,
      splashFullScreen:    true,
      splashImmersive:     true,
      fadeOutDuration:     200,
    },

    // White status bar icons/text on the dark background.
    // In Capacitor: 'LIGHT' = light-coloured content = white icons (dark bg).
    StatusBar: {
      style:           'LIGHT',
      backgroundColor: '#000000',
      overlaysWebView: false,
    },

    // Biometric auth — Face ID / Touch ID
    BiometricAuth: {
      // Permission requested on first biometric interaction
    },
  },
};

export default config;
