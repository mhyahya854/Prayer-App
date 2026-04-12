function getDefaultApiUrl() {
  return 'http://10.0.2.2:4000';
}

export const appConfig = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL?.trim() || getDefaultApiUrl(),
  buildStage: process.env.EXPO_PUBLIC_APP_STAGE?.trim() || 'development',
};
