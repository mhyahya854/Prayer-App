function getDefaultApiUrl() {
  return 'http://localhost:4000';
}

export const appConfig = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL?.trim() || getDefaultApiUrl(),
  buildStage: process.env.EXPO_PUBLIC_APP_STAGE?.trim() || 'development',
};
