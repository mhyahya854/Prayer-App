import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { getData as getHisnulData, getMeta as getHisnulMeta } from '@kazishariar/hisnul-muslim-data';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const quranEnglish = require('quran-json/dist/quran_en.json');
const quranTransliteration = require('quran-json/dist/quran_transliteration.json');

const quranPackageJson = JSON.parse(
  await readFile(path.join(__dirname, '..', 'node_modules', 'quran-json', 'package.json'), 'utf8'),
);
const hisnulPackageJson = JSON.parse(
  await readFile(
    path.join(__dirname, '..', 'node_modules', '@kazishariar', 'hisnul-muslim-data', 'package.json'),
    'utf8',
  ),
);

const outputDirectory = path.join(__dirname, '..', 'apps', 'mobile', 'src', 'content', 'seed');

const quranSeed = {
  source: {
    collection: 'Quran (Arabic, English translation, transliteration)',
    license: quranPackageJson.license,
    name: quranPackageJson.name,
    translation: 'English (Saheeh International)',
    version: quranPackageJson.version,
  },
  chapters: quranEnglish.map((chapter, chapterIndex) => {
    const transliterationChapter = quranTransliteration[chapterIndex];

    return {
      arabicName: chapter.name,
      id: chapter.id,
      totalVerses: chapter.total_verses,
      translation: chapter.translation,
      transliteration: chapter.transliteration,
      type: chapter.type,
      verses: chapter.verses.map((verse, verseIndex) => ({
        id: verse.id,
        text: verse.text,
        translation: verse.translation,
        transliteration: transliterationChapter.verses[verseIndex]?.transliteration ?? '',
      })),
    };
  }),
};

const rawHisnulItems = getHisnulData().filter(
  (entry) => typeof entry.section === 'string' && !entry.section.includes('المقدمة'),
);

const sectionSlugMap = new Map();
const duaCategories = [];

for (const entry of rawHisnulItems) {
  if (!sectionSlugMap.has(entry.section)) {
    const sectionIndex = sectionSlugMap.size + 1;
    const slug = `hisnul-${String(sectionIndex).padStart(3, '0')}`;

    sectionSlugMap.set(entry.section, slug);
    duaCategories.push({
      itemCount: 0,
      order: sectionIndex,
      slug,
      title: entry.section,
    });
  }
}

const duaCategoryBySlug = new Map(duaCategories.map((category) => [category.slug, category]));

const duaSeedItems = rawHisnulItems.map((entry) => {
  const categorySlug = sectionSlugMap.get(entry.section);

  if (!categorySlug) {
    throw new Error(`Missing category slug for section "${entry.section}".`);
  }

  const category = duaCategoryBySlug.get(categorySlug);

  if (!category) {
    throw new Error(`Missing category record for slug "${categorySlug}".`);
  }

  category.itemCount += 1;

  return {
    categorySlug,
    id: entry.id,
    originalSection: entry.section,
    textArabic: entry.arabic,
    translation: entry.english ?? '',
    transliteration: entry.transliteration ?? '',
  };
});

const duaSeed = {
  categories: duaCategories,
  items: duaSeedItems,
  source: {
    collection: getHisnulMeta().title ?? 'Hisnul Muslim',
    itemCount: duaSeedItems.length,
    license: hisnulPackageJson.license,
    name: hisnulPackageJson.name,
    version: hisnulPackageJson.version,
  },
};

await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, 'quran.en.bundle.json'), JSON.stringify(quranSeed));
await writeFile(path.join(outputDirectory, 'duas.hisnul-muslim.bundle.json'), JSON.stringify(duaSeed));

console.log(
  `Generated ${quranSeed.chapters.length} Quran chapters and ${duaSeed.items.length} duas into ${outputDirectory}.`,
);
