#!/usr/bin/env python3
"""
Fetch programming languages from all public GitHub repositories
and update your README with a curated list and a pie chart.

Both are written between these two markers in the README:

    <!-- languages:start -->
    <!-- languages:end -->

Usage:
    python3 languages_update_script.py --dry-run
    python3 languages_update_script.py --username <your_github_username> --readme README.md

For higher rate limits, put a token in the GITHUB_TOKEN environment variable
(preferred, since it stays out of your shell history) or pass --token.
"""

import argparse
import os
import re
import sys
from collections import Counter
from pathlib import Path

import requests
from requests import RequestException

START_MARKER = "<!-- languages:start -->"
END_MARKER = "<!-- languages:end -->"
EXCLUDED = ["Shell", "Dockerfile"]  # Exclude non-programming


class GitHubLanguageFetcher:
    def __init__(self, username, token=None):
        self.username = username
        self.token = token
        self.headers = {}
        self.language_bytes = Counter()
        if token:
            self.headers["Authorization"] = f"Bearer {token}"

    def fetch_all_languages(self):
        """Fetch all programming languages from public repositories."""
        languages = []
        page = 1
        per_page = 100

        print(f"Fetching repositories for {self.username}...")

        while True:
            url = f"https://api.github.com/users/{self.username}/repos"
            params = {
                "type": "public",
                "per_page": per_page,
                "page": page,
                "sort": "updated",
            }

            try:
                response = requests.get(
                    url, headers=self.headers, params=params, timeout=20
                )
                response.raise_for_status()
            except RequestException as error:
                # A partial list would silently shrink the README, so stop here.
                raise SystemExit(f"Error fetching repositories: {error}")

            repos = response.json()
            if not repos:
                break

            for repo in repos:
                if repo["languages_url"]:
                    try:
                        lang_response = requests.get(
                            repo["languages_url"], headers=self.headers, timeout=20
                        )
                        lang_response.raise_for_status()
                        langs = lang_response.json()
                        languages.extend(langs.keys())
                        self.language_bytes.update(langs)
                        print(f"  ✓ {repo['name']}: {', '.join(langs.keys())}")
                    except RequestException as error:
                        print(f"  Could not read languages for {repo['name']}: {error}")

            page += 1

        return languages

    def get_curated_languages(self, languages, top_n=12):
        """
        Get the most frequently used languages, with some curation.
        Returns both raw count and a curated list for the README.
        """
        if not languages:
            return []

        counter = Counter(languages)
        most_common = counter.most_common(top_n * 2)  # Get extra to curate

        # Prioritize languages and filter
        curated = []
        for lang, count in most_common:
            if lang not in EXCLUDED:
                curated.append(lang)
                if len(curated) >= top_n:
                    break

        return curated

    def format_languages_for_readme(self, languages):
        """Format languages as a markdown string."""
        if not languages:
            return "No languages detected"
        return " · ".join(languages)

    def format_chart_for_readme(self, languages):
        """Format a Mermaid pie chart of code volume for the curated languages."""
        sizes = sorted(
            ((lang, self.language_bytes[lang]) for lang in languages),
            key=lambda item: item[1],
            reverse=True,
        )
        lines = ["```mermaid", "pie title Code in my public repositories (KB)"]
        lines += [f'    "{lang}" : {size / 1024:.1f}' for lang, size in sizes if size]
        lines.append("```")
        return "\n".join(lines)


def update_readme(readme_path, formatted_languages):
    """Update the README file with formatted languages."""
    readme_file = Path(readme_path)

    if not readme_file.exists():
        print(f"Error: {readme_path} not found")
        return False

    with open(readme_file, "r", encoding="utf-8") as f:
        content = f.read()

    # Replace whatever sits between the two markers
    pattern = re.compile(
        rf"({re.escape(START_MARKER)}\n).*?(\n{re.escape(END_MARKER)})", re.DOTALL
    )

    if not pattern.search(content):
        print("Warning: Could not find the languages markers in README")
        print("Make sure your README has these two lines:")
        print(START_MARKER)
        print(END_MARKER)
        return False

    # A function replacement keeps names like "C#" or "\\" from being read as regex syntax
    updated_content = pattern.sub(
        lambda match: f"{match.group(1)}{formatted_languages}{match.group(2)}", content
    )

    if updated_content == content:
        print(f"✓ {readme_path} is already up to date")
        return True

    with open(readme_file, "w", encoding="utf-8") as f:
        f.write(updated_content)

    print(f"✓ Updated {readme_path}")
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Fetch GitHub languages and update your README"
    )
    parser.add_argument(
        "--username", default="KathFK1234", help="GitHub username (default: KathFK1234)"
    )
    parser.add_argument(
        "--token",
        default=os.environ.get("GITHUB_TOKEN"),
        help="GitHub Personal Access Token (optional; defaults to $GITHUB_TOKEN)",
    )
    parser.add_argument(
        "--readme", default="README.md", help="Path to README file (default: README.md)"
    )
    parser.add_argument(
        "--top-n",
        type=int,
        default=12,
        help="Number of top languages to include (default: 12)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be updated without modifying files",
    )

    args = parser.parse_args()

    fetcher = GitHubLanguageFetcher(args.username, args.token)

    print("\n🔍 Fetching your public repositories...\n")
    languages = fetcher.fetch_all_languages()

    if not languages:
        print("No languages found. Check your username and try again.")
        return 1

    print(f"\n✓ Found {len(languages)} language instances across your repositories\n")

    curated = fetcher.get_curated_languages(languages, args.top_n)
    formatted = fetcher.format_languages_for_readme(curated)
    formatted += "\n\n" + fetcher.format_chart_for_readme(curated)

    print("📝 Curated languages for your README:\n")
    print(f"{formatted}\n")

    if args.dry_run:
        print("(Dry run: README not modified)")
    else:
        if update_readme(args.readme, formatted):
            print("✨ Your README is ready!")
        else:
            print("\n💡 Tip: You can manually add these lines to your README:")
            print(f"\n{START_MARKER}\n{formatted}\n{END_MARKER}\n")
            return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())