#!/usr/bin/env python3
"""
Keep the portfolio in step with the projects it describes.

For every project in PROJECTS below, reads the repository's history and writes:

  src/data/projects.json                         what the terminal's `updates` and
                                                 `projects` commands read
  content/home/projects/<folder>/CHANGELOG.md    the latest work, readable in the
                                                 terminal with `cat`
  README.md                                      the "Lately" table between
                                                 <!-- projects:start --> and
                                                 <!-- projects:end -->, and each
                                                 project's source link between
                                                 <!-- source:<folder>:start --> and
                                                 <!-- source:<folder>:end -->
                                                 (keep those inside a <span>: a line
                                                 that opens with a comment is raw
                                                 HTML to GitHub, and its links show
                                                 as plain text)

Nothing here is specific to today's commits: push to a project and it shows up
after the next run. Whether a repository is public or private is read each time
too, so a project's link appears or turns into "source is private" on its own.
The scheduled GitHub Actions workflow runs this every three hours.

A private repository's commit messages are only published if its entry says
"share": True. Otherwise only its dates and commit count leave the script.

The dated lists look after themselves; the hand-written pages about a project
do not. So the script also remembers the commit each write-up was last revised
at (projects_reviewed.json) and can say what has changed since:

    python3 projects_sync_script.py --check                  # ask GitHub
    python3 projects_sync_script.py --check --local ..       # ask the clones next to this one,
                                                             # including work not pushed yet
    python3 projects_sync_script.py --mark-reviewed          # after revising the write-ups

Usage:
    python3 projects_sync_script.py --dry-run
    python3 projects_sync_script.py
    python3 projects_sync_script.py --local ..               # preview from local clones

Private repositories need a token that can read them in the GITHUB_TOKEN
environment variable. Without one they keep the data they already had.
"""

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add a project here and it is picked up everywhere.
#   folder   its folder under content/home/projects
#   share    publish commit messages even while the repository is private
#   team     a shared repository: listed in the terminal, left out of the README's "Lately"
PROJECTS = [
    {"name": "Healing Hive", "repo": "KathFK1234/Healing-Hive", "folder": "healing-hive", "share": True},
    {"name": "MoodForecast AI", "repo": "KathFK1234/moodforecast_ai", "folder": "moodforecast-ai"},
    {"name": "Murengeti Lab System", "repo": "KathFK1234/murengeti_sys", "folder": "murengeti-lab", "share": True},
    {"name": "MindConnect", "repo": "derick-macharia/mindconnect-platform", "folder": "mindconnect", "team": True},
]

DATA = "src/data/projects.json"
REVIEWED = "projects_reviewed.json"
CONTENT = "content/home/projects"
README = "README.md"
START_MARKER = "<!-- projects:start -->"
END_MARKER = "<!-- projects:end -->"
RECENT = 12          # commits listed per project
CHECK_SHOWN = 5      # commits listed per project by --check
TIMEOUT = 30


class Unavailable(Exception):
    """A repository could not be read; its last known data is kept."""


def day(stamp: str) -> str:
    """An ISO timestamp as a UTC date, so GitHub and a local clone agree."""
    return datetime.fromisoformat(stamp.replace("Z", "+00:00")).astimezone(timezone.utc).date().isoformat()


def subject(message: str) -> str:
    return message.strip().splitlines()[0].strip() if message.strip() else ""


# --- reading from GitHub ---------------------------------------------------

class GitHub:
    def __init__(self, token: str | None):
        import requests

        self.requests = requests
        self.headers = {"Accept": "application/vnd.github+json"}
        if token:
            self.headers["Authorization"] = f"Bearer {token}"

    def get(self, path: str, **params):
        try:
            response = self.requests.get(
                f"https://api.github.com{path}", params=params, headers=self.headers, timeout=TIMEOUT
            )
        except self.requests.RequestException as e:
            raise Unavailable(str(e)) from e
        if response.status_code != 200:
            # A private repository answers 404 to a token that cannot read it
            raise Unavailable(f"HTTP {response.status_code}")
        return response

    def read(self, project: dict) -> dict:
        repo = project["repo"]
        info = self.get(f"/repos/{repo}").json()

        newest = self.get(f"/repos/{repo}/commits", per_page=1)
        last_page = re.search(r'[?&]page=(\d+)>; rel="last"', newest.headers.get("Link", ""))
        total = int(last_page.group(1)) if last_page else len(newest.json())
        oldest = self.get(f"/repos/{repo}/commits", per_page=1, page=total).json() if total > 1 else newest.json()

        commits = self.get(f"/repos/{repo}/commits", per_page=RECENT * 3).json()
        return {
            "private": bool(info["private"]),
            "url": info["html_url"],
            "head": commits[0]["sha"] if commits else "",
            "started": day(oldest[0]["commit"]["committer"]["date"]) if oldest else "",
            "updated": day(commits[0]["commit"]["committer"]["date"]) if commits else "",
            "commits": total,
            "recent": [
                {"date": day(c["commit"]["committer"]["date"]), "subject": subject(c["commit"]["message"])}
                for c in commits
                if len(c["parents"]) < 2
            ][:RECENT],
        }

    def since(self, project: dict, sha: str) -> dict:
        """What has been pushed since the commit a write-up was revised at."""
        repo = project["repo"]
        info = self.get(f"/repos/{repo}").json()
        try:
            compared = self.get(f"/repos/{repo}/compare/{sha}...{info['default_branch']}").json()
        except Unavailable:
            return {"lost": True}
        found = {"count": compared["ahead_by"]}
        # This output ends up in public workflow logs, so the same rule applies as for the site
        if not info["private"] or project.get("share"):
            found["new"] = [
                subject(c["commit"]["message"]) for c in reversed(compared["commits"]) if len(c["parents"]) < 2
            ]
        return found


# --- reading from clones on this machine ------------------------------------

def git(clone: Path, *args: str) -> str:
    result = subprocess.run(["git", "-C", str(clone), *args], capture_output=True, text=True)
    if result.returncode != 0:
        raise Unavailable(result.stderr.strip() or f"git {args[0]} failed")
    return result.stdout.strip()


def find_clones(root: str) -> dict[str, Path]:
    """Map owner/name (lower case) to the clone of it found directly under root."""
    clones = {}
    for folder in sorted(Path(root).expanduser().resolve().iterdir()):
        if not (folder / ".git").exists():
            continue
        try:
            origin = git(folder, "config", "--get", "remote.origin.url")
        except Unavailable:
            continue
        match = re.search(r"github\.com[:/]([^/]+/[^/]+?)(\.git)?/?$", origin)
        if match:
            clones[match.group(1).lower()] = folder
    return clones


class Local:
    def __init__(self, root: str):
        self.clones = find_clones(root)

    def clone(self, project: dict) -> Path:
        clone = self.clones.get(project["repo"].lower())
        if not clone:
            raise Unavailable("no clone found")
        return clone

    def read(self, project: dict) -> dict:
        clone = self.clone(project)
        log = git(clone, "log", "--no-merges", f"-n{RECENT}", "--format=%cI%x1f%s")
        first = git(clone, "log", "--reverse", "--format=%cI").splitlines()
        return {
            # A clone does not know whether its repository is public; main() keeps what was known
            "private": None,
            "url": f"https://github.com/{project['repo']}",
            "head": git(clone, "rev-parse", "HEAD"),
            "started": day(first[0]) if first else "",
            "updated": day(git(clone, "log", "-n1", "--format=%cI")),
            "commits": int(git(clone, "rev-list", "--count", "HEAD")),
            "recent": [
                {"date": day(stamp), "subject": text}
                for stamp, text in (line.split("\x1f", 1) for line in log.splitlines())
            ],
        }

    def since(self, project: dict, sha: str) -> dict:
        clone = self.clone(project)
        found = {"uncommitted": len(git(clone, "status", "--porcelain").splitlines())}
        try:
            found["unpushed"] = int(git(clone, "rev-list", "--count", "@{upstream}..HEAD"))
        except Unavailable:
            pass
        try:
            new = git(clone, "log", "--no-merges", "--format=%s", f"{sha}..HEAD").splitlines()
            found.update(new=new, count=len(new))
        except Unavailable:
            found["lost"] = True
        return found


# --- writing ---------------------------------------------------------------

def load(path: str, default):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def shares_commits(project: dict, entry: dict) -> bool:
    return not entry["private"] or bool(project.get("share"))


def public_entry(project: dict, read: dict) -> dict:
    """What is published about a project. A private one keeps its link and, unless shared, its commits to itself."""
    entry = {
        "name": project["name"],
        "folder": project["folder"],
        "private": read["private"],
        "url": None if read["private"] else read["url"],
        "team": bool(project.get("team")),
        "started": read["started"],
        "updated": read["updated"],
        "commits": read["commits"],
    }
    entry["recent"] = read["recent"] if shares_commits(project, entry) else []
    return entry


def format_changelog(entry: dict) -> str:
    whose = "the team's history of" if entry["team"] else "the latest work on"
    lines = [
        f"# Changelog — {whose} {entry['name']}, read from its repository",
        "",
        "Written by a script from the repository's own history, so this list keeps up as the project does.",
        "",
        f"  {entry['commits']} commits · first {entry['started']} · latest {entry['updated']}",
        "",
    ]
    if entry["recent"]:
        lines += [f"  {commit['date']}  {commit['subject']}" for commit in entry["recent"]]
    else:
        lines.append("The source is private, so only the dates are shown here.")
    lines += ["", "From anywhere in this terminal, `updates` shows the same for every project.", ""]
    return "\n".join(lines)


def cell(text: str) -> str:
    return text.replace("|", "\\|")


def format_lately(entries: list[dict]) -> str:
    rows = sorted((e for e in entries if not e["team"]), key=lambda e: e["updated"], reverse=True)
    lines = [
        "**Lately**",
        "",
        "| Project | Last change | What changed |",
        "| --- | --- | --- |",
    ]
    for entry in rows:
        what = cell(entry["recent"][0]["subject"]) if entry["recent"] else f"private work · {entry['commits']} commits so far"
        lines.append(f"| {entry['name']} | {entry['updated']} | {what} |")
    lines += ["", "<sub>Read from each project's repository every three hours.</sub>"]
    return "\n".join(lines)


def format_source(entry: dict) -> str:
    return "source is private" if entry["private"] else f"[Source]({entry['url']})"


def replace_between(content: str, start: str, end: str, replacement: str, inline: bool = False) -> str:
    """Replace what sits between two markers. Leaves the content alone if either is missing."""
    before, found_start, rest = content.partition(start)
    _, found_end, after = rest.partition(end)
    if not found_start or not found_end:
        return content
    gap = "" if inline else "\n"
    return f"{before}{start}{gap}{replacement}{gap}{end}{after}"


def update_readme(content: str, entries: list[dict]) -> str:
    content = replace_between(content, START_MARKER, END_MARKER, format_lately(entries))
    for entry in entries:
        content = replace_between(
            content,
            f"<!-- source:{entry['folder']}:start -->",
            f"<!-- source:{entry['folder']}:end -->",
            format_source(entry),
            inline=True,
        )
    return content


# --- checking the hand-written pages -----------------------------------------

def check(reader, reviewed: dict, quiet: bool) -> None:
    behind = []
    for project in PROJECTS:
        mark = reviewed.get(project["folder"])
        try:
            found = reader.since(project, mark["sha"]) if mark else {"never": True}
        except Unavailable:
            continue

        notes = []
        if found.get("never"):
            notes.append("write-up never marked as revised")
        if found.get("lost"):
            notes.append(f"history rewritten or not fetched since the write-up was revised on {mark['date']}")
        if found.get("count"):
            notes.append(f"{found['count']} new commit{'s' if found['count'] != 1 else ''}")
        if found.get("unpushed"):
            notes.append(f"{found['unpushed']} not pushed yet")
        if found.get("uncommitted"):
            notes.append(f"uncommitted changes in {found['uncommitted']} path{'s' if found['uncommitted'] != 1 else ''}")
        if notes:
            behind.append((project, notes, found.get("new", [])))

    if not behind:
        if not quiet:
            print("Every project write-up is up to date with its repository.")
        return

    print("Portfolio check: these projects have changed since their write-up on the personal site (KathFK1234) was last revised.")
    for project, notes, new in behind:
        print(f"  {project['name']} ({CONTENT}/{project['folder']}/): {', '.join(notes)}")
        for line in new[:CHECK_SHOWN]:
            print(f"      {line}")
        if len(new) > CHECK_SHOWN:
            print(f"      ... and {len(new) - CHECK_SHOWN} more")
    print(
        "The dated lists (CHANGELOG.md, the README's Lately table, `updates`) refresh themselves every three hours. "
        "The prose does not: the project's README.md there, its card in the profile README, and the `projects` command. "
        "After revising them, run: python3 projects_sync_script.py --mark-reviewed"
    )


def mark_reviewed(reader, reviewed: dict, folders: list[str]) -> None:
    for project in PROJECTS:
        if folders and project["folder"] not in folders:
            continue
        try:
            read = reader.read(project)
        except Unavailable as e:
            print(f"Warning: {project['name']} left as it was ({e})")
            continue
        reviewed[project["folder"]] = {"sha": read["head"], "date": read["updated"]}
        print(f"{project['name']}: write-up marked as revised at {read['head'][:7]}")
    Path(REVIEWED).write_text(json.dumps(reviewed, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Update the portfolio from the projects it describes")
    parser.add_argument(
        "--local", default=None, metavar="FOLDER",
        help="Read the clones found in this folder instead of GitHub",
    )
    parser.add_argument(
        "--token", default=os.environ.get("GITHUB_TOKEN"),
        help="GitHub Personal Access Token (optional; defaults to $GITHUB_TOKEN)",
    )
    parser.add_argument("--check", action="store_true", help="Say which write-ups are behind their repository")
    parser.add_argument("--quiet", action="store_true", help="With --check, say nothing when nothing is behind")
    parser.add_argument(
        "--mark-reviewed", nargs="*", metavar="FOLDER", default=None,
        help="Record that the write-ups (all, or the folders named) are up to date",
    )
    parser.add_argument("--dry-run", action="store_true", help="Show what would be written without modifying files")
    args = parser.parse_args()

    # Paths are relative to the repository, wherever the script is run from
    os.chdir(Path(__file__).resolve().parent)
    reader = Local(args.local) if args.local else GitHub(args.token)
    reviewed = load(REVIEWED, {})

    if args.check:
        check(reader, reviewed, args.quiet)
        return
    if args.mark_reviewed is not None:
        mark_reviewed(reader, reviewed, args.mark_reviewed)
        return

    previous = {entry["folder"]: entry for entry in load(DATA, {}).get("projects", [])}
    entries = []
    for project in PROJECTS:
        known = previous.get(project["folder"])
        try:
            read = reader.read(project)
        except Unavailable as e:
            # Stale is better than missing
            print(f"Warning: could not read {project['name']} ({e}); keeping what was known.")
            if known:
                entries.append(known)
            continue
        if read["private"] is None:
            # Unknown from a clone: keep what GitHub last said, and assume private until it has
            read["private"] = known["private"] if known else True
        entry = public_entry(project, read)
        entries.append(entry)
        print(f"{entry['name']}: {entry['commits']} commits, latest {entry['updated']}"
              f"{' (private)' if entry['private'] else ''}")

    if not entries:
        print("Error: no project could be read.")
        sys.exit(1)

    files = {Path(DATA): json.dumps({"projects": entries}, indent=2, ensure_ascii=False) + "\n"}
    for entry in entries:
        files[Path(CONTENT) / entry["folder"] / "CHANGELOG.md"] = format_changelog(entry)
    readme = Path(README)
    if readme.exists():
        files[readme] = update_readme(readme.read_text(encoding="utf-8"), entries)

    for path, content in files.items():
        if path.exists() and path.read_text(encoding="utf-8") == content:
            print(f"{path} is already up to date.")
        elif args.dry_run:
            print(f"\nDry run - would write {path}:\n")
            print(content if path != readme else format_lately(entries))
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
            print(f"Wrote {path}")


if __name__ == "__main__":
    main()
