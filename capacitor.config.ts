import type { CapacitorConfig } from '@capacitor/cli';

// Android and iOS apps: the same web build, served from the phone itself.
const config: CapacitorConfig = {
  appId: 'com.rohittrimukhe.happypdf',
  appName: 'Happy PDF',
  webDir: 'dist',
  android: {
    // Nothing is loaded over plain HTTP; the app needs no network at all.
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'never',
  },
};

export default config;
