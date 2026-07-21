import type { CapacitorConfig } from '@capacitor/cli';

const isProd = process.env.NODE_ENV === 'production' || process.env.CAPACITOR_ENV === 'production';
const prodUrl = process.env.CAPACITOR_SERVER_URL;

if (isProd && !prodUrl) {
  throw new Error('CAPACITOR_SERVER_URL must be set for production builds');
}

const config: CapacitorConfig = {
  appId: 'com.afms.app',
  appName: 'afms',
  server: prodUrl
    ? { url: prodUrl, cleartext: false }
    : { url: 'http://localhost:3000', cleartext: true },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#0f172a"
    }
  }
};

export default config;
