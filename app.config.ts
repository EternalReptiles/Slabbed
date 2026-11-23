import type { ExpoConfig } from 'expo/config';

// The web version lives at https://eternalreptiles.github.io/<repo name>/, so the base path follows the repo's
// name when GitHub Actions builds it (and defaults to /slabbed elsewhere).
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'slabbed';

const config: ExpoConfig = {
  name: 'Slabbed',
  slug: 'slabbed',
  scheme: 'slabbed',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  icon: './assets/icon.png',
  backgroundColor: '#EEF1F6',
  primaryColor: '#2F55E4',
  plugins: [
    'expo-router',
    ['expo-image-picker', {
      cameraPermission: 'Slabbed uses the camera to photograph your cards so it can identify, value and grade them.',
      photosPermission: 'Slabbed lets you pick photos of your cards to identify, value and grade them.',
    }],
  ],
  ios: { supportsTablet: false, bundleIdentifier: 'com.eternalreptiles.slabbed' },
  android: {
    package: 'com.eternalreptiles.slabbed',
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#2F55E4' },
  },
  web: {
    output: 'single',
    bundler: 'metro',
    name: 'Slabbed',
    shortName: 'Slabbed',
    description: 'Scan your Pokémon cards, see what they are worth in AUD and check their likely PSA grade.',
    themeColor: '#2F55E4',
    backgroundColor: '#EEF1F6',
    favicon: './assets/favicon.png',
  },
  experiments: { baseUrl: '/' + repo, typedRoutes: false },
};

export default config;
