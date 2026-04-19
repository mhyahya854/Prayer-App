import { useIsFocused } from '@react-navigation/native';
import { router, type RelativePathString } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SectionCard } from '@/src/components/SectionCard';
import { useContentData } from '@/src/content/content-provider';
import type { HadithHomeSnapshot, HadithItem } from '@/src/content/types';
import { useAppPalette } from '@/src/theme/palette';

export default function HadithScreen() {
  const { t } = useTranslation();
  const palette = useAppPalette();
  const isFocused = useIsFocused();
  const { error, getHadithHomeSnapshot, hadithSource, isReady, searchHadith } = useContentData();
  const [homeSnapshot, setHomeSnapshot] = useState<HadithHomeSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<HadithItem[]>([]);

  useEffect(() => {
    if (!isReady || !isFocused) {
      return;
    }

    let isMounted = true;

    async function loadHome() {
      setIsLoading(true);

      try {
        const nextSnapshot = await getHadithHomeSnapshot();

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
  }, [getHadithHomeSnapshot, isFocused, isReady]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    let isMounted = true;

    async function runSearch() {
      setIsSearching(true);

      try {
        const nextResults = await searchHadith(trimmedQuery);

        if (isMounted) {
          setResults(nextResults);
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
  }, [isReady, query, searchHadith]);

  function openBook(bookSlug: string) {
    router.push(`../hadith/${bookSlug}` as RelativePathString);
  }

  function openChapter(item: Pick<HadithItem, 'bookSlug' | 'chapterId'>) {
    router.push(`../hadith/${item.bookSlug}/${item.chapterId}` as RelativePathString);
  }

  function openPrayerStudy() {
    router.push('../prayer-study' as RelativePathString);
  }

  if (!isReady && !error) {
    return (
      <ScrollView style={[styles.screen, { backgroundColor: palette.background }]} contentContainerStyle={styles.content}>
        <View style={styles.loadingState}>
          <ActivityIndicator color={palette.accent} size="large" />
          <Text style={[styles.helperCopy, { color: palette.subtleText }]}>
            {t('hadith.preparing')}
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
        <Text style={[styles.title, { color: palette.text }]}>{t('hadith.title')}</Text>
        <Text style={[styles.copy, { color: palette.text }]}>
          {t('hadith.subtitle')}
        </Text>
      </View>

      <SectionCard title={t('quran.search_title')} subtitle={t('hadith.books_subtitle')}>
        <TextInput
          accessibilityLabel={t('hadith.search_title')}
          onChangeText={setQuery}
          placeholder={t('hadith.search_placeholder')}
          placeholderTextColor={palette.subtleText}
          style={[
            styles.searchInput,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              color: palette.text,
            },
          ]}
          value={query}
        />
        {isSearching ? (
          <Text style={[styles.helperCopy, { color: palette.subtleText }]}>{t('quran.searching')}</Text>
        ) : null}
        {!isSearching && query.trim() && results.length === 0 ? (
          <Text style={[styles.helperCopy, { color: palette.subtleText }]}>
            {t('hadith.no_narrations')}
          </Text>
        ) : null}
        {results.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            onPress={() => openChapter(item)}
            style={[styles.resultCard, { borderColor: palette.border, backgroundColor: palette.surface }]}
          >
            <Text style={[styles.resultTitle, { color: palette.text }]}>
              {item.bookSlug} #{item.bookHadithNumber}
            </Text>
            <Text style={[styles.resultBody, { color: palette.text }]} numberOfLines={2}>
              {item.textEnglish}
            </Text>
          </Pressable>
        ))}
      </SectionCard>

      <SectionCard title={t('hadith.prayer_study_title')} subtitle={t('hadith.prayer_study_subtitle')}>
        <Pressable
          accessibilityRole="button"
          onPress={openPrayerStudy}
          style={[styles.topicCard, { borderColor: palette.border, backgroundColor: palette.surface }]}
        >
          <Text style={[styles.topicTitle, { color: palette.text }]}>{t('hadith.open_prayer_study')}</Text>
          <Text style={[styles.topicCopy, { color: palette.subtleText }]}>
            {t('hadith.prayer_study_copy')}
          </Text>
        </Pressable>
      </SectionCard>

      <SectionCard title={t('hadith.books_title')} subtitle={t('hadith.books_subtitle')}>
        {isLoading ? (
          <Text style={[styles.helperCopy, { color: palette.subtleText }]}>{t('hadith.loading_books')}</Text>
        ) : (
          homeSnapshot?.books.map((book) => (
            <Pressable
              key={book.slug}
              accessibilityRole="button"
              onPress={() => openBook(book.slug)}
              style={[styles.bookRow, { borderBottomColor: palette.border }]}
            >
              <View style={styles.bookCopy}>
                <Text style={[styles.bookTitle, { color: palette.text }]}>{book.titleEnglish}</Text>
                <Text style={[styles.bookMeta, { color: palette.subtleText }]}>{book.titleArabic}</Text>
              </View>
              <Text style={[styles.bookMeta, { color: palette.text }]}>{book.hadithCount}</Text>
            </Pressable>
          ))
        )}
      </SectionCard>

      <SectionCard title={t('hadith.bookmarks_title')} subtitle={t('hadith.bookmarks_subtitle')}>
        {isLoading ? (
          <Text style={[styles.helperCopy, { color: palette.subtleText }]}>{t('hadith.loading_books')}</Text>
        ) : homeSnapshot?.bookmarkedItems.length ? (
          homeSnapshot.bookmarkedItems.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              onPress={() => openChapter(item)}
              style={[styles.resultCard, { borderColor: palette.border, backgroundColor: palette.surface }]}
            >
              <Text style={[styles.resultTitle, { color: palette.text }]}>{item.chapterTitleEnglish}</Text>
              <Text style={[styles.resultBody, { color: palette.text }]} numberOfLines={2}>
                {item.textEnglish}
              </Text>
            </Pressable>
          ))
        ) : (
          <Text style={[styles.helperCopy, { color: palette.subtleText }]}>
            {t('hadith.no_bookmarks')}
          </Text>
        )}
      </SectionCard>

      <Text style={[styles.attribution, { color: palette.subtleText }]}>
        {hadithSource.collection} | {hadithSource.name} {hadithSource.version} | {hadithSource.license}
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
  searchInput: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  resultCard: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 7,
    padding: 13,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  resultBody: {
    fontSize: 13,
    lineHeight: 20,
  },
  topicCard: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    padding: 13,
  },
  topicTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  topicCopy: {
    fontSize: 13,
    lineHeight: 19,
  },
  bookRow: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  bookCopy: {
    flex: 1,
    gap: 4,
  },
  bookTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  bookMeta: {
    fontSize: 12,
    lineHeight: 18,
  },
  helperCopy: {
    fontSize: 14,
    lineHeight: 21,
  },
  loadingState: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  attribution: {
    fontSize: 11,
    lineHeight: 18,
    opacity: 0.6,
    paddingHorizontal: 24,
    paddingVertical: 8,
    textAlign: 'center',
  },
});
