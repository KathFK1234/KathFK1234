#!/usr/bin/env python3
"""
Fetch programming languages from all public GitHub repositories
and update your README with a curated list.

Usage:
    python update_readme_languages.py --username <your_github_username> --readme README.md

Or with a GitHub token for higher rate limits:
    python update_readme_languages.py --username <your_github_username> --token <your_token> --readme README.md
"""

import requests
import argparse
from collections import Counter
from pathlib import Path
import re


class GitHubLanguageFetcher:
    def __init__(self, username, token=None):
        self.username = username
        self.token = token
        self.headers = {}
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

            response = requests.get(url, headers=self.headers, params=params)

            if response.status_code != 200:
                print(f"Error: {response.status_code}")
                print(response.json())
                break

            repos = response.json()
            if not repos:
                break

            for repo in repos:
                if repo["languages_url"]:
                    lang_response = requests.get(
                        repo["languages_url"], headers=self.headers
                    )
                    if lang_response.status_code == 200:
                        langs = lang_response.json()
                        languages.extend(langs.keys())
                        print(f"  ✓ {repo['name']}: {', '.join(langs.keys())}")

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
        priority_order = [
            "Python",
            "JavaScript",
            "TypeScript",
            "SQL",
            "HTML",
            "CSS",
            "Go",
            "Rust",
            "Java",
            "C++",
        ]

        curated = []
        for lang, count in most_common:
            if lang not in ["Shell", "Dockerfile"]:  # Exclude non-programming
                curated.append(lang)
                if len(curated) >= top_n:
                    break

        return curated

    def format_languages_for_readme(self, languages):
        """Format languages as a markdown string."""
        if not languages:
            return "Not yet determined"
        return " · ".join(languages)


def update_readme(readme_path, formatted_languages):
    """Update the README file with formatted languages."""
    readme_file = Path(readme_path)

    if not readme_file.exists():
        print(f"Error: {readme_path} not found")
        return False

    with open(readme_file, "r", encoding="utf-8") as f:
        content = f.read()

    # Pattern to find and replace the Languages line
    pattern = r"(### \*\*Languages\*\*\n\n)(.+?)(\n\n)"
    replacement = rf"\1{formatted_languages}\3"

    updated_content = re.sub(pattern, replacement, content, flags=re.DOTALL)

    if updated_content == content:
        print("Warning: Could not find '**Languages**' section in README")
        print("Make sure your README has a line like:")
        print("**Languages**")
        print("<languages_will_be_inserted_here>")
        return False

    with open(readme_file, "w", encoding="utf-8") as f:
        f.write(updated_content)

    print(f"✓ Updated {readme_path}")
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Fetch GitHub languages and update your README"
    )
    parser.add_argument("--username", required=True, help="GitHub username")
    parser.add_argument("--token", help="GitHub Personal Access Token (optional)")
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
        return

    print(f"\n✓ Found {len(languages)} language instances across your repositories\n")

    curated = fetcher.get_curated_languages(languages, args.top_n)
    formatted = fetcher.format_languages_for_readme(curated)

    print("📝 Curated languages for your README:\n")
    print(f"  {formatted}\n")

    if args.dry_run:
        print("(Dry run: README not modified)")
    else:
        if update_readme(args.readme, formatted):
            print("✨ Your README is ready!")
        else:
            print("\n💡 Tip: You can manually add this line to your README:")
            print(f"\n**Languages**\n{formatted}\n")


if __name__ == "__main__":
    main()