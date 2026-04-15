import type {
  DuaSeedBundle,
  HadithSeedBundle,
  PrayerTopicsSeedBundle,
  QuranSeedBundle,
} from '@/src/content/types';

export const quranSeedBundle = require('./quran.en.bundle.json') as QuranSeedBundle;
export const duaSeedBundle = require('./duas.hisnul-muslim.bundle.json') as DuaSeedBundle;
export const hadithSeedBundle = require('./hadith.bundle.json') as HadithSeedBundle;
export const prayerTopicsSeedBundle = require('./prayer-topics.bundle.json') as PrayerTopicsSeedBundle;

export const contentSeedVersion =
  `${quranSeedBundle.source.name}@${quranSeedBundle.source.version}` +
  `|${duaSeedBundle.source.name}@${duaSeedBundle.source.version}` +
  `|${hadithSeedBundle.source.name}@${hadithSeedBundle.source.version}` +
  `|${prayerTopicsSeedBundle.source.name}@${prayerTopicsSeedBundle.source.version}`;
