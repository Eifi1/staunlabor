"""Dependabot, locally: run by .husky/pre-push before `npm run check` (Marcel, 2026-10-16,
taken over from keksdose's script of the same day).

Two halves, with different weights:

1. GitHub's open Dependabot ALERTS (a vulnerable dependency) BLOCK the push: one
   `gh api` call. Offline, or without a `gh` login, it warns and lets the push through —
   `npm run check` still runs the dependency audit and npm audit, which need no GitHub.
2. Newer minor and patch versions of the DIRECT dependencies (npm workspaces and the
   backend's pyproject) are a REPORT only: something upstream released this morning
   must not stop a push. Majors are left out, as in dependabot.yml, and so are the
   pinned holds listed below.

This replaces Dependabot's version-update PRs for npm and uv, which are switched off in
.github/dependabot.yml (here their CI and update jobs cost about 175 of 730 Actions
minutes over 2026-09-16..10-16, and the bumps were folded into a round branch by hand
anyway). The GitHub Actions pins keep their monthly Dependabot PR: no local tool lists
those.

Exit 1 only for an open alert. `SKIP_DEPENDENCY_CHECK=1` skips the whole check.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = "Eifi1/staunlabor"

#: Held on purpose; mirrored from dependabot.yml's `ignore` lists and the memory of why.
#: name → the first version NOT to propose.
HOLDS = {
    "@eifi1/ui-kit": "0.0",  # adopted in kit rounds, never as a bump (any newer minor).
}


def _run(cmd: list[str], cwd: Path = ROOT) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd, cwd=cwd, capture_output=True, text=True, stdin=subprocess.DEVNULL, timeout=120, check=False
    )


def _version(text: str) -> tuple[int, ...]:
    return tuple(int(p) for p in re.findall(r"\d+", text)[:3])


def _major(text: str) -> int:
    # The first number, as Dependabot's semver-major ignore reads it: a 0.x minor is an
    # update here (a 0.x the app holds back is in HOLDS).
    parts = _version(text)
    return parts[0] if parts else 0


def _held(name: str, current: str, latest: str) -> bool:
    hold = HOLDS.get(name)
    if hold is None:
        return False
    if hold == "0.0":
        return True
    return _version(latest) >= _version(hold) > _version(current)


def alerts() -> int:
    result = _run(["gh", "api", f"repos/{REPO}/dependabot/alerts?state=open&per_page=100"])
    if result.returncode != 0:
        print(f"⚠ Dependabot alerts not checked (gh: {result.stderr.strip()[:120] or 'failed'}).")
        return 0
    found = json.loads(result.stdout or "[]")
    if not found:
        print("✓ No open Dependabot alerts.")
        return 0
    print(f"✗ {len(found)} open Dependabot alert(s) — fix before pushing:")
    for a in found:
        dep = a.get("dependency", {}).get("package", {})
        adv = a.get("security_advisory", {})
        fix = (a.get("security_vulnerability") or {}).get("first_patched_version") or {}
        print(
            f"  - {dep.get('ecosystem')} {dep.get('name')}: {adv.get('severity')} — "
            f"{adv.get('summary')} (fixed in {fix.get('identifier', '?')}) {a.get('html_url', '')}"
        )
    return 1


def npm_updates() -> list[str]:
    result = _run(["npm", "outdated", "--json", "--workspaces", "--include-workspace-root"])
    try:
        data = json.loads(result.stdout or "{}")
    except json.JSONDecodeError:
        return ["npm outdated gave no answer"]
    lines = []
    for name, info in sorted(data.items()):
        entries = info if isinstance(info, list) else [info]
        for e in entries:
            current, latest = e.get("current"), e.get("latest")
            if not current or not latest or current == latest:
                continue
            if _major(latest) != _major(current):
                # The newest within this major is still worth a line.
                wanted = e.get("wanted")
                if not wanted or wanted == current or _major(wanted) != _major(current):
                    continue
                latest = wanted
            if _held(name, current, latest):
                continue
            lines.append(f"npm  {name} {current} → {latest}")
            break
    return lines


def _direct_python() -> set[str]:
    data = tomllib.loads((ROOT / "backend" / "pyproject.toml").read_text())
    specs = list(data.get("project", {}).get("dependencies", []))
    for group in data.get("dependency-groups", {}).values():
        specs += [s for s in group if isinstance(s, str)]
    return {re.split(r"[\s\[<>=!~;@]", s, maxsplit=1)[0].lower().replace("_", "-") for s in specs}


def python_updates() -> list[str]:
    result = _run(["uv", "pip", "list", "--outdated", "--format", "json"], cwd=ROOT / "backend")
    try:
        data = json.loads(result.stdout or "[]")
    except json.JSONDecodeError:
        return ["uv pip list gave no answer"]
    direct = _direct_python()
    lines = []
    for p in sorted(data, key=lambda p: p["name"].lower()):
        name = p["name"].lower().replace("_", "-")
        current, latest = p["version"], p["latest_version"]
        if name not in direct or _major(latest) != _major(current) or _held(name, current, latest):
            continue
        lines.append(f"uv   {name} {current} → {latest}")
    return lines


def main() -> int:
    if os.environ.get("SKIP_DEPENDENCY_CHECK"):
        return 0
    status = alerts()
    try:
        updates = npm_updates() + python_updates()
    except (OSError, subprocess.SubprocessError) as exc:
        print(f"⚠ Outdated report skipped ({exc}).")
        updates = []
    if updates:
        print(f"ℹ {len(updates)} minor/patch update(s) available — not blocking; take them in the next round:")
        for line in updates:
            print(f"  {line}")
    else:
        print("✓ Direct dependencies are current (minor/patch).")
    return status


if __name__ == "__main__":
    sys.exit(main())
