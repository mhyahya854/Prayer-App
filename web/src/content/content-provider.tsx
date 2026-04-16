import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  ensureContentDatabase,
  getHadithByIds,
  getHadithBookDetail,
  getHadithChapterDetail,
  getHadithHomeSnapshot,
  getPrayerTopics,
  getDuaCategoryDetail,
  getDuaHomeSnapshot,
  getQuranChapterDetail,
  getQuranHomeSnapshot,
  incrementDuaCounter,
  resetDuaCounter,
  searchHadith,
  searchQuran,
  setQuranLastRead,
  toggleHadithBookmark,
  toggleDuaFavorite,
  toggleQuranBookmark,
} from '@/src/content/database.web';
import {
  duaSeedBundle,
  hadithSeedBundle,
  prayerTopicsSeedBundle,
  quranSeedBundle,
} from '@/src/content/seed/data';
import type {
  DuaCategoryDetail,
  DuaHomeSnapshot,
  DuaSourceSummary,
  HadithChapter,
  HadithBook,
  HadithHomeSnapshot,
  HadithItem,
  HadithSourceSummary,
  PrayerTopic,
  PrayerTopicItem,
  PrayerTopicsSourceSummary,
  QuranChapterDetail,
  QuranHomeSnapshot,
  QuranSearchResult,
  QuranSourceSummary,
} from '@/src/content/types';

interface ContentContextValue {
  error: string | null;
  getDuaCategoryDetail: (categorySlug: string) => Promise<DuaCategoryDetail | null>;
  getDuaHomeSnapshot: () => Promise<DuaHomeSnapshot>;
  getHadithBookDetail: (bookSlug: string) => Promise<{ book: HadithBook; chapters: HadithChapter[] } | null>;
  getHadithByIds: (ids: string[]) => Promise<HadithItem[]>;
  getHadithChapterDetail: (bookSlug: string, chapterId: number) => Promise<HadithItem[]>;
  getHadithHomeSnapshot: () => Promise<HadithHomeSnapshot>;
  getPrayerTopics: () => Promise<{ items: PrayerTopicItem[]; topics: PrayerTopic[] }>;
  getQuranChapterDetail: (chapterId: number) => Promise<QuranChapterDetail | null>;
  getQuranHomeSnapshot: () => Promise<QuranHomeSnapshot>;
  incrementDuaCounter: (duaId: string) => Promise<void>;
  isReady: boolean;
  quranSource: QuranSourceSummary;
  duaSource: DuaSourceSummary;
  hadithSource: HadithSourceSummary;
  prayerTopicsSource: PrayerTopicsSourceSummary;
  resetDuaCounter: (duaId: string) => Promise<void>;
  searchHadith: (query: string) => Promise<HadithItem[]>;
  searchQuran: (query: string) => Promise<QuranSearchResult[]>;
  setQuranLastRead: (chapterId: number, verseId: number) => Promise<void>;
  toggleHadithBookmark: (id: string) => Promise<boolean>;
  toggleDuaFavorite: (duaId: string) => Promise<boolean>;
  toggleQuranBookmark: (chapterId: number, verseId: number) => Promise<boolean>;
}

const ContentContext = createContext<ContentContextValue | null>(null);

export function ContentDataProvider({ children }: PropsWithChildren) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      try {
        await ensureContentDatabase();

        if (isMounted) {
          setIsReady(true);
        }
      } catch (initializationError) {
        if (isMounted) {
          setError(
            initializationError instanceof Error
              ? initializationError.message
              : 'Unable to initialize local Quran, dua, and hadith content.',
          );
        }
      }
    }

    void initialize();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <ContentContext.Provider
      value={{
        error,
        getHadithBookDetail,
        getHadithByIds,
        getHadithChapterDetail,
        getHadithHomeSnapshot,
        getPrayerTopics,
        getDuaCategoryDetail,
        getDuaHomeSnapshot,
        getQuranChapterDetail,
        getQuranHomeSnapshot,
        incrementDuaCounter,
        isReady,
        duaSource: duaSeedBundle.source,
        hadithSource: hadithSeedBundle.source,
        prayerTopicsSource: prayerTopicsSeedBundle.source,
        quranSource: quranSeedBundle.source,
        resetDuaCounter,
        searchHadith,
        searchQuran,
        setQuranLastRead,
        toggleHadithBookmark,
        toggleDuaFavorite,
        toggleQuranBookmark,
      }}
    >
      {children}
    </ContentContext.Provider>
  );
}

export function useContentData() {
  const context = useContext(ContentContext);

  if (!context) {
    throw new Error('useContentData must be used inside ContentDataProvider.');
  }

  return context;
}
