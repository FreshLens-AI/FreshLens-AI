import type { ConfigContext, ExpoConfig } from 'expo/config';

// app.json stays the base config; this only injects the Firebase (FCM) config
// file. EAS builds receive it as the GOOGLE_SERVICES_JSON file env var; local
// builds fall back to the gitignored ./google-services.json.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  android: {
    ...config.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
});
