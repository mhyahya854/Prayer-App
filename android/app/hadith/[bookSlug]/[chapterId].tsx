import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SectionCard } from '@/src/components/SectionCard';
import { useContentData } from '@/src/content/content-provider';
import type { HadithItem } from '@/src/content/types';
import { useAppPalette } from '@/src/theme/palette';

export default function HadithChapterScreen() {
  const palette = useAppPalette();
  const { bookSlug, chapterId } = useLocalSearchParams<{ bookSlug: string; chapterId: string }>();
  const parsedChapterId = Number(chapterId);
  const { getHadithChapterDetail, isReady, toggleHadithBookmark } = useContentData();
  const [items, setItems] = useState<HadithItem[]>([]);

  useEffect(() => {
    if (!isReady || !bookSlug || Number.isNaN(parsedChapterId)) return;
    void getHadithChapterDetail(bookSlug, parsedChapterId).then(setItems);
  }, [bookSlug, getHadithChapterDetail, isReady, parsedChapterId]);

  async function handleToggleBookmark(id: string) {
    const isBookmarked = await toggleHadithBookmark(id);
    setItems((current) => current.map((item) => (item.id === id ? { ...item, isBookmarked } : item)));
  }

  return (
    <>
      <Stack.Screen options={{ title: `${bookSlug} - Chapter ${chapterId}` }} />
      <ScrollView style={[styles.screen, { backgroundColor: palette.background }]} contentContainerStyle={styles.content}>
        <SectionCard title="Hadith Entries" subtitle="Arabic, translation, explanation, and grade">
          {items.map((item) => (
            <View key={item.id} style={[styles.card, { borderColor: palette.border, backgroundColor: palette.surface }]}>
              <Text style={[styles.meta, { color: palette.subtleText }]}>
                {item.bookSlug} #{item.bookHadithNumber} | {item.narratorEnglish}
              </Text>
              <Text style={[styles.arabic, { color: palette.text }]}>{item.textArabic}</Text>
              <Text style={[styles.english, { color: palette.text }]}>{item.textEnglish || 'No English text in source record.'}</Text>
              {item.explanation ? <Text style={[styles.explanation, { color: palette.text }]}>{item.explanation}</Text> : null}
              <Text style={[styles.meta, { color: palette.subtleText }]}>Grade: {item.grade || 'Pending'}</Text>
              <Pressable
                onPress={() => void handleToggleBookmark(item.id)}
                style={[
                  styles.button,
                  {
                    backgroundColor: item.isBookmarked ? palette.accentSoft : palette.surface,
                    borderColor: item.isBookmarked ? palette.accent : palette.border,
                  },
                ]}
              >
                <Text style={[styles.buttonLabel, { color: item.isBookmarked ? palette.accent : palette.text }]}>
                  {item.isBookmarked ? 'Saved' : 'Bookmark'}
                </Text>
              </Pressable>
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
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 9 },
  meta: { fontSize: 12, lineHeight: 18 },
  arabic: { fontSize: 23, lineHeight: 36, textAlign: 'right' },
  english: { fontSize: 14, lineHeight: 21 },
  explanation: { fontSize: 13, lineHeight: 20 },
  button: { borderRadius: 12, borderWidth: 1, paddingVertical: 10, alignItems: 'center' },
  buttonLabel: { fontSize: 13, fontWeight: '600' },
});
