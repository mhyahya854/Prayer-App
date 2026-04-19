import { Stack, router, type RelativePathString } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { SectionCard } from '@/src/components/SectionCard';
import { useContentData } from '@/src/content/content-provider';
import type { PrayerTopic } from '@/src/content/types';
import { useAppPalette } from '@/src/theme/palette';

export default function PrayerStudyIndexScreen() {
  const { t } = useTranslation();
  const palette = useAppPalette();
  const { getPrayerTopics, isReady } = useContentData();
  const [topics, setTopics] = useState<PrayerTopic[]>([]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    void getPrayerTopics().then((result) => setTopics(result.topics));
  }, [getPrayerTopics, isReady]);

  return (
    <>
      <Stack.Screen options={{ title: t('prayer_study.title') }} />
      <ScrollView style={[styles.screen, { backgroundColor: palette.background }]} contentContainerStyle={styles.content}>
        <SectionCard title={t('prayer_study.title')} subtitle={t('prayer_study.subtitle')}>
          {topics.map((topic) => (
            <Pressable
              key={topic.slug}
              accessibilityRole="button"
              onPress={() => router.push(`../prayer-study/${topic.slug}` as RelativePathString)}
              style={[styles.topicCard, { borderColor: palette.border, backgroundColor: palette.surface }]}
            >
              <Text style={[styles.title, { color: palette.text }]}>{topic.title}</Text>
              <Text style={[styles.copy, { color: palette.subtleText }]}>{topic.description}</Text>
              <Text style={[styles.count, { color: palette.subtleText }]}>{topic.itemCount} {t('prayer_study.narrations')}</Text>
            </Pressable>
          ))}
        </SectionCard>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 14, padding: 18, paddingBottom: 112 },
  topicCard: { borderWidth: 1, borderRadius: 14, gap: 5, padding: 12 },
  title: { fontSize: 16, fontWeight: '600' },
  copy: { fontSize: 13, lineHeight: 19 },
  count: { fontSize: 12 },
});
