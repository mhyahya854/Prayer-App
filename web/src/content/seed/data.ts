import type {
  DuaSeedBundle,
  HadithSeedBundle,
  PrayerTopicsSeedBundle,
  QuranSeedBundle,
} from '@/src/content/types';

export function getQuranSeedBundle(): QuranSeedBundle {
  return require('./quran.en.bundle.json');
}

export function getDuaSeedBundle(): DuaSeedBundle {
  return require('./duas.hisnul-muslim.bundle.json');
}

export function getHadithSeedBundle(): HadithSeedBundle {
  return require('./hadith.bundle.json');
}

export function getPrayerTopicsSeedBundle(): PrayerTopicsSeedBundle {
  return require('./prayer-topics.bundle.json');
}

export function getContentSeedVersion() {
  const q = getQuranSeedBundle();
  const d = getDuaSeedBundle();
  const h = getHadithSeedBundle();
  const p = getPrayerTopicsSeedBundle();
  
  return `${q.source.name}@${q.source.version}|${d.source.name}@${d.source.version}|${h.source.name}@${h.source.version}|${p.source.name}@${p.source.version}`;
}
