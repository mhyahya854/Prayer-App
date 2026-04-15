import { useIsFocused } from '@react-navigation/native';
import { router, type RelativePathString } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { SectionCard } from '@/src/components/SectionCard';
import { useContentData } from '@/src/content/content-provider';
import type { HadithHomeSnapshot, HadithItem } from '@/src/content/types';
import { useAppPalette } from '@/src/theme/palette';

export default function HadithTabScreen() {
  const palette = useAppPalette();
  const isFocused = useIsFocused();
  const { getHadithHomeSnapshot, isReady, searchHadith } = useContentData();
  const [snapshot, setSnapshot] = useState<HadithHomeSnapshot | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<HadithItem[]>([]);

  useEffect(() => {
    if (!isReady || !isFocused) return;
    void getHadithHomeSnapshot().then(setSnapshot);
  }, [getHadithHomeSnapshot, isFocused, isReady]);

  useEffect(() => {
    const next = query.trim();
    if (!next) {
      setResults([]);
      return;
    }
    void searchHadith(next).then(setResults);
  }, [query, searchHadith]);

  return (
    <ScrollView style={[styles.screen, { backgroundColor: palette.background }]} contentContainerStyle={styles.content}>
      <View style={[styles.hero, { backgroundColor: palette.hero, borderColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.text }]}>Hadith</Text>
        <Text style={[styles.copy, { color: palette.subtleText }]}>Browse books, search narrations, and save bookmarks.</Text>
      </View>

      <SectionCard title="Search" subtitle="Local hadith index">
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search narrator, text, chapter"
          placeholderTextColor={palette.subtleText}
          style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surface }]}
        />
        {results.map((item) => (
          <Pressable
            key={item.id}
            onPress={() =>
              router.push(`../hadith/${item.bookSlug}/${item.chapterId}` as RelativePathString)
            }
            style={[styles.resultCard, { borderColor: palette.border, backgroundColor: palette.surface }]}
          >
            <Text style={[styles.resultTitle, { color: palette.text }]}>{item.bookSlug} #{item.bookHadithNumber}</Text>
            <Text style={[styles.resultBody, { color: palette.text }]} numberOfLines={2}>{item.textEnglish}</Text>
          </Pressable>
        ))}
      </SectionCard>

      <SectionCard title="Books" subtitle="All local collections">
        {snapshot?.books.map((book) => (
          <Pressable
            key={book.slug}
            onPress={() => router.push(`../hadith/${book.slug}` as RelativePathString)}
            style={[styles.row, { borderBottomColor: palette.border }]}
          >
            <View>
              <Text style={[styles.rowTitle, { color: palette.text }]}>{book.titleEnglish}</Text>
              <Text style={[styles.rowMeta, { color: palette.subtleText }]}>{book.titleArabic}</Text>
            </View>
            <Text style={[styles.rowMeta, { color: palette.subtleText }]}>{book.hadithCount}</Text>
          </Pressable>
        ))}
      </SectionCard>

      <SectionCard title="Bookmarks" subtitle="Saved hadith">
        {snapshot?.bookmarkedItems.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => router.push(`../hadith/${item.bookSlug}/${item.chapterId}` as RelativePathString)}
            style={[styles.resultCard, { borderColor: palette.border, backgroundColor: palette.surface }]}
          >
            <Text style={[styles.resultTitle, { color: palette.text }]}>{item.chapterTitleEnglish}</Text>
            <Text style={[styles.resultBody, { color: palette.text }]} numberOfLines={2}>{item.textEnglish}</Text>
          </Pressable>
        ))}
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 14, padding: 18, paddingBottom: 112 },
  hero: { borderRadius: 22, borderWidth: 1, gap: 8, padding: 18 },
  title: { fontSize: 24, fontWeight: '600' },
  copy: { fontSize: 14, lineHeight: 20 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  resultCard: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 },
  resultTitle: { fontSize: 14, fontWeight: '600' },
  resultBody: { fontSize: 13, lineHeight: 19 },
  row: { paddingVertical: 12, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowMeta: { fontSize: 12 },
});
