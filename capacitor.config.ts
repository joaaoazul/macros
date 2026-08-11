import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Shell nativo (Android). Os assets da web são embutidos no APK e servidos
 * pelo WebView em `https://localhost`, por isso a app arranca offline e a API
 * passa a ser cross-origin — ver `src/lib/native.ts` e `VITE_API_ORIGIN`.
 */
const config: CapacitorConfig = {
  appId: 'dev.joaoazul.macros',
  appName: 'Macros',
  webDir: 'dist',
  android: {
    // A API é HTTPS; não abrir excepções para conteúdo em claro.
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      // escondido pelo código mal a app monta, para não haver flash branco
      launchAutoHide: false,
      backgroundColor: '#000000',
      androidScaleType: 'CENTER_CROP',
      splashImmersive: false,
    },
    StatusBar: {
      // a app pinta por baixo da status bar (edge-to-edge)
      overlaysWebView: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_macros',
      iconColor: '#0a84ff',
    },
  },
}

export default config
