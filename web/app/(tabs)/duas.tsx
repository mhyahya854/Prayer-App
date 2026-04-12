import { useIsFocused } from '@react-navigation/native';
import { router, type RelativePathString } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';

import { SectionCard } from '@/src/components/SectionCard';
import { useContentData } from '@/src/content/content-provider';
import type { DuaHomeSnapshot } from '@/src/content/types';
import { useAppPalette } from '@/src/theme/palette';

export default function DuasScreen() {
  const palette = useAppPalette();
  const isFocused = useIsFocused();
  const { duaSource, error, getDuaHomeSnapshot, isReady } = useContentData();
  const [homeSnapshot, setHomeSnapshot] = useState<DuaHomeSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isReady || !isFocused) {
      return;
    }

    let isMounted = true;

    async function loadHome() {
      setIsLoading(true);

      try {
        const nextSnapshot = await getDuaHomeSnapshot();

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
  }, [getDuaHomeSnapshot, isFocused, isReady]);

  function openCategory(categorySlug: string) {
    router.push(`../duas/${categorySlug}` as RelativePathString);
  }

  if (!isReady && !error) {
    return (
      <ScrollView style={[styles.screen, { backgroundColor: palette.background }]} contentContainerStyle={styles.content}>
        <SectionCard title="Preparing duas" subtitle="Loading offline content">
          <View style={styles.loadingState}>
            <ActivityIndicator color={palette.accent} />
            <Text style={[styles.helperCopy, { color: palette.subtleText }]}>
              Loading local duas, categories, favorites, and counters.
            </Text>
          </View>
        </SectionCard>
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
        <Text style={[styles.title, { color: palette.text }]}>Duas</Text>
        <Text style={[styles.copy, { color: palette.text }]}>
          Offline duas, favorites, and personal counters.
        </Text>
        <Text style={[styles.heroMeta, { color: palette.subtleText }]}>
          {homeSnapshot?.categories.length ?? 0} categories ready offline
        </Text>
      </View>

      <SectionCard title="Favorites" subtitle="Saved on this device">
        {isLoading ? (
          <Text style={[styles.helperCopy, { color: palette.subtleText }]}>Loading favorites...</Text>
        ) : homeSnapshot?.favoriteDuas.length ? (
          homeSnapshot.favoriteDuas.map((dua) => (
            <Pressable
              key={dua.id}
              accessibilityRole="button"
              onPress={() => openCategory(dua.categorySlug)}
              style={[styles.favoriteCard, { borderColor: palette.border, backgroundColor: palette.surface }]}
            >
              <Text style={[styles.favoriteCategory, { color: palette.subtleText }]}>{dua.categoryTitle}</Text>
              <Text style={[styles.favoriteArabic, { color: palette.text }]} numberOfLines={2}>
                {dua.arabicText}
              </Text>
              <Text style={[styles.favoriteTranslation, { color: palette.text }]} numberOfLines={2}>
                {dua.translation || 'Translation is still missing in the current source record.'}
              </Text>
              <Text style={[styles.favoriteCounter, { color: palette.subtleText }]}>
                Count: {dua.personalCount}
              </Text>
            </Pressable>
          ))
        ) : (
          <Text style={[styles.helperCopy, { color: palette.subtleText }]}>
            No favorite duas yet. Save items from a category to keep them close.
          </Text>
        )}
      </SectionCard>

      <SectionCard title="Categories" subtitle="Hisnul Muslim collection">
        {homeSnapshot?.categories.map((category) => (
          <Pressable
            key={category.slug}
            accessibilityRole="button"
            onPress={() => openCategory(category.slug)}
            style={[styles.categoryRow, { borderBottomColor: palette.border }]}
          >
            <View style={styles.categoryCopy}>
              <Text style={[styles.categoryTitle, { color: palette.text }]}>{category.title}</Text>
              <Text style={[styles.categorySubtitle, { color: palette.subtleText }]}>
                Open the category and continue your personal count.
              </Text>
            </View>
            <Text style={[styles.categoryCount, { color: palette.text }]}>{category.itemCount}</Text>
          </Pressable>
        ))}
      </SectionCard>

      <SectionCard title="Notes" subtitle="Source and scope">
        <Text style={[styles.helperCopy, { color: palette.text }]}>
          {duaSource.collection} from {duaSource.name} {duaSource.version}. Audio and reminder flows are still future work.
        </Text>
        <Text style={[styles.helperCopy, { color: palette.subtleText }]}>
          License: {duaSource.license}
        </Text>
        {error ? <Text style={[styles.helperCopy, { color: palette.text }]}>{error}</Text> : null}
      </SectionCard>
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
  favoriteCard: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 13,
  },
  favoriteCategory: {
    fontSize: 12,
    fontWeight: '500',
  },
  favoriteArabic: {
    fontSize: 21,
    lineHeight: 32,
    textAlign: 'right',
  },
  favoriteTranslation: {
    fontSize: 14,
    lineHeight: 21,
  },
  favoriteCounter: {
    fontSize: 12,
    fontWeight: '500',
  },
  categoryRow: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  categoryCopy: {
    flex: 1,
    gap: 4,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  categorySubtitle: {
    fontSize: 12,
    lineHeight: 18,
  },
  categoryCount: {
    fontSize: 15,
    fontWeight: '600',
  },
  helperCopy: {
    fontSize: 14,
    lineHeight: 21,
  },
  loadingState: {
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
    paddingVertical: 22,
  },
});
