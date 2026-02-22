"""
ASL Signs Seeder
================
This script:
1. Reads words.csv
2. For each word, finds the first video that actually exists on disk
3. Uploads that video to Supabase Storage under signs/{slug}/demo.mp4
4. Inserts a row into the signs table

Setup:
    pip install supabase python-dotenv

Usage:
    python seed_signs.py --videos-dir /path/to/your/videos --csv /path/to/words.csv

Required env vars (put in a .env file next to this script or export them):
    SUPABASE_URL=https://supabase.zachl.tech
    SUPABASE_SERVICE_KEY=your-service-role-key
"""

import csv
import ast
import os
import re
import sys
import time
import argparse
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
BUCKET = "sign-videos"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SINGLE_LETTERS = set("abcdefghijklmnopqrstuvwxy")  # no z

def word_to_slug(word: str) -> str:
    """Convert a display word to a URL/DB-safe slug.
    'a'         -> 'letter_a'
    'Thank You' -> 'thank_you'
    'a lot'     -> 'a_lot'
    """
    cleaned = word.strip().lower()
    if cleaned in SINGLE_LETTERS:
        return f"letter_{cleaned}"
    # replace spaces and special chars with underscores
    slug = re.sub(r"[^a-z0-9]+", "_", cleaned).strip("_")
    return slug


def infer_sign_type(word: str) -> str:
    cleaned = word.strip().lower()
    if cleaned in SINGLE_LETTERS:
        return "letter"
    if " " in cleaned:
        return "phrase"
    return "word"


def infer_category(word: str) -> str:
    cleaned = word.strip().lower()
    if cleaned in SINGLE_LETTERS:
        return "alphabet"
    # Very rough category heuristic — Gemini will fill in better descriptions later
    # You can expand this map as needed
    CATEGORY_MAP = {
        "greetings": ["hello", "goodbye", "bye", "hi", "please", "thank you", "sorry", "excuse me", "welcome"],
        "numbers":   ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
                      "hundred", "thousand", "million", "zero"],
        "colors":    ["red", "blue", "green", "yellow", "orange", "purple", "pink", "black", "white", "brown"],
        "family":    ["mother", "father", "brother", "sister", "baby", "son", "daughter", "family",
                      "grandmother", "grandfather", "aunt", "uncle", "cousin", "husband", "wife"],
        "food":      ["eat", "drink", "food", "water", "milk", "bread", "apple", "banana", "chicken",
                      "fish", "rice", "coffee", "tea", "juice", "pizza", "hungry", "thirsty"],
        "places":    ["home", "school", "hospital", "store", "church", "city", "country", "africa",
                      "america", "library", "office", "restaurant", "bathroom"],
        "time":      ["today", "tomorrow", "yesterday", "morning", "afternoon", "evening", "night",
                      "week", "month", "year", "hour", "minute", "time", "now", "later", "soon",
                      "always", "never", "sometimes", "ago"],
        "emotions":  ["happy", "sad", "angry", "afraid", "love", "hate", "excited", "worried",
                      "surprised", "bored", "tired", "sick", "pain", "feel", "emotion"],
        "questions": ["who", "what", "when", "where", "why", "how", "which"],
        "pronouns":  ["i", "me", "you", "he", "she", "we", "they", "it", "my", "your", "his", "her"],
    }
    for category, keywords in CATEGORY_MAP.items():
        if cleaned in keywords:
            return category
    return "general"


def infer_difficulty(word: str) -> int:
    """Letters = 1, short common words = 2, longer/complex = 3-4, phrases = 3"""
    cleaned = word.strip().lower()
    if cleaned in SINGLE_LETTERS:
        return 1
    if " " in cleaned:
        return 3
    if len(cleaned) <= 4:
        return 2
    if len(cleaned) <= 8:
        return 2
    return 3


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Seed ASL signs into Supabase")
    parser.add_argument("--videos-dir", required=True, help="Local path to directory containing the .mp4 files")
    parser.add_argument("--csv", required=True, help="Path to words.csv")
    parser.add_argument("--dry-run", action="store_true", help="Parse and validate without uploading or inserting")
    parser.add_argument("--skip-upload", action="store_true", help="Skip video upload, only insert DB rows (use if videos already uploaded)")
    parser.add_argument("--limit", type=int, default=None, help="Only process first N words (for testing)")
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment or .env file")
        sys.exit(1)

    videos_dir = Path(args.videos_dir)
    if not videos_dir.exists():
        print(f"ERROR: Videos directory does not exist: {videos_dir}")
        sys.exit(1)

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # Read CSV
    with open(args.csv, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    if args.limit:
        rows = rows[:args.limit]

    print(f"Processing {len(rows)} words...")

    skipped = []
    inserted = []
    errors = []

    for i, row in enumerate(rows):
        word = row["word"].strip()
        slug = word_to_slug(word)

        # Skip Z entirely
        if word.strip().lower() == "z":
            print(f"  [{i+1}] SKIP z — excluded from system")
            skipped.append(word)
            continue

        # Parse the path list (it's a Python list literal in the CSV)
        try:
            raw_paths = ast.literal_eval(row["path"])
        except Exception as e:
            print(f"  [{i+1}] ERROR parsing paths for '{word}': {e}")
            errors.append(word)
            continue

        # Find first video that actually exists on disk
        chosen_path = None
        for p in raw_paths:
            # The paths in CSV look like '/videos/00295.mp4' — just the filename matters
            filename = Path(p).name  # e.g. '00295.mp4'
            local_path = videos_dir / filename
            if local_path.exists():
                chosen_path = local_path
                break

        if chosen_path is None:
            print(f"  [{i+1}] SKIP '{word}' — no matching video found on disk (checked {len(raw_paths)} paths)")
            skipped.append(word)
            continue

        storage_path = f"signs/{slug}/demo.mp4"
        sign_type = infer_sign_type(word)
        category = infer_category(word)
        difficulty = infer_difficulty(word)

        if args.dry_run:
            print(f"  [{i+1}] DRY RUN: '{word}' -> slug={slug}, video={chosen_path.name}, storage={storage_path}")
            inserted.append(word)
            continue

        # Upload video to Supabase Storage
        if not args.skip_upload:
            try:
                with open(chosen_path, "rb") as video_file:
                    video_bytes = video_file.read()

                # upsert=True so re-running the script won't fail on duplicates
                supabase.storage.from_(BUCKET).upload(
                    path=storage_path,
                    file=video_bytes,
                    file_options={
                        "content-type": "video/mp4",
                        "upsert": "true",
                    }
                )
                print(f"  [{i+1}] UPLOADED '{word}' ({chosen_path.name}) -> {storage_path}")
            except Exception as e:
                print(f"  [{i+1}] UPLOAD ERROR for '{word}': {e}")
                errors.append(word)
                continue
        else:
            print(f"  [{i+1}] SKIP UPLOAD '{word}' (--skip-upload flag set)")

        # Insert into signs table
        try:
            result = supabase.table("signs").upsert({
                "slug": slug,
                "display_text": word,
                "sign_type": sign_type,
                "category": category,
                "difficulty": difficulty,
                "video_path": storage_path,
                "model_label": word.lower(),  # model should output lowercase word
                "is_active": True,
            }, on_conflict="slug").execute()

            inserted.append(word)

        except Exception as e:
            print(f"  [{i+1}] DB INSERT ERROR for '{word}': {e}")
            errors.append(word)
            continue

        # Small delay to avoid hammering the storage API
        time.sleep(0.05)

    # Summary
    print("\n" + "="*50)
    print(f"DONE")
    print(f"  Inserted/updated: {len(inserted)}")
    print(f"  Skipped (no video or excluded): {len(skipped)}")
    print(f"  Errors: {len(errors)}")
    if skipped:
        print(f"\nSkipped words:")
        for w in skipped:
            print(f"  - {w}")
    if errors:
        print(f"\nError words (check manually):")
        for w in errors:
            print(f"  - {w}")


if __name__ == "__main__":
    main()
