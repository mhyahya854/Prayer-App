import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';

import { SectionCard } from '@/src/components/SectionCard';
import { useContentData } from '@/src/content/content-provider';
import type { DuaCategoryDetail } from '@/src/content/types';
import { useAppPalette } from '@/src/theme/palette';

export default function DuaCategoryScreen() {
  const palette = useAppPalette();
  const { categorySlug } = useLocalSearchParams<{ categorySlug: string }>();
  const { getDuaCategoryDetail, incrementDuaCounter, isReady, resetDuaCounter, toggleDuaFavorite } = useContentData();
  const [categoryDetail, setCategoryDetail] = useState<DuaCategoryDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady || !categorySlug) {
      return;
    }

    let isMounted = true;

    async function loadCategory() {
      setIsLoading(true);
      setError(null);

      try {
        const nextDetail = await getDuaCategoryDetail(categorySlug);

        if (isMounted) {
          setCategoryDetail(nextDetail);

          if (!nextDetail) {
            setError('Unable to find this dua category in the local database.');
          }
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load this dua category.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadCategory();

    return () => {
      isMounted = false;
    };
  }, [categorySlug, getDuaCategoryDetail, isReady]);

  async function handleToggleFavorite(duaId: string) {
    const isFavorite = await toggleDuaFavorite(duaId);

    setCategoryDetail((currentValue) =>
      currentValue
        ? {
            ...currentValue,
            items: currentValue.items.map((item) => (item.id === duaId ? { ...item, isFavorite } : item)),
          }
        : currentValue,
    );
  }

  async function handleIncrementCounter(duaId: string) {
    await incrementDuaCounter(duaId);

    setCategoryDetail((currentValue) =>
      currentValue
        ? {
            ...currentValue,
            items: currentValue.items.map((item) =>
              item.id === duaId ? { ...item, personalCount: item.personalCount + 1 } : item,
            ),
          }
        : currentValue,
    );
  }

  async function handleResetCounter(duaId: string) {
    await resetDuaCounter(duaId);

    setCategoryDetail((currentValue) =>
      currentValue
        ? {
            ...currentValue,
            items: currentValue.items.map((item) =>
              item.id === duaId ? { ...item, personalCount: 0 } : item,
            ),
          }
        : currentValue,
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: categoryDetail?.title ?? 'Dua Category' }} />

      <ScrollView
        style={[styles.screen, { backgroundColor: palette.background }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <SectionCard title="Loading duas" subtitle="Reading from the local database">
            <View style={styles.loadingState}>
              <ActivityIndicator color={palette.accent} />
              <Text style={[styles.helperCopy, { color: palette.subtleText }]}>Loading category...</Text>
            </View>
          </SectionCard>
        ) : null}

        {categoryDetail ? (
          <>
            <View style={[styles.hero, { backgroundColor: palette.hero, borderColor: palette.border }]}>
              <Text style={[styles.title, { color: palette.text }]}>{categoryDetail.title}</Text>
              <Text style={[styles.copy, { color: palette.subtleText }]}>
                {categoryDetail.itemCount} duas in this category with favorites and personal counts.
              </Text>
            </View>

            <SectionCard title="Supplications" subtitle="Save or keep count">
              {categoryDetail.items.map((item) => (
                <View key={item.id} style={[styles.duaCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                  <Text style={[styles.arabicText, { color: palette.text }]}>{item.arabicText}</Text>
                  <Text style={[styles.transliteration, { color: palette.subtleText }]}>
                    {item.transliteration || 'Transliteration missing in the current source record.'}
                  </Text>
                  <Text style={[styles.translation, { color: palette.text }]}>
                    {item.translation || 'Translation missing in the current source record.'}
                  </Text>

                  <View style={styles.counterRow}>
                    <Text style={[styles.counterLabel, { color: palette.subtleText }]}>
                      Count: {item.personalCount}
                    </Text>
                    {item.isFavorite ? (
                      <View style={[styles.badge, { backgroundColor: palette.accentSoft }]}>
                        <Text style={[styles.badgeLabel, { color: palette.accent }]}>Saved</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.actionRow}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void handleToggleFavorite(item.id)}
                      style={[
                        styles.secondaryButton,
                        {
                          backgroundColor: item.isFavorite ? palette.accentSoft : palette.surface,
                          borderColor: item.isFavorite ? palette.accent : palette.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.secondaryButtonLabel,
                          { color: item.isFavorite ? palette.accent : palette.text },
                        ]}
                      >
                        {item.isFavorite ? 'Saved' : 'Save'}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void handleResetCounter(item.id)}
                      style={[styles.secondaryButton, { borderColor: palette.border, backgroundColor: palette.surface }]}
                    >
                      <Text style={[styles.secondaryButtonLabel, { color: palette.text }]}>Reset</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void handleIncrementCounter(item.id)}
                      style={[styles.secondaryButton, { borderColor: palette.accent, backgroundColor: palette.accentSoft }]}
                    >
                      <Text style={[styles.secondaryButtonLabel, { color: palette.accent }]}>+1 tasbih</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </SectionCard>

            <SectionCard title="Notes" subtitle="Content scope">
              <Text style={[styles.helperCopy, { color: palette.text }]}>
                This category is using real local content. Audio and richer reference details are still future work.
              </Text>
            </SectionCard>
          </>
        ) : null}

        {error ? (
          <SectionCard title="Category error" subtitle="This screen could not finish loading">
            <Text style={[styles.helperCopy, { color: palette.text }]}>{error}</Text>
          </SectionCard>
        ) : null}
      </ScrollView>
    </>
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
    gap: 8,
    padding: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  copy: {
    fontSize: 13,
    lineHeight: 19,
  },
  duaCard: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  arabicText: {
    fontSize: 24,
    lineHeight: 38,
    textAlign: 'right',
  },
  transliteration: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  translation: {
    fontSize: 14,
    lineHeight: 22,
  },
  counterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  counterLabel: {
    fontSize: 12,
    fontWeight: '500',
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
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  secondaryButtonLabel: {
    fontSize: 13,
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
