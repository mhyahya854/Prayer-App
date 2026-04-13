import { useLocalSearchParams, Stack } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';

import * as WebBrowser from 'expo-web-browser';

import { SectionCard } from '@/src/components/SectionCard';
import { useContentData } from '@/src/content/content-provider';
import type { QuranChapterDetail } from '@/src/content/types';
import { useAppPalette } from '@/src/theme/palette';
import { useGoogleDriveSync } from '@/src/sync/google-drive-sync-provider';

export default function QuranChapterScreen() {
  const palette = useAppPalette();
  const { chapterId, verseId } = useLocalSearchParams<{ chapterId: string; verseId?: string }>();
  const parsedChapterId = Number(chapterId);
  const requestedVerseId = verseId ? Number(verseId) : null;
  const { getQuranChapterDetail, isReady, setQuranLastRead, toggleQuranBookmark } = useContentData();
  const { exportDocument } = useGoogleDriveSync();
  const [chapterDetail, setChapterDetail] = useState<QuranChapterDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady || Number.isNaN(parsedChapterId)) {
      return;
    }

    let isMounted = true;

    async function loadChapter() {
      setIsLoading(true);
      setError(null);

      try {
        const nextDetail = await getQuranChapterDetail(parsedChapterId);

        if (isMounted) {
          setChapterDetail(nextDetail);

          if (!nextDetail) {
            setError('Unable to find this surah in the local database.');
          }
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load this surah.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadChapter();

    return () => {
      isMounted = false;
    };
  }, [getQuranChapterDetail, isReady, parsedChapterId]);

  async function handleSetLastRead(verseNumber: number) {
    await setQuranLastRead(parsedChapterId, verseNumber);
    setChapterDetail((currentValue) =>
      currentValue
        ? {
            ...currentValue,
            verses: currentValue.verses.map((verse) => ({
              ...verse,
              isLastRead: verse.verseId === verseNumber,
            })),
          }
        : currentValue,
    );
  }

  async function handleToggleBookmark(verseNumber: number) {
    const isBookmarked = await toggleQuranBookmark(parsedChapterId, verseNumber);

    setChapterDetail((currentValue) =>
      currentValue
        ? {
            ...currentValue,
            verses: currentValue.verses.map((verse) =>
              verse.verseId === verseNumber ? { ...verse, isBookmarked } : verse,
            ),
          }
        : currentValue,
    );
  }

  async function handleExportSurah() {
    if (!chapterDetail || isExporting) return;
    setIsExporting(true);
    setExportUrl(null);
    setError(null);
    
    try {
      const markdown = `# ${chapterDetail.transliteration} (${chapterDetail.arabicName})\n\n${chapterDetail.translation}\nRevelation Type: ${chapterDetail.type}\nTotal Ayahs: ${chapterDetail.totalVerses}\n\n---\n\n` + 
        chapterDetail.verses.map(v => 
          `### Ayah ${v.verseId}\n\n**${v.arabicText}**\n\n_${v.transliteration}_\n\n${v.translation}${v.explanation ? `\n\n**Tafsir:**\n${v.explanation}` : ''}`
        ).join('\n\n---\n\n');
        
      const response = await exportDocument(
        'Prayer App Study',
        `${chapterDetail.transliteration}.md`,
        markdown,
        'text/markdown'
      );
      
      if (response?.webViewLink) {
        setExportUrl(response.webViewLink);
      } else if (response?.fileId) {
        setExportUrl(`https://drive.google.com/file/d/${response.fileId}/view`);
      } else {
        setError('Failed to export. Note: This feature requires signing back into Google Drive to grant visible folder permissions.');
      }
    } catch (err) {
      setError('An error occurred during export.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: chapterDetail?.transliteration ?? 'Quran Reader' }} />

      <ScrollView
        style={[styles.screen, { backgroundColor: palette.background }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <SectionCard title="Loading surah" subtitle="Reading from the local database">
            <View style={styles.loadingState}>
              <ActivityIndicator color={palette.accent} />
              <Text style={[styles.helperCopy, { color: palette.subtleText }]}>Loading verses...</Text>
            </View>
          </SectionCard>
        ) : null}

        {chapterDetail ? (
          <>
            <View style={[styles.hero, { backgroundColor: palette.hero, borderColor: palette.border }]}>
              <Text style={[styles.title, { color: palette.text }]}>{chapterDetail.transliteration}</Text>
              <Text style={[styles.arabicTitle, { color: palette.text }]}>{chapterDetail.arabicName}</Text>
              <Text style={[styles.copy, { color: palette.subtleText }]}>
                {chapterDetail.translation} | {chapterDetail.type} | {chapterDetail.totalVerses} ayat
              </Text>
              {requestedVerseId ? (
                <Text style={[styles.copy, { color: palette.text }]}>Opened from search at verse {requestedVerseId}.</Text>
              ) : null}

              {exportUrl ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void WebBrowser.openBrowserAsync(exportUrl)}
                  style={[styles.primaryButton, { backgroundColor: palette.accentSoft, borderColor: palette.accent }]}
                >
                  <Text style={[styles.primaryButtonLabel, { color: palette.accent }]}>Open in Google Drive</Text>
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void handleExportSurah()}
                  disabled={isExporting}
                  style={[styles.primaryButton, { backgroundColor: isExporting ? palette.surface : palette.accent, borderColor: isExporting ? palette.border : palette.accent }]}
                >
                  <Text style={[styles.primaryButtonLabel, { color: isExporting ? palette.subtleText : palette.surface }]}>
                    {isExporting ? 'Exporting...' : 'Export Notes to Google Drive'}
                  </Text>
                </Pressable>
              )}
            </View>

            <SectionCard title="Reader" subtitle="Resume later or save a verse">
              {chapterDetail.verses.map((verse) => {
                const isRequestedVerse = requestedVerseId === verse.verseId;
                const backgroundColor = verse.isLastRead || isRequestedVerse ? palette.highlight : palette.surface;

                return (
                  <View
                    key={`${verse.chapterId}-${verse.verseId}`}
                    style={[
                      styles.verseCard,
                      {
                        backgroundColor,
                        borderColor: verse.isBookmarked ? palette.accent : palette.border,
                      },
                    ]}
                  >
                    <View style={styles.verseHeader}>
                      <Text style={[styles.verseNumber, { color: palette.subtleText }]}>Ayah {verse.verseId}</Text>
                      <View style={styles.verseHeaderMeta}>
                        {verse.isLastRead ? (
                          <View style={[styles.badge, { backgroundColor: palette.accentSoft }]}>
                            <Text style={[styles.badgeLabel, { color: palette.accent }]}>Last read</Text>
                          </View>
                        ) : null}
                        {verse.isBookmarked ? (
                          <View style={[styles.badge, { backgroundColor: palette.accentSoft }]}>
                            <Text style={[styles.badgeLabel, { color: palette.accent }]}>Saved</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    <Text style={[styles.arabicVerse, { color: palette.text }]}>{verse.arabicText}</Text>
                    <Text style={[styles.transliteration, { color: palette.subtleText }]}>{verse.transliteration}</Text>
                    <Text style={[styles.translation, { color: palette.text }]}>{verse.translation}</Text>

                    {verse.explanation ? (
                      <View style={[styles.explanationBlock, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                        <Text style={[styles.explanationLabel, { color: palette.accent }]}>Tafsir</Text>
                        <Text style={[styles.explanationText, { color: palette.text }]}>{verse.explanation}</Text>
                      </View>
                    ) : null}

                    <View style={styles.actionRow}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => void handleSetLastRead(verse.verseId)}
                        style={[styles.secondaryButton, { borderColor: palette.border, backgroundColor: palette.surface }]}
                      >
                        <Text style={[styles.secondaryButtonLabel, { color: palette.text }]}>Set last read</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => void handleToggleBookmark(verse.verseId)}
                        style={[
                          styles.secondaryButton,
                          {
                            backgroundColor: verse.isBookmarked ? palette.accentSoft : palette.surface,
                            borderColor: verse.isBookmarked ? palette.accent : palette.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.secondaryButtonLabel,
                            { color: verse.isBookmarked ? palette.accent : palette.text },
                          ]}
                        >
                          {verse.isBookmarked ? 'Saved' : 'Bookmark'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </SectionCard>
          </>
        ) : null}

        {error ? (
          <SectionCard title="Reader error" subtitle="This screen could not finish loading">
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
  arabicTitle: {
    fontSize: 22,
    textAlign: 'right',
  },
  copy: {
    fontSize: 13,
    lineHeight: 19,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  verseCard: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  verseHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  verseNumber: {
    fontSize: 12,
    fontWeight: '600',
  },
  verseHeaderMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  arabicVerse: {
    fontSize: 25,
    lineHeight: 40,
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
  explanationBlock: {
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    marginTop: 4,
    padding: 14,
  },
  explanationLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  explanationText: {
    fontSize: 14,
    lineHeight: 22,
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
