"""``python -m tragedy.data <build|check|list>``.

build [--check] [--only a,b] [--out DIR] [--skip-gold] [--skip-broken]
check [--only a,b] [--files] [--werror] [--quiet]
list
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def _names(arg: str) -> set[str] | None:
    names = {n.strip() for n in arg.split(",") if n.strip()}
    return names or None


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        prog="python -m tragedy.data", description="Deterministic dataset generator and validator."
    )
    sub = ap.add_subparsers(dest="cmd", required=True)

    b = sub.add_parser("build", help="regenerate datasets/*.json[l] and MANIFEST.json from src/tragedy/data/content/")
    b.add_argument("--check", action="store_true", help="rebuild in memory, fail (exit 1) if the files on disk differ")
    b.add_argument("--only", default="", help="comma separated dataset names (default: all)")
    b.add_argument("--out", type=Path, default=None, help="output directory (default: <repo>/datasets)")
    b.add_argument("--skip-gold", action="store_true", help="do not run tragedy.data.gold.build_gold()")
    b.add_argument(
        "--skip-broken", action="store_true", help="a content module that fails to import is skipped, not fatal"
    )

    c = sub.add_parser("check", help="validate every dataset that exists against docs/DATA.md")
    c.add_argument("--only", default="", help="only print these datasets (cross-checks still use the rest)")
    c.add_argument("--files", action="store_true", help="also fail when datasets/ differs from the generator output")
    c.add_argument("--werror", action="store_true", help="warnings fail the run too")
    c.add_argument("--quiet", action="store_true", help="errors only")

    sub.add_parser("list", help="print datasets/MANIFEST.json")
    args = ap.parse_args(argv)

    from tragedy.data import build as build_mod

    if args.cmd == "list":
        path = build_mod.default_out() / build_mod.MANIFEST_NAME
        if not path.exists():
            print("no MANIFEST.json yet: run `python -m tragedy.data build`", file=sys.stderr)
            return 1
        for name, m in json.loads(path.read_text(encoding="utf-8")).items():
            print(f"{name:<14} {m['rows']:>5} rows  {m['sha256'][:12]}  {m['file']}")
        return 0

    if args.cmd == "check":
        from tragedy.data.check import run_check

        return run_check(only=_names(args.only), files=args.files, werror=args.werror, quiet=args.quiet)

    only = _names(args.only)
    if args.check:
        diffs, problems = build_mod.drift(args.out, only=only, skip_gold=args.skip_gold)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        for d in diffs:
            print(f"  - {d}", file=sys.stderr)
        if diffs or problems:
            print("datasets are out of date" if diffs else "datasets cannot be generated", file=sys.stderr)
            return 1
        print("ok: datasets/ matches the content modules")
        return 0
    messages, problems = build_mod.build(args.out, only=only, skip_gold=args.skip_gold, skip_broken=args.skip_broken)
    for m in messages:
        print(m)
    for p in problems:
        print(f"  ERROR {p}", file=sys.stderr)
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
