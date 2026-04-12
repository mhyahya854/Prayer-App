import AsyncStorage from '@react-native-async-storage/async-storage';

import { duaSeedBundle, quranSeedBundle } from '@/src/content/seed/data';
import type {
  DuaCategoryDetail,
  DuaCategorySummary,
  DuaHomeSnapshot,
  DuaItem,
  QuranBookmark,
  QuranChapterDetail,
  QuranChapterSummary,
  QuranHomeSnapshot,
  QuranSavedVerse,
  QuranSearchResult,
  QuranVerse,
} from '@/src/content/types';

const quranBookmarksStorageKey = 'prayer-app.web.quran-bookmarks';
const quranLastReadStorageKey = 'prayer-app.web.quran-last-read';
const duaFavoritesStorageKey = 'prayer-app.web.dua-favorites';
const duaCountersStorageKey = 'prayer-app.web.dua-counters';

const quranChapterMap = new Map(quranSeedBundle.chapters.map((chapter) => [chapter.id, chapter]));
const duaCategoryMap = new Map(duaSeedBundle.categories.map((category) => [category.slug, category]));
const duaItemMap = new Map(duaSeedBundle.items.map((item) => [item.id, item]));
const duaItemsByCategory = new Map<string, typeof duaSeedBundle.items>();

for (const category of duaSeedBundle.categories) {
  duaItemsByCategory.set(
    category.slug,
    duaSeedBundle.items.filter((item) => item.categorySlug === category.slug),
  );
}

interface LastReadRecord {
  chapterId: number;
  updatedAt: string;
  verseId: number;
}

let hasHydratedState = false;
let quranBookmarks: Record<string, string> = {};
let quranLastRead: LastReadRecord | null = null;
let duaFavorites: Record<string, string> = {};
let duaCounters: Record<string, number> = {};

function verseKey(chapterId: number, verseId: number) {
  return `${chapterId}:${verseId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readJson(key: string) {
  const rawValue = await AsyncStorage.getItem(key);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as unknown;
  } catch {
    return null;
  }
}

async function persistState(key: string, value: unknown) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

async function hydrateState() {
  if (hasHydratedState) {
    return;
  }

  const [bookmarkValue, lastReadValue, favoriteValue, counterValue] = await Promise.all([
    readJson(quranBookmarksStorageKey),
    readJson(quranLastReadStorageKey),
    readJson(duaFavoritesStorageKey),
    readJson(duaCountersStorageKey),
  ]);

  if (isRecord(bookmarkValue)) {
    quranBookmarks = Object.fromEntries(
      Object.entries(bookmarkValue).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
  }

  if (
    isRecord(lastReadValue) &&
    typeof lastReadValue.chapterId === 'number' &&
    typeof lastReadValue.verseId === 'number' &&
    typeof lastReadValue.updatedAt === 'string'
  ) {
    quranLastRead = {
      chapterId: lastReadValue.chapterId,
      updatedAt: lastReadValue.updatedAt,
      verseId: lastReadValue.verseId,
    };
  }

  if (isRecord(favoriteValue)) {
    duaFavorites = Object.fromEntries(
      Object.entries(favoriteValue).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
  }

  if (isRecord(counterValue)) {
    duaCounters = Object.fromEntries(
      Object.entries(counterValue).filter(
        (entry): entry is [string, number] => typeof entry[1] === 'number' && !Number.isNaN(entry[1]),
      ),
    );
  }

  hasHydratedState = true;
}

function buildQuranChapterSummary(chapterId: number): QuranChapterSummary {
  const chapter = quranChapterMap.get(chapterId);

  if (!chapter) {
    throw new Error(`Unknown Quran chapter ${chapterId}.`);
  }

  return {
    arabicName: chapter.arabicName,
    chapterId: chapter.id,
    totalVerses: chapter.totalVerses,
    translation: chapter.translation,
    transliteration: chapter.transliteration,
    type: chapter.type,
  };
}

function buildQuranSavedVerse(chapterId: number, verseId: number, updatedAt: string): QuranSavedVerse {
  const chapter = quranChapterMap.get(chapterId);
  const verse = chapter?.verses.find((entry) => entry.id === verseId);

  if (!chapter || !verse) {
    throw new Error(`Unknown Quran verse ${chapterId}:${verseId}.`);
  }

  return {
    arabicText: verse.text,
    chapterArabicName: chapter.arabicName,
    chapterId,
    chapterTranslation: chapter.translation,
    chapterTransliteration: chapter.transliteration,
    translation: verse.translation,
    transliteration: verse.transliteration,
    updatedAt,
    verseId,
  };
}

function buildDuaItem(itemId: string): DuaItem {
  const item = duaItemMap.get(itemId);
  const category = item ? duaCategoryMap.get(item.categorySlug) : null;

  if (!item || !category) {
    throw new Error(`Unknown dua item ${itemId}.`);
  }

  return {
    arabicText: item.textArabic,
    categorySlug: item.categorySlug,
    categoryTitle: category.title,
    id: item.id,
    isFavorite: Object.hasOwn(duaFavorites, item.id),
    personalCount: duaCounters[item.id] ?? 0,
    translation: item.translation,
    transliteration: item.transliteration,
  };
}

export async function ensureContentDatabase() {
  await hydrateState();
  return null;
}

export async function getQuranHomeSnapshot(): Promise<QuranHomeSnapshot> {
  await ensureContentDatabase();

  const bookmarks = Object.entries(quranBookmarks)
    .sort((left, right) => right[1].localeCompare(left[1]))
    .slice(0, 6)
    .map(([key, createdAt]): QuranBookmark => {
      const [chapterIdValue, verseIdValue] = key.split(':');
      const savedVerse = buildQuranSavedVerse(Number(chapterIdValue), Number(verseIdValue), createdAt);

      return {
        ...savedVerse,
        createdAt,
      };
    });

  return {
    bookmarks,
    chapters: quranSeedBundle.chapters.map((chapter) => buildQuranChapterSummary(chapter.id)),
    lastRead: quranLastRead
      ? buildQuranSavedVerse(quranLastRead.chapterId, quranLastRead.verseId, quranLastRead.updatedAt)
      : null,
  };
}

export async function searchQuran(query: string): Promise<QuranSearchResult[]> {
  await ensureContentDatabase();

  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  const chapterMatches = quranSeedBundle.chapters
    .filter((chapter) => {
      const haystack = `${chapter.arabicName} ${chapter.transliteration} ${chapter.translation}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    })
    .slice(0, 8)
    .map(
      (chapter): QuranSearchResult => ({
        arabicText: null,
        chapterArabicName: chapter.arabicName,
        chapterId: chapter.id,
        chapterTranslation: chapter.translation,
        chapterTransliteration: chapter.transliteration,
        matchType: 'chapter',
        translationSnippet: null,
        verseId: null,
      }),
    );

  const verseMatches: QuranSearchResult[] = [];

  for (const chapter of quranSeedBundle.chapters) {
    for (const verse of chapter.verses) {
      const haystack = `${verse.text} ${verse.transliteration} ${verse.translation}`.toLowerCase();

      if (!haystack.includes(normalizedQuery)) {
        continue;
      }

      verseMatches.push({
        arabicText: verse.text,
        chapterArabicName: chapter.arabicName,
        chapterId: chapter.id,
        chapterTranslation: chapter.translation,
        chapterTransliteration: chapter.transliteration,
        matchType: 'verse',
        translationSnippet: verse.translation.slice(0, 220),
        verseId: verse.id,
      });

      if (verseMatches.length === 12) {
        return [...chapterMatches, ...verseMatches];
      }
    }
  }

  return [...chapterMatches, ...verseMatches];
}

export async function getQuranChapterDetail(chapterId: number): Promise<QuranChapterDetail | null> {
  await ensureContentDatabase();

  const chapter = quranChapterMap.get(chapterId);

  if (!chapter) {
    return null;
  }

  return {
    ...buildQuranChapterSummary(chapterId),
    verses: chapter.verses.map(
      (verse): QuranVerse => ({
        arabicText: verse.text,
        chapterId,
        isBookmarked: Object.hasOwn(quranBookmarks, verseKey(chapterId, verse.id)),
        isLastRead: quranLastRead?.chapterId === chapterId && quranLastRead.verseId === verse.id,
        translation: verse.translation,
        transliteration: verse.transliteration,
        verseId: verse.id,
      }),
    ),
  };
}

export async function setQuranLastRead(chapterId: number, verseId: number) {
  await ensureContentDatabase();
  quranLastRead = {
    chapterId,
    updatedAt: new Date().toISOString(),
    verseId,
  };
  await persistState(quranLastReadStorageKey, quranLastRead);
}

export async function toggleQuranBookmark(chapterId: number, verseId: number) {
  await ensureContentDatabase();
  const key = verseKey(chapterId, verseId);

  if (Object.hasOwn(quranBookmarks, key)) {
    delete quranBookmarks[key];
    await persistState(quranBookmarksStorageKey, quranBookmarks);
    return false;
  }

  quranBookmarks[key] = new Date().toISOString();
  await persistState(quranBookmarksStorageKey, quranBookmarks);
  return true;
}

export async function getDuaHomeSnapshot(): Promise<DuaHomeSnapshot> {
  await ensureContentDatabase();

  return {
    categories: duaSeedBundle.categories.map(
      (category): DuaCategorySummary => ({
        itemCount: category.itemCount,
        slug: category.slug,
        title: category.title,
      }),
    ),
    favoriteDuas: Object.entries(duaFavorites)
      .sort((left, right) => right[1].localeCompare(left[1]))
      .slice(0, 6)
      .map(([itemId]) => buildDuaItem(itemId)),
  };
}

export async function getDuaCategoryDetail(categorySlug: string): Promise<DuaCategoryDetail | null> {
  await ensureContentDatabase();

  const category = duaCategoryMap.get(categorySlug);
  const items = duaItemsByCategory.get(categorySlug);

  if (!category || !items) {
    return null;
  }

  return {
    itemCount: category.itemCount,
    items: items.map((item) => buildDuaItem(item.id)),
    slug: category.slug,
    title: category.title,
  };
}

export async function toggleDuaFavorite(duaId: string) {
  await ensureContentDatabase();

  if (Object.hasOwn(duaFavorites, duaId)) {
    delete duaFavorites[duaId];
    await persistState(duaFavoritesStorageKey, duaFavorites);
    return false;
  }

  duaFavorites[duaId] = new Date().toISOString();
  await persistState(duaFavoritesStorageKey, duaFavorites);
  return true;
}

export async function incrementDuaCounter(duaId: string) {
  await ensureContentDatabase();
  duaCounters[duaId] = (duaCounters[duaId] ?? 0) + 1;
  await persistState(duaCountersStorageKey, duaCounters);
}

export async function resetDuaCounter(duaId: string) {
  await ensureContentDatabase();
  duaCounters[duaId] = 0;
  await persistState(duaCountersStorageKey, duaCounters);
}
