import { Stack, router, useLocalSearchParams, type RelativePathString } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SectionCard } from '@/src/components/SectionCard';
import { useContentData } from '@/src/content/content-provider';
import type { HadithBook, HadithChapter } from '@/src/content/types';
import { useAppPalette } from '@/src/theme/palette';

export default function HadithBookScreen() {
  const palette = useAppPalette();
  const { bookSlug } = useLocalSearchParams<{ bookSlug: string }>();
  const { getHadithBookDetail, isReady } = useContentData();
  const [book, setBook] = useState<HadithBook | null>(null);
  const [chapters, setChapters] = useState<HadithChapter[]>([]);

  useEffect(() => {
    if (!isReady || !bookSlug) {
      return;
    }

    void getHadithBookDetail(bookSlug).then((result) => {
      setBook(result?.book ?? null);
      setChapters(result?.chapters ?? []);
    });
  }, [bookSlug, getHadithBookDetail, isReady]);

  return (
    <>
      <Stack.Screen options={{ title: book?.titleEnglish ?? 'Hadith Book' }} />
      <ScrollView style={[styles.screen, { backgroundColor: palette.background }]} contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: palette.hero, borderColor: palette.border }]}>
          <Text style={[styles.title, { color: palette.text }]}>{book?.titleEnglish ?? bookSlug}</Text>
          <Text style={[styles.copy, { color: palette.subtleText }]}>{book?.titleArabic}</Text>
        </View>
        <SectionCard title="Chapters" subtitle="Open a chapter">
          {chapters.length ? (
            chapters.map((chapter) => (
              <Pressable
                key={`${chapter.bookSlug}-${chapter.id}`}
                accessibilityRole="button"
                onPress={() => router.push(`../hadith/${chapter.bookSlug}/${chapter.id}` as RelativePathString)}
                style={[styles.row, { borderBottomColor: palette.border }]}
              >
                <View style={styles.chapterCopy}>
                  <Text style={[styles.rowTitle, { color: palette.text }]}>
                    {chapter.titleEnglish || 'Untitled chapter'}
                  </Text>
                  <Text style={[styles.rowMeta, { color: palette.subtleText }]}>{chapter.titleArabic}</Text>
                </View>
                <Text style={[styles.rowMeta, { color: palette.subtleText }]}>{chapter.id}</Text>
              </Pressable>
            ))
          ) : (
            <Text style={[styles.rowMeta, { color: palette.subtleText }]}>No chapters available.</Text>
          )}
        </SectionCard>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 14, padding: 18, paddingBottom: 112 },
  hero: { borderRadius: 22, borderWidth: 1, gap: 8, padding: 18 },
  title: { fontSize: 24, fontWeight: '600' },
  copy: { fontSize: 14, lineHeight: 20, textAlign: 'right' },
  row: {
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  chapterCopy: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowMeta: { fontSize: 12 },
});
