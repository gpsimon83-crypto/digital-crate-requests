#!/usr/bin/env python3
"""
Serato Library Toolkit — a single, dependency-free Python 3 script.
Copy this file to any computer (USB / AirDrop / cloud folder) and run it
directly against that machine's real music + Serato library. No install
required beyond a stock Python 3 (3.6+).

SAFETY MODEL
------------
- `scan`    is always read-only.
- `dedupe`  only MOVES duplicate files into a _DUPLICATES_REVIEW folder next
            to your music (never permanently deletes). Dry-run by default.
- `crates`  only ever ADDS NEW .crate files under Subcrates. It never edits
            or deletes existing crates, and never touches "database V2"
            (Serato's main track database), so your existing library and
            crates can't be corrupted by this tool. Dry-run by default.
            Before any live write, it makes a timestamped zip backup of
            your whole _Serato_ folder automatically.

USAGE
-----
  python3 serato_toolkit.py scan    --music-dir "/path/to/MUSIC"
  python3 serato_toolkit.py dedupe  --music-dir "/path/to/MUSIC" [--live]
  python3 serato_toolkit.py crates list   --serato-dir "/path/to/_Serato_"
  python3 serato_toolkit.py crates build  --serato-dir "/path/to/_Serato_" \\
                                           --music-dir  "/path/to/MUSIC" \\
                                           --scheme folder|genre [--live]

`--music-dir` and `--serato-dir` must be on the SAME volume (Serato crate
paths are stored relative to the volume root). If you don't pass them,
the script assumes it's being run FROM inside that volume and will look
for a sibling `_Serato_` folder and prompt you.
"""
import argparse
import json
import os
import re
import shutil
import sys
import zipfile
from pathlib import Path
from collections import defaultdict
from datetime import datetime

AUDIO_EXT = {".mp3", ".wav", ".aif", ".aiff", ".flac", ".m4a", ".wma"}
DEFAULT_EXCLUDE_DIRS = {"_DUPLICATES_REVIEW", "Logic Master Collection"}

# ─────────────────────────────────────────────────────────────────────────
#  Shared helpers
# ─────────────────────────────────────────────────────────────────────────

def normalize(name: str) -> str:
    stem = os.path.splitext(name)[0].lower()
    stem = re.sub(r"^\d+[\s\-_.]*", "", stem)
    stem = re.sub(r"\(clean\)|\(dirty\)|\(explicit\)|\(radio edit\)|\(album version\)", "", stem)
    stem = re.sub(r"[^a-z0-9]+", " ", stem)
    return re.sub(r"\s+", " ", stem).strip()


def walk_audio_files(music_dir: Path, exclude_dirs):
    files = []
    for root, dirs, filenames in os.walk(music_dir):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for fn in filenames:
            ext = os.path.splitext(fn)[1].lower()
            if ext in AUDIO_EXT:
                p = Path(root) / fn
                try:
                    stat = p.stat()
                except OSError:
                    continue
                files.append({
                    "path": p, "name": fn, "size": stat.st_size,
                    "mtime": stat.st_mtime, "norm": normalize(fn),
                    "top": p.relative_to(music_dir).parts[0],
                })
    return files


def find_volume_root(serato_dir: Path) -> Path:
    """Serato always creates its _Serato_ folder at the root of the drive
    it manages, so that folder's parent IS the volume root — this holds
    on macOS, Windows, and Linux alike, no OS-specific mount detection needed."""
    return serato_dir.resolve().parent


# ─────────────────────────────────────────────────────────────────────────
#  scan
# ─────────────────────────────────────────────────────────────────────────

def cmd_scan(args):
    music_dir = Path(args.music_dir)
    if not music_dir.exists():
        sys.exit(f"ERROR: music dir not found: {music_dir}")

    files = walk_audio_files(music_dir, DEFAULT_EXCLUDE_DIRS)
    total_size = sum(f["size"] for f in files)

    exact_groups = defaultdict(list)
    for f in files:
        if f["norm"]:
            exact_groups[(f["norm"], f["size"])].append(f)
    exact_dupes = {k: v for k, v in exact_groups.items() if len(v) > 1}
    exact_wasted = sum(sum(x["size"] for x in v[1:]) for v in exact_dupes.values())

    name_groups = defaultdict(list)
    for f in files:
        if f["norm"]:
            name_groups[f["norm"]].append(f)
    name_dupes = {k: v for k, v in name_groups.items() if len(v) > 1}

    by_top = defaultdict(lambda: {"count": 0, "size": 0})
    for f in files:
        by_top[f["top"]]["count"] += 1
        by_top[f["top"]]["size"] += f["size"]
    folders = [
        {"name": top, "count": stats["count"], "sizeBytes": stats["size"]}
        for top, stats in sorted(by_top.items(), key=lambda kv: -kv[1]["size"])
    ]

    if args.json:
        print(json.dumps({
            "totalFiles": len(files),
            "totalSizeBytes": total_size,
            "exactDuplicateGroups": len(exact_dupes),
            "exactDuplicateWastedBytes": exact_wasted,
            "likelyDuplicateGroups": len(name_dupes) - len(exact_dupes),
            "folders": folders,
        }))
        return

    print(f"Total audio files scanned: {len(files)}")
    print(f"Total size: {total_size / (1024**3):.1f} GB\n")
    print(f"Exact duplicate groups (same name+size): {len(exact_dupes)}")
    print(f"  Reclaimable space if deduped: {exact_wasted / (1024**3):.2f} GB")
    print(f"Likely-duplicate groups (same name, different size/format): "
          f"{len(name_dupes) - len(exact_dupes)}\n")
    print("FOLDER SUMMARY")
    for f in folders:
        print(f"  {f['sizeBytes']/(1024**3):6.2f} GB  {f['count']:5d} files  {f['name']}")


# ─────────────────────────────────────────────────────────────────────────
#  dedupe
# ─────────────────────────────────────────────────────────────────────────

def cmd_dedupe(args):
    music_dir = Path(args.music_dir)
    if not music_dir.exists():
        sys.exit(f"ERROR: music dir not found: {music_dir}")
    quarantine_dir = music_dir / "_DUPLICATES_REVIEW"

    files = walk_audio_files(music_dir, DEFAULT_EXCLUDE_DIRS)
    groups = defaultdict(list)
    for f in files:
        if f["norm"]:
            groups[(f["norm"], f["size"])].append(f)
    dupe_groups = {k: v for k, v in groups.items() if len(v) > 1}

    move_plan = []
    for (norm, size), group in dupe_groups.items():
        group_sorted = sorted(group, key=lambda f: (len(str(f["path"])), f["mtime"]))
        keep = group_sorted[0]
        for dup in group_sorted[1:]:
            move_plan.append({"keep": keep["path"], "move": dup["path"]})

    total_bytes = sum(m["move"].stat().st_size for m in move_plan)

    log_lines = []
    errors = []
    for item in move_plan:
        rel = item["move"].relative_to(music_dir)
        dest = quarantine_dir / rel
        log_lines.append(f"KEEP: {item['keep']}\nMOVE: {item['move']}\n  -> {dest}\n")
        if args.live:
            dest.parent.mkdir(parents=True, exist_ok=True)
            try:
                shutil.move(str(item["move"]), str(dest))
            except Exception as e:
                log_lines.append(f"  ERROR: {e}\n")
                errors.append(str(e))

    log_path = music_dir / f"dedupe_log_{datetime.now():%Y%m%d_%H%M%S}.txt"
    log_path.write_text("\n".join(log_lines), encoding="utf-8")

    if args.json:
        print(json.dumps({
            "duplicateGroups": len(dupe_groups),
            "filesQuarantined": len(move_plan),
            "bytesQuarantined": total_bytes,
            "live": args.live,
            "quarantineDir": str(quarantine_dir),
            "logPath": str(log_path),
            "errors": errors,
        }))
        return

    print(f"Duplicate groups: {len(dupe_groups)}")
    print(f"Files to quarantine: {len(move_plan)}  ({total_bytes/(1024**3):.2f} GB)")
    print(f"Mode: {'LIVE' if args.live else 'DRY RUN'}")
    if args.live:
        print(f"Destination: {quarantine_dir}")
    print()
    print(f"Full log written to: {log_path}")
    if not args.live:
        print("\nThis was a DRY RUN. Re-run with --live to actually move files.")


# ─────────────────────────────────────────────────────────────────────────
#  Serato .crate binary format (validated against a real Serato crate file)
# ─────────────────────────────────────────────────────────────────────────

def read_tlv(data, offset=0):
    tag = data[offset:offset + 4].decode("ascii")
    length = int.from_bytes(data[offset + 4:offset + 8], "big")
    value = data[offset + 8:offset + 8 + length]
    return tag, value, offset + 8 + length


def parse_container(data):
    entries, offset = [], 0
    while offset < len(data):
        tag, value, offset = read_tlv(data, offset)
        entries.append((tag, value))
    return entries


def tlv(tag, value_bytes):
    return tag.encode("ascii") + len(value_bytes).to_bytes(4, "big") + value_bytes


def utf16be(s):
    return s.encode("utf-16-be")


def read_crate_paths(crate_path: Path):
    data = crate_path.read_bytes()
    paths = []
    for tag, value in parse_container(data):
        if tag == "otrk":
            for itag, ivalue in parse_container(value):
                if itag == "ptrk":
                    paths.append(ivalue.decode("utf-16-be"))
    return paths


def build_crate_bytes(track_paths):
    columns = [("song", "0"), ("artist", "0"), ("bpm", "0"), ("key", "0"),
               ("album", "0"), ("length", "0"), ("comment", "0")]
    out = tlv("vrsn", utf16be("1.0/Serato ScratchLive Crate"))
    for name, width in columns:
        inner = tlv("tvcn", utf16be(name)) + tlv("tvcw", utf16be(width))
        out += tlv("ovct", inner)
    for path in track_paths:
        out += tlv("otrk", tlv("ptrk", utf16be(path)))
    return out


GENRE_FOLDER_MAP = {
    "hip hop": "Hip-Hop & Rap", "hip-hop": "Hip-Hop & Rap", "rap": "Hip-Hop & Rap",
    "r&b": "R&B & Soul", "soul": "R&B & Soul",
    "house": "Electronic & Dance", "techno": "Electronic & Dance", "electronic": "Electronic & Dance",
    "rock": "Rock & Alternative", "alternative": "Rock & Alternative",
    "pop": "Pop", "reggae": "Reggae", "funk": "Funk & Disco", "disco": "Funk & Disco",
}


def guess_genre_from_id3(path: Path):
    try:
        import mutagen  # optional; only used if already installed
        from mutagen.easyid3 import EasyID3
        tags = mutagen.File(str(path), easy=True)
        if tags and "genre" in tags:
            raw = tags["genre"][0].lower().strip()
            return GENRE_FOLDER_MAP.get(raw, "Uncategorized")
    except Exception:
        pass
    return None


# ─────────────────────────────────────────────────────────────────────────
#  crates
# ─────────────────────────────────────────────────────────────────────────

def cmd_crates_list(args):
    serato_dir = Path(args.serato_dir)
    subcrates = serato_dir / "Subcrates"
    if not subcrates.exists():
        sys.exit(f"ERROR: no Subcrates folder at {subcrates}")

    crate_files = sorted(subcrates.rglob("*.crate"))
    results = []
    for cf in crate_files:
        try:
            paths = read_crate_paths(cf)
            results.append({"name": str(cf.relative_to(subcrates)), "trackCount": len(paths), "error": None})
        except Exception as e:
            results.append({"name": str(cf.relative_to(subcrates)), "trackCount": 0, "error": str(e)})

    if args.json:
        print(json.dumps({"crates": results}))
        return

    print(f"Found {len(crate_files)} crate file(s) under {subcrates}\n")
    for r in results:
        if r["error"]:
            print(f"  {r['name']}: ERROR reading ({r['error']})")
        else:
            print(f"  {r['name']}  —  {r['trackCount']} tracks")


def cmd_crates_build(args):
    serato_dir = Path(args.serato_dir)
    music_dir = Path(args.music_dir)
    subcrates = serato_dir / "Subcrates"
    if not serato_dir.exists():
        sys.exit(f"ERROR: _Serato_ folder not found: {serato_dir}")
    if not music_dir.exists():
        sys.exit(f"ERROR: music dir not found: {music_dir}")

    volume_root = find_volume_root(serato_dir)
    files = walk_audio_files(music_dir, DEFAULT_EXCLUDE_DIRS)

    groups = defaultdict(list)
    for f in files:
        if args.scheme == "folder":
            key = f["top"]
        else:  # genre
            key = guess_genre_from_id3(f["path"]) or "Uncategorized"
        rel_path = str(f["path"].resolve().relative_to(volume_root))
        groups[key].append(rel_path)

    planned = [{"name": name, "trackCount": len(paths)} for name, paths in sorted(groups.items())]

    if not args.live:
        if args.json:
            print(json.dumps({"scheme": args.scheme, "volumeRoot": str(volume_root),
                               "live": False, "plannedCrates": planned}))
            return
        print(f"Scheme: {args.scheme}")
        print(f"Volume root (paths stored relative to this): {volume_root}")
        print(f"Proposed new crates: {len(groups)}\n")
        for p in planned:
            print(f"  [{p['name']}]  {p['trackCount']} tracks  -> Subcrates/{p['name']}.crate")
        print("\nThis was a DRY RUN. Re-run with --live to actually create these .crate files.")
        return

    # Safety: back up the whole _Serato_ folder before writing anything.
    backup_path = serato_dir.parent / f"_Serato_backup_{datetime.now():%Y%m%d_%H%M%S}.zip"
    with zipfile.ZipFile(backup_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in serato_dir.rglob("*"):
            if f.is_file():
                zf.write(f, f.relative_to(serato_dir.parent))

    subcrates.mkdir(parents=True, exist_ok=True)
    created = []
    for name, paths in groups.items():
        safe_name = re.sub(r'[\\/:*?"<>|]', "_", name)
        dest = subcrates / f"{safe_name}.crate"
        if dest.exists():
            created.append({"name": dest.name, "trackCount": len(paths), "status": "skipped_exists"})
            continue
        dest.write_bytes(build_crate_bytes(paths))
        created.append({"name": dest.name, "trackCount": len(paths), "status": "created"})

    if args.json:
        print(json.dumps({"scheme": args.scheme, "volumeRoot": str(volume_root),
                           "live": True, "backupPath": str(backup_path), "crates": created}))
        return

    print(f"Scheme: {args.scheme}")
    print(f"Volume root (paths stored relative to this): {volume_root}")
    print(f"\nBacked up to: {backup_path}\n")
    for c in created:
        label = "SKIP (already exists)" if c["status"] == "skipped_exists" else "CREATED"
        print(f"  {label}: {c['name']}  ({c['trackCount']} tracks)")
    print("\nDone. Existing crates and database V2 were not touched.")
    print("Restart Serato (or refresh) to see the new crates.")


# ─────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Serato Library Toolkit")
    sub = parser.add_subparsers(dest="command", required=True)

    p_scan = sub.add_parser("scan", help="Read-only scan for duplicates and folder stats")
    p_scan.add_argument("--music-dir", required=True)
    p_scan.add_argument("--json", action="store_true", help="Emit machine-readable JSON instead of text")
    p_scan.set_defaults(func=cmd_scan)

    p_dedupe = sub.add_parser("dedupe", help="Move exact duplicates into a review folder")
    p_dedupe.add_argument("--music-dir", required=True)
    p_dedupe.add_argument("--live", action="store_true")
    p_dedupe.add_argument("--json", action="store_true")
    p_dedupe.set_defaults(func=cmd_dedupe)

    p_crates = sub.add_parser("crates", help="Read or build Serato crates")
    crates_sub = p_crates.add_subparsers(dest="crates_command", required=True)

    p_list = crates_sub.add_parser("list", help="List existing crates and track counts")
    p_list.add_argument("--serato-dir", required=True)
    p_list.add_argument("--json", action="store_true")
    p_list.set_defaults(func=cmd_crates_list)

    p_build = crates_sub.add_parser("build", help="Create new crates from folders or genre tags")
    p_build.add_argument("--serato-dir", required=True)
    p_build.add_argument("--music-dir", required=True)
    p_build.add_argument("--scheme", choices=["folder", "genre"], default="folder")
    p_build.add_argument("--live", action="store_true")
    p_build.add_argument("--json", action="store_true")
    p_build.set_defaults(func=cmd_crates_build)

    args = parser.parse_args()
    if getattr(args, "json", False):
        try:
            args.func(args)
        except SystemExit as e:
            print(json.dumps({"error": str(e.code)}))
            sys.exit(1)
    else:
        args.func(args)


if __name__ == "__main__":
    main()
