import { useIsFocused } from '@react-navigation/native';
import { router, type RelativePathString } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEffect, useState } from 'react';

import { SectionCard } from '@/src/components/SectionCard';
import { useContentData } from '@/src/content/content-provider';
import type { QuranHomeSnapshot, QuranSearchResult } from '@/src/content/types';
import { useAppPalette } from '@/src/theme/palette';

export default function QuranScreen() {
  const palette = useAppPalette();
  const isFocused = useIsFocused();
  const { error, getQuranHomeSnapshot, isReady, quranSource, searchQuran } = useContentData();
  const [homeSnapshot, setHomeSnapshot] = useState<QuranHomeSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<QuranSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const lastRead = homeSnapshot?.lastRead ?? null;

  useEffect(() => {
    if (!isReady || !isFocused) {
      return;
    }

    let isMounted = true;

    async function loadHome() {
      setIsLoading(true);

      try {
        const nextSnapshot = await getQuranHomeSnapshot();

        if (isMounted) {
          setHomeSnapshot(nextSnapshot);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadHome();

    return () => {
      isMounted = false;
    };
  }, [getQuranHomeSnapshot, isFocused, isReady]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let isMounted = true;

    async function runSearch() {
      setIsSearching(true);

      try {
        const nextResults = await searchQuran(trimmedQuery);

        if (isMounted) {
          setSearchResults(nextResults);
        }
      } finally {
        if (isMounted) {
          setIsSearching(false);
        }
      }
    }

    void runSearch();

    return () => {
      isMounted = false;
    };
  }, [isReady, searchQuran, searchQuery]);

  function openChapter(chapterId: number, verseId?: number | null) {
    const search = verseId ? `?verseId=${verseId}` : '';
    router.push(`../quran/${chapterId}${search}` as RelativePathString);
  }

  if (!isReady && !error) {
    return (
      <ScrollView style={[styles.screen, { backgroundColor: palette.background }]} contentContainerStyle={styles.content}>
        <View style={styles.loadingState}>
          <ActivityIndicator color={palette.accent} size="large" />
          <Text style={[styles.helperCopy, { color: palette.subtleText }]}>
            Preparing your Quran
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.hero, { backgroundColor: palette.hero, borderColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.text }]}>Quran</Text>
        <Text style={[styles.copy, { color: palette.text }]}>
          Read, search, and save verses.
        </Text>
        {lastRead ? (
          <>
            <Text style={[styles.heroMeta, { color: palette.subtleText }]}>
              Continue from {lastRead.chapterTransliteration} {lastRead.verseId}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => openChapter(lastRead.chapterId, lastRead.verseId)}
              style={[styles.primaryButton, { backgroundColor: palette.accent }]}
            >
              <Text style={[styles.primaryButtonLabel, { color: palette.surface }]}>Continue reading</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => openChapter(1)}
            style={[styles.primaryButton, { backgroundColor: palette.accent }]}
          >
            <Text style={[styles.primaryButtonLabel, { color: palette.surface }]}>Begin with Al-Fatihah</Text>
          </Pressable>
        )}
      </View>

      <SectionCard title="Search" subtitle="Find a surah, verse, or phrase">
        <TextInput
          accessibilityLabel="Search Quran"
          onChangeText={setSearchQuery}
          placeholder="Search mercy, Fatiha, or verse"
          placeholderTextColor={palette.subtleText}
          style={[
            styles.searchInput,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              color: palette.text,
            },
          ]}
          value={searchQuery}
        />
        {isSearching ? (
          <Text style={[styles.helperCopy, { color: palette.subtleText }]}>Searching…</Text>
        ) : null}
        {!isSearching && searchQuery.trim() && searchResults.length === 0 ? (
          <Text style={[styles.helperCopy, { color: palette.subtleText }]}>
            No results found.
          </Text>
        ) : null}
        {searchResults.map((result) => (
          <Pressable
            key={`${result.matchType}-${result.chapterId}-${result.verseId ?? 0}`}
            accessibilityRole="button"
            onPress={() => openChapter(result.chapterId, result.verseId)}
            style={[styles.searchResult, { borderColor: palette.border, backgroundColor: palette.surface }]}
          >
            <View style={styles.searchHeader}>
              <Text style={[styles.searchTitle, { color: palette.text }]}>
                {result.chapterTransliteration} {result.verseId ? `| ${result.verseId}` : ''}
              </Text>
              <View style={[styles.badge, { backgroundColor: palette.accentSoft }]}>
                <Text style={[styles.badgeLabel, { color: palette.accent }]}>
                  {result.matchType === 'chapter' ? 'Surah' : 'Verse'}
                </Text>
              </View>
            </View>
            <Text style={[styles.searchSubtitle, { color: palette.subtleText }]}>
              {result.chapterArabicName} | {result.chapterTranslation}
            </Text>
            {result.translationSnippet ? (
              <Text style={[styles.searchSnippet, { color: palette.text }]}>{result.translationSnippet}</Text>
            ) : null}
            {result.arabicText ? (
              <Text style={[styles.searchArabic, { color: palette.text }]} numberOfLines={2}>
                {result.arabicText}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </SectionCard>

      <SectionCard title="Saved verses" subtitle="Bookmarks on this device">
        {isLoading ? (
          <Text style={[styles.helperCopy, { color: palette.subtleText }]}>Loading bookmarks...</Text>
        ) : homeSnapshot?.bookmarks.length ? (
          homeSnapshot.bookmarks.map((bookmark) => (
            <Pressable
              key={`${bookmark.chapterId}-${bookmark.verseId}`}
              accessibilityRole="button"
              onPress={() => openChapter(bookmark.chapterId, bookmark.verseId)}
              style={[styles.savedItem, { borderBottomColor: palette.border }]}
            >
              <Text style={[styles.savedTitle, { color: palette.text }]}>
                {bookmark.chapterTransliteration} | {bookmark.verseId}
              </Text>
              <Text style={[styles.savedSubtitle, { color: palette.subtleText }]}>
                {bookmark.chapterArabicName} | {bookmark.chapterTranslation}
              </Text>
              <Text style={[styles.savedVerse, { color: palette.text }]} numberOfLines={2}>
                {bookmark.translation}
              </Text>
            </Pressable>
          ))
        ) : (
          <Text style={[styles.helperCopy, { color: palette.subtleText }]}>
            No bookmarks yet. Save verses from the reader to keep them close.
          </Text>
        )}
      </SectionCard>

      <SectionCard title="All surahs" subtitle="Full offline chapter list">
        {homeSnapshot?.chapters.map((chapter) => (
          <Pressable
            key={chapter.chapterId}
            accessibilityRole="button"
            onPress={() => openChapter(chapter.chapterId)}
            style={[styles.chapterRow, { borderBottomColor: palette.border }]}
          >
            <View style={styles.chapterCopy}>
              <Text style={[styles.chapterTitle, { color: palette.text }]}>
                {chapter.chapterId}. {chapter.transliteration}
              </Text>
              <Text style={[styles.chapterSubtitle, { color: palette.subtleText }]}>
                {chapter.translation} | {chapter.type}
              </Text>
            </View>
            <View style={styles.chapterMeta}>
              <Text style={[styles.chapterArabic, { color: palette.text }]}>{chapter.arabicName}</Text>
              <Text style={[styles.chapterVerseCount, { color: palette.subtleText }]}>{chapter.totalVerses} ayat</Text>
            </View>
          </Pressable>
        ))}
      </SectionCard>

      <Text style={[styles.attribution, { color: palette.subtleText }]}>
        {quranSource.collection} · {quranSource.name} {quranSource.version} · {quranSource.license}
      </Text>
      {error ? <Text style={[styles.helperCopy, { color: palette.danger }]}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: 14,
    padding: 18,
    paddingBottom: 112,
  },
  hero: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    padding: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  copy: {
    fontSize: 14,
    lineHeight: 21,
  },
  heroMeta: {
    fontSize: 13,
    fontWeight: '500',
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  searchInput: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchResult: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 7,
    padding: 13,
  },
  searchHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  searchTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  searchSubtitle: {
    fontSize: 12,
    lineHeight: 18,
  },
  searchSnippet: {
    fontSize: 14,
    lineHeight: 21,
  },
  searchArabic: {
    fontSize: 19,
    lineHeight: 30,
    textAlign: 'right',
  },
  savedItem: {
    borderBottomWidth: 1,
    gap: 4,
    paddingVertical: 12,
  },
  savedTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  savedSubtitle: {
    fontSize: 12,
    lineHeight: 18,
  },
  savedVerse: {
    fontSize: 14,
    lineHeight: 21,
  },
  chapterRow: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  chapterCopy: {
    flex: 1,
    gap: 4,
  },
  chapterTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  chapterSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    textTransform: 'capitalize',
  },
  chapterMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  chapterArabic: {
    fontSize: 22,
    textAlign: 'right',
  },
  chapterVerseCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  helperCopy: {
    fontSize: 14,
    lineHeight: 21,
  },
  loadingState: {
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
    paddingVertical: 40,
    flex: 1,
  },
  attribution: {
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingVertical: 8,
    opacity: 0.6,
  },
});
