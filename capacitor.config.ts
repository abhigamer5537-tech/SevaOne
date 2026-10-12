import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.sevaone.app',
  appName: 'SevaOne',
  webDir: 'public',
  // Before building the APK, set server.url to your deployed HTTPS website if you want
  // the app and website to share the same live account/order system. Do not commit secrets.
  server: { androidScheme: 'https' }
};
export default config;
