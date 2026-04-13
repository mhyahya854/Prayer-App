export interface ContentSourceSummary {
  collection: string;
  license: string;
  name: string;
  version: string;
}

export interface QuranSourceSummary extends ContentSourceSummary {
  translation: string;
}

export interface QuranSeedVerse {
  id: number;
  text: string;
  translation: string;
  transliteration: string;
  explanation?: string | null;
}

export interface QuranSeedChapter {
  arabicName: string;
  id: number;
  totalVerses: number;
  translation: string;
  transliteration: string;
  type: string;
  verses: QuranSeedVerse[];
}

export interface QuranSeedBundle {
  chapters: QuranSeedChapter[];
  source: QuranSourceSummary;
}

export interface DuaSeedCategory {
  itemCount: number;
  order: number;
  slug: string;
  title: string;
}

export interface DuaSeedItem {
  categorySlug: string;
  id: string;
  originalSection: string;
  textArabic: string;
  translation: string;
  transliteration: string;
}

export interface DuaSourceSummary extends ContentSourceSummary {
  itemCount: number;
}

export interface DuaSeedBundle {
  categories: DuaSeedCategory[];
  items: DuaSeedItem[];
  source: DuaSourceSummary;
}

export interface QuranChapterSummary {
  arabicName: string;
  chapterId: number;
  totalVerses: number;
  translation: string;
  transliteration: string;
  type: string;
}

export interface QuranSavedVerse {
  arabicText: string;
  chapterArabicName: string;
  chapterId: number;
  chapterTranslation: string;
  chapterTransliteration: string;
  translation: string;
  transliteration: string;
  explanation?: string | null;
  updatedAt: string;
  verseId: number;
}

export interface QuranBookmark extends QuranSavedVerse {
  createdAt: string;
}

export interface QuranVerse {
  arabicText: string;
  chapterId: number;
  isBookmarked: boolean;
  isLastRead: boolean;
  translation: string;
  transliteration: string;
  explanation?: string | null;
  verseId: number;
}

export interface QuranChapterDetail extends QuranChapterSummary {
  verses: QuranVerse[];
}

export interface QuranSearchResult {
  arabicText: string | null;
  chapterArabicName: string;
  chapterId: number;
  chapterTranslation: string;
  chapterTransliteration: string;
  matchType: 'chapter' | 'verse';
  translationSnippet: string | null;
  verseId: number | null;
}

export interface QuranHomeSnapshot {
  bookmarks: QuranBookmark[];
  chapters: QuranChapterSummary[];
  lastRead: QuranSavedVerse | null;
}

export interface DuaCategorySummary {
  itemCount: number;
  slug: string;
  title: string;
}

export interface DuaItem {
  arabicText: string;
  categorySlug: string;
  categoryTitle: string;
  id: string;
  isFavorite: boolean;
  personalCount: number;
  translation: string;
  transliteration: string;
}

export interface DuaCategoryDetail extends DuaCategorySummary {
  items: DuaItem[];
}

export interface DuaHomeSnapshot {
  categories: DuaCategorySummary[];
  favoriteDuas: DuaItem[];
}
