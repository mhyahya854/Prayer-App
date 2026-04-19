import AsyncStorage from '@react-native-async-storage/async-storage';
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getHadithByIds,
  getHadithHomeSnapshot,
  getPrayerTopics,
  resetContentStateForTests,
  searchHadith,
  toggleHadithBookmark,
} from './database.web';
import { getHadithSeedBundle, getPrayerTopicsSeedBundle } from './seed/data';

const hadithSeedBundle = getHadithSeedBundle();
const prayerTopicsSeedBundle = getPrayerTopicsSeedBundle();

class MemoryStorage {
  private storage = new Map<string, string>();

  get length() {
    return this.storage.size;
  }

  clear() {
    this.storage.clear();
  }

  getItem(key: string) {
    return this.storage.get(key) ?? null;
  }

  key(index: number) {
    return [...this.storage.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.storage.delete(key);
  }

  setItem(key: string, value: string) {
    this.storage.set(key, value);
  }
}

if (!('window' in globalThis)) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: new MemoryStorage(),
    },
  });
}

test.beforeEach(async () => {
  await AsyncStorage.clear();
  resetContentStateForTests();
});

test.after(() => {
  resetContentStateForTests();
});

test('hadith home snapshot returns books and bookmarked items', async () => {
  const snapshot = await getHadithHomeSnapshot();
  const expectedBooks = [...hadithSeedBundle.books].sort((left, right) => left.id - right.id);

  assert.equal(snapshot.books.length, expectedBooks.length);
  assert.equal(snapshot.books[0]?.slug, expectedBooks[0]?.slug);
  assert.deepEqual(snapshot.bookmarkedItems, []);
});

test('hadith bookmark toggles persist across hydration', async () => {
  const firstEntry = hadithSeedBundle.entries[0];

  assert.ok(firstEntry, 'expected at least one hadith entry in seed data');

  const firstToggle = await toggleHadithBookmark(firstEntry.id);
  assert.equal(firstToggle, true);

  let snapshot = await getHadithHomeSnapshot();
  assert.equal(snapshot.bookmarkedItems[0]?.id, firstEntry.id);

  resetContentStateForTests();

  snapshot = await getHadithHomeSnapshot();
  assert.equal(snapshot.bookmarkedItems[0]?.id, firstEntry.id);

  const secondToggle = await toggleHadithBookmark(firstEntry.id);
  assert.equal(secondToggle, false);

  snapshot = await getHadithHomeSnapshot();
  assert.deepEqual(snapshot.bookmarkedItems, []);
});

test('hadith search matches the supported fields and respects empty queries', async () => {
  const searchableEntry = hadithSeedBundle.entries.find(
    (item) => item.textEnglish && item.textArabic && item.narratorEnglish && item.chapterTitleEnglish,
  );

  assert.ok(searchableEntry, 'expected seed entry with populated search fields');

  const englishQuery = searchableEntry.textEnglish.replace(/\s+/g, ' ').slice(0, 32).trim();
  const englishResults = await searchHadith(englishQuery);
  assert.ok(englishResults.some((item) => item.id === searchableEntry.id));

  const arabicQuery = searchableEntry.textArabic.replace(/\s+/g, ' ').slice(0, 16).trim();
  const arabicResults = await searchHadith(arabicQuery);
  assert.ok(arabicResults.some((item) => item.id === searchableEntry.id));

  const narratorResults = await searchHadith(searchableEntry.narratorEnglish.trim());
  assert.ok(narratorResults.some((item) => item.id === searchableEntry.id));

  const chapterQuery = searchableEntry.chapterTitleEnglish.replace(/\s+/g, ' ').slice(0, 24).trim();
  const chapterResults = await searchHadith(chapterQuery);
  assert.ok(chapterResults.some((item) => item.id === searchableEntry.id));

  assert.deepEqual(await searchHadith('   '), []);
});

test('prayer topics return the seeded topics and mappings', async () => {
  const result = await getPrayerTopics();
  const expectedTopics = [...prayerTopicsSeedBundle.topics].sort((left, right) => left.title.localeCompare(right.title));

  assert.equal(result.topics.length, prayerTopicsSeedBundle.topics.length);
  assert.equal(result.items.length, prayerTopicsSeedBundle.items.length);
  assert.deepEqual(
    result.topics.map((topic) => topic.slug),
    expectedTopics.map((topic) => topic.slug),
  );
});

test('getHadithByIds returns the expected entries for prayer-study detail', async () => {
  const selectedIds = [...new Set(prayerTopicsSeedBundle.items.slice(0, 3).map((item) => item.hadithId))];

  assert.ok(selectedIds.length > 0, 'expected prayer topic seed items');

  const results = await getHadithByIds(selectedIds);

  assert.deepEqual(
    results.map((item) => item.id),
    selectedIds,
  );
});
