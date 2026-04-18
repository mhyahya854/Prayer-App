import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { contentSeedVersion, duaSeedBundle, quranSeedBundle } from '@/src/content/seed/data';
import type {
  DuaCategoryDetail,
  DuaCategorySummary,
  DuaHomeSnapshot,
  DuaItem,
  QuranChapterDetail,
  QuranChapterSummary,
  QuranHomeSnapshot,
  QuranSavedVerse,
  QuranSearchResult,
  QuranVerse,
} from '@/src/content/types';

const databaseName = 'prayer-app.db';
const contentVersionMetaKey = 'content_seed_version_v2';

let databasePromise: Promise<SQLiteDatabase> | null = null;

function escapeLikeQuery(value: string) {
  return `%${value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
}

function boolFromDatabase(value: number | null | undefined) {
  return value === 1;
}

function mapQuranChapterSummary(row: {
  arabicName: string;
  chapterId: number;
  totalVerses: number;
  translation: string;
  transliteration: string;
  type: string;
}): QuranChapterSummary {
  return {
    arabicName: row.arabicName,
    chapterId: row.chapterId,
    totalVerses: row.totalVerses,
    translation: row.translation,
    transliteration: row.transliteration,
    type: row.type,
  };
}

function mapQuranSavedVerse(row: {
  arabicText: string;
  chapterArabicName: string;
  chapterId: number;
  chapterTranslation: string;
  chapterTransliteration: string;
  createdAt?: string;
  translation: string;
  transliteration: string;
  explanation?: string | null;
  updatedAt: string;
  verseId: number;
}): QuranSavedVerse {
  return {
    arabicText: row.arabicText,
    chapterArabicName: row.chapterArabicName,
    chapterId: row.chapterId,
    chapterTranslation: row.chapterTranslation,
    chapterTransliteration: row.chapterTransliteration,
    translation: row.translation,
    transliteration: row.transliteration,
    explanation: row.explanation,
    updatedAt: row.updatedAt,
    verseId: row.verseId,
  };
}

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = openDatabaseAsync(databaseName);
  }

  return databasePromise;
}

async function migrateDatabase(database: SQLiteDatabase) {
  await database.execAsync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quran_chapters (
      chapter_id INTEGER PRIMARY KEY NOT NULL,
      arabic_name TEXT NOT NULL,
      transliteration TEXT NOT NULL,
      translation TEXT NOT NULL,
      revelation_type TEXT NOT NULL,
      total_verses INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quran_verses (
      chapter_id INTEGER NOT NULL,
      verse_id INTEGER NOT NULL,
      arabic_text TEXT NOT NULL,
      transliteration TEXT NOT NULL,
      translation TEXT NOT NULL,
      explanation TEXT,
      PRIMARY KEY (chapter_id, verse_id),
      FOREIGN KEY (chapter_id) REFERENCES quran_chapters(chapter_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quran_bookmarks (
      chapter_id INTEGER NOT NULL,
      verse_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (chapter_id, verse_id),
      FOREIGN KEY (chapter_id, verse_id) REFERENCES quran_verses(chapter_id, verse_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quran_reading_state (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      chapter_id INTEGER NOT NULL,
      verse_id INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (chapter_id, verse_id) REFERENCES quran_verses(chapter_id, verse_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS dua_categories (
      slug TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      item_count INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS duas (
      id TEXT PRIMARY KEY NOT NULL,
      category_slug TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      original_section TEXT NOT NULL,
      arabic_text TEXT NOT NULL,
      transliteration TEXT NOT NULL,
      translation TEXT NOT NULL,
      FOREIGN KEY (category_slug) REFERENCES dua_categories(slug) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS dua_favorites (
      dua_id TEXT PRIMARY KEY NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (dua_id) REFERENCES duas(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS dua_counters (
      dua_id TEXT PRIMARY KEY NOT NULL,
      current_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (dua_id) REFERENCES duas(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_quran_bookmarks_created_at ON quran_bookmarks(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_dua_favorites_created_at ON dua_favorites(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_duas_category_slug ON duas(category_slug, sort_order);
  `);
}

async function seedContentIfNeeded(database: SQLiteDatabase) {
  const existingVersion = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_meta WHERE key = ?',
    contentVersionMetaKey,
  );
  const quranCount = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM quran_chapters',
  );
  const duaCount = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM duas');

  if (
    existingVersion?.value === contentSeedVersion &&
    quranCount?.count === quranSeedBundle.chapters.length &&
    duaCount?.count === duaSeedBundle.items.length
  ) {
    return;
  }

  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.execAsync(`
      DELETE FROM quran_bookmarks;
      DELETE FROM quran_reading_state;
      DELETE FROM quran_verses;
      DELETE FROM quran_chapters;
      DELETE FROM dua_favorites;
      DELETE FROM dua_counters;
      DELETE FROM duas;
      DELETE FROM dua_categories;
      DELETE FROM app_meta WHERE key = '${contentVersionMetaKey}';
    `);

    for (const chapter of quranSeedBundle.chapters) {
      await transaction.runAsync(
        `INSERT INTO quran_chapters (
          chapter_id,
          arabic_name,
          transliteration,
          translation,
          revelation_type,
          total_verses
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        chapter.id,
        chapter.arabicName,
        chapter.transliteration,
        chapter.translation,
        chapter.type,
        chapter.totalVerses,
      );

      for (const verse of chapter.verses) {
        await transaction.runAsync(
          `INSERT INTO quran_verses (
            chapter_id,
            verse_id,
            arabic_text,
            transliteration,
            translation,
            explanation
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          chapter.id,
          verse.id,
          verse.text,
          verse.transliteration,
          verse.translation,
          verse.explanation ?? null,
        );
      }
    }

    for (const category of duaSeedBundle.categories) {
      await transaction.runAsync(
        `INSERT INTO dua_categories (
          slug,
          title,
          sort_order,
          item_count
        ) VALUES (?, ?, ?, ?)`,
        category.slug,
        category.title,
        category.order,
        category.itemCount,
      );
    }

    for (let index = 0; index < duaSeedBundle.items.length; index += 1) {
      const item = duaSeedBundle.items[index];

      await transaction.runAsync(
        `INSERT INTO duas (
          id,
          category_slug,
          sort_order,
          original_section,
          arabic_text,
          transliteration,
          translation
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.categorySlug,
        index,
        item.originalSection,
        item.textArabic,
        item.transliteration,
        item.translation,
      );
    }

    await transaction.runAsync(
      'INSERT INTO app_meta (key, value) VALUES (?, ?)',
      contentVersionMetaKey,
      contentSeedVersion,
    );
  });
}

export async function ensureContentDatabase() {
  const database = await getDatabase();
  await migrateDatabase(database);
  await seedContentIfNeeded(database);
  return database;
}

export async function getQuranHomeSnapshot(): Promise<QuranHomeSnapshot> {
  const database = await ensureContentDatabase();
  const chapters = await database.getAllAsync<{
    arabicName: string;
    chapterId: number;
    totalVerses: number;
    translation: string;
    transliteration: string;
    type: string;
  }>(
    `SELECT
      chapter_id as chapterId,
      arabic_name as arabicName,
      transliteration,
      translation,
      revelation_type as type,
      total_verses as totalVerses
    FROM quran_chapters
    ORDER BY chapter_id`,
  );

  const lastReadRow = await database.getFirstAsync<{
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
  }>(
    `SELECT
      r.chapter_id as chapterId,
      r.verse_id as verseId,
      r.updated_at as updatedAt,
      c.arabic_name as chapterArabicName,
      c.transliteration as chapterTransliteration,
      c.translation as chapterTranslation,
      v.arabic_text as arabicText,
      v.transliteration as transliteration,
      v.translation as translation,
      v.explanation as explanation
    FROM quran_reading_state r
    JOIN quran_chapters c ON c.chapter_id = r.chapter_id
    JOIN quran_verses v ON v.chapter_id = r.chapter_id AND v.verse_id = r.verse_id
    WHERE r.id = 1`,
  );

  const bookmarkRows = await database.getAllAsync<{
    arabicText: string;
    chapterArabicName: string;
    chapterId: number;
    chapterTranslation: string;
    chapterTransliteration: string;
    createdAt: string;
    translation: string;
    transliteration: string;
    explanation?: string | null;
    updatedAt: string;
    verseId: number;
  }>(
    `SELECT
      b.chapter_id as chapterId,
      b.verse_id as verseId,
      b.created_at as createdAt,
      b.created_at as updatedAt,
      c.arabic_name as chapterArabicName,
      c.transliteration as chapterTransliteration,
      c.translation as chapterTranslation,
      v.arabic_text as arabicText,
      v.transliteration as transliteration,
      v.translation as translation,
      v.explanation as explanation
    FROM quran_bookmarks b
    JOIN quran_chapters c ON c.chapter_id = b.chapter_id
    JOIN quran_verses v ON v.chapter_id = b.chapter_id AND v.verse_id = b.verse_id
    ORDER BY b.created_at DESC
    LIMIT 6`,
  );

  return {
    bookmarks: bookmarkRows.map((row) => ({
      ...mapQuranSavedVerse(row),
      createdAt: row.createdAt,
    })),
    chapters: chapters.map(mapQuranChapterSummary),
    lastRead: lastReadRow ? mapQuranSavedVerse(lastReadRow) : null,
  };
}

export async function searchQuran(query: string): Promise<QuranSearchResult[]> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const database = await ensureContentDatabase();
  const likeQuery = escapeLikeQuery(trimmedQuery);
  const chapterRows = await database.getAllAsync<QuranSearchResult>(
    `SELECT
      chapter_id as chapterId,
      arabic_name as chapterArabicName,
      transliteration as chapterTransliteration,
      translation as chapterTranslation,
      NULL as verseId,
      NULL as arabicText,
      NULL as translationSnippet,
      'chapter' as matchType
    FROM quran_chapters
    WHERE lower(arabic_name) LIKE lower(?) ESCAPE '\\'
      OR lower(transliteration) LIKE lower(?) ESCAPE '\\'
      OR lower(translation) LIKE lower(?) ESCAPE '\\'
    ORDER BY chapter_id
    LIMIT 8`,
    likeQuery,
    likeQuery,
    likeQuery,
  );
  const verseRows = await database.getAllAsync<QuranSearchResult>(
    `SELECT
      v.chapter_id as chapterId,
      c.arabic_name as chapterArabicName,
      c.transliteration as chapterTransliteration,
      c.translation as chapterTranslation,
      v.verse_id as verseId,
      v.arabic_text as arabicText,
      substr(v.translation, 1, 220) as translationSnippet,
      'verse' as matchType
    FROM quran_verses v
    JOIN quran_chapters c ON c.chapter_id = v.chapter_id
    WHERE lower(v.arabic_text) LIKE lower(?) ESCAPE '\\'
      OR lower(v.transliteration) LIKE lower(?) ESCAPE '\\'
      OR lower(v.translation) LIKE lower(?) ESCAPE '\\'
    ORDER BY v.chapter_id, v.verse_id
    LIMIT 12`,
    likeQuery,
    likeQuery,
    likeQuery,
  );

  return [...chapterRows, ...verseRows];
}

export async function getQuranChapterDetail(chapterId: number): Promise<QuranChapterDetail | null> {
  const database = await ensureContentDatabase();
  const chapterRow = await database.getFirstAsync<{
    arabicName: string;
    chapterId: number;
    totalVerses: number;
    translation: string;
    transliteration: string;
    type: string;
  }>(
    `SELECT
      chapter_id as chapterId,
      arabic_name as arabicName,
      transliteration,
      translation,
      revelation_type as type,
      total_verses as totalVerses
    FROM quran_chapters
    WHERE chapter_id = ?`,
    chapterId,
  );

  if (!chapterRow) {
    return null;
  }

  const verseRows = await database.getAllAsync<{
    arabicText: string;
    chapterId: number;
    isBookmarked: number;
    isLastRead: number;
    translation: string;
    transliteration: string;
    explanation?: string | null;
    verseId: number;
  }>(
    `SELECT
      v.chapter_id as chapterId,
      v.verse_id as verseId,
      v.arabic_text as arabicText,
      v.transliteration as transliteration,
      v.translation as translation,
      v.explanation as explanation,
      CASE WHEN b.chapter_id IS NULL THEN 0 ELSE 1 END as isBookmarked,
      CASE WHEN r.chapter_id = v.chapter_id AND r.verse_id = v.verse_id THEN 1 ELSE 0 END as isLastRead
    FROM quran_verses v
    LEFT JOIN quran_bookmarks b ON b.chapter_id = v.chapter_id AND b.verse_id = v.verse_id
    LEFT JOIN quran_reading_state r ON r.id = 1
    WHERE v.chapter_id = ?
    ORDER BY v.verse_id`,
    chapterId,
  );

  return {
    ...mapQuranChapterSummary(chapterRow),
    verses: verseRows.map(
      (row): QuranVerse => ({
        arabicText: row.arabicText,
        chapterId: row.chapterId,
        isBookmarked: boolFromDatabase(row.isBookmarked),
        isLastRead: boolFromDatabase(row.isLastRead),
        translation: row.translation,
        transliteration: row.transliteration,
        explanation: row.explanation,
        verseId: row.verseId,
      }),
    ),
  };
}

export async function setQuranLastRead(chapterId: number, verseId: number) {
  const database = await ensureContentDatabase();
  const updatedAt = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO quran_reading_state (id, chapter_id, verse_id, updated_at)
     VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       chapter_id = excluded.chapter_id,
       verse_id = excluded.verse_id,
       updated_at = excluded.updated_at`,
    chapterId,
    verseId,
    updatedAt,
  );
}

export async function toggleQuranBookmark(chapterId: number, verseId: number) {
  const database = await ensureContentDatabase();
  const existing = await database.getFirstAsync<{ chapterId: number }>(
    `SELECT chapter_id as chapterId
     FROM quran_bookmarks
     WHERE chapter_id = ? AND verse_id = ?`,
    chapterId,
    verseId,
  );

  if (existing) {
    await database.runAsync(
      'DELETE FROM quran_bookmarks WHERE chapter_id = ? AND verse_id = ?',
      chapterId,
      verseId,
    );
    return false;
  }

  await database.runAsync(
    'INSERT INTO quran_bookmarks (chapter_id, verse_id, created_at) VALUES (?, ?, ?)',
    chapterId,
    verseId,
    new Date().toISOString(),
  );
  return true;
}

export async function getDuaHomeSnapshot(): Promise<DuaHomeSnapshot> {
  const database = await ensureContentDatabase();
  const categoryRows = await database.getAllAsync<{
    itemCount: number;
    slug: string;
    title: string;
  }>(
    `SELECT
      slug,
      title,
      item_count as itemCount
    FROM dua_categories
    ORDER BY sort_order`,
  );
  const favoriteRows = await database.getAllAsync<{
    arabicText: string;
    categorySlug: string;
    categoryTitle: string;
    id: string;
    isFavorite: number;
    personalCount: number;
    translation: string;
    transliteration: string;
  }>(
    `SELECT
      d.id as id,
      d.category_slug as categorySlug,
      c.title as categoryTitle,
      d.arabic_text as arabicText,
      d.transliteration as transliteration,
      d.translation as translation,
      1 as isFavorite,
      COALESCE(dc.current_count, 0) as personalCount
    FROM dua_favorites f
    JOIN duas d ON d.id = f.dua_id
    JOIN dua_categories c ON c.slug = d.category_slug
    LEFT JOIN dua_counters dc ON dc.dua_id = d.id
    ORDER BY f.created_at DESC
    LIMIT 6`,
  );

  return {
    categories: categoryRows.map(
      (row): DuaCategorySummary => ({
        itemCount: row.itemCount,
        slug: row.slug,
        title: row.title,
      }),
    ),
    favoriteDuas: favoriteRows.map(
      (row): DuaItem => ({
        arabicText: row.arabicText,
        categorySlug: row.categorySlug,
        categoryTitle: row.categoryTitle,
        id: row.id,
        isFavorite: boolFromDatabase(row.isFavorite),
        personalCount: row.personalCount,
        translation: row.translation,
        transliteration: row.transliteration,
      }),
    ),
  };
}

export async function getDuaCategoryDetail(categorySlug: string): Promise<DuaCategoryDetail | null> {
  const database = await ensureContentDatabase();
  const categoryRow = await database.getFirstAsync<{
    itemCount: number;
    slug: string;
    title: string;
  }>(
    `SELECT
      slug,
      title,
      item_count as itemCount
    FROM dua_categories
    WHERE slug = ?`,
    categorySlug,
  );

  if (!categoryRow) {
    return null;
  }

  const itemRows = await database.getAllAsync<{
    arabicText: string;
    categorySlug: string;
    categoryTitle: string;
    id: string;
    isFavorite: number;
    personalCount: number;
    translation: string;
    transliteration: string;
  }>(
    `SELECT
      d.id as id,
      d.category_slug as categorySlug,
      c.title as categoryTitle,
      d.arabic_text as arabicText,
      d.transliteration as transliteration,
      d.translation as translation,
      CASE WHEN f.dua_id IS NULL THEN 0 ELSE 1 END as isFavorite,
      COALESCE(dc.current_count, 0) as personalCount
    FROM duas d
    JOIN dua_categories c ON c.slug = d.category_slug
    LEFT JOIN dua_favorites f ON f.dua_id = d.id
    LEFT JOIN dua_counters dc ON dc.dua_id = d.id
    WHERE d.category_slug = ?
    ORDER BY d.sort_order`,
    categorySlug,
  );

  return {
    itemCount: categoryRow.itemCount,
    items: itemRows.map(
      (row): DuaItem => ({
        arabicText: row.arabicText,
        categorySlug: row.categorySlug,
        categoryTitle: row.categoryTitle,
        id: row.id,
        isFavorite: boolFromDatabase(row.isFavorite),
        personalCount: row.personalCount,
        translation: row.translation,
        transliteration: row.transliteration,
      }),
    ),
    slug: categoryRow.slug,
    title: categoryRow.title,
  };
}

export async function toggleDuaFavorite(duaId: string) {
  const database = await ensureContentDatabase();
  const existing = await database.getFirstAsync<{ duaId: string }>(
    'SELECT dua_id as duaId FROM dua_favorites WHERE dua_id = ?',
    duaId,
  );

  if (existing) {
    await database.runAsync('DELETE FROM dua_favorites WHERE dua_id = ?', duaId);
    return false;
  }

  await database.runAsync(
    'INSERT INTO dua_favorites (dua_id, created_at) VALUES (?, ?)',
    duaId,
    new Date().toISOString(),
  );
  return true;
}

export async function incrementDuaCounter(duaId: string) {
  const database = await ensureContentDatabase();
  const updatedAt = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO dua_counters (dua_id, current_count, updated_at)
     VALUES (?, 1, ?)
     ON CONFLICT(dua_id) DO UPDATE SET
       current_count = dua_counters.current_count + 1,
       updated_at = excluded.updated_at`,
    duaId,
    updatedAt,
  );
}

export async function resetDuaCounter(duaId: string) {
  const database = await ensureContentDatabase();
  const updatedAt = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO dua_counters (dua_id, current_count, updated_at)
     VALUES (?, 0, ?)
     ON CONFLICT(dua_id) DO UPDATE SET
       current_count = 0,
       updated_at = excluded.updated_at`,
    duaId,
    updatedAt,
  );
}
