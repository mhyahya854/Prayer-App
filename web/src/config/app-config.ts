import { Platform } from 'react-native';

function getDefaultApiUrl() {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:4000';
  }

  return 'http://localhost:4000';
}

export const appConfig = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL?.trim() || getDefaultApiUrl(),
  buildStage: process.env.EXPO_PUBLIC_APP_STAGE?.trim() || 'development',
  webPushPublicKey: process.env.EXPO_PUBLIC_WEB_PUSH_PUBLIC_KEY?.trim() || '',
};
