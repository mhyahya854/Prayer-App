#!/usr/bin/env python3
"""Validate generated content bundles for minimum integrity checks."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate generated hadith and prayer topic bundles.")
    parser.add_argument(
        "--project-root",
        default=Path(__file__).resolve().parents[1],
        type=Path,
        help="Project root path.",
    )
    return parser.parse_args()


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise RuntimeError(f"Malformed JSON in {path}: {error}") from error


def validate_hadith_bundle(path: Path) -> list[str]:
    bundle = load_json(path)
    errors: list[str] = []
    seen_ids: set[str] = set()

    for entry in bundle.get("entries", []):
        entry_id = str(entry.get("id", ""))
        if not entry_id:
            errors.append("Found hadith entry with empty id.")
            continue
        if entry_id in seen_ids:
            errors.append(f"Duplicate hadith id: {entry_id}")
        seen_ids.add(entry_id)

        if not str(entry.get("textArabic", "")).strip():
            errors.append(f"Missing Arabic text for {entry_id}")
        english_text = entry.get("textEnglish")
        if english_text is None or not isinstance(english_text, str):
            errors.append(f"Broken English text field for {entry_id}")
        if "narratorEnglish" not in entry:
            errors.append(f"Missing narratorEnglish field for {entry_id}")
        if bool(entry.get("isGradeVerified")) and not str(entry.get("grade", "")).strip():
            errors.append(f"Grade marked verified but empty for {entry_id}")

    return errors


def validate_topics_bundle(path: Path, hadith_ids: set[str]) -> list[str]:
    bundle = load_json(path)
    errors: list[str] = []
    topic_slugs = {topic["slug"] for topic in bundle.get("topics", []) if topic.get("slug")}

    for item in bundle.get("items", []):
        topic_slug = item.get("topicSlug")
        hadith_id = item.get("hadithId")
        if topic_slug not in topic_slugs:
            errors.append(f"Topic item references unknown topic slug: {topic_slug}")
        if hadith_id not in hadith_ids:
            errors.append(f"Topic item references unknown hadith id: {hadith_id}")
    return errors


def main() -> None:
    args = parse_args()
    project_root = args.project_root.resolve()

    hadith_bundle_path = project_root / "content-src" / "generated" / "hadith.bundle.json"
    topics_bundle_path = project_root / "content-src" / "generated" / "prayer-topics.bundle.json"

    hadith_errors = validate_hadith_bundle(hadith_bundle_path)
    hadith_bundle = load_json(hadith_bundle_path)
    hadith_ids = {entry["id"] for entry in hadith_bundle.get("entries", []) if entry.get("id")}
    topic_errors = validate_topics_bundle(topics_bundle_path, hadith_ids)

    all_errors = hadith_errors + topic_errors
    if all_errors:
        print("Validation failed:")
        for error in all_errors[:100]:
            print(f"- {error}")
        raise SystemExit(1)

    print("Validation passed: generated content bundles are structurally healthy.")


if __name__ == "__main__":
    main()
