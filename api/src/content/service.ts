import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type DashboardResponse,
  type DuaBookshelfResponse, // Custom for API if needed, or use DuaCollections
  type DuaCategoryDetail,
  type DuaCollectionsResponse,
  type DuaItem,
  type FeaturedQuranResponse,
  type HadithBook,
  type HadithChapter,
  type HadithItem,
  type OverviewResponse,
  type PrayerTopic,
  type PrayerTopicItem,
  type QuranChapterDetail,
  type QuranSeedBundle,
  type DuaSeedBundle,
  type HadithSeedBundle,
  type PrayerTopicsSeedBundle,
  type QuranVerse,
  type DuaCategorySummary,
} from '@prayer-app/core';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const seedDir = join(__dirname, '../../../web/src/content/seed');

export class ContentService {
  private async loadBundle<T>(filename: string): Promise<T> {
    const content = await readFile(join(seedDir, filename), 'utf8');
    return JSON.parse(content) as T;
  }

  async getOverview(): Promise<OverviewResponse> {
    return {
      overview: {
        name: 'Prayer App',
        tagline: 'Your spiritually connected companion',
        city: 'Kuala Lumpur',
        hijriDate: '10 Shawwal 1447',
        gregorianDate: 'Sunday, 19 April 2026',
        nextPrayer: 'Dhuhr',
        nextPrayerTime: '1:12 PM',
        focus: 'Surah Al-Kahf',
      },
      modules: [
        { title: 'Prayer Times', summary: 'Accurate times for your location', status: 'live shell' },
        { title: 'Quran', summary: 'Read and listen to the Holy Quran', status: 'live shell' },
        { title: 'Duas', summary: 'Supplications from the Sunnah', status: 'live shell' },
        { title: 'Hadith', summary: 'Prophetic traditions and tracks', status: 'live shell' },
      ],
      roadmap: [
        { phase: 'Phase 1', objective: 'Core Prayer Tracking' },
        { phase: 'Phase 2', objective: 'Content Integration' },
        { phase: 'Phase 3', objective: 'Community and Social' },
      ],
    };
  }

  async getFeaturedQuran(): Promise<FeaturedQuranResponse> {
    try {
      const data = await this.loadBundle<QuranSeedBundle>('quran.en.bundle.json');
      
      return {
        recitationMode: 'standard',
        surahs: data.chapters.slice(0, 10).map(c => ({
          arabicName: c.arabicName,
          ayahs: c.verses.length,
          id: c.id,
          translation: c.translation,
          transliteration: c.transliteration,
        })),
      };
    } catch (error) {
      console.error('[content-service] Failed to load Quran seed:', error);
      return { recitationMode: 'standard', surahs: [] };
    }
  }

  async getQuranChapter(chapterId: number): Promise<QuranChapterDetail | null> {
    try {
      const data = await this.loadBundle<QuranSeedBundle>('quran.en.bundle.json');
      const chapter = data.chapters.find(c => c.id === chapterId);
      
      if (!chapter) return null;

      return {
        arabicName: chapter.arabicName,
        chapterId: chapter.id,
        totalVerses: chapter.totalVerses,
        translation: chapter.translation,
        transliteration: chapter.transliteration,
        type: chapter.type,
        verses: chapter.verses.map((v): QuranVerse => ({
          arabicText: v.text,
          chapterId: chapter.id,
          explanation: v.explanation ?? null,
          isBookmarked: false,
          isLastRead: false,
          translation: v.translation,
          transliteration: v.transliteration,
          verseId: v.id,
        })),
      };
    } catch (error) {
      console.error('[content-service] Failed to load Quran chapter:', error);
      return null;
    }
  }

  async getDuaCollections(): Promise<DuaCollectionsResponse> {
    try {
      const data = await this.loadBundle<DuaSeedBundle>('duas.hisnul-muslim.bundle.json');

      return {
        collections: data.categories.map(c => ({
          title: c.title,
          count: c.itemCount,
          summary: `Collection of ${c.itemCount} supplications from Hisnul Muslim`,
        })),
      };
    } catch (error) {
      console.error('[content-service] Failed to load Dua seed:', error);
      return { collections: [] };
    }
  }

  async getDuaCategory(slug: string): Promise<DuaCategoryDetail | null> {
    try {
      const data = await this.loadBundle<DuaSeedBundle>('duas.hisnul-muslim.bundle.json');
      const category = data.categories.find(c => c.slug === slug);
      if (!category) return null;

      const items = data.items
        .filter(item => item.categorySlug === slug)
        .map((item): DuaItem => ({
          arabicText: item.textArabic,
          categorySlug: item.categorySlug,
          categoryTitle: category.title,
          id: item.id,
          isFavorite: false,
          personalCount: 0,
          translation: item.translation,
          transliteration: item.transliteration,
        }));

      return {
        itemCount: category.itemCount,
        items,
        slug: category.slug,
        title: category.title,
      };
    } catch (error) {
       console.error('[content-service] Failed to load Dua category:', error);
       return null;
    }
  }

  async getHadithBooks(): Promise<HadithBook[]> {
    try {
      const data = await this.loadBundle<HadithSeedBundle>('hadith.bundle.json');
      return data.books.sort((a, b) => a.id - b.id);
    } catch (error) {
      console.error('[content-service] Failed to load Hadith books:', error);
      return [];
    }
  }

  async getHadithBookDetail(slug: string): Promise<{ book: HadithBook; chapters: HadithChapter[] } | null> {
    try {
      const data = await this.loadBundle<HadithSeedBundle>('hadith.bundle.json');
      const book = data.books.find(b => b.slug === slug);
      if (!book) return null;

      const chapters = data.chapters
        .filter(c => c.bookSlug === slug)
        .sort((a, b) => a.id - b.id);

      return { book, chapters };
    } catch (error) {
      console.error('[content-service] Failed to load Hadith book detail:', error);
      return null;
    }
  }

  async getHadithChapter(bookSlug: string, chapterId: number): Promise<HadithItem[]> {
    try {
      const data = await this.loadBundle<HadithSeedBundle>('hadith.bundle.json');
      return data.entries
        .filter(e => e.bookSlug === bookSlug && e.chapterId === chapterId)
        .map(e => ({ ...e, isBookmarked: false }));
    } catch (error) {
      console.error('[content-service] Failed to load Hadith chapter:', error);
      return [];
    }
  }

  async getPrayerTopics(): Promise<{ topics: PrayerTopic[]; items: PrayerTopicItem[] }> {
    try {
      const data = await this.loadBundle<PrayerTopicsSeedBundle>('prayer-topics.bundle.json');
      return {
        topics: data.topics.sort((a, b) => a.title.localeCompare(b.title)),
        items: data.items,
      };
    } catch (error) {
      console.error('[content-service] Failed to load Prayer Topics:', error);
      return { topics: [], items: [] };
    }
  }

  async getDashboard(): Promise<DashboardResponse> {
    const overview = await this.getOverview();
    return {
      overview: overview.overview,
      prayers: [], 
      metrics: [
        { label: 'Prayer Streak', value: '12 Days', trend: '+2' },
        { label: 'Quran Progress', value: '15%', trend: '+1%' },
      ],
      integrations: [
        { title: 'Google Drive', status: 'ready', detail: 'Backups active' },
        { title: 'Google Calendar', status: 'ready', detail: 'Sync configured' },
      ],
    };
  }
}
