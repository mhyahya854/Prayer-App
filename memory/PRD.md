# Prayer App - Product Requirements Document

## Original Problem Statement
Redesign the homepage layout of the Islamic prayer app to match a reference image. Keep all existing features but change only the layout arrangement. Do not change the theme colors.

## Architecture
- **Platform**: Expo React Native (Web + iOS + Android)
- **Frontend**: Expo Router with tabs layout, React Native components
- **Backend API**: Fastify (Node.js)
- **Core Package**: @prayer-app/core (prayer calculations, types)
- **Theme**: Custom palette system (light/dark) with earthy green/cream tones
- **Storage**: AsyncStorage for local data, Google Drive sync

## What's Been Implemented (April 12, 2026)

### Homepage Layout Redesign
- **Wave Header**: Decorative green curved banner at top with settings/progress icon buttons
- **Greeting Section**: Centered "Assalamu alaikum" + "Welcome back" + dual date (Hijri/Gregorian) + city/method
- **Prayer Time Cards**: 6 prayer cards (Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha) in centered horizontal row with colored icons; next prayer highlighted
- **View All Toggle**: Expandable section revealing full prayer schedule with "Mark done" tracking buttons
- **Feature Quick-Access Grid**: 4 cards (Quran, Dua Collection, Progress, Settings) navigating to respective tabs
- **Stats Summary Row**: Today completion, current streak, 7-day completion rate
- **Next Prayer Banner**: Centered pill-shaped button showing next prayer name and time
- **Preserved**: Loading state, no-location state, all prayer tracking, stat pills, controls section

### Existing Features (Preserved)
- Prayer times calculation (adhan library)
- Prayer tracking with completion toggles
- Quran reader with search, bookmarks, last-read
- Duas collection (Hisnul Muslim)
- Progress metrics and streak tracking
- Settings (calculation method, madhab, adjustments, location, notifications, theme)
- Google Drive sync
- Light/Dark theme support

## Testing Status
- Frontend testing: 95% pass rate
- All major layout components verified
- Navigation between tabs working
- Prayer schedule expand/collapse working
- Location saving working

## Backlog
- P1: Qibla Finder feature (referenced in image but not yet built)
- P1: Tasbeeh Counter feature (referenced in image but not yet built)
- P2: Islamic Calendar dedicated page
- P2: Personalized "Welcome back [Name]" with user name
- P3: Wave header Islamic geometric pattern overlay
