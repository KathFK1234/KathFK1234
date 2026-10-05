#!/usr/bin/env python3
"""
Keep the terminal's `mood` command in step with MoodForecast AI.

Reads two things and writes them to src/data/mood.json:

  what the live service can do   its OpenAPI document. Every
                                 GET /api/<name>/{location} endpoint becomes
                                 `mood <name> <place>` in the terminal.
  the words it knows             the place lists (*_PLACES) and the ACTIVITIES
                                 table in the repository's backend/app/services,
                                 used for suggestions and Tab completion.

Nothing here is specific to today's endpoints or lists: add an endpoint, a
place or an activity to MoodForecast AI and it shows up in the terminal after
the next run. The scheduled GitHub Actions workflow runs this once a day.

Usage:
    python3 mood_sync_script.py --dry-run
    python3 mood_sync_script.py

To try changes that are not merged or deployed yet, point it at a local
checkout and a locally running backend:
    python3 mood_sync_script.py --source ../moodforecast_ai --api http://localhost:8000

For higher GitHub rate limits, put a token in the GITHUB_TOKEN environment variable.
"""

import argparse
import ast
import json
import os
import re
import sys
from pathlib import Path

import requests
from requests import RequestException

DEFAULT_REPO = "KathFK1234/moodforecast_ai"
DEFAULT_API = "https://moodforecastai-production.up.railway.app"
SERVICES_DIR = "backend/app/services"
# /api/wellbeing/{location} -> wellbeing
LOCATION_ENDPOINT = re.compile(r"^/api/([a-z][a-z0-9_-]*)/\{location\}$")
TIMEOUT = 30


def read_endpoints(api: str) -> list[dict]:
    """List the service's per-location endpoints from its OpenAPI document."""
    response = requests.get(f"{api.rstrip('/')}/openapi.json", timeout=TIMEOUT)
    response.raise_for_status()

    endpoints = []
    for path, operations in response.json().get("paths", {}).items():
        match = LOCATION_ENDPOINT.match(path)
        operation = operations.get("get")
        if not match or not operation:
            continue
        about = (operation.get("description") or operation.get("summary") or "").strip()
        endpoints.append({
            "name": match.group(1),
            "about": about.splitlines()[0] if about else "",
            "params": [
                {"name": param["name"], "required": bool(param.get("required"))}
                for param in operation.get("parameters", [])
                if param.get("in") == "query"
            ],
        })
    return sorted(endpoints, key=lambda endpoint: endpoint["name"])


def local_sources(checkout: str) -> dict[str, str]:
    """Read the service modules from a local checkout of the repository."""
    folder = Path(checkout) / SERVICES_DIR
    if not folder.is_dir():
        raise FileNotFoundError(f"{folder} does not exist")
    return {path.name: path.read_text(encoding="utf-8") for path in sorted(folder.glob("*.py"))}


def github_sources(repo: str, ref: str | None, token: str | None) -> dict[str, str]:
    """Read the service modules from GitHub."""
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    listing = requests.get(
        f"https://api.github.com/repos/{repo}/contents/{SERVICES_DIR}",
        params={"ref": ref} if ref else None,
        headers=headers,
        timeout=TIMEOUT,
    )
    listing.raise_for_status()

    sources = {}
    for entry in listing.json():
        if entry.get("type") == "file" and entry["name"].endswith(".py"):
            # The download URL is not an API call, so it does not use up the rate limit
            raw = requests.get(entry["download_url"], timeout=TIMEOUT)
            raw.raise_for_status()
            sources[entry["name"]] = raw.text
    return sources


def literal(node: ast.AST):
    """The value of a literal in the source, or None if it is anything else."""
    try:
        return ast.literal_eval(node)
    except (ValueError, SyntaxError):
        return None


def is_strings(value) -> bool:
    return isinstance(value, (tuple, list)) and all(isinstance(item, str) for item in value)


def read_vocabulary(sources: dict[str, str]) -> tuple[dict[str, list[str]], list[dict]]:
    """
    Find the place lists and the activities table in the service modules.

    The modules are parsed, never imported or run. Returns (places, activities):
    places maps a group such as "cold" to its names, from COLD_PLACES = (...).
    """
    places: dict[str, list[str]] = {}
    activities: list[dict] = []

    for name, source in sources.items():
        try:
            tree = ast.parse(source)
        except SyntaxError as e:
            print(f"Warning: could not parse {name}: {e}")
            continue

        for statement in tree.body:
            if not isinstance(statement, ast.Assign) or len(statement.targets) != 1:
                continue
            target = statement.targets[0]
            if not isinstance(target, ast.Name):
                continue

            if target.id.endswith("_PLACES"):
                value = literal(statement.value)
                if is_strings(value) and value:
                    places[target.id[: -len("_PLACES")].lower()] = list(value)

            elif target.id == "ACTIVITIES" and isinstance(statement.value, (ast.Tuple, ast.List)):
                for call in statement.value.elts:
                    if not isinstance(call, ast.Call):
                        continue
                    # Activity(name, category, aliases, ...), positionally or by keyword
                    fields = dict(zip(("name", "category", "aliases"), map(literal, call.args)))
                    fields.update({keyword.arg: literal(keyword.value) for keyword in call.keywords})
                    if (
                        isinstance(fields.get("name"), str)
                        and isinstance(fields.get("category"), str)
                        and is_strings(fields.get("aliases"))
                    ):
                        activities.append({
                            "name": fields["name"],
                            "category": fields["category"],
                            "aliases": list(fields["aliases"]),
                        })

    return dict(sorted(places.items())), activities


def main():
    parser = argparse.ArgumentParser(
        description="Update the terminal's mood command from MoodForecast AI"
    )
    parser.add_argument(
        "--repo", default=DEFAULT_REPO, help=f"GitHub repository (default: {DEFAULT_REPO})"
    )
    parser.add_argument(
        "--ref", default=None, help="Branch, tag or commit to read (default: the default branch)"
    )
    parser.add_argument(
        "--source", default=None, help="Read a local checkout of the repository instead of GitHub"
    )
    parser.add_argument(
        "--api", default=DEFAULT_API, help=f"Base URL of the service (default: {DEFAULT_API})"
    )
    parser.add_argument(
        "--token",
        default=os.environ.get("GITHUB_TOKEN"),
        help="GitHub Personal Access Token (optional; defaults to $GITHUB_TOKEN)",
    )
    parser.add_argument(
        "--data",
        default="src/data/mood.json",
        help="Path to the website data file (default: src/data/mood.json)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be written without modifying files",
    )
    args = parser.parse_args()

    try:
        endpoints = read_endpoints(args.api)
        if args.source:
            sources = local_sources(args.source)
        else:
            sources = github_sources(args.repo, args.ref, args.token)
    except (RequestException, OSError, ValueError) as e:
        # Leave the data file as it was: stale is better than empty
        print(f"Error: could not read MoodForecast AI: {e}")
        sys.exit(1)

    places, activities = read_vocabulary(sources)
    data = {
        "source": {
            "repo": args.repo,
            "ref": "local checkout" if args.source else args.ref or "default branch",
            "api": args.api,
        },
        "endpoints": endpoints,
        "places": places,
        "activities": activities,
    }
    text = json.dumps(data, indent=2, ensure_ascii=False) + "\n"

    print(f"Endpoints:  {', '.join(endpoint['name'] for endpoint in endpoints) or 'none'}")
    print(f"Places:     {sum(len(names) for names in places.values())} in {len(places)} lists")
    print(f"Activities: {len(activities)}")

    if args.dry_run:
        print("\nDry run - would write:\n")
        print(text)
        return

    path = Path(args.data)
    if path.exists() and path.read_text(encoding="utf-8") == text:
        print(f"{path} is already up to date.")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    print(f"Wrote {path}")


if __name__ == "__main__":
    main()
