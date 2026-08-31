#!/usr/bin/env python3
"""Resolve a local checkout to the public GoodRepo scan URL."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote


DEFAULT_SITE_URL = "https://goodrepo-web.vercel.app"


class ResolutionError(RuntimeError):
    pass


def git(path: Path, *args: str, check: bool = True) -> str:
    result = subprocess.run(
        ["git", "-C", str(path), *args],
        check=False,
        capture_output=True,
        text=True,
    )
    if check and result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "git command failed"
        raise ResolutionError(detail)
    return result.stdout.strip()


def parse_github_remote(remote_url: str) -> tuple[str, str]:
    patterns = (
        r"^https?://github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$",
        r"^git@github\.com:([^/]+)/([^/]+?)(?:\.git)?$",
        r"^ssh://git@github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$",
    )
    for pattern in patterns:
        match = re.match(pattern, remote_url, flags=re.IGNORECASE)
        if match:
            return match.group(1), match.group(2)
    raise ResolutionError(
        "GoodRepo can scan only public GitHub repositories; the selected remote is not a GitHub URL."
    )


def resolve(args: argparse.Namespace) -> dict[str, object]:
    requested_path = Path(args.path).resolve()
    root_text = git(requested_path, "rev-parse", "--show-toplevel")
    root = Path(root_text)
    remote_url = git(root, "remote", "get-url", args.remote)
    owner, repo = parse_github_remote(remote_url)

    branch = git(root, "branch", "--show-current") or None
    head = git(root, "rev-parse", "HEAD")
    dirty = bool(git(root, "status", "--porcelain=v1", "--untracked-files=normal"))

    upstream = git(root, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}", check=False)
    ahead = behind = None
    if upstream:
        counts = git(root, "rev-list", "--left-right", "--count", f"{upstream}...HEAD").split()
        if len(counts) == 2:
            behind, ahead = (int(counts[0]), int(counts[1]))

    site_url = (args.site_url or os.environ.get("GOODREPO_URL") or DEFAULT_SITE_URL).rstrip("/")
    if not re.match(r"^https?://", site_url, flags=re.IGNORECASE):
        raise ResolutionError("The GoodRepo site URL must start with http:// or https://.")

    scan_url = f"{site_url}/{quote(owner, safe='')}/{quote(repo, safe='')}"
    warnings: list[str] = []
    if dirty:
        warnings.append("The working tree has local changes that the website cannot scan.")
    if ahead:
        warnings.append(f"The current branch has {ahead} unpushed commit(s) relative to {upstream}.")
    if branch is None:
        warnings.append("HEAD is detached; it may not correspond to the public default branch.")

    return {
        "root": str(root),
        "remote": args.remote,
        "remote_url": remote_url,
        "owner": owner,
        "repo": repo,
        "branch": branch,
        "head": head,
        "dirty": dirty,
        "upstream": upstream or None,
        "ahead": ahead,
        "behind": behind,
        "site_url": site_url,
        "scan_url": scan_url,
        "warnings": warnings,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--path", default=".", help="Path inside the repository (default: current directory)")
    parser.add_argument("--remote", default="origin", help="Git remote to scan (default: origin)")
    parser.add_argument("--site-url", help=f"GoodRepo base URL (default: GOODREPO_URL or {DEFAULT_SITE_URL})")
    args = parser.parse_args()

    try:
        print(json.dumps(resolve(args), indent=2))
    except (OSError, ResolutionError) as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
