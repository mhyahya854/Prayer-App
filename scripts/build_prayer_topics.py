#!/usr/bin/env python3
"""Build prayer-focused topics bundle from hadith bundle."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

TOPIC_RULES = {
    "wudu": ["wudu", "ablution", "purification", "وضوء", "طهارة"],
    "salah": ["salah", "salat", "prayer", "صلاة", "صلاه"],
    "adhan": ["adhan", "adhaan", "iqamah", "أذان", "إقامة"],
    "masjid": ["masjid", "mosque", "مسجد", "المساجد"],
    "khushu": ["khushu", "خشوع", "focus in prayer", "humility in prayer"],
    "tahajjud": ["tahajjud", "qiyam", "night prayer", "قيام", "تهجد"],
    "jumuah": ["jumuah", "jumuah", "friday prayer", "جمعة", "الجمعة"],
}

TOPIC_LABELS = {
    "wudu": {"title": "Wudu", "description": "Purification and preparation for prayer."},
    "salah": {"title": "Salah", "description": "Core narrations about obligatory and sunnah prayer."},
    "adhan": {"title": "Adhan", "description": "Call to prayer and related etiquette."},
    "masjid": {"title": "Masjid", "description": "Mosque etiquette and worship in congregation."},
    "khushu": {"title": "Khushu", "description": "Presence of heart and humility in prayer."},
    "tahajjud": {"title": "Tahajjud", "description": "Night prayer and spiritual discipline."},
    "jumuah": {"title": "Jumuah", "description": "Friday prayer and khutbah-related guidance."},
}


def normalize(value: str) -> str:
    return " ".join((value or "").lower().split())


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build prayer topics bundle from hadith bundle.")
    parser.add_argument(
        "--project-root",
        default=Path(__file__).resolve().parents[1],
        type=Path,
        help="Project root path.",
    )
    return parser.parse_args()


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def build_topics_bundle(project_root: Path) -> dict[str, Any]:
    hadith_bundle_path = project_root / "content-src" / "generated" / "hadith.bundle.json"
    output_path = project_root / "content-src" / "generated" / "prayer-topics.bundle.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    hadith_bundle = load_json(hadith_bundle_path)
    entries = hadith_bundle.get("entries", [])

    topic_items: list[dict[str, Any]] = []
    topic_counts = {slug: 0 for slug in TOPIC_RULES}

    for entry in entries:
        searchable_text = normalize(
            " ".join(
                [
                    str(entry.get("chapterTitleEnglish") or ""),
                    str(entry.get("chapterTitleArabic") or ""),
                    str(entry.get("textEnglish") or ""),
                    str(entry.get("textArabic") or ""),
                    str(entry.get("explanation") or ""),
                    str(entry.get("explanationArabic") or ""),
                ]
            )
        )

        for topic_slug, keywords in TOPIC_RULES.items():
            if any(normalize(keyword) in searchable_text for keyword in keywords):
                topic_counts[topic_slug] += 1
                topic_items.append(
                    {
                        "topicSlug": topic_slug,
                        "hadithId": entry["id"],
                        "bookSlug": entry["bookSlug"],
                        "chapterId": entry["chapterId"],
                        "grade": entry.get("grade", ""),
                        "isGradeVerified": bool(entry.get("isGradeVerified")),
                    }
                )

    topics = []
    for slug, label in TOPIC_LABELS.items():
        topics.append(
            {
                "slug": slug,
                "title": label["title"],
                "description": label["description"],
                "itemCount": topic_counts[slug],
            }
        )

    bundle = {
        "source": {
            "collection": "Prayer Topics from Hadith",
            "license": "Derived from local hadith bundle",
            "name": "Prayer App Prayer Topics",
            "version": datetime.now(tz=timezone.utc).strftime("%Y.%m.%d"),
            "generatedAt": datetime.now(tz=timezone.utc).isoformat(),
        },
        "topics": topics,
        "items": topic_items,
    }
    output_path.write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding="utf-8")
    return bundle


def main() -> None:
    args = parse_args()
    bundle = build_topics_bundle(args.project_root.resolve())
    print(f"Built prayer topics bundle with {len(bundle['topics'])} topics and {len(bundle['items'])} items.")


if __name__ == "__main__":
    main()
