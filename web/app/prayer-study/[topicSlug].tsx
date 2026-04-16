import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SectionCard } from '@/src/components/SectionCard';
import { useContentData } from '@/src/content/content-provider';
import type { HadithItem, PrayerTopic } from '@/src/content/types';
import { useAppPalette } from '@/src/theme/palette';

export default function PrayerTopicDetailScreen() {
  const palette = useAppPalette();
  const { topicSlug } = useLocalSearchParams<{ topicSlug: string }>();
  const { getPrayerTopics, getHadithByIds, isReady } = useContentData();
  const [topic, setTopic] = useState<PrayerTopic | null>(null);
  const [items, setItems] = useState<HadithItem[]>([]);

  useEffect(() => {
    if (!isReady || !topicSlug) {
      return;
    }

    void getPrayerTopics().then(async ({ topics, items: topicItems }) => {
      const currentTopic = topics.find((value) => value.slug === topicSlug) ?? null;
      setTopic(currentTopic);
      const selectedIds = topicItems.filter((item) => item.topicSlug === topicSlug).map((item) => item.hadithId);
      const matches = await getHadithByIds(selectedIds);
      setItems(matches);
    });
  }, [getHadithByIds, getPrayerTopics, isReady, topicSlug]);

  return (
    <>
      <Stack.Screen options={{ title: topic?.title ?? 'Prayer Topic' }} />
      <ScrollView style={[styles.screen, { backgroundColor: palette.background }]} contentContainerStyle={styles.content}>
        <SectionCard
          title={topic?.title ?? String(topicSlug)}
          subtitle={topic?.description ?? 'Prayer-focused narrations'}
        >
          {items.map((item) => (
            <View key={item.id} style={[styles.card, { borderColor: palette.border, backgroundColor: palette.surface }]}>
              <Text style={[styles.meta, { color: palette.subtleText }]}>
                {item.bookSlug} #{item.bookHadithNumber}
              </Text>
              <Text style={[styles.arabic, { color: palette.text }]}>{item.textArabic}</Text>
              <Text style={[styles.english, { color: palette.text }]}>{item.textEnglish}</Text>
              {item.explanation ? (
                <Text style={[styles.english, { color: palette.subtleText }]}>{item.explanation}</Text>
              ) : null}
              <Text style={[styles.meta, { color: palette.subtleText }]}>Grade: {item.grade || 'Pending'}</Text>
            </View>
          ))}
        </SectionCard>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 14, padding: 18, paddingBottom: 112 },
  card: { borderWidth: 1, borderRadius: 14, gap: 8, padding: 12 },
  meta: { fontSize: 12 },
  arabic: { fontSize: 21, lineHeight: 32, textAlign: 'right' },
  english: { fontSize: 13, lineHeight: 19 },
});
