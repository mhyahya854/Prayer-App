import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  ensureContentDatabase,
  getDuaCategoryDetail,
  getDuaHomeSnapshot,
  getQuranChapterDetail,
  getQuranHomeSnapshot,
  incrementDuaCounter,
  resetDuaCounter,
  searchQuran,
  setQuranLastRead,
  toggleDuaFavorite,
  toggleQuranBookmark,
} from '@/src/content/database';
import { duaSeedBundle, quranSeedBundle } from '@/src/content/seed/data';
import type {
  DuaCategoryDetail,
  DuaHomeSnapshot,
  DuaSourceSummary,
  QuranChapterDetail,
  QuranHomeSnapshot,
  QuranSearchResult,
  QuranSourceSummary,
} from '@/src/content/types';

interface ContentContextValue {
  error: string | null;
  getDuaCategoryDetail: (categorySlug: string) => Promise<DuaCategoryDetail | null>;
  getDuaHomeSnapshot: () => Promise<DuaHomeSnapshot>;
  getQuranChapterDetail: (chapterId: number) => Promise<QuranChapterDetail | null>;
  getQuranHomeSnapshot: () => Promise<QuranHomeSnapshot>;
  incrementDuaCounter: (duaId: string) => Promise<void>;
  isReady: boolean;
  quranSource: QuranSourceSummary;
  duaSource: DuaSourceSummary;
  resetDuaCounter: (duaId: string) => Promise<void>;
  searchQuran: (query: string) => Promise<QuranSearchResult[]>;
  setQuranLastRead: (chapterId: number, verseId: number) => Promise<void>;
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
              : 'Unable to initialize local Quran and dua content.',
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
        getDuaCategoryDetail,
        getDuaHomeSnapshot,
        getQuranChapterDetail,
        getQuranHomeSnapshot,
        incrementDuaCounter,
        isReady,
        duaSource: duaSeedBundle.source,
        quranSource: quranSeedBundle.source,
        resetDuaCounter,
        searchQuran,
        setQuranLastRead,
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
