import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import {
  contentSeedVersion,
  duaSeedBundle,
  hadithSeedBundle,
  prayerTopicsSeedBundle,
  quranSeedBundle,
} from '@/src/content/seed/data';
import type {
  DuaCategoryDetail,
  DuaCategorySummary,
  DuaHomeSnapshot,
  DuaItem,
  HadithBook,
  HadithChapter,
  HadithHomeSnapshot,
  HadithItem,
  PrayerTopic,
  PrayerTopicItem,
  QuranBookmark,
  QuranChapterDetail,
  QuranChapterSummary,
  QuranHomeSnapshot,
  QuranSavedVerse,
  QuranSearchResult,
  QuranVerse,
} from '@/src/content/types';

const databaseName = 'prayer-app.db';
const contentVersionMetaKey = 'content_seed_version';

let databasePromise: Promise<SQLiteDatabase> | null = null;

function escapeLikeQuery(value: string) {
  return `%${value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
}

function boolFromDatabase(value: number | null | undefined) {
  return value === 1;
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
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
    updatedAt: row.updatedAt,
    verseId: row.verseId,
  };
}

function mapHadithItem(row: {
  benefitsArabic: string;
  benefitsJson: string;
  bookHadithNumber: number;
  bookId: number;
  bookSlug: string;
  chapterId: number;
  chapterTitleArabic: string;
  chapterTitleEnglish: string;
  explanation: string;
  explanationArabic: string;
  globalHadithId: number;
  grade: string;
  gradeArabic: string;
  hadeethEncId: string | null;
  id: string;
  isBookmarked?: number;
  isGradeVerified: number;
  narratorEnglish: string;
  sourceLink: string;
  takhrij: string;
  takhrijArabic: string;
  textArabic: string;
  textEnglish: string;
  wordMeaningsArabicJson: string;
}): HadithItem {
  return {
    benefits: parseStringArray(row.benefitsJson),
    benefitsArabic: parseStringArray(row.benefitsArabic),
    bookHadithNumber: row.bookHadithNumber,
    bookId: row.bookId,
    bookSlug: row.bookSlug,
    chapterId: row.chapterId,
    chapterTitleArabic: row.chapterTitleArabic,
    chapterTitleEnglish: row.chapterTitleEnglish,
    explanation: row.explanation,
    explanationArabic: row.explanationArabic,
    globalHadithId: row.globalHadithId,
    grade: row.grade,
    gradeArabic: row.gradeArabic,
    hadeethEncId: row.hadeethEncId,
    id: row.id,
    isBookmarked: boolFromDatabase(row.isBookmarked),
    isGradeVerified: boolFromDatabase(row.isGradeVerified),
    narratorEnglish: row.narratorEnglish,
    sourceLink: row.sourceLink,
    takhrij: row.takhrij,
    takhrijArabic: row.takhrijArabic,
    textArabic: row.textArabic,
    textEnglish: row.textEnglish,
    wordMeaningsArabic: parseStringArray(row.wordMeaningsArabicJson),
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

    CREATE TABLE IF NOT EXISTS hadith_books (
      id INTEGER PRIMARY KEY NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      title_arabic TEXT NOT NULL,
      title_english TEXT NOT NULL,
      author_arabic TEXT NOT NULL,
      author_english TEXT NOT NULL,
      hadith_count INTEGER NOT NULL,
      is_ship_now INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS hadith_chapters (
      id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      book_slug TEXT NOT NULL,
      title_arabic TEXT NOT NULL,
      title_english TEXT NOT NULL,
      PRIMARY KEY (book_slug, id),
      FOREIGN KEY (book_id) REFERENCES hadith_books(id) ON DELETE CASCADE,
      FOREIGN KEY (book_slug) REFERENCES hadith_books(slug) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS hadith_entries (
      id TEXT PRIMARY KEY NOT NULL,
      book_id INTEGER NOT NULL,
      book_slug TEXT NOT NULL,
      book_hadith_number INTEGER NOT NULL,
      global_hadith_id INTEGER NOT NULL,
      chapter_id INTEGER NOT NULL,
      chapter_title_arabic TEXT NOT NULL,
      chapter_title_english TEXT NOT NULL,
      narrator_english TEXT NOT NULL,
      text_arabic TEXT NOT NULL,
      text_english TEXT NOT NULL,
      explanation TEXT NOT NULL,
      explanation_arabic TEXT NOT NULL,
      benefits_json TEXT NOT NULL,
      benefits_arabic_json TEXT NOT NULL,
      word_meanings_arabic_json TEXT NOT NULL,
      grade TEXT NOT NULL,
      grade_arabic TEXT NOT NULL,
      takhrij TEXT NOT NULL,
      takhrij_arabic TEXT NOT NULL,
      source_link TEXT NOT NULL,
      hadeethenc_id TEXT,
      is_grade_verified INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (book_id) REFERENCES hadith_books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS hadith_bookmarks (
      hadith_id TEXT PRIMARY KEY NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (hadith_id) REFERENCES hadith_entries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS prayer_topics (
      slug TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      item_count INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prayer_topic_items (
      topic_slug TEXT NOT NULL,
      hadith_id TEXT NOT NULL,
      book_slug TEXT NOT NULL,
      chapter_id INTEGER NOT NULL,
      grade TEXT NOT NULL,
      is_grade_verified INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (topic_slug, hadith_id),
      FOREIGN KEY (topic_slug) REFERENCES prayer_topics(slug) ON DELETE CASCADE,
      FOREIGN KEY (hadith_id) REFERENCES hadith_entries(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_quran_bookmarks_created_at ON quran_bookmarks(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_dua_favorites_created_at ON dua_favorites(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_duas_category_slug ON duas(category_slug, sort_order);
    CREATE INDEX IF NOT EXISTS idx_hadith_entries_book_slug ON hadith_entries(book_slug, chapter_id, book_hadith_number);
    CREATE INDEX IF NOT EXISTS idx_hadith_entries_text ON hadith_entries(text_english, text_arabic, narrator_english);
    CREATE INDEX IF NOT EXISTS idx_hadith_bookmarks_created_at ON hadith_bookmarks(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_prayer_topic_items_topic_slug ON prayer_topic_items(topic_slug);
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
  const hadithCount = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM hadith_entries',
  );
  const prayerTopicCount = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM prayer_topic_items',
  );

  if (
    existingVersion?.value === contentSeedVersion &&
    quranCount?.count === quranSeedBundle.chapters.length &&
    duaCount?.count === duaSeedBundle.items.length &&
    hadithCount?.count === hadithSeedBundle.entries.length &&
    prayerTopicCount?.count === prayerTopicsSeedBundle.items.length
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
      DELETE FROM hadith_bookmarks;
      DELETE FROM prayer_topic_items;
      DELETE FROM prayer_topics;
      DELETE FROM hadith_entries;
      DELETE FROM hadith_chapters;
      DELETE FROM hadith_books;
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
            translation
          ) VALUES (?, ?, ?, ?, ?)`,
          chapter.id,
          verse.id,
          verse.text,
          verse.transliteration,
          verse.translation,
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

    for (const book of hadithSeedBundle.books) {
      await transaction.runAsync(
        `INSERT INTO hadith_books (
          id, slug, title_arabic, title_english, author_arabic, author_english, hadith_count, is_ship_now
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        book.id,
        book.slug,
        book.titleArabic,
        book.titleEnglish,
        book.authorArabic,
        book.authorEnglish,
        book.hadithCount,
        book.isShipNow ? 1 : 0,
      );
    }

    for (const chapter of hadithSeedBundle.chapters) {
      await transaction.runAsync(
        `INSERT INTO hadith_chapters (id, book_id, book_slug, title_arabic, title_english)
         VALUES (?, ?, ?, ?, ?)`,
        chapter.id,
        chapter.bookId,
        chapter.bookSlug,
        chapter.titleArabic,
        chapter.titleEnglish,
      );
    }

    for (const entry of hadithSeedBundle.entries) {
      await transaction.runAsync(
        `INSERT INTO hadith_entries (
          id, book_id, book_slug, book_hadith_number, global_hadith_id, chapter_id,
          chapter_title_arabic, chapter_title_english, narrator_english, text_arabic, text_english,
          explanation, explanation_arabic, benefits_json, benefits_arabic_json, word_meanings_arabic_json,
          grade, grade_arabic, takhrij, takhrij_arabic, source_link, hadeethenc_id, is_grade_verified
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        entry.id,
        entry.bookId,
        entry.bookSlug,
        entry.bookHadithNumber,
        entry.globalHadithId,
        entry.chapterId,
        entry.chapterTitleArabic,
        entry.chapterTitleEnglish,
        entry.narratorEnglish,
        entry.textArabic,
        entry.textEnglish,
        entry.explanation,
        entry.explanationArabic,
        JSON.stringify(entry.benefits),
        JSON.stringify(entry.benefitsArabic),
        JSON.stringify(entry.wordMeaningsArabic),
        entry.grade,
        entry.gradeArabic,
        entry.takhrij,
        entry.takhrijArabic,
        entry.sourceLink,
        entry.hadeethEncId,
        entry.isGradeVerified ? 1 : 0,
      );
    }

    for (const topic of prayerTopicsSeedBundle.topics) {
      await transaction.runAsync(
        `INSERT INTO prayer_topics (slug, title, description, item_count)
         VALUES (?, ?, ?, ?)`,
        topic.slug,
        topic.title,
        topic.description,
        topic.itemCount,
      );
    }

    for (const item of prayerTopicsSeedBundle.items) {
      await transaction.runAsync(
        `INSERT INTO prayer_topic_items (
          topic_slug, hadith_id, book_slug, chapter_id, grade, is_grade_verified
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        item.topicSlug,
        item.hadithId,
        item.bookSlug,
        item.chapterId,
        item.grade,
        item.isGradeVerified ? 1 : 0,
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
      v.translation as translation
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
      v.translation as translation
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
    verseId: number;
  }>(
    `SELECT
      v.chapter_id as chapterId,
      v.verse_id as verseId,
      v.arabic_text as arabicText,
      v.transliteration as transliteration,
      v.translation as translation,
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

export async function getHadithHomeSnapshot(): Promise<HadithHomeSnapshot> {
  const database = await ensureContentDatabase();
  const books = await database.getAllAsync<{
    authorArabic: string;
    authorEnglish: string;
    hadithCount: number;
    id: number;
    isShipNow: number;
    slug: string;
    titleArabic: string;
    titleEnglish: string;
  }>(
    `SELECT
      id,
      slug,
      title_arabic as titleArabic,
      title_english as titleEnglish,
      author_arabic as authorArabic,
      author_english as authorEnglish,
      hadith_count as hadithCount,
      is_ship_now as isShipNow
    FROM hadith_books
    ORDER BY id`,
  );
  const bookmarkRows = await database.getAllAsync<any>(
    `SELECT
      e.id as id,
      e.book_id as bookId,
      e.book_slug as bookSlug,
      e.book_hadith_number as bookHadithNumber,
      e.global_hadith_id as globalHadithId,
      e.chapter_id as chapterId,
      e.chapter_title_arabic as chapterTitleArabic,
      e.chapter_title_english as chapterTitleEnglish,
      e.narrator_english as narratorEnglish,
      e.text_arabic as textArabic,
      e.text_english as textEnglish,
      e.explanation as explanation,
      e.explanation_arabic as explanationArabic,
      e.benefits_json as benefitsJson,
      e.benefits_arabic_json as benefitsArabic,
      e.word_meanings_arabic_json as wordMeaningsArabicJson,
      e.grade as grade,
      e.grade_arabic as gradeArabic,
      e.takhrij as takhrij,
      e.takhrij_arabic as takhrijArabic,
      e.source_link as sourceLink,
      e.hadeethenc_id as hadeethEncId,
      e.is_grade_verified as isGradeVerified,
      1 as isBookmarked
    FROM hadith_bookmarks b
    JOIN hadith_entries e ON e.id = b.hadith_id
    ORDER BY b.created_at DESC
    LIMIT 20`,
  );
  return {
    books: books.map(
      (book): HadithBook => ({
        authorArabic: book.authorArabic,
        authorEnglish: book.authorEnglish,
        hadithCount: book.hadithCount,
        id: book.id,
        isShipNow: boolFromDatabase(book.isShipNow),
        slug: book.slug,
        titleArabic: book.titleArabic,
        titleEnglish: book.titleEnglish,
      }),
    ),
    bookmarkedItems: bookmarkRows.map(mapHadithItem),
  };
}

export async function getHadithBookDetail(bookSlug: string): Promise<{ book: HadithBook; chapters: HadithChapter[] } | null> {
  const database = await ensureContentDatabase();
  const book = await database.getFirstAsync<{
    authorArabic: string;
    authorEnglish: string;
    hadithCount: number;
    id: number;
    isShipNow: number;
    slug: string;
    titleArabic: string;
    titleEnglish: string;
  }>(
    `SELECT
      id, slug, title_arabic as titleArabic, title_english as titleEnglish,
      author_arabic as authorArabic, author_english as authorEnglish,
      hadith_count as hadithCount, is_ship_now as isShipNow
    FROM hadith_books
    WHERE slug = ?`,
    bookSlug,
  );
  if (!book) {
    return null;
  }
  const chapters = await database.getAllAsync<HadithChapter>(
    `SELECT id, book_id as bookId, book_slug as bookSlug, title_arabic as titleArabic, title_english as titleEnglish
     FROM hadith_chapters
     WHERE book_slug = ?
     ORDER BY id`,
    bookSlug,
  );
  return {
    book: {
      authorArabic: book.authorArabic,
      authorEnglish: book.authorEnglish,
      hadithCount: book.hadithCount,
      id: book.id,
      isShipNow: boolFromDatabase(book.isShipNow),
      slug: book.slug,
      titleArabic: book.titleArabic,
      titleEnglish: book.titleEnglish,
    },
    chapters,
  };
}

export async function getHadithChapterDetail(bookSlug: string, chapterId: number): Promise<HadithItem[]> {
  const database = await ensureContentDatabase();
  const rows = await database.getAllAsync<any>(
    `SELECT
      e.id as id, e.book_id as bookId, e.book_slug as bookSlug, e.book_hadith_number as bookHadithNumber,
      e.global_hadith_id as globalHadithId, e.chapter_id as chapterId, e.chapter_title_arabic as chapterTitleArabic,
      e.chapter_title_english as chapterTitleEnglish, e.narrator_english as narratorEnglish, e.text_arabic as textArabic,
      e.text_english as textEnglish, e.explanation as explanation, e.explanation_arabic as explanationArabic,
      e.benefits_json as benefitsJson, e.benefits_arabic_json as benefitsArabic,
      e.word_meanings_arabic_json as wordMeaningsArabicJson, e.grade as grade, e.grade_arabic as gradeArabic,
      e.takhrij as takhrij, e.takhrij_arabic as takhrijArabic, e.source_link as sourceLink,
      e.hadeethenc_id as hadeethEncId, e.is_grade_verified as isGradeVerified,
      CASE WHEN b.hadith_id IS NULL THEN 0 ELSE 1 END as isBookmarked
    FROM hadith_entries e
    LEFT JOIN hadith_bookmarks b ON b.hadith_id = e.id
    WHERE e.book_slug = ? AND e.chapter_id = ?
    ORDER BY e.book_hadith_number`,
    bookSlug,
    chapterId,
  );
  return rows.map(mapHadithItem);
}

export async function searchHadith(query: string): Promise<HadithItem[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }
  const database = await ensureContentDatabase();
  const likeQuery = escapeLikeQuery(trimmedQuery);
  const rows = await database.getAllAsync<any>(
    `SELECT
      e.id as id, e.book_id as bookId, e.book_slug as bookSlug, e.book_hadith_number as bookHadithNumber,
      e.global_hadith_id as globalHadithId, e.chapter_id as chapterId, e.chapter_title_arabic as chapterTitleArabic,
      e.chapter_title_english as chapterTitleEnglish, e.narrator_english as narratorEnglish, e.text_arabic as textArabic,
      e.text_english as textEnglish, e.explanation as explanation, e.explanation_arabic as explanationArabic,
      e.benefits_json as benefitsJson, e.benefits_arabic_json as benefitsArabic,
      e.word_meanings_arabic_json as wordMeaningsArabicJson, e.grade as grade, e.grade_arabic as gradeArabic,
      e.takhrij as takhrij, e.takhrij_arabic as takhrijArabic, e.source_link as sourceLink,
      e.hadeethenc_id as hadeethEncId, e.is_grade_verified as isGradeVerified,
      CASE WHEN b.hadith_id IS NULL THEN 0 ELSE 1 END as isBookmarked
    FROM hadith_entries e
    LEFT JOIN hadith_bookmarks b ON b.hadith_id = e.id
    WHERE lower(e.text_english) LIKE lower(?) ESCAPE '\\'
      OR lower(e.text_arabic) LIKE lower(?) ESCAPE '\\'
      OR lower(e.narrator_english) LIKE lower(?) ESCAPE '\\'
      OR lower(e.chapter_title_english) LIKE lower(?) ESCAPE '\\'
    ORDER BY e.book_slug, e.book_hadith_number
    LIMIT 40`,
    likeQuery,
    likeQuery,
    likeQuery,
    likeQuery,
  );
  return rows.map(mapHadithItem);
}

export async function toggleHadithBookmark(id: string) {
  const database = await ensureContentDatabase();
  const existing = await database.getFirstAsync<{ hadithId: string }>(
    'SELECT hadith_id as hadithId FROM hadith_bookmarks WHERE hadith_id = ?',
    id,
  );
  if (existing) {
    await database.runAsync('DELETE FROM hadith_bookmarks WHERE hadith_id = ?', id);
    return false;
  }
  await database.runAsync(
    'INSERT INTO hadith_bookmarks (hadith_id, created_at) VALUES (?, ?)',
    id,
    new Date().toISOString(),
  );
  return true;
}

export async function getPrayerTopics(): Promise<{ topics: PrayerTopic[]; items: PrayerTopicItem[] }> {
  const database = await ensureContentDatabase();
  const topics = await database.getAllAsync<PrayerTopic>(
    'SELECT slug, title, description, item_count as itemCount FROM prayer_topics ORDER BY title',
  );
  const items = await database.getAllAsync<PrayerTopicItem>(
    `SELECT
      topic_slug as topicSlug,
      hadith_id as hadithId,
      book_slug as bookSlug,
      chapter_id as chapterId,
      grade,
      is_grade_verified as isGradeVerified
    FROM prayer_topic_items`,
  );
  return {
    topics,
    items: items.map((item) => ({ ...item, isGradeVerified: boolFromDatabase(item.isGradeVerified as unknown as number) })),
  };
}

export async function getHadithByIds(ids: string[]): Promise<HadithItem[]> {
  if (!ids.length) {
    return [];
  }
  const database = await ensureContentDatabase();
  const placeholders = ids.map(() => '?').join(', ');
  const rows = await database.getAllAsync<any>(
    `SELECT
      e.id as id, e.book_id as bookId, e.book_slug as bookSlug, e.book_hadith_number as bookHadithNumber,
      e.global_hadith_id as globalHadithId, e.chapter_id as chapterId, e.chapter_title_arabic as chapterTitleArabic,
      e.chapter_title_english as chapterTitleEnglish, e.narrator_english as narratorEnglish, e.text_arabic as textArabic,
      e.text_english as textEnglish, e.explanation as explanation, e.explanation_arabic as explanationArabic,
      e.benefits_json as benefitsJson, e.benefits_arabic_json as benefitsArabic,
      e.word_meanings_arabic_json as wordMeaningsArabicJson, e.grade as grade, e.grade_arabic as gradeArabic,
      e.takhrij as takhrij, e.takhrij_arabic as takhrijArabic, e.source_link as sourceLink,
      e.hadeethenc_id as hadeethEncId, e.is_grade_verified as isGradeVerified,
      CASE WHEN b.hadith_id IS NULL THEN 0 ELSE 1 END as isBookmarked
    FROM hadith_entries e
    LEFT JOIN hadith_bookmarks b ON b.hadith_id = e.id
    WHERE e.id IN (${placeholders})`,
    ...ids,
  );
  return rows.map(mapHadithItem);
}
