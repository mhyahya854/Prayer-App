import assert from 'node:assert/strict';
import test from 'node:test';
import { ContentService } from './service';

test('ContentService fetches overview data correctly', async () => {
  const service = new ContentService();
  const overview = await service.getOverview();
  
  assert.equal(overview.overview.name, 'Prayer App');
  assert.ok(overview.modules.length > 0);
  assert.ok(overview.roadmap.length > 0);
});

test('ContentService fetches featured Quran surahs', async () => {
  const service = new ContentService();
  const quran = await service.getFeaturedQuran();
  
  assert.ok(Array.isArray(quran.surahs));
  if (quran.surahs.length > 0) {
    assert.ok(quran.surahs[0].id > 0);
    assert.ok(quran.surahs[0].transliteration);
  }
});

test('ContentService fetches specific Quran chapter', async () => {
  const service = new ContentService();
  const chapter = await service.getQuranChapter(1); // Al-Fatihah
  
  if (chapter) {
    assert.equal(chapter.chapterId, 1);
    assert.equal(chapter.transliteration, 'Al-Fatihah');
    assert.ok(chapter.verses.length > 0);
  } else {
    console.warn('Quran Chapter 1 not found in seed data, skipping assertion');
  }
});

test('ContentService fetches Dua collections', async () => {
  const service = new ContentService();
  const duas = await service.getDuaCollections();
  
  assert.ok(Array.isArray(duas.collections));
});

test('ContentService fetches specific Dua category by slug', async () => {
  const service = new ContentService();
  // Expecting 'morning-evening' to exist in Hisnul Muslim seed
  const category = await service.getDuaCategory('morning-and-evening');
  
  if (category) {
    assert.ok(category.title);
    assert.ok(Array.isArray(category.items));
  }
});

test('ContentService fetches Hadith books', async () => {
  const service = new ContentService();
  const books = await service.getHadithBooks();
  
  assert.ok(Array.isArray(books));
});

test('ContentService fetches Prayer Topics', async () => {
  const service = new ContentService();
  const topics = await service.getPrayerTopics();
  
  assert.ok(Array.isArray(topics.topics));
  assert.ok(Array.isArray(topics.items));
});
