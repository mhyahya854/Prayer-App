import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function AuthCompleteScreen() {
  const params = useLocalSearchParams<{ error?: string | string[]; status?: string | string[] }>();
  const router = useRouter();
  const error =
    typeof params.error === 'string'
      ? params.error
      : Array.isArray(params.error)
        ? params.error[0]
        : null;

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace('/(tabs)/settings');
    }, 250);

    return () => {
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <View style={styles.screen}>
      <ActivityIndicator size="large" color="#0C8C6C" />
      <Text style={styles.title}>{error ? 'Google sign-in did not finish' : 'Finishing Google sign-in'}</Text>
      <Text style={styles.copy}>
        {error ?? 'Returning to the app and preparing your Google Drive backup sync.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    backgroundColor: '#10261F',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    color: '#F6F3EC',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  copy: {
    color: '#C5C0B5',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
