import type { DuaSeedBundle, QuranSeedBundle } from '@/src/content/types';

export const quranSeedBundle = require('./quran.en.bundle.json') as QuranSeedBundle;
export const duaSeedBundle = require('./duas.hisnul-muslim.bundle.json') as DuaSeedBundle;

export const contentSeedVersion = `${quranSeedBundle.source.name}@${quranSeedBundle.source.version}|${duaSeedBundle.source.name}@${duaSeedBundle.source.version}`;
