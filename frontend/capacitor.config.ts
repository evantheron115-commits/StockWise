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
      launchShowDuration: 1200,
      backgroundColor:    '#030712', // matches surface-950
      spinnerColor:       '#4f46e5', // brand-600
      showSpinner:        false,
      splashFullScreen:   true,
      splashImmersive:    true,
    },

    PushNotifications: {
      // Will request permission lazily (when user enables price alerts)
      presentationOptions: ['badge', 'sound', 'alert'],
    },

    // Biometric auth — Face ID / Touch ID
    BiometricAuth: {
      // Permission will be requested on first lock-app interaction
    },
  },
};

export default config;
